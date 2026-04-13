"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OrgMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string | null; email: string };
}

interface Org {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  owner: { name: string | null; email: string };
  members: OrgMember[];
  _count: { projects: number; tasks: number; contacts: number };
}

interface WaitlistEntryItem {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  invitedAt: string | null;
  invitedOrgId: string | null;
  inviteCode: string | null;
}

export default function AdminClient({
  orgs: initialOrgs,
  waitlistEntries: initialWaitlistEntries,
}: {
  orgs: Org[];
  waitlistEntries: WaitlistEntryItem[];
}) {
  const router = useRouter();
  const [orgs, setOrgs] = useState(initialOrgs);
  const [waitlistEntries] = useState(initialWaitlistEntries);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateOrg = async () => {
    if (!orgName.trim() || !orgSlug.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim(), slug: orgSlug.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Failed");
      setShowCreate(false);
      setOrgName("");
      setOrgSlug("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (orgId: string, userId: string, newRole: string) => {
    await fetch("/api/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, userId, role: newRole }),
    });
    router.refresh();
  };

  const handleRemoveMember = async (orgId: string, userId: string) => {
    if (!confirm("Remove this member from the org?")) return;
    await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, userId }),
    });
    router.refresh();
  };

  const generateInvite = async (orgId: string) => {
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, maxUses: 50 }),
    });
    const data = await res.json();
    if (data.code) {
      const link = `${window.location.origin}/invite/${data.code}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      alert(`Invite link copied:\n${link}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Super Admin Panel</h1>
            <p className="text-gray-500 text-sm mt-0.5">{orgs.length} organizations</p>
          </div>
          <div className="flex gap-3">
            <a
              href="/dashboard"
              className="border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-100 transition-colors"
            >
              ← Dashboard
            </a>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              + Create Org
            </button>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Waitlist</h2>
            <p className="text-sm text-gray-500">{waitlistEntries.length} people waiting for access</p>
          </div>
          <div className="space-y-2">
            {waitlistEntries.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{entry.name || "—"}</div>
                  <div className="text-sm text-gray-500 truncate">{entry.email}{entry.phone ? ` • ${entry.phone}` : ""}</div>
                </div>
                <div className="text-xs">
                  {entry.invitedAt ? (
                    <span className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-700">Invited</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-700">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <a href="/settings?tab=waitlist" className="mt-4 inline-flex text-sm font-medium text-primary-600 hover:text-primary-700">
            Open full waitlist manager →
          </a>
        </div>

        {/* Org List */}
        <div className="space-y-4">
          {orgs.map((org) => (
            <div key={org.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Org header row */}
              <div className="flex items-center gap-4 px-6 py-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: "#6366f1" }}
                >
                  {org.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{org.name}</h3>
                    <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                      {org.slug}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Owner: {org.owner.name ?? org.owner.email} • {org.members.length} member{org.members.length !== 1 ? "s" : ""} • {org._count.projects} projects • {org._count.tasks} tasks
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => generateInvite(org.id)}
                    className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    🔗 Invite Link
                  </button>
                  <a
                    href={`/dashboard?orgId=${org.id}`}
                    className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    View →
                  </a>
                  <button
                    onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
                    className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {expandedOrg === org.id ? "Hide Members" : "Members"}
                  </button>
                </div>
              </div>

              {/* Members panel */}
              {expandedOrg === org.id && (
                <div className="border-t border-gray-100 px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Members</h4>
                    <button
                      onClick={() => generateInvite(org.id)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      + Generate invite link
                    </button>
                  </div>
                  <div className="space-y-2">
                    {org.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50"
                      >
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-medium flex-shrink-0">
                          {(m.user.name ?? m.user.email)[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {m.user.name ?? "—"}
                          </div>
                          <div className="text-xs text-gray-400">{m.user.email}</div>
                        </div>
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(org.id, m.userId, e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="OWNER">Owner</option>
                          <option value="ADMIN">Admin</option>
                          <option value="MEMBER">Member</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(org.id, m.userId)}
                          className="text-gray-300 hover:text-red-500 transition-colors ml-1"
                          title="Remove from org"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Create Org Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Create Organization</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      setOrgSlug(
                        e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                      );
                    }}
                    placeholder="e.g. Vaidi Puja Services"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
                  <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
                    <span className="bg-gray-50 px-3 py-3 text-sm text-gray-500 border-r border-gray-200">slug/</span>
                    <input
                      type="text"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="vaidi-puja"
                      className="flex-1 px-4 py-3 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              {error && (
                <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowCreate(false); setError(""); }}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateOrg}
                  disabled={!orgName.trim() || !orgSlug.trim() || loading}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
