import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { baileysManager } from "@/lib/whatsapp/manager";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const waSession = await prisma.whatsAppSession.findUnique({ where: { orgId } });
  const liveStatus = baileysManager.getStatus(orgId);

  return NextResponse.json({
    status: waSession?.status ?? "DISCONNECTED",
    liveStatus,
    phone: waSession?.phone ?? null,
  });
}
