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

const FILTERS = [["open", "Needs attention"], ["ACTIVE", "Not assigned"], ["DISPATCHED", "Someone's on it"], ["RESOLVED", "Fixed"], ["all", "All"]];

function Actions({ inc, onDispatch }) {
  const resolve = async () => {
    try {
      await api.post(`/incidents/${inc.id}/resolve`);
      toast.success("Marked as fixed");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  if (inc.status === "RESOLVED") return <span className="text-xs text-slate-500">Fixed {dateTime(inc.resolved_at)}</span>;
  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="outline" className="h-8 border-[#2d3440] bg-transparent"
        onClick={() => onDispatch(inc)} data-testid={`dispatch-btn-${inc.id}`}>
        {inc.status === "DISPATCHED" ? "Reassign" : "Send someone"}
      </Button>
      <ConfirmButton size="sm" className="h-8" testid={`resolve-btn-${inc.id}`}
        title="Mark this as fixed?" description="Once every incident on this meter is fixed, it goes back to normal." confirmLabel="Mark fixed" onConfirm={resolve}>
        Mark fixed
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
      <PageHeader eyebrow="Every leak, burst and pump stop, from the moment it's detected until it's fixed." title="Incidents" />
      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="h-auto flex-wrap justify-start bg-[#151a22]">
          {FILTERS.map(([v, l]) => <TabsTrigger key={v} value={v} data-testid={`incident-filter-${v.toLowerCase()}`}>{l}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="panel overflow-x-auto">
        <Table className="min-w-[980px]" data-testid="incidents-table">
          <TableHeader>
            <TableRow className="border-[#252b36] hover:bg-transparent">
              {["Severity", "What happened", "Where", "Water lost", "Cost per hour", "Cost so far", "Status", ""].map((h) => (
                <TableHead key={h} className="text-xs font-medium text-slate-400">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500" data-testid="incidents-empty">Nothing here right now.</TableCell></TableRow>
            )}
            {list.map((i) => (
              <TableRow key={i.id} className="border-[#252b36] hover:bg-[#1a2029]" data-testid={`incident-row-${i.id}`}>
                <TableCell><SeverityBadge severity={i.severity} /></TableCell>
                <TableCell className="max-w-sm">
                  <p className="font-medium text-slate-100">{i.title}</p>
                  <CategoryTag category={i.category} />
                  <p className="mt-1 text-sm text-slate-500">{i.diagnosis}</p>
                  <p className="mt-1 text-xs text-slate-600">{dateTime(i.created_at)}</p>
                </TableCell>
                <TableCell className="text-sm">
                  <p className="text-slate-200">{siteOf(i.site_id)?.name}</p>
                  <Link to={`/nodes/${i.node_id}`} className="text-sm text-sky-300 hover:underline">{nodeOf(i.node_id)?.label}</Link>
                </TableCell>
                <TableCell className="tabular-nums text-amber-400">{num(i.water_loss_rate_m3h, 1)} m³/h</TableCell>
                <TableCell className="tabular-nums text-red-400">{zar(i.hourly_financial_loss_zar, 2)}</TableCell>
                <TableCell className="tabular-nums text-slate-300">{zar(Number(i.hourly_financial_loss_zar) * hoursOpen(i), 2)}</TableCell>
                <TableCell>
                  <IncidentStatusBadge status={i.status} testid={`incident-status-${i.id}`} />
                  {i.assigned_technician && <p className="mt-1 text-sm text-slate-400" data-testid={`incident-tech-${i.id}`}>With {i.assigned_technician}</p>}
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
