import { AlertOctagon, Banknote, Droplet, Radio } from "lucide-react";
import { useOrgData } from "@/context/OrgDataContext";
import { num, zar } from "@/lib/format";

function Tile({ label, value, sub, icon: Icon, tone, testid, delay }) {
  return (
    <div className="panel rise relative overflow-hidden p-5" style={{ animationDelay: `${delay}ms` }} data-testid={testid}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className={`mt-3 font-mono text-3xl font-bold tracking-tighter sm:text-4xl ${tone}`} data-testid={`${testid}-value`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

export default function KpiStrip() {
  const { kpis } = useOrgData();
  const hot = kpis.zarPerHour > 0;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label="Open incidents" value={kpis.open} sub={`${kpis.critical} critical`} icon={AlertOctagon}
        tone={kpis.critical ? "text-red-400" : kpis.open ? "text-amber-400" : "text-emerald-400"} testid="kpi-open-incidents" delay={0} />
      <Tile label="Nodes reporting" value={`${kpis.online}/${kpis.total}`} sub="ESP32 / Modbus gateways" icon={Radio}
        tone="text-cyan-300" testid="kpi-nodes-online" delay={60} />
      <Tile label="Live water loss" value={`${num(kpis.lossRate, 1)}`} sub="m³/h across open incidents" icon={Droplet}
        tone={hot ? "text-amber-400" : "text-slate-200"} testid="kpi-water-loss" delay={120} />
      <Tile label="Financial exposure" value={zar(kpis.zarPerHour)} sub={`per hour · ${zar(kpis.zarSoFar)} lost so far`} icon={Banknote}
        tone={hot ? "text-red-400" : "text-slate-200"} testid="kpi-zar-loss" delay={180} />
    </div>
  );
}
