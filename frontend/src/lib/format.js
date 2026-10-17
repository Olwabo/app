export const zar = (v, digits = 0) =>
  `R ${Number(v || 0).toLocaleString("en-ZA", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const num = (v, d = 1) => (v === null || v === undefined ? "--" : Number(v).toFixed(d));

export const timeAgo = (iso) => {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const clock = (iso) =>
  new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "--";

export const hoursOpen = (inc) =>
  ((inc.resolved_at ? new Date(inc.resolved_at) : new Date()) - new Date(inc.created_at)) / 3600000;

export const isOpen = (inc) => inc.status !== "RESOLVED";

export const STATUS_STYLE = {
  ONLINE: { dot: "bg-emerald-500", text: "text-emerald-400", ring: "border-emerald-500/30 bg-emerald-500/10" },
  WARNING: { dot: "bg-amber-500", text: "text-amber-400", ring: "border-amber-500/30 bg-amber-500/10" },
  CRITICAL: { dot: "bg-red-500", text: "text-red-400", ring: "border-red-500/40 bg-red-500/10" },
  OFFLINE: { dot: "bg-slate-500", text: "text-slate-400", ring: "border-slate-600/40 bg-slate-700/20" },
};

export const SEVERITY_STYLE = {
  CRITICAL: "border-red-500/40 bg-red-500/10 text-red-400",
  MEDIUM: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  LOW: "border-sky-500/40 bg-sky-500/10 text-sky-400",
};

export const INCIDENT_STATUS_STYLE = {
  ACTIVE: "border-red-500/40 text-red-400",
  DISPATCHED: "border-cyan-400/40 text-cyan-300",
  RESOLVED: "border-emerald-500/40 text-emerald-400",
};

export const CATEGORY_LABEL = {
  PIPE_BURST: "Pipe burst",
  MICRO_LEAK: "Micro leak",
  AFTER_HOURS_LEAK: "After-hours leak",
  PUMP_TRIP_POWER: "Pump trip / power",
  RESERVOIR_LOW: "Reservoir low",
};

export const SECTOR_LABEL = {
  MANUFACTURING: "Manufacturing",
  AGRICO: "Agri / Estates",
  COMMERCIAL_ESTATE: "Commercial estate",
  MUNICIPAL: "Municipal utility",
};

export const ROLE_LABEL = { ORG_ADMIN: "Org admin", OPERATOR: "Operator", VIEWER: "Viewer" };
