import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { SNAPSHOT_VERSION } from "@/lib/daymark/types";
import { getSupabaseClient, supabaseConfigured } from "@/lib/daymark/supabase";
import { useDaymark } from "@/lib/daymark/store";

type Workspace = { schema_version: number; revision: number; payload: { snapshot?: unknown; checkIns?: unknown; recovery?: unknown } };
const verified = (user: User | null) => Boolean(user?.email_confirmed_at || user?.confirmed_at);

export function AccountCard() {
  const { exportBackup, importBackup } = useDaymark();
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState<number | null>(null);
  const [remote, setRemote] = useState<Workspace | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setLoading(false); }
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") { setRevision(null); setRemote(null); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [supabase]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(""); setMessage("");
    try { await action(); }...[truncated]