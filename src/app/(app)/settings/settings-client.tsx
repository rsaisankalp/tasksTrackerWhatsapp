"use client";

import { useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Australia/Sydney",
];

interface Member {
  userId: string;
  role: string;
  joinedAt: string;
  name: string;
  email: string;
  image: string | null;
}

interface InviteCodeItem {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
  createdByName: string;
}

interface PlatformOrg {
  id: string;
  name: string;
  slug: string;
  type?: string;
  createdAt: string;
  owner: { name: string | null; email: string };
  members: Array<{ id: string; userId: string; role: string; user: { id: string; name: string | null; email: string } }>;
  inviteCodes: Array<{
    id: string;
    code: string;
    maxUses: number;
    usedCount: number;
    expiresAt: string | null;
    createdAt: string;
  }>;
  _count: { projects: number; tasks: number };
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

interface SettingsClientProps {
  orgId: string;
  currentUserId: string;
  currentUserRole: string;
  isSuperAdmin?: boolean;
  allOrgs?: PlatformOrg[];
  waitlistEntries?: WaitlistEntryItem[];
  initialTab: string;
  org: {
    id: string;
    name: string;
    slug: string;
    emailDomains: string[];
    emergencyInterval: number;
    highInterval: number;
    midInterval: number;
    lowInterval: number;
    workingHoursConfig: {
      timezone: string;
      workDays: number[];
      startHour: number;
      endHour: number;
    };
  };
  whatsappSession: {
    status: string;
    phone: string | null;
  } | null;
  members: Member[];
  inviteCodes: InviteCodeItem[];
}

export default function SettingsClient({
  orgId,
  currentUserId,
  currentUserRole,
  isSuperAdmin = false,
  allOrgs = [],
  waitlistEntries: initialWaitlistEntries = [],
  initialTab,
  org,
  whatsappSession,
  members: initialMembers,
  inviteCodes: initialInviteCodes,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // General
  const [orgName, setOrgName] = useState(org.name);
  const [emailDomains, setEmailDomains] = useState<string[]>(org.emailDomains ?? []);
  const [domainInput, setDomainInput] = useState("");

  // Reminders
  const [emergencyInterval, setEmergencyInterval] = useState(org.emergencyInterval);
  const [highInterval, setHighInterval] = useState(org.highInterval);
  const [midInterval, setMidInterval] = useState(org.midInterval);
  const [lowInterval, setLowInterval] = useState(org.lowInterval);

  // Working hours
  const [timezone, setTimezone] = useState(org.workingHoursConfig.timezone);
  const [workDays, setWorkDays] = useState<number[]>(org.workingHoursConfig.workDays);
  const [startHour, setStartHour] = useState(org.workingHoursConfig.startHour);
  const [endHour, setEndHour] = useState(org.workingHoursConfig.endHour);

  // WhatsApp
  const [waStatus, setWaStatus] = useState(whatsappSession?.status ?? "DISCONNECTED");
  const [waPhone, setWaPhone] = useState(whatsappSession?.phone ?? null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [connectingWa, setConnectingWa] = useState(false);

  // Members
  const [members, setMembers] = useState<Member[]>(initialMembers);

  // Invites
  const [inviteCodes, setInviteCodes] = useState<InviteCodeItem[]>(initialInviteCodes);
  const [newMaxUses, setNewMaxUses] = useState(10);
  const [newExpiryDays, setNewExpiryDays] = useState<number | "">("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Platform admin
  const [platformOrgs, setPlatformOrgs] = useState<PlatformOrg[]>(allOrgs);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOrgType, setNewOrgType] = useState<"TEAM" | "PRIVATE_USER">("TEAM");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [platformError, setPlatformError] = useState("");
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [inviteOrgId, setInviteOrgId] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState(10);
  const [inviteExpiryDays, setInviteExpiryDays] = useState<number | "">("");
  const [creatingPlatformInvite, setCreatingPlatformInvite] = useState(false);
  const [platformInviteResult, setPlatformInviteResult] = useState<string | null>(null);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntryItem[]>(initialWaitlistEntries);
  const [selectedWaitlistIds, setSelectedWaitlistIds] = useState<string[]>([]);
  const [waitlistOrgId, setWaitlistOrgId] = useState(
    allOrgs.find((item) => item.type === "PRIVATE_USER" || item.type === "GENERAL" || item.name === "Private User")?.id ?? ""
  );
  const [invitingWaitlist, setInvitingWaitlist] = useState(false);
  const [waitlistInviteResults, setWaitlistInviteResults] = useState<string[]>([]);

  const isOwner = currentUserRole === "OWNER";
  const isAdminOrOwner = ["OWNER", "ADMIN"].includes(currentUserRole);
  const isMemberOnly = !isAdminOrOwner;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          name: orgName,
          emailDomains,
          emergencyInterval,
          highInterval,
          midInterval,
          lowInterval,
          workingHoursConfig: { timezone, workDays, startHour, endHour },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectWa = () => {
    setConnectingWa(true);
    setQrData(null);

    const es = new EventSource(`/api/whatsapp/qr-stream?orgId=${orgId}`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "qr") {
        setQrData(data.data);
        setWaStatus("QR_PENDING");
      } else if (data.type === "connected") {
        setWaStatus("CONNECTED");
        setWaPhone(data.phone);
        setQrData(null);
        setConnectingWa(false);
        es.close();
      }
    };
    es.onerror = () => {
      es.close();
      setConnectingWa(false);
    };
  };

  const handleDisconnectWa = async () => {
    if (!confirm("Disconnect WhatsApp?")) return;
    await fetch("/api/whatsapp/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    setWaStatus("DISCONNECTED");
    setWaPhone(null);
    setQrData(null);
    setConnectingWa(false);
  };

  const handleChangeRole = async (targetUserId: string, role: string) => {
    const res = await fetch("/api/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, targetUserId, role }),
    });
    if (res.ok) {
      setMembers(members.map((m) => m.userId === targetUserId ? { ...m, role } : m));
    }
  };

  const handleRemoveMember = async (targetUserId: string, name: string) => {
    if (!confirm(`Remove ${name} from this org?`)) return;
    const res = await fetch(`/api/members?orgId=${orgId}&userId=${targetUserId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers(members.filter((m) => m.userId !== targetUserId));
    }
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          maxUses: newMaxUses,
          expiresInDays: newExpiryDays || undefined,
        }),
      });
      if (res.ok) {
        const invite = await res.json();
        setInviteCodes([{ ...invite, createdByName: "You" }, ...inviteCodes]);
      }
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleDeleteInvite = async (id: string) => {
    if (!confirm("Delete this invite link?")) return;
    const res = await fetch(`/api/invites?id=${id}`, { method: "DELETE" });
    if (res.ok) setInviteCodes(inviteCodes.filter((c) => c.id !== id));
  };

  const copyInviteLink = (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const roleColor: Record<string, string> = {
    OWNER: "bg-purple-100 text-purple-700",
    ADMIN: "bg-blue-100 text-blue-700",
    MEMBER: "bg-gray-100 text-gray-600",
  };

  const tabs = [
    { id: "general", label: "General" },
    { id: "reminders", label: "Reminders" },
    { id: "working-hours", label: "Hours" },
    { id: "whatsapp", label: "WhatsApp" },
    ...(isAdminOrOwner ? [{ id: "members", label: "Members" }] : []),
    ...(isAdminOrOwner ? [{ id: "invites", label: "Invites" }] : []),
    ...(isSuperAdmin ? [{ id: "waitlist", label: "Waitlist" }] : []),
    ...(isSuperAdmin ? [{ id: "platform", label: "🛡️ Platform" }] : []),
  ];

  const noSaveButton = ["whatsapp", "members", "invites", "waitlist", "platform"].includes(activeTab) || !isAdminOrOwner;

  const privateUserOrg =
    platformOrgs.find((item) => item.type === "PRIVATE_USER" || item.type === "GENERAL" || item.name === "Private User")?.id ?? "";

  const inviteWaitlist = async (ids: string[]) => {
    if (!ids.length || !waitlistOrgId) return;
    setInvitingWaitlist(true);
    setWaitlistInviteResults([]);
    try {
      const res = await fetch("/api/waitlist/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          orgId: waitlistOrgId,
          maxUses: 1,
          expiresInDays: 14,
          sendEmail: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to invite waitlist entries");
      }
      const invitedAt = new Date().toISOString();
      const resultMap = new Map<string, { inviteUrl: string }>(
        (data.results ?? []).map((result: any) => [result.id, result])
      );

      setWaitlistEntries((prev) =>
        prev.map((entry) =>
          resultMap.has(entry.id)
            ? {
                ...entry,
                invitedAt,
                invitedOrgId: waitlistOrgId,
                inviteCode: resultMap.get(entry.id)!.inviteUrl.split("/").pop() ?? null,
              }
            : entry
        )
      );
      setSelectedWaitlistIds([]);
      setWaitlistInviteResults(
        (data.results ?? []).map((result: any) =>
          `${result.email} → ${result.emailed ? "email sent" : "invite generated"}`
        )
      );
    } catch (error: any) {
      setWaitlistInviteResults([error?.message ?? "Failed to invite waitlist entries"]);
    } finally {
      setInvitingWaitlist(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your organization preferences</p>
      </div>

      {!isAdminOrOwner && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          You have view-only access. Only Owners and Admins can change settings.
        </div>
      )}

      {/* Tabs — horizontal scroll on mobile */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        {/* General */}
        {activeTab === "general" && (
          <div className="p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-900">Organization</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isAdminOrOwner}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
              <input
                type="text"
                value={org.slug}
                disabled
                className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                Direct join URL:{" "}
                <span className="font-mono">
                  {typeof window !== "undefined" ? window.location.origin : ""}/{org.slug}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Auto-join Email Domains
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Users with these email domains are auto-added as members on sign-in
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value.toLowerCase().trim())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && domainInput) {
                      e.preventDefault();
                      if (!emailDomains.includes(domainInput)) {
                        setEmailDomains([...emailDomains, domainInput]);
                      }
                      setDomainInput("");
                    }
                  }}
                  placeholder="e.g. vvmvp.org"
                  disabled={!isAdminOrOwner}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                />
                <button
                  onClick={() => {
                    if (domainInput && !emailDomains.includes(domainInput)) {
                      setEmailDomains([...emailDomains, domainInput]);
                      setDomainInput("");
                    }
                  }}
                  disabled={!isAdminOrOwner}
                  className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {emailDomains.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {emailDomains.map((domain) => (
                    <span
                      key={domain}
                      className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-700 border border-primary-200 px-3 py-1 rounded-full text-xs font-medium"
                    >
                      @{domain}
                      {isAdminOrOwner && (
                        <button
                          onClick={() => setEmailDomains(emailDomains.filter((d) => d !== domain))}
                          className="text-primary-400 hover:text-primary-700"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reminders */}
        {activeTab === "reminders" && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Reminder Intervals</h2>
              <p className="text-sm text-gray-500">How often to follow up based on task importance</p>
            </div>

            {[
              { key: "emergency", label: "🚨 Emergency", value: emergencyInterval, setter: setEmergencyInterval, desc: "Always sends, ignores working hours", color: "text-red-600" },
              { key: "high", label: "🔴 High", value: highInterval, setter: setHighInterval, desc: "Only within working hours", color: "text-orange-600" },
              { key: "mid", label: "🟡 Medium", value: midInterval, setter: setMidInterval, desc: "Only within working hours", color: "text-yellow-600" },
              { key: "low", label: "🟢 Low", value: lowInterval, setter: setLowInterval, desc: "Only within working hours", color: "text-green-600" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <div className={`text-sm font-medium ${item.color}`}>{item.label}</div>
                  <div className="text-xs text-gray-400">{item.desc}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={item.value}
                    onChange={(e) => item.setter(Number(e.target.value))}
                    min={1}
                    max={168}
                    disabled={!isAdminOrOwner}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  <span className="text-sm text-gray-500">hours</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Working Hours */}
        {activeTab === "working-hours" && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Working Hours</h2>
              <p className="text-sm text-gray-500">Reminders only sent within these hours (except Emergency)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!isAdminOrOwner}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Work Days</label>
              <div className="flex gap-1.5">
                {DAYS.map((day, i) => (
                  <button
                    key={day}
                    onClick={() => {
                      if (!isAdminOrOwner) return;
                      setWorkDays(workDays.includes(i) ? workDays.filter((d) => d !== i) : [...workDays, i]);
                    }}
                    disabled={!isAdminOrOwner}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all border disabled:cursor-not-allowed ${
                      workDays.includes(i)
                        ? "bg-primary-500 border-primary-500 text-white"
                        : "border-gray-200 text-gray-500 hover:border-primary-300"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Hour</label>
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  disabled={!isAdminOrOwner}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">End Hour</label>
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  disabled={!isAdminOrOwner}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => (
                    <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp */}
        {activeTab === "whatsapp" && (
          <div className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">WhatsApp Integration</h2>
            <p className="text-sm text-gray-500 mb-6">
              {isAdminOrOwner
                ? "Connect WhatsApp to send automated task reminders"
                : "Your organization uses a shared WhatsApp connection for reminders. Members do not need to connect a personal number."}
            </p>

            <div className={`border-2 rounded-2xl p-5 mb-6 flex items-center gap-4 ${waStatus === "CONNECTED" ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${waStatus === "CONNECTED" ? "bg-green-500" : "bg-gray-300"}`}>
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {waStatus === "CONNECTED"
                    ? isAdminOrOwner
                      ? "Connected"
                      : "Organization connection active"
                    : waStatus === "QR_PENDING"
                      ? "Waiting for scan..."
                      : "Disconnected"}
                </div>
                <div className="text-sm text-gray-500">
                  {waStatus === "CONNECTED"
                    ? isAdminOrOwner
                      ? (waPhone ?? "No phone linked")
                      : "Managed by an org admin"
                    : "No active org connection"}
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${waStatus === "CONNECTED" ? "bg-green-500" : waStatus === "QR_PENDING" ? "bg-yellow-400 animate-pulse" : "bg-gray-300"}`} />
            </div>

            {isMemberOnly && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                You joined through an invite. Task reminders will use the organization WhatsApp setup automatically when admins assign and schedule them.
              </div>
            )}

            {qrData && (
              <div className="text-center mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Scan with WhatsApp: <strong>Settings → Linked Devices → Link a Device</strong>
                </p>
                <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-2xl">
                  <img src={qrData} alt="WhatsApp QR" className="w-56 h-56" />
                </div>
              </div>
            )}

            {isAdminOrOwner && (
              <div className="flex gap-3">
                {waStatus !== "CONNECTED" ? (
                  <button
                    onClick={handleConnectWa}
                    disabled={connectingWa}
                    className="flex-1 bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    {connectingWa ? "Connecting..." : "Connect WhatsApp"}
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnectWa}
                    className="flex-1 border border-red-200 text-red-600 py-3 rounded-xl font-medium hover:bg-red-50 transition-colors text-sm"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Members */}
        {activeTab === "members" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Team Members</h2>
                <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0 overflow-hidden">
                    {m.image ? (
                      <img src={m.image} alt={m.name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      m.name[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {m.name}
                      {m.userId === currentUserId && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isOwner && m.userId !== currentUserId && m.role !== "OWNER" ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleChangeRole(m.userId, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleColor[m.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {m.role}
                      </span>
                    )}
                    {isAdminOrOwner && m.userId !== currentUserId && m.role !== "OWNER" && (
                      <button
                        onClick={() => handleRemoveMember(m.userId, m.name)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Remove member"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invites */}
        {activeTab === "invites" && (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Invite Links</h2>
              <p className="text-sm text-gray-500">Generate invite links to onboard people to your org</p>
            </div>

            {/* Create new invite */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Generate New Invite</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Uses</label>
                  <input
                    type="number"
                    value={newMaxUses}
                    onChange={(e) => setNewMaxUses(Math.max(1, Number(e.target.value)))}
                    min={1}
                    max={500}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Expires In (days, optional)</label>
                  <input
                    type="number"
                    value={newExpiryDays}
                    onChange={(e) => setNewExpiryDays(e.target.value ? Number(e.target.value) : "")}
                    min={1}
                    placeholder="No expiry"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateInvite}
                disabled={creatingInvite}
                className="w-full bg-primary-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {creatingInvite ? "Creating..." : "Generate Invite Link"}
              </button>
            </div>

            {/* Invite list */}
            {inviteCodes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No invite links yet</p>
            ) : (
              <div className="space-y-2">
                {inviteCodes.map((c) => {
                  const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
                  const isFull = c.usedCount >= c.maxUses;
                  const inviteUrl = typeof window !== "undefined"
                    ? `${window.location.origin}/invite/${c.code}`
                    : `/invite/${c.code}`;

                  return (
                    <div
                      key={c.id}
                      className={`border rounded-xl p-3 ${isExpired || isFull ? "border-gray-100 opacity-60" : "border-gray-200"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold text-gray-900">{c.code}</span>
                            {isExpired && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Expired</span>}
                            {isFull && !isExpired && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Full</span>}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{inviteUrl}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                            <span>{c.usedCount}/{c.maxUses} used</span>
                            {c.expiresAt && <span>Expires {new Date(c.expiresAt).toLocaleDateString()}</span>}
                            <span>By {c.createdByName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => copyInviteLink(c.code)}
                            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-600"
                          >
                            {copiedCode === c.code ? "Copied!" : "Copy"}
                          </button>
                          <button
                            onClick={() => handleDeleteInvite(c.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1.5"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Platform Tab */}
        {activeTab === "waitlist" && isSuperAdmin && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Waitlist</h2>
                <p className="text-sm text-gray-500">
                  Admin invite queue for early-access users
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={waitlistOrgId}
                  onChange={(e) => setWaitlistOrgId(e.target.value)}
                  className="max-w-[220px] border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select target org</option>
                  {platformOrgs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.type === "PRIVATE_USER" || item.type === "GENERAL" ? " · Private User" : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => inviteWaitlist(selectedWaitlistIds)}
                  disabled={!selectedWaitlistIds.length || !waitlistOrgId || invitingWaitlist}
                  className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {invitingWaitlist ? "Inviting..." : `Invite Selected (${selectedWaitlistIds.length})`}
                </button>
              </div>
            </div>

            {!privateUserOrg && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                No `Private User` org exists yet. Create one from the Platform tab and use it as the default invite target for waitlist users.
              </div>
            )}

            {waitlistInviteResults.length > 0 && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {waitlistInviteResults.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <div className="grid grid-cols-[40px,minmax(0,1.2fr),minmax(0,1fr),minmax(0,1fr),120px,120px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                <label className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={waitlistEntries.length > 0 && selectedWaitlistIds.length === waitlistEntries.length}
                    onChange={(e) =>
                      setSelectedWaitlistIds(e.target.checked ? waitlistEntries.map((item) => item.id) : [])
                    }
                  />
                </label>
                <div>Name</div>
                <div>Email</div>
                <div>Phone</div>
                <div>Status</div>
                <div>Action</div>
              </div>
              {waitlistEntries.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No waitlist entries</div>
              ) : (
                waitlistEntries.map((entry) => {
                  const selected = selectedWaitlistIds.includes(entry.id);
                  return (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[40px,minmax(0,1.2fr),minmax(0,1fr),minmax(0,1fr),120px,120px] gap-3 border-t border-gray-100 px-4 py-3 text-sm"
                    >
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) =>
                            setSelectedWaitlistIds((prev) =>
                              e.target.checked ? [...prev, entry.id] : prev.filter((id) => id !== entry.id)
                            )
                          }
                        />
                      </label>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900">{entry.name || "—"}</div>
                        <div className="text-xs text-gray-400">
                          Joined {new Date(entry.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="min-w-0 truncate text-gray-700">{entry.email}</div>
                      <div className="min-w-0 truncate text-gray-700">{entry.phone || "—"}</div>
                      <div className="text-xs">
                        {entry.invitedAt ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-700">
                            Invited
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-700">
                            Pending
                          </span>
                        )}
                      </div>
                      <div>
                        <button
                          onClick={() => inviteWaitlist([entry.id])}
                          disabled={!waitlistOrgId || invitingWaitlist}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Invite
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Platform Tab */}
        {activeTab === "platform" && isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-semibold text-gray-900">All Organizations</h2>
                <p className="text-sm text-gray-500 mt-0.5">{platformOrgs.length} organizations on the platform</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowCreateInvite(true); setInviteOrgId(platformOrgs[0]?.id ?? ""); setPlatformInviteResult(null); }}
                  className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  🔗 Create Invite
                </button>
                <button
                  onClick={() => { setShowCreateOrg(true); setPlatformError(""); }}
                  className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  + Create Org
                </button>
              </div>
            </div>

            {platformOrgs.map((o) => (
              <div key={o.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                    {o.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{o.name}</span>
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{o.slug}</span>
                      {(o.type === "PERSONAL" || o.type === "PRIVATE_USER" || o.type === "GENERAL") && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Personal</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {o.members.length} members · {o._count.projects} projects · {o._count.tasks} tasks
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => { setInviteOrgId(o.id); setInviteMaxUses(10); setInviteExpiryDays(""); setPlatformInviteResult(null); setShowCreateInvite(true); }}
                      className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      🔗 Invite
                    </button>
                    <button
                      onClick={() => setExpandedOrg(expandedOrg === o.id ? null : o.id)}
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {expandedOrg === o.id ? "Hide" : "Members"}
                    </button>
                  </div>
                </div>
                {expandedOrg === o.id && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Invite History</div>
                      {o.inviteCodes.length === 0 ? (
                        <div className="text-sm text-gray-400">No invite links generated yet</div>
                      ) : (
                        <div className="space-y-2">
                          {o.inviteCodes.map((invite) => {
                            const inviteUrl = typeof window !== "undefined"
                              ? `${window.location.origin}/invite/${invite.code}`
                              : `/invite/${invite.code}`;
                            const isExpired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
                            return (
                              <div key={invite.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 break-all">{inviteUrl}</div>
                                    <div className="mt-1 text-xs text-gray-500">
                                      Used {invite.usedCount}/{invite.maxUses}
                                      {invite.expiresAt ? ` · Expires ${new Date(invite.expiresAt).toLocaleDateString("en-IN")}` : " · No expiry"}
                                      {isExpired ? " · Expired" : ""}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(inviteUrl).catch(() => {})}
                                    className="flex-shrink-0 text-xs border border-gray-200 bg-white text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {o.members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50">
                        <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-medium flex-shrink-0">
                          {(m.user.name ?? m.user.email)[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{m.user.name ?? "—"}</div>
                          <div className="text-xs text-gray-400">{m.user.email}</div>
                        </div>
                        <select
                          value={m.role}
                          onChange={async (e) => {
                            await fetch("/api/members", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ orgId: o.id, userId: m.userId, role: e.target.value }),
                            });
                            setPlatformOrgs((prev) =>
                              prev.map((org) =>
                                org.id === o.id
                                  ? { ...org, members: org.members.map((mem) => mem.userId === m.userId ? { ...mem, role: e.target.value } : mem) }
                                  : org
                              )
                            );
                          }}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none"
                        >
                          <option value="OWNER">Owner</option>
                          <option value="ADMIN">Admin</option>
                          <option value="MEMBER">Member</option>
                        </select>
                        <button
                          onClick={async () => {
                            if (!confirm("Remove this member?")) return;
                            await fetch("/api/members", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ orgId: o.id, userId: m.userId }),
                            });
                            setPlatformOrgs((prev) =>
                              prev.map((org) =>
                                org.id === o.id
                                  ? { ...org, members: org.members.filter((mem) => mem.userId !== m.userId) }
                                  : org
                              )
                            );
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Create Invite Modal */}
            {showCreateInvite && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-5">Create Invite Link</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization</label>
                      <select
                        value={inviteOrgId}
                        onChange={(e) => setInviteOrgId(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        {platformOrgs.map((o) => (
                          <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Max uses</label>
                        <input
                          type="number"
                          min={1}
                          value={inviteMaxUses}
                          onChange={(e) => setInviteMaxUses(Number(e.target.value))}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Expires in (days)</label>
                        <input
                          type="number"
                          min={1}
                          placeholder="Never"
                          value={inviteExpiryDays}
                          onChange={(e) => setInviteExpiryDays(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  {platformInviteResult && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
                      <p className="text-xs text-green-700 font-medium mb-1">Invite link created & copied!</p>
                      <p className="text-xs text-green-600 break-all font-mono">{platformInviteResult}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(platformInviteResult).catch(() => {})}
                        className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Copy again
                      </button>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowCreateInvite(false)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                      Close
                    </button>
                    <button
                      onClick={async () => {
                        if (!inviteOrgId) return;
                        setCreatingPlatformInvite(true);
                        try {
                          const res = await fetch("/api/invites", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              orgId: inviteOrgId,
                              maxUses: inviteMaxUses,
                              expiresInDays: inviteExpiryDays !== "" ? inviteExpiryDays : undefined,
                            }),
                          });
                          const data = await res.json();
                          if (data.code) {
                            const link = `${window.location.origin}/invite/${data.code}`;
                            setPlatformInviteResult(link);
                            await navigator.clipboard.writeText(link).catch(() => {});
                          }
                        } finally {
                          setCreatingPlatformInvite(false);
                        }
                      }}
                      disabled={!inviteOrgId || creatingPlatformInvite}
                      className="flex-1 bg-primary-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                    >
                      {creatingPlatformInvite ? "Creating..." : "Generate Link"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Create Org Modal */}
            {showCreateOrg && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-5">Create Organization</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Name</label>
                      <input
                        type="text"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="e.g. Vaidi Puja Services"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Org Type</label>
                      <div className="flex gap-2">
                        {[
                          { value: "TEAM", label: "Team", desc: "Shared contacts & tasks" },
                          { value: "PRIVATE_USER", label: "Private User", desc: "Private contacts per user" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setNewOrgType(opt.value as "TEAM" | "PRIVATE_USER")}
                            className={`flex-1 p-3 rounded-xl border text-left text-sm transition-all ${newOrgType === opt.value ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                          >
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Domain</label>
                      <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
                        <span className="bg-gray-50 px-3 py-3 text-sm text-gray-500 border-r border-gray-200">@</span>
                        <input
                          type="text"
                          value={newOwnerEmail}
                          onChange={(e) => setNewOwnerEmail(e.target.value.toLowerCase().replace(/^@/, "").replace(/\s/g, ""))}
                          placeholder="vvmvp.org"
                          className="flex-1 px-4 py-3 text-sm focus:outline-none"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">e.g. <span className="font-mono">vvmvp.org</span> → info@vvmvp.org, devuser1@vvmvp.org will all be auto-added as owners.</p>
                    </div>
                  </div>
                  {platformError && (
                    <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{platformError}</p>
                  )}
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowCreateOrg(false)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!newOrgName.trim()) return;
                        // Validate domain format client-side
                        if (newOwnerEmail.trim() && !newOwnerEmail.trim().includes(".")) {
                          setPlatformError("Email domain must include a TLD, e.g. vvmvp.org");
                          return;
                        }
                        setCreatingOrg(true);
                        setPlatformError("");
                        try {
                          const res = await fetch("/api/orgs", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: newOrgName.trim(),
                              type: newOrgType,
                              ...(newOwnerEmail.trim() ? { emailDomain: newOwnerEmail.trim() } : {}),
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            const err = data.error;
                            const msg = typeof err === "string" ? err
                              : err?.fieldErrors?.emailDomain?.[0] ? `Email domain: ${err.fieldErrors.emailDomain[0]}`
                              : err?.formErrors?.[0] ?? "Failed to create org";
                            throw new Error(msg);
                          }
                          setShowCreateOrg(false);
                          setNewOrgName("");
                          setNewOwnerEmail("");
                          setNewOrgType("TEAM");
                          window.location.reload();
                        } catch (e: any) {
                          setPlatformError(e.message);
                        } finally {
                          setCreatingOrg(false);
                        }
                      }}
                      disabled={!newOrgName.trim() || creatingOrg}
                      className="flex-1 bg-primary-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                    >
                      {creatingOrg ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save button */}
      {!noSaveButton && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm text-sm"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
