import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppForExecutor } from "@/lib/whatsapp/delivery";
import { formatReminderMessage } from "@/lib/reminders/rules";

export const runtime = "nodejs";

// POST /api/reminders/trigger?orgId=xxx&taskId=xxx
// Manually trigger a reminder for a specific task (for testing / manual send)
export async function POST(req: NextRequest) {
  // Allow internal calls with webhook secret, or require user session
  const internalSecret = req.headers.get("x-webhook-secret");
  const isInternal = internalSecret === process.env.INTERNAL_WEBHOOK_SECRET;

  if (!isInternal) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const taskId = searchParams.get("taskId");

  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const tasks = await prisma.task.findMany({
    where: taskId
      ? { id: taskId, orgId }
      : {
          orgId,
          status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
          executorContactId: { not: null },
          parentId: null,
        },
    include: {
      executorContact: true,
      subtasks: { orderBy: { createdAt: "asc" } },
    },
    take: taskId ? 1 : 50,
  });

  if (tasks.length === 0) {
    return NextResponse.json({ error: "No eligible tasks found" }, { status: 404 });
  }

  const results: { task: string; phone: string; sent: boolean; error?: string }[] = [];

  for (const task of tasks) {
    if (!task.executorContact?.phone) continue;

    const subtasksFormatted = task.subtasks.map((sub, i) => ({
      index: i + 1,
      title: sub.title,
      status: sub.status,
    }));

    const hasPending =
      subtasksFormatted.length === 0 || subtasksFormatted.some((s) => s.status !== "DONE");
    if (!hasPending) continue;

    const messageBody = formatReminderMessage(
      task.title,
      subtasksFormatted,
      task.deadline,
      task.importance
    );

    try {
      const sendResult = await sendWhatsAppForExecutor({
        orgId,
        phone: task.executorContact.phone,
        executorContactId: task.executorContact.id,
        text: messageBody,
      });
      if (!sendResult?.waMessageId) {
        results.push({ task: task.title, phone: task.executorContact.phone, sent: false, error: "No connected WhatsApp session available" });
        continue;
      }

      await prisma.reminder.create({
        data: {
          orgId,
          taskId: task.id,
          status: "SENT",
          sentAt: new Date(),
          messageBody,
          waMessageId: sendResult.waMessageId,
        },
      });

      results.push({ task: task.title, phone: task.executorContact.phone, sent: true });
    } catch (e: any) {
      results.push({ task: task.title, phone: task.executorContact.phone, sent: false, error: e.message });
    }
  }

  return NextResponse.json({ success: true, results });
}
