"use client";

import { useState, useEffect } from "react";
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
  projectVisibility: string;
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
  archivedProjects?: Project[];
}

export default function ProjectsClient({ orgId, contacts, initialProjects, archivedProjects = [] }: ProjectsClientProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [archived, setArchived] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    setArchived(archivedProjects);
  }, [archivedProjects]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [projectVisibility, setProjectVisibility] = useState<"ALL" | "TEAM_ONLY">("TEAM_ONLY");
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
    setProjectVisibility("TEAM_ONLY");
    setTaskVisibility("ALL");
    setSelectedContactIds([]);
    setContactSearch("");
    setError("");
  };

  const handleArchive = async (projectId: string) => {
    if (!confirm("Archive this project? All tasks will be hidden from dashboard and projects.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          setProjects((prev) => prev.filter((p) => p.id !== projectId));
          setArchived((prev) => [{ ...project, status: "ARCHIVED" }, ...prev]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (projectId: string) => {
    if (!confirm("Restore this project? All tasks will become visible again.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "POST" });
      if (res.ok) {
        const project = archived.find((p) => p.id === projectId);
        if (project) {
          setArchived((prev) => prev.filter((p) => p.id !== projectId));
          setProjects((prev) => [{ ...project, status: "ACTIVE" }, ...prev]);
        }
      }
    } finally {
      setLoading(false);
    }
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
          projectVisibility,
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          {archived.length > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${showArchived ? "bg-gray-100 text-gray-600" : "bg-primary-50 text-primary-600 hover:bg-primary-100"}`}
            >
              {showArchived ? "Hide archived" : `${archived.length} archived`}
            </button>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">New Project</span>
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
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}?orgId=${orgId}`}
                className="group bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:border-gray-200 transition-all duration-200 cursor-pointer flex flex-col min-h-[160px]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: project.color + "20" }}>
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: project.color }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${project.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {project.status === "ACTIVE" ? "Active" : project.status}
                    </span>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpenId(menuOpenId === project.id ? null : project.id); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {menuOpenId === project.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                        <div className="absolute right-2 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden min-w-[100px]">
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpenId(null); handleArchive(project.id); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            Archive
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-700 transition-colors">{project.name}</h3>
                {project.description && (
                  <p className="text-xs text-gray-500 mb-2 line-clamp-1">{project.description}</p>
                )}

                <div className="mt-auto flex items-center justify-between">
                  <span className="text-xs text-gray-400">{total} tasks</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: project.color }} />
                    </div>
                    <span className="text-xs text-gray-500">{pct}%</span>
                  </div>
                </div>

                {project.members.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {project.members.slice(0, 4).map((m) => (
                      <div
                        key={m.contactId}
                        className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-[10px] font-semibold border border-white"
                        title={m.name}
                      >
                        {m.name[0]?.toUpperCase()}
                      </div>
                    ))}
                    {project.members.length > 4 && (
                      <span className="text-[10px] text-gray-400 ml-0.5">+{project.members.length - 4}</span>
                    )}
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

      {/* Archived Projects Section */}
      {showArchived && archived.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-700">Archived Projects</h2>
            <span className="text-xs text-gray-400">({archived.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((project) => {
              const total = project.tasks.length;
              const done = project.tasks.filter((t) => t.status === "DONE").length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;

              return (
                <div
                  key={project.id}
                  className="bg-gray-50/80 border border-gray-200 rounded-2xl p-5 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project.color }} />
                    </div>
                    <button
                      onClick={() => handleRestore(project.id)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Restore
                    </button>
                  </div>

                  <h3 className="font-semibold text-gray-700 mb-1">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{project.description}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{total} tasks</span>
                    <span>{pct}% done</span>
                  </div>
                </div>
              );
            })}
          </div>
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

              {/* Project Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setProjectVisibility("ALL")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${projectVisibility === "ALL" ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Everyone in org</div>
                    <div className="text-xs text-gray-500">Project is visible to the full org</div>
                  </button>
                  <button
                    onClick={() => setProjectVisibility("TEAM_ONLY")}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${projectVisibility === "TEAM_ONLY" ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-0.5">Team only</div>
                    <div className="text-xs text-gray-500">Only project members can see it</div>
                  </button>
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
