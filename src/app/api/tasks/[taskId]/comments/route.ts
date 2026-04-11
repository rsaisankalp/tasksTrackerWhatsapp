import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify task belongs to user's org
  const task = await prisma.task.findFirst({
    where: {
      id: params.taskId,
      org: { members: { some: { userId: session.user.id } } },
    },
    select: { id: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await prisma.taskComment.findMany({
    where: { taskId: params.taskId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { body } = await req.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: {
      id: params.taskId,
      org: { members: { some: { userId: session.user.id } } },
    },
    select: { id: true, orgId: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comment = await prisma.taskComment.create({
    data: {
      orgId: task.orgId,
      taskId: task.id,
      author: session.user.name || session.user.email || "user",
      body: body.trim(),
    },
  });

  return NextResponse.json(comment);
}
