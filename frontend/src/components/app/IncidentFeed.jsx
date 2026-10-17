import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useOrgData } from "@/context/OrgDataContext";
import { CategoryTag, IncidentStatusBadge, SeverityBadge } from "@/components/app/Badges";
import { isOpen, num, timeAgo, zar } from "@/lib/format";

export default function IncidentFeed({ limit = 8 }) {
  const { incidents, nodes, sites } = useOrgData();
  const open = incidents.filter(isOpen).slice(0, limit);
  const nodeOf = (id) => nodes.find((n) => n.id === id);
  const siteOf = (id) => sites.find((s) => s.id === id);
  return (
    <div className="panel flex h-full flex-col" data-testid="incident-feed">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <h2 className="font-display text-base font-semibold">Live incident feed</h2>
        <Link to="/incidents" className="font-mono text-[11px] uppercase tracking-wider text-cyan-300 hover:text-cyan-100" data-testid="incident-feed-view-all">View all</Link>
      </div>
      {open.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center" data-testid="incident-feed-empty">
          <ShieldCheck className="h-8 w-8 text-emerald-400" />
          <p className="text-sm text-slate-300">All networks nominal</p>
          <p className="text-xs text-slate-500">The Digital Twin engine is watching every reading.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-800/80">
          {open.map((inc) => (
            <li key={inc.id} className={`rise px-5 py-4 ${inc.severity === "CRITICAL" ? "bg-red-500/[0.04]" : ""}`} data-testid={`feed-incident-${inc.id}`}>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={inc.severity} />
                <CategoryTag category={inc.category} />
                <span className="ml-auto font-mono text-[10px] text-slate-500">{timeAgo(inc.created_at)}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-100">{inc.title}</p>
              <p className="text-xs text-slate-500">{siteOf(inc.site_id)?.name} · {nodeOf(inc.node_id)?.label}</p>
              <div className="mt-2 flex items-center gap-3 font-mono text-[11px]">
                <span className="text-amber-400">{num(inc.water_loss_rate_m3h, 1)} m³/h</span>
                <span className="text-red-400">{zar(inc.hourly_financial_loss_zar)}/h</span>
                <span className="ml-auto"><IncidentStatusBadge status={inc.status} /></span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
