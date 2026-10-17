import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Activity, Building2, FlaskConical, LayoutDashboard, LogOut, Menu, Settings, ShieldAlert, Waypoints } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useOrgData } from "@/context/OrgDataContext";
import { Logo } from "@/components/app/Screens";
import { ROLE_LABEL, SECTOR_LABEL, zar } from "@/lib/format";

const NAV = [
  { to: "/", label: "Command Center", icon: LayoutDashboard, id: "dashboard" },
  { to: "/sites", label: "Sites & Nodes", icon: Waypoints, id: "sites" },
  { to: "/incidents", label: "Incidents", icon: ShieldAlert, id: "incidents" },
  { to: "/simulator", label: "Scenario Simulator", icon: FlaskConical, id: "simulator" },
  { to: "/settings", label: "Settings", icon: Settings, id: "settings" },
];

function NavItems({ onNavigate }) {
  const { profile } = useAuth();
  const { kpis } = useOrgData();
  const items = profile?.is_platform_admin ? [...NAV, { to: "/platform", label: "Platform", icon: Building2, id: "platform" }] : NAV;
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon, id }) => (
        <NavLink key={to} to={to} end={to === "/"} onClick={onNavigate} data-testid={`nav-${id}`}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-200 ${
              isActive ? "bg-cyan-400/10 text-cyan-200 shadow-[inset_2px_0_0_#00E5FF]" : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
            }`}>
          <Icon className="h-4 w-4" />
          <span className="flex-1">{label}</span>
          {id === "incidents" && kpis.open > 0 && (
            <span className="rounded-sm bg-red-500/90 px-1.5 font-mono text-[10px] font-bold text-white" data-testid="nav-incident-count">{kpis.open}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const out = async () => {
    await signOut();
    navigate("/login");
  };
  return (
    <div className="flex h-full flex-col gap-8 p-5">
      <Logo />
      <div className="rounded-sm border border-slate-800 bg-slate-950/60 p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Tenant</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-100" data-testid="sidebar-org-name">{profile.org_name}</p>
        <p className="text-xs text-slate-500">{SECTOR_LABEL[profile.sector]}</p>
      </div>
      <NavItems onNavigate={onNavigate} />
      <div className="mt-auto border-t border-slate-800 pt-4">
        <p className="truncate text-sm text-slate-200" data-testid="sidebar-user-name">{profile.full_name}</p>
        <p className="truncate text-xs text-slate-500">{profile.email} · {ROLE_LABEL[profile.role]}</p>
        <Button variant="ghost" size="sm" onClick={out} data-testid="signout-btn"
          className="mt-3 w-full justify-start gap-2 text-slate-400 hover:bg-slate-800 hover:text-white">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

function TopBar() {
  const { live, kpis } = useOrgData();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur-xl md:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" data-testid="mobile-menu-btn"><Menu className="h-5 w-5" /></Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-slate-800 bg-[#0B1220] p-0">
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-2" data-testid="realtime-status">
        <span className="relative flex h-2.5 w-2.5">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${live ? "bg-emerald-500" : "bg-slate-500"}`} />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">{live ? "Live stream" : "Connecting"}</span>
      </div>
      <div className="ml-auto flex items-center gap-4 font-mono text-xs">
        <span className="hidden items-center gap-1.5 text-slate-400 sm:flex"><Activity className="h-3.5 w-3.5 text-cyan-300" />{kpis.online}/{kpis.total} nodes</span>
        <span className={`rounded-sm border px-2 py-1 ${kpis.zarPerHour > 0 ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-slate-700 text-slate-400"}`} data-testid="topbar-loss-rate">
          {zar(kpis.zarPerHour)}/h at risk
        </span>
      </div>
    </header>
  );
}

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-[#070B12] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-800 bg-[#0B1220] lg:block">
        <SidebarBody />
      </aside>
      <div className="lg:pl-64">
        <TopBar />
        <main className="grid-bg min-h-[calc(100vh-3.5rem)] p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
