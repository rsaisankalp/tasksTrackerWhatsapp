import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      org: { include: { members: { where: { userId } } } },
      executorContact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      subtasks: {
        include: {
          executorContact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      project: { select: { id: true, name: true, color: true } },
      reminders: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!task || task.org.members.length === 0) return null;
  return task;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await getTask(params.taskId, session.user.id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(task);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await getTask(params.taskId, session.user.id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const updated = await prisma.task.update({
    where: { id: params.taskId },
    data: {
      title: body.title,
      description: body.description,
      status: body.status,
      importance: body.importance,
      eventType: body.eventType,
      executorContactId: body.executorContactId,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      reminderHour: body.reminderHour,
      reminderInterval: body.reminderInterval,
      daysBeforeEvent: body.daysBeforeEvent,
      recurringFrequency: body.recurringFrequency,
      recurringDays: body.recurringDays,
      completedAt:
        body.status === "DONE" && !task.completedAt ? new Date() : undefined,
    },
    include: {
      executorContact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      subtasks: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await getTask(params.taskId, session.user.id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.task.delete({ where: { id: params.taskId } });
  return NextResponse.json({ success: true });
}
