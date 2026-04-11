import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWhatsAppMessage } from "@/lib/ai/gemini";
import { baileysManager } from "@/lib/whatsapp/manager";
import { formatReminderMessage } from "@/lib/reminders/rules";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, from, messageId, body, quotedMessageId } = await req.json();

  if (!orgId || !from || !body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Detect group message (JID ends in @g.us)
  const isGroupMessage = from.endsWith("@g.us");

  if (isGroupMessage) {
    return handleGroupCommand(orgId, from, body);
  }

  // ── Direct message handling (existing logic) ────────────────────────────────

  // Normalize phone: "628123456789@s.whatsapp.net" → "628123456789"
  const phone = from.replace("@s.whatsapp.net", "").replace("@c.us", "");
  const jid = `${phone}@s.whatsapp.net`;

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

    // If no quoted message, find active tasks assigned to this phone
    if (!relatedTask) {
      const contact = await prisma.contact.findFirst({
        where: {
          orgId,
          phone: { contains: phone.slice(-10) },
        },
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
      body,
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

// ── Group command handler ────────────────────────────────────────────────────

async function handleGroupCommand(orgId: string, groupJid: string, body: string) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { waGroupJid: true },
    });

    // Only handle messages in this org's registered group
    if (!org?.waGroupJid || org.waGroupJid !== groupJid) {
      return NextResponse.json({ success: true, processed: false });
    }

    const cmd = body.trim().toLowerCase();
    let reply: string | null = null;

    // ── tasks / pending ──────────────────────────────────────────────────────
    if (cmd === "tasks" || cmd === "pending" || cmd === "show tasks") {
      const tasks = await prisma.task.findMany({
        where: {
          orgId,
          parentId: null,
          status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
        },
        include: { executorContact: true, subtasks: true },
        orderBy: [{ importance: "asc" }, { deadline: "asc" }],
        take: 20,
      });

      if (tasks.length === 0) {
        reply = "✅ No pending tasks! All caught up.";
      } else {
        const importanceEmoji: Record<string, string> = {
          EMERGENCY: "🚨", HIGH: "🔴", MID: "🟡", LOW: "🟢",
        };
        const statusEmoji: Record<string, string> = {
          TODO: "⬜", IN_PROGRESS: "🔄", BLOCKED: "🚧",
        };
        reply = `📋 *Pending Tasks (${tasks.length})*\n\n`;
        for (const t of tasks) {
          const imp = importanceEmoji[t.importance] ?? "📌";
          const st = statusEmoji[t.status] ?? "•";
          const deadline = t.deadline
            ? ` | 📅 ${new Date(t.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
            : "";
          const executor = t.executorContact ? ` → ${t.executorContact.name}` : "";
          const pending = t.subtasks.filter((s) => s.status !== "DONE").length;
          const subtaskInfo = t.subtasks.length > 0 ? ` (${pending}/${t.subtasks.length} pending)` : "";
          reply += `${imp} ${st} *${t.title}*${executor}${deadline}${subtaskInfo}\n`;
        }
        reply += `\nReply *task [name]* for details`;
      }
    }

    // ── status / dashboard ───────────────────────────────────────────────────
    else if (cmd === "status" || cmd === "dashboard" || cmd === "summary") {
      const [total, done, blocked, inProgress, emergency] = await Promise.all([
        prisma.task.count({ where: { orgId, parentId: null, status: { not: "DONE" } } }),
        prisma.task.count({ where: { orgId, parentId: null, status: "DONE", completedAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
        prisma.task.count({ where: { orgId, parentId: null, status: "BLOCKED" } }),
        prisma.task.count({ where: { orgId, parentId: null, status: "IN_PROGRESS" } }),
        prisma.task.count({ where: { orgId, parentId: null, importance: "EMERGENCY", status: { not: "DONE" } } }),
      ]);

      reply = `📊 *Dashboard Summary*\n\n`;
      reply += `⬜ Pending: ${total}\n`;
      reply += `🔄 In Progress: ${inProgress}\n`;
      if (blocked > 0) reply += `🚧 Blocked: ${blocked}\n`;
      if (emergency > 0) reply += `🚨 Emergency: ${emergency}\n`;
      reply += `✅ Done this week: ${done}\n`;
      reply += `\nType *tasks* to see all pending`;
    }

    // ── blocked ──────────────────────────────────────────────────────────────
    else if (cmd === "blocked") {
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
          const executor = t.executorContact ? ` → ${t.executorContact.name}` : "";
          reply += `• *${t.title}*${executor}\n`;
        }
      }
    }

    // ── task [name] — show detail + reminder ─────────────────────────────────
    else if (cmd.startsWith("task ")) {
      const search = cmd.slice(5).trim();
      const task = await prisma.task.findFirst({
        where: {
          orgId,
          parentId: null,
          title: { contains: search, mode: "insensitive" },
        },
        include: {
          executorContact: true,
          subtasks: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!task) {
        reply = `❓ No task found matching "${search}"`;
      } else {
        reply = formatReminderMessage(
          task.title,
          task.subtasks.map((s, i) => ({ index: i + 1, title: s.title, status: s.status })),
          task.deadline,
          task.importance
        );
        if (task.executorContact) {
          reply += `\n\n👤 Assigned to: ${task.executorContact.name}`;
        }
      }
    }

    // ── remind [name] — manually send reminder to executor ───────────────────
    else if (cmd.startsWith("remind ")) {
      const search = cmd.slice(7).trim();
      const task = await prisma.task.findFirst({
        where: {
          orgId,
          parentId: null,
          title: { contains: search, mode: "insensitive" },
          executorContactId: { not: null },
        },
        include: {
          executorContact: true,
          subtasks: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!task || !task.executorContact?.phone) {
        reply = `❓ Task not found or has no executor: "${search}"`;
      } else {
        const phone = task.executorContact.phone.replace(/\D/g, "");
        const message = formatReminderMessage(
          task.title,
          task.subtasks.map((s, i) => ({ index: i + 1, title: s.title, status: s.status })),
          task.deadline,
          task.importance
        );
        await baileysManager.sendMessage(orgId, `${phone}@s.whatsapp.net`, message);
        reply = `✅ Reminder sent to ${task.executorContact.name} for *${task.title}*`;
      }
    }

    // ── help ─────────────────────────────────────────────────────────────────
    else if (cmd === "help" || cmd === "hi" || cmd === "hello") {
      reply = `👋 *TaskFlow Bot Commands*\n\n` +
        `📋 *tasks* — show all pending tasks\n` +
        `📊 *status* — dashboard summary\n` +
        `🚧 *blocked* — show blocked tasks\n` +
        `🔍 *task [name]* — task details\n` +
        `📲 *remind [name]* — send reminder to executor\n` +
        `❓ *help* — show this menu`;
    }

    if (reply) {
      await baileysManager.sendMessage(orgId, groupJid, reply).catch(console.error);
    }

    return NextResponse.json({ success: true, processed: !!reply, command: cmd });
  } catch (e) {
    console.error("[Webhook] Group command error:", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
