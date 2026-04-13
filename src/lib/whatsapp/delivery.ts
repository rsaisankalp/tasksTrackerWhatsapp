import { prisma } from "@/lib/prisma";
import { baileysManager } from "@/lib/whatsapp/manager";

type SenderDeliveryTarget = {
  orgId: string;
  phone: string;
  preferredUserId?: string | null;
  text: string;
};

type DeliveryResult = {
  channel: "OWN" | "ORG";
  waMessageId: string | null;
  userId?: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

async function getPreferredSender(orgId: string, preferredUserId?: string | null) {
  if (!preferredUserId) return null;

  return prisma.user.findFirst({
    where: { id: preferredUserId },
    select: {
      id: true,
      userWhatsappSession: { select: { status: true } },
      memberships: {
        where: { orgId },
        select: { whatsAppDeliveryMode: true },
        take: 1,
      },
    },
  });
}

export async function sendWhatsAppUsingSenderPreference({
  orgId,
  phone,
  preferredUserId,
  text,
}: SenderDeliveryTarget): Promise<DeliveryResult | null> {
  const jid = `${normalizePhone(phone)}@s.whatsapp.net`;
  const [sender, orgSession] = await Promise.all([
    getPreferredSender(orgId, preferredUserId),
    prisma.whatsAppSession.findUnique({
      where: { orgId },
      select: { status: true },
    }),
  ]);

  const preferredMode = sender?.memberships[0]?.whatsAppDeliveryMode ?? "OWN";
  const isUserConnected = sender?.userWhatsappSession?.status === "CONNECTED";
  const isOrgConnected = orgSession?.status === "CONNECTED";

  if (preferredMode === "OWN" && sender?.id && isUserConnected) {
    return {
      channel: "OWN",
      userId: sender.id,
      waMessageId: await baileysManager.sendUserMessage(sender.id, jid, text),
    };
  }

  if (isOrgConnected) {
    return {
      channel: "ORG",
      waMessageId: await baileysManager.sendMessage(orgId, jid, text),
    };
  }

  if (sender?.id && isUserConnected) {
    return {
      channel: "OWN",
      userId: sender.id,
      waMessageId: await baileysManager.sendUserMessage(sender.id, jid, text),
    };
  }

  return null;
}
