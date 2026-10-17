import { Droplets, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export const Logo = ({ compact = false }) => (
  <div className="flex items-center gap-2.5" data-testid="app-logo">
    <div className="relative flex h-8 w-8 items-center justify-center rounded-sm border border-cyan-400/40 bg-cyan-400/10">
      <Droplets className="h-4 w-4 text-cyan-300" />
    </div>
    {!compact && (
      <span className="font-display text-lg font-bold tracking-tight text-slate-50">
        Amanzi<span className="text-cyan-300">Alert</span>
      </span>
    )}
  </div>
);

export function FullScreenLoader() {
  return (
    <div className="grid-bg flex min-h-screen items-center justify-center" data-testid="full-screen-loader">
      <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
    </div>
  );
}

export function NoOrgScreen({ message }) {
  const { signOut, loadProfile } = useAuth();
  return (
    <div className="grid-bg flex min-h-screen items-center justify-center p-6">
      <div className="panel max-w-md p-8" data-testid="no-org-screen">
        <Logo />
        <h1 className="mt-6 font-display text-2xl font-bold">Account not linked</h1>
        <p className="mt-2 text-sm text-slate-400" data-testid="no-org-message">
          {message || "Your login is not attached to an organization yet. Ask your organization admin to add you."}
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={loadProfile} data-testid="no-org-retry-btn">Retry</Button>
          <Button onClick={signOut} data-testid="no-org-signout-btn">Sign out</Button>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="rise mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-300/80">{eyebrow}</p>}
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-50 sm:text-4xl" data-testid="page-title">
          {title}
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
