import "@/App.css";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { OrgDataProvider } from "@/context/OrgDataContext";
import AppShell from "@/components/app/AppShell";
import { FullScreenLoader, NoOrgScreen } from "@/components/app/Screens";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Sites from "@/pages/Sites";
import NodeDetail from "@/pages/NodeDetail";
import Incidents from "@/pages/Incidents";
import Simulator from "@/pages/Simulator";
import Settings from "@/pages/Settings";
import Platform from "@/pages/Platform";

function Protected() {
  const { session, profile, profileError, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (profileError || !profile) return <NoOrgScreen message={profileError} />;
  return (
    <OrgDataProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </OrgDataProvider>
  );
}

function PlatformGate() {
  const { profile } = useAuth();
  return profile?.is_platform_admin ? <Platform /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sites" element={<Sites />} />
            <Route path="/nodes/:nodeId" element={<NodeDetail />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/platform" element={<PlatformGate />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="top-right" richColors closeButton />
    </AuthProvider>
  );
}
