import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppUsingSenderPreference } from "@/lib/whatsapp/delivery";
import { shouldSendReminder, formatReminderMessage } from "./rules";
import type { WorkingHoursConfig } from "@/types";

const APP_URL = process.env.APP_URL ?? "https://tasks.vaidicpujas.in";

export function startReminderScheduler() {
  console.log("[Scheduler] Starting reminder scheduler...");

  // Run every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    console.log("[Scheduler] Checking reminders...");
    try {
      await checkAndSendReminders();
    } catch (e) {
      console.error("[Scheduler] Error in reminder check:", e);
    }
  });
}

async function checkAndSendReminders() {
  const now = new Date();

  // Get all active tasks with executors (excluding archived projects)
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
      executorContactId: { not: null },
      deadline: { not: null },
      parentId: null,
      project: { status: { not: "ARCHIVED" } },
    },
    include: {
      executorContact: { select: { id: true, name: true, phone: true, magicToken: true } },
      org: true,
      subtasks: {
        orderBy: { createdAt: "asc" },
      },
      reminders: {
        where: { status: "SENT" },
        orderBy: { sentAt: "desc" },
        take: 1,
      },
    },
  });

  for (const task of tasks) {
    try {
      if (!task.executorContact?.phone) continue;

      // Ensure magic token exists for the executor
      let magicToken = task.executorContact.magicToken;
      if (!magicToken) {
        const { nanoid } = await import("nanoid");
        magicToken = nanoid(32);
        await prisma.contact.update({
          where: { id: task.executorContact.id },
          data: { magicToken },
        });
      }
      const magicLink = `${APP_URL}/view/${magicToken}`;

      const orgConfig = task.org;
      const workingHoursConfig = (
        typeof orgConfig.workingHoursConfig === "object"
          ? orgConfig.workingHoursConfig
          : JSON.parse(orgConfig.workingHoursConfig as string)
      ) as WorkingHoursConfig;

      const lastReminder = task.reminders[0];
      const lastSentAt = lastReminder?.sentAt ?? null;

      const shouldSend = shouldSendReminder(
        task.importance,
        lastSentAt,
        now,
        task.deadline,
        {
          emergencyInterval: orgConfig.emergencyInterval,
          highInterval: orgConfig.highInterval,
          midInterval: orgConfig.midInterval,
          lowInterval: orgConfig.lowInterval,
          workingHoursConfig,
        }
      );

      if (!shouldSend) continue;

      // Format ALL subtasks with fixed indices (so user can always reference by number)
      const subtasksFormatted = task.subtasks.map((sub, i) => ({
        index: i + 1,
        title: sub.title,
        status: sub.status,
      }));
      // Only send reminders if there are pending subtasks (or no subtasks)
      const hasPending = subtasksFormatted.length === 0 || subtasksFormatted.some(s => s.status !== "DONE");
      if (!hasPending) continue;

      const messageBody = formatReminderMessage(
        task.title,
        subtasksFormatted,
        task.deadline,
        task.importance,
        magicLink
      );

      const sendResult = await sendWhatsAppUsingSenderPreference({
        orgId: task.orgId,
        phone: task.executorContact.phone!,
        preferredUserId: task.createdById,
        text: messageBody,
      });
      if (!sendResult?.waMessageId) continue;

      // Record reminder
      await prisma.reminder.create({
        data: {
          orgId: task.orgId,
          taskId: task.id,
          status: "SENT",
          sentAt: now,
          messageBody,
          waMessageId: sendResult.waMessageId,
        },
      });

      console.log(
        `[Scheduler] Sent reminder for task "${task.title}" to ${task.executorContact.phone}`
      );
    } catch (e) {
      console.error(`[Scheduler] Error sending reminder for task ${task.id}:`, e);
    }
  }
}
