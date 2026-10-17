import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, errMsg } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const userId = session?.user?.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get("/me");
      setProfile(data);
      setProfileError(null);
    } catch (e) {
      setProfile(null);
      setProfileError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    if (userId) {
      loadProfile();
    } else {
      setProfile(null);
      setProfileError(null);
    }
  }, [userId, loadProfile]);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signOut = () => supabase.auth.signOut();
  const loading = session === undefined || (session && !profile && !profileError);
  const isAdmin = profile?.role === "ORG_ADMIN";
  const canOperate = isAdmin || profile?.role === "OPERATOR";

  return (
    <AuthCtx.Provider value={{ session, profile, profileError, loading, signIn, signOut, loadProfile, isAdmin, canOperate }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
