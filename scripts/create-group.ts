// Run with: DATABASE_URL=... npx tsx scripts/create-group.ts <orgId>
import { PrismaClient } from "@prisma/client";

const orgId = process.argv[2] || "cmnsrew6a000111ek3xifxgw2";

async function main() {
  const prisma = new PrismaClient();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { whatsappSession: true },
  });

  if (!org) {
    console.error("Org not found");
    process.exit(1);
  }

  console.log(`Org: ${org.name} (${org.slug})`);
  console.log(`WA: ${org.whatsappSession?.status} | ${org.whatsappSession?.phone}`);

  if (org.waGroupJid) {
    console.log(`Group already exists: ${org.waGroupJid}`);
    await prisma.$disconnect();
    return;
  }

  // Call the internal API (server must be running)
  const APP_URL = process.env.APP_URL || "http://localhost:3000";
  const SECRET = process.env.INTERNAL_WEBHOOK_SECRET || "local-dev-webhook-secret";

  // Use internal trigger approach — create group via a helper endpoint
  const res = await fetch(`${APP_URL}/api/whatsapp/group/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": SECRET,
    },
    body: JSON.stringify({ orgId }),
  });

  const data = await res.json();
  console.log("Result:", JSON.stringify(data, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
