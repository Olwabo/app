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
  { to: "/", label: "Overview", icon: LayoutDashboard, id: "dashboard" },
  { to: "/sites", label: "Sites and meters", icon: Waypoints, id: "sites" },
  { to: "/incidents", label: "Incidents", icon: ShieldAlert, id: "incidents" },
  { to: "/simulator", label: "Test scenarios", icon: FlaskConical, id: "simulator" },
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
            `group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
              isActive ? "bg-[#1f2631] font-medium text-white" : "text-slate-400 hover:bg-[#1a2029] hover:text-slate-100"
            }`}>
          <Icon className="h-4 w-4" />
          <span className="flex-1">{label}</span>
          {id === "incidents" && kpis.open > 0 && (
            <span className="rounded-full bg-red-500/90 px-2 text-xs font-medium text-white" data-testid="nav-incident-count">{kpis.open}</span>
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
      <div className="px-3">
        <p className="text-sm font-medium leading-snug text-slate-100" data-testid="sidebar-org-name">{profile.org_name}</p>
        <p className="text-xs text-slate-500">{SECTOR_LABEL[profile.sector]}</p>
      </div>
      <NavItems onNavigate={onNavigate} />
      <div className="mt-auto border-t border-[#252b36] px-3 pt-4">
        <p className="truncate text-sm text-slate-200" data-testid="sidebar-user-name">{profile.full_name}</p>
        <p className="truncate text-xs text-slate-500">{profile.email} · {ROLE_LABEL[profile.role]}</p>
        <Button variant="ghost" size="sm" onClick={out} data-testid="signout-btn"
          className="-ml-3 mt-3 w-[calc(100%+1.5rem)] justify-start gap-2 text-slate-400 hover:bg-[#1a2029] hover:text-white">
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
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-[#252b36] bg-[#0d1117]/95 px-4 md:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" data-testid="mobile-menu-btn"><Menu className="h-5 w-5" /></Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-[#252b36] bg-[#11161d] p-0">
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-2 text-sm text-slate-400" data-testid="realtime-status">
        <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-slate-500"}`} />
        {live ? "Live" : "Connecting…"}
      </div>
      <div className="ml-auto flex items-center gap-5 text-sm">
        <span className="hidden items-center gap-1.5 text-slate-400 sm:flex"><Activity className="h-4 w-4" />{kpis.online} of {kpis.total} meters reporting</span>
        <span className={kpis.zarPerHour > 0 ? "font-medium text-red-300" : "text-slate-400"} data-testid="topbar-loss-rate">
          {kpis.zarPerHour > 0 ? `Losing ${zar(kpis.zarPerHour)} an hour` : `${zar(0)}/h lost`}
        </span>
      </div>
    </header>
  );
}

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#252b36] bg-[#11161d] lg:block">
        <SidebarBody />
      </aside>
      <div className="lg:pl-64">
        <TopBar />
        <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-[1500px] p-4 md:p-10">{children}</main>
      </div>
    </div>
  );
}
