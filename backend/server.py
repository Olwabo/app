import hashlib
import logging
import os
import secrets
import uuid
from contextlib import asynccontextmanager
from typing import Literal, Optional

import asyncpg
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

import simulator
from auth import create_auth_user, delete_auth_user, get_current_user, require_platform_admin, require_roles
from db import D, close_pool, init_pool, pool, row, rows, run_migrations
from seed import seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("amanzi")

ADMIN = require_roles("ORG_ADMIN")
OPS = require_roles("ORG_ADMIN", "OPERATOR")
Sector = Literal["MANUFACTURING", "AGRICO", "COMMERCIAL_ESTATE", "MUNICIPAL"]
Role = Literal["ORG_ADMIN", "OPERATOR", "VIEWER"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    await run_migrations()
    try:
        await seed()
    except Exception:
        logger.exception("Seeding failed")
    tasks = simulator.start_background()
    yield
    for t in tasks:
        t.cancel()
    await close_pool()


app = FastAPI(title="AmanziAlert API", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------- Models ----------
class OrgUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    sector: Optional[Sector] = None
    tariff_zar_per_kl: Optional[float] = Field(None, ge=0, le=10000)


class AlertSettings(BaseModel):
    email_critical_alerts: bool


class SiteIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    location_label: str = Field(min_length=2, max_length=160)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class NodeIn(BaseModel):
    site_id: uuid.UUID
    device_eui: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9:_\-]+$")
    label: str = Field(min_length=2, max_length=120)


class NodeUpdate(BaseModel):
    label: str = Field(min_length=2, max_length=120)


class TwinIn(BaseModel):
    expected_pressure_bar: float = Field(gt=0, le=100)
    expected_flow_m3h: float = Field(gt=0, le=100000)
    min_reservoir_pct: float = Field(ge=0, le=100)
    night_leak_threshold_m3h: float = Field(ge=0, le=10000)
    tolerance_pct: float = Field(ge=1, le=100)


class DispatchIn(BaseModel):
    technician: str = Field(min_length=2, max_length=80)


class SimulateIn(BaseModel):
    node_id: uuid.UUID
    scenario: Literal["PIPE_BURST", "MICRO_LEAK", "PUMP_TRIP"]


class IngestIn(BaseModel):
    device_eui: str = Field(min_length=3, max_length=64)
    pressure_bar: float = Field(ge=0, le=100)
    flow_m3h: float = Field(ge=0, le=100000)
    reservoir_pct: float = Field(ge=0, le=100)
    pump_active: bool = True
    pump_power_kw: float = Field(0.0, ge=0, le=10000)
    battery_pct: Optional[float] = Field(None, ge=0, le=100)


class MemberIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=80)
    role: Role = "OPERATOR"
    password: str = Field(min_length=8, max_length=72)


class RoleIn(BaseModel):
    role: Role


class OrgCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    sector: Sector
    tariff_zar_per_kl: float = Field(42.50, ge=0, le=10000)
    admin_email: EmailStr
    admin_full_name: str = Field(min_length=2, max_length=80)
    admin_password: str = Field(min_length=8, max_length=72)


# ---------- Helpers ----------
async def org_node(node_id: uuid.UUID, org_id) -> dict:
    n = await pool().fetchrow("SELECT * FROM sensor_nodes WHERE id = $1 AND org_id = $2", node_id, org_id)
    if not n:
        raise HTTPException(status_code=404, detail="Sensor node not found")
    return dict(n)


async def org_incident(incident_id: uuid.UUID, org_id) -> dict:
    i = await pool().fetchrow("SELECT * FROM incident_alerts WHERE id = $1 AND org_id = $2", incident_id, org_id)
    if not i:
        raise HTTPException(status_code=404, detail="Incident not found")
    return dict(i)


def public_profile(u: dict) -> dict:
    return {k: u[k] for k in ("id", "org_id", "email", "full_name", "role", "is_platform_admin",
                              "org_name", "sector", "tariff_zar_per_kl")}


# ---------- Routes ----------
@api.get("/health")
async def health():
    await pool().fetchval("SELECT 1")
    return {"ok": True, "simulator": simulator.ENABLED}


@api.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_profile(user)


@api.patch("/org")
async def update_org(body: OrgUpdate, user: dict = Depends(ADMIN)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "tariff_zar_per_kl" in data:
        data["tariff_zar_per_kl"] = D(data["tariff_zar_per_kl"])
    cols = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(data))
    r = await pool().fetchrow(f"UPDATE organizations SET {cols} WHERE id = $1 RETURNING *", user["org_id"], *data.values())
    return row(r)


@api.get("/org/alert-settings")
async def get_alert_settings(user: dict = Depends(get_current_user)):
    v = await pool().fetchval("SELECT email_critical_alerts FROM org_settings WHERE org_id = $1", user["org_id"])
    return {"email_critical_alerts": True if v is None else v}


@api.put("/org/alert-settings")
async def put_alert_settings(body: AlertSettings, user: dict = Depends(ADMIN)):
    await pool().execute(
        "INSERT INTO org_settings (org_id, email_critical_alerts) VALUES ($1, $2) ON CONFLICT (org_id) "
        "DO UPDATE SET email_critical_alerts = EXCLUDED.email_critical_alerts, updated_at = NOW()",
        user["org_id"], body.email_critical_alerts)
    return body.model_dump()


@api.get("/org/ingest-key")
async def get_ingest_key(user: dict = Depends(ADMIN)):
    r = await pool().fetchrow("SELECT key_prefix, created_at FROM org_ingest_keys WHERE org_id = $1", user["org_id"])
    return {"exists": bool(r), **(dict(r) if r else {})}


@api.post("/org/ingest-key")
async def rotate_ingest_key(user: dict = Depends(ADMIN)):
    key = "amz_" + secrets.token_urlsafe(32)
    await pool().execute(
        "INSERT INTO org_ingest_keys (org_id, key_hash, key_prefix) VALUES ($1, $2, $3) ON CONFLICT (org_id) "
        "DO UPDATE SET key_hash = EXCLUDED.key_hash, key_prefix = EXCLUDED.key_prefix, created_at = NOW()",
        user["org_id"], hashlib.sha256(key.encode()).hexdigest(), key[:10])
    return {"api_key": key, "key_prefix": key[:10]}


@api.post("/sites", status_code=201)
async def create_site(body: SiteIn, user: dict = Depends(ADMIN)):
    r = await pool().fetchrow(
        "INSERT INTO sites (org_id, name, location_label, latitude, longitude) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        user["org_id"], body.name, body.location_label,
        None if body.latitude is None else D(body.latitude), None if body.longitude is None else D(body.longitude))
    return row(r)


@api.delete("/sites/{site_id}")
async def delete_site(site_id: uuid.UUID, user: dict = Depends(ADMIN)):
    async with pool().acquire() as c, c.transaction():
        if not await c.fetchval("SELECT 1 FROM sites WHERE id = $1 AND org_id = $2", site_id, user["org_id"]):
            raise HTTPException(status_code=404, detail="Site not found")
        await c.execute("DELETE FROM incident_alerts WHERE site_id = $1", site_id)
        await c.execute("DELETE FROM sites WHERE id = $1", site_id)
    return {"ok": True}


@api.post("/nodes", status_code=201)
async def create_node(body: NodeIn, user: dict = Depends(ADMIN)):
    async with pool().acquire() as c, c.transaction():
        if not await c.fetchval("SELECT 1 FROM sites WHERE id = $1 AND org_id = $2", body.site_id, user["org_id"]):
            raise HTTPException(status_code=404, detail="Site not found")
        try:
            n = await c.fetchrow(
                "INSERT INTO sensor_nodes (org_id, site_id, device_eui, label) VALUES ($1,$2,$3,$4) RETURNING *",
                user["org_id"], body.site_id, body.device_eui.strip(), body.label)
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="A node with this device EUI already exists")
        await c.execute("INSERT INTO digital_twin_profiles (node_id) VALUES ($1)", n["id"])
    return row(n)


@api.patch("/nodes/{node_id}")
async def update_node(node_id: uuid.UUID, body: NodeUpdate, user: dict = Depends(ADMIN)):
    await org_node(node_id, user["org_id"])
    return row(await pool().fetchrow("UPDATE sensor_nodes SET label = $1 WHERE id = $2 RETURNING *", body.label, node_id))


@api.delete("/nodes/{node_id}")
async def delete_node(node_id: uuid.UUID, user: dict = Depends(ADMIN)):
    await org_node(node_id, user["org_id"])
    async with pool().acquire() as c, c.transaction():
        await c.execute("DELETE FROM incident_alerts WHERE node_id = $1", node_id)
        await c.execute("DELETE FROM sensor_nodes WHERE id = $1", node_id)
    simulator.clear_node(node_id)
    return {"ok": True}


@api.put("/nodes/{node_id}/twin")
async def update_twin(node_id: uuid.UUID, body: TwinIn, user: dict = Depends(ADMIN)):
    await org_node(node_id, user["org_id"])
    v = body.model_dump()
    r = await pool().fetchrow(
        "INSERT INTO digital_twin_profiles (node_id, expected_pressure_bar, expected_flow_m3h, min_reservoir_pct, "
        "night_leak_threshold_m3h, tolerance_pct) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (node_id) DO UPDATE SET "
        "expected_pressure_bar = EXCLUDED.expected_pressure_bar, expected_flow_m3h = EXCLUDED.expected_flow_m3h, "
        "min_reservoir_pct = EXCLUDED.min_reservoir_pct, night_leak_threshold_m3h = EXCLUDED.night_leak_threshold_m3h, "
        "tolerance_pct = EXCLUDED.tolerance_pct RETURNING *",
        node_id, *[D(x) for x in v.values()])
    return row(r)


@api.post("/incidents/{incident_id}/dispatch")
async def dispatch_incident(incident_id: uuid.UUID, body: DispatchIn, user: dict = Depends(OPS)):
    inc = await org_incident(incident_id, user["org_id"])
    if inc["status"] == "RESOLVED":
        raise HTTPException(status_code=400, detail="Incident is already resolved")
    return row(await pool().fetchrow(
        "UPDATE incident_alerts SET status = 'DISPATCHED', assigned_technician = $1 WHERE id = $2 RETURNING *",
        body.technician.strip(), incident_id))


@api.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: uuid.UUID, user: dict = Depends(OPS)):
    inc = await org_incident(incident_id, user["org_id"])
    if inc["status"] == "RESOLVED":
        raise HTTPException(status_code=400, detail="Incident is already resolved")
    async with pool().acquire() as c, c.transaction():
        r = await c.fetchrow("UPDATE incident_alerts SET status = 'RESOLVED', resolved_at = NOW() WHERE id = $1 RETURNING *",
                             incident_id)
        worst = await c.fetchval(
            "SELECT MAX(CASE severity WHEN 'CRITICAL' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END) FROM incident_alerts "
            "WHERE node_id = $1 AND status <> 'RESOLVED'", inc["node_id"])
        still_open = worst is not None
        new_status = {3: "CRITICAL", 2: "WARNING"}.get(worst, "ONLINE")
        await c.execute("UPDATE sensor_nodes SET status = $1 WHERE id = $2 AND status <> 'OFFLINE'", new_status, inc["node_id"])
    if not still_open:
        simulator.clear_node(inc["node_id"])
    return row(r)


@api.post("/simulate")
async def simulate(body: SimulateIn, user: dict = Depends(OPS)):
    node = await org_node(body.node_id, user["org_id"])
    twin = await pool().fetchrow("SELECT * FROM digital_twin_profiles WHERE node_id = $1", body.node_id)
    if not twin:
        raise HTTPException(status_code=400, detail="This node has no Digital Twin profile")
    await simulator.inject(body.node_id, dict(twin), body.scenario, node["device_eui"].startswith("SIM-"))
    inc = await pool().fetchrow(
        "SELECT * FROM incident_alerts WHERE node_id = $1 AND category = $2 AND status <> 'RESOLVED' "
        "ORDER BY created_at DESC LIMIT 1", body.node_id, simulator.SCENARIO_CATEGORY[body.scenario])
    return {"ok": True, "incident": row(inc)}


@api.post("/ingest/telemetry", status_code=202)
async def ingest(body: IngestIn, x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-Api-Key header")
    org_id = await pool().fetchval("SELECT org_id FROM org_ingest_keys WHERE key_hash = $1",
                                   hashlib.sha256(x_api_key.encode()).hexdigest())
    if not org_id:
        raise HTTPException(status_code=401, detail="Invalid ingest key")
    node = await pool().fetchrow("SELECT id, status FROM sensor_nodes WHERE device_eui = $1 AND org_id = $2",
                                 body.device_eui, org_id)
    if not node:
        raise HTTPException(status_code=404, detail="Unknown device_eui for this organization")
    async with pool().acquire() as c, c.transaction():
        if node["status"] == "OFFLINE":
            await c.execute("UPDATE sensor_nodes SET status = 'ONLINE' WHERE id = $1", node["id"])
        if body.battery_pct is not None:
            await c.execute("UPDATE sensor_nodes SET battery_pct = $1 WHERE id = $2", D(body.battery_pct), node["id"])
        tid = await c.fetchval(
            simulator.INSERT_SQL + " RETURNING id", node["id"], D(body.pressure_bar), D(body.flow_m3h),
            D(body.reservoir_pct), body.pump_active, D(body.pump_power_kw))
    return {"accepted": True, "telemetry_id": tid}


@api.get("/team")
async def list_team(user: dict = Depends(get_current_user)):
    return rows(await pool().fetch(
        "SELECT id, email, full_name, role, created_at FROM profiles WHERE org_id = $1 ORDER BY created_at", user["org_id"]))


async def provision_member(org_id, email: str, full_name: str, role: str, password: str) -> dict:
    if await pool().fetchval("SELECT 1 FROM auth.users WHERE lower(email) = lower($1)", email):
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    uid = await create_auth_user(email, password, full_name)
    try:
        return row(await pool().fetchrow(
            "INSERT INTO profiles (id, org_id, email, full_name, role) VALUES ($1,$2,$3,$4,$5) "
            "RETURNING id, email, full_name, role, created_at", uid, org_id, email.lower(), full_name, role))
    except Exception:
        await delete_auth_user(uid)
        raise


@api.post("/team", status_code=201)
async def add_member(body: MemberIn, user: dict = Depends(ADMIN)):
    return await provision_member(user["org_id"], body.email, body.full_name, body.role, body.password)


@api.patch("/team/{member_id}")
async def change_role(member_id: uuid.UUID, body: RoleIn, user: dict = Depends(ADMIN)):
    if member_id == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    r = await pool().fetchrow("UPDATE profiles SET role = $1 WHERE id = $2 AND org_id = $3 "
                              "RETURNING id, email, full_name, role, created_at", body.role, member_id, user["org_id"])
    if not r:
        raise HTTPException(status_code=404, detail="Member not found")
    return row(r)


@api.delete("/team/{member_id}")
async def remove_member(member_id: uuid.UUID, user: dict = Depends(ADMIN)):
    if member_id == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")
    if not await pool().fetchval("SELECT 1 FROM profiles WHERE id = $1 AND org_id = $2", member_id, user["org_id"]):
        raise HTTPException(status_code=404, detail="Member not found")
    await delete_auth_user(member_id)
    await pool().execute("DELETE FROM profiles WHERE id = $1", member_id)
    return {"ok": True}


@api.get("/platform/orgs")
async def platform_orgs(user: dict = Depends(require_platform_admin)):
    return rows(await pool().fetch(
        "SELECT o.*, (SELECT COUNT(*) FROM sites s WHERE s.org_id = o.id) AS site_count, "
        "(SELECT COUNT(*) FROM sensor_nodes n WHERE n.org_id = o.id) AS node_count, "
        "(SELECT COUNT(*) FROM profiles p WHERE p.org_id = o.id) AS user_count, "
        "(SELECT COUNT(*) FROM incident_alerts i WHERE i.org_id = o.id AND i.status <> 'RESOLVED') AS open_incidents "
        "FROM organizations o ORDER BY o.created_at"))


@api.post("/platform/orgs", status_code=201)
async def platform_create_org(body: OrgCreate, user: dict = Depends(require_platform_admin)):
    org = await pool().fetchrow(
        "INSERT INTO organizations (name, sector, tariff_zar_per_kl) VALUES ($1,$2,$3) RETURNING *",
        body.name, body.sector, D(body.tariff_zar_per_kl))
    await pool().execute("INSERT INTO org_settings (org_id) VALUES ($1)", org["id"])
    try:
        admin = await provision_member(org["id"], body.admin_email, body.admin_full_name, "ORG_ADMIN", body.admin_password)
    except Exception:
        await pool().execute("DELETE FROM organizations WHERE id = $1", org["id"])
        raise
    return {"organization": row(org), "admin": admin}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
