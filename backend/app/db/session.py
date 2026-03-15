from functools import lru_cache
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.config import Settings, get_settings


def normalize_database_url(url: str) -> str:
    if url.startswith("postgresql+psycopg://") or url.startswith("sqlite"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


def _create_engine(settings: Settings, direct: bool = False) -> Engine:
    raw_url = settings.get_database_direct_url() if direct else settings.get_database_url()
    database_url = normalize_database_url(raw_url)

    if database_url.startswith("sqlite"):
        return create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            future=True,
        )

    return create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_recycle=settings.db_pool_recycle_seconds,
        future=True,
    )


@lru_cache
def get_engine() -> Engine:
    return _create_engine(get_settings())


@lru_cache
def get_direct_engine() -> Engine:
    return _create_engine(get_settings(), direct=True)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(
        bind=get_engine(),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        future=True,
    )


def get_db_session() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def init_database() -> None:
    import app.db.models  # noqa: F401

    Base.metadata.create_all(bind=get_direct_engine())
