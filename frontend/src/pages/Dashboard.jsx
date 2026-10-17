import { Link } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgData } from "@/context/OrgDataContext";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/app/Screens";
import KpiStrip from "@/components/app/KpiStrip";
import NodeGrid from "@/components/app/NodeGrid";
import IncidentFeed from "@/components/app/IncidentFeed";

export default function Dashboard() {
  const { loading, org } = useOrgData();
  const { canOperate } = useAuth();
  return (
    <div data-testid="dashboard-page">
      <PageHeader eyebrow={org ? `${org.name} · tariff R ${Number(org.tariff_zar_per_kl).toFixed(2)}/kL` : "Loading"} title="Command Center">
        {canOperate && (
          <Button asChild variant="outline" className="gap-2 border-slate-700 hover:bg-cyan-400 hover:text-slate-950" data-testid="dashboard-simulator-link">
            <Link to="/simulator"><FlaskConical className="h-4 w-4" /> Run a scenario</Link>
          </Button>
        )}
      </PageHeader>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 bg-slate-800/60" />)}</div>
      ) : (
        <div className="space-y-8">
          <KpiStrip />
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div className="panel p-5">
              <h2 className="mb-5 font-display text-base font-semibold">Network nodes</h2>
              <NodeGrid />
            </div>
            <IncidentFeed />
          </div>
        </div>
      )}
    </div>
  );
}
