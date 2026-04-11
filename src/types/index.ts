export type {
  Organization,
  OrgMember,
  OrgRole,
  User,
  Contact,
  TrustLevel,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
  Importance,
  EventType,
  Reminder,
  ReminderStatus,
  WhatsAppSession,
  WhatsAppStatus,
} from "@prisma/client";

export interface WorkingHoursConfig {
  timezone: string;
  workDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  startHour: number;
  endHour: number;
}

export interface TaskWithRelations {
  id: string;
  title: string;
  description: string | null;
  status: string;
  importance: string;
  eventType: string;
  deadline: string | null;
  completedAt: string | null;
  projectId: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  executorContact?: {
    id: string;
    name: string;
    phone: string | null;
    avatarUrl: string | null;
  } | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
  subtasks?: TaskWithRelations[];
  _count?: {
    subtasks: number;
  };
}

export interface ContactWithTaskCount {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  department: string | null;
  trustLevel: string;
  avatarUrl: string | null;
  createdAt: string;
  _count: {
    assignedTasks: number;
  };
}
