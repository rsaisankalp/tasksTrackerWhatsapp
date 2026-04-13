import { prisma } from "@/lib/prisma";
import { baileysManager } from "@/lib/whatsapp/manager";

type DeliveryTarget = {
  orgId: string;
  phone: string;
  executorContactId?: string | null;
};

type DeliveryResult = {
  channel: "OWN" | "ORG";
  waMessageId: string | null;
  userId?: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function sendWhatsAppForExecutor({
  orgId,
  phone,
  executorContactId,
  text,
}: DeliveryTarget & { text: string }): Promise<DeliveryResult | null> {
  const normalizedPhone = normalizePhone(phone);
  const jid = `${normalizedPhone}@s.whatsapp.net`;

  let matchedUser:
    | {
        id: string;
        userWhatsappSession: { status: string } | null;
        memberships: { whatsAppDeliveryMode: "OWN" | "ORG" }[];
      }
    | null = null;

  if (executorContactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: executorContactId },
      select: { email: true, phone: true },
    });

    if (contact) {
      matchedUser = await prisma.user.findFirst({
        where: contact.email
          ? { email: contact.email }
          : contact.phone
            ? { phone: contact.phone }
            : { id: "__no_match__" },
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
  }

  const preferredMode = matchedUser?.memberships[0]?.whatsAppDeliveryMode ?? "OWN";
  const isUserConnected = matchedUser?.userWhatsappSession?.status === "CONNECTED";
  const isOrgConnected =
    (await prisma.whatsAppSession.findUnique({
      where: { orgId },
      select: { status: true },
    }))?.status === "CONNECTED";

  if (preferredMode === "OWN" && matchedUser?.id && isUserConnected) {
    return {
      channel: "OWN",
      userId: matchedUser.id,
      waMessageId: await baileysManager.sendUserMessage(matchedUser.id, jid, text),
    };
  }

  if (isOrgConnected) {
    return {
      channel: "ORG",
      waMessageId: await baileysManager.sendMessage(orgId, jid, text),
    };
  }

  if (matchedUser?.id && isUserConnected) {
    return {
      channel: "OWN",
      userId: matchedUser.id,
      waMessageId: await baileysManager.sendUserMessage(matchedUser.id, jid, text),
    };
  }

  return null;
}
