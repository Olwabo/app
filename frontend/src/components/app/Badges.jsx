import { CATEGORY_LABEL, INCIDENT_STATUS_STYLE, SEVERITY_STYLE, STATUS_STYLE } from "@/lib/format";

export function NodeStatus({ status, testid }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.OFFLINE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${s.ring} ${s.text}`} data-testid={testid}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === "CRITICAL" ? "animate-pulse" : ""}`} />
      {status}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  return (
    <span className={`inline-flex rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${SEVERITY_STYLE[severity]}`}>
      {severity}
    </span>
  );
}

export function IncidentStatusBadge({ status, testid }) {
  return (
    <span className={`inline-flex rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${INCIDENT_STATUS_STYLE[status]}`} data-testid={testid}>
      {status}
    </span>
  );
}

export function CategoryTag({ category }) {
  return <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{CATEGORY_LABEL[category] || category}</span>;
}
