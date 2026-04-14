import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  MessageUpsertType,
  proto,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";
import { EventEmitter } from "events";
import * as path from "path";
import * as fs from "fs";
import { prisma } from "@/lib/prisma";

const SESSIONS_PATH = process.env.WA_SESSIONS_PATH || "./.wa-sessions";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
// Always call webhook via localhost to avoid going through external proxy
const WEBHOOK_URL = "http://localhost:3000";
const WEBHOOK_SECRET = process.env.INTERNAL_WEBHOOK_SECRET || "dev-secret";

interface WASession {
  socket: WASocket;
  status: "connecting" | "qr_pending" | "connected" | "disconnected";
  // Track message IDs sent by the bot so we don't process our own group replies
  sentGroupMessageIds: Set<string>;
  // Map LID JID → phone JID (e.g. "218304664838270@lid" → "919620515656@s.whatsapp.net")
  lidToPhone: Map<string, string>;
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
        keys: state.keys,
      },
      browser: Browsers.ubuntu("TaskFlow"),
      printQRInTerminal: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      // Required for group message decryption retries
      getMessage: async () => ({ conversation: "" }),
    });

    const session: WASession = { socket, status: "connecting", sentGroupMessageIds: new Set(), lidToPhone: new Map() };
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
        // Pre-populate LID mappings for all executor contacts
        this.populateLidMappings(orgId, session).catch(console.error);
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

    // Build LID → phone map from contact sync events
    const updateLidMap = (contacts: Partial<{ id: string; lid?: string; jid?: string }>[]) => {
      for (const contact of contacts) {
        const lid = contact.lid ?? (contact.id?.endsWith("@lid") ? contact.id : null);
        const phone = contact.jid ?? (!contact.id?.endsWith("@lid") ? contact.id : null);
        if (lid && phone) {
          session.lidToPhone.set(lid, phone);
          console.log(`[WA] LID mapping: ${lid} → ${phone}`);
        }
      }
    };
    socket.ev.on("contacts.upsert", updateLidMap);
    socket.ev.on("contacts.update", updateLidMap);

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        const isGroupMsg = msg.key.remoteJid?.endsWith("@g.us") ?? false;

        console.log(`[WA] msg.upsert jid=${msg.key.remoteJid} fromMe=${msg.key.fromMe} isGroup=${isGroupMsg} id=${msg.key.id} msgKeys=${Object.keys(msg.message || {}).join(',')}`);

        // For group messages: skip only bot-sent replies (tracked by ID), not all fromMe
        // This allows the org admin (who IS the bot number) to query the group
        if (msg.key.fromMe) {
          if (!isGroupMsg) continue; // Always skip fromMe in DMs
          if (session.sentGroupMessageIds.has(msg.key.id ?? "")) continue; // Skip bot's own replies
          // Otherwise: admin typed a command in the group — process it
        }

        // Skip messages with no content (failed decryption etc.)
        const body =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.ephemeralMessage?.message?.conversation ||
          "";
        console.log(`[WA] Processing body="${body}" from=${msg.key.remoteJid}`);
        if (!body) continue;

        await this.handleInboundMessage(orgId, msg);
      }
    });
  }

  private async handleInboundMessage(orgId: string, msg: proto.IWebMessageInfo) {
    try {
      const rawFrom = msg.key.remoteJid ?? "";
      const session = this.sessions.get(orgId);
      // Resolve LID to real phone JID if we have a mapping
      const from = (rawFrom.endsWith("@lid") && session?.lidToPhone.get(rawFrom))
        ? session.lidToPhone.get(rawFrom)!
        : rawFrom;
      const messageId = msg.key.id ?? "";
      const body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.ephemeralMessage?.message?.conversation ||
        "";

      if (!body || !from) return;

      // Call internal webhook endpoint
      const quotedBody =
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
        null;

      await fetch(`${WEBHOOK_URL}/api/webhooks/whatsapp`, {
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
          quotedBody: quotedBody ?? null,
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

    // For group messages, pre-fetch metadata then retry on first key-exchange failure
    if (formattedJid.endsWith("@g.us")) {
      // Pre-fetch group metadata to warm up state
      let groupMeta: any = null;
      try { groupMeta = await session.socket.groupMetadata(formattedJid); } catch {}

      const sendToGroup = async () => {
        console.log(`[WA] Sending to group ${formattedJid}...`);
        const result = await session.socket.sendMessage(formattedJid, { text });
        console.log(`[WA] Group send result: msgId=${result?.key?.id}`);
        const msgId = result?.key?.id;
        // Track this ID so we don't re-process the bot's own group messages
        if (msgId) {
          session.sentGroupMessageIds.add(msgId);
          // Prune old IDs after 1000 entries to avoid memory leak
          if (session.sentGroupMessageIds.size > 1000) {
            const oldest = session.sentGroupMessageIds.values().next().value as string;
            session.sentGroupMessageIds.delete(oldest);
          }
        }
        return msgId ?? null;
      };

      try {
        return await sendToGroup();
      } catch (e: any) {
        console.error(`[WA] Group send error (org ${orgId}, group ${formattedJid}):`, e?.message, e?.output?.statusCode);

        // Clear stale sender-key state so Baileys regenerates it on retry
        this.clearGroupSenderKeyFiles(orgId, formattedJid);

        // Force re-establish Signal sessions for all participants
        if (groupMeta?.participants) {
          const participantJids = groupMeta.participants.map((p: any) => p.id);
          try {
            await (session.socket as any).assertSessions(participantJids, true);
          } catch {}
        }

        await new Promise(r => setTimeout(r, 3000));
        return await sendToGroup();
      }
    }

    const result = await session.socket.sendMessage(formattedJid, { text });
    return result?.key?.id ?? null;
  }

  async sendUserMessage(userId: string, jid: string, text: string): Promise<string | null> {
    const session = this.sessions.get(`user:${userId}`);
    if (!session || session.status !== "connected") {
      throw new Error(`WhatsApp not connected for user ${userId}`);
    }

    const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
    const result = await session.socket.sendMessage(formattedJid, { text });
    return result?.key?.id ?? null;
  }

  private async populateLidMappings(orgId: string, session: WASession): Promise<void> {
    try {
      // Fetch all executor contact phones for this org
      const contacts = await prisma.contact.findMany({
        where: { orgId, phone: { not: null } },
        select: { phone: true },
      });
      const phones = contacts.map((c) => c.phone!).filter(Boolean);
      if (phones.length === 0) return;

      // Build JIDs from phone numbers
      const jids = phones.map((p) => {
        const digits = p.replace(/\D/g, "");
        return `${digits}@s.whatsapp.net`;
      });

      const results = await (session.socket as any).onWhatsApp(...jids);
      if (!results) return;
      for (const r of results) {
        if (r.jid && r.lid) {
          session.lidToPhone.set(r.lid, r.jid);
          console.log(`[WA] Pre-populated LID mapping: ${r.lid} → ${r.jid}`);
        }
      }
    } catch (e) {
      console.error("[WA] Error populating LID mappings:", e);
    }
  }

  private async populateUserLidMappings(userId: string, session: WASession): Promise<void> {
    try {
      const memberships = await prisma.orgMember.findMany({
        where: { userId },
        select: { orgId: true },
      });
      const orgIds = memberships.map((membership) => membership.orgId);
      if (orgIds.length === 0) return;

      const contacts = await prisma.contact.findMany({
        where: {
          orgId: { in: orgIds },
          phone: { not: null },
        },
        select: { phone: true },
      });
      const phones = [...new Set(contacts.map((contact) => contact.phone!).filter(Boolean))];
      if (phones.length === 0) return;

      const jids = phones.map((phone) => `${phone.replace(/\D/g, "")}@s.whatsapp.net`);
      const results = await (session.socket as any).onWhatsApp(...jids);
      if (!results) return;

      for (const result of results) {
        if (result.jid && result.lid) {
          session.lidToPhone.set(result.lid, result.jid);
          console.log(`[WA] User LID mapping: ${result.lid} → ${result.jid}`);
        }
      }
    } catch (e) {
      console.error(`[WA] Error populating user LID mappings for ${userId}:`, e);
    }
  }

  private clearGroupSenderKeyFiles(orgId: string, groupJid: string): void {
    const sessionPath = this.getSessionPath(orgId);
    const groupIdPart = groupJid.split("@")[0]; // e.g. "120363425378016060"
    try {
      const files = fs.readdirSync(sessionPath);
      for (const file of files) {
        if (
          (file.startsWith("sender-key") && file.includes(groupIdPart)) ||
          (file.startsWith("sender-key-memory") && file.includes(groupIdPart))
        ) {
          fs.unlinkSync(path.join(sessionPath, file));
          console.log(`[WA] Cleared stale key file: ${file}`);
        }
      }
    } catch (err) {
      console.error("[WA] Error clearing sender key files:", err);
    }
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
    let usersWithFiles: string[] = [];
    if (fs.existsSync(sessionsDir)) {
      const entries = fs.readdirSync(sessionsDir).filter((name) => {
        const dir = path.join(sessionsDir, name);
        return fs.statSync(dir).isDirectory() && fs.readdirSync(dir).length > 0;
      });
      orgsWithFiles = entries.filter((name) => !name.startsWith("user-"));
      usersWithFiles = entries
        .filter((name) => name.startsWith("user-"))
        .map((name) => name.replace("user-", ""));
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

    // Restore user-level WhatsApp sessions
    const dbUserConnected = await prisma.userWhatsAppSession.findMany({
      where: { status: { in: ["CONNECTED", "CONNECTING"] } },
      select: { userId: true },
    });
    const dbUserIds = dbUserConnected.map((s) => s.userId);
    const allUserIds = [...new Set([...usersWithFiles, ...dbUserIds])];

    for (const userId of allUserIds) {
      console.log(`[WA] Restoring user session for ${userId}`);
      try {
        await this.startUserSession(userId);
      } catch (e) {
        console.error(`[WA] Failed to restore user session for ${userId}:`, e);
      }
    }
  }

  getStatus(orgId: string): string {
    return this.sessions.get(orgId)?.status ?? "disconnected";
  }

  /**
   * Start a persistent user-level WhatsApp session for invited members.
   * Each user gets their own Baileys session that stays connected.
   */
  async startUserSession(userId: string): Promise<void> {
    const sessionKey = `user:${userId}`;

    // If already connected, skip
    const existing = this.sessions.get(sessionKey);
    if (existing?.status === "connected") return;

    // If already connecting/qr_pending, restart to get fresh QR
    if (existing?.status === "connecting" || existing?.status === "qr_pending") {
      try { existing.socket.end(undefined); } catch {}
      this.sessions.delete(sessionKey);
    }

    const sessionPath = this.getUserSessionPath(userId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: { creds: state.creds, keys: state.keys },
      browser: Browsers.ubuntu("TaskFlow-User"),
      printQRInTerminal: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => ({ conversation: "" }),
    });

    const session: WASession = {
      socket,
      status: "connecting",
      sentGroupMessageIds: new Set(),
      lidToPhone: new Map(),
    };
    this.sessions.set(sessionKey, session);

    // Update DB status
    await this.updateUserDbStatus(userId, "CONNECTING");

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.status = "qr_pending";
        await this.updateUserDbStatus(userId, "QR_PENDING");
        this.emit(`qr:${sessionKey}`, qr);
      }

      if (connection === "open") {
        session.status = "connected";
        const phone = socket.user?.id?.split(":")[0] ?? null;
        await this.updateUserDbStatus(userId, "CONNECTED", phone);
        // Also save phone to User record
        if (phone) {
          await prisma.user.update({
            where: { id: userId },
            data: { phone },
          }).catch(() => {});
        }
        this.emit(`connected:${sessionKey}`, phone);
        console.log(`[WA] User ${userId} connected as ${phone}`);
        this.populateUserLidMappings(userId, session).catch(console.error);
      }

      if (connection === "close") {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;

        session.status = "disconnected";
        await this.updateUserDbStatus(userId, "DISCONNECTED");
        this.emit(`disconnected:${sessionKey}`, code);
        this.sessions.delete(sessionKey);

        if (shouldReconnect) {
          console.log(`[WA] User ${userId} reconnecting (code ${code})...`);
          setTimeout(() => this.startUserSession(userId), 5000);
        } else {
          console.log(`[WA] User ${userId} logged out, clearing session`);
          this.clearUserSessionFiles(userId);
        }
      }
    });

    socket.ev.on("creds.update", saveCreds);

    const updateUserLidMap = (contacts: Partial<{ id: string; lid?: string; jid?: string }>[]) => {
      for (const contact of contacts) {
        const lid = contact.lid ?? (contact.id?.endsWith("@lid") ? contact.id : null);
        const phone = contact.jid ?? (!contact.id?.endsWith("@lid") ? contact.id : null);
        if (lid && phone) {
          session.lidToPhone.set(lid, phone);
          console.log(`[WA] User session LID mapping: ${lid} → ${phone}`);
        }
      }
    };
    socket.ev.on("contacts.upsert", updateUserLidMap);
    socket.ev.on("contacts.update", updateUserLidMap);

    // Handle inbound messages from user's personal WhatsApp
    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue; // Skip messages sent by the user
        const rawFrom = msg.key.remoteJid ?? "";
        const from = (rawFrom.endsWith("@lid") && session.lidToPhone.get(rawFrom))
          ? session.lidToPhone.get(rawFrom)!
          : rawFrom;
        const body =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.ephemeralMessage?.message?.conversation ||
          "";
        if (!body || !from) continue;
        const quotedBody =
          msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
          msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
          null;
        // Forward to webhook with user context
        try {
          await fetch(`${WEBHOOK_URL}/api/webhooks/whatsapp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-secret": WEBHOOK_SECRET,
            },
            body: JSON.stringify({
              userId,
              from,
              messageId: msg.key.id ?? "",
              body,
              quotedMessageId:
                msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? null,
              quotedBody: quotedBody ?? null,
              isUserSession: true,
            }),
          });
        } catch (e) {
          console.error(`[WA] Error forwarding user message for ${userId}:`, e);
        }
      }
    });
  }

  async disconnectUserSession(userId: string): Promise<void> {
    const sessionKey = `user:${userId}`;
    const session = this.sessions.get(sessionKey);
    if (session) {
      await session.socket.logout();
      this.sessions.delete(sessionKey);
    }
    this.clearUserSessionFiles(userId);
    await this.updateUserDbStatus(userId, "DISCONNECTED");
  }

  getUserSessionStatus(userId: string): string {
    return this.sessions.get(`user:${userId}`)?.status ?? "disconnected";
  }

  getUserSessionPath(userId: string): string {
    const dir = path.join(process.cwd(), SESSIONS_PATH, `user-${userId}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  clearUserSessionFiles(userId: string): void {
    const dir = path.join(process.cwd(), SESSIONS_PATH, `user-${userId}`);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  private async updateUserDbStatus(
    userId: string,
    status: "DISCONNECTED" | "CONNECTING" | "QR_PENDING" | "CONNECTED",
    phone?: string | null
  ) {
    await prisma.userWhatsAppSession.upsert({
      where: { userId },
      create: { userId, status, phone: phone ?? null },
      update: { status, ...(phone !== undefined ? { phone } : {}) },
    });
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
