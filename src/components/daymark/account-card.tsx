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
    try { await action(); }...[truncated]    });
    if (issue) throw issue;
    const saved = Array.isArray(data) ? data[0] : data;
    if (!saved?.revision) throw new Error("Cloud save was not confirmed. Your local data is safe.");
    setRevision(Number(saved.revision)); setRemote(null);
    setMessage("Your ROUTA backup is saved to your account.");
  };

  const sync = () => run(async () => {
    if (remote) {
      setMessage("Choose one of the two options below before syncing. This prevents an accidental overwrite.");
      return;
    }
    const latest = await readCloud();
    if (!latest) { await saveCloud(0); return; }
    if (revision === null || Number(latest.revision) !== revision) {
      setRemote(latest);
      setRevision(Number(latest.revision));
      setMessage(revision === null
        ? "A cloud backup already exists. Choose which copy to use."
        : "The cloud copy changed on another device. Choose which copy to keep.");
      return;
    }
    await saveCloud(revision);
  });

  const restoreCloud = () => run(async () => {
    const latest = remote || await readCloud();
    if (!latest?.payload?.snapshot) throw new Error("No supported cloud backup was found. Local data was not changed.");
    const backup = {
      app: "routa", version: SNAPSHOT_VERSION, exportedAt: new Date().toISOString(),
      snapshot: latest.payload.snapshot,
      ...(latest.payload.checkIns ? { checkIns: latest.payload.checkIns } : {}),
      ...(latest.payload.recovery ? { recovery: latest.payload.recovery } : {}),
    };
    const result = importBackup(JSON.stringify(backup));
    if (!result.ok) throw new Error(result.error || "Cloud backup could not be restored.");
    setRevision(Number(latest.revision)); setRemote(null);
    setMessage("Cloud data restored on this device.");
  });

  const replaceCloud = () => run(async () => {
    const latest = remote || await readCloud();
    if (!latest) { await saveCloud(0); return; }
    await saveCloud(Number(latest.revision));
  });

  if (!supabaseConfigu...[truncated]