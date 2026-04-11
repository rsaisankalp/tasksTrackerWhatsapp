"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export default function OrgJoinClient({ org }: { org: OrgInfo }) {
  const router = useRouter();

  useEffect(() => {
    // Store slug so signin route can auto-add user to this org
    sessionStorage.setItem("pending-org-slug", org.slug);
  }, [org.slug]);

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #FFF5EC 0%, #FFFFFF 100%)" }}
    >
      <div
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, #F47C20, transparent)" }}
      />
      <div
        className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(circle, #FDB813, transparent)" }}
      />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl p-8 border border-white/50 text-center">
          {org.logoUrl ? (
            <img
              src={org.logoUrl}
              alt={org.name}
              className="w-16 h-16 rounded-2xl mx-auto mb-4 object-cover shadow"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white shadow"
              style={{ background: "linear-gradient(135deg, #F47C20, #FDB813)" }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900 mb-1">{org.name}</h1>
          <p className="text-gray-500 text-sm mb-8">
            Sign in with Google to join this workspace
          </p>

          <button
            onClick={() => router.push("/login")}
            className="w-full bg-white border border-gray-200 text-gray-800 font-semibold px-6 py-3.5 rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <p className="mt-4 text-xs text-gray-400">
            You&apos;ll be added as a member of <strong>{org.name}</strong> automatically
          </p>
        </div>
      </div>
    </div>
  );
}
