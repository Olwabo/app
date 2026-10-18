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
  const { loading } = useOrgData();
  const { canOperate, profile } = useAuth();
  const h = new Date().getHours();
  const hello = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div data-testid="dashboard-page">
      <PageHeader eyebrow={today} title={/owner|operator|viewer|admin/i.test(profile.full_name) ? hello : `${hello}, ${profile.full_name.split(" ")[0]}`}>
        {canOperate && (
          <Button asChild variant="outline" className="gap-2 border-[#2d3440] bg-transparent" data-testid="dashboard-simulator-link">
            <Link to="/simulator"><FlaskConical className="h-4 w-4" /> Test a scenario</Link>
          </Button>
        )}
      </PageHeader>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 bg-[#151a22]" />)}</div>
      ) : (
        <div className="space-y-10">
          <KpiStrip />
          <div className="grid gap-10 xl:grid-cols-[1fr_380px]">
            <div>
              <h2 className="mb-5 font-display text-xl font-semibold">Your meters</h2>
              <NodeGrid />
            </div>
            <IncidentFeed />
          </div>
        </div>
      )}
    </div>
  );
}
