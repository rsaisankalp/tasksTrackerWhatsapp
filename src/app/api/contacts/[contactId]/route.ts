import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getContact(contactId: string, userId: string) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { org: { include: { members: { where: { userId } } } } },
  });
  if (!contact || contact.org.members.length === 0) return null;
  return contact;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { contactId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contact = await getContact(params.contactId, session.user.id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(contact);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { contactId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contact = await getContact(params.contactId, session.user.id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.contact.update({
    where: { id: params.contactId },
    data: {
      name: body.name,
      phone: body.phone,
      email: body.email || null,
      role: body.role,
      department: body.department,
      trustLevel: body.trustLevel,
      avatarUrl: body.avatarUrl,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { contactId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contact = await getContact(params.contactId, session.user.id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contact.delete({ where: { id: params.contactId } });
  return NextResponse.json({ success: true });
}
