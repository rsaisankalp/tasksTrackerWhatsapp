"use client";

import { useState, useEffect } from "react";

interface CreateTaskModalProps {
  orgId: string;
  projectId?: string;
  parentId?: string;
  onClose: () => void;
  onCreated: (task: any) => void;
  teamMemberIds?: string[]; // contact IDs who are team members
  taskCreation?: string;    // "ANYONE" | "TEAM_ONLY"
  currentUser?: { name: string; email: string; phone?: string | null };
}

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  department: string | null;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

export default function CreateTaskModal({
  orgId,
  projectId,
  parentId,
  onClose,
  onCreated,
  teamMemberIds,
  taskCreation = "ANYONE",
  currentUser,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [importance, setImportance] = useState("MID");
  const [eventType, setEventType] = useState("ONE_TIME");
  const [deadline, setDeadline] = useState("");
  const [executorContactId, setExecutorContactId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? "");
  const [subtaskTitles, setSubtaskTitles] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [recurringFrequency, setRecurringFrequency] = useState("WEEKLY");
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringMonthDay, setRecurringMonthDay] = useState(1);
  const [selfAssign, setSelfAssign] = useState(Boolean(currentUser));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contactSearch, setContactSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/contacts?orgId=${orgId}`).then((r) => r.json()),
      fetch(`/api/projects?orgId=${orgId}`).then((r) => r.json()),
    ]).then(([c, p]) => {
      setContacts(Array.isArray(c) ? c : []);
      const projectList: Project[] = Array.isArray(p) ? p : [];
      setProjects(projectList);
      // Default to General project if no projectId prop is set
      if (!projectId && !selectedProjectId) {
        const general = projectList.find((pr) => pr.name === "General");
        if (general) setSelectedProjectId(general.id);
      }
    });
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignableContacts =
    taskCreation === "TEAM_ONLY" && teamMemberIds?.length
      ? contacts.filter((c) => teamMemberIds.includes(c.id))
      : contacts;

  const filteredContacts = assignableContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phone?.includes(contactSearch) ||
      c.department?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          title: title.trim(),
          description: description.trim() || undefined,
          importance,
          eventType,
          deadline: deadline || undefined,
          executorContactId: !selfAssign ? (executorContactId || undefined) : undefined,
          selfAssign: selfAssign || (!executorContactId && Boolean(currentUser)) || undefined,
          projectId: selectedProjectId || undefined,
          parentId,
          subtasks: subtaskTitles
            .filter((s) => s.trim())
            .map((s) => ({ title: s.trim() })),
          ...(eventType === "REPEATABLE" ? {
            recurringFrequency,
            recurringDays: recurringFrequency === "WEEKLY"
              ? recurringDays
              : recurringFrequency === "MONTHLY"
              ? [recurringMonthDay]
              : [],
          } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.formErrors?.[0] ?? "Failed to create task");
      }

      const task = await res.json();
      onCreated(task);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtaskTitles([...subtaskTitles, newSubtask.trim()]);
      setNewSubtask("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {parentId ? "Add Subtask" : "New Task"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Task title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Row: Importance + Event Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Importance</label>
              <select
                value={importance}
                onChange={(e) => setImportance(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="EMERGENCY">🚨 Emergency</option>
                <option value="HIGH">🔴 High</option>
                <option value="MID">🟡 Medium</option>
                <option value="LOW">🟢 Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="ONE_TIME">One Time</option>
                <option value="REPEATABLE">Recurring</option>
              </select>
            </div>
          </div>

          {/* Recurring options */}
          {eventType === "REPEATABLE" && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Frequency</label>
                <div className="flex gap-2">
                  {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => { setRecurringFrequency(f); if (f !== "WEEKLY") setRecurringDays([]); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        recurringFrequency === f
                          ? "bg-primary-600 text-white border-primary-600"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              {recurringFrequency === "WEEKLY" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Repeat on</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setRecurringDays((prev) =>
                            prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
                          )
                        }
                        className={`w-10 h-10 rounded-full text-xs font-medium border transition-colors ${
                          recurringDays.includes(i)
                            ? "bg-primary-600 text-white border-primary-600"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {recurringFrequency === "MONTHLY" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Day of month</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={recurringMonthDay}
                    onChange={(e) => setRecurringMonthDay(Number(e.target.value))}
                    className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Row: Deadline + Project */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              />
            </div>
            {!projectId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Executor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Assign to (executor)
            </label>
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  setSelfAssign((prev) => !prev);
                  setExecutorContactId("");
                  setContactSearch("");
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border mb-2 transition-colors ${
                  selfAssign
                    ? "bg-primary-50 border-primary-500 text-primary-700 font-medium"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-bold">
                  {currentUser.name[0].toUpperCase()}
                </div>
                {selfAssign ? "✓ Assigned to myself" : "Assign to myself"}
              </button>
            )}
            {selfAssign && currentUser && (
              <p className="text-xs text-primary-600 mt-1">
                New tasks will be assigned to {currentUser.name}.
              </p>
            )}
            {!selfAssign && (
              <>
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                />
                {contactSearch && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                    {filteredContacts.length === 0 ? (
                      <p className="text-sm text-gray-400 px-4 py-3">No contacts found</p>
                    ) : (
                      filteredContacts.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setExecutorContactId(c.id);
                            setContactSearch(c.name);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors ${
                            executorContactId === c.id ? "bg-primary-50" : ""
                          }`}
                        >
                          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-medium flex-shrink-0">
                            {c.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{c.name}</div>
                            {c.phone && (
                              <div className="text-xs text-gray-400">{c.phone}</div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {executorContactId && !contactSearch.startsWith(contacts.find(c => c.id === executorContactId)?.name ?? "__NEVER__") && (
                  <p className="text-xs text-primary-600 mt-1">
                    ✓ {contacts.find((c) => c.id === executorContactId)?.name} assigned
                  </p>
                )}
              </>
            )}
          </div>

          {/* Subtasks */}
          {!parentId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Subtasks
                {subtaskTitles.length > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                    {subtaskTitles.length}
                  </span>
                )}
              </label>
              <div className="space-y-2">
                {subtaskTitles.map((sub, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                    <span className="flex-1 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                      {sub}
                    </span>
                    <button
                      onClick={() => setSubtaskTitles(subtaskTitles.filter((_, j) => j !== i))}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Add subtask..."
                    className="flex-1 border border-dashed border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-solid"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubtask())}
                  />
                  <button
                    onClick={addSubtask}
                    className="px-3 py-2 bg-gray-100 rounded-xl text-gray-600 hover:bg-gray-200 transition-colors text-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || loading}
            className="flex-1 bg-primary-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating..." : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
