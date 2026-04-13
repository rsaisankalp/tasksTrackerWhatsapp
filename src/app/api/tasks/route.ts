import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildContactIdentityFilters } from "@/lib/contact-identity";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { formatReminderMessage } from "@/lib/reminders/rules";
import { sendWhatsAppForExecutor } from "@/lib/whatsapp/delivery";
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
  selfAssign: z.boolean().optional(), // assign to the logged-in user (find/create contact)
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

async function getTaskAccessContext(orgId: string, userId: string) {
  const [membership, user] = await Promise.all([
    prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    }),
  ]);

  if (!membership) return null;

  const isAdmin = ["OWNER", "ADMIN"].includes(membership.role);
  const contactFilters = buildContactIdentityFilters(user?.email, user?.phone);

  const myContacts = contactFilters.length
    ? await prisma.contact.findMany({
        where: { orgId, OR: contactFilters },
        select: { id: true },
      })
    : [];

  return {
    membership,
    isAdmin,
    myContactIds: myContacts.map((contact) => contact.id),
  };
}

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

  const access = await getTaskAccessContext(orgId, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const taskWhere: any = {
    orgId,
    ...(projectId ? { projectId } : {}),
    ...(status ? { status: status as any } : {}),
    parentId: null,
  };

  if (access.isAdmin) {
    taskWhere.OR = [{ projectId: null }, { projectId: { not: null } }];
  } else {
    taskWhere.OR = [
      {
        projectId: null,
        OR: [
          { createdById: session.user.id },
          ...(access.myContactIds.length ? [{ executorContactId: { in: access.myContactIds } }] : []),
        ],
      },
      { project: { projectVisibility: "ALL", taskVisibility: "ALL" } },
      ...(access.myContactIds.length
        ? [
            {
              project: { projectVisibility: "ALL", taskVisibility: "OWN_ONLY" },
              executorContactId: { in: access.myContactIds },
            },
            {
              project: {
                projectVisibility: "TEAM_ONLY",
                taskVisibility: "ALL",
                members: { some: { contactId: { in: access.myContactIds } } },
              },
            },
            {
              project: {
                projectVisibility: "TEAM_ONLY",
                taskVisibility: "OWN_ONLY",
                members: { some: { contactId: { in: access.myContactIds } } },
              },
              executorContactId: { in: access.myContactIds },
            },
          ]
        : []),
    ];
  }

  const tasks = await prisma.task.findMany({
    where: taskWhere,
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

  const { orgId, subtasks, deadline, selfAssign, ...taskData } = parsed.data;

  // Resolve selfAssign → find or create a Contact for the current user
  if (selfAssign) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, phone: true },
    });
    if (user) {
      // Try to find existing contact by email
      let contact = await prisma.contact.findFirst({
        where: { orgId, email: user.email },
        select: { id: true },
      });
      if (!contact && user.phone) {
        contact = await prisma.contact.findFirst({
          where: { orgId, phone: user.phone },
          select: { id: true },
        });
      }
      if (!contact) {
        // Create one
        contact = await prisma.contact.create({
          data: {
            orgId,
            name: user.name ?? "Me",
            email: user.email,
            phone: user.phone ?? null,
            trustLevel: "INTERNAL",
          },
          select: { id: true },
        });
      }
      taskData.executorContactId = contact.id;
    }
  }

  const access = await getTaskAccessContext(orgId, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (taskData.projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: taskData.projectId,
        orgId,
      },
      select: {
        id: true,
        projectVisibility: true,
        taskCreation: true,
        members: { select: { contactId: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isProjectMember = access.myContactIds.some((contactId) =>
      project.members.some((member) => member.contactId === contactId)
    );

    if (!access.isAdmin && project.projectVisibility === "TEAM_ONLY" && !isProjectMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      !access.isAdmin &&
      project.taskCreation === "TEAM_ONLY" &&
      !isProjectMember
    ) {
      return NextResponse.json({ error: "Only project members can create tasks" }, { status: 403 });
    }
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

      const sendResult = await sendWhatsAppForExecutor({
        orgId,
        phone: contact.phone!,
        executorContactId: contact.id,
        text: msg,
      });

      if (sendResult?.waMessageId) {
        await prisma.reminder.create({
          data: {
            orgId,
            taskId: task.id,
            status: "SENT",
            sentAt: new Date(),
            messageBody: msg,
            waMessageId: sendResult.waMessageId,
          },
        });
      }
    } catch (err) {
      console.error("[tasks/POST] WhatsApp notification failed:", err);
    }
  }

  return NextResponse.json(task, { status: 201 });
}
