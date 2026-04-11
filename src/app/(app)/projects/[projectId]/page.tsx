import { auth } from "@/auth";
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

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, orgId },
  });

  if (!project) notFound();

  const tasks = await prisma.task.findMany({
    where: { projectId: params.projectId, parentId: null },
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

  const contacts = await prisma.contact.findMany({
    where: { orgId },
    select: { id: true, name: true, phone: true, department: true, avatarUrl: true },
    orderBy: { name: "asc" },
  });

  return (
    <ProjectDetailClient
      orgId={orgId}
      project={{
        ...project,
        startDate: project.startDate?.toISOString() ?? null,
        endDate: project.endDate?.toISOString() ?? null,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      }}
      initialTasks={tasks.map((t) => ({
        ...t,
        deadline: t.deadline?.toISOString() ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))}
      contacts={contacts}
    />
  );
}
