import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { supabase } from "@/lib/auth/supabase";
import { useDaymark } from "@/lib/daymark/store";

type Mode = "signin" | "signup" | "reset" | "new-password";
export function AccountCard() {
  const auth = useAuth();
  const { exportBackup, importBackup } = useDaymark();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [remote, setRemote] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const activeMode = auth.recoveryMode ? "new-password" : mode;

  useEffect(() => {
    let active = true;
    setRemote(null); setChecked(false); setMessage("");
    if (!auth.user || !supabase) return;
    supabase.from("routa_workspaces").select("payload, revision, updated_at")
      .eq("user_id", auth.user.id).maybeSingle().then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setMessage("Could not check cloud backup: " + queryError.message);
        else setRemote(data);
        setChecked(true);
      });
    return () => { active = false; };
  }, [auth.user?.id]);

  const act = async (fn: () => Promise<{ error: string | null; message?: string }>) => {
    setBusy(true); setError(""); setMessage("");
    try { const result = await fn(); if (result.error) setError(result.error); else setMessage(result.message ?? "Done."); }
    finally { setBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (activeMode !== "reset" && password.length < 8) return setError("Use a password with at least 8 characters.");
    if (activeMode === "new-password" && password !== confirm) return setError("The passwords do not match.");
    if (activeMode === "signup") return act(() => auth.signUp(email, password));
    if (activeMode === "signin") return act(() => auth.signIn(email, password));
    if (activeMode === "reset") return act(() => auth.resetPassword(email));
    return act(() => auth.updatePassword(password));
  };
  const upload = async () => {
    if (!supabase || !auth.user) return;
    setSyncBusy(true); setMessage(""); setError("");
    try {
      const payload = JSON.parse(exportBackup());
      const { data: current, error: readError } = await supabase.from("routa_workspaces")
        .select("payload, revision, updated_at").eq("user_id", auth.user.id).maybeSingle();
      if (readError) throw readError;
      if (current) { setRemote(current); setMessage("A cloud backup already exists. Nothing was overwritten."); return; }
      const { data, error: saveError } = await supabase.rpc("save_routa_workspace", {
        p_expected_revision: 0, p_schema_version: 1, p_payload: payload,
      });
      if (saveError) throw saveError;
      setRemote({ payload, revision: Array.isArray(data) ? data[0]?.revision : 1, updated_at: new Date().toISOString() });
      setMessage("Your local ROUTA data has been backed up to your account.");
    } catch (err) { setError(err instanceof Error ? err.message : "Cloud backup failed. Your local data is unchanged."); }
    finally { setSyncBusy(false); }
  };
  const restore = () => {
    if (!remote?.payload) return;
    setSyncBusy(true);
    const result = importBackup(JSON.stringify(remote.payload));
    setMessage(result.ok ? "Cloud backup restored on this device. This replaces the current local ROUTA data." : result.error ?? "Could not restore the cloud backup.");
    setSyncBusy(false);
  };

  return <section className="rounded-2xl bg-cream p-5">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Account & sync</p>
    <h2 className="mt-2 text-xl font-black">Your ROUTA, across devices</h2>
    {!auth.configured ? <p className="mt-2 text-sm leading-6 text-quiet">Cloud accounts are not connected in this preview yet. Your routines remain saved on this device.</p>
    : auth.loading ? <p className="mt-2 text-sm text-quiet">Checking your account…</p>
    : auth.user ? <>
      <p className="mt-2 text-sm font-semibold">{auth.user.email}</p>
      <p className="mt-1 text-xs text-quiet">{auth.user.email_confirmed_at ? "Email verified." : "Email verification pending."} Your data stays local until you choose a cloud action.</p>
      {checked ? remote ? <div className="mt-4 rounded-xl bg-canvas p-4">
        <p className="text-sm font-bold">A cloud backup exists</p>
        <p className="mt-1 text-xs text-quiet">Revision {remote.revision}. Restoring replaces the data on this device.</p>
        <button type="button" disabled={syncBusy} onClick={restore} className="mt-3 h-11 rounded-full bg-forest px-5 text-sm font-bold text-paper disabled:opacity-50">Restore cloud backup</button>
      </div> : <div className="mt-4 rounded-xl bg-canvas p-4">
        <p className="text-sm font-bold">No cloud backup yet</p>
        <p className="mt-1 text-xs text-quiet">Create the first backup from this device. Local data remains in place.</p>
        <button type="button" disabled={syncBusy} onClick={() => void upload()} className="mt-3 h-11 rounded-full bg-forest px-5 text-sm font-bold text-paper disabled:opacity-50">{syncBusy ? "Working…" : "Back up this device"}</button>
      </div> : <p className="mt-3 text-xs text-quiet">Checking for a cloud backup…</p>}
      <button type="button" disabled={busy} onClick={() => void act(auth.signOut)} className="mt-4 h-11 rounded-full bg-canvas px-5 text-sm font-bold">Sign out</button>
    </> : <>
      <p className="mt-2 text-sm leading-6 text-quiet">Keep using ROUTA without an account, or create one when you're ready. Your local routine stays intact.</p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => { setMode("signin"); setMessage(""); setError(""); }} className={`h-10 rounded-full px-4 text-xs font-bold ${activeMode === "signin" ? "bg-forest text-paper" : "bg-canvas"}`}>Sign in</button>
        <button type="button" onClick={() => { setMode("signup"); setMessage(""); setError(""); }} className={`h-10 rounded-full px-4 text-xs font-bold ${activeMode === "signup" ? "bg-forest text-paper" : "bg-canvas"}`}>Create account</button>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        {activeMode === "new-password" ? <>
          <p className="text-sm font-semibold">Choose a new password</p>
          <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-sm text-ink outline-none focus:border-lime" />
          <input required minLength={8} type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm new password" className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-sm text-ink outline-none focus:border-lime" />
        </> : <>
          <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-sm text-ink outline-none focus:border-lime" />
          {activeMode !== "reset" ? <input required minLength={8} type="password" autoComplete={activeMode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (at least 8 characters)" className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-sm text-ink outline-none focus:border-lime" /> : null}
        </>}
        <button disabled={busy} type="submit" className="h-12 w-full rounded-full bg-forest px-5 text-sm font-bold text-paper disabled:opacity-50">{busy ? "Please wait…" : activeMode === "signup" ? "Create account" : activeMode === "reset" ? "Send reset link" : activeMode === "new-password" ? "Update password" : "Sign in"}</button>
      </form>
      {activeMode === "signin" ? <button type="button" onClick={() => setMode("reset")} className="mt-3 text-xs font-semibold text-quiet underline">Forgot password?</button> : null}
      {activeMode === "reset" ? <button type="button" onClick={() => setMode("signin")} className="mt-3 text-xs font-semibold text-quiet underline">Back to sign in</button> : null}
    </>}
    {message ? <p role="status" className="mt-3 text-sm font-medium text-olive">{message}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
    <p className="mt-4 text-xs leading-5 text-quiet">Email is verified once when you create your account. Signing in later does not require another verification.</p>
  </section>;
}
