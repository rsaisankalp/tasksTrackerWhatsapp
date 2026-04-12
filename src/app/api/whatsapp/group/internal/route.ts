import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { baileysManager } from "@/lib/whatsapp/manager";

export const runtime = "nodejs";

// Internal endpoint — protected by webhook secret only (no session needed)
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { orgId, ping } = body;
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, waGroupJid: true },
  });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const waStatus = baileysManager.getStatus(orgId);
  if (waStatus !== "connected") {
    return NextResponse.json({ error: `WA not connected (${waStatus})` }, { status: 503 });
  }

  if (org.waGroupJid) {
    const inviteLink = await baileysManager.getGroupInviteLink(orgId, org.waGroupJid);

    // If ping=true, send a hello to establish group encryption keys
    if (ping) {
      await baileysManager
        .sendMessage(orgId, org.waGroupJid, "👋 TaskFlow bot is active! Type *help* to see available commands.")
        .catch(console.error);
    }

    return NextResponse.json({ groupJid: org.waGroupJid, inviteLink, existing: true });
  }

  const groupName = `${org.name} | TaskFlow`;

  // Pass an initial participant (with an existing DM session) so Signal key exchange succeeds.
  // The participant can be removed after; the key state will be established.
  const initialParticipants: string[] = body.participants ?? [];
  const groupJid = await baileysManager.createGroup(orgId, groupName, initialParticipants.map(p => p.includes("@") ? p : `${p}@s.whatsapp.net`));

  await prisma.organization.update({
    where: { id: orgId },
    data: { waGroupJid: groupJid },
  });

  // Wait briefly for key exchange to settle, then send welcome
  await new Promise(r => setTimeout(r, 3000));
  await baileysManager
    .sendMessage(orgId, groupJid, "👋 *Welcome to TaskFlow!*\n\nThis group lets you query and manage your tasks.\n\nType *help* to see available commands.")
    .catch(console.error);

  const inviteLink = await baileysManager.getGroupInviteLink(orgId, groupJid);

  console.log(`[Group] Created group "${groupName}" → ${groupJid}`);
  return NextResponse.json({ groupJid, inviteLink, existing: false });
}
