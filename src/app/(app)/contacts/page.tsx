import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ContactsClient from "./contacts-client";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { orgId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgId =
    searchParams.orgId ||
    (await prisma.orgMember.findFirst({ where: { userId: session.user.id } }))?.orgId;

  if (!orgId) redirect("/onboarding");

  const contacts = await prisma.contact.findMany({
    where: { orgId },
    include: { _count: { select: { assignedTasks: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <ContactsClient
      orgId={orgId}
      initialContacts={contacts.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))}
    />
  );
}
