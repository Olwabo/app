import os
import logging
from pathlib import Path

from dotenv import load_dotenv

from auth import create_auth_user
from db import D, pool

load_dotenv(Path(__file__).parent / ".env")
logger = logging.getLogger("amanzi.seed")

DEMO_ORGS = [
    {
        "name": "Highveld Agro-Processing (Demo)", "sector": "MANUFACTURING", "tariff": 42.50,
        "user": ("OWNER_EMAIL", "OWNER_PASSWORD", "Platform Owner", True),
        "sites": [
            ("Main Processing Plant", "Middelburg, Mpumalanga", -25.775, 29.464, [
                ("SIM-HV-001", "Pump Station Inlet", 5.2, 85.0),
                ("SIM-HV-002", "Process Line Manifold", 4.5, 60.0),
                ("SIM-HV-003", "Cooling Tower Feed", 3.8, 42.0),
            ]),
            ("Irrigation Reservoir Block", "Groblersdal, Limpopo", -25.169, 29.398, [
                ("SIM-HV-004", "Reservoir Outlet Main", 6.0, 120.0),
                ("SIM-HV-005", "Pivot Irrigation Header", 4.2, 75.0),
            ]),
            ("Head Office Campus", "Sandton, Johannesburg", -26.107, 28.056, [
                ("SIM-HV-006", "Campus Ring Main", 3.5, 18.0),
            ]),
        ],
    },
    {
        "name": "Msunduzi Water Utility (Demo)", "sector": "MUNICIPAL", "tariff": 28.90,
        "user": ("DEMO_UTILITY_EMAIL", "DEMO_UTILITY_PASSWORD", "Utility Operator", False),
        "sites": [
            ("Ward 12 Reservoir", "Pietermaritzburg, KwaZulu-Natal", -29.600, 30.379, [
                ("SIM-MW-001", "Bulk Supply Meter", 5.5, 140.0),
                ("SIM-MW-002", "District Metered Area 4", 4.0, 55.0),
            ]),
        ],
    },
]


async def _ensure_user(conn, org_id, email, password, name, platform):
    uid = await conn.fetchval("SELECT id FROM auth.users WHERE lower(email) = lower($1)", email)
    if not uid:
        uid = await create_auth_user(email, password, name)
    await conn.execute(
        "INSERT INTO profiles (id, org_id, email, full_name, role, is_platform_admin) "
        "VALUES ($1, $2, $3, $4, 'ORG_ADMIN', $5) ON CONFLICT (id) DO UPDATE SET is_platform_admin = EXCLUDED.is_platform_admin",
        uid, org_id, email.lower(), name, platform,
    )


async def seed():
    async with pool().acquire() as conn:
        for o in DEMO_ORGS:
            org_id = await conn.fetchval("SELECT id FROM organizations WHERE name = $1", o["name"])
            if not org_id:
                org_id = await conn.fetchval(
                    "INSERT INTO organizations (name, sector, tariff_zar_per_kl) VALUES ($1, $2, $3) RETURNING id",
                    o["name"], o["sector"], D(o["tariff"]))
                await conn.execute("INSERT INTO org_settings (org_id) VALUES ($1) ON CONFLICT DO NOTHING", org_id)
                for sname, loc, lat, lng, nodes in o["sites"]:
                    site_id = await conn.fetchval(
                        "INSERT INTO sites (org_id, name, location_label, latitude, longitude) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                        org_id, sname, loc, D(lat), D(lng))
                    for eui, label, ep, ef in nodes:
                        nid = await conn.fetchval(
                            "INSERT INTO sensor_nodes (org_id, site_id, device_eui, label) VALUES ($1,$2,$3,$4) RETURNING id",
                            org_id, site_id, eui, label)
                        await conn.execute(
                            "INSERT INTO digital_twin_profiles (node_id, expected_pressure_bar, expected_flow_m3h) VALUES ($1,$2,$3)",
                            nid, D(ep), D(ef))
                logger.info("Seeded demo org %s", o["name"])
            ek, pk, name, platform = o["user"]
            await _ensure_user(conn, org_id, os.environ[ek], os.environ[pk], name, platform)
