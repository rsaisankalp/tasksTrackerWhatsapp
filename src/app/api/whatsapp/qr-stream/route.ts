import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { baileysManager } from "@/lib/whatsapp/manager";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return new Response("orgId required", { status: 400 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Check if already connected
      const waSession = await prisma.whatsAppSession.findUnique({
        where: { orgId },
      });
      if (waSession?.status === "CONNECTED") {
        send({ type: "connected", phone: waSession.phone });
        controller.close();
        return;
      }

      // Listen for QR events
      const onQR = async (qr: string) => {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: "M",
            width: 256,
          });
          send({ type: "qr", data: qrDataUrl });
        } catch (e) {
          console.error("[QR Stream] QR generation error:", e);
        }
      };

      const onConnected = (phone: string) => {
        send({ type: "connected", phone });
        cleanup();
        controller.close();
      };

      const onDisconnected = () => {
        send({ type: "disconnected" });
      };

      const cleanup = () => {
        baileysManager.off(`qr:${orgId}`, onQR);
        baileysManager.off(`connected:${orgId}`, onConnected);
        baileysManager.off(`disconnected:${orgId}`, onDisconnected);
      };

      baileysManager.on(`qr:${orgId}`, onQR);
      baileysManager.on(`connected:${orgId}`, onConnected);
      baileysManager.on(`disconnected:${orgId}`, onDisconnected);

      // Start WA session
      baileysManager.startSession(orgId).catch(console.error);

      // Clean up on abort
      req.signal.addEventListener("abort", () => {
        cleanup();
        controller.close();
      });

      // Keep alive ping every 25s
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => clearInterval(pingInterval));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
