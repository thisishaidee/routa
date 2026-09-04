import { useRef, useState } from "react";
import { alarmStatusLabel, deniedRecoveryCopy, isStandaloneDisplay, pushSupport, reminderUxCopy } from "@/lib/daymark/notifications";
import { backupFilename } from "@/lib/daymark/backup";
import { useDaymark } from "@/lib/daymark/store";
import { clockLabel, deviceTimeZone } from "@/lib/daymark/time";

export function SettingsView() {
  const {
    profile,
    updateProfile,
    routine,
    updateRoutineMeta,
    settings,
    updateSettings,
    permission,
    requestReminders,
    enableAllReminders,
    disableAllReminders,
    toggleCheckpointReminder,
    alarmStatus,
    capabilities,
    resetProgress,
    resetRoutine,
    clearAllData,
    exportBackup,
    importBackup,
  } = useDaymark();
  const [confirm, setConfirm] = useState<null | "progress" | "routine" | "all" | "import">(null);
  const [backupMessage, setBackupMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const standalone = typeof window !== "undefined" && isStandaloneDisplay();
  const push = pushSupport();
  const copy = reminderUxCopy(capabilities, permission, settings.remindersEnabled);

  const enableReminders = async () => {
    if (permission === "unsupported") return;
    if (permission === "denied") return;
    if (permission !== "granted") {
      const next = await requestReminders();
      if (next !== "granted") return;
    }
    updateSettings({ remindersEnabled: true });
  };

  const downloadBackup = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFilename();
    link.click();
    URL.revokeObjectURL(url);
    setBackupMessage("Backup downloaded.");
  };

  const onPickBackup = async (file: File | undefined) => {
    if (!file) return;
    const raw = await file.text();
    setPendingImport(raw);
    setConfirm("import");
    setBackupMessage("");
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    const result = importBackup(pendingImport);
    setConfirm(null);
    setPendingImport(null);
    setBackupMessage(result.ok ? "Backup restored on this device." : result.error || "Could not import that file.");
  };

  return (
    <section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-quiet">Settings</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Your Routa</h1>

      <div className="mt-6 space-y-4">
        <label className="block rounded-3xl border border-line bg-paper p-5 text-xs font-bold text-quiet">
          Name
          <input
            value={profile.name}
            onChange={(event) => updateProfile({ name: event.target.value })}
            placeholder="What should we call you?"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-canvas px-3 text-sm font-medium text-ink outline-none focus:border-lime"
          />
        </label>

        <label className="block rounded-3xl border border-line bg-paper p-5 text-xs font-bold text-quiet">
          Routine name
          <input
            value={routine?.name ?? ""}
            onChange={(event) => updateRoutineMeta({ name: event.target.value })}
            placeholder="My routine"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-canvas px-3 text-sm font-medium text-ink outline-none focus:border-lime"
          />
        </label>

        <label className="block rounded-3xl border border-line bg-paper p-5 text-xs font-bold text-quiet">
          Description
          <textarea
            value={routine?.description ?? ""}
            onChange={(event) => updateRoutineMeta({ description: event.target.value })}
            placeholder="Optional: what this rhythm is for"
            className="mt-2 min-h-20 w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm font-medium text-ink outline-none focus:border-lime"
          />
        </label>

        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Week starts</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ weekStartsOn: 1 })}
              className={`h-12 rounded-xl text-sm font-bold ${settings.weekStartsOn === 1 ? "bg-forest text-paper" : "bg-canvas"}`}
            >
              Monday
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ weekStartsOn: 0 })}
              className={`h-12 rounded-xl text-sm font-bold ${settings.weekStartsOn === 0 ? "bg-forest text-paper" : "bg-canvas"}`}
            >
              Sunday
            </button>
          </div>
          <p className="mt-3 text-xs text-quiet">Times use this device: {deviceTimeZone()}.</p>
        </div>

        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Reminders</p>
          <h2 className="mt-2 text-xl font-black">{copy.headline}</h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-quiet">{copy.body}</p>
          <p className="mt-2 text-xs text-quiet">
            {capabilities.exactAlarms
              ? "This device can schedule Routa alarms through the system alarm API. It still will not add an alarm to Clock."
              : "Web reminders are notifications, not native Clock alarms. They only fire while Routa stays open."}
          </p>

          {copy.unsupported ? <p className="mt-3 text-sm font-medium text-danger">{copy.unsupported}</p> : null}
          {copy.denied ? (
            <p className="mt-3 text-sm font-medium text-danger">
              {copy.denied}. {deniedRecoveryCopy(capabilities)}
            </p>
          ) : null}
          {copy.granted ? <p className="mt-3 text-sm font-medium text-olive">{copy.granted}</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void enableReminders()}
              disabled={permission === "unsupported" || permission === "denied"}
              className={`h-12 rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${settings.remindersEnabled ? "bg-mist text-olive" : "bg-forest text-paper"}`}
            >
              {copy.denied ? "Reminders are disabled" : copy.button}
            </button>
            {settings.remindersEnabled ? (
              <button
                type="button"
                onClick={() => updateSettings({ remindersEnabled: false })}
                className="h-12 rounded-xl bg-canvas px-4 text-sm font-bold"
              >
                Pause all
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void enableAllReminders()} className="h-11 rounded-xl bg-canvas px-3 text-xs font-bold">
              Enable all reminders
            </button>
            <button type="button" onClick={disableAllReminders} className="h-11 rounded-xl bg-canvas px-3 text-xs font-bold">
              Disable all reminders
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {(routine?.checkpoints ?? []).map((item) => {
              const status = alarmStatus(item);
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.title}</p>
                    <p className="text-xs text-quiet">
                      {clockLabel(item.time)}
                      {item.enabled ? "" : " · disabled"} · {alarmStatusLabel(status)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCheckpointReminder(item.id)}
                    className={`h-11 min-w-16 rounded-xl text-xs font-bold ${
                      item.reminderEnabled ? "bg-mist text-olive" : "bg-paper text-quiet"
                    }`}
                  >
                    {item.reminderEnabled ? "On" : "Off"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Install</p>
          <h2 className="mt-2 text-xl font-black">Use Routa like an app</h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-quiet">
            {standalone
              ? "Routa is running as an installed app on this device."
              : "Add Routa to your home screen from the browser menu. Reminders still need the app open."}
          </p>
          <p className="mt-2 text-xs text-quiet">
            {push === "available"
              ? "This browser can support Web Push later. It is not connected yet, so no background push is active."
              : "Web Push is not available in this browser."}{" "}
            Routa never adds an alarm to your phone’s Clock app.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Backup</p>
          <p className="mt-2 text-pretty text-sm leading-6 text-quiet">
            Everything lives on this device until you add an account later. Export a JSON backup so you can restore it.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={downloadBackup} className="h-12 rounded-xl bg-forest px-4 text-sm font-bold text-paper">
              Export backup
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="h-12 rounded-xl bg-canvas px-4 text-sm font-bold">
              Import backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onPickBackup(file);
              }}
            />
          </div>
          {confirm === "import" ? (
            <div className="mt-4 flex min-h-12 items-center justify-between rounded-xl bg-canvas px-3 text-sm">
              <span className="font-medium">Replace the routine on this device?</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfirm(null);
                    setPendingImport(null);
                  }}
                  className="font-bold text-quiet"
                >
                  Cancel
                </button>
                <button type="button" onClick={confirmImport} className="font-bold text-danger">
                  Restore
                </button>
              </div>
            </div>
          ) : null}
          {backupMessage ? <p className="mt-3 text-sm font-medium text-olive">{backupMessage}</p> : null}
        </div>

        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Data</p>
          <p className="mt-2 text-pretty text-sm leading-6 text-quiet">Reset only this device. Export first if you want a copy.</p>
          <div className="mt-4 space-y-2">
            <DangerRow
              label="Reset progress"
              confirm={confirm === "progress"}
              onAsk={() => setConfirm("progress")}
              onCancel={() => setConfirm(null)}
              onConfirm={() => {
                resetProgress();
                setConfirm(null);
              }}
            />
            <DangerRow
              label="Reset routine"
              confirm={confirm === "routine"}
              onAsk={() => setConfirm("routine")}
              onCancel={() => setConfirm(null)}
              onConfirm={() => {
                resetRoutine();
                setConfirm(null);
              }}
            />
            <DangerRow
              label="Clear local data"
              confirm={confirm === "all"}
              onAsk={() => setConfirm("all")}
              onCancel={() => setConfirm(null)}
              onConfirm={() => {
                clearAllData();
                setConfirm(null);
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function DangerRow({
  label,
  confirm,
  onAsk,
  onCancel,
  onConfirm,
}: {
  label: string;
  confirm: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (confirm) {
    return (
      <div className="flex min-h-12 items-center justify-between rounded-xl bg-canvas px-3 text-sm">
        <span className="font-medium">Are you sure?</span>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="font-bold text-quiet">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="font-bold text-danger">
            Confirm
          </button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" onClick={onAsk} className="flex h-12 w-full items-center rounded-xl bg-canvas px-3 text-left text-sm font-bold text-danger">
      {label}
    </button>
  );
}
