"use client";

import { signInWithPopup } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";

function LoginPageInner() {
  const { status } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistPhone, setWaitlistPhone] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  // Detect invite param client-side (avoids useSearchParams bailout)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("invite")) setShowLogin(true);
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const idToken = await result.user.getIdToken();
      const orgSlug = sessionStorage.getItem("pending-org-slug") ?? undefined;
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, orgSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "no_access") {
          setError("You need an invitation to access TaskFlow. Join the waitlist below.");
          setShowLogin(false);
          return;
        }
        throw new Error("Sign-in failed");
      }
      sessionStorage.removeItem("pending-org-slug");
      router.replace("/");
    } catch (e: any) {
      setError(e?.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleWaitlist = async () => {
    if (!waitlistEmail.trim()) return;
    setWaitlistSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: waitlistName, email: waitlistEmail, phone: waitlistPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to join waitlist");
      }
      setWaitlistDone(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to join waitlist");
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  return (
    <div style={{ background: "#06080F", minHeight: "100vh", overflowX: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-glow { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes ticker { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
        .hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .steps-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
        .feat-card:hover { background: rgba(255,255,255,0.055) !important; border-color: rgba(255,255,255,0.12) !important; transform: translateY(-2px); }
        .feat-card { transition: all 0.2s ease; }
        .btn-signin:hover { background: rgba(255,255,255,0.1) !important; }
        .wa-float { animation: float 5s ease-in-out infinite; }
        .fade-1 { animation: fadeUp 0.5s ease both 0.1s; }
        .fade-2 { animation: fadeUp 0.5s ease both 0.25s; }
        .fade-3 { animation: fadeUp 0.5s ease both 0.4s; }
        .fade-4 { animation: fadeUp 0.5s ease both 0.55s; }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .steps-grid { grid-template-columns: 1fr 1fr !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .hero-right { order: -1; }
        }
        @media (max-width: 600px) {
          .steps-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* Background orbs */}
      <div style={{ position: "fixed", top: -300, right: -200, width: 800, height: 800, background: "radial-gradient(circle, rgba(244,124,32,0.12) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: -200, left: -300, width: 700, height: 700, background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: 1200, height: 600, background: "radial-gradient(ellipse, rgba(244,124,32,0.03) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── NAV ─────────────────────────────────────────────────── */}
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #F47C20, #FDB813)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(244,124,32,0.45)" }}>
              <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span style={{ color: "white", fontWeight: 700, fontSize: 17, letterSpacing: "-0.4px" }}>TaskFlow</span>
          </div>
          <button
            className="btn-signin"
            onClick={() => setShowLogin(true)}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)", padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
          >
            Sign in →
          </button>
        </nav>

        {/* ── HERO ────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 40px 80px" }}>
          <div className="hero-grid">
            {/* Left */}
            <div>
              <div className="fade-1" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(244,124,32,0.08)", border: "1px solid rgba(244,124,32,0.22)", borderRadius: 100, padding: "6px 14px", marginBottom: 28 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#F47C20", display: "inline-block", animation: "pulse-glow 2s ease-in-out infinite" }} />
                <span style={{ color: "#F8A857", fontSize: 12, fontWeight: 600, letterSpacing: "0.2px" }}>Early Access · Invite Only</span>
              </div>

              <h1 className="fade-2" style={{ fontSize: "clamp(38px, 4.5vw, 58px)", fontWeight: 850, color: "white", lineHeight: 1.08, marginBottom: 22, letterSpacing: "-2px" }}>
                Stop chasing<br />your team.<br />
                <span style={{ background: "linear-gradient(90deg, #F47C20 0%, #FDB813 60%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  WhatsApp does it.
                </span>
              </h1>

              <p className="fade-3" style={{ color: "rgba(255,255,255,0.48)", fontSize: 17, lineHeight: 1.75, marginBottom: 40, maxWidth: 460 }}>
                Assign tasks, set deadlines — your team gets reminded on WhatsApp. They reply to update status. Dashboard syncs instantly. No new apps.
              </p>

              {/* Waitlist form */}
              <div className="fade-4">
                {waitlistDone ? (
                  <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 18, padding: "28px 28px" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
                    <div style={{ color: "white", fontWeight: 700, fontSize: 17, marginBottom: 6 }}>You're on the list!</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                      We'll reach out at <span style={{ color: "#86EFAC" }}>{waitlistEmail}</span> when your invite is ready.
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: 460 }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                      <input
                        type="text"
                        value={waitlistName}
                        onChange={e => setWaitlistName(e.target.value)}
                        placeholder="Your name"
                        style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px 16px", color: "white", fontSize: 14, outline: "none", transition: "border-color 0.15s" }}
                        onFocus={e => (e.target.style.borderColor = "rgba(244,124,32,0.5)")}
                        onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                      />
                      <input
                        type="tel"
                        value={waitlistPhone}
                        onChange={e => setWaitlistPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        style={{ flex: 1, minWidth: 160, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px 16px", color: "white", fontSize: 14, outline: "none", transition: "border-color 0.15s" }}
                        onFocus={e => (e.target.style.borderColor = "rgba(244,124,32,0.5)")}
                        onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                      />
                      <input
                        id="waitlist-email"
                        type="email"
                        value={waitlistEmail}
                        onChange={e => setWaitlistEmail(e.target.value)}
                        placeholder="your@email.com"
                        style={{ flex: 1.5, minWidth: 220, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px 16px", color: "white", fontSize: 14, outline: "none", transition: "border-color 0.15s" }}
                        onFocus={e => (e.target.style.borderColor = "rgba(244,124,32,0.5)")}
                        onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                        onKeyDown={e => e.key === "Enter" && handleWaitlist()}
                      />
                    </div>
                    <button
                      onClick={handleWaitlist}
                      disabled={!waitlistEmail.trim() || waitlistSubmitting}
                      style={{ width: "100%", background: "linear-gradient(135deg, #F47C20, #FDB813)", border: "none", borderRadius: 12, padding: "15px 24px", color: "white", fontSize: 15, fontWeight: 700, cursor: waitlistEmail.trim() && !waitlistSubmitting ? "pointer" : "not-allowed", opacity: waitlistEmail.trim() && !waitlistSubmitting ? 1 : 0.5, boxShadow: "0 8px 32px rgba(244,124,32,0.3)", transition: "all 0.15s" }}
                    >
                      {waitlistSubmitting ? "Submitting..." : "Get Early Access →"}
                    </button>
                    {error && (
                      <div style={{ marginTop: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", color: "#FCA5A5", fontSize: 13, textAlign: "center" }}>
                        {error}
                      </div>
                    )}
                    <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center", marginTop: 12 }}>
                      No spam — only your invite when it's ready.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right — WhatsApp mockup */}
            <div className="hero-right wa-float" style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, padding: 28, maxWidth: 360, width: "100%", boxShadow: "0 40px 100px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)" }}>
                {/* Chat header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 18, marginBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #25D366, #075E54)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, boxShadow: "0 0 16px rgba(37,211,102,0.3)" }}>🤖</div>
                  <div>
                    <div style={{ color: "white", fontWeight: 600, fontSize: 14 }}>TaskFlow Bot</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#25D366", display: "inline-block" }} />
                      <span style={{ color: "#25D366", fontSize: 12 }}>online</span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Bot: reminder */}
                  <div style={{ maxWidth: "88%", background: "rgba(255,255,255,0.06)", borderRadius: "16px 16px 16px 4px", padding: "14px 16px" }}>
                    <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600 }}>📋 Task Reminder</span><br />
                      Hey Rahul! You have a task due <span style={{ color: "#FDB813", fontWeight: 600 }}>today</span>:
                    </div>
                    <div style={{ background: "rgba(244,124,32,0.12)", border: "1px solid rgba(244,124,32,0.18)", borderRadius: 10, padding: "10px 12px", marginTop: 10 }}>
                      <div style={{ color: "white", fontWeight: 700, fontSize: 13 }}>🚀 Deploy API to staging</div>
                      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 3 }}>Project: MVP Sprint · Due today</div>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "right", marginTop: 8 }}>10:32 AM ✓✓</div>
                  </div>

                  {/* User: done */}
                  <div style={{ alignSelf: "flex-end", maxWidth: "65%", background: "linear-gradient(135deg, rgba(244,124,32,0.25), rgba(253,184,19,0.15))", border: "1px solid rgba(244,124,32,0.2)", borderRadius: "16px 16px 4px 16px", padding: "12px 14px" }}>
                    <div style={{ color: "white", fontSize: 13 }}>done! ✅</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textAlign: "right", marginTop: 4 }}>10:34 AM ✓✓</div>
                  </div>

                  {/* Bot: confirmed */}
                  <div style={{ maxWidth: "85%", background: "rgba(37,211,102,0.07)", border: "1px solid rgba(37,211,102,0.13)", borderRadius: "16px 16px 16px 4px", padding: "12px 14px" }}>
                    <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 13 }}>
                      ✅ <strong>Deploy API to staging</strong> marked <span style={{ color: "#4ADE80" }}>Done</span>. Dashboard updated!
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "right", marginTop: 4 }}>10:34 AM</div>
                  </div>
                </div>

                {/* Input bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: "9px 14px", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Reply to TaskFlow...</div>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #25D366, #128C7E)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>➤</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── STATS STRIP ─────────────────────────────────────────── */}
        <div style={{ maxWidth: 1240, margin: "0 auto 80px", padding: "0 40px" }}>
          <div className="stats-grid" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, overflow: "hidden" }}>
            {[
              { icon: "💬", val: "WhatsApp", label: "Native delivery" },
              { icon: "🤖", val: "AI-parsed", label: "Natural language replies" },
              { icon: "⚡", val: "Real-time", label: "Dashboard sync" },
              { icon: "0️⃣", val: "Zero", label: "Extra apps needed" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "26px 24px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 18, marginBottom: 4, letterSpacing: "-0.5px" }}>{s.val}</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURES ────────────────────────────────────────────── */}
        <div style={{ maxWidth: 1240, margin: "0 auto 100px", padding: "0 40px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ color: "white", fontSize: "clamp(26px, 3vw, 40px)", fontWeight: 800, letterSpacing: "-1.2px", marginBottom: 12 }}>
              Everything your team needs
            </h2>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
              Built for managers tired of Slack threads, missed deadlines, and chasing status updates.
            </p>
          </div>

          <div className="features-grid">
            {[
              { icon: "💬", color: "#25D366", bg: "rgba(37,211,102,0.08)", border: "rgba(37,211,102,0.15)", title: "WhatsApp Native", desc: "Tasks sent directly on WhatsApp. Your team already uses it. Reply 'done' — no new app, no friction." },
              { icon: "🤖", color: "#818CF8", bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.15)", title: "AI Reply Parsing", desc: "Natural language like 'task 2 done, 3 blocked by infra' gets parsed by AI and updates the dashboard instantly." },
              { icon: "📊", color: "#38BDF8", bg: "rgba(56,189,248,0.08)", border: "rgba(56,189,248,0.15)", title: "Live Dashboard", desc: "One view for all tasks, owners, deadlines, and blockers. Filter by project, person, or priority." },
              { icon: "🔔", color: "#F47C20", bg: "rgba(244,124,32,0.08)", border: "rgba(244,124,32,0.15)", title: "Smart Reminders", desc: "Emergency tasks reminded every 3 hrs. Low priority every 2 days. Auto-stops when marked done." },
              { icon: "🔗", color: "#F472B6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.15)", title: "Magic Task Links", desc: "Every executor gets a private link to view and update their tasks directly — no login, no friction." },
              { icon: "🏢", color: "#A78BFA", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.15)", title: "Multi-Org Ready", desc: "Run multiple teams from one account. Each org has its own members, projects and WhatsApp number." },
            ].map(f => (
              <div key={f.title} className="feat-card" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "28px 24px", cursor: "default" }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: f.bg, border: `1px solid ${f.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 20 }}>
                  {f.icon}
                </div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 15, marginBottom: 10, letterSpacing: "-0.3px" }}>{f.title}</div>
                <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 13.5, lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS ────────────────────────────────────────── */}
        <div style={{ maxWidth: 1240, margin: "0 auto 100px", padding: "0 40px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ color: "white", fontSize: "clamp(26px, 3vw, 40px)", fontWeight: 800, letterSpacing: "-1.2px", marginBottom: 12 }}>Up and running in minutes</h2>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 16 }}>No complex setup. Your team needs zero onboarding.</p>
          </div>

          <div className="steps-grid">
            {[
              { n: "01", icon: "✏️", title: "Create a task", desc: "Assign to a team member, set priority and deadline." },
              { n: "02", icon: "📱", title: "Bot notifies them", desc: "They get a clear WhatsApp message with task details." },
              { n: "03", icon: "💬", title: "They reply", desc: "'Done', 'blocked on X' — AI parses it and updates." },
              { n: "04", icon: "⚡", title: "You see it live", desc: "Dashboard reflects the change in real-time." },
            ].map((s, i) => (
              <div key={s.n} style={{ position: "relative" }}>
                {i < 3 && (
                  <div style={{ position: "absolute", top: 32, left: "calc(100% + 4px)", right: "-16px", height: "1px", background: "linear-gradient(90deg, rgba(244,124,32,0.4), transparent)", zIndex: 2, display: "block" }} className="step-arrow" />
                )}
                <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "28px 22px", height: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <div style={{ background: "rgba(244,124,32,0.1)", border: "1px solid rgba(244,124,32,0.2)", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                      {s.icon}
                    </div>
                    <span style={{ color: "#F47C20", fontWeight: 800, fontSize: 12, letterSpacing: "1px", fontFamily: "monospace" }}>{s.n}</span>
                  </div>
                  <div style={{ color: "white", fontWeight: 700, fontSize: 15, marginBottom: 10, letterSpacing: "-0.3px" }}>{s.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 13.5, lineHeight: 1.65 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOTTOM CTA ──────────────────────────────────────────── */}
        <div style={{ maxWidth: 1240, margin: "0 auto 80px", padding: "0 40px" }}>
          <div style={{ background: "linear-gradient(135deg, rgba(244,124,32,0.07) 0%, rgba(253,184,19,0.03) 100%)", border: "1px solid rgba(244,124,32,0.14)", borderRadius: 28, padding: "72px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 300, background: "radial-gradient(ellipse, rgba(244,124,32,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
            <h2 style={{ color: "white", fontSize: "clamp(26px, 3vw, 44px)", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 14, position: "relative" }}>
              Ready to ship accountability?
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 17, marginBottom: 36, position: "relative" }}>
              Join the waitlist and be first to know when your invite is ready.
            </p>
            <button
              onClick={() => { document.getElementById("waitlist-email")?.focus(); document.getElementById("waitlist-email")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
              style={{ background: "linear-gradient(135deg, #F47C20, #FDB813)", border: "none", borderRadius: 14, padding: "16px 44px", color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 40px rgba(244,124,32,0.4)", position: "relative" }}
            >
              Join the Waitlist →
            </button>
          </div>
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────── */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "28px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #F47C20, #FDB813)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>TaskFlow · Invite only</span>
          </div>
          <button
            onClick={() => setShowLogin(true)}
            style={{ background: "none", border: "none", color: "rgba(244,124,32,0.6)", cursor: "pointer", fontSize: 13, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Have an invite? Sign in
          </button>
        </footer>
      </div>

      {/* ── SIGN-IN MODAL ───────────────────────────────────────────── */}
      {showLogin && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowLogin(false); setError(""); } }}
        >
          <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 400, boxShadow: "0 48px 120px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)", animation: "fadeUp 0.2s ease both" }}>
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #F47C20, #FDB813)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(244,124,32,0.4)" }}>
                  <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>TaskFlow</span>
              </div>
              <button
                onClick={() => { setShowLogin(false); setError(""); }}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, width: 30, height: 30, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 28 }}>
              <h2 style={{ color: "white", fontWeight: 800, fontSize: 22, marginBottom: 8, letterSpacing: "-0.6px" }}>Welcome back</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.6 }}>
                Sign in with the Google account linked to your invite.
              </p>
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, color: "#FCA5A5", fontSize: 13.5, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn-signin"
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "16px 24px", color: "white", fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.65 : 1, transition: "all 0.15s" }}
            >
              {loading ? (
                <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#F47C20", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {loading ? "Signing in..." : "Continue with Google"}
            </button>

            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, textAlign: "center", marginTop: 18 }}>
              Only accounts linked to an invite can sign in.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageInner />;
}
