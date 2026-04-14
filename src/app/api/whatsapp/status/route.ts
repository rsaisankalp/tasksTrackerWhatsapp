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

  const [membership, waSession, userWaSession] = await Promise.all([
    prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: session.user.id } },
      select: { whatsAppDeliveryMode: true },
    }),
    prisma.whatsAppSession.findUnique({ where: { orgId } }),
    prisma.userWhatsAppSession.findUnique({
      where: { userId: session.user.id },
      select: { status: true, phone: true },
    }),
  ]);

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const liveStatus = baileysManager.getStatus(orgId);
  const liveUserStatus = baileysManager.getUserSessionStatus(session.user.id);
  const orgStoredStatus = waSession?.status ?? "DISCONNECTED";
  const userStoredStatus = userWaSession?.status ?? "DISCONNECTED";
  const orgEffectiveStatus = liveStatus === "connected"
    ? "CONNECTED"
    : liveStatus === "connecting" || orgStoredStatus === "CONNECTING" || orgStoredStatus === "QR_PENDING"
      ? "QR_PENDING"
      : orgStoredStatus;
  const userEffectiveStatus = liveUserStatus === "connected"
    ? "CONNECTED"
    : liveUserStatus === "connecting" || userStoredStatus === "CONNECTING" || userStoredStatus === "QR_PENDING"
      ? "QR_PENDING"
      : userStoredStatus;

  const deliveryMode = membership.whatsAppDeliveryMode ?? "OWN";
  const prefersOwn = deliveryMode === "OWN";
  const effectiveStatus =
    prefersOwn
      ? (userEffectiveStatus === "CONNECTED" ? "CONNECTED" : orgEffectiveStatus === "CONNECTED" ? "CONNECTED" : userEffectiveStatus === "QR_PENDING" ? "QR_PENDING" : orgEffectiveStatus)
      : (orgEffectiveStatus === "CONNECTED" ? "CONNECTED" : userEffectiveStatus === "CONNECTED" ? "CONNECTED" : orgEffectiveStatus === "QR_PENDING" ? "QR_PENDING" : userEffectiveStatus);
  const effectivePhone =
    prefersOwn
      ? (userEffectiveStatus === "CONNECTED" ? userWaSession?.phone ?? null : orgEffectiveStatus === "CONNECTED" ? waSession?.phone ?? null : null)
      : (orgEffectiveStatus === "CONNECTED" ? waSession?.phone ?? null : userEffectiveStatus === "CONNECTED" ? userWaSession?.phone ?? null : null);
  const effectiveSource =
    prefersOwn
      ? (userEffectiveStatus === "CONNECTED" ? "OWN" : orgEffectiveStatus === "CONNECTED" ? "ORG" : "OWN")
      : (orgEffectiveStatus === "CONNECTED" ? "ORG" : userEffectiveStatus === "CONNECTED" ? "OWN" : "ORG");

  return NextResponse.json({
    status: orgStoredStatus,
    liveStatus,
    phone: waSession?.phone ?? null,
    userStatus: userStoredStatus,
    userLiveStatus: liveUserStatus,
    userPhone: userWaSession?.phone ?? null,
    deliveryMode,
    effectiveStatus,
    effectivePhone,
    effectiveSource,
  });
}
