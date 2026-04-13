import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminClient from "./admin-client";

function isPlatformAdmin(email: string): boolean {
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(email.toLowerCase());
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isPlatformAdmin(session.user.email ?? "")) redirect("/dashboard");

  const [orgs, waitlistEntries] = await Promise.all([
    prisma.organization.findMany({
      include: {
        owner: { select: { name: true, email: true } },
        members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { role: "asc" },
      },
      _count: { select: { projects: true, tasks: true, contacts: true } },
    },
    orderBy: { createdAt: "desc" },
    }),
    prisma.waitlistEntry.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <AdminClient
      orgs={orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        createdAt: o.createdAt.toISOString(),
        owner: o.owner,
        members: o.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          user: m.user,
        })),
        _count: o._count,
      }))}
      waitlistEntries={waitlistEntries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        createdAt: entry.createdAt.toISOString(),
        invitedAt: entry.invitedAt?.toISOString() ?? null,
        invitedOrgId: entry.invitedOrgId ?? null,
        inviteCode: entry.inviteCode ?? null,
      }))}
    />
  );
}
