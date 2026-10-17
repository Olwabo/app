import os
import re
import ipaddress
import logging
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
logger = logging.getLogger("amanzi.email")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
APP_PUBLIC_URL = os.environ["APP_PUBLIC_URL"]

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> bool:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return True
    except httpx.HTTPStatusError as e:
        try:
            body = e.response.json()
        except ValueError:
            body = {}
        if body.get("code") in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning("Email paused: %s (%s): %s", body.get("code"), e.response.status_code, body.get("message", ""))
        else:
            logger.error("Email send failed: %s %s", e.response.status_code, e.response.text)
        return False
    except Exception as e:
        logger.error("Email send error: %s", e)
        return False


def critical_incident_email(inc: dict) -> tuple[str, str]:
    subject = f"[{EMAIL_FROM_NAME}] CRITICAL: {inc['title']} at {inc['site_name']}"
    loss = float(inc["hourly_financial_loss_zar"] or 0)
    rate = float(inc["water_loss_rate_m3h"] or 0)
    link = f"{APP_PUBLIC_URL}/incidents"
    html = (
        '<table role="presentation" width="100%" style="background:#070B12"><tr><td style="padding:24px;'
        'font-family:Arial,sans-serif;color:#F8FAFC">'
        f'<p style="font-size:12px;letter-spacing:2px;color:#EF4444;margin:0 0 8px">CRITICAL INCIDENT</p>'
        f'<h2 style="margin:0 0 12px;color:#F8FAFC">{escape(inc["title"])}</h2>'
        f'<p style="margin:0 0 4px;color:#94A3B8">Organization: <strong style="color:#F8FAFC">{escape(inc["org_name"])}</strong></p>'
        f'<p style="margin:0 0 4px;color:#94A3B8">Site: <strong style="color:#F8FAFC">{escape(inc["site_name"])}</strong></p>'
        f'<p style="margin:0 0 12px;color:#94A3B8">Node: <strong style="color:#F8FAFC">{escape(inc["node_label"])}</strong></p>'
        f'<p style="margin:0 0 12px;color:#CBD5E1">{escape(inc["diagnosis"])}</p>'
        f'<p style="margin:0 0 16px;color:#F59E0B">Water loss: {rate:.1f} m3/h &middot; Estimated cost: R {loss:,.2f} per hour</p>'
        f'<p><a href="{link}" style="background:#00E5FF;color:#020617;padding:10px 18px;text-decoration:none;'
        'font-weight:bold;border-radius:4px">Open the incident board</a></p>'
        f'<p style="font-size:12px;color:#64748B;margin-top:24px">Sent by {escape(EMAIL_FROM_NAME)} because you are an '
        'organization admin. We never ask for your password by email.</p></td></tr></table>'
    )
    return subject, html
