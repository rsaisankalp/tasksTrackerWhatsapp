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

  const { orgId } = await req.json();
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
    return NextResponse.json({ groupJid: org.waGroupJid, inviteLink, existing: true });
  }

  const groupName = `${org.name} | TaskFlow`;
  const groupJid = await baileysManager.createGroup(orgId, groupName, []);

  await prisma.organization.update({
    where: { id: orgId },
    data: { waGroupJid: groupJid },
  });

  const inviteLink = await baileysManager.getGroupInviteLink(orgId, groupJid);

  console.log(`[Group] Created group "${groupName}" → ${groupJid}`);
  return NextResponse.json({ groupJid, inviteLink, existing: false });
}
