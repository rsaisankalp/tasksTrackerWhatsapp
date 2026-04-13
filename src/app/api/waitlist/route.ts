import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "rsaisankalp@gmail.com";

function isPlatformAdmin(email: string): boolean {
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(email.toLowerCase());
}

function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export async function POST(req: NextRequest) {
  const { name, email, phone } = await req.json();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedPhone = typeof phone === "string" && phone.trim() ? normalizePhone(phone.trim()) : null;

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    await (prisma as any).waitlistEntry.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, name: normalizedName || null, phone: normalizedPhone },
      update: {
        name: normalizedName || undefined,
        phone: normalizedPhone ?? undefined,
      },
    });
  } catch (error) {
    console.error("[Waitlist] Failed to save entry:", error);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }

  // Optional email notification if SMTP and nodemailer are available.
  try {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
      const dynamicImport = new Function(
        "specifier",
        "return import(specifier)"
      ) as (specifier: string) => Promise<any>;
      const nodemailer = await dynamicImport("nodemailer");
      const transporter = nodemailer.default.createTransport({
        service: "gmail",
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: smtpUser,
        to: ADMIN_EMAIL,
        subject: `TaskFlow Waitlist: ${normalizedName || normalizedEmail}`,
        text: `New waitlist signup:\n\nName: ${normalizedName || "—"}\nEmail: ${normalizedEmail}\nPhone: ${normalizedPhone || "—"}\n\nVisit https://tasks.vaidicpujas.in to manage.`,
      });
    }
  } catch (e) {
    console.error("[Waitlist] Email notification failed:", e);
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isPlatformAdmin(session.user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await (prisma as any).waitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(entries);
}
