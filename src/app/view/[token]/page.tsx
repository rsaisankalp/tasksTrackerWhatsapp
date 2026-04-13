"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  importance: string;
  deadline: string | null;
  project: { id: string; name: string; color: string } | null;
  subtasks: Array<{ id: string; title: string; status: string }>;
}

const importanceEmoji: Record<string, string> = {
  EMERGENCY: "🚨",
  HIGH: "🔴",
  MID: "🟡",
  LOW: "🟢",
};

const statusConfig: Record<string, { label: string; color: string; next: string; nextLabel: string }> = {
  TODO: { label: "To Do", color: "bg-gray-100 text-gray-700", next: "IN_PROGRESS", nextLabel: "Start" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700", next: "DONE", nextLabel: "Mark Done" },
  BLOCKED: { label: "Blocked", color: "bg-red-100 text-red-700", next: "IN_PROGRESS", nextLabel: "Unblock" },
  DONE: { label: "Done", color: "bg-green-100 text-green-700", next: "TODO", nextLabel: "Reopen" },
};

export default function ContactViewPage() {
  const params = useParams();
  const token = params.token as string;

  const [contactName, setContactName] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "done">("active");

  useEffect(() => {
    fetch(`/api/view/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setContactName(data.contact.name);
        setTasks(data.tasks);
      })
      .catch(() => setError("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, [token]);

  const updateStatus = async (taskId: string, status: string) => {
    setUpdating(taskId);
    try {
      const res = await fetch(`/api/view/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status } : t
          )
        );
      }
    } finally {
      setUpdating(null);
    }
  };

  const activeTasks = tasks.filter((t) => t.status !== "DONE");
  const doneTasks = tasks.filter((t) => t.status === "DONE");
  const displayTasks = activeTab === "active" ? activeTasks : doneTasks;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FFF5EC 0%, #FFFFFF 100%)" }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#F47C20", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FFF5EC 0%, #FFFFFF 100%)" }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm text-center">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-500 text-sm">This link is invalid or has expired. Contact your admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #FFF5EC 0%, #FFFFFF 100%)" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-4 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #F47C20, #FDB813)" }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-base">My Tasks</h1>
            <p className="text-xs text-gray-500">{contactName}</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-lg font-bold text-gray-900">{activeTasks.length}</div>
            <div className="text-xs text-gray-500">pending</div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "active" ? "bg-gray-900 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600"}`}
          >
            Active ({activeTasks.length})
          </button>
          <button
            onClick={() => setActiveTab("done")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "done" ? "bg-green-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600"}`}
          >
            Done ({doneTasks.length})
          </button>
        </div>

        {/* Task list */}
        {displayTasks.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
            <div className="text-4xl mb-3">{activeTab === "done" ? "🏆" : "✅"}</div>
            <p className="text-gray-500 text-sm">{activeTab === "done" ? "No completed tasks yet" : "All caught up! No pending tasks."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayTasks.map((task) => {
              const cfg = statusConfig[task.status];
              const pendingSubtasks = task.subtasks.filter((s) => s.status !== "DONE");
              const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "DONE";

              return (
                <div key={task.id} className={`bg-white rounded-2xl shadow-sm border p-4 ${isOverdue ? "border-red-200" : "border-gray-100"}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">{importanceEmoji[task.importance] ?? "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-semibold text-gray-900 ${task.status === "DONE" ? "line-through text-gray-400" : ""}`}>
                          {task.title}
                        </p>
                        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.color}`}>
                          {cfg?.label}
                        </span>
                      </div>

                      {task.project && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: task.project.color }} />
                          <span className="text-xs text-gray-400">{task.project.name}</span>
                        </div>
                      )}

                      {task.deadline && (
                        <p className={`text-xs mt-1 ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                          {isOverdue ? "⚠️ Overdue · " : "📅 "}
                          {new Date(task.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}

                      {task.subtasks.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {task.subtasks.map((sub) => (
                            <div key={sub.id} className="flex items-center gap-2 text-xs text-gray-600">
                              <span>{sub.status === "DONE" ? "✅" : "⬜"}</span>
                              <span className={sub.status === "DONE" ? "line-through text-gray-400" : ""}>{sub.title}</span>
                            </div>
                          ))}
                          {pendingSubtasks.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">{pendingSubtasks.length} of {task.subtasks.length} remaining</p>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      {task.status !== "DONE" && cfg && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => updateStatus(task.id, cfg.next)}
                            disabled={updating === task.id}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                              cfg.next === "DONE"
                                ? "bg-green-600 text-white hover:bg-green-700"
                                : cfg.next === "IN_PROGRESS"
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            } disabled:opacity-50`}
                          >
                            {updating === task.id ? "Updating..." : cfg.nextLabel}
                          </button>
                          {(task.status === "TODO" || task.status === "IN_PROGRESS") && (
                            <button
                              onClick={() => updateStatus(task.id, "BLOCKED")}
                              disabled={updating === task.id}
                              className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all disabled:opacity-50"
                            >
                              🚧 Blocked
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
