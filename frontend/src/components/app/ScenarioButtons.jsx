import { useState } from "react";
import { toast } from "sonner";
import { Loader2, PowerOff, Waves, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";

export const SCENARIOS = [
  { id: "PIPE_BURST", label: "Pipe burst", icon: Zap, tone: "hover:border-red-500/60 hover:bg-red-500/10",
    rule: "Pressure < 70% of twin AND flow > 125% of twin", result: "CRITICAL · PIPE_BURST" },
  { id: "MICRO_LEAK", label: "Micro leak", icon: Waves, tone: "hover:border-amber-500/60 hover:bg-amber-500/10",
    rule: "Pressure < 85% of twin with flow ≤ twin", result: "MEDIUM · MICRO_LEAK" },
  { id: "PUMP_TRIP", label: "Pump trip / load shedding", icon: PowerOff, tone: "hover:border-red-500/60 hover:bg-red-500/10",
    rule: "Pump inactive AND flow < 5 m³/h", result: "CRITICAL · PUMP_TRIP_POWER" },
];

export default function ScenarioButtons({ nodeId, onInjected, layout = "stack" }) {
  const [busy, setBusy] = useState(null);
  const run = async (scenario) => {
    setBusy(scenario);
    try {
      const { data } = await api.post("/simulate", { node_id: nodeId, scenario });
      toast.success("Anomaly injected into telemetry stream", {
        description: data.incident ? `Twin engine opened: ${data.incident.title}` : "Reading inserted",
      });
      onInjected?.(scenario, data);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className={layout === "grid" ? "grid gap-3 md:grid-cols-3" : "flex flex-col gap-2"}>
      {SCENARIOS.map(({ id, label, icon: Icon, tone, rule, result }) => (
        <Button key={id} variant="outline" disabled={!nodeId || !!busy} onClick={() => run(id)} data-testid={`inject-${id.toLowerCase()}-btn`}
          className={`h-auto justify-start gap-3 whitespace-normal border-slate-700 bg-slate-950/40 px-4 py-3 text-left transition-colors duration-200 ${tone}`}>
          {busy === id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Icon className="h-4 w-4 shrink-0 text-slate-300" />}
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-slate-100">{label}</span>
            {layout === "grid" && <span className="mt-1 text-xs font-normal text-slate-400">{rule}</span>}
            {layout === "grid" && <span className="mt-1 font-mono text-[10px] text-cyan-300/80">→ {result}</span>}
          </span>
        </Button>
      ))}
    </div>
  );
}
