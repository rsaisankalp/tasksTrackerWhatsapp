import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { formatReminderMessage } from "@/lib/reminders/rules";
import { baileysManager } from "@/lib/whatsapp/manager";
import { nanoid } from "nanoid";

const APP_URL = process.env.APP_URL ?? "https://tasks.vaidicpujas.in";

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
  recurringFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
  recurringDays: z.array(z.number()).optional(),
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

  // Auto-assign to General project if no project selected (top-level tasks only)
  let resolvedProjectId = taskData.projectId;
  if (!resolvedProjectId && !taskData.parentId) {
    const generalProject = await prisma.project.findFirst({
      where: { orgId, name: "General" },
      select: { id: true },
    });
    if (generalProject) {
      resolvedProjectId = generalProject.id;
    } else {
      const created = await prisma.project.create({
        data: { orgId, name: "General", color: "#6366f1", status: "ACTIVE" },
        select: { id: true },
      });
      resolvedProjectId = created.id;
    }
    taskData.projectId = resolvedProjectId;
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
        select: { id: true, name: true, phone: true, avatarUrl: true, magicToken: true },
      },
      subtasks: true,
    },
  });

  // Send WhatsApp notification to executor if assigned
  if (task.executorContact?.phone) {
    try {
      const contact = task.executorContact;
      let magicToken = contact.magicToken;
      if (!magicToken) {
        magicToken = nanoid(32);
        await prisma.contact.update({
          where: { id: contact.id },
          data: { magicToken },
        });
      }
      const magicLink = `${APP_URL}/view/${magicToken}`;

      const subtaskList = task.subtasks.map((s, i) => ({
        index: i + 1,
        title: s.title,
        status: s.status,
      }));
      const msg = formatReminderMessage(
        task.title,
        subtaskList,
        task.deadline,
        task.importance,
        magicLink
      );

      const waSession = await prisma.whatsAppSession.findUnique({
        where: { orgId },
        select: { status: true },
      });
      if (waSession?.status === "CONNECTED") {
        const phone = contact.phone!.replace(/\D/g, "");
        await baileysManager.sendMessage(orgId, phone, msg);
      }
    } catch (err) {
      console.error("[tasks/POST] WhatsApp notification failed:", err);
    }
  }

  return NextResponse.json(task, { status: 201 });
}
