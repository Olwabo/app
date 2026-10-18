import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/Screens";
import { api, errMsg } from "@/lib/api";
import { dateTime, SECTOR_LABEL } from "@/lib/format";

const EMPTY = { sector: "MANUFACTURING", tariff_zar_per_kl: "42.50" };

function CreateOrg({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/platform/orgs", { ...f, tariff_zar_per_kl: Number(f.tariff_zar_per_kl) });
      toast.success(`${f.name} added. Their admin can sign in now.`);
      setF(EMPTY);
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  const field = (k, label, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`o-${k}`} className="text-xs text-slate-400">{label}</Label>
      <Input id={`o-${k}`} type={type} step="0.01" required value={f[k] || ""} minLength={type === "password" ? 8 : undefined}
        onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`org-create-${k}-input`} />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2" data-testid="create-org-btn"><Plus className="h-4 w-4" /> Add organization</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#252b36] bg-[#151a22]" data-testid="create-org-dialog">
        <DialogHeader><DialogTitle className="font-display">Add an organization</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {field("name", "Organization name")}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Sector</Label>
              <Select value={f.sector} onValueChange={(v) => setF({ ...f, sector: v })}>
                <SelectTrigger data-testid="org-create-sector-select"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SECTOR_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select></div>
            {field("tariff_zar_per_kl", "Tariff (R/kL)", "number")}
          </div>
          <p className="pt-2 text-sm font-medium text-slate-300">Their first admin</p>
          {field("admin_full_name", "Full name")}
          {field("admin_email", "Email", "email")}
          {field("admin_password", "Temporary password (min 8)", "password")}
          <DialogFooter><Button type="submit" disabled={saving} data-testid="org-create-submit-btn">{saving ? "Creating…" : "Add organization"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Platform() {
  const [orgs, setOrgs] = useState([]);
  const load = useCallback(() => api.get("/platform/orgs").then(({ data }) => setOrgs(data)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div data-testid="platform-page">
      <PageHeader eyebrow="Every organization using AmanziAlert. Only you can see this page." title="Organizations"><CreateOrg onCreated={load} /></PageHeader>
      <div className="panel overflow-x-auto">
        <Table data-testid="platform-orgs-table">
          <TableHeader>
            <TableRow className="border-[#252b36] hover:bg-transparent">
              {["Organization", "Sector", "Tariff", "Sites", "Meters", "Users", "Open incidents", "Joined"].map((h) => (
                <TableHead key={h} className="text-xs font-medium text-slate-400">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((o) => (
              <TableRow key={o.id} className="border-[#252b36] hover:bg-[#1a2029]" data-testid={`platform-org-${o.id}`}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell className="text-slate-400">{SECTOR_LABEL[o.sector]}</TableCell>
                <TableCell className="tabular-nums">R {Number(o.tariff_zar_per_kl).toFixed(2)}</TableCell>
                <TableCell className="tabular-nums">{o.site_count}</TableCell>
                <TableCell className="tabular-nums">{o.node_count}</TableCell>
                <TableCell className="tabular-nums">{o.user_count}</TableCell>
                <TableCell className={`tabular-nums ${o.open_incidents > 0 ? "text-red-400" : "text-slate-400"}`}>{o.open_incidents}</TableCell>
                <TableCell className="text-xs text-slate-500">{dateTime(o.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
