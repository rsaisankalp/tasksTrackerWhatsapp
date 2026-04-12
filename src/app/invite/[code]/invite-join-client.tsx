"use client";

import { signInWithPopup } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface InviteJoinClientProps {
  org: { id: string; name: string; slug: string; logoUrl: string | null };
  inviteCode: string;
  seatsLeft: number;
}

export default function InviteJoinClient({ org, inviteCode, seatsLeft }: InviteJoinClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("Sign-in failed");

      // After signing in, navigate to invite page which will complete the join on the server
      router.replace(`/invite/${inviteCode}`);
    } catch (e: any) {
      setError(e?.message ?? "Sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: "linear-gradient(135deg, #FFF5EC 0%, #FFFFFF 100%)" }}>
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(circle, #F47C20, transparent)" }} />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ background: "radial-gradient(circle, #FDB813, transparent)" }} />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg" style={{ background: "linear-gradient(135deg, #F47C20, #FDB813)" }}>
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>TaskFlow</h1>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl p-8 border border-white/50">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500 mb-1">You&apos;ve been invited to join</p>
            <h2 className="text-2xl font-bold text-gray-900">{org.name}</h2>
            <p className="text-xs text-gray-400 mt-1">{seatsLeft} seat{seatsLeft !== 1 ? "s" : ""} remaining</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white font-semibold px-6 py-3.5 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed border border-gray-100"
            style={{ color: "#1A1A1A" }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#F47C20", borderTopColor: "transparent" }} />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {loading ? "Joining..." : "Join with Google"}
          </button>

          <p className="mt-4 text-center text-xs" style={{ color: "#999" }}>
            By joining, you agree to our terms of service
          </p>
        </div>
      </div>
    </div>
  );
}
