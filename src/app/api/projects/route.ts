import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  color: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

async function getOrgId(req: NextRequest, userId: string): Promise<string | null> {
  const orgId =
    req.nextUrl.searchParams.get("orgId") ||
    req.headers.get("x-org-id");
  if (!orgId) return null;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  return membership ? orgId : null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await getOrgId(req, session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: "Org not found or no access" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: { orgId, status: { not: "ARCHIVED" } },
    include: {
      _count: {
        select: {
          tasks: { where: { parentId: null } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await getOrgId(req, session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: "Org not found or no access" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      orgId,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color ?? "#6366f1",
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
