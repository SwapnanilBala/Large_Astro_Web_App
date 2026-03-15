# Lagna Atelier (Next.js + FastAPI)

This project now has:

- Next.js professional intake + insights UI
- Python FastAPI backend for astrology chart generation
- Swiss Ephemeris integration for planetary and Lagna calculation
- Deterministic rule engine for immediate chart interpretation
- Neon-ready Postgres persistence for auth, chart storage, export, and saved history

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
```

Create `backend/.env` from `backend/.env.example` and set Neon connection strings:

```bash
DATABASE_URL=postgresql://<pooled-neon-connection>
DATABASE_DIRECT_URL=postgresql://<direct-neon-connection>
```

Use the pooled URL for the running FastAPI app and the direct URL for migrations and schema changes.

## Database

The backend now supports:

- Neon/Postgres via `DATABASE_URL`
- Direct migration connections via `DATABASE_DIRECT_URL`
- SQLite fallback when no Postgres URL is configured

Optional migration command:

```bash
cd backend
.venv\Scripts\activate
alembic upgrade head
```

## Windows Note

`pyswisseph` can require Microsoft C++ Build Tools on Python 3.12+ if no prebuilt wheel is available.
