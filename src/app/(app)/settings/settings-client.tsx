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

interface SettingsClientProps {
  orgId: string;
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
}

export default function SettingsClient({
  orgId,
  initialTab,
  org,
  whatsappSession,
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

  const tabs = [
    { id: "general", label: "General" },
    { id: "reminders", label: "Reminders" },
    { id: "working-hours", label: "Working Hours" },
    { id: "whatsapp", label: "WhatsApp" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your organization preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
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
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                Join URL: <span className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/{org.slug}</span>
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
                  placeholder="e.g. vaidicpujas.org"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={() => {
                    if (domainInput && !emailDomains.includes(domainInput)) {
                      setEmailDomains([...emailDomains, domainInput]);
                      setDomainInput("");
                    }
                  }}
                  className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700"
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
                      <button
                        onClick={() => setEmailDomains(emailDomains.filter((d) => d !== domain))}
                        className="text-primary-400 hover:text-primary-700"
                      >
                        ×
                      </button>
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
              {
                key: "emergency",
                label: "🚨 Emergency",
                value: emergencyInterval,
                setter: setEmergencyInterval,
                desc: "Always sends, ignores working hours",
                color: "text-red-600",
              },
              {
                key: "high",
                label: "🔴 High",
                value: highInterval,
                setter: setHighInterval,
                desc: "Only within working hours",
                color: "text-orange-600",
              },
              {
                key: "mid",
                label: "🟡 Medium",
                value: midInterval,
                setter: setMidInterval,
                desc: "Only within working hours",
                color: "text-yellow-600",
              },
              {
                key: "low",
                label: "🟢 Low",
                value: lowInterval,
                setter: setLowInterval,
                desc: "Only within working hours",
                color: "text-green-600",
              },
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
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Work Days</label>
              <div className="flex gap-2">
                {DAYS.map((day, i) => (
                  <button
                    key={day}
                    onClick={() =>
                      setWorkDays(
                        workDays.includes(i)
                          ? workDays.filter((d) => d !== i)
                          : [...workDays, i]
                      )
                    }
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all border ${
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
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">End Hour</label>
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, "0")}:00
                    </option>
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
              Connect WhatsApp to send automated task reminders
            </p>

            <div
              className={`border-2 rounded-2xl p-5 mb-6 flex items-center gap-4 ${
                waStatus === "CONNECTED"
                  ? "border-green-200 bg-green-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  waStatus === "CONNECTED" ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {waStatus === "CONNECTED"
                    ? "Connected"
                    : waStatus === "QR_PENDING"
                    ? "Waiting for scan..."
                    : "Disconnected"}
                </div>
                <div className="text-sm text-gray-500">
                  {waPhone ?? "No phone linked"}
                </div>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  waStatus === "CONNECTED"
                    ? "bg-green-500"
                    : waStatus === "QR_PENDING"
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-gray-300"
                }`}
              />
            </div>

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
          </div>
        )}
      </div>

      {/* Save button (not for whatsapp tab) */}
      {activeTab !== "whatsapp" && (
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
