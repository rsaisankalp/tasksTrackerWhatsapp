import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS, SessionData } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Refresh the session to pick up new org membership (POST or GET)
export async function GET(req: NextRequest) {
  const redirectTo = req.nextUrl.searchParams.get("redirect") ?? "/dashboard";
  const cookieStore = cookies();
  const session = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
  if (!session.userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.userId },
    include: { org: true },
    orderBy: { joinedAt: "asc" },
  });

  if (membership) {
    session.orgId = membership.orgId;
    session.orgSlug = membership.org.slug;
    session.orgRole = membership.role;
    await session.save();
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const session = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.userId },
    include: { org: true },
    orderBy: { joinedAt: "asc" },
  });

  if (membership) {
    session.orgId = membership.orgId;
    session.orgSlug = membership.org.slug;
    session.orgRole = membership.role;
    await session.save();
  }

  return NextResponse.json({ success: true, orgId: membership?.orgId });
}
