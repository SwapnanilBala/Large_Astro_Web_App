from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.chart import router as chart_router
from app.api.v1.compatibility import router as compatibility_router
from app.api.v1.export import router as export_router
from app.api.v1.saved_comparisons import router as saved_comparisons_router
from app.api.v1.saved_charts import router as saved_charts_router
from app.config import get_settings
from app.db.session import init_database

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Swiss Ephemeris powered astrology backend with deterministic rule outputs.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(chart_router, prefix=settings.api_prefix)
app.include_router(compatibility_router, prefix=settings.api_prefix)
app.include_router(export_router, prefix=settings.api_prefix)
app.include_router(saved_comparisons_router, prefix=settings.api_prefix)
app.include_router(saved_charts_router, prefix=settings.api_prefix)


@app.on_event("startup")
def startup_event() -> None:
    init_database()


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
