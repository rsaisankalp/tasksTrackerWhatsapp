"use client";

import { useState, useEffect } from "react";

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string;
    orgId?: string;
    orgSlug?: string;
    orgRole?: string;
  };
}

export function useAuth() {
  const [data, setData] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((session) => {
        if (session?.user?.id) {
          setData(session);
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
        }
      })
      .catch(() => setStatus("unauthenticated"));
  }, []);

  return { data, status };
}
