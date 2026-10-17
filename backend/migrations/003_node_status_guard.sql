-- Node status never downgrades below the worst open incident (e.g. a MEDIUM leak reading on a CRITICAL node)
CREATE OR REPLACE FUNCTION keep_worst_node_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'WARNING' AND OLD.status = 'CRITICAL' AND EXISTS (
        SELECT 1 FROM incident_alerts
        WHERE node_id = NEW.id AND severity = 'CRITICAL' AND status <> 'RESOLVED'
    ) THEN
        NEW.status := 'CRITICAL';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_keep_worst_node_status
BEFORE UPDATE OF status ON sensor_nodes
FOR EACH ROW EXECUTE FUNCTION keep_worst_node_status();
