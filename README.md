# Lagna Atelier

A full-stack Vedic astrology intelligence application built entirely on Next.js.

## Stack

- **Next.js 15** (App Router) + **React 19**
- **Supabase** — PostgreSQL database, authentication, row-level security
- **Swiss Ephemeris** (`swisseph`) — server-side planetary and house calculations
- **Framer Motion** — animations and transitions
- **Zod** — runtime validation

## Run Locally

```bash
npm install
npm run dev
```

App runs at `http://localhost:7001`

## Environment

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: path to Swiss Ephemeris data files for higher precision
# If not set, falls back to built-in Moshier ephemeris
# EPHEMERIS_PATH=/path/to/ephe
```

## Database

Run the SQL in [`supabase/schema.sql`](supabase/schema.sql) in your Supabase SQL editor before using workspace storage.

## Deploy

### Vercel

Push to GitHub and import the repo in Vercel. Set the environment variables above in the Vercel project settings. Node 20.x is pinned in `vercel.json`.

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
