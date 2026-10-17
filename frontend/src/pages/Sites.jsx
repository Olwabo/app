import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgData } from "@/context/OrgDataContext";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/app/Screens";
import { NodeCard } from "@/components/app/NodeGrid";
import ConfirmButton from "@/components/app/ConfirmButton";
import { api, errMsg } from "@/lib/api";

function FormDialog({ title, trigger, fields, onSubmit, testid, extra }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
      setForm({});
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-slate-800 bg-[#0B1220]" data-testid={`${testid}-dialog`}>
        <DialogHeader><DialogTitle className="font-display">{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {extra?.(form, setForm)}
          {fields.map(([k, label, type = "text", required = true]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={k} className="text-xs text-slate-400">{label}</Label>
              <Input id={k} type={type} step="any" required={required} value={form[k] ?? ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`${testid}-${k}-input`} />
            </div>
          ))}
          <DialogFooter><Button type="submit" disabled={saving} data-testid={`${testid}-submit-btn`}>{saving ? "Saving…" : "Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const optNum = (v) => (v === undefined || v === "" ? null : Number(v));

export default function Sites() {
  const { sites, nodes, refresh } = useOrgData();
  const { isAdmin } = useAuth();
  const addSite = async (f) => {
    await api.post("/sites", { name: f.name, location_label: f.location_label, latitude: optNum(f.latitude), longitude: optNum(f.longitude) });
    await refresh();
    toast.success("Site added");
  };
  const addNode = async (f) => {
    if (!f.site_id) throw new Error("Choose a site");
    await api.post("/nodes", { site_id: f.site_id, device_eui: f.device_eui, label: f.label });
    await refresh();
    toast.success("Node registered with a default Digital Twin profile");
  };
  const del = async (path, msg) => {
    try {
      await api.delete(path);
      await refresh();
      toast.success(msg);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const siteSelect = (form, setForm) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-400">Site</Label>
      <Select value={form.site_id || ""} onValueChange={(v) => setForm({ ...form, site_id: v })}>
        <SelectTrigger data-testid="add-node-site-select"><SelectValue placeholder="Choose site" /></SelectTrigger>
        <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  const btn = (label, id) => (
    <Button variant="outline" className="gap-2 border-slate-700 hover:bg-cyan-400 hover:text-slate-950" data-testid={id}><Plus className="h-4 w-4" />{label}</Button>
  );

  return (
    <div data-testid="sites-page">
      <PageHeader eyebrow="Facilities & gateways" title="Sites & nodes">
        {isAdmin && (
          <>
            <FormDialog title="Add site" testid="add-site" trigger={btn("Add site", "add-site-btn")} onSubmit={addSite}
              fields={[["name", "Site name"], ["location_label", "Location (town, province)"], ["latitude", "Latitude", "number", false], ["longitude", "Longitude", "number", false]]} />
            <FormDialog title="Register sensor node" testid="add-node" trigger={btn("Add node", "add-node-btn")} onSubmit={addNode} extra={siteSelect}
              fields={[["device_eui", "Device EUI (e.g. A84041000181F2B1)"], ["label", "Label"]]} />
          </>
        )}
      </PageHeader>
      <div className="space-y-6">
        {sites.map((site) => (
          <section key={site.id} className="panel rise p-5" data-testid={`site-panel-${site.id}`}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-lg font-semibold">{site.name}</h2>
              <span className="font-mono text-xs text-slate-500">{site.location_label}</span>
              {site.latitude && <span className="font-mono text-[10px] text-slate-600">{Number(site.latitude).toFixed(3)}, {Number(site.longitude).toFixed(3)}</span>}
              {isAdmin && (
                <ConfirmButton variant="ghost" size="sm" className="ml-auto gap-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400" testid={`delete-site-${site.id}`}
                  title={`Delete ${site.name}?`} description="All nodes, telemetry and incidents at this site are permanently removed." confirmLabel="Delete site"
                  onConfirm={() => del(`/sites/${site.id}`, "Site deleted")}><Trash2 className="h-3.5 w-3.5" /> Delete</ConfirmButton>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {nodes.filter((n) => n.site_id === site.id).map((n) => (
                <div key={n.id} className="relative">
                  <NodeCard node={n} />
                  {isAdmin && (
                    <ConfirmButton variant="ghost" size="icon" className="absolute -right-2 -top-2 h-6 w-6 rounded-full border border-slate-700 bg-slate-900 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                      testid={`delete-node-${n.device_eui}`} title={`Remove ${n.label}?`} description="Telemetry and incidents for this node are deleted." confirmLabel="Remove node"
                      onConfirm={() => del(`/nodes/${n.id}`, "Node removed")}><Trash2 className="h-3 w-3" /></ConfirmButton>
                  )}
                </div>
              ))}
              {!nodes.some((n) => n.site_id === site.id) && <p className="text-sm text-slate-500">No nodes registered at this site.</p>}
            </div>
          </section>
        ))}
        {sites.length === 0 && <p className="panel p-6 text-sm text-slate-400" data-testid="no-sites-message">No sites yet.</p>}
      </div>
    </div>
  );
}
