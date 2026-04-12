"use client";

import Link from "next/link";
import { formatDistanceToNow, isAfter, isPast } from "date-fns";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    status: string;
    importance: string;
    deadline: string | null;
    completedAt: string | null;
    executorContact?: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
    project?: {
      id: string;
      name: string;
      color: string;
    } | null;
    _count?: { subtasks: number };
  };
  orgId: string;
  onStatusChange?: (taskId: string, newStatus: string) => void;
}

const importanceConfig: Record<string, { dot: string; border: string }> = {
  EMERGENCY: { dot: "bg-red-500", border: "border-l-red-500" },
  HIGH: { dot: "bg-orange-500", border: "border-l-orange-500" },
  MID: { dot: "bg-yellow-500", border: "border-l-yellow-500" },
  LOW: { dot: "bg-green-500", border: "border-l-green-500" },
};

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  TODO: { label: "To Do", bg: "bg-gray-100", text: "text-gray-600" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-blue-100", text: "text-blue-700" },
  BLOCKED: { label: "Blocked", bg: "bg-red-100", text: "text-red-700" },
  DONE: { label: "Done", bg: "bg-green-100", text: "text-green-700" },
  CANCELLED: { label: "Cancelled", bg: "bg-gray-100", text: "text-gray-500" },
};

export default function TaskCard({ task, orgId, onStatusChange }: TaskCardProps) {
  const cfg = importanceConfig[task.importance] ?? importanceConfig.MID;
  const statusCfg = statusConfig[task.status] ?? statusConfig.TODO;

  const isOverdue =
    task.deadline &&
    task.status !== "DONE" &&
    task.status !== "CANCELLED" &&
    isPast(new Date(task.deadline));

  return (
    <Link
      href={task.project ? `/projects/${task.project.id}?orgId=${orgId}` : `/projects?orgId=${orgId}`}
      className={`group block bg-white border border-gray-100 border-l-4 ${cfg.border} rounded-xl p-4 hover:shadow-md hover:border-gray-200 transition-all duration-200`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {task.project && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: task.project.color }}
              >
                {task.project.name}
              </span>
            )}
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}
            >
              {statusCfg.label}
            </span>
          </div>

          <p className="text-sm font-medium text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
            {task.title}
          </p>

          <div className="flex items-center gap-3 mt-2">
            {task.deadline && (
              <span
                className={`text-xs flex items-center gap-1 ${
                  isOverdue ? "text-red-500 font-medium" : "text-gray-400"
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {isOverdue ? "Overdue · " : ""}
                {new Date(task.deadline).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {task._count?.subtasks ? (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {task._count.subtasks} subtask{task._count.subtasks !== 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        </div>

        {task.executorContact && (
          <div className="flex-shrink-0">
            {task.executorContact.avatarUrl ? (
              <img
                src={task.executorContact.avatarUrl}
                alt={task.executorContact.name}
                className="w-7 h-7 rounded-full border border-gray-200"
                title={task.executorContact.name}
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-medium border border-primary-200"
                title={task.executorContact.name}
              >
                {task.executorContact.name[0].toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
