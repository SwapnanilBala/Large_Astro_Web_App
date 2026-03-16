import json
from functools import lru_cache
from typing import Annotated, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


CorsOrigins = Annotated[List[str], NoDecode]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_name: str = "Astro Intelligence API"
    api_prefix: str = "/api/v1"
    cors_origins: CorsOrigins = Field(
        default_factory=lambda: ["http://localhost:7001", "http://127.0.0.1:7001"]
    )
    ephemeris_path: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if not isinstance(value, str):
            return value

        raw_value = value.strip()
        if not raw_value:
            return []

        if raw_value.startswith("["):
            try:
                parsed_value = json.loads(raw_value)
            except json.JSONDecodeError:
                raw_value = raw_value.strip("[]")
            else:
                if isinstance(parsed_value, list):
                    return [str(item).strip() for item in parsed_value if str(item).strip()]
                raise ValueError("CORS_ORIGINS JSON value must be an array of origins.")

        return [item.strip().strip("\"'") for item in raw_value.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
