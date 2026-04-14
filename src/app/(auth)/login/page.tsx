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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("invite")) setShowLogin(true);
  }, []);

  // Trap focus roughly or remove scrolling
  useEffect(() => {
    if (showLogin) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [showLogin]);

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
    <div className="bg-[#06080F] min-h-screen overflow-x-hidden font-sans text-white relative">
      {/* Background orbs */}
      <div className="fixed -top-[300px] -right-[200px] w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(244,124,32,0.12)_0%,transparent_65%)] pointer-events-none z-0" />
      <div className="fixed -bottom-[200px] -left-[300px] w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(99,102,241,0.07)_0%,transparent_65%)] pointer-events-none z-0" />
      <div className="fixed top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] bg-[radial-gradient(ellipse,rgba(244,124,32,0.03)_0%,transparent_70%)] pointer-events-none z-0" />

      <div className="relative z-10">
        {/* NAV */}
        <nav className="flex items-center justify-between px-6 md:px-10 py-5 max-w-[1240px] mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-[0_0_24px_rgba(244,124,32,0.45)]">
              <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="text-white font-bold text-[17px] tracking-tight">TaskFlow</span>
          </div>
          <button
            onClick={() => setShowLogin(true)}
            aria-haspopup="dialog"
            className="bg-white/5 border border-white/10 text-white/65 px-5 py-2.5 rounded-xl text-[13px] font-medium transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            Sign in →
          </button>
        </nav>

        {/* HERO */}
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 py-12 md:pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
            {/* Left */}
            <div className="order-2 md:order-1">
              <div className="animate-fade-up [animation-delay:100ms] inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-3.5 py-1.5 mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse-glow" />
                <span className="text-secondary-400 text-xs font-semibold tracking-wide">Early Access · Invite Only</span>
              </div>

              <h1 className="animate-fade-up [animation-delay:250ms] text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-[1.08] mb-6 tracking-tighter">
                Stop chasing<br />your team.<br />
                <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
                  WhatsApp does it.
                </span>
              </h1>

              <p className="animate-fade-up [animation-delay:400ms] text-white/50 text-[17px] leading-relaxed mb-10 max-w-[460px]">
                Assign tasks, set deadlines — your team gets reminded on WhatsApp. They reply to update status. Dashboard syncs instantly. No new apps.
              </p>

              {/* Waitlist form */}
              <div className="animate-fade-up [animation-delay:550ms]">
                {waitlistDone ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-7">
                    <div className="text-4xl mb-2.5">🎉</div>
                    <div className="text-white font-bold text-[17px] mb-1.5">You're on the list!</div>
                    <div className="text-white/50 text-sm">
                      We'll reach out at <span className="text-green-300">{waitlistEmail}</span> when your invite is ready.
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[460px]">
                    <div className="flex flex-wrap gap-2.5 mb-2.5">
                      <div className="flex-1 min-w-[200px]">
                        <label htmlFor="wl-name" className="sr-only">Your name</label>
                        <input
                          id="wl-name"
                          type="text"
                          value={waitlistName}
                          onChange={e => setWaitlistName(e.target.value)}
                          placeholder="Your name"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50"
                        />
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <label htmlFor="wl-phone" className="sr-only">Phone</label>
                        <input
                          id="wl-phone"
                          type="tel"
                          value={waitlistPhone}
                          onChange={e => setWaitlistPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50"
                        />
                      </div>
                      <div className="flex-[1.5] min-w-[220px]">
                        <label htmlFor="wl-email" className="sr-only">Email address</label>
                        <input
                          id="wl-email"
                          type="email"
                          value={waitlistEmail}
                          onChange={e => setWaitlistEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50"
                          onKeyDown={e => e.key === "Enter" && handleWaitlist()}
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleWaitlist}
                      disabled={!waitlistEmail.trim() || waitlistSubmitting}
                      className="w-full bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl py-3.5 text-white text-[15px] font-bold shadow-[0_8px_32px_rgba(244,124,32,0.3)] transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#06080F] focus:ring-primary-500"
                    >
                      {waitlistSubmitting ? "Submitting..." : "Get Early Access →"}
                    </button>
                    {error && (
                      <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-red-400 text-[13px] text-center">
                        {error}
                      </div>
                    )}
                    <p className="text-white/25 text-xs text-center mt-3">
                      No spam — only your invite when it's ready.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right — WhatsApp mockup */}
            <div className="order-1 md:order-2 flex justify-center animate-float">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-7 max-w-[360px] w-full shadow-[0_40px_100px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-sm">
                {/* Chat header */}
                <div className="flex items-center gap-3 pb-4 mb-4 border-b border-white/10">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-xl shrink-0 shadow-[0_0_16px_rgba(37,211,102,0.3)]">🤖</div>
                  <div>
                    <div className="text-white font-semibold text-[14px]">TaskFlow Bot</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
                      <span className="text-[#25D366] text-xs">online</span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex flex-col gap-3">
                  {/* Bot: reminder */}
                  <div className="max-w-[88%] bg-white/5 rounded-[16px_16px_16px_4px] p-3.5">
                    <div className="text-white/90 text-[13px] leading-relaxed">
                      <span className="font-semibold">📋 Task Reminder</span><br />
                      Hey Rahul! You have a task due <span className="text-secondary-500 font-semibold">today</span>:
                    </div>
                    <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-2.5 mt-2.5">
                      <div className="text-white font-bold text-[13px]">🚀 Deploy API to staging</div>
                      <div className="text-white/45 text-[12px] mt-1">Project: MVP Sprint · Due today</div>
                    </div>
                    <div className="text-white/30 text-[11px] text-right mt-2">10:32 AM ✓✓</div>
                  </div>

                  {/* User: done */}
                  <div className="self-end max-w-[65%] bg-gradient-to-br from-primary-500/25 to-secondary-500/15 border border-primary-500/20 rounded-[16px_16px_4px_16px] p-3">
                    <div className="text-white text-[13px]">done! ✅</div>
                    <div className="text-white/30 text-[11px] text-right mt-1">10:34 AM ✓✓</div>
                  </div>

                  {/* Bot: confirmed */}
                  <div className="max-w-[85%] bg-green-500/10 border border-green-500/15 rounded-[16px_16px_16px_4px] p-3">
                    <div className="text-white/90 text-[13px]">
                      ✅ <strong>Deploy API to staging</strong> marked <span className="text-green-400">Done</span>. Dashboard updated!
                    </div>
                    <div className="text-white/30 text-[11px] text-right mt-1">10:34 AM</div>
                  </div>
                </div>

                {/* Input bar */}
                <div className="flex items-center gap-2.5 mt-4 pt-4 border-t border-white/10">
                  <div className="flex-1 bg-white/5 rounded-full px-3.5 py-2 text-white/20 text-[13px]">Reply to TaskFlow...</div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-sm">➤</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATS STRIP */}
        <div className="max-w-[1240px] mx-auto mb-20 px-6 md:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4 bg-white/5 border border-white/10 rounded-2xl overflow-hidden divide-x divide-y md:divide-y-0 divide-white/5">
            {[
              { icon: "💬", val: "WhatsApp", label: "Native delivery" },
              { icon: "🤖", val: "AI-parsed", label: "Natural language replies" },
              { icon: "⚡", val: "Real-time", label: "Dashboard sync" },
              { icon: "0️⃣", val: "Zero", label: "Extra apps needed" },
            ].map((s, i) => (
              <div key={i} className="p-6 text-center">
                <div className="text-[22px] mb-2">{s.icon}</div>
                <div className="text-white font-bold text-lg mb-1 tracking-tight">{s.val}</div>
                <div className="text-white/35 text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FEATURES */}
        <div className="max-w-[1240px] mx-auto mb-24 px-6 md:px-10">
          <div className="text-center mb-12">
            <h2 className="text-white text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              Everything your team needs
            </h2>
            <p className="text-white/40 text-base max-w-[480px] mx-auto">
              Built for managers tired of Slack threads, missed deadlines, and chasing status updates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: "💬", color: "text-[#25D366]", bg: "bg-[#25D366]/10", border: "border-[#25D366]/20", title: "WhatsApp Native", desc: "Tasks sent directly on WhatsApp. Your team already uses it. Reply 'done' — no new app, no friction." },
              { icon: "🤖", color: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20", title: "AI Reply Parsing", desc: "Natural language like 'task 2 done, 3 blocked by infra' gets parsed by AI and updates the dashboard instantly." },
              { icon: "📊", color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/20", title: "Live Dashboard", desc: "One view for all tasks, owners, deadlines, and blockers. Filter by project, person, or priority." },
              { icon: "🔔", color: "text-primary-500", bg: "bg-primary-500/10", border: "border-primary-500/20", title: "Smart Reminders", desc: "Emergency tasks reminded every 3 hrs. Low priority every 2 days. Auto-stops when marked done." },
              { icon: "🔗", color: "text-pink-400", bg: "bg-pink-400/10", border: "border-pink-400/20", title: "Magic Task Links", desc: "Every executor gets a private link to view and update their tasks directly — no login, no friction." },
              { icon: "🏢", color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20", title: "Multi-Org Ready", desc: "Run multiple teams from one account. Each org has its own members, projects and WhatsApp number." },
            ].map(f => (
              <div key={f.title} className="group bg-white/5 border border-white/10 rounded-2xl p-7 transition-all hover:bg-white/10 hover:border-white/15 hover:-translate-y-0.5">
                <div className={`w-12 h-12 rounded-xl ${f.bg} border ${f.border} flex items-center justify-center text-[22px] mb-5`}>
                  {f.icon}
                </div>
                <div className="text-white font-bold text-[15px] mb-2 tracking-tight">{f.title}</div>
                <div className="text-white/40 text-[13.5px] leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="max-w-[1240px] mx-auto mb-24 px-6 md:px-10">
          <div className="text-center mb-12">
            <h2 className="text-white text-3xl md:text-4xl font-extrabold tracking-tight mb-3">Up and running in minutes</h2>
            <p className="text-white/40 text-base">No complex setup. Your team needs zero onboarding.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { n: "01", icon: "✏️", title: "Create a task", desc: "Assign to a team member, set priority and deadline." },
              { n: "02", icon: "📱", title: "Bot notifies them", desc: "They get a clear WhatsApp message with task details." },
              { n: "03", icon: "💬", title: "They reply", desc: "'Done', 'blocked on X' — AI parses it and updates." },
              { n: "04", icon: "⚡", title: "You see it live", desc: "Dashboard reflects the change in real-time." },
            ].map((s, i) => (
              <div key={s.n} className="relative">
                {i < 3 && (
                  <div className="hidden lg:block absolute top-[32px] left-[calc(100%+4px)] right-[-16px] h-[1px] bg-gradient-to-r from-primary-500/40 to-transparent z-[2]" />
                )}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-7 h-full">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl w-9 h-9 flex items-center justify-center text-lg">
                      {s.icon}
                    </div>
                    <span className="text-primary-500 font-extrabold text-[12px] tracking-[1px] font-mono">{s.n}</span>
                  </div>
                  <div className="text-white font-bold text-[15px] mb-2 tracking-tight">{s.title}</div>
                  <div className="text-white/40 text-[13.5px] leading-relaxed">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM CTA */}
        <div className="max-w-[1240px] mx-auto mb-20 px-6 md:px-10">
          <div className="bg-gradient-to-br from-primary-500/10 to-secondary-500/5 border border-primary-500/15 rounded-3xl py-16 px-10 text-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(244,124,32,0.1)_0%,transparent_70%)] pointer-events-none" />
            <h2 className="text-white text-3xl md:text-[44px] leading-tight font-extrabold tracking-tight mb-4 relative">
              Ready to ship accountability?
            </h2>
            <p className="text-white/45 text-[17px] mb-8 relative max-w-lg mx-auto">
              Join the waitlist and be first to know when your invite is ready.
            </p>
            <button
              onClick={() => { document.getElementById("wl-email")?.focus(); document.getElementById("wl-email")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
              className="bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl px-10 py-4 text-white text-base font-bold shadow-[0_8px_40px_rgba(244,124,32,0.4)] relative hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/80"
            >
              Join the Waitlist →
            </button>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="border-t border-white/5 py-7 px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-4 max-w-[1240px] mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <svg width="14" height="14" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="text-white/30 text-[13px]">TaskFlow · Invite only</span>
          </div>
          <button
            onClick={() => setShowLogin(true)}
            aria-haspopup="dialog"
            className="text-primary-500/60 text-[13px] hover:text-primary-500/90 hover:underline transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/40 rounded p-1"
          >
            Have an invite? Sign in
          </button>
        </footer>
      </div>

      {/* SIGN-IN MODAL */}
      {showLogin && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-[16px] z-[100] flex items-center justify-center p-6 animate-fade-up"
          onClick={e => { if (e.target === e.currentTarget) { setShowLogin(false); setError(""); } }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-8 md:p-9 w-full max-w-[400px] shadow-[0_48px_120px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] transform transition-all">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-[0_0_20px_rgba(244,124,32,0.4)]">
                  <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <span className="text-white font-bold text-base">TaskFlow</span>
              </div>
              <button
                onClick={() => { setShowLogin(false); setError(""); }}
                aria-label="Close modal"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                ×
              </button>
            </div>

            <div className="mb-7">
              <h2 id="modal-title" className="text-white font-extrabold text-[22px] mb-2 tracking-tight">Welcome back</h2>
              <p className="text-white/40 text-sm leading-relaxed">
                Sign in with the Google account linked to your invite.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5 text-red-400 text-[13.5px] leading-relaxed">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 rounded-xl py-4 px-6 text-white text-[15px] font-semibold transition-all hover:bg-white/10 disabled:opacity-65 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/15 border-t-primary-500 rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {loading ? "Signing in..." : "Continue with Google"}
            </button>

            <p className="text-white/20 text-xs text-center mt-5">
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
