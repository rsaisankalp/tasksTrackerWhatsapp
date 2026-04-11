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
  config: WorkingHoursConfig
): boolean {
  // Get current time in org's timezone
  const localTime = new Date(
    now.toLocaleString("en-US", { timeZone: config.timezone })
  );

  const dayOfWeek = localTime.getDay(); // 0=Sun
  const hour = localTime.getHours();

  const isWorkDay = config.workDays.includes(dayOfWeek);
  const isWorkHour = hour >= config.startHour && hour < config.endHour;

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
  const isOverdue = deadline !== null && deadline < now;

  // EMERGENCY and overdue tasks bypass working hours
  if (importance !== "EMERGENCY" && !isOverdue) {
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
  importance: string
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
    const deadlineStr = deadline.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    msg += `📅 Deadline: ${deadlineStr}\n`;
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

  return msg;
}
