from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path


class ConversationMemoryStore:
    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(str(db_path), check_same_thread=False)
        self.lock = threading.Lock()
        self._setup()

    def load(self, session_id: str, limit: int = 8) -> list[dict[str, str]]:
        with self.lock:
            rows = self.connection.execute(
                """
                SELECT role, content
                FROM rag_conversation_memory
                WHERE session_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        return [{"role": role, "content": content} for role, content in reversed(rows)]

    def append(self, session_id: str, question: str, answer: str, max_messages: int = 24) -> None:
        now = int(time.time() * 1000)
        with self.lock:
            self.connection.executemany(
                """
                INSERT INTO rag_conversation_memory(session_id, role, content, created_at)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (session_id, "user", question, now),
                    (session_id, "assistant", answer, now + 1),
                ],
            )
            self.connection.execute(
                """
                DELETE FROM rag_conversation_memory
                WHERE session_id = ?
                  AND id NOT IN (
                    SELECT id
                    FROM rag_conversation_memory
                    WHERE session_id = ?
                    ORDER BY id DESC
                    LIMIT ?
                  )
                """,
                (session_id, session_id, max_messages),
            )
            self.connection.commit()

    def _setup(self) -> None:
        with self.lock:
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS rag_conversation_memory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                )
                """
            )
            self.connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_rag_conversation_memory_session
                ON rag_conversation_memory(session_id, id)
                """
            )
            self.connection.commit()
