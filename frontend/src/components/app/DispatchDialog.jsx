import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errMsg } from "@/lib/api";

export default function DispatchDialog({ incident, onClose }) {
  const [tech, setTech] = useState(incident?.assigned_technician || "");
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/incidents/${incident.id}/dispatch`, { technician: tech });
      toast.success(`Dispatched to ${tech}`);
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!incident} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-slate-800 bg-[#0B1220]" data-testid="dispatch-dialog">
        <DialogHeader><DialogTitle className="font-display">Dispatch field technician</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-400">{incident?.title}</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tech" className="text-xs text-slate-400">Technician / crew name</Label>
            <Input id="tech" required minLength={2} value={tech} onChange={(e) => setTech(e.target.value)}
              placeholder="e.g. Crew B – Plumbing" data-testid="dispatch-technician-input" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} data-testid="dispatch-submit-btn">{saving ? "Dispatching…" : "Dispatch"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
