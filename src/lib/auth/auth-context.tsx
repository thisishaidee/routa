import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";

type Result = { error: string | null; message?: string };
type AuthValue = {
  configured: boolean; loading: boolean; user: User | null; recoveryMode: boolean;
  signUp: (email: string, password: string) => Promise<Result>;
  signIn: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<Result>;
  resetPassword: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
};
const AuthContext = createContext<AuthValue | null>(null);
const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [recoveryMode, setRecoveryMode] = useState(false);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (!error) setSession(data.session);
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (event === "SIGNED_OUT") setRecoveryMode(false);
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  const value: AuthValue = {
    configured: supabaseConfigured, loading, user: session?.user ?? null, recoveryMode,
    signUp: async (email, password) => {
      if (!supabase) return { error: "Account service is not configured." };
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password, options: { emailRedirectTo: window.location.origin },
        });
        if (error) return { error: error.message };
        return { error: null, message: data.session ? "Your account is ready." : "Check your email and confirm your address once to activate your account." };
      } catch (error) { return { error: message(error) }; }
    },
    signIn: async (email, password) => {
      if (!supabase) return { error: "Account service is not configured." };
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return { error: error?.message ?? null, message: error ? undefined : "You're signed in." };
      } catch (error) { return { error: message(error) }; }
    },
    signOut: async () => {
      if (!supabase) return { error: "Account service is not configured." };
      try { const { error } = await supabase.auth.signOut(); return { error: error?.message ?? null }; }
      catch (error) { return { error: message(error) }; }
    },
    resetPassword: async (email) => {
      if (!supabase) return { error: "Account service is not configured." };
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        return { error: error?.message ?? null, message: error ? undefined : "If an account exists for that address, a reset link has been sent." };
      } catch (error) { return { error: message(error) }; }
    },
    updatePassword: async (password) => {
      if (!supabase) return { error: "Account service is not configured." };
      try {
        const { error } = await supabase.auth.updateUser({ password });
        if (!error) setRecoveryMode(false);
        return { error: error?.message ?? null, message: error ? undefined : "Password updated." };
      } catch (error) { return { error: message(error) }; }
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
