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
        <MonitorSmartphone className="mt-0.5 h-5 w-5 text-cyan-300" />
        <div>
          <p className="font-semibold">Live in-app alerts</p>
          <p className="text-sm text-slate-400">Always on. Every new incident appears instantly in the feed and as a pop-up for everyone signed in.</p>
        </div>
      </div>
      <div className="panel flex items-start gap-4 p-6" data-testid="email-alerts-panel">
        <BellRing className="mt-0.5 h-5 w-5 text-red-400" />
        <div className="flex-1">
          <p className="font-semibold">Email for critical incidents</p>
          <p className="text-sm text-slate-400">Pipe bursts and pump trips are emailed to every organization admin within ~15 seconds.</p>
        </div>
        <Switch checked={!!email} disabled={!isAdmin || email === null} onCheckedChange={toggle} data-testid="email-alerts-switch" />
      </div>
    </div>
  );
}
