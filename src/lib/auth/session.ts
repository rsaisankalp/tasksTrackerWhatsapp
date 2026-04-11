import { SessionOptions } from "iron-session";

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  image?: string;
  orgId?: string;
  orgSlug?: string;
  orgRole?: string;
}

export const SESSION_OPTIONS: SessionOptions = {
  password: process.env.AUTH_SECRET || "taskflow-default-secret-change-in-prod!!",
  cookieName: "taskflow-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};
