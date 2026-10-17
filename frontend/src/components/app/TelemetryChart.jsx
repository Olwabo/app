import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TooltipBox = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  const v = payload.find((p) => p.dataKey === "value");
  const b = payload.find((p) => p.dataKey === "band");
  return (
    <div className="rounded-sm border border-slate-700 bg-slate-950/95 px-3 py-2 font-mono text-[11px] shadow-xl">
      <p className="text-slate-500">{label}</p>
      {v && <p className="text-slate-100">{Number(v.value).toFixed(2)} {unit}</p>}
      {b && <p className="text-cyan-300/80">twin {Number(b.value[0]).toFixed(2)}–{Number(b.value[1]).toFixed(2)}</p>}
    </div>
  );
};

export default function TelemetryChart({ title, unit, data, color, band, refs = [], current, testid }) {
  const rows = data.map((d) => ({ ...d, band: band || undefined }));
  return (
    <div className="panel p-4" data-testid={testid}>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{title}</p>
        <p className="font-mono text-xl font-bold tracking-tight" style={{ color }} data-testid={`${testid}-current`}>
          {current ?? "--"} <span className="text-xs text-slate-500">{unit}</span>
        </p>
      </div>
      <div className="relative h-56">
        {rows.length === 0 && (
          <p className="absolute inset-0 z-10 flex items-center justify-center font-mono text-xs text-slate-500" data-testid={`${testid}-empty`}>
            Awaiting first reading…
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={40} />
            <YAxis tickLine={false} axisLine={false} domain={["auto", "auto"]} width={60} />
            <Tooltip content={<TooltipBox unit={unit} />} />
            {band && <Area dataKey="band" stroke="#00E5FF" strokeOpacity={0.35} strokeDasharray="4 4" fill="rgba(56,189,248,0.12)" isAnimationActive={false} />}
            {refs.map((r) => (
              <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="3 3" label={{ value: r.label, position: "insideTopRight", fill: r.color, fontSize: 9 }} />
            ))}
            <Line dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
