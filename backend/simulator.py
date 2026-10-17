import asyncio
import logging
import math
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from db import D, pool
from emailer import critical_incident_email, send_email

load_dotenv(Path(__file__).parent / ".env")
logger = logging.getLogger("amanzi.sim")
INTERVAL = int(os.environ["SIMULATOR_INTERVAL_SECONDS"])
ENABLED = os.environ["SIMULATOR_ENABLED"].lower() == "true"

SIM_STATE: dict[str, dict] = {}
_reservoir: dict[str, float] = {}
SCENARIO_CATEGORY = {"PIPE_BURST": "PIPE_BURST", "MICRO_LEAK": "MICRO_LEAK", "PUMP_TRIP": "PUMP_TRIP_POWER"}

INSERT_SQL = ("INSERT INTO telemetry_logs (node_id, pressure_bar, flow_m3h, reservoir_pct, pump_active, pump_power_kw) "
              "VALUES ($1, $2, $3, $4, $5, $6)")


def _diurnal() -> float:
    h = datetime.now(timezone.utc).hour + 2 + datetime.now(timezone.utc).minute / 60
    return 0.5 + 0.5 * math.sin((h - 6) / 24 * 2 * math.pi)


def normal_reading(twin: dict, res: float):
    ep, ef = float(twin["expected_pressure_bar"]), float(twin["expected_flow_m3h"])
    flow = min(ef * (0.55 + 0.35 * _diurnal() + random.uniform(-0.05, 0.08)), ef * 1.05)
    pressure = ep * random.uniform(0.94, 1.05)
    res = max(float(twin["min_reservoir_pct"]) + 8, min(96, res + random.uniform(-0.6, 0.65)))
    return pressure, flow, res, True, flow * 0.19 + random.uniform(-0.4, 0.4)


def scenario_reading(scenario: str, twin: dict, res: float):
    ep, ef = float(twin["expected_pressure_bar"]), float(twin["expected_flow_m3h"])
    if scenario == "PIPE_BURST":
        f = ef * random.uniform(1.55, 1.75)
        return ep * random.uniform(0.45, 0.55), f, max(res - 0.9, 3), True, f * 0.21
    if scenario == "MICRO_LEAK":
        return ep * random.uniform(0.76, 0.82), ef * random.uniform(0.6, 0.8), max(res - 0.3, 3), True, ef * 0.13
    return ep * random.uniform(0.9, 0.95), random.uniform(0.4, 2.0), max(res - 0.5, 3), False, 0.0


async def insert_reading(conn, node_id, reading):
    p, f, r, active, kw = reading
    await conn.execute(INSERT_SQL, node_id, D(p), D(f), D(r), active, D(max(kw, 0)))


async def inject(node_id, twin: dict, scenario: str, simulated: bool):
    key = str(node_id)
    res = _reservoir.get(key, 70.0)
    if simulated:
        SIM_STATE[key] = {"scenario": scenario, "since": time.time()}
    async with pool().acquire() as conn:
        await insert_reading(conn, node_id, scenario_reading(scenario, twin, res))


def clear_node(node_id):
    SIM_STATE.pop(str(node_id), None)


async def _tick():
    p = pool()
    if not _reservoir:
        for r in await p.fetch("SELECT node_id, reservoir_pct FROM latest_telemetry"):
            _reservoir[str(r["node_id"])] = float(r["reservoir_pct"])
    nodes = await p.fetch(
        "SELECT n.id, n.battery_pct, t.expected_pressure_bar, t.expected_flow_m3h, t.min_reservoir_pct "
        "FROM sensor_nodes n JOIN digital_twin_profiles t ON t.node_id = n.id WHERE n.device_eui LIKE 'SIM-%'"
    )
    open_nodes = {str(r["node_id"]) for r in await p.fetch(
        "SELECT DISTINCT node_id FROM incident_alerts WHERE status <> 'RESOLVED'")}
    async with p.acquire() as conn:
        for n in nodes:
            key = str(n["id"])
            state = SIM_STATE.get(key)
            if state and key not in open_nodes and time.time() - state["since"] > 20:
                SIM_STATE.pop(key, None)
                state = None
            res = _reservoir.get(key, random.uniform(55, 85))
            reading = scenario_reading(state["scenario"], dict(n), res) if state else normal_reading(dict(n), res)
            _reservoir[key] = reading[2]
            await insert_reading(conn, n["id"], reading)
            if random.random() < 0.05:
                batt = float(n["battery_pct"] or 100) - 0.05
                await conn.execute("UPDATE sensor_nodes SET battery_pct = $1 WHERE id = $2",
                                   D(100 if batt < 15 else batt), n["id"])


async def _maintenance():
    p = pool()
    await p.execute("UPDATE sensor_nodes SET status = 'OFFLINE' "
                    "WHERE last_ping < NOW() - INTERVAL '10 minutes' AND status <> 'OFFLINE'")
    await p.execute("DELETE FROM telemetry_logs WHERE recorded_at < NOW() - INTERVAL '3 days' "
                    "AND node_id IN (SELECT id FROM sensor_nodes WHERE device_eui LIKE 'SIM-%')")


async def _email_pass():
    p = pool()
    pending = await p.fetch(
        "SELECT i.*, o.name AS org_name, s.name AS site_name, n.label AS node_label FROM incident_alerts i "
        "JOIN organizations o ON o.id = i.org_id JOIN sites s ON s.id = i.site_id "
        "JOIN sensor_nodes n ON n.id = i.node_id LEFT JOIN org_settings os ON os.org_id = i.org_id "
        "WHERE i.severity = 'CRITICAL' AND i.created_at > NOW() - INTERVAL '1 hour' "
        "AND COALESCE(os.email_critical_alerts, TRUE) "
        "AND NOT EXISTS (SELECT 1 FROM incident_notifications x WHERE x.incident_id = i.id) LIMIT 20"
    )
    for inc in pending:
        admins = [r["email"] for r in await p.fetch(
            "SELECT email FROM profiles WHERE org_id = $1 AND role = 'ORG_ADMIN'", inc["org_id"])]
        claimed = await p.fetchval(
            "INSERT INTO incident_notifications (incident_id, recipients, status) VALUES ($1, $2, 'SENDING') "
            "ON CONFLICT DO NOTHING RETURNING incident_id", inc["id"], ",".join(admins))
        if not claimed:
            continue
        subject, html = critical_incident_email(dict(inc))
        results = [await send_email(to=a, subject=subject, html=html) for a in admins]
        status = "SENT" if results and all(results) else ("NO_RECIPIENTS" if not admins else "FAILED")
        await p.execute("UPDATE incident_notifications SET status = $1 WHERE incident_id = $2", status, inc["id"])


async def _loop(fn, every: int, name: str):
    while True:
        try:
            await fn()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("%s loop error", name)
        await asyncio.sleep(every)


def start_background() -> list:
    tasks = [asyncio.create_task(_loop(_maintenance, 60, "maintenance")),
             asyncio.create_task(_loop(_email_pass, 15, "email"))]
    if ENABLED:
        tasks.append(asyncio.create_task(_loop(_tick, INTERVAL, "simulator")))
    return tasks
