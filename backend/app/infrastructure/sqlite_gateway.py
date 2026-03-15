import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.config import Settings
from app.models.chart_models import StorageStatus


class SQLiteGateway:
    def __init__(self, settings: Settings) -> None:
        self._db_path = settings.sqlite_db_path
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self) -> None:
        conn = self._get_connection()
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS clients (
                    client_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    birth_date TEXT NOT NULL,
                    birth_time TEXT NOT NULL,
                    timezone_offset_minutes INTEGER NOT NULL,
                    country TEXT DEFAULT '',
                    state TEXT DEFAULT '',
                    city TEXT DEFAULT '',
                    town TEXT DEFAULT '',
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS past_interactions (
                    interaction_id TEXT PRIMARY KEY,
                    client_id TEXT NOT NULL,
                    request_timestamp TEXT NOT NULL,
                    request_type TEXT DEFAULT 'chart_generation',
                    FOREIGN KEY (client_id) REFERENCES clients(client_id)
                );

                CREATE TABLE IF NOT EXISTS findings (
                    finding_id TEXT PRIMARY KEY,
                    client_id TEXT NOT NULL,
                    interaction_id TEXT NOT NULL,
                    julian_day_ut REAL NOT NULL,
                    ascendant_sign TEXT NOT NULL,
                    ascendant_longitude REAL NOT NULL,
                    ascendant_degree_in_sign REAL NOT NULL,
                    planets_json TEXT NOT NULL,
                    houses_json TEXT NOT NULL,
                    FOREIGN KEY (client_id) REFERENCES clients(client_id),
                    FOREIGN KEY (interaction_id) REFERENCES past_interactions(interaction_id)
                );

                CREATE TABLE IF NOT EXISTS readings (
                    reading_id TEXT PRIMARY KEY,
                    client_id TEXT NOT NULL,
                    interaction_id TEXT NOT NULL,
                    rule_title TEXT NOT NULL,
                    rule_insight TEXT NOT NULL,
                    rule_basis TEXT NOT NULL,
                    rule_priority TEXT NOT NULL,
                    FOREIGN KEY (client_id) REFERENCES clients(client_id),
                    FOREIGN KEY (interaction_id) REFERENCES past_interactions(interaction_id)
                );

                CREATE TABLE IF NOT EXISTS future_predictions (
                    prediction_id TEXT PRIMARY KEY,
                    client_id TEXT NOT NULL,
                    interaction_id TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    dominant_element TEXT DEFAULT '',
                    generated_at TEXT NOT NULL,
                    FOREIGN KEY (client_id) REFERENCES clients(client_id),
                    FOREIGN KEY (interaction_id) REFERENCES past_interactions(interaction_id)
                );

                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
            """)
            conn.commit()
        finally:
            conn.close()

    def _find_or_create_client(self, conn: sqlite3.Connection, payload: dict) -> str:
        client_data = payload["client"]
        birth = payload.get("birth", {})

        cursor = conn.execute(
            "SELECT client_id FROM clients WHERE name = ? AND birth_date = ? AND birth_time = ?",
            (client_data["name"], str(birth.get("birth_date", "")), str(birth.get("birth_time", "")))
        )
        row = cursor.fetchone()
        if row:
            return row["client_id"]

        client_id = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO clients
               (client_id, name, birth_date, birth_time, timezone_offset_minutes,
                country, state, city, town, latitude, longitude, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                client_id,
                client_data["name"],
                str(birth.get("birth_date", "")),
                str(birth.get("birth_time", "")),
                client_data.get("timezone_offset_minutes", 0),
                client_data.get("country", ""),
                client_data.get("state", ""),
                client_data.get("city", ""),
                client_data.get("town", ""),
                client_data.get("latitude", 0.0),
                client_data.get("longitude", 0.0),
                datetime.now(timezone.utc).isoformat(),
            )
        )
        return client_id

    def persist_chart(self, payload: dict) -> StorageStatus:
        try:
            conn = self._get_connection()
            client_id = self._find_or_create_client(conn, payload)

            interaction_id = str(uuid.uuid4())
            now_utc = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "INSERT INTO past_interactions (interaction_id, client_id, request_timestamp) VALUES (?, ?, ?)",
                (interaction_id, client_id, now_utc)
            )

            chart = payload["chart"]
            finding_id = str(uuid.uuid4())
            conn.execute(
                """INSERT INTO findings
                   (finding_id, client_id, interaction_id, julian_day_ut,
                    ascendant_sign, ascendant_longitude, ascendant_degree_in_sign,
                    planets_json, houses_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    finding_id,
                    client_id,
                    interaction_id,
                    chart["julian_day_ut"],
                    chart["ascendant"]["sign"],
                    chart["ascendant"]["longitude"],
                    chart["ascendant"]["degree_in_sign"],
                    json.dumps(chart["planets"]),
                    json.dumps(chart["houses"]),
                )
            )

            for rule in chart.get("deterministic_rules", []):
                reading_id = str(uuid.uuid4())
                conn.execute(
                    """INSERT INTO readings
                       (reading_id, client_id, interaction_id,
                        rule_title, rule_insight, rule_basis, rule_priority)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        reading_id,
                        client_id,
                        interaction_id,
                        rule["title"],
                        rule["insight"],
                        rule["basis"],
                        rule["priority"],
                    )
                )

            prediction_id = str(uuid.uuid4())
            dominant = ""
            for rule in chart.get("deterministic_rules", []):
                if "element" in rule.get("title", "").lower():
                    dominant = rule.get("basis", "")
                    break

            conn.execute(
                """INSERT INTO future_predictions
                   (prediction_id, client_id, interaction_id, summary, dominant_element, generated_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    prediction_id,
                    client_id,
                    interaction_id,
                    chart.get("summary", ""),
                    dominant,
                    now_utc,
                )
            )

            conn.commit()
            conn.close()

            return StorageStatus(
                configured=True,
                persisted=True,
                message=f"Chart saved to local database (client: {client_id[:8]}...)"
            )

        except Exception as exc:
            return StorageStatus(
                configured=True,
                persisted=False,
                message=f"SQLite write failed: {exc}"
            )

    def create_user(self, user_id: str, email: str, password_hash: str, display_name: str) -> None:
        conn = self._get_connection()
        try:
            conn.execute(
                """INSERT INTO users (user_id, email, password_hash, display_name, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (user_id, email, password_hash, display_name, datetime.now(timezone.utc).isoformat())
            )
            conn.commit()
        finally:
            conn.close()

    def find_user_by_email(self, email: str) -> dict | None:
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
        finally:
            conn.close()

    @property
    def configured(self) -> bool:
        return True
