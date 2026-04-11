import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS, SessionData } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const memberships = await prisma.orgMember.findMany({
    where: { userId: session.user.id },
    include: { org: true },
    orderBy: { joinedAt: "asc" },
  });

  // No org yet — render onboarding without sidebar (avoids redirect loop)
  if (memberships.length === 0) {
    return <>{children}</>;
  }

  // Refresh session orgId if it's stale (e.g. org created after login)
  const firstMembership = memberships[0];
  if (session.user.orgId !== firstMembership.orgId) {
    const cookieStore = cookies();
    const ironSession = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
    ironSession.orgId = firstMembership.orgId;
    ironSession.orgSlug = firstMembership.org.slug;
    ironSession.orgRole = firstMembership.role;
    await ironSession.save();
  }

  const orgs = memberships.map((m) => ({ ...m.org, role: m.role }));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        orgs={orgs}
        user={{
          id: session.user.id,
          name: session.user.name ?? "",
          email: session.user.email ?? "",
          image: session.user.image ?? null,
        }}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
