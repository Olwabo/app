import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmButton from "@/components/app/ConfirmButton";
import { API_BASE, api, errMsg } from "@/lib/api";
import { dateTime } from "@/lib/format";

export default function DevicesTab() {
  const [info, setInfo] = useState(null);
  const [fresh, setFresh] = useState(null);
  const load = () => api.get("/org/ingest-key").then(({ data }) => setInfo(data));
  useEffect(() => {
    load();
  }, []);
  const rotate = async () => {
    try {
      const { data } = await api.post("/org/ingest-key");
      setFresh(data.api_key);
      load();
      toast.success("New ingest key generated — copy it now");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const key = fresh || "<YOUR_INGEST_KEY>";
  const curl = `curl -X POST ${API_BASE}/ingest/telemetry \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: ${key}" \\
  -d '{"device_eui":"A84041000181F2B1","pressure_bar":4.4,"flow_m3h":58.2,"reservoir_pct":71,"pump_active":true,"pump_power_kw":11.3,"battery_pct":96}'`;
  const copy = (t) => navigator.clipboard.writeText(t).then(() => toast.success("Copied"));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="panel p-6" data-testid="ingest-key-panel">
        <div className="flex items-start gap-4">
          <KeyRound className="mt-0.5 h-5 w-5 text-cyan-300" />
          <div className="flex-1">
            <p className="font-semibold">Gateway ingest key</p>
            <p className="text-sm text-slate-400" data-testid="ingest-key-status">
              {info?.exists ? `Active key ${info.key_prefix}… created ${dateTime(info.created_at)}` : "No key yet. Generate one for your ESP32 / Modbus gateways."}
            </p>
          </div>
          <ConfirmButton testid="rotate-ingest-key-btn" title={info?.exists ? "Rotate ingest key?" : "Generate ingest key?"}
            description={info?.exists ? "The current key stops working immediately. Update every gateway." : "The key is shown only once."}
            confirmLabel="Generate" onConfirm={rotate}>{info?.exists ? "Rotate key" : "Generate key"}</ConfirmButton>
        </div>
        {fresh && (
          <div className="mt-4 flex items-center gap-2 rounded-sm border border-amber-500/40 bg-amber-500/10 p-3">
            <code className="flex-1 break-all text-xs text-amber-200" data-testid="ingest-key-value">{fresh}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(fresh)} data-testid="copy-ingest-key-btn"><Copy className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
      <div className="panel p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">Send a reading</p>
          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => copy(curl)} data-testid="copy-curl-btn"><Copy className="h-3.5 w-3.5" /> Copy</Button>
        </div>
        <pre className="overflow-x-auto rounded-sm bg-slate-950 p-4 text-xs leading-relaxed text-cyan-100" data-testid="ingest-curl-example">{curl}</pre>
        <p className="mt-3 text-xs text-slate-500">The device_eui must match a node registered under Sites & Nodes. Each reading runs through the Digital Twin trigger.</p>
      </div>
    </div>
  );
}
