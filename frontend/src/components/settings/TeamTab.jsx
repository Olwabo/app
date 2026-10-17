import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmButton from "@/components/app/ConfirmButton";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/format";

const RoleSelect = ({ value, onChange, disabled, testid }) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger className="w-36" data-testid={testid}><SelectValue /></SelectTrigger>
    <SelectContent>{Object.entries(ROLE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
  </Select>
);

function AddMember({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ role: "OPERATOR" });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/team", f);
      toast.success(`${f.full_name} can now sign in`);
      setF({ role: "OPERATOR" });
      setOpen(false);
      onAdded();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  const field = (k, label, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`m-${k}`} className="text-xs text-slate-400">{label}</Label>
      <Input id={`m-${k}`} type={type} required minLength={type === "password" ? 8 : 2} value={f[k] || ""}
        onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`member-${k}-input`} />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2" data-testid="add-member-btn"><UserPlus className="h-4 w-4" /> Add member</Button></DialogTrigger>
      <DialogContent className="border-slate-800 bg-[#0B1220]" data-testid="add-member-dialog">
        <DialogHeader><DialogTitle className="font-display">Add team member</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {field("full_name", "Full name")}
          {field("email", "Work email", "email")}
          {field("password", "Temporary password (min 8)", "password")}
          <div className="space-y-1.5"><Label className="text-xs text-slate-400">Role</Label>
            <RoleSelect value={f.role} onChange={(v) => setF({ ...f, role: v })} testid="member-role-select" /></div>
          <DialogFooter><Button type="submit" disabled={saving} data-testid="member-submit-btn">{saving ? "Creating…" : "Create login"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamTab() {
  const { isAdmin, profile } = useAuth();
  const [team, setTeam] = useState([]);
  const load = useCallback(() => api.get("/team").then(({ data }) => setTeam(data)), []);
  useEffect(() => {
    load();
  }, [load]);
  const act = async (fn, msg) => {
    try {
      await fn();
      toast.success(msg);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <div className="max-w-3xl space-y-4">
      {isAdmin && <div className="flex justify-end"><AddMember onAdded={load} /></div>}
      <div className="panel divide-y divide-slate-800" data-testid="team-list">
        {team.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-4 p-4" data-testid={`team-member-${m.email}`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{m.full_name} {m.id === profile.id && <span className="text-xs text-cyan-300">(you)</span>}</p>
              <p className="truncate text-xs text-slate-500">{m.email}</p>
            </div>
            <RoleSelect value={m.role} disabled={!isAdmin || m.id === profile.id} testid={`member-role-${m.email}`}
              onChange={(v) => act(() => api.patch(`/team/${m.id}`, { role: v }), "Role updated")} />
            {isAdmin && m.id !== profile.id && (
              <ConfirmButton variant="ghost" size="icon" className="text-slate-500 hover:bg-red-500/10 hover:text-red-400" testid={`remove-member-${m.email}`}
                title={`Remove ${m.full_name}?`} description="Their login is deleted and they lose access immediately." confirmLabel="Remove"
                onConfirm={() => act(() => api.delete(`/team/${m.id}`), "Member removed")}><Trash2 className="h-4 w-4" /></ConfirmButton>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
