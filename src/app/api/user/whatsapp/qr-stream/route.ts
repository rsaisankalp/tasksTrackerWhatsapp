import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { baileysManager } from "@/lib/whatsapp/manager";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/user/whatsapp/qr-stream?orgId=xxx
 *
 * User-level WhatsApp QR stream for onboarding/settings.
 * Creates a persistent Baileys session for the invited user.
 * Once connected, their phone number is captured and saved to User.phone + Contact.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const orgId = req.nextUrl.searchParams.get("orgId");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      const sessionKey = `user:${userId}`;

      // Check if already connected
      const existingSession = await prisma.userWhatsAppSession.findUnique({
        where: { userId },
      });
      if (existingSession?.status === "CONNECTED") {
        send({ type: "connected", phone: existingSession.phone });
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
          console.error("[User QR Stream] QR generation error:", e);
        }
      };

      const onConnected = async (phone: string) => {
        // Auto-create/link Contact in the org if orgId provided
        if (phone && orgId) {
          try {
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { email: true, name: true },
            });

            const membership = await prisma.orgMember.findUnique({
              where: { orgId_userId: { orgId, userId } },
            });

            if (membership && user) {
              await prisma.orgMember.update({
                where: { orgId_userId: { orgId, userId } },
                data: { whatsAppDeliveryMode: "OWN" },
              });

              const existingContact = await prisma.contact.findFirst({
                where: {
                  orgId,
                  OR: [
                    ...(user.email ? [{ email: user.email }] : []),
                    { phone },
                  ],
                },
              });

              if (existingContact) {
                await prisma.contact.update({
                  where: { id: existingContact.id },
                  data: {
                    phone,
                    ...(user.name && !existingContact.name ? { name: user.name } : {}),
                    ...(user.email && !existingContact.email ? { email: user.email } : {}),
                  },
                });
              } else {
                await prisma.contact.create({
                  data: {
                    orgId,
                    name: user.name ?? user.email ?? "Member",
                    phone,
                    email: user.email,
                    role: "Member",
                    trustLevel: "INTERNAL",
                    createdByUserId: userId,
                  },
                });
              }
            }
          } catch (e) {
            console.error("[User QR Stream] Error linking contact:", e);
          }
        }

        send({ type: "connected", phone });
        cleanup();
        controller.close();
      };

      const onDisconnected = () => {
        send({ type: "disconnected" });
      };

      const cleanup = () => {
        baileysManager.off(`qr:${sessionKey}`, onQR);
        baileysManager.off(`connected:${sessionKey}`, onConnected);
        baileysManager.off(`disconnected:${sessionKey}`, onDisconnected);
      };

      baileysManager.on(`qr:${sessionKey}`, onQR);
      baileysManager.on(`connected:${sessionKey}`, onConnected);
      baileysManager.on(`disconnected:${sessionKey}`, onDisconnected);

      // Start persistent user-level WA session
      baileysManager.startUserSession(userId).catch(console.error);

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
