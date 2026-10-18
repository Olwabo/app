import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TooltipBox = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  const v = payload.find((p) => p.dataKey === "value");
  const b = payload.find((p) => p.dataKey === "band");
  return (
    <div className="rounded-md border border-[#2d3440] bg-[#11161d] px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-500">{label}</p>
      {v && <p className="text-slate-100">{Number(v.value).toFixed(2)} {unit}</p>}
      {b && <p className="text-slate-400">expected {Number(b.value[0]).toFixed(2)}–{Number(b.value[1]).toFixed(2)}</p>}
    </div>
  );
};

export default function TelemetryChart({ title, unit, data, color, band, refs = [], current, testid }) {
  const rows = data.map((d) => ({ ...d, band: band || undefined }));
  return (
    <div className="panel p-4" data-testid={testid}>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm text-slate-400">{title}</p>
        <p className="text-xl font-semibold tabular-nums text-slate-50" data-testid={`${testid}-current`}>
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
            {band && <Area dataKey="band" stroke="none" fill="rgba(148,163,184,0.10)" isAnimationActive={false} />}
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
