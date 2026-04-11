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

  // Stats
  const [taskStats, projects, recentTasks] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: { orgId, parentId: null },
      _count: true,
    }),
    prisma.project.findMany({
      where: { orgId, status: "ACTIVE" },
      include: { _count: { select: { tasks: { where: { parentId: null } } } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.task.findMany({
      where: { orgId, parentId: null, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } },
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
      projects={projects.map((p) => ({
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
    />
  );
}
