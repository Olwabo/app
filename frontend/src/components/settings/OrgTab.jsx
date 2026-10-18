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
    if (org) setForm({ name: org.name, sector: org.sector });
  }, [org]);
  if (!form) return null;
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/org", form);
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
      <div className="max-w-xs">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Sector</Label>
          <Select disabled={!isAdmin} value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
            <SelectTrigger data-testid="org-sector-select"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(SECTOR_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {isAdmin && <Button type="submit" disabled={saving} data-testid="org-save-btn">{saving ? "Saving…" : "Save changes"}</Button>}
    </form>
  );
}
