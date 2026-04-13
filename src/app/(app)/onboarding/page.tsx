"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";


type Step = "org" | "whatsapp" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<Step>("org");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrData, setQrData] = useState<string | null>(null);
  const [waConnected, setWaConnected] = useState(false);
  const [waPhone, setWaPhone] = useState<string | null>(null);

  const handleCreateOrg = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, slug: orgSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Failed");
      setOrgId(data.id);
      setStep("whatsapp");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startWhatsAppSetup = () => {
    if (!orgId) return;

    const eventSource = new EventSource(`/api/whatsapp/qr-stream?orgId=${orgId}`);

    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "qr") {
        setQrData(data.data);
      } else if (data.type === "connected") {
        setWaConnected(true);
        setWaPhone(data.phone);
        setQrData(null);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  };

  const handleSkipWhatsApp = () => {
    setStep("done");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(180deg,#fffaf4_0%,#fff5ec_52%,#f7fbff_100%)] p-4 sm:p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
            style={{ background: "linear-gradient(135deg, #F47C20, #FDB813)" }}
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-950">Set up TaskFlow</h1>
          <p className="mt-1 text-sm text-stone-500">Get started in 2 quick steps</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          {(["org", "whatsapp", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step === s
                    ? "bg-primary-500 text-white"
                    : s < step || (step === "done" && s !== "done")
                    ? "bg-green-500 text-white"
                    : "border border-gray-200 bg-white text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="h-0.5 w-12 bg-orange-100" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur md:p-8">
          {step === "org" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Create your organization</h2>
              <p className="text-gray-500 text-sm mb-6">This is your team workspace for managing tasks</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Organization name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      setOrgSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, "")
                      );
                    }}
                    placeholder="e.g. Acme Corp"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Slug <span className="text-gray-400 font-normal">(unique identifier)</span>
                  </label>
                  <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
                    <span className="bg-gray-50 px-3 py-3 text-sm text-gray-500 border-r border-gray-200">
                      slug/
                    </span>
                    <input
                      type="text"
                      value={orgSlug}
                      onChange={(e) =>
                        setOrgSlug(
                          e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                        )
                      }
                      placeholder="acme-corp"
                      className="flex-1 px-4 py-3 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                onClick={handleCreateOrg}
                disabled={!orgName.trim() || !orgSlug.trim() || loading}
                className="mt-6 w-full bg-primary-600 text-white py-3 rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating..." : "Create organization →"}
              </button>
            </div>
          )}

          {step === "whatsapp" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Connect WhatsApp</h2>
              <p className="text-gray-500 text-sm mb-6">
                Connect your WhatsApp to send automated reminders to your team
              </p>

              {!qrData && !waConnected && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-9 h-9 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-sm mb-6">
                    Scan a QR code with your WhatsApp to link your account
                  </p>
                  <button
                    onClick={startWhatsAppSetup}
                    className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition-colors"
                  >
                    Generate QR Code
                  </button>
                </div>
              )}

              {qrData && !waConnected && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Open WhatsApp on your phone → <strong>Settings → Linked Devices → Link a Device</strong>
                  </p>
                  <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-2xl shadow-sm">
                    <img src={qrData} alt="WhatsApp QR Code" className="w-56 h-56" />
                  </div>
                  <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    Waiting for scan...
                  </p>
                </div>
              )}

              {waConnected && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-semibold text-gray-900">Connected!</p>
                  <p className="text-sm text-gray-500 mt-1">{waPhone}</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSkipWhatsApp}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
                >
                  Skip for now
                </button>
                {waConnected && (
                  <button
                    onClick={() => setStep("done")}
                    className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-medium hover:bg-primary-700 transition-colors"
                  >
                    Continue →
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 bg-primary-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set! 🎉</h2>
              <p className="text-gray-500 mb-8">
                Your workspace is ready. Start by adding contacts and creating your first project.
              </p>
              <button
                onClick={async () => {
                  // Refresh session to pick up new org membership
                  await fetch("/api/auth/refresh", { method: "POST" });
                  router.replace("/dashboard");
                }}
                className="bg-primary-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Go to Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
