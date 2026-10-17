import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrgData } from "@/context/OrgDataContext";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/app/Screens";
import { CategoryTag, IncidentStatusBadge, SeverityBadge } from "@/components/app/Badges";
import DispatchDialog from "@/components/app/DispatchDialog";
import ConfirmButton from "@/components/app/ConfirmButton";
import { api, errMsg } from "@/lib/api";
import { dateTime, hoursOpen, isOpen, num, zar } from "@/lib/format";

const FILTERS = [["open", "Open"], ["ACTIVE", "Active"], ["DISPATCHED", "Dispatched"], ["RESOLVED", "Resolved"], ["all", "All"]];

function Actions({ inc, onDispatch }) {
  const resolve = async () => {
    try {
      await api.post(`/incidents/${inc.id}/resolve`);
      toast.success("Incident resolved — node returned to service");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  if (inc.status === "RESOLVED") return <span className="font-mono text-[11px] text-slate-500">{dateTime(inc.resolved_at)}</span>;
  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="outline" className="h-7 border-slate-700 text-xs hover:bg-cyan-400 hover:text-slate-950"
        onClick={() => onDispatch(inc)} data-testid={`dispatch-btn-${inc.id}`}>
        {inc.status === "DISPATCHED" ? "Reassign" : "Dispatch"}
      </Button>
      <ConfirmButton size="sm" className="h-7 bg-emerald-500 text-xs text-slate-950 hover:bg-emerald-400" testid={`resolve-btn-${inc.id}`}
        title="Mark incident resolved?" description="The node returns to ONLINE once all its incidents are resolved." confirmLabel="Resolve" onConfirm={resolve}>
        Resolve
      </ConfirmButton>
    </div>
  );
}

export default function Incidents() {
  const { incidents, nodes, sites } = useOrgData();
  const { canOperate } = useAuth();
  const [filter, setFilter] = useState("open");
  const [dispatching, setDispatching] = useState(null);
  const list = useMemo(() => incidents.filter((i) =>
    filter === "all" ? true : filter === "open" ? isOpen(i) : i.status === filter), [incidents, filter]);
  const nodeOf = (id) => nodes.find((n) => n.id === id);
  const siteOf = (id) => sites.find((s) => s.id === id);

  return (
    <div data-testid="incidents-page">
      <PageHeader eyebrow="Alert tickets" title="Incident board" />
      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="bg-slate-900">
          {FILTERS.map(([v, l]) => <TabsTrigger key={v} value={v} data-testid={`incident-filter-${v.toLowerCase()}`}>{l}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="panel overflow-x-auto">
        <Table data-testid="incidents-table">
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              {["Severity", "Incident", "Location", "Loss rate", "Cost / h", "Cost so far", "Status", ""].map((h) => (
                <TableHead key={h} className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500" data-testid="incidents-empty">No incidents in this view.</TableCell></TableRow>
            )}
            {list.map((i) => (
              <TableRow key={i.id} className="border-slate-800 hover:bg-slate-800/40" data-testid={`incident-row-${i.id}`}>
                <TableCell><SeverityBadge severity={i.severity} /></TableCell>
                <TableCell className="max-w-sm">
                  <p className="font-semibold text-slate-100">{i.title}</p>
                  <CategoryTag category={i.category} />
                  <p className="mt-1 text-xs text-slate-500">{i.diagnosis}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-600">{dateTime(i.created_at)}</p>
                </TableCell>
                <TableCell className="text-sm">
                  <p className="text-slate-200">{siteOf(i.site_id)?.name}</p>
                  <Link to={`/nodes/${i.node_id}`} className="text-xs text-cyan-300 hover:text-cyan-100">{nodeOf(i.node_id)?.label}</Link>
                </TableCell>
                <TableCell className="font-mono text-amber-400">{num(i.water_loss_rate_m3h, 1)} m³/h</TableCell>
                <TableCell className="font-mono text-red-400">{zar(i.hourly_financial_loss_zar, 2)}</TableCell>
                <TableCell className="font-mono text-slate-300">{zar(Number(i.hourly_financial_loss_zar) * hoursOpen(i), 2)}</TableCell>
                <TableCell>
                  <IncidentStatusBadge status={i.status} testid={`incident-status-${i.id}`} />
                  {i.assigned_technician && <p className="mt-1 text-xs text-slate-400" data-testid={`incident-tech-${i.id}`}>{i.assigned_technician}</p>}
                </TableCell>
                <TableCell className="text-right">{canOperate && <Actions inc={i} onDispatch={setDispatching} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {dispatching && <DispatchDialog incident={dispatching} onClose={() => setDispatching(null)} />}
    </div>
  );
}
