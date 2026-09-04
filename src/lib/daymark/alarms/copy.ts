import type { ReminderPermission } from "../types";
import type { PlatformCapabilities } from "./types";

export interface ReminderUxCopy {
  headline: string;
  body: string;
  granted: string | null;
  denied: string | null;
  unsupported: string | null;
  button: string;
}

export function reminderUxCopy(
  capabilities: PlatformCapabilities,
  permission: ReminderPermission,
  remindersEnabled: boolean,
): ReminderUxCopy {
  const nativeExact = capabilities.exactAlarms;
  const body = nativeExact
    ? "ROUTA uses your phone’s alarm system to remind you when it’s time for this checkpoint. This does not add an alarm to the Clock app."
    : "ROUTA uses your phone’s notification system to remind you when it’s time for this checkpoint.";

  return {
    headline: "Turn on reminders",
    body: `${body} Routa will not ask for permission until you turn reminders on.`,
    granted: permission === "granted" && remindersEnabled
      ? nativeExact
        ? "Alarms are scheduled on this device."
        : "ROUTA notifications are enabled"
      : null,
    denied: permission === "denied" ? "Reminders are disabled" : null,
    unsupported: permission === "unsupported" ? "This browser does not support notifications." : null,
    button: remindersEnabled ? "Daily reminders on" : "Turn on reminders",
  };
}

export function deniedRecoveryCopy(capabilities: PlatformCapabilities) {
  if (capabilities.platform === "web") {
    return "Enable notifications in your browser settings, then return here.";
  }
  if (capabilities.platform === "android") {
    return "Enable notifications (and exact alarms, if asked) in Android settings, then return here.";
  }
  return "Enable Routa alarms in iOS Settings, then return here.";
}
