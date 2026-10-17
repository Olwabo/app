import { useState } from "react";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgData } from "@/context/OrgDataContext";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/app/Screens";
import { NodeStatus } from "@/components/app/Badges";
import ScenarioButtons from "@/components/app/ScenarioButtons";
import { clock, num } from "@/lib/format";

export default function Simulator() {
  const { nodes, sites, twins, latest } = useOrgData();
  const { canOperate } = useAuth();
  const [nodeId, setNodeId] = useState("");
  const [log, setLog] = useState([]);
  const node = nodes.find((n) => n.id === nodeId);
  const twin = twins[nodeId];
  const t = latest[nodeId];
  const onInjected = (scenario, data) =>
    setLog((l) => [{ at: new Date().toISOString(), scenario, node: node?.label, incident: data.incident?.title }, ...l].slice(0, 12));

  return (
    <div data-testid="simulator-page">
      <PageHeader eyebrow="Demo & commissioning" title="Scenario simulator" />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="panel p-5">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">1 · Target node</p>
            <Select value={nodeId} onValueChange={setNodeId}>
              <SelectTrigger className="max-w-md border-slate-700 bg-slate-950/60" data-testid="simulator-node-select">
                <SelectValue placeholder="Choose a sensor node" />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id} data-testid={`simulator-node-option-${n.device_eui}`}>
                    {n.label} · {sites.find((s) => s.id === n.site_id)?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {node && (
              <div className="mt-4 flex flex-wrap items-center gap-4 font-mono text-xs text-slate-400" data-testid="simulator-node-summary">
                <NodeStatus status={node.status} testid="simulator-node-status" />
                <span>twin {num(twin?.expected_pressure_bar, 2)} bar / {num(twin?.expected_flow_m3h, 1)} m³/h</span>
                <span className="text-slate-200">now {num(t?.pressure_bar, 2)} bar / {num(t?.flow_m3h, 1)} m³/h</span>
                <Link to={`/nodes/${node.id}`} className="text-cyan-300 hover:text-cyan-100" data-testid="simulator-open-node-link">Open live charts →</Link>
              </div>
            )}
          </div>
          <div className="panel p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">2 · Inject anomaly</p>
            {canOperate ? <ScenarioButtons nodeId={nodeId} layout="grid" onInjected={onInjected} />
              : <p className="text-sm text-slate-400">Viewers cannot run scenarios.</p>}
            <p className="mt-4 text-xs text-slate-500">
              Simulated nodes (SIM-*) keep streaming the anomaly until the incident is resolved. For real gateways one anomalous reading is inserted.
            </p>
          </div>
        </div>
        <div className="panel p-5" data-testid="simulator-log">
          <h3 className="mb-3 font-display text-base font-semibold">Injection log</h3>
          {log.length === 0 ? <p className="text-xs text-slate-500">Nothing injected this session.</p> : (
            <ul className="space-y-3 font-mono text-xs">
              {log.map((l) => (
                <li key={l.at} className="border-b border-slate-800/60 pb-2">
                  <p className="text-slate-500">{clock(l.at)} · {l.scenario}</p>
                  <p className="text-slate-200">{l.node}</p>
                  <p className="text-cyan-300/80">{l.incident ? `→ ${l.incident}` : "→ reading inserted"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
