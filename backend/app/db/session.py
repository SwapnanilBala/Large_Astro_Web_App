from functools import lru_cache
from typing import Generator

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from app.config import Settings, get_settings


def _build_client(settings: Settings) -> MongoClient | None:
    if not settings.mongodb_uri.strip():
        return None
    return MongoClient(
        settings.mongodb_uri,
        tz_aware=True,
        serverSelectionTimeoutMS=settings.mongodb_server_selection_timeout_ms,
    )


@lru_cache
def get_mongo_client() -> MongoClient | None:
    return _build_client(get_settings())


@lru_cache
def get_mongo_database() -> Database | None:
    settings = get_settings()
    client = get_mongo_client()
    if client is None:
        return None
    return client[settings.mongodb_db_name]


def get_db_session() -> Generator[Database | None, None, None]:
    yield get_mongo_database()


def init_database() -> None:
    database = get_mongo_database()
    if database is None:
        return

    database.command("ping")

    database.users.create_index([("email", ASCENDING)], unique=True, name="users_email_unique")
    database.saved_charts.create_index(
        [
            ("user_id", ASCENDING),
            ("name", ASCENDING),
            ("birth_date", ASCENDING),
            ("birth_time", ASCENDING),
        ],
        unique=True,
        name="saved_charts_user_profile_unique",
    )
    database.saved_charts.create_index(
        [("user_id", ASCENDING), ("updated_at", DESCENDING)],
        name="saved_charts_user_updated_idx",
    )
    database.saved_comparisons.create_index(
        [("user_id", ASCENDING), ("updated_at", DESCENDING)],
        name="saved_comparisons_user_updated_idx",
    )
    database.clients.create_index(
        [("name", ASCENDING), ("birth_date", ASCENDING), ("birth_time", ASCENDING)],
        name="clients_identity_idx",
    )
