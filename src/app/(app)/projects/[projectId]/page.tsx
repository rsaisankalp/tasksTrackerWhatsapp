import { auth } from "@/auth";
import { buildContactIdentityFilters } from "@/lib/contact-identity";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import ProjectDetailClient from "./project-detail-client";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { orgId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgId =
    searchParams.orgId ||
    (await prisma.orgMember.findFirst({ where: { userId: session.user.id } }))?.orgId;

  if (!orgId) redirect("/onboarding");

  const [membership, currentUserIdentity] = await Promise.all([
    prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: session.user.id } },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, phone: true, name: true },
    }),
  ]);

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, orgId },
    include: {
      members: {
        include: { contact: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      },
    },
  });

  if (!project) notFound();

  const isAdmin = !!membership && ["OWNER", "ADMIN"].includes(membership.role);
  if (!isAdmin && project.projectVisibility === "TEAM_ONLY") {
    const contactFilters = buildContactIdentityFilters(
      currentUserIdentity?.email,
      currentUserIdentity?.phone
    );
    const myContacts = contactFilters.length
      ? await prisma.contact.findMany({
          where: { orgId, OR: contactFilters },
          select: { id: true },
        })
      : [];
    const myContactIds = new Set(myContacts.map((contact) => contact.id));
    const allowed = project.members.some((member) => myContactIds.has(member.contactId));
    if (!allowed) notFound();
  }

  // For OWN_ONLY visibility, find the contact matching the current user's email
  let filterContactId: string | null = null;
  if (project.taskVisibility === "OWN_ONLY") {
    const contactFilters = buildContactIdentityFilters(
      currentUserIdentity?.email,
      currentUserIdentity?.phone
    );

    if (contactFilters.length) {
      const myContact = await prisma.contact.findFirst({
        where: { orgId, OR: contactFilters },
        select: { id: true },
      });
      filterContactId = myContact?.id ?? null;
    }
  }

  const taskFilter: any = { projectId: params.projectId, parentId: null };
  // Owner/admin always sees all tasks; regular members filtered by visibility
  if (project.taskVisibility === "OWN_ONLY" && !isAdmin && filterContactId) {
    taskFilter.executorContactId = filterContactId;
  }

  const tasks = await prisma.task.findMany({
    where: taskFilter,
    include: {
      executorContact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      subtasks: {
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { subtasks: true } },
    },
    orderBy: [{ importance: "asc" }, { deadline: "asc" }],
  });

  const [contacts, currentUser] = await Promise.all([
    prisma.contact.findMany({
      where: { orgId },
      select: { id: true, name: true, phone: true, department: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, phone: true },
    }),
  ]);

  return (
    <ProjectDetailClient
      orgId={orgId}
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color,
        status: project.status,
        projectVisibility: project.projectVisibility,
        taskVisibility: project.taskVisibility,
        taskCreation: project.taskCreation,
        startDate: project.startDate?.toISOString() ?? null,
        endDate: project.endDate?.toISOString() ?? null,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        members: project.members.map((m) => ({
          contactId: m.contactId,
          name: m.contact.name,
          avatarUrl: m.contact.avatarUrl,
          email: m.contact.email,
        })),
      }}
      initialTasks={tasks.map((t) => ({
        ...t,
        deadline: t.deadline?.toISOString() ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))}
      contacts={contacts}
      isAdmin={!!isAdmin}
      currentUser={currentUser ? { ...currentUser, name: currentUser.name ?? "Me" } : undefined}
    />
  );
}
