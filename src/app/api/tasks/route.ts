import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateTaskSchema = z.object({
  orgId: z.string(),
  projectId: z.string().optional(),
  parentId: z.string().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  importance: z.enum(["EMERGENCY", "HIGH", "MID", "LOW"]).default("MID"),
  eventType: z
    .enum(["ONE_TIME", "ONE_TIME_EVENT", "REGULAR", "REPEATABLE"])
    .default("ONE_TIME"),
  executorContactId: z.string().optional(),
  deadline: z.string().optional(),
  reminderHour: z.number().optional(),
  reminderInterval: z.number().optional(),
  daysBeforeEvent: z.number().optional(),
  subtasks: z
    .array(z.object({ title: z.string().min(1) }))
    .optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const orgId = searchParams.get("orgId");
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tasks = await prisma.task.findMany({
    where: {
      orgId,
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as any } : {}),
      parentId: null,
    },
    include: {
      executorContact: {
        select: { id: true, name: true, phone: true, avatarUrl: true },
      },
      project: { select: { id: true, name: true, color: true } },
      _count: { select: { subtasks: true } },
    },
    orderBy: [{ importance: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgId, subtasks, deadline, ...taskData } = parsed.data;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const task = await prisma.task.create({
    data: {
      ...taskData,
      orgId,
      createdById: session.user.id,
      deadline: deadline ? new Date(deadline) : null,
      subtasks: subtasks?.length
        ? {
            create: subtasks.map((sub, i) => ({
              orgId,
              title: sub.title,
              createdById: session.user.id,
              status: "TODO" as const,
            })),
          }
        : undefined,
    },
    include: {
      executorContact: {
        select: { id: true, name: true, phone: true, avatarUrl: true },
      },
      subtasks: true,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
