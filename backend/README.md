# Astro Intelligence FastAPI Backend

This service implements:

- Swiss Ephemeris based chart computation (`pyswisseph`)
- Deterministic interpretation rules (Lagna/Sun/Moon + element and house concentration)
- MongoDB Atlas persistence with PyMongo
- Authenticated saved-chart history endpoints

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Recommended MongoDB Atlas environment variables:

```bash
MONGODB_URI=mongodb+srv://<db-user>:<url-encoded-password>@<cluster-host>/<db_name>?retryWrites=true&w=majority&appName=<app-name>
MONGODB_DB_NAME=swapastro
```

The backend initializes its Mongo collections and indexes automatically on startup.

## Notes for Windows

- `pyswisseph` may require Microsoft C++ Build Tools when running on Python 3.12+.
- If installation fails, install "Desktop development with C++" from Visual Studio Build Tools, then rerun pip.

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

API docs: `http://127.0.0.1:8000/docs`

## Endpoints

- `POST /api/v1/chart`
- `GET /api/v1/chart`
- `GET /api/v1/saved-charts`
- `POST /api/v1/saved-charts`
- `GET /api/v1/export/excel`
- `GET /health`

The chart output includes:

- Ascendant (Lagna)
- Planetary positions and houses
- Deterministic interpretation rules
- Database storage status
