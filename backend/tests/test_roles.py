# AmanziAlert role-based access (OPERATOR / VIEWER demo accounts), tenant isolation, node status guard
import time
import uuid
import pytest
from conftest import Client, token_for

ACCTS = {
    "owner": ("hlokomamtshelwane@gmail.com", "Amanzi!Ops2026", "ORG_ADMIN", "HV"),
    "hv_op": ("operator.highveld@example.com", "Highveld!Op2026", "OPERATOR", "HV"),
    "hv_view": ("viewer.highveld@example.com", "Highveld!View2026", "VIEWER", "HV"),
    "msu_admin": ("utility.operator@example.com", "Msunduzi!Ops2026", "ORG_ADMIN", "MW"),
    "msu_op": ("operator.msunduzi@example.com", "Msunduzi!Op2026", "OPERATOR", "MW"),
    "msu_view": ("viewer.msunduzi@example.com", "Msunduzi!View2026", "VIEWER", "MW"),
}
_C = {}


def c(name):
    if name not in _C:
        e, p, *_ = ACCTS[name]
        _C[name] = Client(token_for(e, p))
    return _C[name]


def nodes(cl):
    return cl.rest("sensor_nodes", "select=id,device_eui,status,org_id")


def open_incs(cl, node_id):
    return cl.rest("incident_alerts", f"node_id=eq.{node_id}&status=neq.RESOLVED&select=*")


def node_by_eui(cl, eui):
    return [n for n in nodes(cl) if n["device_eui"] == eui][0]


# --- Login + /me roles
@pytest.mark.parametrize("name", list(ACCTS))
def test_login_and_me(name):
    r = c(name).api("GET", "/me")
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["email"] == ACCTS[name][0]
    assert me["role"] == ACCTS[name][2]


# --- Isolation: each account only sees own org nodes
@pytest.mark.parametrize("name", list(ACCTS))
def test_isolation(name):
    euis = sorted(n["device_eui"] for n in nodes(c(name)) if n["device_eui"].startswith("SIM-"))
    if ACCTS[name][3] == "MW":
        assert euis == ["SIM-MW-001", "SIM-MW-002"], euis
    else:
        assert all(e.startswith("SIM-HV") for e in euis) and len(euis) >= 6, euis
    # team list scoped to org
    team = c(name).api("GET", "/team").json()
    emails = [t["email"] for t in team]
    assert ACCTS[name][0] in emails
    other = "utility.operator@example.com" if ACCTS[name][3] == "HV" else "hlokomamtshelwane@gmail.com"
    assert other not in emails


# --- Operator gets 403 on admin APIs
@pytest.mark.parametrize("name", ["hv_op", "msu_op", "hv_view", "msu_view"])
def test_admin_apis_forbidden(name):
    cl = c(name)
    nid = nodes(cl)[0]["id"]
    assert cl.api("POST", "/sites", json={"name": "TEST_x", "location": "x"}).status_code == 403
    assert cl.api("PUT", f"/nodes/{nid}/twin", json={"expected_pressure_bar": 3, "expected_flow_m3h": 10,
                  "min_reservoir_pct": 20, "night_leak_threshold_m3h": 1, "tolerance_pct": 15}).status_code == 403
    assert cl.api("POST", "/team", json={"email": "TEST_x@example.com", "full_name": "TEST x",
                  "role": "VIEWER", "password": "Test12345!"}).status_code == 403
    assert cl.api("POST", "/org/ingest-key").status_code == 403
    assert cl.api("POST", "/nodes", json={"site_id": str(uuid.uuid4()), "device_eui": "TEST_X", "name": "TEST"}).status_code in (403, 422)


# --- Viewer gets 403 on ops APIs
@pytest.mark.parametrize("name", ["hv_view", "msu_view"])
def test_viewer_ops_forbidden(name):
    cl = c(name)
    nid = nodes(cl)[0]["id"]
    fake = str(uuid.uuid4())
    assert cl.api("POST", "/simulate", json={"node_id": nid, "scenario": "MICRO_LEAK"}).status_code == 403
    assert cl.api("POST", f"/incidents/{fake}/dispatch", json={"technician": "x"}).status_code == 403
    assert cl.api("POST", f"/incidents/{fake}/resolve").status_code == 403


def test_cross_org_simulate_404():
    hv_node = node_by_eui(c("hv_op"), "SIM-HV-001")
    r = c("msu_op").api("POST", "/simulate", json={"node_id": hv_node["id"], "scenario": "MICRO_LEAK"})
    assert r.status_code == 404


# --- Operator full flow: simulate slow leak -> dispatch -> resolve (Highveld, MEDIUM, no email)
def test_operator_leak_dispatch_resolve():
    op = c("hv_op")
    cand = [n for n in nodes(op) if n["device_eui"] in ("SIM-HV-001", "SIM-HV-002", "SIM-HV-004", "SIM-HV-005")
            and not open_incs(op, n["id"])]
    assert cand, "no clean HV node"
    n = cand[0]
    r = op.api("POST", "/simulate", json={"node_id": n["id"], "scenario": "MICRO_LEAK"})
    assert r.status_code == 200, r.text
    inc = r.json()["incident"]
    assert inc and inc["severity"] == "MEDIUM"
    d = op.api("POST", f"/incidents/{inc['id']}/dispatch", json={"technician": "TEST_Tech Sipho"})
    assert d.status_code == 200 and d.json()["status"] == "DISPATCHED"
    rs = op.api("POST", f"/incidents/{inc['id']}/resolve")
    assert rs.status_code == 200 and rs.json()["status"] == "RESOLVED"
    assert node_by_eui(op, n["device_eui"])["status"] == "ONLINE"


# --- Status guard: critical burst + slow leak keeps CRITICAL; resolving critical -> WARNING (Msunduzi node)
def test_status_guard_and_resolve_downgrade():
    op = c("msu_op")
    n = [x for x in nodes(op) if x["device_eui"].startswith("SIM-MW") and not open_incs(op, x["id"])]
    assert n, "no clean MW node"
    n = n[0]
    created = []
    try:
        b = op.api("POST", "/simulate", json={"node_id": n["id"], "scenario": "PIPE_BURST"})
        assert b.status_code == 200, b.text
        created.append(b.json()["incident"]["id"])
        assert node_by_eui(op, n["device_eui"])["status"] == "CRITICAL"
        l = op.api("POST", "/simulate", json={"node_id": n["id"], "scenario": "MICRO_LEAK"})
        assert l.status_code == 200, l.text
        created.append(l.json()["incident"]["id"])
        time.sleep(2)
        assert node_by_eui(op, n["device_eui"])["status"] == "CRITICAL"
        assert op.api("POST", f"/incidents/{created[0]}/resolve").status_code == 200
        assert node_by_eui(op, n["device_eui"])["status"] == "WARNING"
        assert op.api("POST", f"/incidents/{created[1]}/resolve").status_code == 200
        assert node_by_eui(op, n["device_eui"])["status"] == "ONLINE"
    finally:
        for i in open_incs(op, n["id"]):
            op.api("POST", f"/incidents/{i['id']}/resolve")
