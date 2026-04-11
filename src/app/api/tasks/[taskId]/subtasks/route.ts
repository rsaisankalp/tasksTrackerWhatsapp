import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parentTask = await prisma.task.findUnique({
    where: { id: params.taskId },
    include: { org: { include: { members: { where: { userId: session.user.id } } } } },
  });

  if (!parentTask || parentTask.org.members.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const subtask = await prisma.task.create({
    data: {
      orgId: parentTask.orgId,
      parentId: params.taskId,
      projectId: parentTask.projectId,
      title: body.title.trim(),
      description: body.description,
      status: "TODO",
      importance: body.importance ?? parentTask.importance,
      eventType: "ONE_TIME",
      executorContactId: body.executorContactId ?? parentTask.executorContactId,
      createdById: session.user.id,
      deadline: body.deadline ? new Date(body.deadline) : parentTask.deadline,
    },
  });

  return NextResponse.json(subtask, { status: 201 });
}
