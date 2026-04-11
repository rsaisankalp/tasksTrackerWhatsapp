import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS, SessionData } from "@/lib/auth/session";

export async function auth() {
  const cookieStore = cookies();
  const session = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
  if (!session.userId) return null;
  return {
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      image: session.image,
      orgId: session.orgId,
      orgSlug: session.orgSlug,
      orgRole: session.orgRole,
    },
  };
}
