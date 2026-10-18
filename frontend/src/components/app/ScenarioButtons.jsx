import { useState } from "react";
import { toast } from "sonner";
import { Loader2, PowerOff, Waves, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";

export const SCENARIOS = [
  { id: "PIPE_BURST", label: "Burst pipe", icon: Zap, tone: "hover:border-red-400/50",
    rule: "Pressure falls hard while flow jumps well above normal.", result: "Opens a critical incident" },
  { id: "MICRO_LEAK", label: "Slow leak", icon: Waves, tone: "hover:border-amber-400/50",
    rule: "Pressure sags even though nobody is drawing extra water.", result: "Opens a warning" },
  { id: "PUMP_TRIP", label: "Pump stops / power cut", icon: PowerOff, tone: "hover:border-red-400/50",
    rule: "The pump stops and flow drops to almost nothing.", result: "Opens a critical incident" },
];

export default function ScenarioButtons({ nodeId, onInjected, layout = "stack" }) {
  const [busy, setBusy] = useState(null);
  const run = async (scenario) => {
    setBusy(scenario);
    try {
      const { data } = await api.post("/simulate", { node_id: nodeId, scenario });
      toast.success("Test reading sent", {
        description: data.incident ? `Opened: ${data.incident.title}` : "No incident was opened",
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
          className={`h-auto justify-start gap-3 whitespace-normal border-[#2d3440] bg-[#11161d] px-4 py-3 text-left hover:bg-[#1a2029] ${tone}`}>
          {busy === id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Icon className="h-4 w-4 shrink-0 text-slate-300" />}
          <span className="flex flex-col">
            <span className="text-sm font-medium text-slate-100">{label}</span>
            {layout === "grid" && <span className="mt-1 text-sm font-normal text-slate-400">{rule}</span>}
            {layout === "grid" && <span className="mt-2 text-xs text-slate-500">{result}</span>}
          </span>
        </Button>
      ))}
    </div>
  );
}
