import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/members — update role
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, targetUserId, role } = await req.json();
  if (!orgId || !targetUserId || !role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!["ADMIN", "MEMBER"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const myMembership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!myMembership || myMembership.role !== "OWNER") {
    return NextResponse.json({ error: "Only owner can change roles" }, { status: 403 });
  }
  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const updated = await prisma.orgMember.update({
    where: { orgId_userId: { orgId, userId: targetUserId } },
    data: { role },
  });
  return NextResponse.json(updated);
}

// DELETE /api/members?orgId=xxx&userId=xxx — remove member
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  const targetUserId = req.nextUrl.searchParams.get("userId");
  if (!orgId || !targetUserId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const myMembership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!myMembership || !["OWNER", "ADMIN"].includes(myMembership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  // Prevent removing the owner
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { ownerId: true } });
  if (org?.ownerId === targetUserId) {
    return NextResponse.json({ error: "Cannot remove org owner" }, { status: 400 });
  }

  await prisma.orgMember.delete({
    where: { orgId_userId: { orgId, userId: targetUserId } },
  });
  return NextResponse.json({ success: true });
}
