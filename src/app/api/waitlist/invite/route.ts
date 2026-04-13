import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

function isPlatformAdmin(email: string): boolean {
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(email.toLowerCase());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformAdmin(session.user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const {
    ids,
    orgId,
    maxUses = 1,
    expiresInDays = 14,
    sendEmail = true,
  } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0 || !orgId) {
    return NextResponse.json({ error: "ids and orgId are required" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const entries = await prisma.waitlistEntry.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "desc" },
  });

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  let transporter: any = null;

  if (sendEmail && smtpUser && smtpPass) {
    try {
      const dynamicImport = new Function(
        "specifier",
        "return import(specifier)"
      ) as (specifier: string) => Promise<any>;
      const nodemailer = await dynamicImport("nodemailer");
      transporter = nodemailer.default.createTransport({
        service: "gmail",
        auth: { user: smtpUser, pass: smtpPass },
      });
    } catch (error) {
      console.error("[Waitlist Invite] Failed to initialize email transport:", error);
    }
  }

  const results: Array<{
    id: string;
    email: string;
    inviteUrl: string;
    emailed: boolean;
  }> = [];

  for (const entry of entries) {
    const code = nanoid(8).toUpperCase();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await prisma.inviteCode.create({
      data: {
        code,
        orgId,
        createdById: session.user.id,
        maxUses,
        expiresAt,
      },
    });

    const inviteUrl = `${process.env.APP_URL ?? "https://tasks.vaidicpujas.in"}/invite/${code}`;
    let emailed = false;

    if (transporter && entry.email) {
      try {
        await transporter.sendMail({
          from: smtpUser,
          to: entry.email,
          subject: `You’re invited to ${org.name} on TaskFlow`,
          text: `Hi ${entry.name || "there"},\n\nYou’re invited to join ${org.name} on TaskFlow.\n\nAccept your invite here:\n${inviteUrl}\n\nThis link ${expiresAt ? `expires on ${expiresAt.toDateString()}` : "does not expire"} and can be used ${maxUses} time${maxUses === 1 ? "" : "s"}.\n`,
        });
        emailed = true;
      } catch (error) {
        console.error(`[Waitlist Invite] Failed to email ${entry.email}:`, error);
      }
    }

    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: {
        invitedAt: new Date(),
        invitedOrgId: orgId,
        inviteCode: code,
      },
    });

    results.push({
      id: entry.id,
      email: entry.email,
      inviteUrl,
      emailed,
    });
  }

  return NextResponse.json({ results });
}
