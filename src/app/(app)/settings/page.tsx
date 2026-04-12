import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsClient from "./settings-client";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { orgId?: string; tab?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    select: { orgId: true, role: true },
  });

  const orgId = searchParams.orgId || membership?.orgId;
  if (!orgId) redirect("/onboarding");

  const [org, members, inviteCodes] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      include: { whatsappSession: true },
    }),
    prisma.orgMember.findMany({
      where: { orgId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.inviteCode.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
  ]);

  if (!org) redirect("/dashboard");

  return (
    <SettingsClient
      orgId={orgId}
      currentUserId={session.user.id}
      currentUserRole={membership?.role ?? "MEMBER"}
      initialTab={searchParams.tab ?? "general"}
      org={{
        id: org.id,
        name: org.name,
        slug: org.slug,
        emailDomains: org.emailDomains ?? [],
        emergencyInterval: org.emergencyInterval,
        highInterval: org.highInterval,
        midInterval: org.midInterval,
        lowInterval: org.lowInterval,
        workingHoursConfig: org.workingHoursConfig as any,
      }}
      whatsappSession={
        org.whatsappSession
          ? { status: org.whatsappSession.status, phone: org.whatsappSession.phone }
          : null
      }
      members={members.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        name: m.user.name ?? m.user.email ?? "Unknown",
        email: m.user.email ?? "",
        image: m.user.image ?? null,
      }))}
      inviteCodes={inviteCodes.map((c) => ({
        id: c.id,
        code: c.code,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        createdByName: c.createdBy.name ?? "Unknown",
      }))}
    />
  );
}
