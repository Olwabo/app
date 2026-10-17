# Shared fixtures: Supabase auth tokens, API sessions, Supabase REST reader
import os
import pytest
import requests
from dotenv import dotenv_values

FE = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or FE["REACT_APP_BACKEND_URL"]).rstrip("/")
SB_URL = FE["REACT_APP_SUPABASE_URL"]
ANON = FE["REACT_APP_SUPABASE_ANON_KEY"]

OWNER = ("hlokomamtshelwane@gmail.com", "Amanzi!Ops2026")
MSU = ("utility.operator@example.com", "Msunduzi!Ops2026")


def sb_login(email, password):
    r = requests.post(f"{SB_URL}/auth/v1/token?grant_type=password",
                      headers={"apikey": ANON}, json={"email": email, "password": password}, timeout=20)
    return r


def token_for(email, password):
    r = sb_login(email, password)
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}: {r.text}")
    return r.json()["access_token"]


class Client:
    def __init__(self, token):
        self.token = token
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Bearer {token}"})

    def api(self, method, path, **kw):
        return self.s.request(method, f"{BASE_URL}/api{path}", timeout=30, **kw)

    def rest(self, table, query=""):
        r = requests.get(f"{SB_URL}/rest/v1/{table}?{query}",
                         headers={"apikey": ANON, "Authorization": f"Bearer {self.token}"}, timeout=20)
        assert r.status_code == 200, r.text
        return r.json()


@pytest.fixture(scope="session")
def owner():
    return Client(token_for(*OWNER))


@pytest.fixture(scope="session")
def msu():
    return Client(token_for(*MSU))
