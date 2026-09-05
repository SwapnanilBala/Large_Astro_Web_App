# Lagna Atelier

A full-stack Vedic astrology intelligence application built entirely on Next.js.

## Stack

- **Next.js 16** (App Router) + **React 19**
- **astronomy-engine** — server-side planetary and house calculations
- **Framer Motion** — animations and transitions
- **Zod** — runtime validation
- **Browser localStorage** — all chart data, scoped to local device profiles
- **Neon Postgres** + **Drizzle** — accounts and sessions, and nothing else yet

## Where data lives

Signing in with Google gives you an identity, not a synced library. Everything
a reading is made of still lives in the browser: up to **5 profiles** on one
device, each with its own chart history, palm readings and intake drafts.

- Clearing site data erases it.
- Nothing syncs across devices, browsers, or private windows.
- Deleting a profile deletes everything saved under it.

Use the profile picker at `/login` to switch, create, rename, or delete
profiles. `docs/account-data-sync-plan.md` is the proposal for closing the gap
between the two.

## Run Locally

```bash
npm install
npm run dev
```

App runs at `http://localhost:7001`. If that port is already held by an
earlier run, free it first (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 7001 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

## Environment

Charts need no environment variables — the astronomy engine runs on an empty
one. Copy `.env.example` to `.env.local` to enable the parts that do:

- `OPENAI_API_KEY` — palm-image analysis (`/api/palm-reading`)
- `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DEVICE_ID_SECRET`,
  `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `APP_ORIGIN` — Google sign-in

Without the sign-in group the button is hidden and nothing else changes. See
`.env.example` for what each one is and where to get it.

## Deploy

### Vercel

Push to GitHub and import the repo in Vercel. Set any of the optional keys above
in the Vercel project settings. Node 20+ comes from the `engines` field in
`package.json`.

### Render

A `render.yaml` is not included — deploy as a standard Node web service with:
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Node version: `20.x`

## Testing

```bash
npm run test        # run once
npm run test:watch  # watch mode
```
