import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildContactIdentityFilters } from "@/lib/contact-identity";
import { prisma } from "@/lib/prisma";

async function getProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      org: { include: { members: { where: { userId } } } },
      members: true,
    },
  });
  if (!project || project.org.members.length === 0) return null;

  const orgMembership = project.org.members[0];
  const isAdmin = ["OWNER", "ADMIN"].includes(orgMembership.role);
  if (!isAdmin && project.projectVisibility === "TEAM_ONLY") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });
    const contactFilters = buildContactIdentityFilters(user?.email, user?.phone);
    const myContacts = contactFilters.length
      ? await prisma.contact.findMany({
          where: {
            orgId: project.orgId,
            OR: contactFilters,
          },
          select: { id: true },
        })
      : [];
    const myContactIds = new Set(myContacts.map((contact) => contact.id));
    const isProjectMember = project.members.some((member) => myContactIds.has(member.contactId));
    if (!isProjectMember) return null;
  }

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
      projectVisibility: rest.projectVisibility,
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

  const tasks = await prisma.task.findMany({
    where: {
      projectId: params.projectId,
      OR: [
        { archivedStatus: null },
        { archivedStatus: { not: "ARCHIVED" } },
      ],
    },
    select: { id: true, status: true },
  });

  for (const task of tasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        archivedStatus: task.status,
      },
    });
  }

  return NextResponse.json({ success: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(params.projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.project.update({
    where: { id: params.projectId },
    data: { status: "ACTIVE" },
  });

  const tasks = await prisma.task.findMany({
    where: { projectId: params.projectId, archivedStatus: { not: null } },
  });

  for (const task of tasks) {
    const newStatus = (task.archivedStatus && task.archivedStatus !== "ARCHIVED") ? task.archivedStatus : "TODO";
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: newStatus as import("@prisma/client").TaskStatus,
        archivedStatus: null,
      },
    });
  }

  return NextResponse.json({ success: true });
}
