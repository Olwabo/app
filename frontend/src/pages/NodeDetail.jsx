import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Battery, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOrgData } from "@/context/OrgDataContext";
import { useAuth } from "@/context/AuthContext";
import { NodeStatus, CategoryTag, IncidentStatusBadge, SeverityBadge } from "@/components/app/Badges";
import TelemetryChart from "@/components/app/TelemetryChart";
import TwinEditorDialog from "@/components/app/TwinEditorDialog";
import ScenarioButtons from "@/components/app/ScenarioButtons";
import { clock, num, timeAgo, zar } from "@/lib/format";

const MAX = 120;

function useNodeHistory(nodeId) {
  const { onTelemetry } = useOrgData();
  const [history, setHistory] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase.from("telemetry_logs").select("*").eq("node_id", nodeId).order("recorded_at", { ascending: false }).limit(MAX)
      .then(({ data }) => alive && setHistory((data || []).reverse()));
    const off = onTelemetry((r) => {
      if (r.node_id === nodeId) setHistory((h) => [...h.filter((x) => x.id !== r.id), r].slice(-MAX));
    });
    return () => {
      alive = false;
      off();
    };
  }, [nodeId, onTelemetry]);
  return history;
}

function TwinPanel({ twin, nodeId }) {
  const { isAdmin } = useAuth();
  const rows = [["Pressure", `${num(twin?.expected_pressure_bar, 2)} bar`], ["Flow", `${num(twin?.expected_flow_m3h, 1)} m³/h`],
    ["Min reservoir", `${num(twin?.min_reservoir_pct, 0)} %`], ["Night leak limit", `${num(twin?.night_leak_threshold_m3h, 2)} m³/h`],
    ["Tolerance", `± ${num(twin?.tolerance_pct, 0)} %`]];
  return (
    <div className="panel p-5" data-testid="twin-profile-panel">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">Digital Twin baseline</h3>
        {isAdmin && <TwinEditorDialog nodeId={nodeId} twin={twin} />}
      </div>
      <dl className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-slate-800/60 pb-2 text-sm">
            <dt className="text-slate-400">{k}</dt><dd className="font-mono text-cyan-200">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function NodeDetail() {
  const { nodeId } = useParams();
  const { nodes, sites, twins, incidents } = useOrgData();
  const { canOperate } = useAuth();
  const node = nodes.find((n) => n.id === nodeId);
  const twin = twins[nodeId];
  const history = useNodeHistory(nodeId);
  const series = useMemo(() => {
    const pick = (k) => history.map((r) => ({ t: clock(r.recorded_at), value: Number(r[k]) }));
    return { p: pick("pressure_bar"), f: pick("flow_m3h"), r: pick("reservoir_pct"), w: pick("pump_power_kw") };
  }, [history]);
  const last = history[history.length - 1];
  if (!node) return <p className="text-slate-400" data-testid="node-not-found">Node not found.</p>;

  const tol = Number(twin?.tolerance_pct || 15) / 100;
  const ep = Number(twin?.expected_pressure_bar || 0);
  const ef = Number(twin?.expected_flow_m3h || 0);
  const site = sites.find((s) => s.id === node.site_id);
  const nodeIncidents = incidents.filter((i) => i.node_id === nodeId).slice(0, 6);

  return (
    <div data-testid="node-detail-page">
      <Link to="/sites" className="mb-4 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-200" data-testid="node-back-link">
        <ArrowLeft className="h-3 w-3" /> Sites & nodes
      </Link>
      <div className="rise mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-300/80">{site?.name} · {node.device_eui}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl" data-testid="node-title">{node.label}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-slate-400">
          <NodeStatus status={node.status} testid="node-detail-status" />
          <span className="flex items-center gap-1"><Battery className="h-3.5 w-3.5" />{num(node.battery_pct, 0)}%</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeAgo(node.last_ping)}</span>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-4 md:grid-cols-2">
          <TelemetryChart title="Line pressure" unit="bar" color="#38BDF8" data={series.p} testid="chart-pressure"
            band={twin ? [ep * (1 - tol), ep * (1 + tol)] : null} current={num(last?.pressure_bar, 2)}
            refs={twin ? [{ y: ep * 0.7, label: "burst 70%", color: "#EF4444" }] : []} />
          <TelemetryChart title="Flow rate" unit="m³/h" color="#00E5FF" data={series.f} testid="chart-flow"
            band={twin ? [ef * (1 - tol), ef * (1 + tol)] : null} current={num(last?.flow_m3h, 1)}
            refs={twin ? [{ y: ef * 1.25, label: "125%", color: "#F59E0B" }] : []} />
          <TelemetryChart title="Reservoir level" unit="%" color="#10B981" data={series.r} testid="chart-reservoir" current={num(last?.reservoir_pct, 0)}
            refs={twin ? [{ y: Number(twin.min_reservoir_pct), label: "min", color: "#F59E0B" }] : []} />
          <TelemetryChart title={`Pump power · ${last ? (last.pump_active ? "running" : "TRIPPED") : "--"}`} unit="kW" color="#F59E0B"
            data={series.w} testid="chart-power" current={num(last?.pump_power_kw, 1)} />
        </div>
        <div className="space-y-6">
          <TwinPanel twin={twin} nodeId={nodeId} />
          {canOperate && (
            <div className="panel p-5" data-testid="node-scenario-panel">
              <h3 className="mb-1 font-display text-base font-semibold">Inject a scenario</h3>
              <p className="mb-4 text-xs text-slate-500">Sends an anomalous reading through the Digital Twin trigger.</p>
              <ScenarioButtons nodeId={nodeId} />
            </div>
          )}
          <div className="panel p-5" data-testid="node-incidents-panel">
            <h3 className="mb-3 font-display text-base font-semibold">Incident history</h3>
            {nodeIncidents.length === 0 ? <p className="text-xs text-slate-500">No incidents recorded.</p> : (
              <ul className="space-y-3">
                {nodeIncidents.map((i) => (
                  <li key={i.id} className="border-b border-slate-800/60 pb-3 text-sm">
                    <div className="flex items-center gap-2"><SeverityBadge severity={i.severity} /><CategoryTag category={i.category} />
                      <span className="ml-auto"><IncidentStatusBadge status={i.status} /></span></div>
                    <p className="mt-1 text-xs text-slate-400">{timeAgo(i.created_at)} · {zar(i.hourly_financial_loss_zar)}/h</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
