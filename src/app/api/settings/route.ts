import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const SettingsSchema = z.object({
  orgId: z.string(),
  name: z.string().optional(),
  emailDomains: z.array(z.string().toLowerCase().trim()).optional(),
  emergencyInterval: z.number().min(1).optional(),
  highInterval: z.number().min(1).optional(),
  midInterval: z.number().min(1).optional(),
  lowInterval: z.number().min(1).optional(),
  workingHoursConfig: z
    .object({
      timezone: z.string(),
      workDays: z.array(z.number().min(0).max(6)),
      startHour: z.number().min(0).max(23),
      endHour: z.number().min(1).max(24),
    })
    .optional(),
  whatsAppDeliveryMode: z.enum(["OWN", "ORG"]).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [org, fullMembership] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: session.user.id } },
      select: { whatsAppDeliveryMode: true },
    }),
  ]);
  return NextResponse.json({
    ...org,
    whatsAppDeliveryMode: fullMembership?.whatsAppDeliveryMode ?? "OWN",
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { orgId, ...updates } = parsed.data;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.whatsAppDeliveryMode && updates.name === undefined && updates.emailDomains === undefined && updates.emergencyInterval === undefined && updates.highInterval === undefined && updates.midInterval === undefined && updates.lowInterval === undefined && updates.workingHoursConfig === undefined) {
    const updatedMembership = await prisma.orgMember.update({
      where: { orgId_userId: { orgId, userId: session.user.id } },
      data: { whatsAppDeliveryMode: parsed.data.whatsAppDeliveryMode },
      select: { whatsAppDeliveryMode: true },
    });

    return NextResponse.json({ whatsAppDeliveryMode: updatedMembership.whatsAppDeliveryMode });
  }

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: {
      name: updates.name,
      emailDomains: updates.emailDomains,
      emergencyInterval: updates.emergencyInterval,
      highInterval: updates.highInterval,
      midInterval: updates.midInterval,
      lowInterval: updates.lowInterval,
      workingHoursConfig: updates.workingHoursConfig
        ? (updates.workingHoursConfig as any)
        : undefined,
    },
  });

  return NextResponse.json(org);
}
