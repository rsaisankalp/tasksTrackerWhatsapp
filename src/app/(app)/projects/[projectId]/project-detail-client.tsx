"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { isPast } from "date-fns";
import CreateTaskModal from "@/components/tasks/create-task-modal";

const COLUMNS = [
  { key: "TODO", label: "To Do", color: "bg-gray-100", textColor: "text-gray-600" },
  { key: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100", textColor: "text-blue-700" },
  { key: "BLOCKED", label: "Blocked", color: "bg-red-100", textColor: "text-red-700" },
  { key: "DONE", label: "Done", color: "bg-green-100", textColor: "text-green-700" },
];

const importanceConfig: Record<string, { label: string; dot: string; border: string }> = {
  EMERGENCY: { label: "Emergency", dot: "bg-red-500", border: "border-l-red-500" },
  HIGH: { label: "High", dot: "bg-orange-500", border: "border-l-orange-500" },
  MID: { label: "Mid", dot: "bg-yellow-500", border: "border-l-yellow-500" },
  LOW: { label: "Low", dot: "bg-green-500", border: "border-l-green-500" },
};

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  importance: string;
  eventType: string;
  deadline: string | null;
  executorContact?: { id: string; name: string; avatarUrl: string | null } | null;
  subtasks: Array<{ id: string; title: string; status: string }>;
  _count?: { subtasks: number };
}

interface ProjectDetailClientProps {
  orgId: string;
  project: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  initialTasks: Task[];
  contacts: Array<{ id: string; name: string; phone: string | null; department: string | null; avatarUrl: string | null }>;
}

export default function ProjectDetailClient({
  orgId,
  project,
  initialTasks,
  contacts,
}: ProjectDetailClientProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
    return acc;
  }, {} as Record<string, Task[]>);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setUpdatingTask(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      }
    } finally {
      setUpdatingTask(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3 mb-1">
          <Link
            href={`/projects?orgId=${orgId}`}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Projects
          </Link>
          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm text-gray-700 font-medium">{project.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          </div>
          <button
            onClick={() => setShowCreateTask(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-h-[500px]" style={{ minWidth: "900px" }}>
          {COLUMNS.map((col) => {
            const colTasks = tasksByStatus[col.key] ?? [];
            return (
              <div key={col.key} className="flex-1 flex flex-col min-w-[220px]">
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${col.color} ${col.textColor}`}
                  >
                    {col.label}
                    <span className="bg-white/50 px-1.5 py-0.5 rounded text-xs">
                      {colTasks.length}
                    </span>
                  </span>
                </div>

                {/* Tasks */}
                <div className="flex-1 space-y-2">
                  {colTasks.map((task) => {
                    const impCfg = importanceConfig[task.importance] ?? importanceConfig.MID;
                    const isOverdue =
                      task.deadline &&
                      task.status !== "DONE" &&
                      isPast(new Date(task.deadline));
                    const doneSubtasks = task.subtasks.filter((s) => s.status === "DONE").length;
                    const totalSubtasks = task.subtasks.length;

                    return (
                      <div
                        key={task.id}
                        className={`bg-white border border-gray-100 border-l-4 ${impCfg.border} rounded-xl p-3.5 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all group`}
                        onClick={() => setSelectedTask(task)}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${impCfg.dot}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-primary-700 transition-colors">
                              {task.title}
                            </p>

                            {totalSubtasks > 0 && (
                              <div className="mt-2">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                  <span>{doneSubtasks}/{totalSubtasks} subtasks</span>
                                </div>
                                <div className="bg-gray-100 rounded-full h-1">
                                  <div
                                    className="bg-primary-400 h-1 rounded-full"
                                    style={{ width: totalSubtasks > 0 ? `${(doneSubtasks / totalSubtasks) * 100}%` : "0%" }}
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-2.5">
                              {task.deadline ? (
                                <span
                                  className={`text-xs flex items-center gap-1 ${
                                    isOverdue ? "text-red-500 font-medium" : "text-gray-400"
                                  }`}
                                >
                                  📅{" "}
                                  {new Date(task.deadline).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                              ) : (
                                <span />
                              )}
                              {task.executorContact && (
                                <div
                                  className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-medium"
                                  title={task.executorContact.name}
                                >
                                  {task.executorContact.name[0].toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status changer */}
                        <div className="mt-2.5 pt-2.5 border-t border-gray-50 flex gap-1 flex-wrap">
                          {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                            <button
                              key={c.key}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(task.id, c.key);
                              }}
                              disabled={updatingTask === task.id}
                              className={`text-xs px-2 py-1 rounded-lg ${c.color} ${c.textColor} hover:opacity-80 transition-opacity font-medium`}
                            >
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed border-gray-100 rounded-xl p-6 text-center">
                      <p className="text-xs text-gray-300">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create task modal */}
      {showCreateTask && (
        <CreateTaskModal
          orgId={orgId}
          projectId={project.id}
          onClose={() => setShowCreateTask(false)}
          onCreated={(task) => {
            setTasks((prev) => [task, ...prev]);
            setShowCreateTask(false);
          }}
        />
      )}

      {/* Task detail side panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          orgId={orgId}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => {
            setTasks((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
            );
            setSelectedTask(updated);
          }}
          projectId={project.id}
        />
      )}
    </div>
  );
}

interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

function TaskDetailPanel({
  task,
  orgId,
  onClose,
  onUpdate,
  projectId,
}: {
  task: Task;
  orgId: string;
  onClose: () => void;
  onUpdate: (t: any) => void;
  projectId: string;
}) {
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [loading, setLoading] = useState(false);
  const [localTask, setLocalTask] = useState(task);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${task.id}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [task.id]);

  const handleAddComment = async () => {
    if (!newComment.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments((prev) => [...prev, created]);
        setNewComment("");
      }
    } finally {
      setPostingComment(false);
    }
  };

  const handleSubtaskStatus = async (subtaskId: string, status: string) => {
    await fetch(`/api/tasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLocalTask((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, status } : s
      ),
    }));
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSubtask.trim() }),
      });
      if (res.ok) {
        const sub = await res.json();
        setLocalTask((prev) => ({
          ...prev,
          subtasks: [...prev.subtasks, sub],
        }));
        setNewSubtask("");
        setShowAddSubtask(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const impCfg = importanceConfig[localTask.importance] ?? importanceConfig.MID;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{localTask.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">Importance</div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${impCfg.dot}`} />
                <span className="text-sm font-medium text-gray-700">
                  {impCfg.label}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">Status</div>
              <span className="text-sm font-medium text-gray-700">
                {localTask.status.replace("_", " ")}
              </span>
            </div>
            {localTask.deadline && (
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">Deadline</div>
                <span className="text-sm font-medium text-gray-700">
                  {new Date(localTask.deadline).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            {localTask.executorContact && (
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">Assigned to</div>
                <span className="text-sm font-medium text-gray-700">
                  {localTask.executorContact.name}
                </span>
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">
                Subtasks ({localTask.subtasks.filter((s) => s.status === "DONE").length}/{localTask.subtasks.length})
              </h4>
              <button
                onClick={() => setShowAddSubtask(!showAddSubtask)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                + Add
              </button>
            </div>

            <div className="space-y-2">
              {localTask.subtasks.map((sub, i) => (
                <div
                  key={sub.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    sub.status === "DONE"
                      ? "bg-green-50 border-green-100"
                      : "bg-white border-gray-100"
                  }`}
                >
                  <button
                    onClick={() =>
                      handleSubtaskStatus(
                        sub.id,
                        sub.status === "DONE" ? "TODO" : "DONE"
                      )
                    }
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      sub.status === "DONE"
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300 hover:border-green-400"
                    }`}
                  >
                    {sub.status === "DONE" && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className="text-xs text-gray-500 w-4">{i + 1}.</span>
                  <span
                    className={`text-sm flex-1 ${
                      sub.status === "DONE" ? "line-through text-gray-400" : "text-gray-700"
                    }`}
                  >
                    {sub.title}
                  </span>
                </div>
              ))}

              {showAddSubtask && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Subtask title..."
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                    autoFocus
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtask.trim() || loading}
                    className="px-3 py-2 bg-primary-600 text-white rounded-xl text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}

              {localTask.subtasks.length === 0 && !showAddSubtask && (
                <p className="text-xs text-gray-400 text-center py-4">No subtasks yet</p>
              )}
            </div>
          </div>

          {/* Description */}
          {localTask.description && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Description</h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3 leading-relaxed">
                {localTask.description}
              </p>
            </div>
          )}

          {/* Comments / Activity */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Comments &amp; Activity
              {comments.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">{comments.length}</span>
              )}
            </h4>

            <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">No activity yet</p>
              )}
              {comments.map((c) => {
                const isSystem = c.author === "system" || c.author === "ai";
                const isWA = c.author.match(/^\d+$/);
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl p-3 text-sm ${
                      isSystem
                        ? "bg-blue-50 border border-blue-100"
                        : isWA
                        ? "bg-green-50 border border-green-100"
                        : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`text-xs font-medium ${
                          isSystem ? "text-blue-600" : isWA ? "text-green-600" : "text-gray-600"
                        }`}
                      >
                        {isSystem ? "System" : isWA ? `📱 ${c.author.slice(-4)}` : c.author}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{c.body}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim() || postingComment}
                className="px-3 py-2 bg-primary-600 text-white rounded-xl text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
