import { createServer } from "http";
import next from "next";
import { baileysManager } from "./src/lib/whatsapp/manager";
import { startReminderScheduler } from "./src/lib/reminders/scheduler";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(async () => {
  // 1. Restore WhatsApp sessions for all previously connected orgs
  console.log("[Server] Restoring WhatsApp sessions...");
  try {
    await baileysManager.restoreAllSessions();
  } catch (e) {
    console.error("[Server] Error restoring WA sessions:", e);
  }

  // 2. Start the reminder scheduler
  startReminderScheduler();

  // 3. Start HTTP server
  const httpServer = createServer((req, res) => {
    handler(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`\n> TaskFlow ready on http://${hostname}:${port}`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });
});
