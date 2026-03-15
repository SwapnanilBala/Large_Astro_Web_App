import re
import uuid
from datetime import datetime, timezone

from pymongo import DESCENDING
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from pymongo.results import DeleteResult
from pymongo import ReturnDocument

from app.models.chart_models import (
    SavedChartResponse,
    SavedComparisonResponse,
    StorageStatus,
)


class DatabaseGateway:
    def __init__(self, database: Database | None) -> None:
        self._db = database

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _new_id() -> str:
        return str(uuid.uuid4())

    @staticmethod
    def _clean_document(record: dict | None) -> dict | None:
        if not record:
            return None
        cleaned = dict(record)
        cleaned.pop("_id", None)
        return cleaned

    def _collection(self, name: str) -> Collection:
        if self._db is None:
            raise RuntimeError("MongoDB is not configured.")
        return self._db[name]

    @staticmethod
    def _saved_chart_to_response(record: dict) -> SavedChartResponse:
        cleaned = DatabaseGateway._clean_document(record) or {}
        return SavedChartResponse(**cleaned)

    @staticmethod
    def _saved_comparison_to_response(record: dict) -> SavedComparisonResponse:
        cleaned = DatabaseGateway._clean_document(record) or {}
        return SavedComparisonResponse(**cleaned)

    @staticmethod
    def _build_search_filter(search: str | None, fields: list[str]) -> dict:
        if not search or not search.strip():
            return {}
        pattern = re.escape(search.strip())
        return {
            "$or": [
                {
                    field: {
                        "$regex": pattern,
                        "$options": "i",
                    }
                }
                for field in fields
            ]
        }

    def persist_chart(self, payload: dict) -> StorageStatus:
        if self._db is None:
            return StorageStatus(
                configured=False,
                persisted=False,
                message="MongoDB is not configured.",
            )

        try:
            now_utc = self._utc_now()
            client_data = payload["client"]
            birth = payload.get("birth", {})
            chart = payload["chart"]

            clients = self._collection("clients")
            interactions = self._collection("past_interactions")
            findings = self._collection("findings")
            readings = self._collection("readings")
            predictions = self._collection("future_predictions")

            client_filter = {
                "name": client_data["name"],
                "birth_date": str(birth.get("birth_date", "")),
                "birth_time": str(birth.get("birth_time", "")),
            }
            client_record = clients.find_one(client_filter)
            if client_record:
                client_id = client_record["client_id"]
            else:
                client_id = self._new_id()
                clients.insert_one(
                    {
                        "client_id": client_id,
                        **client_filter,
                        "timezone_offset_minutes": client_data.get("timezone_offset_minutes", 0),
                        "country": client_data.get("country", ""),
                        "state": client_data.get("state", ""),
                        "city": client_data.get("city", ""),
                        "town": client_data.get("town", ""),
                        "time_zone_id": client_data.get("time_zone_id", ""),
                        "latitude": client_data.get("latitude", 0.0),
                        "longitude": client_data.get("longitude", 0.0),
                        "created_at": now_utc,
                    }
                )

            interaction_id = self._new_id()
            interactions.insert_one(
                {
                    "interaction_id": interaction_id,
                    "client_id": client_id,
                    "request_timestamp": now_utc,
                    "request_type": "chart_generation",
                }
            )

            findings.insert_one(
                {
                    "finding_id": self._new_id(),
                    "client_id": client_id,
                    "interaction_id": interaction_id,
                    "julian_day_ut": chart["julian_day_ut"],
                    "ascendant_sign": chart["ascendant"]["sign"],
                    "ascendant_longitude": chart["ascendant"]["longitude"],
                    "ascendant_degree_in_sign": chart["ascendant"]["degree_in_sign"],
                    "planets_json": chart["planets"],
                    "houses_json": chart["houses"],
                }
            )

            rule_documents = [
                {
                    "reading_id": self._new_id(),
                    "client_id": client_id,
                    "interaction_id": interaction_id,
                    "rule_title": rule["title"],
                    "rule_insight": rule["insight"],
                    "rule_basis": rule["basis"],
                    "rule_priority": rule["priority"],
                }
                for rule in chart.get("deterministic_rules", [])
            ]
            if rule_documents:
                readings.insert_many(rule_documents)

            dominant = ""
            for rule in chart.get("deterministic_rules", []):
                if "element" in rule.get("title", "").lower():
                    dominant = rule.get("basis", "")
                    break

            predictions.insert_one(
                {
                    "prediction_id": self._new_id(),
                    "client_id": client_id,
                    "interaction_id": interaction_id,
                    "summary": chart.get("summary", ""),
                    "dominant_element": dominant,
                    "generated_at": now_utc,
                }
            )

            return StorageStatus(
                configured=True,
                persisted=True,
                message=f"Chart saved to MongoDB (client: {client_id[:8]}...)",
            )
        except Exception as exc:
            return StorageStatus(
                configured=True,
                persisted=False,
                message=f"MongoDB write failed: {exc}",
            )

    def create_user(
        self,
        email: str,
        password_hash: str,
        display_name: str,
        subscription_tier: str = "guest",
    ) -> dict:
        users = self._collection("users")
        user = {
            "user_id": self._new_id(),
            "email": email,
            "password_hash": password_hash,
            "display_name": display_name,
            "subscription_tier": subscription_tier,
            "created_at": self._utc_now(),
        }
        try:
            users.insert_one(user)
        except DuplicateKeyError as exc:
            raise ValueError("An account with this email already exists.") from exc
        return self._clean_document(user) or {}

    def find_user_by_email(self, email: str) -> dict | None:
        users = self._collection("users")
        return self._clean_document(users.find_one({"email": email}))

    def find_user_by_id(self, user_id: str) -> dict | None:
        users = self._collection("users")
        return self._clean_document(users.find_one({"user_id": user_id}))

    def update_user_subscription_tier(self, user_id: str, subscription_tier: str) -> dict | None:
        users = self._collection("users")
        record = users.find_one_and_update(
            {"user_id": user_id},
            {
                "$set": {
                    "subscription_tier": subscription_tier,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return self._clean_document(record)

    def save_chart_for_user(self, user_id: str, payload: dict) -> SavedChartResponse:
        charts = self._collection("saved_charts")
        now_utc = self._utc_now()
        filter_doc = {
            "user_id": user_id,
            "name": payload["name"],
            "birth_date": str(payload["birth_date"]),
            "birth_time": payload.get("birth_time", ""),
        }
        record = charts.find_one_and_update(
            filter_doc,
            {
                "$set": {
                    "city": payload.get("city", ""),
                    "timezone_offset_minutes": payload.get("timezone_offset_minutes", 0),
                    "country": payload.get("country", ""),
                    "state": payload.get("state", ""),
                    "town": payload.get("town", ""),
                    "latitude": payload.get("latitude", 0),
                    "longitude": payload.get("longitude", 0),
                    "time_zone_id": payload.get("time_zone_id", ""),
                    "ascendant_sign": payload["ascendant_sign"],
                    "query_string": payload["query_string"],
                    "notes": payload.get("notes", ""),
                    "updated_at": now_utc,
                    "archived_at": payload.get("archived_at"),
                },
                "$setOnInsert": {
                    "saved_chart_id": self._new_id(),
                    "saved_at": now_utc,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return self._saved_chart_to_response(record or {})

    def list_saved_charts_for_user(
        self,
        user_id: str,
        limit: int = 50,
        search: str | None = None,
        status: str = "active",
    ) -> list[SavedChartResponse]:
        charts = self._collection("saved_charts")
        filter_doc: dict = {"user_id": user_id}
        if status == "active":
            filter_doc["archived_at"] = None
        elif status == "archived":
            filter_doc["archived_at"] = {"$ne": None}

        search_filter = self._build_search_filter(
            search,
            ["name", "city", "ascendant_sign", "notes"],
        )
        if search_filter:
            filter_doc = {"$and": [filter_doc, search_filter]}

        records = (
            charts.find(filter_doc)
            .sort("updated_at", DESCENDING)
            .limit(limit)
        )
        return [self._saved_chart_to_response(record) for record in records]

    def update_saved_chart_notes(self, user_id: str, saved_chart_id: str, notes: str) -> SavedChartResponse | None:
        charts = self._collection("saved_charts")
        record = charts.find_one_and_update(
            {"user_id": user_id, "saved_chart_id": saved_chart_id},
            {
                "$set": {
                    "notes": notes,
                    "updated_at": self._utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return self._saved_chart_to_response(record) if record else None

    def archive_saved_chart(
        self,
        user_id: str,
        saved_chart_id: str,
        archived: bool = True,
    ) -> SavedChartResponse | None:
        charts = self._collection("saved_charts")
        record = charts.find_one_and_update(
            {"user_id": user_id, "saved_chart_id": saved_chart_id},
            {
                "$set": {
                    "archived_at": self._utc_now() if archived else None,
                    "updated_at": self._utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return self._saved_chart_to_response(record) if record else None

    def delete_saved_chart(self, user_id: str, saved_chart_id: str) -> bool:
        charts = self._collection("saved_charts")
        result: DeleteResult = charts.delete_one({"user_id": user_id, "saved_chart_id": saved_chart_id})
        return result.deleted_count > 0

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
        comparisons = self._collection("saved_comparisons")
        now_utc = self._utc_now()
        record = {
            "saved_comparison_id": self._new_id(),
            "user_id": user_id,
            "primary_name": primary_name,
            "partner_name": partner_name,
            "compatibility_score": compatibility_score,
            "summary": summary,
            "query_string": query_string,
            "report_json": report_json,
            "notes": notes,
            "saved_at": now_utc,
            "updated_at": now_utc,
            "archived_at": None,
        }
        comparisons.insert_one(record)
        return self._saved_comparison_to_response(record)

    def list_saved_comparisons_for_user(
        self,
        user_id: str,
        limit: int = 50,
        search: str | None = None,
        status: str = "active",
    ) -> list[SavedComparisonResponse]:
        comparisons = self._collection("saved_comparisons")
        filter_doc: dict = {"user_id": user_id}
        if status == "active":
            filter_doc["archived_at"] = None
        elif status == "archived":
            filter_doc["archived_at"] = {"$ne": None}

        search_filter = self._build_search_filter(
            search,
            ["primary_name", "partner_name", "summary", "notes"],
        )
        if search_filter:
            filter_doc = {"$and": [filter_doc, search_filter]}

        records = (
            comparisons.find(filter_doc)
            .sort("updated_at", DESCENDING)
            .limit(limit)
        )
        return [self._saved_comparison_to_response(record) for record in records]

    def update_saved_comparison_notes(
        self,
        user_id: str,
        saved_comparison_id: str,
        notes: str,
    ) -> SavedComparisonResponse | None:
        comparisons = self._collection("saved_comparisons")
        record = comparisons.find_one_and_update(
            {"user_id": user_id, "saved_comparison_id": saved_comparison_id},
            {
                "$set": {
                    "notes": notes,
                    "updated_at": self._utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return self._saved_comparison_to_response(record) if record else None

    def archive_saved_comparison(
        self,
        user_id: str,
        saved_comparison_id: str,
        archived: bool = True,
    ) -> SavedComparisonResponse | None:
        comparisons = self._collection("saved_comparisons")
        record = comparisons.find_one_and_update(
            {"user_id": user_id, "saved_comparison_id": saved_comparison_id},
            {
                "$set": {
                    "archived_at": self._utc_now() if archived else None,
                    "updated_at": self._utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return self._saved_comparison_to_response(record) if record else None

    def delete_saved_comparison(self, user_id: str, saved_comparison_id: str) -> bool:
        comparisons = self._collection("saved_comparisons")
        result: DeleteResult = comparisons.delete_one(
            {"user_id": user_id, "saved_comparison_id": saved_comparison_id}
        )
        return result.deleted_count > 0
