import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  color: z.string().optional(),
  projectVisibility: z.enum(["ALL", "TEAM_ONLY"]).optional(),
  taskVisibility: z.enum(["ALL", "OWN_ONLY"]).optional(),
  taskCreation: z.enum(["ANYONE", "TEAM_ONLY"]).optional(),
  memberContactIds: z.array(z.string()).optional(),
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

async function getAccessContext(orgId: string, userId: string, email?: string | null, phone?: string | null) {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!membership) return null;

  const isAdmin = ["OWNER", "ADMIN"].includes(membership.role);
  const contactFilters = [
    email ? { email } : null,
    phone ? { phone } : null,
  ].filter(Boolean) as any[];

  const myContacts = contactFilters.length
    ? await prisma.contact.findMany({
        where: { orgId, OR: contactFilters },
        select: { id: true },
      })
    : [];

  return {
    membership,
    isAdmin,
    myContactIds: myContacts.map((contact) => contact.id),
  };
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

  const access = await getAccessContext(
    orgId,
    session.user.id,
    session.user.email ?? null,
    null
  );
  if (!access) {
    return NextResponse.json({ error: "Org not found or no access" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: {
      orgId,
      status: { not: "ARCHIVED" },
      ...(access.isAdmin
        ? {}
        : {
            OR: [
              { projectVisibility: "ALL" },
              {
                projectVisibility: "TEAM_ONLY",
                ...(access.myContactIds.length ? { members: { some: { contactId: { in: access.myContactIds } } } } : { id: "__no_project__" }),
              },
            ],
          }),
    },
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

  const { memberContactIds, projectVisibility, taskVisibility, taskCreation, ...projectData } = parsed.data;

  const project = await prisma.project.create({
    data: {
      orgId,
      name: projectData.name,
      description: projectData.description,
      color: projectData.color ?? "#6366f1",
      projectVisibility: projectVisibility ?? "TEAM_ONLY",
      taskVisibility: taskVisibility ?? "ALL",
      taskCreation: taskCreation ?? "ANYONE",
      startDate: projectData.startDate ? new Date(projectData.startDate) : null,
      endDate: projectData.endDate ? new Date(projectData.endDate) : null,
      members: memberContactIds?.length
        ? { create: memberContactIds.map((contactId) => ({ contactId })) }
        : undefined,
    },
    include: { members: { include: { contact: true } } },
  });

  return NextResponse.json(project, { status: 201 });
}
