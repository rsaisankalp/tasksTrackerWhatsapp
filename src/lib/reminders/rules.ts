import type { WorkingHoursConfig } from "@/types";

export function getIntervalHours(
  importance: string,
  config: {
    emergencyInterval: number;
    highInterval: number;
    midInterval: number;
    lowInterval: number;
  }
): number {
  switch (importance) {
    case "EMERGENCY":
      return config.emergencyInterval;
    case "HIGH":
      return config.highInterval;
    case "MID":
      return config.midInterval;
    case "LOW":
      return config.lowInterval;
    default:
      return config.midInterval;
  }
}

export function isWithinWorkingHours(
  now: Date,
  config: WorkingHoursConfig,
  bufferHours: number = 0
): boolean {
  // Use Intl.DateTimeFormat.formatToParts for reliable cross-platform timezone handling
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";

  // Map abbreviated weekday to 0-6 (Sun=0 ... Sat=6)
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 0;
  // hour12: false gives 0-23; "24" can appear for midnight in some locales — normalise it
  const hour = parseInt(hourStr, 10) % 24;

  const isWorkDay = config.workDays.includes(dayOfWeek);
  const effectiveStart = Math.max(0, config.startHour - bufferHours);
  const effectiveEnd = Math.min(24, config.endHour + bufferHours);
  const isWorkHour = hour >= effectiveStart && hour < effectiveEnd;

  return isWorkDay && isWorkHour;
}

export function shouldSendReminder(
  importance: string,
  lastSentAt: Date | null,
  now: Date,
  deadline: Date | null,
  config: {
    emergencyInterval: number;
    highInterval: number;
    midInterval: number;
    lowInterval: number;
    workingHoursConfig: WorkingHoursConfig;
  }
): boolean {
  if (importance === "EMERGENCY") {
    // EMERGENCY: working hours ± 4 hours buffer
    // e.g. 09:00-18:00 → allowed 05:00-22:00
    if (!isWithinWorkingHours(now, config.workingHoursConfig, 4)) {
      return false;
    }
  } else {
    // All other priorities: strictly within working hours
    if (!isWithinWorkingHours(now, config.workingHoursConfig)) {
      return false;
    }
  }

  const intervalMs =
    getIntervalHours(importance, config) * 60 * 60 * 1000;

  if (!lastSentAt) return true;

  return now.getTime() - lastSentAt.getTime() >= intervalMs;
}

export function formatReminderMessage(
  taskTitle: string,
  subtasks: Array<{ index: number; title: string; status: string }>,
  deadline: Date | null,
  importance: string,
  magicLink?: string
): string {
  const importanceEmoji: Record<string, string> = {
    EMERGENCY: "🚨",
    HIGH: "🔴",
    MID: "🟡",
    LOW: "🟢",
  };

  const emoji = importanceEmoji[importance] ?? "📋";

  let msg = `${emoji} *Task Reminder*\n\n`;
  msg += `*${taskTitle}*\n`;

  if (deadline) {
    // Show time if the deadline has a non-midnight time component (typical for events).
    const hasTime = deadline.getHours() !== 0 || deadline.getMinutes() !== 0;
    const deadlineStr = hasTime
      ? deadline.toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        })
      : deadline.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
    msg += `📅 ${hasTime ? "Scheduled" : "Deadline"}: ${deadlineStr}\n`;
  }

  if (subtasks.length > 0) {
    msg += `\nSubtasks:\n`;
    for (const sub of subtasks) {
      const done = sub.status === "DONE";
      msg += `${done ? "✅" : "⬜"} ${sub.index}. ${sub.title}\n`;
    }
    const pending = subtasks.filter((s) => s.status !== "DONE");
    if (pending.length > 0) {
      msg += `\nReply *done ${pending.map((s) => s.index).join(", ")}* to mark complete`;
    }
  } else {
    msg += `\nReply *done* to mark complete`;
  }

  if (magicLink) {
    msg += `\n\n📱 *View your tasks:* ${magicLink}`;
  }

  return msg;
}
