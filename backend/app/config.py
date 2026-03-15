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

    mongodb_uri: str = ""
    mongodb_db_name: str = "swapastro"
    mongodb_server_selection_timeout_ms: int = 5000
    excel_export_path: str = "data/astro_export.xlsx"

    jwt_secret: str = "change-me-in-production"
    plan_basic_code: str = "LAGNA-BASIC-5"
    plan_pro_code: str = "LAGNA-PRO-20"
    plan_ultimate_code: str = "LAGNA-ULTIMATE-50"
    plan_redeem_cooldown_seconds: int = 10
    ultimate_member_display_names: str = "Swapnanil Bala"
    ultimate_member_emails: str = ""

    def has_mongodb(self) -> bool:
        return bool(self.mongodb_uri.strip())

    def get_plan_redemption_codes(self) -> dict[str, str]:
        return {
            "basic": self.plan_basic_code,
            "pro": self.plan_pro_code,
            "ultimate": self.plan_ultimate_code,
        }

    @staticmethod
    def _parse_csv(value: str) -> set[str]:
        return {
            item.strip().casefold()
            for item in value.replace("\n", ",").split(",")
            if item.strip()
        }

    def get_reserved_ultimate_display_names(self) -> set[str]:
        return self._parse_csv(self.ultimate_member_display_names)

    def get_reserved_ultimate_emails(self) -> set[str]:
        return self._parse_csv(self.ultimate_member_emails)

    def is_reserved_ultimate_member(
        self,
        display_name: str = "",
        email: str = "",
    ) -> bool:
        normalized_name = display_name.strip().casefold()
        normalized_email = email.strip().casefold()
        return (
            normalized_name in self.get_reserved_ultimate_display_names()
            or normalized_email in self.get_reserved_ultimate_emails()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
