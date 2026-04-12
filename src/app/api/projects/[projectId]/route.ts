import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { members: { where: { userId } } } } },
  });
  if (!project || project.org.members.length === 0) return null;
  return project;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(params.projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tasks = await prisma.task.findMany({
    where: { projectId: params.projectId, parentId: null },
    include: {
      executorContact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      _count: { select: { subtasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ...project, tasks });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(params.projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { memberContactIds, ...rest } = body;

  // Update project fields
  const updated = await prisma.project.update({
    where: { id: params.projectId },
    data: {
      name: rest.name,
      description: rest.description,
      color: rest.color,
      status: rest.status,
      taskVisibility: rest.taskVisibility,
      taskCreation: rest.taskCreation,
      startDate: rest.startDate ? new Date(rest.startDate) : undefined,
      endDate: rest.endDate ? new Date(rest.endDate) : undefined,
    },
  });

  // If memberContactIds provided, sync team members
  if (Array.isArray(memberContactIds)) {
    // Delete all current members and recreate
    await prisma.projectMember.deleteMany({ where: { projectId: params.projectId } });
    if (memberContactIds.length > 0) {
      await prisma.projectMember.createMany({
        data: memberContactIds.map((contactId: string) => ({
          projectId: params.projectId,
          contactId,
        })),
        skipDuplicates: true,
      });
    }
  }

  // Return updated project with members
  const withMembers = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { members: { include: { contact: { select: { id: true, name: true, avatarUrl: true, email: true } } } } },
  });

  return NextResponse.json(withMembers);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(params.projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.project.update({
    where: { id: params.projectId },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({ success: true });
}
