# Lagna Atelier (Next.js + FastAPI)

This project now has:

- Next.js professional intake + insights UI
- Python FastAPI backend for astrology chart generation
- Swiss Ephemeris integration for planetary and Lagna calculation
- Deterministic rule engine for immediate chart interpretation
- MongoDB Atlas persistence for auth, chart storage, export, and saved history

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

Create `backend/.env` from `backend/.env.example` and set your MongoDB Atlas connection:

```bash
MONGODB_URI=mongodb+srv://<db-user>:<url-encoded-password>@<cluster-host>/<db_name>?retryWrites=true&w=majority&appName=<app-name>
MONGODB_DB_NAME=swapastro
```

If the password contains special characters like `@` or `#`, URL-encode it before placing it in the URI.

## Database

The backend now supports:

- MongoDB Atlas via `MONGODB_URI`
- Automatic collection/index initialization on backend startup
- Persistent auth, saved charts, saved comparisons, and workspace export from the same Mongo database

For Vercel deployments, add the same `MONGODB_URI` and `MONGODB_DB_NAME` values in the project environment settings.

## Windows Note

`pyswisseph` can require Microsoft C++ Build Tools on Python 3.12+ if no prebuilt wheel is available.
