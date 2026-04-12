import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import OrgJoinClient from "./org-join-client";

interface Props {
  params: { orgSlug: string };
}

// Known app route prefixes — don't treat these as org slugs
const RESERVED_PATHS = new Set([
  "dashboard", "projects", "contacts", "settings", "onboarding",
  "login", "api", "_next", "favicon.ico", "invite",
]);

export default async function OrgLandingPage({ params }: Props) {
  const { orgSlug } = params;

  if (RESERVED_PATHS.has(orgSlug)) {
    notFound();
  }

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });

  if (!org) {
    notFound();
  }

  // If already logged in, auto-add them and redirect to dashboard
  const session = await auth();
  if (session?.user?.id) {
    // Ensure they're a member of this org
    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: org.id, userId: session.user.id } },
      create: { orgId: org.id, userId: session.user.id, role: "MEMBER" },
      update: {},
    });
    // Refresh session to pick up new org
    redirect(`/api/auth/refresh?redirect=/dashboard`);
  }

  return <OrgJoinClient org={org} />;
}
