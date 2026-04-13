import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { orgId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgId =
    searchParams.orgId ||
    (await prisma.orgMember.findFirst({ where: { userId: session.user.id } }))
      ?.orgId;

  if (!orgId) redirect("/onboarding");

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true },
  });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  const isAdmin = !!membership && ["OWNER", "ADMIN"].includes(membership.role);

  const contactFilters = [
    currentUser?.email ? { email: currentUser.email } : null,
    currentUser?.phone ? { phone: currentUser.phone } : null,
  ].filter(Boolean) as any[];

  const myContacts = contactFilters.length
    ? await prisma.contact.findMany({
        where: { orgId, OR: contactFilters },
        select: { id: true },
      })
    : [];
  const myContactIds = myContacts.map((contact) => contact.id);

  const visibleProjectWhere = {
    orgId,
    status: "ACTIVE" as const,
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
  };

  const [visibleProjectIds, visibleProjects] = await Promise.all([
    prisma.project.findMany({
      where: visibleProjectWhere,
      select: { id: true },
    }),
    prisma.project.findMany({
      where: visibleProjectWhere,
      include: {
        _count: { select: { tasks: { where: { parentId: null } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);
  const visibleProjectIdList = visibleProjectIds.map((project) => project.id);

  const taskWhere: any = {
    orgId,
    parentId: null,
  };

  if (isAdmin) {
    taskWhere.OR = [{ projectId: null }, { projectId: { in: visibleProjectIdList } }];
  } else {
    taskWhere.OR = [
      { projectId: null },
      { project: { projectVisibility: "ALL", taskVisibility: "ALL" } },
      ...(myContactIds.length
        ? [
            {
              project: { projectVisibility: "ALL", taskVisibility: "OWN_ONLY" },
              executorContactId: { in: myContactIds },
            },
            {
              project: {
                projectVisibility: "TEAM_ONLY",
                taskVisibility: "ALL",
                members: { some: { contactId: { in: myContactIds } } },
              },
            },
            {
              project: {
                projectVisibility: "TEAM_ONLY",
                taskVisibility: "OWN_ONLY",
                members: { some: { contactId: { in: myContactIds } } },
              },
              executorContactId: { in: myContactIds },
            },
          ]
        : []),
    ];
  }

  // Stats
  const [taskStats, recentTasks] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: taskWhere,
      _count: true,
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere,
        status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
      },
      include: {
        executorContact: { select: { id: true, name: true, avatarUrl: true } },
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { subtasks: true } },
      },
      orderBy: [{ importance: "asc" }, { deadline: "asc" }],
      take: 20,
    }),
  ]);

  const statsMap = Object.fromEntries(
    taskStats.map((s) => [s.status, s._count])
  );

  return (
    <DashboardClient
      orgId={orgId}
      stats={{
        todo: statsMap["TODO"] ?? 0,
        inProgress: statsMap["IN_PROGRESS"] ?? 0,
        blocked: statsMap["BLOCKED"] ?? 0,
        done: statsMap["DONE"] ?? 0,
      }}
      projects={visibleProjects.map((p) => ({
        ...p,
        startDate: p.startDate?.toISOString() ?? null,
        endDate: p.endDate?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))}
      tasks={recentTasks.map((t) => ({
        ...t,
        deadline: t.deadline?.toISOString() ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))}
      currentUser={currentUser ? { ...currentUser, name: currentUser.name ?? "Me" } : undefined}
    />
  );
}
