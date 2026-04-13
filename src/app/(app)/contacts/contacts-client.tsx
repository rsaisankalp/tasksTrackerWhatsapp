"use client";

import { useState } from "react";

const TRUST_LEVELS = ["INTERNAL", "TRUSTED", "EXTERNAL"] as const;
const TRUST_CONFIG: Record<string, { label: string; color: string }> = {
  INTERNAL: { label: "Internal", color: "bg-green-100 text-green-700" },
  TRUSTED: { label: "Trusted", color: "bg-blue-100 text-blue-700" },
  EXTERNAL: { label: "External", color: "bg-gray-100 text-gray-600" },
};

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  department: string | null;
  trustLevel: string;
  avatarUrl: string | null;
  createdAt: string;
  _count: { assignedTasks: number };
}

export default function ContactsClient({
  orgId,
  initialContacts,
}: {
  orgId: string;
  initialContacts: Contact[];
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    role: "",
    department: "",
    trustLevel: "INTERNAL" as "INTERNAL" | "TRUSTED" | "EXTERNAL",
  });
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.department?.toLowerCase().includes(search.toLowerCase()) ||
      c.role?.toLowerCase().includes(search.toLowerCase())
  );

  const parsePhone = (raw: string): { cc: string; num: string } => {
    const cleaned = raw.replace(/\s/g, "");
    if (cleaned.startsWith("+91")) return { cc: "+91", num: cleaned.slice(3) };
    if (cleaned.startsWith("91") && cleaned.length > 10) return { cc: "+91", num: cleaned.slice(2) };
    return { cc: "+91", num: cleaned };
  };

  const openCreate = () => {
    setForm({ name: "", phone: "", email: "", role: "", department: "", trustLevel: "INTERNAL" });
    setPhoneCountryCode("+91");
    setEditContact(null);
    setError("");
    setShowCreate(true);
  };

  const openEdit = (c: Contact) => {
    const { cc, num } = parsePhone(c.phone ?? "");
    setPhoneCountryCode(cc);
    setForm({
      name: c.name,
      phone: num,
      email: c.email ?? "",
      role: c.role ?? "",
      department: c.department ?? "",
      trustLevel: c.trustLevel as any,
    });
    setEditContact(c);
    setError("");
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    setError("");
    const fullPhone = form.phone.trim()
      ? `${phoneCountryCode}${form.phone.trim()}`
      : "";
    const submitData = { ...form, phone: fullPhone || undefined };
    try {
      if (editContact) {
        const res = await fetch(`/api/contacts/${editContact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitData),
        });
        if (!res.ok) throw new Error("Failed to update");
        const updated = await res.json();
        setContacts((prev) =>
          prev.map((c) =>
            c.id === editContact.id ? { ...c, ...updated } : c
          )
        );
      } else {
        const res = await fetch(`/api/contacts?orgId=${orgId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, ...submitData }),
        });
        if (!res.ok) throw new Error("Failed to create");
        const contact = await res.json();
        setContacts((prev) => [{ ...contact, _count: { assignedTasks: 0 } }, ...prev]);
      }
      setShowCreate(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const downloadSampleCSV = () => {
    const csv = [
      "name,phone,email,role,department,trustLevel",
      "Rahul Sharma,9876543210,rahul@example.com,Manager,Sales,INTERNAL",
      "Priya Patel,+919988776655,priya@example.com,Executive,HR,TRUSTED",
      "John Smith,+14155550100,john@example.com,Partner,,EXTERNAL",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVImport = async (file: File) => {
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      // RFC 4180-compliant CSV field parser
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuotes = !inQuotes;
          } else if (ch === "," && !inQuotes) {
            result.push(cur.trim()); cur = "";
          } else {
            cur += ch;
          }
        }
        result.push(cur.trim());
        return result;
      };
      const rows = lines.slice(1).map((line) => {
        const vals = parseCSVLine(line);
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        return obj;
      }).filter((r) => r.name);

      const res = await fetch(`/api/contacts/bulk?orgId=${orgId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: rows }),
      });
      const result = await res.json();
      setBulkResult(result);
      if (result.success > 0) {
        // Refresh contacts list
        const updated = await fetch(`/api/contacts?orgId=${orgId}`).then((r) => r.json());
        if (Array.isArray(updated)) setContacts(updated);
      }
    } catch (e: any) {
      setBulkResult({ success: 0, failed: 1, errors: [e.message] });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-0.5">{contacts.length} executor{contacts.length !== 1 ? "s" : ""} in your org</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBulkImport(true); setBulkResult(null); }}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Contact
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg
          className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, department..."
          className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        />
      </div>

      {/* Table */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No contacts yet</h3>
          <p className="text-gray-500 mb-6 text-sm">
            Add your team members and executors here
          </p>
          <button
            onClick={openCreate}
            className="bg-primary-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-700"
          >
            Add First Contact
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3.5">Contact</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5">Phone</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5">Department</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3.5">Trust</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3.5">Tasks</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredContacts.map((c) => {
                const trustCfg = TRUST_CONFIG[c.trustLevel] ?? TRUST_CONFIG.INTERNAL;
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
                          {c.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{c.name}</div>
                          {c.email && (
                            <div className="text-xs text-gray-400">{c.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{c.phone ?? "—"}</td>
                    <td className="px-4 py-4">
                      {c.department ? (
                        <div>
                          <div className="text-sm text-gray-700">{c.department}</div>
                          {c.role && <div className="text-xs text-gray-400">{c.role}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${trustCfg.color}`}>
                        {trustCfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-semibold text-gray-700">
                        {c._count.assignedTasks}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editContact ? "Edit Contact" : "New Contact"}
              </h2>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Full name"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <div className="flex gap-2">
                    <select
                      value={phoneCountryCode}
                      onChange={(e) => setPhoneCountryCode(e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white w-24"
                    >
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+971">🇦🇪 +971</option>
                      <option value="+65">🇸🇬 +65</option>
                    </select>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="9876543210"
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="e.g. Designer"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="e.g. Creative"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Trust Level</label>
                  <div className="flex gap-2">
                    {TRUST_LEVELS.map((level) => {
                      const cfg = TRUST_CONFIG[level];
                      return (
                        <button
                          key={level}
                          onClick={() => setForm({ ...form, trustLevel: level as "INTERNAL" | "TRUSTED" | "EXTERNAL" })}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                            form.trustLevel === level
                              ? `${cfg.color} border-current`
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || loading}
                className="flex-1 bg-primary-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Saving..." : editContact ? "Update" : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Import Contacts from CSV</h2>
              <button onClick={() => setShowBulkImport(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
                <p className="font-medium text-gray-800">CSV format:</p>
                <p><code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200">name, phone, email, role, department, trustLevel</code></p>
                <p className="text-xs text-gray-500">• Phone: 10-digit numbers default to +91 India<br/>• trustLevel: INTERNAL / TRUSTED / EXTERNAL<br/>• Only name is required</p>
              </div>
              <button
                onClick={downloadSampleCSV}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download sample CSV
              </button>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Upload CSV file</span>
                <input
                  type="file"
                  accept=".csv"
                  disabled={bulkLoading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCSVImport(file);
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium hover:file:bg-primary-100 cursor-pointer border border-dashed border-gray-300 rounded-xl p-3"
                />
              </label>
              {bulkLoading && (
                <p className="text-sm text-gray-500 text-center">Importing...</p>
              )}
              {bulkResult && (
                <div className={`rounded-xl p-4 text-sm ${bulkResult.failed === 0 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  <p className="font-medium">✓ {bulkResult.success} imported{bulkResult.failed > 0 ? `, ${bulkResult.failed} failed` : ""}</p>
                  {bulkResult.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs mt-1 opacity-80">{e}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowBulkImport(false)} className="w-full border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
