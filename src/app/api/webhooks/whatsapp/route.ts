import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWhatsAppMessage, parseGroupCommand, parseTaskCreation, answerGroupStatsQuery } from "@/lib/ai/gemini";
import { baileysManager } from "@/lib/whatsapp/manager";
import { formatReminderMessage } from "@/lib/reminders/rules";
import { nanoid } from "nanoid";

const APP_URL = process.env.APP_URL ?? "https://tasks.vaidicpujas.in";

// Get or generate a magic token for a contact
async function getOrCreateMagicToken(contactId: string): Promise<string> {
  const existing = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { magicToken: true },
  });
  if (existing?.magicToken) return existing.magicToken;
  const token = nanoid(16);
  await prisma.contact.update({ where: { id: contactId }, data: { magicToken: token } });
  return token;
}

export const runtime = "nodejs";

// ── Deduplication: prevent double-processing the same message ────────────────
const processedMessageIds = new Set<string>();
function isAlreadyProcessed(msgId: string): boolean {
  if (processedMessageIds.has(msgId)) return true;
  processedMessageIds.add(msgId);
  // Auto-expire after 10 minutes
  setTimeout(() => processedMessageIds.delete(msgId), 10 * 60 * 1000);
  return false;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, from, messageId, body, quotedMessageId, quotedBody } = await req.json();

  if (!orgId || !from || !body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Deduplicate: skip if we've already processed this message ID
  if (messageId && isAlreadyProcessed(messageId)) {
    console.log(`[Webhook] Duplicate message skipped: ${messageId}`);
    return NextResponse.json({ success: true, processed: false, duplicate: true });
  }

  // Detect group message (JID ends in @g.us)
  const isGroupMessage = from.endsWith("@g.us");

  if (isGroupMessage) {
    return handleGroupCommand(orgId, from, body, quotedBody ?? null);
  }

  // ── Direct message handling ──────────────────────────────────────────────────

  // Normalize phone for DB lookup (strip any @suffix)
  const phone = from.replace(/@.*$/, "");
  const jid = from;

  // Only process DMs if:
  //   1. Message starts with "taskflow" prefix (explicit bot command), OR
  //   2. Message is a direct reply to a task reminder (quotedMessageId)
  // Otherwise ignore — we don't want the bot interrupting normal conversations.
  const hasPrefix = body.trim().toLowerCase().startsWith("taskflow");
  const isTaskReply = !!quotedMessageId;

  if (!hasPrefix && !isTaskReply) {
    console.log(`[Webhook] DM ignored (no prefix/quote) from ${phone}: "${body.substring(0, 50)}"`);
    return NextResponse.json({ success: true, processed: false });
  }

  // Strip the "taskflow" prefix before processing
  const processedBody = hasPrefix
    ? body.trim().replace(/^taskflow\s*/i, "").trim() || body
    : body;

  try {
    let relatedTask: any = null;
    let relatedReminder: any = null;

    // If reply to a specific message, find the original reminder
    if (quotedMessageId) {
      relatedReminder = await prisma.reminder.findFirst({
        where: { waMessageId: quotedMessageId, orgId },
        include: {
          task: {
            include: {
              subtasks: { orderBy: { createdAt: "asc" } },
              comments: { orderBy: { createdAt: "asc" }, take: 10 },
            },
          },
        },
      });
      if (relatedReminder) {
        relatedTask = relatedReminder.task;
      }
    }

    // Find active tasks assigned to this phone (even without a quoted message)
    if (!relatedTask) {
      const contact = await prisma.contact.findFirst({
        where: { orgId, phone: { contains: phone.slice(-10) } },
      });

      if (contact) {
        const tasks = await prisma.task.findMany({
          where: {
            orgId,
            executorContactId: contact.id,
            parentId: null,
            status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
          },
          include: {
            subtasks: { orderBy: { createdAt: "asc" } },
            comments: { orderBy: { createdAt: "asc" }, take: 10 },
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
        });
        if (tasks.length > 0) relatedTask = tasks[0];
      }
    }

    if (!relatedTask) {
      console.log(`[Webhook] No task found for message from ${phone}`);
      return NextResponse.json({ success: true, processed: false });
    }

    // Build context for Gemini
    const subtaskContexts = relatedTask.subtasks.map((s: any, i: number) => ({
      index: i + 1,
      id: s.id,
      title: s.title,
      status: s.status,
    }));

    const commentContexts = relatedTask.comments.map((c: any) => ({
      author: c.author,
      body: c.body,
      createdAt: new Date(c.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    }));

    // Parse message with Gemini
    const aiResult = await parseWhatsAppMessage(
      processedBody,
      relatedTask.title,
      subtaskContexts,
      commentContexts
    );

    console.log(`[Webhook] AI result for "${body}":`, JSON.stringify(aiResult));

    // Save comment if present
    if (aiResult.comment) {
      await prisma.taskComment.create({
        data: {
          orgId,
          taskId: relatedTask.id,
          author: phone,
          body: aiResult.comment,
        },
      });
    }

    // Update completed subtasks
    if (aiResult.completedSubtaskIndices.length > 0) {
      const idsToComplete = aiResult.completedSubtaskIndices
        .map((idx: number) => subtaskContexts.find((s: any) => s.index === idx)?.id)
        .filter(Boolean);

      if (idsToComplete.length > 0) {
        await prisma.task.updateMany({
          where: {
            id: { in: idsToComplete },
            status: { not: "DONE" },
          },
          data: { status: "DONE", completedAt: new Date() },
        });

        await prisma.taskComment.create({
          data: {
            orgId,
            taskId: relatedTask.id,
            author: "system",
            body: `Subtask(s) ${aiResult.completedSubtaskIndices.join(", ")} marked as done via WhatsApp.`,
          },
        });

        // Check if ALL subtasks are now done → mark parent done
        const allSubtasks = await prisma.task.findMany({
          where: { parentId: relatedTask.id },
          select: { status: true },
        });
        const allDone = allSubtasks.length > 0 && allSubtasks.every((s) => s.status === "DONE");
        if (allDone) {
          await prisma.task.update({
            where: { id: relatedTask.id },
            data: { status: "DONE", completedAt: new Date() },
          });
        }
      }
    }

    // Update blocked subtasks
    if (aiResult.blockedSubtaskIndices.length > 0) {
      const idsToBlock = aiResult.blockedSubtaskIndices
        .map((idx: number) => subtaskContexts.find((s: any) => s.index === idx)?.id)
        .filter(Boolean);

      if (idsToBlock.length > 0) {
        await prisma.task.updateMany({
          where: { id: { in: idsToBlock } },
          data: { status: "BLOCKED" },
        });
      }
    }

    // Update parent task status if AI specified
    if (aiResult.newTaskStatus) {
      await prisma.task.update({
        where: { id: relatedTask.id },
        data: {
          status: aiResult.newTaskStatus,
          ...(aiResult.newTaskStatus === "DONE" ? { completedAt: new Date() } : {}),
        },
      });

      await prisma.taskComment.create({
        data: {
          orgId,
          taskId: relatedTask.id,
          author: "system",
          body: `Task status updated to ${aiResult.newTaskStatus} via WhatsApp.`,
        },
      });
    }

    // Update reminder status if task was acknowledged
    if (
      relatedReminder &&
      (aiResult.completedSubtaskIndices.length > 0 || aiResult.newTaskStatus === "DONE")
    ) {
      await prisma.reminder.update({
        where: { id: relatedReminder.id },
        data: { status: "ACKNOWLEDGED" },
      });
    }

    // Send reply if AI has one
    if (aiResult.replyMessage) {
      await baileysManager.sendMessage(orgId, jid, aiResult.replyMessage).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      processed: true,
      intent: aiResult.intent,
      completedCount: aiResult.completedSubtaskIndices.length,
      newStatus: aiResult.newTaskStatus,
    });
  } catch (e) {
    console.error("[Webhook] Error processing message:", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// ── Pending task creation state (per org, in-memory) ─────────────────────────
interface PendingTaskState {
  partial: import("@/lib/ai/gemini").TaskCreationResult;
  question: string;
  expiresAt: number; // timestamp
}
const pendingTaskCreations = new Map<string, PendingTaskState>();

// ── Last created task per org (for "assign to X" follow-ups) ─────────────────
const lastCreatedTask = new Map<string, { id: string; title: string; expiresAt: number }>();

// ── Task creation helper ─────────────────────────────────────────────────────

async function doCreateTask(
  orgId: string,
  details: import("@/lib/ai/gemini").TaskCreationResult
): Promise<string> {
  // Resolve deadline
  let deadline: Date | null = null;
  if (details.deadlineDate) {
    deadline = new Date(details.deadlineDate);
  } else if (details.deadlineDays != null) {
    deadline = new Date(Date.now() + details.deadlineDays * 86400000);
  }

  // Find executor contact by name (fuzzy)
  let executorContactId: string | null = null;
  let executorName: string | null = null;
  if (details.executorName) {
    const contact = await prisma.contact.findFirst({
      where: {
        orgId,
        name: { contains: details.executorName, mode: "insensitive" },
      },
      select: { id: true, name: true, phone: true },
    });
    if (contact) {
      executorContactId = contact.id;
      executorName = contact.name;
    }
  }

  // Use org owner as createdById
  const owner = await prisma.orgMember.findFirst({
    where: { orgId, role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
    orderBy: { joinedAt: "asc" },
  });

  if (!owner) {
    return `❌ Could not create task — org owner not found.`;
  }

  // Auto-assign to General project if not specified
  let projectId: string | undefined;
  const generalProject = await prisma.project.findFirst({
    where: { orgId, name: "General" },
    select: { id: true },
  });
  if (generalProject) {
    projectId = generalProject.id;
  } else {
    const created = await prisma.project.create({
      data: { orgId, name: "General", color: "#6366f1", status: "ACTIVE" },
      select: { id: true },
    });
    projectId = created.id;
  }

  const task = await prisma.task.create({
    data: {
      orgId,
      title: details.title,
      description: details.description ?? null,
      importance: details.importance,
      deadline,
      executorContactId,
      createdById: owner.userId,
      status: "TODO",
      projectId,
    },
  });

  // Store as last created task so follow-up "assign to X" messages work without quoting
  lastCreatedTask.set(orgId, { id: task.id, title: task.title, expiresAt: Date.now() + 5 * 60 * 1000 });
  setTimeout(() => lastCreatedTask.delete(orgId), 5 * 60 * 1000);

  const impEmoji: Record<string, string> = { EMERGENCY: "🚨", HIGH: "🔴", MID: "🟡", LOW: "🟢" };
  let reply =
    `✅ *Task Created*\n\n` +
    `📌 *${task.title}*\n` +
    `${impEmoji[task.importance] ?? "📌"} Priority: ${task.importance}\n` +
    (executorName ? `👤 Assigned to: ${executorName}\n` : `👤 Unassigned\n`) +
    (deadline
      ? `📅 Deadline: ${deadline.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}\n`
      : "");

  // Auto-send reminder to executor if assigned
  if (executorContactId && executorName) {
    const contact = await prisma.contact.findUnique({
      where: { id: executorContactId },
      select: { phone: true, magicToken: true },
    });
    if (contact?.phone) {
      const phone = contact.phone.replace(/\D/g, "");
      const magicToken = contact.magicToken ?? await getOrCreateMagicToken(executorContactId);
      const magicLink = `${APP_URL}/view/${magicToken}`;
      const reminderMsg = formatReminderMessage(task.title, [], deadline, task.importance, magicLink);
      await baileysManager.sendMessage(orgId, `${phone}@s.whatsapp.net`, reminderMsg).catch(console.error);
      reply += `\n📲 Reminder sent to ${executorName}`;
    }
  }

  return reply;
}

// ── Group command handler ────────────────────────────────────────────────────

async function handleGroupCommand(orgId: string, groupJid: string, body: string, quotedBody: string | null = null) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { waGroupJid: true },
    });

    if (!org?.waGroupJid || org.waGroupJid !== groupJid) {
      return NextResponse.json({ success: true, processed: false });
    }

    // ── Check if there's a pending task creation awaiting follow-up ───────────
    const pending = pendingTaskCreations.get(orgId);
    if (pending && pending.expiresAt > Date.now()) {
      const lower = body.trim().toLowerCase();
      // If user says cancel/stop, clear pending state
      if (lower === "cancel" || lower === "stop" || lower === "nevermind") {
        pendingTaskCreations.delete(orgId);
        const reply = "❌ Task creation cancelled.";
        await baileysManager.sendMessage(orgId, groupJid, reply).catch(console.error);
        return NextResponse.json({ success: true, processed: true, intent: "cancelled" });
      }
      // Merge the follow-up answer into the partial task
      const merged = await parseTaskCreation(`${pending.question}\nAnswer: ${body}`);
      const details = {
        title: merged.title || pending.partial.title,
        executorName: merged.executorName ?? pending.partial.executorName,
        deadlineDays: merged.deadlineDays ?? pending.partial.deadlineDays,
        deadlineDate: merged.deadlineDate ?? pending.partial.deadlineDate,
        importance: (merged.importance !== "MID" ? merged.importance : pending.partial.importance) ?? "MID",
        description: merged.description ?? pending.partial.description,
        followUpQuestion: null,
      } as import("@/lib/ai/gemini").TaskCreationResult;
      pendingTaskCreations.delete(orgId);
      const reply = await doCreateTask(orgId, details);
      await baileysManager.sendMessage(orgId, groupJid, reply).catch(console.error);
      return NextResponse.json({ success: true, processed: true, intent: "create_task" });
    }

    // Fetch task titles for AI context
    const recentTasks = await prisma.task.findMany({
      where: { orgId, parentId: null, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } },
      select: { title: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
    const taskTitles = recentTasks.map((t) => t.title);

    // Use AI to classify intent — include quoted message context if replying
    const { intent, taskSearch, updateField, updateValue } = await parseGroupCommand(body, taskTitles, quotedBody);
    console.log(`[Webhook] Group intent="${intent}" taskSearch="${taskSearch}" updateField="${updateField}" updateValue="${updateValue}" for: "${body}"`);

    let reply: string | null = null;

    if (intent === "list_tasks") {
      const tasks = await prisma.task.findMany({
        where: { orgId, parentId: null, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } },
        include: { executorContact: true, subtasks: true },
        orderBy: [{ importance: "asc" }, { deadline: "asc" }],
        take: 20,
      });
      if (tasks.length === 0) {
        reply = "✅ No pending tasks! All caught up.";
      } else {
        const impEmoji: Record<string, string> = { EMERGENCY: "🚨", HIGH: "🔴", MID: "🟡", LOW: "🟢" };
        const stEmoji: Record<string, string> = { TODO: "⬜", IN_PROGRESS: "🔄", BLOCKED: "🚧" };
        reply = `📋 *Pending Tasks (${tasks.length})*\n\n`;
        for (const t of tasks) {
          const deadline = t.deadline
            ? ` | 📅 ${new Date(t.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
            : "";
          const executor = t.executorContact ? ` → ${t.executorContact.name}` : "";
          const pending = t.subtasks.filter((s) => s.status !== "DONE").length;
          const sub = t.subtasks.length > 0 ? ` (${pending}/${t.subtasks.length} pending)` : "";
          reply += `${impEmoji[t.importance] ?? "📌"} ${stEmoji[t.status] ?? "•"} *${t.title}*${executor}${deadline}${sub}\n`;
        }
        reply += `\nType *task [name]* for details`;
      }

    } else if (intent === "status") {
      const [total, done, blocked, inProgress, emergency] = await Promise.all([
        prisma.task.count({ where: { orgId, parentId: null, status: { not: "DONE" } } }),
        prisma.task.count({ where: { orgId, parentId: null, status: "DONE", completedAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
        prisma.task.count({ where: { orgId, parentId: null, status: "BLOCKED" } }),
        prisma.task.count({ where: { orgId, parentId: null, status: "IN_PROGRESS" } }),
        prisma.task.count({ where: { orgId, parentId: null, importance: "EMERGENCY", status: { not: "DONE" } } }),
      ]);
      reply = `📊 *Dashboard Summary*\n\n⬜ Pending: ${total}\n🔄 In Progress: ${inProgress}\n`;
      if (blocked > 0) reply += `🚧 Blocked: ${blocked}\n`;
      if (emergency > 0) reply += `🚨 Emergency: ${emergency}\n`;
      reply += `✅ Done this week: ${done}\n\nType *tasks* to see all pending`;

    } else if (intent === "blocked") {
      const tasks = await prisma.task.findMany({
        where: { orgId, parentId: null, status: "BLOCKED" },
        include: { executorContact: true },
        take: 10,
      });
      if (tasks.length === 0) {
        reply = "✅ No blocked tasks!";
      } else {
        reply = `🚧 *Blocked Tasks (${tasks.length})*\n\n`;
        for (const t of tasks) {
          reply += `• *${t.title}*${t.executorContact ? ` → ${t.executorContact.name}` : ""}\n`;
        }
      }

    } else if (intent === "urgent") {
      const tasks = await prisma.task.findMany({
        where: { orgId, parentId: null, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] }, importance: { in: ["EMERGENCY", "HIGH"] } },
        include: { executorContact: true },
        orderBy: [{ importance: "asc" }, { deadline: "asc" }],
        take: 10,
      });
      if (tasks.length === 0) {
        reply = "✅ No urgent tasks pending!";
      } else {
        const impEmoji: Record<string, string> = { EMERGENCY: "🚨", HIGH: "🔴" };
        reply = `🔴 *Tasks Needing Attention (${tasks.length})*\n\n`;
        for (const t of tasks) {
          const deadline = t.deadline
            ? ` | 📅 ${new Date(t.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
            : "";
          reply += `${impEmoji[t.importance] ?? "🔴"} *${t.title}*${t.executorContact ? ` → ${t.executorContact.name}` : ""}${deadline}\n`;
        }
      }

    } else if (intent === "task_detail") {
      const search = taskSearch || "";
      const task = search
        ? await prisma.task.findFirst({
            where: { orgId, parentId: null, title: { contains: search, mode: "insensitive" } },
            include: { executorContact: true, subtasks: { orderBy: { createdAt: "asc" } } },
          })
        : null;
      if (!task) {
        reply = search ? `❓ No task found matching "${search}"` : `❓ Please specify a task name, e.g. *task [name]*`;
      } else {
        reply = formatReminderMessage(
          task.title,
          task.subtasks.map((s, i) => ({ index: i + 1, title: s.title, status: s.status })),
          task.deadline,
          task.importance
        );
        if (task.executorContact) reply += `\n\n👤 Assigned to: ${task.executorContact.name}`;
      }

    } else if (intent === "remind") {
      const search = taskSearch || "";
      const task = search
        ? await prisma.task.findFirst({
            where: { orgId, parentId: null, title: { contains: search, mode: "insensitive" }, executorContactId: { not: null } },
            include: { executorContact: true, subtasks: { orderBy: { createdAt: "asc" } } },
          })
        : null;
      if (!task || !task.executorContact?.phone) {
        reply = `❓ Task not found or has no executor: "${search}"`;
      } else {
        const phone = task.executorContact.phone.replace(/\D/g, "");
        await baileysManager.sendMessage(
          orgId,
          `${phone}@s.whatsapp.net`,
          formatReminderMessage(task.title, task.subtasks.map((s, i) => ({ index: i + 1, title: s.title, status: s.status })), task.deadline, task.importance)
        );
        reply = `✅ Reminder sent to ${task.executorContact.name} for *${task.title}*`;
      }

    } else if (intent === "overdue") {
      const now = new Date();
      const tasks = await prisma.task.findMany({
        where: { orgId, parentId: null, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] }, deadline: { lt: now } },
        include: { executorContact: true },
        orderBy: { deadline: "asc" },
        take: 15,
      });
      if (tasks.length === 0) {
        reply = "✅ No overdue tasks!";
      } else {
        reply = `⏰ *Overdue Tasks (${tasks.length})*\n\n`;
        for (const t of tasks) {
          const daysLate = Math.floor((now.getTime() - new Date(t.deadline!).getTime()) / 86400000);
          const executor = t.executorContact ? ` → ${t.executorContact.name}` : "";
          reply += `• *${t.title}*${executor} | 📅 ${daysLate}d overdue\n`;
        }
      }

    } else if (intent === "stats_query") {
      // Gather comprehensive org data and let AI answer the question
      const [allTasks, contacts, projects] = await Promise.all([
        prisma.task.findMany({
          where: { orgId, parentId: null },
          include: { executorContact: true, project: true },
          orderBy: { updatedAt: "desc" },
          take: 200,
        }),
        prisma.contact.findMany({ where: { orgId }, select: { name: true } }),
        prisma.project.findMany({ where: { orgId }, select: { name: true } }).catch(() => [] as { name: string }[]),
      ]);

      // Build a structured text summary for the AI
      const now = new Date();
      const pending = allTasks.filter((t) => ["TODO", "IN_PROGRESS", "BLOCKED"].includes(t.status));
      const done = allTasks.filter((t) => t.status === "DONE");
      const overdueTasks = pending.filter((t) => t.deadline && new Date(t.deadline) < now);

      // Per-person task counts
      const perPerson: Record<string, { pending: number; done: number }> = {};
      for (const t of allTasks) {
        const name = t.executorContact?.name ?? "Unassigned";
        if (!perPerson[name]) perPerson[name] = { pending: 0, done: 0 };
        if (t.status === "DONE") perPerson[name].done++;
        else perPerson[name].pending++;
      }

      // Per-project task counts
      const perProject: Record<string, { pending: number; done: number }> = {};
      for (const t of allTasks) {
        const proj = (t as any).project?.name ?? "No Project";
        if (!perProject[proj]) perProject[proj] = { pending: 0, done: 0 };
        if (t.status === "DONE") perProject[proj].done++;
        else perProject[proj].pending++;
      }

      const statsContext = [
        `Total tasks: ${allTasks.length} (${pending.length} pending, ${done.length} done)`,
        `Overdue: ${overdueTasks.length}`,
        `Blocked: ${pending.filter((t) => t.status === "BLOCKED").length}`,
        `Emergency: ${pending.filter((t) => t.importance === "EMERGENCY").length}`,
        `Done this week: ${done.filter((t) => t.completedAt && new Date(t.completedAt) > new Date(now.getTime() - 7 * 86400000)).length}`,
        `\nPer person (pending / done):\n${Object.entries(perPerson).map(([n, c]) => `  ${n}: ${c.pending} pending, ${c.done} done`).join("\n")}`,
        `\nPer project (pending / done):\n${Object.entries(perProject).map(([n, c]) => `  ${n}: ${c.pending} pending, ${c.done} done`).join("\n")}`,
        `\nPending task list:\n${pending.slice(0, 30).map((t) => `  [${t.importance}][${t.status}] ${t.title} → ${t.executorContact?.name ?? "Unassigned"}${t.deadline ? ` (due ${new Date(t.deadline).toLocaleDateString("en-IN")})` : ""}`).join("\n")}`,
      ].join("\n");

      reply = await answerGroupStatsQuery(body, statsContext);

    } else if (intent === "create_task") {
      const details = await parseTaskCreation(body);

      if (details.followUpQuestion) {
        // Store partial state and ask the follow-up question
        pendingTaskCreations.set(orgId, {
          partial: details,
          question: details.followUpQuestion,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        });
        reply = `❓ ${details.followUpQuestion}\n\n_(Reply with the details or say *cancel* to abort)_`;
      } else {
        reply = await doCreateTask(orgId, details);
      }

    } else if (intent === "update_task") {
      // Find the task — prefer taskSearch, fall back to quotedBody, then lastCreatedTask
      const search = taskSearch || (() => {
        if (quotedBody) {
          const m = quotedBody.match(/📌\s*\*?([^*\n]+)\*?/);
          if (m) return m[1].trim();
        }
        const last = lastCreatedTask.get(orgId);
        if (last && last.expiresAt > Date.now()) return last.title;
        return "";
      })();

      const task = search
        ? await prisma.task.findFirst({
            where: { orgId, parentId: null, title: { contains: search, mode: "insensitive" } },
            include: { executorContact: true },
          })
        : null;

      if (!task) {
        reply = `❓ Could not find task "${search}". Please mention the task name.`;
      } else if (updateField === "assign" && updateValue) {
        const contact = await prisma.contact.findFirst({
          where: { orgId, name: { contains: updateValue, mode: "insensitive" } },
          select: { id: true, name: true, phone: true },
        });
        if (!contact) {
          reply = `❓ No contact found matching "${updateValue}". Check the name and try again.`;
        } else {
          await prisma.task.update({ where: { id: task.id }, data: { executorContactId: contact.id } });
          reply = `✅ *${task.title}*\n👤 Assigned to: ${contact.name}`;
          // Send reminder to newly assigned executor
          if (contact.phone) {
            const phone = contact.phone.replace(/\D/g, "");
            const reminderMsg = formatReminderMessage(task.title, [], task.deadline ? new Date(task.deadline) : null, task.importance);
            await baileysManager.sendMessage(orgId, `${phone}@s.whatsapp.net`, reminderMsg).catch(console.error);
            reply += `\n📲 Reminder sent to ${contact.name}`;
          }
        }
      } else if (updateField === "status" && updateValue) {
        const statusMap: Record<string, string> = {
          done: "DONE", complete: "DONE", finished: "DONE",
          progress: "IN_PROGRESS", "in progress": "IN_PROGRESS", active: "IN_PROGRESS",
          blocked: "BLOCKED", stuck: "BLOCKED",
          todo: "TODO", pending: "TODO", reopen: "TODO",
        };
        const newStatus = statusMap[updateValue.toLowerCase()] ?? updateValue.toUpperCase();
        await prisma.task.update({
          where: { id: task.id },
          data: { status: newStatus as any, ...(newStatus === "DONE" ? { completedAt: new Date() } : {}) },
        });
        reply = `✅ *${task.title}* → Status: ${newStatus}`;
      } else if (updateField === "deadline" && updateValue) {
        const newDeadline = new Date(updateValue);
        if (isNaN(newDeadline.getTime())) {
          reply = `❓ Could not parse date "${updateValue}". Use format like "2026-04-15" or "15 Apr".`;
        } else {
          await prisma.task.update({ where: { id: task.id }, data: { deadline: newDeadline } });
          reply = `✅ *${task.title}* deadline set to ${newDeadline.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
        }
      } else if (updateField === "priority" && updateValue) {
        const imp = updateValue.toUpperCase() as any;
        await prisma.task.update({ where: { id: task.id }, data: { importance: imp } });
        const impEmoji: Record<string, string> = { EMERGENCY: "🚨", HIGH: "🔴", MID: "🟡", LOW: "🟢" };
        reply = `✅ *${task.title}* priority set to ${impEmoji[imp] ?? ""} ${imp}`;
      } else {
        reply = `❓ Not sure what to update. Try "assign to [name]", "mark as done", "deadline [date]", or "priority [level]".`;
      }

    } else if (intent === "help") {
      reply = `👋 *TaskFlow Bot*\n\nJust ask naturally! For example:\n` +
        `• "What tasks are pending?"\n` +
        `• "Show me the status"\n` +
        `• "Any blocked tasks?"\n` +
        `• "What's overdue?"\n` +
        `• "Who has the most tasks?"\n` +
        `• "Follow up on [task name]"\n` +
        `• "Details of [task name]"\n` +
        `• "What needs urgent attention?"\n` +
        `• "Create task: remind Aarti to send list by Friday"\n` +
        `• "Add task for Rahul: fix the report, deadline 2 days"`;
    }

    if (reply) {
      await baileysManager.sendMessage(orgId, groupJid, reply).catch(console.error);
    }

    return NextResponse.json({ success: true, processed: !!reply, intent, command: body });
  } catch (e) {
    console.error("[Webhook] Group command error:", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
