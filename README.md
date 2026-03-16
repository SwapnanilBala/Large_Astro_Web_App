# Lagna Atelier (Next.js + FastAPI)

This project now has:

- Next.js professional intake + insights UI
- Python FastAPI backend for astrology chart generation
- Swiss Ephemeris integration for planetary and Lagna calculation
- Deterministic rule engine for immediate chart interpretation
- Supabase-backed auth and workspace storage on the Next.js side

## Run Next.js App

```bash
npm install
npm run dev
```

Next app default: `http://127.0.0.1:7001`

## Run Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Backend API docs: `http://127.0.0.1:8000/docs`

## Environment

Create `.env.local` in project root (or use `.env.example`):

```bash
ASTRO_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_ASTRO_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Create `backend/.env` from `backend/.env.example` only if you want to customize CORS or the Swiss Ephemeris path:

```bash
EPHEMERIS_PATH=
CORS_ORIGINS=["http://localhost:7001","http://127.0.0.1:7001"]
```

## Database

This repo now uses:

- Supabase Auth for sign-in and registration
- Supabase tables for saved charts and saved compatibility reports
- A stateless FastAPI backend for astrology computation only

Run the SQL in [schema.sql](/c:/Users/Retro/Large_Scale_Astro_App/Next.js_Version/supabase/schema.sql) in your Supabase SQL editor before using synced workspace storage.

For Vercel deployments, add the same `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ASTRO_API_BASE_URL`, and `NEXT_PUBLIC_ASTRO_API_BASE_URL` values in the project environment settings.

## Deploy Backend

The repo now includes [render.yaml](/c:/Users/Retro/Large_Scale_Astro_App/Next.js_Version/render.yaml) for deploying the slimmed-down FastAPI backend on Render.

After the Render service is live, use its public URL for:

```bash
ASTRO_API_BASE_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_ASTRO_API_BASE_URL=https://your-render-service.onrender.com
```

## Windows Note

`pyswisseph` can require Microsoft C++ Build Tools on Python 3.12+ if no prebuilt wheel is available.
