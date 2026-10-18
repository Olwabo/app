import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/app/Screens";

const HERO = "https://images.pexels.com/photos/32529341/pexels-photo-32529341.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

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
    if (err) setError("That email and password don't match. Check them and try again.");
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen bg-[#0d1117] lg:grid-cols-2">
      <div className="flex flex-col justify-between p-6 sm:p-12">
        <Logo />
        <div className="rise mx-auto w-full max-w-sm py-12">
          <h1 className="font-display text-4xl font-semibold text-slate-50">Sign in</h1>
          <p className="mt-3 text-slate-400">Use the email your organization admin set up for you.</p>
          <form onSubmit={submit} className="mt-10 space-y-5" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-[#2d3440] bg-[#151a22]" data-testid="login-email-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-[#2d3440] bg-[#151a22]" data-testid="login-password-input" />
            </div>
            {error && <p className="text-sm text-red-400" data-testid="login-error">{error}</p>}
            <Button type="submit" disabled={busy} className="h-11 w-full font-medium" data-testid="login-submit-btn">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>
          <p className="mt-8 text-sm text-slate-500">No account yet? Ask the admin at your organization to add you.</p>
        </div>
        <p className="text-xs text-slate-600">AmanziAlert · water monitoring for sites and utilities</p>
      </div>
      <div className="relative hidden overflow-hidden lg:block">
        <img src={HERO} alt="Plant control room" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#0d1117]/45" />
        <div className="absolute bottom-0 left-0 right-0 p-12">
          <p className="max-w-md font-display text-2xl leading-snug text-white">
            Know about the burst before the floor floods, and see exactly where the water is going.
          </p>
        </div>
      </div>
    </div>
  );
}
