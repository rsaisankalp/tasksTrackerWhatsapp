import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  MessageUpsertType,
  proto,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} from "@whiskeysockets/baileys";
import { EventEmitter } from "events";
import * as path from "path";
import * as fs from "fs";
import { prisma } from "@/lib/prisma";

const SESSIONS_PATH = process.env.WA_SESSIONS_PATH || "./.wa-sessions";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const WEBHOOK_SECRET = process.env.INTERNAL_WEBHOOK_SECRET || "dev-secret";

interface WASession {
  socket: WASocket;
  status: "connecting" | "qr_pending" | "connected" | "disconnected";
}

export class BaileysManager extends EventEmitter {
  private sessions = new Map<string, WASession>();

  getSessionPath(orgId: string): string {
    const dir = path.join(process.cwd(), SESSIONS_PATH, orgId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async startSession(orgId: string): Promise<void> {
    // If already connected, skip
    const existing = this.sessions.get(orgId);
    if (existing?.status === "connected") return;

    // If already connecting/qr_pending, force re-emit latest QR if available
    // so newly-opened settings page gets the QR immediately
    if (existing?.status === "connecting" || existing?.status === "qr_pending") {
      // Force a new QR by restarting the socket so the page gets a fresh one
      try { existing.socket.end(undefined); } catch {}
      this.sessions.delete(orgId);
    }

    await this.createSocket(orgId);
  }

  private async createSocket(orgId: string): Promise<void> {
    const sessionPath = this.getSessionPath(orgId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, console as any),
      },
      browser: Browsers.ubuntu("TaskFlow"),
      printQRInTerminal: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    const session: WASession = { socket, status: "connecting" };
    this.sessions.set(orgId, session);

    // Update DB status
    await this.updateDbStatus(orgId, "CONNECTING");

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.status = "qr_pending";
        await this.updateDbStatus(orgId, "QR_PENDING");
        this.emit(`qr:${orgId}`, qr);
      }

      if (connection === "open") {
        session.status = "connected";
        const phone = socket.user?.id?.split(":")[0] ?? null;
        await this.updateDbStatus(orgId, "CONNECTED", phone);
        this.emit(`connected:${orgId}`, phone);
        console.log(`[WA] Org ${orgId} connected as ${phone}`);
      }

      if (connection === "close") {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;

        session.status = "disconnected";
        await this.updateDbStatus(orgId, "DISCONNECTED");
        this.emit(`disconnected:${orgId}`, code);
        this.sessions.delete(orgId);

        if (shouldReconnect) {
          console.log(`[WA] Org ${orgId} reconnecting (code ${code})...`);
          setTimeout(() => this.createSocket(orgId), 5000);
        } else {
          console.log(`[WA] Org ${orgId} logged out, clearing session`);
          this.clearSessionFiles(orgId);
        }
      }
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        await this.handleInboundMessage(orgId, msg);
      }
    });
  }

  private async handleInboundMessage(orgId: string, msg: proto.IWebMessageInfo) {
    try {
      const from = msg.key.remoteJid ?? "";
      const messageId = msg.key.id ?? "";
      const body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";

      if (!body || !from) return;

      // Call internal webhook endpoint
      await fetch(`${APP_URL}/api/webhooks/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          orgId,
          from,
          messageId,
          body,
          quotedMessageId:
            msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? null,
        }),
      });
    } catch (e) {
      console.error("[WA] Error forwarding inbound message:", e);
    }
  }

  async sendMessage(orgId: string, jid: string, text: string): Promise<string | null> {
    const session = this.sessions.get(orgId);
    if (!session || session.status !== "connected") {
      throw new Error(`WhatsApp not connected for org ${orgId}`);
    }

    // Ensure JID format
    const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
    const result = await session.socket.sendMessage(formattedJid, { text });
    return result?.key?.id ?? null;
  }

  async createGroup(orgId: string, groupName: string, participantJids: string[]): Promise<string> {
    const session = this.sessions.get(orgId);
    if (!session || session.status !== "connected") {
      throw new Error(`WhatsApp not connected for org ${orgId}`);
    }
    const result = await session.socket.groupCreate(groupName, participantJids);
    return result.id;
  }

  async getGroupInviteLink(orgId: string, groupJid: string): Promise<string> {
    const session = this.sessions.get(orgId);
    if (!session || session.status !== "connected") {
      throw new Error(`WhatsApp not connected for org ${orgId}`);
    }
    const code = await session.socket.groupInviteCode(groupJid);
    return `https://chat.whatsapp.com/${code}`;
  }

  async disconnect(orgId: string): Promise<void> {
    const session = this.sessions.get(orgId);
    if (session) {
      await session.socket.logout();
      this.sessions.delete(orgId);
    }
    this.clearSessionFiles(orgId);
    await this.updateDbStatus(orgId, "DISCONNECTED");
  }

  clearSessionFiles(orgId: string): void {
    const dir = path.join(process.cwd(), SESSIONS_PATH, orgId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  async restoreAllSessions(): Promise<void> {
    // Restore any org that has saved session files on disk (most reliable)
    const sessionsDir = path.join(process.cwd(), SESSIONS_PATH);
    let orgsWithFiles: string[] = [];
    if (fs.existsSync(sessionsDir)) {
      orgsWithFiles = fs.readdirSync(sessionsDir).filter((name) => {
        const dir = path.join(sessionsDir, name);
        // Only restore if there are actual credential files
        return fs.statSync(dir).isDirectory() && fs.readdirSync(dir).length > 0;
      });
    }

    // Also restore any that DB says are connected (in case files are on another mount)
    const dbConnected = await prisma.whatsAppSession.findMany({
      where: { status: { in: ["CONNECTED", "CONNECTING"] } },
      select: { orgId: true },
    });
    const dbOrgIds = dbConnected.map((s) => s.orgId);

    const allOrgIds = [...new Set([...orgsWithFiles, ...dbOrgIds])];

    for (const orgId of allOrgIds) {
      console.log(`[WA] Restoring session for org ${orgId}`);
      try {
        await this.startSession(orgId);
      } catch (e) {
        console.error(`[WA] Failed to restore session for org ${orgId}:`, e);
      }
    }
  }

  getStatus(orgId: string): string {
    return this.sessions.get(orgId)?.status ?? "disconnected";
  }

  private async updateDbStatus(
    orgId: string,
    status: "DISCONNECTED" | "CONNECTING" | "QR_PENDING" | "CONNECTED",
    phone?: string | null
  ) {
    await prisma.whatsAppSession.upsert({
      where: { orgId },
      create: { orgId, status, phone: phone ?? null },
      update: { status, ...(phone !== undefined ? { phone } : {}) },
    });
  }
}

// Singleton shared across Next.js route bundles and server.ts via global
declare global {
  var __baileysManager: BaileysManager | undefined;
}

export const baileysManager: BaileysManager =
  global.__baileysManager ?? new BaileysManager();

// Always register on global so webpack-bundled route handlers share the same instance
global.__baileysManager = baileysManager;
