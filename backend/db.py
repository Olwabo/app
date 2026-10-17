import os
import logging
from decimal import Decimal
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
DATABASE_URL = os.environ["DATABASE_URL"]
MIGRATIONS_DIR = Path(__file__).parent / "migrations"
logger = logging.getLogger("amanzi.db")

_pool = None


async def init_pool():
    global _pool
    _pool = await asyncpg.create_pool(
        DATABASE_URL, min_size=2, max_size=10, statement_cache_size=0, command_timeout=30
    )


def pool() -> asyncpg.Pool:
    return _pool


async def close_pool():
    if _pool:
        await _pool.close()


def D(x) -> Decimal:
    return Decimal(str(round(float(x), 2)))


def row(r):
    return dict(r) if r else None


def rows(rs):
    return [dict(r) for r in rs]


async def run_migrations():
    async with _pool.acquire() as conn:
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());"
            "ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;"
            "REVOKE ALL ON schema_migrations FROM anon, authenticated;"
        )
        done = {r["name"] for r in await conn.fetch("SELECT name FROM schema_migrations")}
        for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if f.name in done:
                continue
            async with conn.transaction():
                await conn.execute(f.read_text())
                await conn.execute("INSERT INTO schema_migrations (name) VALUES ($1)", f.name)
            logger.info("Applied migration %s", f.name)
