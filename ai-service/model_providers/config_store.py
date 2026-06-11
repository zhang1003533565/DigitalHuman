from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path


PROVIDERS_ROOT = Path(__file__).resolve().parent
IGNORED_PROVIDER_DIRS = {"config", "docs", "__pycache__"}
RUNTIME_DIR = Path(__file__).resolve().parents[1] / ".runtime"
DB_PATH = RUNTIME_DIR / "ai_service_config.sqlite"


@dataclass
class LlmRuntimeConfig:
    provider: str
    model: str
    timeout_seconds: int


@dataclass
class AgentModelBinding:
    agent: str
    category: str
    provider: str
    model: str
    timeout_seconds: int
    enabled: bool


AGENT_MODEL_DEFAULTS: list[AgentModelBinding] = [
    AgentModelBinding(
        agent="basic_chat_agent",
        category="chat",
        provider="DeepSeek",
        model="deepseek-v4-flash",
        timeout_seconds=90,
        enabled=True,
    ),
    AgentModelBinding(
        agent="leader_agent",
        category="chat",
        provider="DeepSeek",
        model="deepseek-v4-flash",
        timeout_seconds=90,
        enabled=True,
    ),
    AgentModelBinding(
        agent="travel_analytics_agent",
        category="multimodal",
        provider="DeepSeek",
        model="deepseek-v4-flash",
        timeout_seconds=90,
        enabled=False,
    ),
    AgentModelBinding(
        agent="scenic_structured_agent",
        category="chat",
        provider="DeepSeek",
        model="deepseek-v4-flash",
        timeout_seconds=90,
        enabled=False,
    ),
    AgentModelBinding(
        agent="guide_script_agent",
        category="chat",
        provider="DeepSeek",
        model="deepseek-v4-flash",
        timeout_seconds=90,
        enabled=False,
    ),
]


def provider_key(provider: str) -> str:
    return provider.strip().lower().replace(" ", "_").replace("-", "_")


def _connect() -> sqlite3.Connection:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS provider_configs (
                provider TEXT PRIMARY KEY,
                protocol TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS llm_runtime_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                timeout_seconds INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS agent_model_bindings (
                agent TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                timeout_seconds INTEGER NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1
            )
            """
        )
        conn.commit()


def ensure_default_deepseek_config() -> None:
    _ensure_db()
    with _connect() as conn:
        row = conn.execute("SELECT provider FROM provider_configs WHERE LOWER(provider)=LOWER(?)", ("DeepSeek",)).fetchone()
        if row is None:
            conn.execute(
                """
                INSERT INTO provider_configs(provider, protocol, base_url, api_key)
                VALUES(?, ?, ?, ?)
                """,
                ("DeepSeek", "openai_compatible", "https://api.deepseek.com", "PLEASE_SET_REAL_DEEPSEEK_API_KEY"),
            )
        runtime = conn.execute("SELECT id FROM llm_runtime_config WHERE id=1").fetchone()
        if runtime is None:
            conn.execute(
                """
                INSERT INTO llm_runtime_config(id, provider, model, timeout_seconds)
                VALUES(1, ?, ?, ?)
                """,
                ("DeepSeek", "deepseek-v4-flash", 90),
            )
        existing_agents = {
            str(row["agent"]).strip()
            for row in conn.execute("SELECT agent FROM agent_model_bindings").fetchall()
        }
        for item in AGENT_MODEL_DEFAULTS:
            if item.agent in existing_agents:
                continue
            conn.execute(
                """
                INSERT INTO agent_model_bindings(agent, category, provider, model, timeout_seconds, enabled)
                VALUES(?, ?, ?, ?, ?, ?)
                """,
                (
                    item.agent,
                    item.category,
                    item.provider,
                    item.model,
                    int(item.timeout_seconds),
                    1 if item.enabled else 0,
                ),
            )
        conn.commit()


def load_provider_configs() -> list[dict[str, str]]:
    _ensure_db()
    configs: list[dict[str, str]] = []
    with _connect() as conn:
        rows = conn.execute(
            "SELECT provider, protocol, base_url, api_key FROM provider_configs ORDER BY LOWER(provider)"
        ).fetchall()
    for row in rows:
        configs.append(
            {
                "provider": str(row["provider"]),
                "protocol": str(row["protocol"]),
                "baseUrl": str(row["base_url"]),
                "apiKey": str(row["api_key"]),
            }
        )
    configs.sort(key=lambda item: str(item.get("provider", "")).lower())
    return configs


def save_provider_config(provider: str, base_url: str, api_key: str, protocol: str = "openai_compatible") -> dict[str, str]:
    _ensure_db()
    normalized_provider = provider.strip()
    next_item = {
        "provider": normalized_provider,
        "protocol": protocol.strip() or "openai_compatible",
        "baseUrl": base_url.strip().rstrip("/"),
        "apiKey": api_key.strip(),
    }
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO provider_configs(provider, protocol, base_url, api_key, updated_at)
            VALUES(?, ?, ?, ?, datetime('now'))
            ON CONFLICT(provider) DO UPDATE SET
                protocol=excluded.protocol,
                base_url=excluded.base_url,
                api_key=excluded.api_key,
                updated_at=datetime('now')
            """,
            (
                next_item["provider"],
                next_item["protocol"],
                next_item["baseUrl"],
                next_item["apiKey"],
            ),
        )
        conn.commit()
    return next_item


def delete_provider_config(provider: str) -> None:
    _ensure_db()
    with _connect() as conn:
        conn.execute("DELETE FROM provider_configs WHERE LOWER(provider)=LOWER(?)", (provider.strip(),))
        conn.commit()


def find_provider_config(provider: str) -> dict[str, str] | None:
    normalized = provider.strip().lower()
    return next(
        (item for item in load_provider_configs() if str(item.get("provider", "")).strip().lower() == normalized),
        None,
    )


def load_llm_runtime_config() -> LlmRuntimeConfig:
    _ensure_db()
    ensure_default_deepseek_config()
    with _connect() as conn:
        row = conn.execute("SELECT provider, model, timeout_seconds FROM llm_runtime_config WHERE id=1").fetchone()
    if row is None:
        raise RuntimeError("LLM runtime config is missing in database")
    return LlmRuntimeConfig(
        provider=str(row["provider"]),
        model=str(row["model"]),
        timeout_seconds=int(row["timeout_seconds"]),
    )


def save_llm_runtime_config(provider: str, model: str, timeout_seconds: int) -> LlmRuntimeConfig:
    _ensure_db()
    normalized_provider = provider.strip()
    normalized_model = model.strip()
    if not normalized_provider or not normalized_model:
        raise ValueError("provider/model cannot be blank")
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO llm_runtime_config(id, provider, model, timeout_seconds)
            VALUES(1, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                provider=excluded.provider,
                model=excluded.model,
                timeout_seconds=excluded.timeout_seconds
            """,
            (normalized_provider, normalized_model, int(timeout_seconds)),
        )
        conn.commit()
    return LlmRuntimeConfig(provider=normalized_provider, model=normalized_model, timeout_seconds=int(timeout_seconds))


def list_agent_model_bindings() -> list[AgentModelBinding]:
    _ensure_db()
    ensure_default_deepseek_config()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT agent, category, provider, model, timeout_seconds, enabled
            FROM agent_model_bindings
            ORDER BY agent
            """
        ).fetchall()
    return [
        AgentModelBinding(
            agent=str(row["agent"]),
            category=str(row["category"]),
            provider=str(row["provider"]),
            model=str(row["model"]),
            timeout_seconds=int(row["timeout_seconds"]),
            enabled=bool(int(row["enabled"])),
        )
        for row in rows
    ]


def save_agent_model_bindings(items: list[AgentModelBinding]) -> list[AgentModelBinding]:
    _ensure_db()
    with _connect() as conn:
        for item in items:
            conn.execute(
                """
                INSERT INTO agent_model_bindings(agent, category, provider, model, timeout_seconds, enabled)
                VALUES(?, ?, ?, ?, ?, ?)
                ON CONFLICT(agent) DO UPDATE SET
                    category=excluded.category,
                    provider=excluded.provider,
                    model=excluded.model,
                    timeout_seconds=excluded.timeout_seconds,
                    enabled=excluded.enabled
                """,
                (
                    item.agent.strip(),
                    item.category.strip(),
                    item.provider.strip(),
                    item.model.strip(),
                    int(item.timeout_seconds),
                    1 if item.enabled else 0,
                ),
            )
        conn.commit()
    return list_agent_model_bindings()


def get_agent_model_binding(agent: str) -> AgentModelBinding | None:
    normalized = agent.strip()
    if not normalized:
        return None
    return next((item for item in list_agent_model_bindings() if item.agent == normalized), None)


def ensure_agent_model_defaults(agent_names: list[str]) -> None:
    _ensure_db()
    if not agent_names:
        return

    default_by_agent = {item.agent: item for item in AGENT_MODEL_DEFAULTS}
    with _connect() as conn:
        existing = {
            str(row["agent"]).strip()
            for row in conn.execute("SELECT agent FROM agent_model_bindings").fetchall()
        }
        for agent in agent_names:
            normalized = agent.strip()
            if not normalized or normalized in existing:
                continue
            default = default_by_agent.get(normalized)
            if default is None:
                default = AgentModelBinding(
                    agent=normalized,
                    category="chat",
                    provider="DeepSeek",
                    model="deepseek-v4-flash",
                    timeout_seconds=90,
                    enabled=False,
                )
            conn.execute(
                """
                INSERT INTO agent_model_bindings(agent, category, provider, model, timeout_seconds, enabled)
                VALUES(?, ?, ?, ?, ?, ?)
                """,
                (
                    default.agent,
                    default.category,
                    default.provider,
                    default.model,
                    int(default.timeout_seconds),
                    1 if default.enabled else 0,
                ),
            )
        conn.commit()
