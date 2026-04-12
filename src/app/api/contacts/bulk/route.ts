import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Normalize phone: if 10 digits only, prepend +91; strip spaces/dashes
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return "";
  // Already has country code
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  // 10-digit number → India
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  // Otherwise store as-is with +
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows: Array<{
    name: string;
    phone?: string;
    email?: string;
    role?: string;
    department?: string;
    trustLevel?: string;
  }> = body.contacts;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "contacts array required" }, { status: 400 });
  }

  const results: { success: number; failed: number; errors: string[] } = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name?.trim()) {
      results.failed++;
      results.errors.push(`Row ${i + 1}: name is required`);
      continue;
    }

    try {
      const phone = row.phone ? normalizePhone(row.phone) : null;
      const trustLevel =
        ["INTERNAL", "TRUSTED", "EXTERNAL"].includes(
          (row.trustLevel ?? "").toUpperCase()
        )
          ? (row.trustLevel!.toUpperCase() as "INTERNAL" | "TRUSTED" | "EXTERNAL")
          : "INTERNAL";

      await prisma.contact.create({
        data: {
          orgId,
          name: row.name.trim(),
          phone: phone || null,
          email: row.email?.trim() || null,
          role: row.role?.trim() || null,
          department: row.department?.trim() || null,
          trustLevel,
        },
      });
      results.success++;
    } catch (e: any) {
      results.failed++;
      results.errors.push(`Row ${i + 1} (${row.name}): ${e.message}`);
    }
  }

  return NextResponse.json(results, { status: 201 });
}
