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
      <PageHeader eyebrow="Send a fake fault to a meter to check that alerts, emails and the incident board work." title="Test scenarios" />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="panel p-5">
            <p className="mb-3 font-medium">1. Pick a meter</p>
            <Select value={nodeId} onValueChange={setNodeId}>
              <SelectTrigger className="max-w-md border-[#2d3440] bg-[#11161d]" data-testid="simulator-node-select">
                <SelectValue placeholder="Choose a meter" />
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
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400" data-testid="simulator-node-summary">
                <NodeStatus status={node.status} testid="simulator-node-status" />
                <span>Normally {num(twin?.expected_pressure_bar, 2)} bar, {num(twin?.expected_flow_m3h, 1)} m³/h</span>
                <span className="text-slate-200">Right now {num(t?.pressure_bar, 2)} bar, {num(t?.flow_m3h, 1)} m³/h</span>
                <Link to={`/nodes/${node.id}`} className="text-sky-300 hover:underline" data-testid="simulator-open-node-link">Watch the charts</Link>
              </div>
            )}
          </div>
          <div className="panel p-5">
            <p className="mb-4 font-medium">2. Choose what goes wrong</p>
            {canOperate ? <ScenarioButtons nodeId={nodeId} layout="grid" onInjected={onInjected} />
              : <p className="text-sm text-slate-400">Your account can view only, so you can't run tests.</p>}
            <p className="mt-4 text-sm text-slate-500">
              Simulated meters (SIM-…) keep showing the fault until you resolve the incident. Real meters get a single test reading.
            </p>
          </div>
        </div>
        <div className="panel p-5" data-testid="simulator-log">
          <h3 className="mb-3 font-medium">What you've tested</h3>
          {log.length === 0 ? <p className="text-sm text-slate-500">Nothing yet this session.</p> : (
            <ul className="space-y-3 text-sm">
              {log.map((l) => (
                <li key={l.at} className="border-b border-[#252b36] pb-2">
                  <p className="text-xs text-slate-500">{clock(l.at)}</p>
                  <p className="text-slate-200">{l.node}</p>
                  <p className="text-slate-400">{l.incident || "Reading sent, no incident"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
