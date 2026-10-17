import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { hoursOpen, isOpen, zar } from "@/lib/format";

const OrgCtx = createContext(null);

const upsert = (list, item) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];

export function OrgDataProvider({ children }) {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  const [org, setOrg] = useState(null);
  const [sites, setSites] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [twins, setTwins] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [latest, setLatest] = useState({});
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const listeners = useRef(new Set());
  const nodesRef = useRef([]);
  nodesRef.current = nodes;

  const refresh = useCallback(async () => {
    if (!orgId) return;
    const [o, s, n, t, i, l] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
      supabase.from("sites").select("*").order("created_at"),
      supabase.from("sensor_nodes").select("*").order("device_eui"),
      supabase.from("digital_twin_profiles").select("*"),
      supabase.from("incident_alerts").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("latest_telemetry").select("*"),
    ]);
    setOrg(o.data);
    setSites(s.data || []);
    setNodes(n.data || []);
    setTwins(Object.fromEntries((t.data || []).map((x) => [x.node_id, x])));
    setIncidents(i.data || []);
    setLatest(Object.fromEntries((l.data || []).map((x) => [x.node_id, x])));
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!orgId) {
      return undefined;
    }
    const notify = (inc) => {
      const node = nodesRef.current.find((x) => x.id === inc.node_id);
      const desc = `${node?.label ?? "Node"} · ${inc.hourly_financial_loss_zar > 0 ? `${zar(inc.hourly_financial_loss_zar)}/h at risk` : inc.diagnosis}`;
      const fn = inc.severity === "CRITICAL" ? toast.error : toast.warning;
      fn(inc.title, { description: desc, duration: 8000 });
    };
    const ch = supabase
      .channel(`org-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_alerts", filter: `org_id=eq.${orgId}` }, (p) => {
        if (p.eventType === "DELETE") {
          setIncidents((prev) => prev.filter((x) => x.id !== p.old.id));
          return;
        }
        setIncidents((prev) => upsert(prev, p.new));
        if (p.eventType === "INSERT") notify(p.new);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sensor_nodes", filter: `org_id=eq.${orgId}` }, (p) => {
        if (p.eventType === "DELETE") {
          setNodes((prev) => prev.filter((x) => x.id !== p.old.id));
          return;
        }
        setNodes((prev) => upsert(prev, p.new));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "telemetry_logs" }, (p) => {
        setLatest((prev) => ({ ...prev, [p.new.node_id]: p.new }));
        listeners.current.forEach((fn) => fn(p.new));
      })
      .subscribe((st) => setLive(st === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orgId]);

  const onTelemetry = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const kpis = useMemo(() => {
    const open = incidents.filter(isOpen);
    return {
      open: open.length,
      critical: open.filter((i) => i.severity === "CRITICAL").length,
      lossRate: open.reduce((a, i) => a + Number(i.water_loss_rate_m3h || 0), 0),
      zarPerHour: open.reduce((a, i) => a + Number(i.hourly_financial_loss_zar || 0), 0),
      zarSoFar: open.reduce((a, i) => a + Number(i.hourly_financial_loss_zar || 0) * hoursOpen(i), 0),
      online: nodes.filter((n) => n.status !== "OFFLINE").length,
      total: nodes.length,
    };
  }, [incidents, nodes]);

  const value = { org, sites, nodes, twins, incidents, latest, live, loading, refresh, onTelemetry, kpis };
  return <OrgCtx.Provider value={value}>{children}</OrgCtx.Provider>;
}

export const useOrgData = () => useContext(OrgCtx);
