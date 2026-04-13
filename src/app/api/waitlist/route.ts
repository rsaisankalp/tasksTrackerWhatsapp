import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "rsaisankalp@gmail.com";

export async function POST(req: NextRequest) {
  const { name, email } = await req.json();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedName = typeof name === "string" ? name.trim() : "";

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    await (prisma as any).waitlistEntry.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, name: normalizedName || null },
      update: {},
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
        text: `New waitlist signup:\n\nName: ${normalizedName || "—"}\nEmail: ${normalizedEmail}\n\nVisit https://tasks.vaidicpujas.in to manage.`,
      });
    }
  } catch (e) {
    console.error("[Waitlist] Email notification failed:", e);
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  // Platform admin can view waitlist entries
  const entries = await (prisma as any).waitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(entries);
}
