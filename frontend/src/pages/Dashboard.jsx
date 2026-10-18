import { Skeleton } from "@/components/ui/skeleton";
import { useOrgData } from "@/context/OrgDataContext";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/app/Screens";
import KpiStrip from "@/components/app/KpiStrip";
import NodeGrid from "@/components/app/NodeGrid";
import IncidentFeed from "@/components/app/IncidentFeed";
import SiteMap from "@/components/app/SiteMap";

export default function Dashboard() {
  const { loading } = useOrgData();
  const { profile } = useAuth();
  const h = new Date().getHours();
  const hello = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div data-testid="dashboard-page">
      <PageHeader eyebrow={today} title={/owner|operator|viewer|admin/i.test(profile.full_name) ? hello : `${hello}, ${profile.full_name.split(" ")[0]}`} />
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 bg-[#151a22]" />)}</div>
      ) : (
        <div className="space-y-10">
          <KpiStrip />
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <SiteMap />
            <IncidentFeed limit={5} />
          </div>
          <div>
            <h2 className="mb-5 font-display text-xl font-semibold">Your meters</h2>
            <NodeGrid />
          </div>
        </div>
      )}
    </div>
  );
}
