import { useState } from "react";
import { useDaymark } from "@/lib/daymark/store";
import { clockLabel } from "@/lib/daymark/time";

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
    resetProgress,
    resetRoutine,
    clearAllData,
  } = useDaymark();
  const [confirm, setConfirm] = useState<null | "progress" | "routine" | "all">(null);

  const enableReminders = async () => {
    if (permission !== "granted") {
      const next = await requestReminders();
      if (next !== "granted") return;
    }
    updateSettings({ remindersEnabled: true });
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
        </div>

        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Reminders</p>
          <h2 className="mt-2 text-xl font-black">Enable Routa reminders</h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-quiet">
            Routa can notify you in this browser while the app is open. It cannot silently add alarms to your phone's Clock app.
          </p>

          {permission === "unsupported" ? (
            <p className="mt-3 text-sm font-medium text-danger">This browser does not support notifications.</p>
          ) : null}
          {permission === "denied" ? (
            <p className="mt-3 text-sm font-medium text-danger">
              Notifications are blocked. Enable them in your browser settings, then return here.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void enableReminders()}
              className={`h-12 rounded-xl px-4 text-sm font-bold ${settings.remindersEnabled ? "bg-mist text-olive" : "bg-forest text-paper"}`}
            >
              {settings.remindersEnabled ? "Daily reminders on" : "Turn daily reminders on"}
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
            {(routine?.checkpoints ?? []).map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.title}</p>
                  <p className="text-xs text-quiet">
                    {clockLabel(item.time)}
                    {item.enabled ? "" : " · disabled"}
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
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Data</p>
          <p className="mt-2 text-pretty text-sm leading-6 text-quiet">Everything lives on this device until you add an account later.</p>
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
