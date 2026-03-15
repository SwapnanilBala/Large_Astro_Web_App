from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    ClientRecord,
    FindingRecord,
    FuturePredictionRecord,
    PastInteractionRecord,
    ReadingRecord,
    SavedChartRecord,
    SavedComparisonRecord,
    UserRecord,
)
from app.models.chart_models import (
    SavedChartResponse,
    SavedComparisonResponse,
    StorageStatus,
)


class DatabaseGateway:
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _saved_chart_to_response(record: SavedChartRecord) -> SavedChartResponse:
        return SavedChartResponse(
            saved_chart_id=record.saved_chart_id,
            name=record.name,
            city=record.city,
            birth_date=record.birth_date,
            birth_time=record.birth_time,
            timezone_offset_minutes=record.timezone_offset_minutes,
            country=record.country,
            state=record.state,
            town=record.town,
            latitude=record.latitude,
            longitude=record.longitude,
            time_zone_id=record.time_zone_id,
            ascendant_sign=record.ascendant_sign,
            query_string=record.query_string,
            notes=record.notes,
            saved_at=record.saved_at,
            updated_at=record.updated_at,
            archived_at=record.archived_at,
        )

    @staticmethod
    def _saved_comparison_to_response(record: SavedComparisonRecord) -> SavedComparisonResponse:
        return SavedComparisonResponse(
            saved_comparison_id=record.saved_comparison_id,
            primary_name=record.primary_name,
            partner_name=record.partner_name,
            compatibility_score=record.compatibility_score,
            summary=record.summary,
            query_string=record.query_string,
            notes=record.notes,
            saved_at=record.saved_at,
            updated_at=record.updated_at,
            archived_at=record.archived_at,
        )

    def _find_or_create_client(self, payload: dict) -> str:
        client_data = payload["client"]
        birth = payload.get("birth", {})

        stmt = select(ClientRecord).where(
            ClientRecord.name == client_data["name"],
            ClientRecord.birth_date == birth.get("birth_date"),
            ClientRecord.birth_time == str(birth.get("birth_time", "")),
        )
        client = self._session.execute(stmt).scalar_one_or_none()
        if client:
            return client.client_id

        client = ClientRecord(
            name=client_data["name"],
            birth_date=birth.get("birth_date"),
            birth_time=str(birth.get("birth_time", "")),
            timezone_offset_minutes=client_data.get("timezone_offset_minutes", 0),
            country=client_data.get("country", ""),
            state=client_data.get("state", ""),
            city=client_data.get("city", ""),
            town=client_data.get("town", ""),
            time_zone_id=client_data.get("time_zone_id", ""),
            latitude=client_data.get("latitude", 0.0),
            longitude=client_data.get("longitude", 0.0),
        )
        self._session.add(client)
        self._session.flush()
        return client.client_id

    def persist_chart(self, payload: dict) -> StorageStatus:
        try:
            client_id = self._find_or_create_client(payload)

            interaction = PastInteractionRecord(
                client_id=client_id,
                request_timestamp=self._utc_now(),
                request_type="chart_generation",
            )
            self._session.add(interaction)
            self._session.flush()

            chart = payload["chart"]
            self._session.add(
                FindingRecord(
                    client_id=client_id,
                    interaction_id=interaction.interaction_id,
                    julian_day_ut=chart["julian_day_ut"],
                    ascendant_sign=chart["ascendant"]["sign"],
                    ascendant_longitude=chart["ascendant"]["longitude"],
                    ascendant_degree_in_sign=chart["ascendant"]["degree_in_sign"],
                    planets_json=chart["planets"],
                    houses_json=chart["houses"],
                )
            )

            for rule in chart.get("deterministic_rules", []):
                self._session.add(
                    ReadingRecord(
                        client_id=client_id,
                        interaction_id=interaction.interaction_id,
                        rule_title=rule["title"],
                        rule_insight=rule["insight"],
                        rule_basis=rule["basis"],
                        rule_priority=rule["priority"],
                    )
                )

            dominant = ""
            for rule in chart.get("deterministic_rules", []):
                if "element" in rule.get("title", "").lower():
                    dominant = rule.get("basis", "")
                    break

            self._session.add(
                FuturePredictionRecord(
                    client_id=client_id,
                    interaction_id=interaction.interaction_id,
                    summary=chart.get("summary", ""),
                    dominant_element=dominant,
                    generated_at=self._utc_now(),
                )
            )

            self._session.commit()
            return StorageStatus(
                configured=True,
                persisted=True,
                message=f"Chart saved to database (client: {client_id[:8]}...)",
            )
        except Exception as exc:
            self._session.rollback()
            return StorageStatus(
                configured=True,
                persisted=False,
                message=f"Database write failed: {exc}",
            )

    def create_user(
        self,
        email: str,
        password_hash: str,
        display_name: str,
        subscription_tier: str = "guest",
    ) -> dict:
        user = UserRecord(
            email=email,
            password_hash=password_hash,
            display_name=display_name,
            subscription_tier=subscription_tier,
        )
        self._session.add(user)
        try:
            self._session.commit()
        except IntegrityError as exc:
            self._session.rollback()
            raise ValueError("An account with this email already exists.") from exc

        return {
            "user_id": user.user_id,
            "email": user.email,
            "display_name": user.display_name,
            "subscription_tier": user.subscription_tier,
        }

    def find_user_by_email(self, email: str) -> dict | None:
        stmt = select(UserRecord).where(UserRecord.email == email)
        user = self._session.execute(stmt).scalar_one_or_none()
        if not user:
            return None

        return {
            "user_id": user.user_id,
            "email": user.email,
            "password_hash": user.password_hash,
            "display_name": user.display_name,
            "subscription_tier": user.subscription_tier,
        }

    def find_user_by_id(self, user_id: str) -> dict | None:
        stmt = select(UserRecord).where(UserRecord.user_id == user_id)
        user = self._session.execute(stmt).scalar_one_or_none()
        if not user:
            return None

        return {
            "user_id": user.user_id,
            "email": user.email,
            "display_name": user.display_name,
            "subscription_tier": user.subscription_tier,
        }

    def update_user_subscription_tier(self, user_id: str, subscription_tier: str) -> dict | None:
        stmt = select(UserRecord).where(UserRecord.user_id == user_id)
        user = self._session.execute(stmt).scalar_one_or_none()
        if not user:
            return None

        user.subscription_tier = subscription_tier
        self._session.commit()
        self._session.refresh(user)
        return {
            "user_id": user.user_id,
            "email": user.email,
            "display_name": user.display_name,
            "subscription_tier": user.subscription_tier,
        }

    def save_chart_for_user(self, user_id: str, payload: dict) -> SavedChartResponse:
        stmt = select(SavedChartRecord).where(
            SavedChartRecord.user_id == user_id,
            SavedChartRecord.name == payload["name"],
            SavedChartRecord.birth_date == payload["birth_date"],
            SavedChartRecord.birth_time == payload.get("birth_time", ""),
        )
        existing = self._session.execute(stmt).scalar_one_or_none()
        now_utc = self._utc_now()

        if existing:
            record = existing
            record.city = payload.get("city", "")
            record.timezone_offset_minutes = payload.get("timezone_offset_minutes", 0)
            record.country = payload.get("country", "")
            record.state = payload.get("state", "")
            record.town = payload.get("town", "")
            record.latitude = payload.get("latitude", 0)
            record.longitude = payload.get("longitude", 0)
            record.time_zone_id = payload.get("time_zone_id", "")
            record.ascendant_sign = payload["ascendant_sign"]
            record.query_string = payload["query_string"]
            record.notes = payload.get("notes", record.notes)
            record.updated_at = now_utc
        else:
            record = SavedChartRecord(
                user_id=user_id,
                name=payload["name"],
                city=payload.get("city", ""),
                birth_date=payload["birth_date"],
                birth_time=payload.get("birth_time", ""),
                timezone_offset_minutes=payload.get("timezone_offset_minutes", 0),
                country=payload.get("country", ""),
                state=payload.get("state", ""),
                town=payload.get("town", ""),
                latitude=payload.get("latitude", 0),
                longitude=payload.get("longitude", 0),
                time_zone_id=payload.get("time_zone_id", ""),
                ascendant_sign=payload["ascendant_sign"],
                query_string=payload["query_string"],
                notes=payload.get("notes", ""),
                saved_at=now_utc,
                updated_at=now_utc,
            )
            self._session.add(record)

        self._session.commit()
        self._session.refresh(record)
        return self._saved_chart_to_response(record)

    def list_saved_charts_for_user(
        self,
        user_id: str,
        limit: int = 50,
        search: str | None = None,
        status: str = "active",
    ) -> list[SavedChartResponse]:
        stmt = select(SavedChartRecord).where(SavedChartRecord.user_id == user_id)
        if status == "active":
            stmt = stmt.where(SavedChartRecord.archived_at.is_(None))
        elif status == "archived":
            stmt = stmt.where(SavedChartRecord.archived_at.is_not(None))
        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    SavedChartRecord.name.ilike(like),
                    SavedChartRecord.city.ilike(like),
                    SavedChartRecord.ascendant_sign.ilike(like),
                    SavedChartRecord.notes.ilike(like),
                )
            )
        stmt = stmt.order_by(SavedChartRecord.updated_at.desc()).limit(limit)
        records = self._session.execute(stmt).scalars().all()
        return [self._saved_chart_to_response(record) for record in records]

    def update_saved_chart_notes(self, user_id: str, saved_chart_id: str, notes: str) -> SavedChartResponse | None:
        stmt = select(SavedChartRecord).where(
            SavedChartRecord.user_id == user_id,
            SavedChartRecord.saved_chart_id == saved_chart_id,
        )
        record = self._session.execute(stmt).scalar_one_or_none()
        if not record:
            return None

        record.notes = notes
        record.updated_at = self._utc_now()
        self._session.commit()
        self._session.refresh(record)
        return self._saved_chart_to_response(record)

    def archive_saved_chart(
        self,
        user_id: str,
        saved_chart_id: str,
        archived: bool = True,
    ) -> SavedChartResponse | None:
        stmt = select(SavedChartRecord).where(
            SavedChartRecord.user_id == user_id,
            SavedChartRecord.saved_chart_id == saved_chart_id,
        )
        record = self._session.execute(stmt).scalar_one_or_none()
        if not record:
            return None

        record.archived_at = self._utc_now() if archived else None
        record.updated_at = self._utc_now()
        self._session.commit()
        self._session.refresh(record)
        return self._saved_chart_to_response(record)

    def delete_saved_chart(self, user_id: str, saved_chart_id: str) -> bool:
        stmt = select(SavedChartRecord).where(
            SavedChartRecord.user_id == user_id,
            SavedChartRecord.saved_chart_id == saved_chart_id,
        )
        record = self._session.execute(stmt).scalar_one_or_none()
        if not record:
            return False

        self._session.delete(record)
        self._session.commit()
        return True

    def save_comparison_for_user(
        self,
        user_id: str,
        primary_name: str,
        partner_name: str,
        compatibility_score: float,
        summary: str,
        query_string: str,
        report_json: dict,
        notes: str = "",
    ) -> SavedComparisonResponse:
        now_utc = self._utc_now()
        record = SavedComparisonRecord(
            user_id=user_id,
            primary_name=primary_name,
            partner_name=partner_name,
            compatibility_score=compatibility_score,
            summary=summary,
            query_string=query_string,
            report_json=report_json,
            notes=notes,
            saved_at=now_utc,
            updated_at=now_utc,
        )
        self._session.add(record)
        self._session.commit()
        self._session.refresh(record)
        return self._saved_comparison_to_response(record)

    def list_saved_comparisons_for_user(
        self,
        user_id: str,
        limit: int = 50,
        search: str | None = None,
        status: str = "active",
    ) -> list[SavedComparisonResponse]:
        stmt = select(SavedComparisonRecord).where(SavedComparisonRecord.user_id == user_id)
        if status == "active":
            stmt = stmt.where(SavedComparisonRecord.archived_at.is_(None))
        elif status == "archived":
            stmt = stmt.where(SavedComparisonRecord.archived_at.is_not(None))
        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    SavedComparisonRecord.primary_name.ilike(like),
                    SavedComparisonRecord.partner_name.ilike(like),
                    SavedComparisonRecord.summary.ilike(like),
                    SavedComparisonRecord.notes.ilike(like),
                )
            )
        stmt = stmt.order_by(SavedComparisonRecord.updated_at.desc()).limit(limit)
        records = self._session.execute(stmt).scalars().all()
        return [self._saved_comparison_to_response(record) for record in records]

    def update_saved_comparison_notes(
        self,
        user_id: str,
        saved_comparison_id: str,
        notes: str,
    ) -> SavedComparisonResponse | None:
        stmt = select(SavedComparisonRecord).where(
            SavedComparisonRecord.user_id == user_id,
            SavedComparisonRecord.saved_comparison_id == saved_comparison_id,
        )
        record = self._session.execute(stmt).scalar_one_or_none()
        if not record:
            return None

        record.notes = notes
        record.updated_at = self._utc_now()
        self._session.commit()
        self._session.refresh(record)
        return self._saved_comparison_to_response(record)

    def archive_saved_comparison(
        self,
        user_id: str,
        saved_comparison_id: str,
        archived: bool = True,
    ) -> SavedComparisonResponse | None:
        stmt = select(SavedComparisonRecord).where(
            SavedComparisonRecord.user_id == user_id,
            SavedComparisonRecord.saved_comparison_id == saved_comparison_id,
        )
        record = self._session.execute(stmt).scalar_one_or_none()
        if not record:
            return None

        record.archived_at = self._utc_now() if archived else None
        record.updated_at = self._utc_now()
        self._session.commit()
        self._session.refresh(record)
        return self._saved_comparison_to_response(record)

    def delete_saved_comparison(self, user_id: str, saved_comparison_id: str) -> bool:
        stmt = select(SavedComparisonRecord).where(
            SavedComparisonRecord.user_id == user_id,
            SavedComparisonRecord.saved_comparison_id == saved_comparison_id,
        )
        record = self._session.execute(stmt).scalar_one_or_none()
        if not record:
            return False

        self._session.delete(record)
        self._session.commit()
        return True
