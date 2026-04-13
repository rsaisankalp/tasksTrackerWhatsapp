import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

const CreateContactSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  role: z.string().optional(),
  department: z.string().optional(),
  trustLevel: z.enum(["INTERNAL", "TRUSTED", "EXTERNAL"]).default("INTERNAL"),
  avatarUrl: z.string().optional(),
  orgId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const orgId = searchParams.get("orgId");
  const search = searchParams.get("search") ?? "";

  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const [membership, org] = await Promise.all([
    prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId: session.user.id } } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { type: true } }),
  ]);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // GENERAL orgs: each user only sees their own contacts
  const isGeneral = org?.type === "GENERAL";

  const contacts = await prisma.contact.findMany({
    where: {
      orgId,
      ...(isGeneral ? { createdByUserId: session.user.id } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { email: { contains: search, mode: "insensitive" } },
              { department: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { assignedTasks: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgId: bodyOrgId, ...contactData } = parsed.data;
  const orgId = req.nextUrl.searchParams.get("orgId") || bodyOrgId;

  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgForCreate = await prisma.organization.findUnique({ where: { id: orgId }, select: { type: true } });
  const contact = await prisma.contact.create({
    data: {
      orgId,
      name: contactData.name,
      phone: contactData.phone ? normalizePhone(contactData.phone) : null,
      email: contactData.email || null,
      role: contactData.role || null,
      department: contactData.department || null,
      trustLevel: contactData.trustLevel,
      avatarUrl: contactData.avatarUrl || null,
      // For GENERAL orgs, track which user created this contact
      createdByUserId: orgForCreate?.type === "GENERAL" ? session.user.id : null,
    },
  });

  return NextResponse.json(contact, { status: 201 });
}
