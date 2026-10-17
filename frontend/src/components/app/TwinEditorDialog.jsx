import { useState } from "react";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errMsg } from "@/lib/api";
import { useOrgData } from "@/context/OrgDataContext";

const FIELDS = [
  ["expected_pressure_bar", "Expected pressure (bar)"],
  ["expected_flow_m3h", "Expected flow (m³/h)"],
  ["min_reservoir_pct", "Min reservoir (%)"],
  ["night_leak_threshold_m3h", "Night leak threshold (m³/h)"],
  ["tolerance_pct", "Tolerance (%)"],
];

export default function TwinEditorDialog({ nodeId, twin }) {
  const { refresh } = useOrgData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const openWith = (o) => {
    if (o) setForm(Object.fromEntries(FIELDS.map(([k]) => [k, twin?.[k] ?? ""])));
    setOpen(o);
  };
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/nodes/${nodeId}/twin`, Object.fromEntries(FIELDS.map(([k]) => [k, Number(form[k])])));
      await refresh();
      toast.success("Digital Twin profile updated");
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={openWith}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-slate-700 hover:bg-cyan-400 hover:text-slate-950" data-testid="edit-twin-btn">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Calibrate twin
        </Button>
      </DialogTrigger>
      <DialogContent className="border-slate-800 bg-[#0B1220]" data-testid="twin-editor-dialog">
        <DialogHeader><DialogTitle className="font-display">Digital Twin calibration</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={k} className="text-xs text-slate-400">{label}</Label>
              <Input id={k} type="number" step="0.01" required value={form[k] ?? ""} className="font-mono"
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`twin-input-${k}`} />
            </div>
          ))}
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={saving} data-testid="twin-save-btn">{saving ? "Saving…" : "Save profile"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
