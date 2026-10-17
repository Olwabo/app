import { Link } from "react-router-dom";
import { Battery, Gauge, Power, Waves } from "lucide-react";
import { useOrgData } from "@/context/OrgDataContext";
import { NodeStatus } from "@/components/app/Badges";
import { num, STATUS_STYLE, timeAgo } from "@/lib/format";

function Metric({ icon: Icon, value, unit, off }) {
  return (
    <div className={`flex items-baseline gap-1 ${off ? "text-red-400" : "text-slate-100"}`}>
      <Icon className="h-3 w-3 self-center text-slate-500" />
      <span className="font-mono text-sm font-semibold">{value}</span>
      <span className="text-[10px] text-slate-500">{unit}</span>
    </div>
  );
}

export function NodeCard({ node }) {
  const { latest, twins } = useOrgData();
  const t = latest[node.id];
  const twin = twins[node.id];
  const lowP = t && twin && Number(t.pressure_bar) < Number(twin.expected_pressure_bar) * 0.85;
  const highF = t && twin && Number(t.flow_m3h) > Number(twin.expected_flow_m3h) * 1.25;
  const s = STATUS_STYLE[node.status];
  return (
    <Link to={`/nodes/${node.id}`} data-testid={`node-card-${node.device_eui}`}
      className={`group relative block overflow-hidden rounded-md border bg-slate-950/50 p-4 transition-colors duration-200 hover:bg-slate-900 ${node.status === "CRITICAL" ? "border-red-500/50" : "border-slate-800 hover:border-cyan-400/40"}`}>
      <span className={`absolute left-0 top-0 h-full w-0.5 ${s.dot}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100 group-hover:text-cyan-200">{node.label}</p>
          <p className="font-mono text-[10px] text-slate-500">{node.device_eui}</p>
        </div>
        <NodeStatus status={node.status} testid={`node-status-${node.device_eui}`} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
        <Metric icon={Gauge} value={num(t?.pressure_bar, 2)} unit="bar" off={lowP} />
        <Metric icon={Waves} value={num(t?.flow_m3h, 1)} unit="m³/h" off={highF} />
        <Metric icon={Power} value={t ? (t.pump_active ? "RUN" : "TRIP") : "--"} unit={t ? `${num(t.pump_power_kw, 1)} kW` : ""} off={t && !t.pump_active} />
        <Metric icon={Battery} value={num(node.battery_pct, 0)} unit="%" />
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-sky-400/70 transition-[width] duration-700" style={{ width: `${t ? t.reservoir_pct : 0}%` }} />
      </div>
      <p className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500">
        <span>reservoir {num(t?.reservoir_pct, 0)}%</span><span>{timeAgo(node.last_ping)}</span>
      </p>
    </Link>
  );
}

export default function NodeGrid() {
  const { sites, nodes } = useOrgData();
  if (!nodes.length) {
    return <p className="panel p-6 text-sm text-slate-400" data-testid="no-nodes-message">No sensor nodes yet. Add sites and nodes under Sites & Nodes.</p>;
  }
  return (
    <div className="space-y-6">
      {sites.map((site) => {
        const list = nodes.filter((n) => n.site_id === site.id);
        if (!list.length) return null;
        return (
          <section key={site.id} data-testid={`site-group-${site.id}`}>
            <div className="mb-3 flex items-baseline gap-3">
              <h3 className="font-display text-base font-semibold text-slate-100">{site.name}</h3>
              <span className="font-mono text-[11px] text-slate-500">{site.location_label}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {list.map((n) => <NodeCard key={n.id} node={n} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
