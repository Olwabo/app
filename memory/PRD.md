# AmanziAlert — PRD

## Original problem statement
Build a production-grade, multi-tenant B2B IoT SaaS web application named "AmanziAlert". AmanziAlert is an industrial-grade water telemetry and Digital Twin early-warning platform. It caters to commercial enterprises (factories, agro-estates, commercial buildings, industrial parks) and public utilities, enabling them to curb non-revenue water waste, spot pipe bursts/leaks in real time, and protect pumps from power/load disruptions.
1. Supabase Backend: generate and apply the PostgreSQL migration (organizations, sites, sensor_nodes, digital_twin_profiles, telemetry_logs, incident_alerts, process_telemetry_twin trigger, supabase_realtime publication), including tables, RLS and triggers.

User choices: own Supabase project; email+password login; simulated sensors + device ingest endpoint; in-app live alerts + email for critical incidents.

## Architecture
- Supabase (project dinwcafxrwnybyzumqoj, eu-west-3 transaction pooler): Postgres + Auth + Realtime.
- Migrations in /app/backend/migrations applied on backend startup (tracked in schema_migrations): 001 = user SQL verbatim; 002 = profiles, org_settings, org_ingest_keys, incident_notifications, indexes, incident dedupe trigger, auth_org_id(), latest_telemetry view, RLS read policies (browser is read-only); 003 = node status never downgrades below open CRITICAL.
- FastAPI (asyncpg) for all writes: org/sites/nodes/twin, dispatch/resolve, simulate, device ingest (X-Api-Key), team, platform tenants. Verifies Supabase JWT via JWKS (ES256).
- Background loops: simulator (SIM-* nodes, every 10s), maintenance (OFFLINE after 10 min, 3-day telemetry retention for SIM), critical-incident email (Emergent managed Resend → org admins).
- React + supabase-js: RLS-scoped reads + realtime (incidents, nodes, telemetry), sonner toasts.

## Personas
Platform owner (onboards tenants), Org admin (settings, team, twins, assets), Operator (dispatch/resolve, scenarios), Viewer (read only).

## Implemented (2026-10-17)
- Login, Command Center (KPIs, node grid, live incident feed), Sites & Nodes CRUD, Node detail (4 live charts with twin bands, twin calibration, scenario injection), Incident board (filters, dispatch, resolve, ZAR cost so far), Scenario simulator, Settings (org/tariff, alerts toggle, ingest key + curl, team), Platform tenants page.
- Tested: backend 34/34, frontend all flows; follow-up fixes applied (alerts toggle race, status severity guard, atomic email claim, reservoir seed, chart empty state/axis).

## Update (2026-10-18)
- Restyle for a calmer, human feel: serif page headings with IBM Plex Sans body, muted dark palette, no grid, scanline or glow effects, plain-language labels (Overview, Sites and meters, Test scenarios, "Send someone", "Mark fixed"), time-of-day greeting, honest sign-in copy.
- Added demo OPERATOR + VIEWER accounts for both tenants (seeded from env; see test_credentials.md). Iteration 2: 21/21 role/isolation tests passed, UI regression passed.

## Update (2026-10-18, b)
- Removed every Rand cost display: KPI tile, top bar, incident table columns, feed, toasts, alert email, tariff inputs in Settings and Platform, dashboard tariff line. The DB columns and trigger are unchanged (tariff stays at its stored value).
- Removed "(Demo)" from org and user names in the DB and the seed; the simulator copy now says "Simulated meters".

## Update (2026-10-18, c) — hackathon polish
- Overview: live site map (react-leaflet, Esri dark tiles, markers coloured by worst status, tooltip, click opens meter), a flow sparkline on every meter card, and a "Readings checked today" KPI that ticks up live.
- Fix: meters marked OFFLINE now go back to their real status once they report again (maintenance loop).
- Browser tab title/description set to AmanziAlert; dark map tooltip; chart grid spacing. Iteration 3: frontend 100%.

## Update (2026-10-18, d)
- Map now uses Mapbox (dark-v11 style raster tiles via Leaflet, token in REACT_APP_MAPBOX_TOKEN). mapbox-gl/react-map-gl could not be installed: a dependency requires Node >= 22 (server has 20).
- Org renamed to "Eastern Cape Agro-Processing"; sites moved to Gqeberha, East London, Mthatha; meters SIM-EC-001..006; operator/viewer logins renamed to operator.easterncape@example.com / viewer.easterncape@example.com (same passwords).

## Backlog
- P1: RESERVOIR_LOW and AFTER_HOURS_LEAK detection (twin fields exist, trigger doesn't use them yet)
- P1: Tenant suspend/delete on Platform page; dual ingest keys for zero-downtime rotation
- P2: Site map view, incident history reports/export, SMS/WhatsApp alerts, load-shedding schedule overlay
- Recommend disabling public sign-ups in Supabase dashboard (Auth → Sign In / Providers)
