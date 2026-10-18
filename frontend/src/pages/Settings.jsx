import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/Screens";
import OrgTab from "@/components/settings/OrgTab";
import AlertsTab from "@/components/settings/AlertsTab";
import DevicesTab from "@/components/settings/DevicesTab";
import TeamTab from "@/components/settings/TeamTab";
import { useAuth } from "@/context/AuthContext";

export default function Settings() {
  const { isAdmin } = useAuth();
  return (
    <div data-testid="settings-page">
      <PageHeader eyebrow="Your organization, alerts, meter connections and team." title="Settings" />
      <Tabs defaultValue="org">
        <TabsList className="mb-6 bg-[#151a22]">
          <TabsTrigger value="org" data-testid="settings-tab-org">Organization</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="settings-tab-alerts">Alerts</TabsTrigger>
          {isAdmin && <TabsTrigger value="devices" data-testid="settings-tab-devices">Connect meters</TabsTrigger>}
          <TabsTrigger value="team" data-testid="settings-tab-team">Team</TabsTrigger>
        </TabsList>
        <TabsContent value="org"><OrgTab /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
        {isAdmin && <TabsContent value="devices"><DevicesTab /></TabsContent>}
        <TabsContent value="team"><TeamTab /></TabsContent>
      </Tabs>
    </div>
  );
}
