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

  const orgId =
    searchParams.orgId ||
    (await prisma.orgMember.findFirst({ where: { userId: session.user.id } }))?.orgId;

  if (!orgId) redirect("/onboarding");

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { whatsappSession: true },
  });

  if (!org) redirect("/dashboard");

  return (
    <SettingsClient
      orgId={orgId}
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
          ? {
              status: org.whatsappSession.status,
              phone: org.whatsappSession.phone,
            }
          : null
      }
    />
  );
}
