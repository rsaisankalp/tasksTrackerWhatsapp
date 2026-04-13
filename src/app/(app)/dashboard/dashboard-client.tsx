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
  currentUser?: { name: string; email: string; phone?: string | null };
}

export default function DashboardClient({ orgId, stats, projects, tasks, currentUser }: DashboardProps) {
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

  const statCards = [
    {
      label: "Completion",
      value: `${completionRate}%`,
      gradient: "linear-gradient(135deg, #F47C20, #FDB813)",
      bg: "#FFFBF5",
      border: "#F47C20",
      textColor: "#C25C0A",
      showBar: true,
    },
    {
      label: "To Do",
      value: stats.todo,
      gradient: "linear-gradient(135deg, #6366F1, #818CF8)",
      bg: "#F8F8FF",
      border: "#6366F1",
      textColor: "#4338CA",
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      gradient: "linear-gradient(135deg, #3B82F6, #60A5FA)",
      bg: "#F0F7FF",
      border: "#3B82F6",
      textColor: "#1D4ED8",
    },
    {
      label: "Blocked",
      value: stats.blocked,
      gradient: "linear-gradient(135deg, #EF4444, #F87171)",
      bg: "#FFF5F5",
      border: "#EF4444",
      textColor: "#DC2626",
    },
    {
      label: "Done",
      value: stats.done,
      gradient: "linear-gradient(135deg, #10B981, #34D399)",
      bg: "#F0FFF8",
      border: "#10B981",
      textColor: "#059669",
    },
  ];

  const filterLabels: Record<string, string> = {
    ALL: "All",
    EMERGENCY: "🚨 Emergency",
    HIGH: "🔴 High",
    IN_PROGRESS: "⚡ Active",
    BLOCKED: "🚧 Blocked",
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.5px" }}>Dashboard</h1>
          <p style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => setShowCreateTask(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #F47C20, #FF9B4A)", border: "none", borderRadius: 12, padding: "11px 20px", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 14px rgba(244,124,32,0.4)", transition: "all 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 6px 20px rgba(244,124,32,0.5)")}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 4px 14px rgba(244,124,32,0.4)")}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }} className="stats-row">
        <style>{`
          @media (max-width: 900px) { .stats-row { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 500px) { .stats-row { grid-template-columns: 1fr 1fr !important; } }
          .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
          .stat-card { transition: all 0.2s ease; }
        `}</style>
        {statCards.map((s) => (
          <div key={s.label} className="stat-card" style={{ background: "white", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.06)", borderTop: `3px solid ${s.border}`, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: s.gradient, opacity: 0.06, borderRadius: "0 0 0 80px" }} />
            <div style={{ fontSize: 28, fontWeight: 800, color: s.textColor, letterSpacing: "-1px", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            {s.showBar && (
              <div style={{ marginTop: 10, background: "#F1F5F9", borderRadius: 4, height: 4 }}>
                <div style={{ width: `${completionRate}%`, height: 4, borderRadius: 4, background: "linear-gradient(90deg, #F47C20, #FDB813)", transition: "width 0.5s ease" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div style={{ marginBottom: 20, background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.04))", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontSize: 13, color: "#DC2626", fontWeight: 600 }}>{overdueCount} task{overdueCount !== 1 ? "s" : ""} overdue</span>
          <button onClick={() => setActiveFilter("ALL")} style={{ marginLeft: "auto", background: "none", border: "none", color: "#DC2626", fontSize: 12, cursor: "pointer", textDecoration: "underline", fontWeight: 500 }}>View all</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }} className="main-grid">
        <style>{`.main-grid { @media (max-width: 1024px) { grid-template-columns: 1fr !important; } }`}</style>

        {/* Tasks */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>Active Tasks</h2>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {Object.entries(filterLabels).map(([key, label]) => (
                <button key={key} onClick={() => setActiveFilter(key)}
                  style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", border: "none",
                    background: activeFilter === key ? "linear-gradient(135deg, #F47C20, #FF9B4A)" : "#F1F5F9",
                    color: activeFilter === key ? "white" : "#64748B",
                    boxShadow: activeFilter === key ? "0 2px 8px rgba(244,124,32,0.3)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredTasks.length === 0 ? (
              <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 16, padding: "56px 32px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ color: "#94A3B8", fontSize: 14, margin: 0 }}>No active tasks</p>
              </div>
            ) : (
              filteredTasks.map((task) => <TaskCard key={task.id} task={task} orgId={orgId} />)
            )}
          </div>
        </div>

        {/* Projects sidebar */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0 }}>Projects</h2>
            <Link href={`/projects?orgId=${orgId}`} style={{ fontSize: 13, color: "#F47C20", fontWeight: 600, textDecoration: "none" }}>View all →</Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.length === 0 ? (
              <div style={{ background: "white", border: "2px dashed #E2E8F0", borderRadius: 16, padding: "32px 20px", textAlign: "center" }}>
                <p style={{ color: "#94A3B8", fontSize: 13, margin: "0 0 12px" }}>No projects yet</p>
                <Link href={`/projects?orgId=${orgId}`} style={{ color: "#F47C20", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Create your first →</Link>
              </div>
            ) : (
              projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}?orgId=${orgId}`}
                  style={{ display: "block", background: "white", border: "1px solid #E2E8F0", borderRadius: 14, padding: "14px 16px", textDecoration: "none", transition: "all 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.transform = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: project.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.85 }}>
                      <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{project._count.tasks} task{project._count.tasks !== 1 ? "s" : ""}</div>
                    </div>
                    <svg width="14" height="14" fill="none" stroke="#CBD5E1" viewBox="0 0 24 24">
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
        <CreateTaskModal orgId={orgId} onClose={() => setShowCreateTask(false)} onCreated={() => { setShowCreateTask(false); window.location.reload(); }} currentUser={currentUser} />
      )}
    </div>
  );
}
