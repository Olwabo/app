import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, MonitorSmartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";

export default function AlertsTab() {
  const { isAdmin } = useAuth();
  const [email, setEmail] = useState(null);
  useEffect(() => {
    let ignore = false;
    api.get("/org/alert-settings")
      .then(({ data }) => !ignore && setEmail(data.email_critical_alerts))
      .catch(() => !ignore && setEmail(true));
    return () => {
      ignore = true;
    };
  }, []);
  const toggle = async (v) => {
    setEmail(v);
    try {
      await api.put("/org/alert-settings", { email_critical_alerts: v });
      toast.success(v ? "Critical incident emails on" : "Critical incident emails off");
    } catch (e) {
      setEmail(!v);
      toast.error(errMsg(e));
    }
  };
  return (
    <div className="max-w-2xl space-y-4">
      <div className="panel flex items-start gap-4 p-6">
        <MonitorSmartphone className="mt-0.5 h-5 w-5 text-slate-400" />
        <div>
          <p className="font-medium">Alerts in the app</p>
          <p className="text-sm text-slate-400">Always on. Anyone signed in sees new incidents straight away as a pop-up.</p>
        </div>
      </div>
      <div className="panel flex items-start gap-4 p-6" data-testid="email-alerts-panel">
        <BellRing className="mt-0.5 h-5 w-5 text-red-400" />
        <div className="flex-1">
          <p className="font-medium">Email me about serious problems</p>
          <p className="text-sm text-slate-400">Burst pipes and stopped pumps are emailed to every admin, usually within a minute.</p>
        </div>
        <Switch checked={!!email} disabled={!isAdmin || email === null} onCheckedChange={toggle} data-testid="email-alerts-switch" />
      </div>
    </div>
  );
}
