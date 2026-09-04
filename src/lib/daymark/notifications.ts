import type { Checkpoint, ReminderPermission, Settings } from "./types";
import {
  alreadyFired,
  dueNow,
  getAlarmScheduler,
  markFired,
  reminderPermission,
  requestReminderPermission,
} from "./alarms";

export { reminderPermission, requestReminderPermission } from "./alarms";
export {
  alarmStatusLabel,
  getAlarmScheduler,
  isStandaloneDisplay,
  pushSupport,
  reminderUxCopy,
  deniedRecoveryCopy,
} from "./alarms";
export type { AlarmScheduler, PlatformCapabilities, SyncResult } from "./alarms";

export async function registerReminderWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/daymark-sw.js");
  } catch {
    // Page-open reminders still work without a worker.
  }
}

export interface ReminderTick {
  checkpoints: Checkpoint[];
  settings: Settings;
  permission?: ReminderPermission;
  onFire?: (checkpoint: Checkpoint) => void;
}

export function tickReminders(input: ReminderTick, date = new Date()) {
  if (getAlarmScheduler().canExactAlarm()) return;
  const permission = input.permission ?? reminderPermission();
  const due = dueNow({
    checkpoints: input.checkpoints,
    settings: input.settings,
    at: date,
    permission,
  });
  for (const item of due) {
    if (alreadyFired(date, item.checkpoint.id)) continue;
    markFired(date, item.checkpoint.id);
    try {
      if (typeof Notification === "undefined") return;
      const worker = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
      if (worker) {
        worker.postMessage({
          type: "routa-notify",
          title: `Routa · ${item.checkpoint.title}`,
          body: `Time for ${item.checkpoint.title}.`,
          tag: item.key,
        });
      } else {
        new Notification(`Routa · ${item.checkpoint.title}`, {
          body: `Time for ${item.checkpoint.title}.`,
          tag: item.key,
        });
      }
    } catch {
      try {
        new Notification(`Routa · ${item.checkpoint.title}`, {
          body: `Time for ${item.checkpoint.title}.`,
          tag: item.key,
        });
      } catch {
        /* ignore */
      }
    }
    input.onFire?.(item.checkpoint);
  }
}

export const notificationService = {
  permission: reminderPermission,
  requestPermission: requestReminderPermission,
  registerWorker: registerReminderWorker,
  async scheduleReminder() {
    return getAlarmScheduler().sync([], { weekStartsOn: 1, remindersEnabled: false });
  },
  cancelReminder() {
    return getAlarmScheduler().cancelAll();
  },
  updateReminder() {
    return getAlarmScheduler().rescheduleAll([]);
  },
  scheduler: getAlarmScheduler(),
};
