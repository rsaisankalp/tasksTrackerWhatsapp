"use client";

import { useState } from "react";
import Link from "next/link";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  department: string | null;
}

interface ProjectMemberInfo {
  contactId: string;
  name: string;
  avatarUrl: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  taskVisibility: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  tasks: Array<{ id: string; status: string; importance: string }>;
  members: ProjectMemberInfo[];
}

interface ProjectsClientProps {
  orgId: string;
  contacts: Contact[];
  initialProjects: Project[];
}

export default function ProjectsClient({ orgId, contacts, initialProjects }: ProjectsClientProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [taskVisibility, setTaskVisibility] = useState<"ALL" | "OWN_ONLY">("ALL");
  const [taskCreation, setTaskCreation] = useState<"ANYONE" | "TEAM_ONLY">("ANYONE");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.department?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor(COLORS[0]);
    setTaskVisibility("ALL");
    setSelectedContactIds([]);
    setContactSearch("");
    setError("");
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects?orgId=${orgId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          color,
          taskVisibility,
          taskCreation,
          memberContactIds: selectedContactIds,
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      const project = await res.json();
      setProjects([
        {
          ...project,
          tasks: [],
          members: (project.members ?? []).map((m: any) => ({
            contactId: m.contactId,
            name: m.contact.name,
            avatarUrl: m.contact.avatarUrl,
          })),
        },
        ...projects,
      ]);
      setShowCreate(false);
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 text-sm mt-0.5">{projects.length} active project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">📁</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-500 mb-6 text-sm">Create your first project to start organizing tasks</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const total = project.tasks.length;
            const done = project.tasks.filter((t) => t.status === "DONE").length;
            const inProgress = project.tasks.filter((t) => t.status === "IN_PROGRESS").length;
            const blocked = project.tasks.filter((t) => t.status === "BLOCKED").length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}?orgId=${orgId}`}
                className="group bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:border-gray-200 transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: project.color + "20" }}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project.color }} />
                  </div>
                  <div className="flex items-center gap-2">
                    {project.taskVisibility === "OWN_ONLY" && (
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-700">Private</span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${project.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-700 transition-colors">{project.name}</h3>
                {project.description && (
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">{project.description}</p>
                )}

                {/* Team member avatars */}
                {project.members.length > 0 && (
                  <div className="flex items-center gap-1 mb-3">
                    {project.members.slice(0, 5).map((m) => (
                      <div
                        key={m.contactId}
                        className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold border-2 border-white -ml-1 first:ml-0"
                        title={m.name}
                      >
                        {m.name[0]?.toUpperCase()}
                      </div>
                    ))}
                    {project.members.length > 5 && (
                      <span className="text-xs text-gray-400 ml-1">+{project.members.length - 5}</span>
                    )}
                  </div>
                )}

                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>{total} tasks</span>
                    <span>{pct}% done</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: project.color }} />
                  </div>
                </div>

                {total > 0 && (
                  <div className="flex gap-3 mt-3">
                    {inProgress > 0 && <span className="text-xs text-blue-600">{inProgress} active</span>}
                    {blocked > 0 && <span className="text-xs text-red-600">{blocked} blocked</span>}
                    {done > 0 && <span className="text-xs text-green-600">{done} done</span>}
                  </div>
                )}
              </Link>
            );
          })}

          <button
            onClick={() => setShowCreate(true)}
            className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-primary-400 hover:bg-primary-50/50 transition-all duration-200 min-h-[180px]"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm text-gray-500 font-medium">New Project</span>
          </button>
        </div>
      )}

      {/* Create project modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Navratri Festival 2024"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this project about?"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${color === c ? "border-gray-800 scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Task Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Task Visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTaskVisibility("ALL")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${taskVisibility === "ALL" ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Everyone</div>
                    <div className="text-xs text-gray-500">All team members see all tasks</div>
                  </button>
                  <button
                    onClick={() => setTaskVisibility("OWN_ONLY")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${taskVisibility === "OWN_ONLY" ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Own tasks only</div>
                    <div className="text-xs text-gray-500">Members see only their tasks</div>
                  </button>
                </div>
              </div>

              {/* Task Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Tasks To</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTaskCreation("ANYONE")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${taskCreation === "ANYONE" ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Anyone in org</div>
                    <div className="text-xs text-gray-500">Any contact can be assigned</div>
                  </button>
                  <button
                    onClick={() => setTaskCreation("TEAM_ONLY")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${taskCreation === "TEAM_ONLY" ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
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
                    {selectedContactIds.length > 0 && (
                      <span className="ml-2 bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                        {selectedContactIds.length} selected
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                  />
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    {filteredContacts.length === 0 ? (
                      <p className="text-sm text-gray-400 px-4 py-3">No contacts found</p>
                    ) : (
                      filteredContacts.map((c) => {
                        const selected = selectedContactIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => toggleContact(c.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors ${selected ? "bg-primary-50" : ""}`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? "bg-primary-600 border-primary-600" : "border-gray-300"}`}>
                              {selected && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
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
                      })
                    )}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || loading}
                className="flex-1 bg-primary-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
