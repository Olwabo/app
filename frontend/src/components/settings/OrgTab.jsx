import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgData } from "@/context/OrgDataContext";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { SECTOR_LABEL } from "@/lib/format";

export default function OrgTab() {
  const { org, refresh } = useOrgData();
  const { isAdmin, loadProfile } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (org) setForm({ name: org.name, sector: org.sector, tariff_zar_per_kl: org.tariff_zar_per_kl });
  }, [org]);
  if (!form) return null;
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/org", { ...form, tariff_zar_per_kl: Number(form.tariff_zar_per_kl) });
      await Promise.all([refresh(), loadProfile()]);
      toast.success("Organization updated");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={save} className="panel max-w-2xl space-y-5 p-6" data-testid="org-settings-form">
      <div className="space-y-1.5">
        <Label htmlFor="org-name" className="text-xs text-slate-400">Organization name</Label>
        <Input id="org-name" disabled={!isAdmin} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="org-name-input" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Sector</Label>
          <Select disabled={!isAdmin} value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
            <SelectTrigger data-testid="org-sector-select"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(SECTOR_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tariff" className="text-xs text-slate-400">Water tariff (R per kL)</Label>
          <Input id="tariff" type="number" step="0.01" min="0" disabled={!isAdmin} className="font-mono" value={form.tariff_zar_per_kl}
            onChange={(e) => setForm({ ...form, tariff_zar_per_kl: e.target.value })} data-testid="org-tariff-input" />
        </div>
      </div>
      <p className="text-xs text-slate-500">The tariff prices every new incident's hourly financial loss (1 m³ = 1 kL).</p>
      {isAdmin && <Button type="submit" disabled={saving} data-testid="org-save-btn">{saving ? "Saving…" : "Save changes"}</Button>}
    </form>
  );
}
