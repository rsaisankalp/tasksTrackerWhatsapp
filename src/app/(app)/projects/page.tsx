import { auth } from "@/auth";
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

  const projects = await prisma.project.findMany({
    where: { orgId, status: { not: "ARCHIVED" } },
    include: {
      tasks: {
        where: { parentId: null },
        select: { id: true, status: true, importance: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ProjectsClient
      orgId={orgId}
      initialProjects={projects.map((p) => ({
        ...p,
        startDate: p.startDate?.toISOString() ?? null,
        endDate: p.endDate?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))}
    />
  );
}
