import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { baileysManager } from "@/lib/whatsapp/manager";

// GET /api/user/whatsapp — get user's WhatsApp connection status
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const waSession = await prisma.userWhatsAppSession.findUnique({
    where: { userId: session.user.id },
  });

  const liveStatus = baileysManager.getUserSessionStatus(session.user.id);

  return NextResponse.json({
    phone: waSession?.phone ?? null,
    status: waSession?.status ?? "DISCONNECTED",
    liveStatus,
  });
}

// POST /api/user/whatsapp — disconnect user's WhatsApp session
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, orgId } = body;

  if (action === "disconnect") {
    await baileysManager.disconnectUserSession(session.user.id);
    if (orgId) {
      await prisma.orgMember.updateMany({
        where: { orgId, userId: session.user.id },
        data: { whatsAppDeliveryMode: "ORG" },
      });
    }
    return NextResponse.json({ status: "disconnected" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
