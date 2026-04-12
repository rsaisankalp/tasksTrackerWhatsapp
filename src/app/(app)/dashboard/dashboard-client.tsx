"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDistanceToNow, isAfter } from "date-fns";
import TaskCard from "@/components/board/task-card";
import CreateTaskModal from "@/components/tasks/create-task-modal";

interface DashboardProps {
  orgId: string;
  stats: { todo: number; inProgress: number; blocked: number; done: number };
  projects: any[];
  tasks: any[];
}

const importanceConfig: Record<string, { label: string; color: string; dot: string }> = {
  EMERGENCY: { label: "Emergency", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  MID: { label: "Mid", color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
  LOW: { label: "Low", color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
};

export default function DashboardClient({ orgId, stats, projects, tasks }: DashboardProps) {
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  const total = stats.todo + stats.inProgress + stats.blocked + stats.done;
  const completionRate = total > 0 ? Math.round((stats.done / total) * 100) : 0;

  const filteredTasks =
    activeFilter === "ALL"
      ? tasks
      : tasks.filter((t) => t.importance === activeFilter || t.status === activeFilter);

  const overdueCount = tasks.filter(
    (t) => t.deadline && isAfter(new Date(), new Date(t.deadline))
  ).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={() => setShowCreateTask(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0 md:mb-8">
        <div className="flex-shrink-0 w-36 md:w-auto md:col-span-1 bg-white border border-gray-100 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{completionRate}%</div>
          <div className="text-xs md:text-sm text-gray-500 mt-1">Completion</div>
          <div className="mt-2 bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-primary-500 h-1.5 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
        {[
          { label: "To Do", value: stats.todo, color: "text-gray-600", bg: "bg-gray-50" },
          { label: "In Progress", value: stats.inProgress, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Blocked", value: stats.blocked, color: "text-red-600", bg: "bg-red-50" },
          { label: "Done", value: stats.done, color: "text-green-600", bg: "bg-green-50" },
        ].map((stat) => (
          <div key={stat.label} className={`flex-shrink-0 w-28 md:w-auto ${stat.bg} border border-gray-100 rounded-2xl p-4 md:p-5 shadow-sm`}>
            <div className={`text-2xl md:text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs md:text-sm text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {overdueCount > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <span className="text-sm text-red-700 font-medium">
            {overdueCount} task{overdueCount !== 1 ? "s" : ""} overdue
          </span>
          <button
            onClick={() => setActiveFilter("ALL")}
            className="ml-auto text-xs text-red-600 underline"
          >
            View all
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tasks column */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-lg font-semibold text-gray-900 flex-shrink-0">Active Tasks</h2>
            <div className="flex gap-1 overflow-x-auto pb-0.5 max-w-full">
              {["ALL", "EMERGENCY", "HIGH", "IN_PROGRESS", "BLOCKED"].map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === f
                      ? "bg-primary-100 text-primary-700"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {f === "ALL" ? "All" : f === "IN_PROGRESS" ? "Active" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-gray-500 text-sm">No active tasks</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} orgId={orgId} />
              ))
            )}
          </div>
        </div>

        {/* Projects column */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
            <Link
              href={`/projects?orgId=${orgId}`}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center">
                <p className="text-gray-400 text-sm mb-3">No projects yet</p>
                <Link
                  href={`/projects?orgId=${orgId}`}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Create your first project
                </Link>
              </div>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}?orgId=${orgId}`}
                  className="block bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {project.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {project._count.tasks} task{project._count.tasks !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {showCreateTask && (
        <CreateTaskModal
          orgId={orgId}
          onClose={() => setShowCreateTask(false)}
          onCreated={() => {
            setShowCreateTask(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
