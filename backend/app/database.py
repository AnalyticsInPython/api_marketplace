from __future__ import annotations

import sqlite3
import threading
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True, slots=True)
class EndpointRecord:
    id: str
    name: str
    base_url: str
    model_name: str
    created_at: str
    last_seen_at: str


class EndpointRegistry:
    """Small synchronous SQLite registry guarded for use from request threads."""

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA foreign_keys=ON")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS endpoints (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                base_url TEXT NOT NULL UNIQUE,
                model_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL
            )
            """
        )
        self._connection.commit()

    def register(self, name: str, base_url: str, model_name: str) -> EndpointRecord:
        now = utc_now()
        with self._lock:
            rows = self._connection.execute(
                "SELECT * FROM endpoints WHERE name = ? OR base_url = ?",
                (name, base_url),
            ).fetchall()
            if len(rows) > 1:
                raise ValueError("name and base URL belong to different endpoints")
            row = rows[0] if rows else None
            if row is None:
                endpoint_id = str(uuid.uuid4())
                self._connection.execute(
                    """
                    INSERT INTO endpoints
                        (id, name, base_url, model_name, created_at, last_seen_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (endpoint_id, name, base_url, model_name, now, now),
                )
            else:
                endpoint_id = row["id"]
                self._connection.execute(
                    """
                    UPDATE endpoints
                    SET name = ?, base_url = ?, model_name = ?, last_seen_at = ?
                    WHERE id = ?
                    """,
                    (name, base_url, model_name, now, endpoint_id),
                )
            self._connection.commit()
            updated = self._connection.execute(
                "SELECT * FROM endpoints WHERE id = ?", (endpoint_id,)
            ).fetchone()
        return EndpointRecord(**dict(updated))

    def touch(self, endpoint_id: str) -> None:
        with self._lock:
            self._connection.execute(
                "UPDATE endpoints SET last_seen_at = ? WHERE id = ?",
                (utc_now(), endpoint_id),
            )
            self._connection.commit()

    def delete(self, endpoint_id: str) -> bool:
        with self._lock:
            cursor = self._connection.execute(
                "DELETE FROM endpoints WHERE id = ?", (endpoint_id,)
            )
            self._connection.commit()
        return cursor.rowcount > 0

    def list_all(self) -> list[EndpointRecord]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT * FROM endpoints ORDER BY created_at, name"
            ).fetchall()
        return [EndpointRecord(**dict(row)) for row in rows]

    def close(self) -> None:
        with self._lock:
            self._connection.close()
