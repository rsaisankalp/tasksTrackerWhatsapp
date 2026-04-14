import { auth } from "@/auth";
import { buildContactIdentityFilters } from "@/lib/contact-identity";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProjectsClient from "./projects-client";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { orgId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgId =
    searchParams.orgId ||
    (await prisma.orgMember.findFirst({ where: { userId: session.user.id } }))?.orgId;

  if (!orgId) redirect("/onboarding");

  const [membership, currentUser] = await Promise.all([
    prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: session.user.id } },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, phone: true },
    }),
  ]);

  const isAdmin = !!membership && ["OWNER", "ADMIN"].includes(membership.role);
  const contactFilters = buildContactIdentityFilters(
    currentUser?.email,
    currentUser?.phone
  );

  const myContacts = contactFilters.length
    ? await prisma.contact.findMany({
        where: { orgId, OR: contactFilters },
        select: { id: true },
      })
    : [];
  const myContactIds = myContacts.map((contact) => contact.id);

  const [projects, archivedProjects, contacts] = await Promise.all([
    prisma.project.findMany({
      where: {
        orgId,
        status: { not: "ARCHIVED" },
        ...(isAdmin
          ? {}
          : {
              OR: [
                { projectVisibility: "ALL" },
                {
                  projectVisibility: "TEAM_ONLY",
                  ...(myContactIds.length
                    ? { members: { some: { contactId: { in: myContactIds } } } }
                    : { id: "__no_project__" }),
                },
              ],
            }),
      },
      include: {
        tasks: {
          where: { parentId: null },
          select: { id: true, status: true, importance: true },
        },
        members: {
          include: { contact: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    isAdmin ? prisma.project.findMany({
      where: { orgId, status: "ARCHIVED" },
      include: {
        tasks: {
          where: { parentId: null },
          select: { id: true, status: true, importance: true },
        },
        members: {
          include: { contact: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }) : Promise.resolve([]),
    prisma.contact.findMany({
      where: { orgId },
      select: { id: true, name: true, phone: true, department: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <ProjectsClient
      orgId={orgId}
      contacts={contacts}
      initialProjects={projects.map((p) => ({
        ...p,
        startDate: p.startDate?.toISOString() ?? null,
        endDate: p.endDate?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        members: p.members.map((m) => ({
          contactId: m.contactId,
          name: m.contact.name,
          avatarUrl: m.contact.avatarUrl,
        })),
      }))}
      archivedProjects={archivedProjects.map((p) => ({
        ...p,
        startDate: p.startDate?.toISOString() ?? null,
        endDate: p.endDate?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        members: p.members.map((m) => ({
          contactId: m.contactId,
          name: m.contact.name,
          avatarUrl: m.contact.avatarUrl,
        })),
      }))}
    />
  );
}
