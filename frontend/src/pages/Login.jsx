import { useState } from "react";
import { Navigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/app/Screens";

const HERO = "https://images.pexels.com/photos/32529341/pexels-photo-32529341.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const STATS = [["< 10 s", "burst detection"], ["R/h", "live loss costing"], ["24/7", "load-shedding watch"]];

export default function Login() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    if (err) setError("Invalid email or password");
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen bg-[#070B12] lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={HERO} alt="Industrial control room" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070B12] via-[#070B12]/70 to-[#070B12]/30" />
        <div className="scanline absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div className="rise max-w-lg">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-300">Water telemetry · Digital Twin</p>
            <h1 className="mt-4 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-50">
              Every litre accounted for. Every burst caught live.
            </h1>
            <p className="mt-5 text-slate-300">
              Early warning for factories, estates, agro-processors and municipal networks — pipe bursts, hidden leaks and pump trips, costed in Rand the moment they happen.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-800 pt-6">
              {STATS.map(([v, l]) => (
                <div key={l}><p className="font-mono text-2xl font-bold text-cyan-300">{v}</p><p className="text-xs text-slate-400">{l}</p></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid-bg flex items-center justify-center p-6 sm:p-12">
        <div className="rise w-full max-w-sm">
          <div className="lg:hidden"><Logo /></div>
          <h2 className="mt-8 font-display text-3xl font-bold tracking-tight">Operator sign in</h2>
          <p className="mt-2 text-sm text-slate-400">Access is provisioned by your organization admin.</p>
          <form onSubmit={submit} className="mt-8 space-y-5" data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-slate-400">Work email</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-slate-700 bg-slate-950/70" data-testid="login-email-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-slate-400">Password</Label>
              <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-slate-700 bg-slate-950/70" data-testid="login-password-input" />
            </div>
            {error && <p className="text-sm text-red-400" data-testid="login-error">{error}</p>}
            <Button type="submit" disabled={busy} className="h-11 w-full gap-2 font-semibold hover:bg-cyan-300" data-testid="login-submit-btn">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enter command center <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
