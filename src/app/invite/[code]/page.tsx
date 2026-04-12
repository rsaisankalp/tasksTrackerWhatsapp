import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import InviteJoinClient from "./invite-join-client";

interface Props {
  params: { code: string };
}

export default async function InvitePage({ params }: Props) {
  const { code } = params;

  const invite = await prisma.inviteCode.findUnique({
    where: { code },
    include: { org: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });

  if (!invite) notFound();

  // Check expiry
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FFF5EC 0%, #FFFFFF 100%)" }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm text-center">
          <div className="text-4xl mb-3">⏰</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invite Expired</h2>
          <p className="text-gray-500 text-sm">This invite link has expired. Ask your admin for a new one.</p>
        </div>
      </div>
    );
  }

  // Check max uses
  if (invite.usedCount >= invite.maxUses) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FFF5EC 0%, #FFFFFF 100%)" }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm text-center">
          <div className="text-4xl mb-3">🚫</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invite Full</h2>
          <p className="text-gray-500 text-sm">This invite has reached its maximum uses. Ask your admin to generate a new one.</p>
        </div>
      </div>
    );
  }

  const session = await auth();

  if (session?.user?.id) {
    // Check if already a member
    const existing = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: invite.org.id, userId: session.user.id } },
    });

    if (!existing) {
      await prisma.$transaction([
        prisma.orgMember.create({
          data: { orgId: invite.org.id, userId: session.user.id, role: "MEMBER" },
        }),
        prisma.inviteCode.update({
          where: { id: invite.id },
          data: { usedCount: { increment: 1 } },
        }),
      ]);
    }

    redirect(`/api/auth/refresh?redirect=/dashboard`);
  }

  return (
    <InviteJoinClient
      org={invite.org}
      inviteCode={code}
      seatsLeft={invite.maxUses - invite.usedCount}
    />
  );
}
