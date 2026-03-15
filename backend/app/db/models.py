import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ClientRecord(Base):
    __tablename__ = "clients"

    client_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    birth_time: Mapped[str] = mapped_column(String(32), nullable=False)
    timezone_offset_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    country: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    state: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    city: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    town: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    time_zone_id: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class PastInteractionRecord(Base):
    __tablename__ = "past_interactions"

    interaction_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.client_id", ondelete="CASCADE"), nullable=False, index=True)
    request_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    request_type: Mapped[str] = mapped_column(String(64), default="chart_generation", nullable=False)


class FindingRecord(Base):
    __tablename__ = "findings"

    finding_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.client_id", ondelete="CASCADE"), nullable=False, index=True)
    interaction_id: Mapped[str] = mapped_column(String(36), ForeignKey("past_interactions.interaction_id", ondelete="CASCADE"), nullable=False, index=True)
    julian_day_ut: Mapped[float] = mapped_column(Float, nullable=False)
    ascendant_sign: Mapped[str] = mapped_column(String(32), nullable=False)
    ascendant_longitude: Mapped[float] = mapped_column(Float, nullable=False)
    ascendant_degree_in_sign: Mapped[float] = mapped_column(Float, nullable=False)
    planets_json: Mapped[list[dict]] = mapped_column(JSON, nullable=False)
    houses_json: Mapped[list[dict]] = mapped_column(JSON, nullable=False)


class ReadingRecord(Base):
    __tablename__ = "readings"

    reading_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.client_id", ondelete="CASCADE"), nullable=False, index=True)
    interaction_id: Mapped[str] = mapped_column(String(36), ForeignKey("past_interactions.interaction_id", ondelete="CASCADE"), nullable=False, index=True)
    rule_title: Mapped[str] = mapped_column(String(255), nullable=False)
    rule_insight: Mapped[str] = mapped_column(Text, nullable=False)
    rule_basis: Mapped[str] = mapped_column(Text, nullable=False)
    rule_priority: Mapped[str] = mapped_column(String(16), nullable=False)


class FuturePredictionRecord(Base):
    __tablename__ = "future_predictions"

    prediction_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.client_id", ondelete="CASCADE"), nullable=False, index=True)
    interaction_id: Mapped[str] = mapped_column(String(36), ForeignKey("past_interactions.interaction_id", ondelete="CASCADE"), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    dominant_element: Mapped[str] = mapped_column(Text, default="", nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class UserRecord(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    subscription_tier: Mapped[str] = mapped_column(String(32), default="basic", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class SavedChartRecord(Base):
    __tablename__ = "saved_charts"
    __table_args__ = (
        UniqueConstraint("user_id", "name", "birth_date", "birth_time", name="uq_saved_charts_user_profile"),
    )

    saved_chart_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    city: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    birth_time: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    timezone_offset_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    country: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    state: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    town: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    latitude: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    time_zone_id: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    ascendant_sign: Mapped[str] = mapped_column(String(32), nullable=False)
    query_string: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)


class SavedComparisonRecord(Base):
    __tablename__ = "saved_comparisons"

    saved_comparison_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    primary_name: Mapped[str] = mapped_column(String(120), nullable=False)
    partner_name: Mapped[str] = mapped_column(String(120), nullable=False)
    compatibility_score: Mapped[float] = mapped_column(Float, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    query_string: Mapped[str] = mapped_column(Text, nullable=False)
    report_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
