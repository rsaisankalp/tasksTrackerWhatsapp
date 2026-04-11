import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { baileysManager } from "@/lib/whatsapp/manager";

export const runtime = "nodejs";

// POST /api/whatsapp/group — create org WA group and save JID
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await req.json();
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const waStatus = baileysManager.getStatus(orgId);
  if (waStatus !== "connected") {
    return NextResponse.json({ error: "WhatsApp not connected" }, { status: 503 });
  }

  // If group already exists, just return the invite link
  if (org.waGroupJid) {
    const inviteLink = await baileysManager.getGroupInviteLink(orgId, org.waGroupJid);
    return NextResponse.json({ groupJid: org.waGroupJid, inviteLink, existing: true });
  }

  // Create new group — bot is the only member initially, others join via invite
  const groupName = `${org.name} | TaskFlow`;
  // groupCreate requires at least 1 participant besides self; we pass an empty array
  // and WA will create a group with just the bot, then we share invite link
  let groupJid: string;
  try {
    groupJid = await baileysManager.createGroup(orgId, groupName, []);
  } catch {
    // Some WA versions require at least 1 participant; retry with a dummy that will fail gracefully
    return NextResponse.json(
      { error: "Group creation failed — try adding a participant number" },
      { status: 500 }
    );
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { waGroupJid: groupJid },
  });

  const inviteLink = await baileysManager.getGroupInviteLink(orgId, groupJid);

  return NextResponse.json({ groupJid, inviteLink, existing: false });
}

// GET /api/whatsapp/group?orgId=xxx — get invite link for existing group
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { waGroupJid: true, name: true },
  });
  if (!org?.waGroupJid) return NextResponse.json({ inviteLink: null });

  const waStatus = baileysManager.getStatus(orgId);
  if (waStatus !== "connected") return NextResponse.json({ inviteLink: null });

  const inviteLink = await baileysManager.getGroupInviteLink(orgId, org.waGroupJid);
  return NextResponse.json({ groupJid: org.waGroupJid, inviteLink });
}
