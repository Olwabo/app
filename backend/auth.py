import os
import asyncio
import uuid
from pathlib import Path

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from db import pool

load_dotenv(Path(__file__).parent / ".env")
SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

_jwks = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", cache_keys=True, lifespan=600)
_bearer = HTTPBearer(auto_error=False)
_admin_headers = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}


def _decode(token: str) -> dict:
    key = _jwks.get_signing_key_from_jwt(token)
    return jwt.decode(
        token, key.key, algorithms=["ES256", "RS256"], audience="authenticated",
        issuer=f"{SUPABASE_URL}/auth/v1", options={"require": ["sub", "exp"]},
    )


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        claims = await asyncio.to_thread(_decode, creds.credentials)
        user_id = uuid.UUID(claims["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    r = await pool().fetchrow(
        "SELECT p.*, o.name AS org_name, o.sector, o.tariff_zar_per_kl FROM profiles p "
        "JOIN organizations o ON o.id = p.org_id WHERE p.id = $1", user_id,
    )
    if not r:
        raise HTTPException(status_code=403, detail="Your account is not linked to an organization")
    return dict(r)


def require_roles(*roles):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="You do not have permission for this action")
        return user
    return dep


async def require_platform_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user["is_platform_admin"]:
        raise HTTPException(status_code=403, detail="Platform owner access required")
    return user


async def create_auth_user(email: str, password: str, full_name: str) -> uuid.UUID:
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(
            f"{SUPABASE_URL}/auth/v1/admin/users", headers=_admin_headers,
            json={"email": email, "password": password, "email_confirm": True,
                  "user_metadata": {"full_name": full_name}},
        )
    if r.status_code >= 300:
        msg = r.json().get("msg") or r.json().get("message") or "Could not create user"
        raise HTTPException(status_code=400, detail=msg)
    return uuid.UUID(r.json()["id"])


async def delete_auth_user(user_id: uuid.UUID):
    async with httpx.AsyncClient(timeout=20) as c:
        await c.delete(f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}", headers=_admin_headers)
