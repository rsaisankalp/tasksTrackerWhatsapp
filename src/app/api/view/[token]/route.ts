import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getContact(token: string) {
  return prisma.contact.findUnique({
    where: { magicToken: token },
    select: { id: true, name: true, orgId: true },
  });
}

// GET /api/view/[token] — get tasks for contact
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const contact = await getContact(params.token);
  if (!contact) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const tasks = await prisma.task.findMany({
    where: {
      executorContactId: contact.id,
      parentId: null,
      status: { notIn: ["CANCELLED", "ARCHIVED"] },
      project: { status: { not: "ARCHIVED" } },
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      subtasks: {
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ status: "asc" }, { importance: "asc" }, { deadline: "asc" }],
  });

  return NextResponse.json({ contact: { name: contact.name }, tasks });
}

// PATCH /api/view/[token] — update task status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const contact = await getContact(params.token);
  if (!contact) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const { taskId, status } = await req.json();
  const validStatuses = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"];
  if (!taskId || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Verify task belongs to this contact
  const task = await prisma.task.findFirst({
    where: { id: taskId, executorContactId: contact.id },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });

  return NextResponse.json(updated);
}
