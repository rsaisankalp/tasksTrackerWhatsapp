import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

// GET /api/invites?orgId=xxx — list invite codes
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.inviteCode.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json(invites);
}

// POST /api/invites — create invite code
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, maxUses = 10, expiresInDays } = await req.json();
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const code = nanoid(8).toUpperCase();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const invite = await prisma.inviteCode.create({
    data: { code, orgId, createdById: session.user.id, maxUses, expiresAt },
  });

  return NextResponse.json(invite, { status: 201 });
}

// DELETE /api/invites?id=xxx — delete invite code
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const invite = await prisma.inviteCode.findUnique({ where: { id } });
  if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: invite.orgId, userId: session.user.id } },
  });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.inviteCode.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
