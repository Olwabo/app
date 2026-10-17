-- User profiles: links Supabase Auth users to exactly one organization
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('ORG_ADMIN', 'OPERATOR', 'VIEWER')),
    is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_settings (
    org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    email_critical_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_ingest_keys (
    org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE incident_notifications (
    incident_id UUID PRIMARY KEY REFERENCES incident_alerts(id) ON DELETE CASCADE,
    recipients TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_telemetry_node_time ON telemetry_logs (node_id, recorded_at DESC);
CREATE INDEX idx_incidents_org_status ON incident_alerts (org_id, status, created_at DESC);
CREATE INDEX idx_incidents_node_open ON incident_alerts (node_id, category) WHERE status <> 'RESOLVED';
CREATE INDEX idx_nodes_org ON sensor_nodes (org_id);
CREATE INDEX idx_sites_org ON sites (org_id);
CREATE INDEX idx_profiles_org ON profiles (org_id);

-- One open ticket per node + category (stops a sustained anomaly from opening a ticket every reading)
CREATE OR REPLACE FUNCTION suppress_duplicate_incident()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM incident_alerts
               WHERE node_id = NEW.node_id AND category = NEW.category AND status <> 'RESOLVED') THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incident_dedupe
BEFORE INSERT ON incident_alerts
FOR EACH ROW EXECUTE FUNCTION suppress_duplicate_incident();

-- Tenant resolver for RLS
CREATE OR REPLACE FUNCTION public.auth_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.auth_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_org_id() TO authenticated;

-- Latest reading per node (respects caller RLS)
CREATE VIEW latest_telemetry WITH (security_invoker = true) AS
SELECT t.* FROM sensor_nodes n
CROSS JOIN LATERAL (
    SELECT * FROM telemetry_logs tl WHERE tl.node_id = n.id ORDER BY tl.recorded_at DESC LIMIT 1
) t;

-- Row-Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_twin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_ingest_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_member_read ON organizations FOR SELECT TO authenticated
    USING (id = (SELECT public.auth_org_id()));
CREATE POLICY sites_member_read ON sites FOR SELECT TO authenticated
    USING (org_id = (SELECT public.auth_org_id()));
CREATE POLICY nodes_member_read ON sensor_nodes FOR SELECT TO authenticated
    USING (org_id = (SELECT public.auth_org_id()));
CREATE POLICY incidents_member_read ON incident_alerts FOR SELECT TO authenticated
    USING (org_id = (SELECT public.auth_org_id()));
CREATE POLICY profiles_member_read ON profiles FOR SELECT TO authenticated
    USING (org_id = (SELECT public.auth_org_id()));
CREATE POLICY twins_member_read ON digital_twin_profiles FOR SELECT TO authenticated
    USING (node_id IN (SELECT id FROM sensor_nodes WHERE org_id = (SELECT public.auth_org_id())));
CREATE POLICY telemetry_member_read ON telemetry_logs FOR SELECT TO authenticated
    USING (node_id IN (SELECT id FROM sensor_nodes WHERE org_id = (SELECT public.auth_org_id())));

-- Browser clients are read-only; all writes go through the API (service connection)
REVOKE ALL ON organizations, sites, sensor_nodes, digital_twin_profiles, telemetry_logs,
    incident_alerts, profiles, latest_telemetry FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON organizations, sites, sensor_nodes, digital_twin_profiles,
    telemetry_logs, incident_alerts, profiles FROM authenticated;
GRANT SELECT ON organizations, sites, sensor_nodes, digital_twin_profiles, telemetry_logs,
    incident_alerts, profiles, latest_telemetry TO authenticated;
REVOKE ALL ON org_settings, org_ingest_keys, incident_notifications FROM anon, authenticated;
