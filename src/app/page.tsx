import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function RootPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check if user has an org
  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
