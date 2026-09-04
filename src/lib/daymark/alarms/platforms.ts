import type { ReminderPermission } from "../types";
import type {
  AlarmPlatform,
  NativeAlarmAdapter,
  NativeAlarmHandle,
  NativeAlarmRequest,
  NativeAlarmResult,
  PlatformCapabilities,
  RoutaNativeAlarmsBridge,
} from "./types";

export function reminderPermission(): ReminderPermission {
  if (typeof window === "undefined") return "unsupported";
  if (typeof Notification === "undefined") return "unsupported";
  try {
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  try {
    await Notification.requestPermission();
  } catch {
    return reminderPermission();
  }
  return reminderPermission();
}

export function pushSupport(): "unsupported" | "available" {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return "available";
}

export function webPushStatus(): PlatformCapabilities["webPush"] {
  if (pushSupport() === "unsupported") return "unsupported";
  return "available";
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(media || ios);
}

export function notificationsSupported() {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

function asyncResult<T>(value: T | Promise<T>): Promise<T> {
  return Promise.resolve(value);
}

export function detectNativeBridge(): RoutaNativeAlarmsBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = window.RoutaNativeAlarms;
  if (!bridge) return null;
  if (bridge.platform !== "android" && bridge.platform !== "ios") return null;
  return bridge;
}

export function wrapNativeBridge(bridge: RoutaNativeAlarmsBridge): NativeAlarmAdapter {
  let exactCache = false;
  try {
    const value = bridge.canExactAlarm();
    if (typeof value === "boolean") exactCache = value;
    else void value.then((next) => {
      exactCache = next;
    });
  } catch {
    exactCache = false;
  }

  return {
    platform: bridge.platform,
    canExactAlarm() {
      try {
        const value = bridge.canExactAlarm();
        if (typeof value === "boolean") {
          exactCache = value;
          return value;
        }
      } catch {
        return exactCache;
      }
      return exactCache;
    },
    checkPermission() {
      try {
        const value = bridge.checkPermission();
        if (typeof value === "string") return value;
      } catch {
        return reminderPermission();
      }
      return reminderPermission();
    },
    requestPermission() {
      return bridge.requestPermission();
    },
    async schedule(request) {
      const method =
        request.oneShot || !bridge.scheduleRepeating ? bridge.schedule : bridge.scheduleRepeating.bind(bridge);
      try {
        return await asyncResult(method(request));
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Native schedule failed." };
      }
    },
    async cancel(alarmId) {
      await asyncResult(bridge.cancel(alarmId));
    },
    async list() {
      try {
        return await asyncResult(bridge.list());
      } catch {
        return [];
      }
    },
    async rescheduleAll(requests) {
      if (bridge.rescheduleAll) {
        await asyncResult(bridge.rescheduleAll(requests));
        return;
      }
      for (const request of requests) {
        await asyncResult(bridge.schedule(request));
      }
    },
  };
}

export function webCapabilities(): PlatformCapabilities {
  return {
    platform: "web",
    notifications: notificationsSupported(),
    webPush: webPushStatus(),
    exactAlarms: false,
    repeatingAlarms: false,
    clockAppInjection: false,
    bootReschedule: false,
    timezoneReschedule: false,
    backgroundWhenClosed: false,
    requiresOpenApp: true,
    alarmManager: false,
    alarmKit: false,
  };
}

export function nativeCapabilities(
  platform: "android" | "ios",
  adapter: NativeAlarmAdapter | null,
): PlatformCapabilities {
  const exact = Boolean(adapter?.canExactAlarm());
  return {
    platform,
    notifications: notificationsSupported() || Boolean(adapter),
    webPush: "unsupported",
    exactAlarms: exact,
    repeatingAlarms: exact,
    clockAppInjection: false,
    bootReschedule: Boolean(adapter),
    timezoneReschedule: Boolean(adapter),
    backgroundWhenClosed: exact,
    requiresOpenApp: !exact,
    alarmManager: platform === "android" && Boolean(adapter),
    alarmKit: platform === "ios" && Boolean(adapter),
  };
}

export function capabilitiesFor(platform: AlarmPlatform, adapter: NativeAlarmAdapter | null): PlatformCapabilities {
  if (platform === "web" || !adapter) {
    if (platform === "web") return webCapabilities();
    return { ...nativeCapabilities(platform, null), notifications: notificationsSupported() };
  }
  return nativeCapabilities(platform, adapter);
}

export type { NativeAlarmHandle, NativeAlarmRequest, NativeAlarmResult };

declare global {
  interface Window {
    RoutaNativeAlarms?: RoutaNativeAlarmsBridge;
  }
}
