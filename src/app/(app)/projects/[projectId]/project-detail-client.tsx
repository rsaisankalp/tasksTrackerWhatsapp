"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { isPast } from "date-fns";
import CreateTaskModal from "@/components/tasks/create-task-modal";

const COLUMNS = [
  { key: "TODO", label: "To Do", color: "bg-gray-100", textColor: "text-gray-600", activeTab: "bg-gray-600 text-white" },
  { key: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100", textColor: "text-blue-700", activeTab: "bg-blue-600 text-white" },
  { key: "BLOCKED", label: "Blocked", color: "bg-red-100", textColor: "text-red-700", activeTab: "bg-red-600 text-white" },
  { key: "DONE", label: "Done", color: "bg-green-100", textColor: "text-green-700", activeTab: "bg-green-600 text-white" },
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
    projectVisibility?: string;
    taskVisibility?: string;
    taskCreation?: string;
    startDate?: string | null;
    endDate?: string | null;
    createdAt?: string;
    updatedAt?: string;
    members?: Array<{ contactId: string; name: string; avatarUrl: string | null; email?: string | null }>;
  };
  initialTasks: Task[];
  contacts: Array<{ id: string; name: string; phone: string | null; department: string | null; avatarUrl: string | null }>;
  isAdmin?: boolean;
  currentUser?: { name: string; email: string; phone?: string | null };
}

const COLORS =["#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316","#eab308","#22c55e","#14b8a6","#06b6d4","#3b82f6"];

export default function ProjectDetailClient({
  orgId,
  project: initialProject,
  initialTasks,
  contacts,
  isAdmin,
  currentUser,
}: ProjectDetailClientProps) {
  const [project, setProject] = useState(initialProject);
  const [tasks, setTasks] = useState(initialTasks);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState("TODO");

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState(initialProject.name);
  const [editDescription, setEditDescription] = useState(initialProject.description ?? "");
  const [editColor, setEditColor] = useState(initialProject.color);
  const [editProjectVisibility, setEditProjectVisibility] = useState<"ALL" | "TEAM_ONLY">((initialProject.projectVisibility as any) ?? "TEAM_ONLY");
  const [editVisibility, setEditVisibility] = useState<"ALL" | "OWN_ONLY">((initialProject.taskVisibility as any) ?? "ALL");
  const [editTaskCreation, setEditTaskCreation] = useState<"ANYONE" | "TEAM_ONLY">((initialProject.taskCreation as any) ?? "ANYONE");
  const [editMemberIds, setEditMemberIds] = useState<string[]>((initialProject.members ?? []).map((m) => m.contactId));
  const [contactSearch, setContactSearch] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.department?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const toggleMember = (id: string) =>
    setEditMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
          color: editColor,
          projectVisibility: editProjectVisibility,
          taskVisibility: editVisibility,
          taskCreation: editTaskCreation,
          memberContactIds: editMemberIds,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProject({
          ...project,
          name: updated.name,
          description: updated.description,
          color: updated.color,
          projectVisibility: updated.projectVisibility,
          taskVisibility: updated.taskVisibility,
          taskCreation: updated.taskCreation,
          members: (updated.members ?? []).map((m: any) => ({
            contactId: m.contactId,
            name: m.contact.name,
            avatarUrl: m.contact.avatarUrl,
            email: m.contact.email,
          })),
        });
        setShowSettings(false);
      }
    } finally {
      setSavingSettings(false);
    }
  };

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
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
        setMobileTab(newStatus);
      }
    } finally {
      setUpdatingTask(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-6 py-3 md:py-5 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2 mb-1 text-sm text-gray-400">
          <Link href={`/projects?orgId=${orgId}`} className="hover:text-gray-600 transition-colors">
            Projects
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-700 font-medium truncate">{project.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
            <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">{project.name}</h1>
            {project.projectVisibility === "TEAM_ONLY" && (
              <span className="flex-shrink-0 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Team only</span>
            )}
            {project.taskVisibility === "OWN_ONLY" && !isAdmin && (
              <span className="flex-shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">My tasks</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowCreateTask(true)}
              className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add Task</span>
              <span className="sm:hidden">Add</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"
              title="Project settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        {/* Team members row */}
        {project.members && project.members.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400">Team:</span>
            <div className="flex items-center">
              {project.members.slice(0, 8).map((m) => (
                <div
                  key={m.contactId}
                  className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold border-2 border-white -ml-1 first:ml-0"
                  title={m.name}
                >
                  {m.name[0]?.toUpperCase()}
                </div>
              ))}
              {project.members.length > 8 && (
                <span className="text-xs text-gray-400 ml-2">+{project.members.length - 8} more</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE: Tab bar + single column ── */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden">
        {/* Tab bar */}
        <div className="flex-shrink-0 flex border-b border-gray-100 bg-white overflow-x-auto">
          {COLUMNS.map((col) => {
            const count = tasksByStatus[col.key]?.length ?? 0;
            const isActive = mobileTab === col.key;
            return (
              <button
                key={col.key}
                onClick={() => setMobileTab(col.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  isActive
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-400"
                }`}
              >
                {col.label}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    isActive ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active column tasks */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {(tasksByStatus[mobileTab] ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">No tasks here</p>
              <button
                onClick={() => setShowCreateTask(true)}
                className="mt-3 text-sm text-primary-600 font-medium"
              >
                + Add task
              </button>
            </div>
          ) : (
            (tasksByStatus[mobileTab] ?? []).map((task) => (
              <MobileTaskCard
                key={task.id}
                task={task}
                currentStatus={mobileTab}
                updatingTask={updatingTask}
                onOpen={() => setSelectedTask(task)}
                onStatusChange={handleStatusChange}
              />
            ))
          )}
        </div>
      </div>

      {/* ── DESKTOP: Kanban board ── */}
      <div className="hidden md:block flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-h-[500px]" style={{ minWidth: "860px" }}>
          {COLUMNS.map((col) => {
            const colTasks = tasksByStatus[col.key] ?? [];
            return (
              <div key={col.key} className="flex-1 flex flex-col min-w-[200px]">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${col.color} ${col.textColor}`}>
                    {col.label}
                    <span className="bg-white/50 px-1.5 py-0.5 rounded text-xs">{colTasks.length}</span>
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  {colTasks.map((task) => {
                    const impCfg = importanceConfig[task.importance] ?? importanceConfig.MID;
                    const isOverdue = task.deadline && task.status !== "DONE" && isPast(new Date(task.deadline));
                    const doneSubtasks = task.subtasks.filter((s) => s.status === "DONE").length;
                    const totalSubtasks = task.subtasks.length;
                    return (
                      <div
                        key={task.id}
                        className={`bg-white border border-gray-100 border-l-4 ${impCfg.border} rounded-xl p-3.5 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all group`}
                        onClick={() => setSelectedTask(task)}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${impCfg.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-primary-700 transition-colors">{task.title}</p>
                            {totalSubtasks > 0 && (
                              <div className="mt-2">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                  <span>{doneSubtasks}/{totalSubtasks} subtasks</span>
                                </div>
                                <div className="bg-gray-100 rounded-full h-1">
                                  <div className="bg-primary-400 h-1 rounded-full" style={{ width: `${(doneSubtasks / totalSubtasks) * 100}%` }} />
                                </div>
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-2.5">
                              {task.deadline ? (
                                <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                                  📅 {new Date(task.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </span>
                              ) : <span />}
                              {task.executorContact && (
                                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-medium" title={task.executorContact.name}>
                                  {task.executorContact.name[0].toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-gray-50 flex gap-1 flex-wrap">
                          {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                            <button
                              key={c.key}
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, c.key); }}
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

      {showCreateTask && (
        <CreateTaskModal
          orgId={orgId}
          projectId={project.id}
          onClose={() => setShowCreateTask(false)}
          onCreated={(task) => { setTasks((prev) => [task, ...prev]); setShowCreateTask(false); }}
          teamMemberIds={(project.members ?? []).map((m) => m.contactId)}
          taskCreation={project.taskCreation ?? "ANYONE"}
          currentUser={currentUser}
        />
      )}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          orgId={orgId}
          contacts={contacts}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
            setSelectedTask(updated);
          }}
          projectId={project.id}
        />
      )}

      {/* Project Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Project Settings</h2>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setEditColor(c)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${editColor === c ? "border-gray-800 scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              {/* Project Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setEditProjectVisibility("ALL")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${editProjectVisibility === "ALL" ? "border-primary-500 bg-primary-50" : "border-gray-200"}`}>
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Everyone in org</div>
                    <div className="text-xs text-gray-500">Project is visible to the full org</div>
                  </button>
                  <button onClick={() => setEditProjectVisibility("TEAM_ONLY")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${editProjectVisibility === "TEAM_ONLY" ? "border-primary-500 bg-primary-50" : "border-gray-200"}`}>
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Team only</div>
                    <div className="text-xs text-gray-500">Only project members can see it</div>
                  </button>
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Task Visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setEditVisibility("ALL")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${editVisibility === "ALL" ? "border-primary-500 bg-primary-50" : "border-gray-200"}`}>
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Everyone</div>
                    <div className="text-xs text-gray-500">All team members see all tasks</div>
                  </button>
                  <button onClick={() => setEditVisibility("OWN_ONLY")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${editVisibility === "OWN_ONLY" ? "border-primary-500 bg-primary-50" : "border-gray-200"}`}>
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Own tasks only</div>
                    <div className="text-xs text-gray-500">Members see only their tasks</div>
                  </button>
                </div>
              </div>

              {/* Task Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Tasks To</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setEditTaskCreation("ANYONE")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${editTaskCreation === "ANYONE" ? "border-primary-500 bg-primary-50" : "border-gray-200"}`}>
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Anyone in org</div>
                    <div className="text-xs text-gray-500">Any contact can be assigned</div>
                  </button>
                  <button onClick={() => setEditTaskCreation("TEAM_ONLY")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${editTaskCreation === "TEAM_ONLY" ? "border-primary-500 bg-primary-50" : "border-gray-200"}`}>
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Team only</div>
                    <div className="text-xs text-gray-500">Only project team members</div>
                  </button>
                </div>
              </div>

              {/* Team Members */}
              {contacts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Team Members
                    {editMemberIds.length > 0 && (
                      <span className="ml-2 bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">{editMemberIds.length}</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                  />
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                    {filteredContacts.map((c) => {
                      const selected = editMemberIds.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => toggleMember(c.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors ${selected ? "bg-primary-50" : ""}`}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? "bg-primary-600 border-primary-600" : "border-gray-300"}`}>
                            {selected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-medium flex-shrink-0">
                            {c.name[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{c.name}</div>
                            {c.department && <div className="text-xs text-gray-400">{c.department}</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
              {project.status !== "ARCHIVED" ? (
                <button onClick={async () => { if (confirm("Archive this project?")) { await fetch(`/api/projects/${project.id}`, { method: "DELETE" }); window.location.href = `/projects?orgId=${orgId}`; } }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                  Archive Project
                </button>
              ) : (
                <button onClick={async () => { if (confirm("Restore this project?")) { await fetch(`/api/projects/${project.id}`, { method: "POST" }); setProject({ ...project, status: "ACTIVE" }); } }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 transition-colors">
                  Restore Project
                </button>
              )}
              <div className="flex-1" />
              <div className="flex gap-2">
                <button onClick={() => setShowSettings(false)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveSettings} disabled={!editName.trim() || savingSettings}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  {savingSettings ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mobile task card ──────────────────────────────────────────────────────────

function MobileTaskCard({
  task,
  currentStatus,
  updatingTask,
  onOpen,
  onStatusChange,
}: {
  task: Task;
  currentStatus: string;
  updatingTask: string | null;
  onOpen: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const impCfg = importanceConfig[task.importance] ?? importanceConfig.MID;
  const isOverdue = task.deadline && task.status !== "DONE" && isPast(new Date(task.deadline));
  const doneSubtasks = task.subtasks.filter((s) => s.status === "DONE").length;
  const totalSubtasks = task.subtasks.length;

  // Next logical status transitions
  const nextStatuses = currentStatus === "TODO"
    ? [{ key: "IN_PROGRESS", label: "Start", color: "bg-blue-50 text-blue-700 border border-blue-200" }]
    : currentStatus === "IN_PROGRESS"
    ? [
        { key: "DONE", label: "Mark Done", color: "bg-green-50 text-green-700 border border-green-200" },
        { key: "BLOCKED", label: "Blocked", color: "bg-red-50 text-red-700 border border-red-200" },
      ]
    : currentStatus === "BLOCKED"
    ? [{ key: "IN_PROGRESS", label: "Unblock", color: "bg-blue-50 text-blue-700 border border-blue-200" }]
    : [{ key: "TODO", label: "Reopen", color: "bg-gray-100 text-gray-600 border border-gray-200" }];

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${impCfg.border} shadow-sm active:shadow-md transition-all`}
    >
      {/* Main tap area */}
      <div className="p-4" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${impCfg.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-snug">{task.title}</p>
              {task.description && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>
              )}
            </div>
          </div>
          {task.executorContact && (
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold flex-shrink-0" title={task.executorContact.name}>
              {task.executorContact.name[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Subtask progress */}
        {totalSubtasks > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>{doneSubtasks}/{totalSubtasks} subtasks done</span>
              <span>{Math.round((doneSubtasks / totalSubtasks) * 100)}%</span>
            </div>
            <div className="bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-primary-400 h-1.5 rounded-full transition-all"
                style={{ width: `${(doneSubtasks / totalSubtasks) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Deadline + importance row */}
        <div className="flex items-center gap-3 mt-2.5">
          {task.deadline && (
            <span className={`text-xs flex items-center gap-1 font-medium ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {isOverdue && "Overdue · "}
              {new Date(task.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            task.importance === "EMERGENCY" ? "bg-red-100 text-red-700" :
            task.importance === "HIGH" ? "bg-orange-100 text-orange-700" :
            task.importance === "MID" ? "bg-yellow-100 text-yellow-700" :
            "bg-green-100 text-green-700"
          }`}>
            {task.importance}
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 pb-3 flex items-center gap-2">
        {nextStatuses.map((s) => (
          <button
            key={s.key}
            onClick={() => onStatusChange(task.id, s.key)}
            disabled={updatingTask === task.id}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${s.color} disabled:opacity-50`}
          >
            {updatingTask === task.id ? "..." : s.label}
          </button>
        ))}
        <button
          onClick={onOpen}
          className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Task detail panel ─────────────────────────────────────────────────────────

interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

function TaskDetailPanel({
  task, orgId, contacts, onClose, onUpdate, projectId,
}: {
  task: Task;
  orgId: string;
  contacts: Array<{ id: string; name: string; phone: string | null; department: string | null; avatarUrl: string | null }>;
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
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSearch, setReassignSearch] = useState("");
  const [reassigning, setReassigning] = useState(false);

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
      subtasks: prev.subtasks.map((s) => s.id === subtaskId ? { ...s, status } : s),
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
        setLocalTask((prev) => ({ ...prev, subtasks: [...prev.subtasks, sub] }));
        setNewSubtask("");
        setShowAddSubtask(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (contactId: string | null) => {
    setReassigning(true);
    try {
      const res = await fetch(`/api/tasks/${localTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executorContactId: contactId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLocalTask((prev) => ({ ...prev, executorContact: updated.executorContact ?? null }));
        onUpdate({ ...localTask, executorContact: updated.executorContact ?? null });
        setShowReassign(false);
        setReassignSearch("");
      }
    } finally {
      setReassigning(false);
    }
  };

  const filteredReassignContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(reassignSearch.toLowerCase()) ||
    (c.phone ?? "").includes(reassignSearch)
  );

  const impCfg = importanceConfig[localTask.importance] ?? importanceConfig.MID;

  return (
    // On mobile: bottom sheet. On desktop: right side panel.
    <div className="fixed inset-0 z-40 flex flex-col justify-end md:flex-row">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel — bottom sheet on mobile, right panel on desktop */}
      <div className="relative w-full md:w-96 bg-white shadow-2xl flex flex-col rounded-t-3xl md:rounded-none overflow-hidden max-h-[92vh] md:max-h-full">
        {/* Handle (mobile only) */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-3">
            <h3 className="font-semibold text-gray-900 text-base leading-snug">{localTask.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                localTask.importance === "EMERGENCY" ? "bg-red-100 text-red-700" :
                localTask.importance === "HIGH" ? "bg-orange-100 text-orange-700" :
                "bg-yellow-100 text-yellow-700"
              }`}>{localTask.importance}</span>
              <span className="text-xs text-gray-400">{localTask.status.replace("_", " ")}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            {localTask.deadline && (
              <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium text-gray-600">
                  {new Date(localTask.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            )}
            <div className="relative">
              <button
                onClick={() => { setShowReassign(!showReassign); setReassignSearch(""); }}
                className="flex items-center gap-1.5 bg-primary-50 hover:bg-primary-100 rounded-xl px-3 py-2 transition-colors"
                title="Click to reassign executor"
              >
                {localTask.executorContact ? (
                  <>
                    <div className="w-4 h-4 rounded-full bg-primary-200 flex items-center justify-center text-primary-700 text-[10px] font-bold">
                      {localTask.executorContact.name[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-primary-700">{localTask.executorContact.name}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-xs text-gray-400">Assign executor</span>
                  </>
                )}
                <svg className="w-3 h-3 text-gray-400 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showReassign && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      type="text"
                      value={reassignSearch}
                      onChange={(e) => setReassignSearch(e.target.value)}
                      placeholder="Search contacts..."
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {localTask.executorContact && (
                      <button
                        onClick={() => handleReassign(null)}
                        disabled={reassigning}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-red-50 transition-colors text-xs text-red-500"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Remove executor
                      </button>
                    )}
                    {filteredReassignContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleReassign(c.id)}
                        disabled={reassigning}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-primary-50 transition-colors ${localTask.executorContact?.id === c.id ? "bg-primary-50" : ""}`}
                      >
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
                          {c.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{c.name}</div>
                          {c.phone && <div className="text-[10px] text-gray-400 truncate">{c.phone}</div>}
                        </div>
                        {localTask.executorContact?.id === c.id && (
                          <svg className="w-3.5 h-3.5 text-primary-500 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                    {filteredReassignContacts.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-3">No contacts found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {localTask.description && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3 leading-relaxed">{localTask.description}</p>
            </div>
          )}

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Subtasks ({localTask.subtasks.filter((s) => s.status === "DONE").length}/{localTask.subtasks.length})
              </p>
              <button
                onClick={() => setShowAddSubtask(!showAddSubtask)}
                className="text-xs text-primary-600 font-semibold"
              >
                + Add
              </button>
            </div>

            <div className="space-y-2">
              {localTask.subtasks.map((sub, i) => (
                <div
                  key={sub.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    sub.status === "DONE" ? "bg-green-50 border-green-100" : "bg-white border-gray-100"
                  }`}
                >
                  <button
                    onClick={() => handleSubtaskStatus(sub.id, sub.status === "DONE" ? "TODO" : "DONE")}
                    className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      sub.status === "DONE" ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"
                    }`}
                  >
                    {sub.status === "DONE" && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                  <span className={`text-sm flex-1 ${sub.status === "DONE" ? "line-through text-gray-400" : "text-gray-700"}`}>
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
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                    autoFocus
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtask.trim() || loading}
                    className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}

              {localTask.subtasks.length === 0 && !showAddSubtask && (
                <p className="text-xs text-gray-400 text-center py-3">No subtasks yet</p>
              )}
            </div>
          </div>

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Activity {comments.length > 0 && `(${comments.length})`}
            </p>

            <div className="space-y-2 mb-3">
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
                      isSystem ? "bg-blue-50 border border-blue-100" :
                      isWA ? "bg-green-50 border border-green-100" :
                      "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-xs font-medium ${isSystem ? "text-blue-600" : isWA ? "text-green-600" : "text-gray-600"}`}>
                        {isSystem ? "System" : isWA ? `📱 ${c.author.slice(-4)}` : c.author}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
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
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim() || postingComment}
                className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
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
