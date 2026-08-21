import type { Checkpoint, ReminderPermission, Settings } from "./types";
import { mondayIndex, pad, todayKey } from "./time";

export function reminderPermission(): ReminderPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  try {
    await Notification.requestPermission();
  } catch {
    return reminderPermission();
  }
  return reminderPermission();
}

export async function registerReminderWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/daymark-sw.js");
  } catch {
    // Page-open reminders still work without a worker.
  }
}

function alarmKey(date: Date, checkpointId: string) {
  return `routa:v2:alarm:${todayKey(date)}:${checkpointId}`;
}

function legacyAlarmKey(date: Date, checkpointId: string) {
  return `daymark:v2:alarm:${todayKey(date)}:${checkpointId}`;
}

function alreadyFired(key: string, legacy: string) {
  try {
    return sessionStorage.getItem(key) === "1" || sessionStorage.getItem(legacy) === "1";
  } catch {
    return false;
  }
}

function markFired(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

export interface ReminderTick {
  checkpoints: Checkpoint[];
  settings: Settings;
  onFire?: (checkpoint: Checkpoint) => void;
}

export function tickReminders(input: ReminderTick, date = new Date()) {
  if (!input.settings.remindersEnabled) return;
  if (reminderPermission() !== "granted") return;
  const stamp = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = mondayIndex(date);
  for (const checkpoint of input.checkpoints) {
    if (!checkpoint.enabled || !checkpoint.reminderEnabled) continue;
    if (!checkpoint.repeatDays.includes(day)) continue;
    if (checkpoint.time !== stamp) continue;
    const key = alarmKey(date, checkpoint.id);
    if (alreadyFired(key, legacyAlarmKey(date, checkpoint.id))) continue;
    markFired(key);
    try {
      new Notification(`Routa · ${checkpoint.title}`, {
        body: `Time for ${checkpoint.title}.`,
        tag: key,
      });
    } catch {
      /* ignore */
    }
    input.onFire?.(checkpoint);
  }
}

export const notificationService = {
  permission: reminderPermission,
  requestPermission: requestReminderPermission,
  registerWorker: registerReminderWorker,
  scheduleReminder() {
    // Web MVP: reminders are evaluated from the live routine on each tick.
    // Native wrappers can replace this method with OS local notifications.
  },
  cancelReminder() {},
  updateReminder() {},
};
