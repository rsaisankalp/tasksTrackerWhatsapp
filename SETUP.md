# TaskFlow — Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL database
- Google OAuth credentials
- Gemini API key (optional, for AI reply parsing)

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — Random secret (`openssl rand -base64 32`)
- `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` — From Google Cloud Console
- `GEMINI_API_KEY` — From Google AI Studio (optional)
- `INTERNAL_WEBHOOK_SECRET` — Any random string for internal security
- `APP_URL` — Your app URL (default: `http://localhost:3000`)

### 3. Set up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add `http://localhost:3000/api/auth/callback/google` as authorized redirect URI

### 4. Set up database
```bash
npm run db:push   # Push schema to DB (development)
# or
npm run db:migrate  # Run migrations (production)
```

### 5. Start the app
```bash
npm run dev   # Development (uses tsx watch server.ts)
```

## Architecture

```
TaskFlow
├── Next.js 14 (App Router) — frontend + API
├── PostgreSQL + Prisma — database
├── NextAuth v5 — Google OAuth
├── Baileys — WhatsApp integration
├── node-cron — reminder scheduler
└── Gemini Flash Lite — AI reply parsing
```

## How WhatsApp Works

1. **Onboarding**: Admin scans QR code via Settings → WhatsApp
2. **Reminders**: Cron job runs every 15 min, sends WhatsApp messages to executors based on task importance
3. **Reply parsing**: When executor replies "done 1,2", Gemini AI parses the reply and marks subtasks complete
4. **Status updates**: Executor can just reply "done" to mark the whole task complete

## Reminder System

| Importance | Default Interval | Working Hours |
|-----------|-----------------|---------------|
| Emergency | 3 hours | No (24/7) |
| High | 5 hours | Yes |
| Medium | 8 hours | Yes |
| Low | 48 hours (2 days) | Yes |

Working hours default: Mon-Fri, 9am-6pm IST. Configurable in Settings.

## Multi-Org Support

Each organization is isolated. One user can belong to multiple organizations and switch between them in the sidebar.

## Trust Levels

- **Internal**: Full org members
- **Trusted**: Vetted external collaborators
- **External**: Unknown/untrusted (cannot be assigned tasks cross-org)
