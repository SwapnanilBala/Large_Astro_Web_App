from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_name: str = "Astro Intelligence API"
    api_prefix: str = "/api/v1"
    cors_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:7001", "http://127.0.0.1:7001"]
    )
    ephemeris_path: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
