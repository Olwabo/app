-- 1. Organizations (B2B Multi-tenancy)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sector TEXT NOT NULL CHECK (sector IN ('MANUFACTURING', 'AGRICO', 'COMMERCIAL_ESTATE', 'MUNICIPAL')),
    tariff_zar_per_kl NUMERIC(10, 2) NOT NULL DEFAULT 42.50,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sites / Facilities per Organization
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location_label TEXT NOT NULL,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Telemetry Nodes (ESP32 / Modbus Gateways)
CREATE TABLE sensor_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    device_eui TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'WARNING', 'CRITICAL', 'OFFLINE')),
    battery_pct NUMERIC(5, 2) DEFAULT 100.0,
    last_ping TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Digital Twin Dynamic Profiles
CREATE TABLE digital_twin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID UNIQUE NOT NULL REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    expected_pressure_bar NUMERIC(6, 2) NOT NULL DEFAULT 4.5,
    expected_flow_m3h NUMERIC(8, 2) NOT NULL DEFAULT 60.0,
    min_reservoir_pct NUMERIC(5, 2) NOT NULL DEFAULT 30.0,
    night_leak_threshold_m3h NUMERIC(6, 2) NOT NULL DEFAULT 0.5,
    tolerance_pct NUMERIC(5, 2) NOT NULL DEFAULT 15.0
);

-- 5. Real-Time Telemetry Stream
CREATE TABLE telemetry_logs (
    id BIGSERIAL PRIMARY KEY,
    node_id UUID NOT NULL REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    pressure_bar NUMERIC(6, 2) NOT NULL,
    flow_m3h NUMERIC(8, 2) NOT NULL,
    reservoir_pct NUMERIC(5, 2) NOT NULL,
    pump_active BOOLEAN NOT NULL DEFAULT TRUE,
    pump_power_kw NUMERIC(6, 2) DEFAULT 0.0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Incidents & Alert Tickets
CREATE TABLE incident_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id),
    node_id UUID NOT NULL REFERENCES sensor_nodes(id),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'CRITICAL')),
    category TEXT NOT NULL CHECK (category IN ('PIPE_BURST', 'MICRO_LEAK', 'AFTER_HOURS_LEAK', 'PUMP_TRIP_POWER', 'RESERVOIR_LOW')),
    title TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    water_loss_rate_m3h NUMERIC(8, 2) DEFAULT 0.0,
    hourly_financial_loss_zar NUMERIC(10, 2) DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISPATCHED', 'RESOLVED')),
    assigned_technician TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 7. Automated Anomaly Detection Trigger (Digital Twin Engine)
CREATE OR REPLACE FUNCTION process_telemetry_twin()
RETURNS TRIGGER AS $$
DECLARE
    twin digital_twin_profiles%ROWTYPE;
    node sensor_nodes%ROWTYPE;
    org organizations%ROWTYPE;
    excess_flow NUMERIC(8, 2);
    cost_loss NUMERIC(10, 2);
BEGIN
    SELECT * INTO node FROM sensor_nodes WHERE id = NEW.node_id;
    SELECT * INTO twin FROM digital_twin_profiles WHERE node_id = NEW.node_id;
    SELECT * INTO org FROM organizations WHERE id = node.org_id;

    UPDATE sensor_nodes SET last_ping = NEW.recorded_at WHERE id = NEW.node_id;

    -- A. Pipe Burst Anomaly: Severe pressure collapse + abnormal high flow
    IF NEW.pressure_bar < (twin.expected_pressure_bar * 0.70) AND NEW.flow_m3h > (twin.expected_flow_m3h * 1.25) THEN
        excess_flow := NEW.flow_m3h - twin.expected_flow_m3h;
        cost_loss := excess_flow * org.tariff_zar_per_kl;
        
        INSERT INTO incident_alerts (org_id, site_id, node_id, severity, category, title, diagnosis, water_loss_rate_m3h, hourly_financial_loss_zar)
        VALUES (org.id, node.site_id, node.id, 'CRITICAL', 'PIPE_BURST', 'Major Pipeline Rupture Detected',
                'Measured pressure dropped ' || ROUND(NEW.pressure_bar, 1) || ' bar while flow spiked to ' || ROUND(NEW.flow_m3h, 1) || ' m³/h.', excess_flow, cost_loss);

        UPDATE sensor_nodes SET status = 'CRITICAL' WHERE id = node.id;

    -- B. After-Hours / Sustained Leak: Sustained flow during low-demand or unexpected low pressure
    ELSIF NEW.pressure_bar < (twin.expected_pressure_bar * 0.85) AND NEW.flow_m3h <= twin.expected_flow_m3h THEN
        INSERT INTO incident_alerts (org_id, site_id, node_id, severity, category, title, diagnosis, water_loss_rate_m3h, hourly_financial_loss_zar)
        VALUES (org.id, node.site_id, node.id, 'MEDIUM', 'MICRO_LEAK', 'Sustained Sub-surface Leak Detected',
                'Line pressure dropped below 15% tolerance without upstream flow demand.', 2.5, 2.5 * org.tariff_zar_per_kl);

        UPDATE sensor_nodes SET status = 'WARNING' WHERE id = node.id;

    -- C. Pump Trip / Power Outage / Load Shedding
    ELSIF NEW.pump_active = FALSE AND NEW.flow_m3h < 5.0 THEN
        INSERT INTO incident_alerts (org_id, site_id, node_id, severity, category, title, diagnosis, water_loss_rate_m3h, hourly_financial_loss_zar)
        VALUES (org.id, node.site_id, node.id, 'CRITICAL', 'PUMP_TRIP_POWER', 'Pump Offline / Supply Failure',
                'Flow halted. Main delivery pump tripped or grid power lost.', 0, 0);

        UPDATE sensor_nodes SET status = 'CRITICAL' WHERE id = node.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_telemetry_twin_check
AFTER INSERT ON telemetry_logs
FOR EACH ROW EXECUTE FUNCTION process_telemetry_twin();

-- Enable Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE telemetry_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE sensor_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE incident_alerts;
