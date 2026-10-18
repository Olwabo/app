import { AlertOctagon, Banknote, Droplet, Radio } from "lucide-react";
import { useOrgData } from "@/context/OrgDataContext";
import { num, zar } from "@/lib/format";

function Tile({ label, value, sub, icon: Icon, tone, testid, delay }) {
  return (
    <div className="rise px-1 py-2" style={{ animationDelay: `${delay}ms` }} data-testid={testid}>
      <p className="flex items-center gap-2 text-sm text-slate-400"><Icon className="h-4 w-4 text-slate-500" />{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${tone}`} data-testid={`${testid}-value`}>{value}</p>
      <p className="mt-1 text-sm text-slate-500">{sub}</p>
    </div>
  );
}

export default function KpiStrip() {
  const { kpis } = useOrgData();
  const hot = kpis.zarPerHour > 0;
  return (
    <div className="panel grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-[#252b36] [&>*]:xl:pl-6 [&>*:first-child]:xl:pl-1">
      <Tile label="Open incidents" value={kpis.open} sub={kpis.open ? `${kpis.critical} need urgent attention` : "Nothing needs attention"} icon={AlertOctagon}
        tone={kpis.critical ? "text-red-400" : kpis.open ? "text-amber-400" : "text-slate-50"} testid="kpi-open-incidents" delay={0} />
      <Tile label="Meters reporting" value={`${kpis.online}/${kpis.total}`} sub="Sent a reading in the last 10 min" icon={Radio}
        tone="text-slate-50" testid="kpi-nodes-online" delay={40} />
      <Tile label="Water being lost" value={`${num(kpis.lossRate, 1)} m³/h`} sub="From open leaks and bursts" icon={Droplet}
        tone={hot ? "text-amber-400" : "text-slate-50"} testid="kpi-water-loss" delay={80} />
      <Tile label="Cost per hour" value={zar(kpis.zarPerHour)} sub={`${zar(kpis.zarSoFar)} lost since detection`} icon={Banknote}
        tone={hot ? "text-red-400" : "text-slate-50"} testid="kpi-zar-loss" delay={120} />
    </div>
  );
}
