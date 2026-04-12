import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
});

// Emails allowed to create new organizations (comma-separated in env)
function isPlatformAdmin(email: string): boolean {
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(email.toLowerCase());
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.orgMember.findMany({
    where: { userId: session.user.id },
    include: {
      org: {
        include: {
          _count: { select: { members: true, projects: true, tasks: true } },
          whatsappSession: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json(memberships.map((m) => ({ ...m.org, role: m.role })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only platform admins can create organizations
  if (!isPlatformAdmin(session.user.email ?? "")) {
    return NextResponse.json(
      { error: "Only platform admins can create organizations" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = CreateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, slug } = parsed.data;

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
  }

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      ownerId: session.user.id,
      members: {
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
      projects: {
        create: {
          name: "General",
          color: "#6366f1",
          status: "ACTIVE",
        },
      },
    },
  });

  return NextResponse.json(org, { status: 201 });
}
