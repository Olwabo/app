# AmanziAlert backend API regression: auth, sites/nodes/twin, simulate+dedupe, incidents, ingest, team/roles, isolation, platform
import time
import uuid
import pytest
import requests
from conftest import BASE_URL, Client, sb_login, token_for

S = {}  # shared state across ordered tests
SUF = uuid.uuid4().hex[:6]


def wait_incident(c, node_id, category, tries=10):
    for _ in range(tries):
        rows = c.rest("incident_alerts", f"node_id=eq.{node_id}&category=eq.{category}&status=neq.RESOLVED&select=*")
        if rows:
            return rows
        time.sleep(1)
    return []


# --- Health & auth ---
class TestAuth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=20)
        assert r.status_code == 200 and r.json()["ok"] is True

    def test_me_no_token(self):
        assert requests.get(f"{BASE_URL}/api/me", timeout=20).status_code == 401

    def test_me_garbage_token(self):
        r = requests.get(f"{BASE_URL}/api/me", headers={"Authorization": "Bearer abc.def.ghi"}, timeout=20)
        assert r.status_code == 401

    def test_bad_supabase_login(self):
        assert sb_login("hlokomamtshelwane@gmail.com", "wrongpass123").status_code == 400

    def test_me_owner(self, owner):
        r = owner.api("GET", "/me")
        assert r.status_code == 200
        d = r.json()
        assert d["is_platform_admin"] is True and d["role"] == "ORG_ADMIN"
        assert "Highveld" in d["org_name"]
        S["owner_org"] = d["org_id"]
        S["tariff"] = float(d["tariff_zar_per_kl"])

    def test_me_msu(self, msu):
        d = msu.api("GET", "/me").json()
        assert "Msunduzi" in d["org_name"] and d["is_platform_admin"] is False
        S["msu_org"] = d["org_id"]


# --- Sites / nodes / twin ---
class TestSitesNodes:
    def test_create_site(self, owner):
        r = owner.api("POST", "/sites", json={"name": f"TEST_Site_{SUF}", "location_label": "TEST_Loc"})
        assert r.status_code == 201, r.text
        S["site_id"] = r.json()["id"]
        rows = owner.rest("sites", f"id=eq.{S['site_id']}")
        assert rows and rows[0]["name"] == f"TEST_Site_{SUF}"

    def test_create_node_with_default_twin(self, owner):
        r = owner.api("POST", "/nodes", json={"site_id": S["site_id"], "device_eui": f"TEST-{SUF}", "label": "TEST_Node"})
        assert r.status_code == 201, r.text
        S["node_id"] = r.json()["id"]
        tw = owner.rest("digital_twin_profiles", f"node_id=eq.{S['node_id']}")
        assert len(tw) == 1

    def test_duplicate_eui_409(self, owner):
        r = owner.api("POST", "/nodes", json={"site_id": S["site_id"], "device_eui": f"TEST-{SUF}", "label": "TEST_Dup"})
        assert r.status_code == 409

    def test_update_twin(self, owner):
        body = {"expected_pressure_bar": 4.0, "expected_flow_m3h": 20.0, "min_reservoir_pct": 20,
                "night_leak_threshold_m3h": 2, "tolerance_pct": 15}
        r = owner.api("PUT", f"/nodes/{S['node_id']}/twin", json=body)
        assert r.status_code == 200, r.text
        tw = owner.rest("digital_twin_profiles", f"node_id=eq.{S['node_id']}")[0]
        assert float(tw["expected_pressure_bar"]) == 4.0 and float(tw["expected_flow_m3h"]) == 20.0

    def test_twin_validation(self, owner):
        r = owner.api("PUT", f"/nodes/{S['node_id']}/twin", json={"expected_pressure_bar": -1, "expected_flow_m3h": 20,
                      "min_reservoir_pct": 20, "night_leak_threshold_m3h": 2, "tolerance_pct": 15})
        assert r.status_code == 422


# --- Simulate + dedupe + financial loss + dispatch/resolve ---
class TestSimulateIncidents:
    def test_pipe_burst_and_loss(self, owner):
        r = owner.api("POST", "/simulate", json={"node_id": S["node_id"], "scenario": "PIPE_BURST"})
        assert r.status_code == 200, r.text
        inc = r.json()["incident"]
        assert inc and inc["severity"] == "CRITICAL" and inc["category"] == "PIPE_BURST"
        S["burst_id"] = inc["id"]
        tel = owner.rest("telemetry_logs", f"node_id=eq.{S['node_id']}&order=recorded_at.desc&limit=1")[0]
        expected = round((float(tel["flow_m3h"]) - 20.0) * S["tariff"], 0)
        assert abs(float(inc["hourly_financial_loss_zar"]) - expected) <= 2, (inc, tel)
        node = owner.rest("sensor_nodes", f"id=eq.{S['node_id']}")[0]
        assert node["status"] == "CRITICAL"

    def test_pipe_burst_dedupe(self, owner):
        r = owner.api("POST", "/simulate", json={"node_id": S["node_id"], "scenario": "PIPE_BURST"})
        assert r.status_code == 200
        rows = owner.rest("incident_alerts", f"node_id=eq.{S['node_id']}&category=eq.PIPE_BURST&status=neq.RESOLVED")
        assert len(rows) == 1 and rows[0]["id"] == S["burst_id"]

    def test_micro_leak(self, owner):
        r = owner.api("POST", "/simulate", json={"node_id": S["node_id"], "scenario": "MICRO_LEAK"})
        inc = r.json()["incident"]
        assert inc["severity"] == "MEDIUM" and inc["category"] == "MICRO_LEAK"
        S["leak_id"] = inc["id"]
        node = owner.rest("sensor_nodes", f"id=eq.{S['node_id']}")[0]
        S["status_after_leak_with_open_burst"] = node["status"]
        print("node status after MICRO_LEAK while PIPE_BURST open:", node["status"])

    def test_dispatch(self, owner):
        r = owner.api("POST", f"/incidents/{S['burst_id']}/dispatch", json={"technician": "TEST_Tech"})
        assert r.status_code == 200
        row = owner.rest("incident_alerts", f"id=eq.{S['burst_id']}")[0]
        assert row["status"] == "DISPATCHED" and row["assigned_technician"] == "TEST_Tech"

    def test_resolve_and_node_online(self, owner):
        assert owner.api("POST", f"/incidents/{S['burst_id']}/resolve").status_code == 200
        node = owner.rest("sensor_nodes", f"id=eq.{S['node_id']}")[0]
        assert node["status"] != "ONLINE"  # leak still open
        assert owner.api("POST", f"/incidents/{S['leak_id']}/resolve").status_code == 200
        node = owner.rest("sensor_nodes", f"id=eq.{S['node_id']}")[0]
        assert node["status"] == "ONLINE"
        assert owner.api("POST", f"/incidents/{S['leak_id']}/resolve").status_code == 400


# --- Device ingest ---
class TestIngest:
    def test_rotate_key(self, owner):
        r = owner.api("POST", "/org/ingest-key")
        assert r.status_code == 200 and r.json()["api_key"].startswith("amz_")
        S["key"] = r.json()["api_key"]
        g = owner.api("GET", "/org/ingest-key").json()
        assert g["exists"] and g["key_prefix"] == S["key"][:10]

    def _post(self, key, eui, **kw):
        body = {"device_eui": eui, "pressure_bar": 4.0, "flow_m3h": 12, "reservoir_pct": 60,
                "pump_active": True, "pump_power_kw": 2.5, **kw}
        h = {"X-Api-Key": key} if key else {}
        return requests.post(f"{BASE_URL}/api/ingest/telemetry", json=body, headers=h, timeout=20)

    def test_missing_and_wrong_key(self):
        assert self._post(None, f"TEST-{SUF}").status_code == 401
        assert self._post("amz_wrong", f"TEST-{SUF}").status_code == 401

    def test_unknown_eui(self):
        assert self._post(S["key"], "NOPE-DEVICE-XYZ").status_code == 404

    def test_cross_tenant_eui_404(self):
        assert self._post(S["key"], "SIM-MW-001").status_code == 404

    def test_normal_ingest(self):
        r = self._post(S["key"], f"TEST-{SUF}", battery_pct=88)
        assert r.status_code == 202 and r.json()["accepted"]

    def test_burst_ingest_creates_incident(self, owner):
        r = self._post(S["key"], f"TEST-{SUF}", pressure_bar=1.5, flow_m3h=35)
        assert r.status_code == 202
        rows = wait_incident(owner, S["node_id"], "PIPE_BURST", 3)
        assert rows and abs(float(rows[0]["hourly_financial_loss_zar"]) - 15 * S["tariff"]) < 1
        assert owner.api("POST", f"/incidents/{rows[0]['id']}/resolve").status_code == 200


# --- Team + roles ---
class TestTeamRoles:
    def test_add_viewer(self, owner):
        email = f"test_viewer_{SUF}@example.com"
        r = owner.api("POST", "/team", json={"email": email, "full_name": "TEST Viewer", "role": "VIEWER", "password": "Viewer!2026x"})
        assert r.status_code == 201, r.text
        S["viewer_id"] = r.json()["id"]
        S["viewer_tok"] = token_for(email, "Viewer!2026x")
        assert owner.api("POST", "/team", json={"email": email, "full_name": "TEST Viewer", "role": "VIEWER",
                                                  "password": "Viewer!2026x"}).status_code == 409

    def test_viewer_forbidden(self):
        v = Client(S["viewer_tok"])
        assert v.api("POST", "/simulate", json={"node_id": S["node_id"], "scenario": "PIPE_BURST"}).status_code == 403
        assert v.api("POST", "/sites", json={"name": "TEST_x", "location_label": "TEST_x"}).status_code == 403
        assert v.api("GET", "/me").json()["role"] == "VIEWER"

    def test_role_change(self, owner):
        r = owner.api("PATCH", f"/team/{S['viewer_id']}", json={"role": "OPERATOR"})
        assert r.status_code == 200 and r.json()["role"] == "OPERATOR"
        team = owner.api("GET", "/team").json()
        assert any(m["id"] == S["viewer_id"] and m["role"] == "OPERATOR" for m in team)

    def test_cannot_change_self(self, owner):
        me = owner.api("GET", "/me").json()
        assert owner.api("PATCH", f"/team/{me['id']}", json={"role": "VIEWER"}).status_code == 400

    def test_remove_member(self, owner):
        assert owner.api("DELETE", f"/team/{S['viewer_id']}").status_code == 200
        assert not any(m["id"] == S["viewer_id"] for m in owner.api("GET", "/team").json())


# --- Multi-tenant isolation ---
class TestIsolation:
    def test_msu_sees_only_own(self, msu):
        nodes = msu.rest("sensor_nodes", "select=device_eui,org_id")
        assert nodes and all(n["org_id"] == S["msu_org"] for n in nodes)
        assert all(n["device_eui"].startswith("SIM-MW") for n in nodes)

    def test_msu_cannot_touch_highveld(self, owner, msu):
        hv_inc = owner.rest("incident_alerts", "select=id&limit=1")
        if hv_inc:
            assert msu.api("POST", f"/incidents/{hv_inc[0]['id']}/resolve").status_code == 404
        assert msu.api("POST", "/simulate", json={"node_id": S["node_id"], "scenario": "PIPE_BURST"}).status_code == 404
        assert msu.api("PUT", f"/nodes/{S['node_id']}/twin", json={"expected_pressure_bar": 4, "expected_flow_m3h": 20,
                       "min_reservoir_pct": 20, "night_leak_threshold_m3h": 2, "tolerance_pct": 15}).status_code == 404
        assert msu.api("DELETE", f"/sites/{S['site_id']}").status_code == 404

    def test_platform_403(self, msu):
        assert msu.api("GET", "/platform/orgs").status_code == 403

    def test_platform_list_owner(self, owner):
        r = owner.api("GET", "/platform/orgs")
        assert r.status_code == 200 and len(r.json()) >= 2
        assert all("node_count" in o for o in r.json())


# --- Org settings ---
class TestOrgSettings:
    def test_tariff_update_roundtrip(self, owner):
        r = owner.api("PATCH", "/org", json={"tariff_zar_per_kl": S["tariff"] + 1})
        assert r.status_code == 200 and float(r.json()["tariff_zar_per_kl"]) == S["tariff"] + 1
        r = owner.api("PATCH", "/org", json={"tariff_zar_per_kl": S["tariff"]})
        assert float(r.json()["tariff_zar_per_kl"]) == S["tariff"]

    def test_alert_settings_roundtrip(self, owner):
        cur = owner.api("GET", "/org/alert-settings").json()["email_critical_alerts"]
        assert owner.api("PUT", "/org/alert-settings", json={"email_critical_alerts": not cur}).json()["email_critical_alerts"] == (not cur)
        owner.api("PUT", "/org/alert-settings", json={"email_critical_alerts": cur})
        assert owner.api("GET", "/org/alert-settings").json()["email_critical_alerts"] == cur


# --- Cleanup ---
class TestCleanup:
    def test_delete_node_and_site(self, owner):
        assert owner.api("DELETE", f"/nodes/{S['node_id']}").status_code == 200
        assert owner.rest("sensor_nodes", f"id=eq.{S['node_id']}") == []
        assert owner.api("DELETE", f"/sites/{S['site_id']}").status_code == 200
        assert owner.rest("sites", f"id=eq.{S['site_id']}") == []
