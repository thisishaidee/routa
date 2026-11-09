import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { SNAPSHOT_VERSION } from "@/lib/daymark/types";
import { getSupabaseClient, supabaseConfigured } from "@/lib/daymark/supabase";
import { useDaymark } from "@/lib/daymark/store";

// The cloud payload mirrors the validated local backup sections; device-only settings stay local.
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
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const signUp = () => run(async () => {
    if (!supabase) throw new Error("Account services are not configured.");
    const { data, error: issue } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (issue) throw issue;
    if (data.session && !verified(data.user)) await supabase.auth.signOut();
    setMessage("Check your email and open the verification link once. Then return here and sign in.");
  });

  const signIn = () => run(async () => {
    if (!supabase) throw new Error("Account services are not configured.");
    const { data, error: issue } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (issue) throw issue;
    if (!verified(data.user)) {
      await supabase.auth.signOut();
      throw new Error("Verify your email using the link we sent before signing in.");
    }
    setMessage("Signed in. Your ROUTA data remains local until you choose to sync it.");
  });

  const resetPassword = () => run(async () => {
    if (!supabase || !email.trim()) throw new Error("Enter your account email first.");
    const { error: issue } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (issue) throw issue;
    setMessage("If an account exists for that email, a password reset link has been sent.");
  });

  const updatePassword = () => run(async () => {
    if (!supabase || newPassword.length < 8) throw new Error("Choose a password with at least 8 characters.");
    const { error: issue } = await supabase.auth.updateUser({ password: newPassword });
    if (issue) throw issue;
    setRecovering(false); setNewPassword(""); setMessage("Password updated.");
  });

  const readCloud = async () => {
    if (!supabase || !session?.user || !verified(session.user)) throw new Error("Sign in with a verified email first.");
    const { data, error: issue } = await supabase.from("routa_workspaces")
      .select("schema_version, revision, payload").eq("user_id", session.user.id).maybeSingle();
    if (issue) throw issue;
    return (data as Workspace | null) ?? null;
  };

  const localPayload = () => {
    const backup = JSON.parse(exportBackup()) as { snapshot: unknown; checkIns?: unknown; recovery?: unknown };
    return { snapshot: backup.snapshot, ...(backup.checkIns ? { checkIns: backup.checkIns } : {}), ...(backup.recovery ? { recovery: backup.recovery } : {}) };
  };

  const saveCloud = async (expected: number) => {
    if (!supabase) throw new Error("Account services are not configured.");
    const { data, error: issue } = await supabase.rpc("save_routa_workspace", {
      p_expected_revision: expected, p_schema_version: 1, p_payload: localPayload(),
    });
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

  if (!supabaseConfigured) return (
    <section className="rounded-2xl bg-cream p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Account & cloud backup</p>
      <p className="mt-2 text-sm leading-6 text-quiet">Account services are not connected to this deployment yet. Your routines remain saved on this device.</p>
    </section>
  );
  if (loading) return <section className="rounded-2xl bg-cream p-5 text-sm text-quiet">Checking account…</section>;

  return (
    <section className="rounded-2xl bg-cream p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Account & cloud backup</p>
      {recovering ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-quiet">Choose a new password.</p>
            <input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (8+ characters)" className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-sm" />
            <button type="button" disabled={busy} onClick={updatePassword} className="h-11 rounded-full bg-forest px-5 text-sm font-bold text-paper disabled:opacity-50">Update password</button>
          </div>
      ) : !session ? (
          <>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className={"rounded-full px-4 py-2 text-xs font-bold " + (mode === "signup" ? "bg-forest text-paper" : "bg-canvas text-quiet")}>Create account</button>
              <button type="button" onClick={() => { setMode("signin"); setError(""); setMessage(""); }} className={"rounded-full px-4 py-2 text-xs font-bold " + (mode === "signin" ? "bg-forest text-paper" : "bg-canvas text-quiet")}>Sign in</button>
            </div>
            <div className="mt-4 space-y-3">
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-sm" />
              <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (8+ characters)" className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-sm" />
              <button type="button" disabled={busy || !email.trim() || password.length < 8} onClick={mode === "signup" ? signUp : signIn} className="h-12 w-full rounded-full bg-forest px-5 text-sm font-bold text-paper disabled:opacity-50">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
              <button type="button" disabled={busy || !email.trim()} onClick={resetPassword} className="text-xs font-semibold text-quiet underline underline-offset-4">Forgot password?</button>
            </div>
            <p className="mt-3 text-xs leading-5 text-quiet">You can use ROUTA without an account. Email verification is required once when creating an account.</p>
          </>
      ) : (
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink">{session.user.email}</p>
          <p className="mt-1 text-xs text-quiet">Verified account · Your data remains on this device unless you sync it.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={sync} className="h-11 rounded-full bg-forest px-5 text-sm font-bold text-paper disabled:opacity-50">{busy ? "Working…" : "Sync cloud backup"}</button>
            <button type="button" disabled={busy} onClick={() => void run(async () => { const { error: issue } = await supabase!.auth.signOut(); if (issue) throw issue; setMessage("Signed out. Your local data remains on this device."); })} className="h-11 rounded-full bg-canvas px-5 text-sm font-bold disabled:opacity-50">Sign out</button>
          </div>
          {remote ? (
            <div className="mt-4 rounded-xl bg-canvas p-4">
              <p className="text-sm font-semibold">A cloud backup already exists or changed on another device.</p>
              <p className="mt-1 text-xs leading-5 text-quiet">Use cloud data to replace this device's data, or keep this device's data to replace the cloud copy.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={restoreCloud} className="h-10 rounded-full bg-forest px-4 text-xs font-bold text-paper">Use cloud data</button>
                <button type="button" disabled={busy} onClick={replaceCloud} className="h-10 rounded-full bg-paper px-4 text-xs font-bold text-danger">Keep this device's data</button>
              </div>
            </div>
          ) : null}
        </div>
      )}
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
      {message ? <p role="status" className="mt-3 text-sm font-medium text-olive">{message}</p> : null}
    </section>
  );
}
