import { CATEGORY_LABEL, INCIDENT_STATUS_STYLE, SEVERITY_STYLE, STATUS_STYLE } from "@/lib/format";

const STATUS_TEXT = { ONLINE: "Normal", WARNING: "Warning", CRITICAL: "Critical", OFFLINE: "Offline" };
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();

export function NodeStatus({ status, testid }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.OFFLINE;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`} data-testid={testid}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {STATUS_TEXT[status] || status}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[severity]}`}>
      {cap(severity)}
    </span>
  );
}

export function IncidentStatusBadge({ status, testid }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${INCIDENT_STATUS_STYLE[status]}`} data-testid={testid}>
      {status === "ACTIVE" ? "Open" : cap(status)}
    </span>
  );
}

export function CategoryTag({ category }) {
  return <span className="text-xs text-slate-400">{CATEGORY_LABEL[category] || category}</span>;
}
