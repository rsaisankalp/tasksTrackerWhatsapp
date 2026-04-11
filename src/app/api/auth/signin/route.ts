import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS, SessionData } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const FIREBASE_API_KEY = "AIzaSyBIU_ZOSwaWcX3H822OvrVv67D5ToJ3hrE";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { idToken, orgSlug: requestedOrgSlug } = body;
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  // Verify token with Firebase REST API
  const verifyRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!verifyRes.ok) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const verifyData = await verifyRes.json();
  const firebaseUser = verifyData.users?.[0];
  if (!firebaseUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const { localId: firebaseUid, email, displayName, photoUrl } = firebaseUser;

  // Upsert user in DB
  const user = await prisma.user.upsert({
    where: { email: email ?? `${firebaseUid}@firebase.local` },
    create: {
      email: email ?? `${firebaseUid}@firebase.local`,
      name: displayName ?? email ?? "User",
      image: photoUrl ?? null,
    },
    update: {
      name: displayName ?? undefined,
      image: photoUrl ?? undefined,
    },
  });

  // Auto-join org logic:
  // 1. URL-based: orgSlug from request body (set by /{orgSlug} landing page) — takes priority
  // 2. Email domain: match user's email domain against org.emailDomains
  let targetOrg: { id: string; slug: string } | null = null;

  if (requestedOrgSlug) {
    // URL-based: find org by slug and auto-add user
    const org = await prisma.organization.findUnique({
      where: { slug: requestedOrgSlug },
      select: { id: true, slug: true },
    });
    if (org) targetOrg = org;
  }

  if (!targetOrg && email) {
    // Email domain: find org that claims this domain
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain) {
      const org = await prisma.organization.findFirst({
        where: { emailDomains: { has: domain } },
        select: { id: true, slug: true },
      });
      if (org) targetOrg = org;
    }
  }

  // If a target org was found, ensure user is a member
  if (targetOrg) {
    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: targetOrg.id, userId: user.id } },
      create: { orgId: targetOrg.id, userId: user.id, role: "MEMBER" },
      update: {},
    });
  }

  // Find first org membership
  const membership = await prisma.orgMember.findFirst({
    where: { userId: user.id },
    include: { org: true },
    orderBy: { joinedAt: "asc" },
  });

  // Set session
  const cookieStore = cookies();
  const session = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
  session.userId = user.id;
  session.email = user.email ?? "";
  session.name = user.name ?? "";
  session.image = user.image ?? undefined;
  session.orgId = membership?.orgId;
  session.orgSlug = membership?.org.slug;
  session.orgRole = membership?.role;
  await session.save();

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    orgId: membership?.orgId,
    orgSlug: membership?.org.slug,
  });
}
