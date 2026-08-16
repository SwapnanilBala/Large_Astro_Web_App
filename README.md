# Lagna Atelier

A full-stack Vedic astrology intelligence application built entirely on Next.js.

## Stack

- **Next.js 16** (App Router) + **React 19**
- **astronomy-engine** — server-side planetary and house calculations
- **Framer Motion** — animations and transitions
- **Zod** — runtime validation
- **Browser localStorage** — all user data, scoped to local device profiles

## Local-only data

There are no accounts and no database. Up to **5 profiles** can live on one
device, each keeping its own saved charts, comparisons, palm readings, chart
history, and intake drafts. Everything is stored in the browser:

- Clearing site data erases it.
- Nothing syncs across devices, browsers, or private windows.
- Deleting a profile deletes everything saved under it.

Use the profile picker at `/login` to switch, create, rename, or delete profiles.

## Run Locally

```bash
npm install
npm run dev
```

App runs at `http://localhost:7001`

## Environment

No environment variables are required — the chart engine runs without any.
Create `.env.local` only to enable the AI-backed endpoints:

```bash
# Palm-image analysis (/api/palm-reading)
OPENAI_API_KEY=your-key

# Chart question endpoint
ANTHROPIC_API_KEY=your-key

# Optional: path to Swiss Ephemeris data files for higher precision
# If not set, falls back to built-in Moshier ephemeris
# EPHEMERIS_PATH=/path/to/ephe
```

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
