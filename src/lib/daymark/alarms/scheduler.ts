import type { AlarmStatus, Checkpoint, ReminderPermission, Settings } from "../types";
import { deviceTimeZone } from "../time";
import {
  alarmFingerprint,
  classifyAlarmStatus,
  desiredAlarms,
  splitTime,
  stateToStatus,
} from "./policy";
import {
  capabilitiesFor,
  detectNativeBridge,
  reminderPermission,
  requestReminderPermission,
  wrapNativeBridge,
} from "./platforms";
import { createLocalRegistry } from "./registry";
import type {
  AlarmRecord,
  AlarmRegistry,
  AlarmScheduler,
  DesiredAlarm,
  NativeAlarmAdapter,
  NativeAlarmRequest,
  PlatformCapabilities,
  SchedulingState,
  SyncResult,
} from "./types";

export interface AlarmSchedulerDeps {
  platform: AlarmScheduler["platform"];
  registry: AlarmRegistry;
  native?: NativeAlarmAdapter | null;
  permission?: () => ReminderPermission;
  requestPermission?: () => Promise<ReminderPermission>;
  capabilities?: () => PlatformCapabilities;
  timezone?: () => string;
  now?: () => Date;
}

function toNativeRequest(alarm: DesiredAlarm): NativeAlarmRequest {
  const { hour, minute } = splitTime(alarm.time);
  return {
    alarmId: alarm.alarmId,
    routineId: alarm.routineId,
    checkpointId: alarm.checkpointId,
    title: alarm.title,
    body: `Time for ${alarm.title}.`,
    hour,
    minute,
    weekdays: alarm.recurrence,
    oneShot: alarm.recurrence.length === 0,
    timezone: alarm.timezone,
  };
}

function matchesFingerprint(record: AlarmRecord, alarm: DesiredAlarm) {
  return alarmFingerprint({ ...record, title: record.title }) === alarmFingerprint(alarm);
}

export function createAlarmScheduler(deps: AlarmSchedulerDeps): AlarmScheduler {
  const registry = deps.registry;
  const native = deps.native ?? null;
  const platform = deps.platform;
  const checkPermission = deps.permission ?? reminderPermission;
  const requestPermissionFn = deps.requestPermission ?? requestReminderPermission;
  const timezoneOf = deps.timezone ?? deviceTimeZone;
  const now = deps.now ?? (() => new Date());

  const getCapabilities = () => {
    if (deps.capabilities) return deps.capabilities();
    return capabilitiesFor(platform, native);
  };

  const canExactAlarm = () => Boolean(native && getCapabilities().exactAlarms && native.canExactAlarm());

  function recordOf(alarm: DesiredAlarm, state: SchedulingState, extra?: Partial<AlarmRecord>): AlarmRecord {
    const record: AlarmRecord = {
      alarmId: alarm.alarmId,
      routineId: alarm.routineId,
      checkpointId: alarm.checkpointId,
      time: alarm.time,
      recurrence: [...alarm.recurrence],
      enabled: alarm.enabled,
      platform,
      schedulingState: state,
      lastSyncAt: now().toISOString(),
      timezone: alarm.timezone,
      title: alarm.title,
    };
    if (extra?.nativeHandle) record.nativeHandle = extra.nativeHandle;
    if (extra?.lastError) record.lastError = extra.lastError;
    return record;
  }

  function upsert(record: AlarmRecord) {
    const current = registry.read().filter((item) => item.alarmId !== record.alarmId);
    if (record.schedulingState !== "cancelled") current.push(record);
    registry.write(current);
    return record;
  }

  async function cancelNative(alarmId: string) {
    if (native) {
      try {
        await native.cancel(alarmId);
      } catch {
        /* still drop the local record */
      }
    }
  }

  async function place(alarm: DesiredAlarm, force: boolean): Promise<AlarmRecord> {
    const permission = checkPermission();
    const existing = registry.read().find((item) => item.alarmId === alarm.alarmId);

    if (!alarm.enabled) {
      await cancelNative(alarm.alarmId);
      const cancelled = recordOf(alarm, "cancelled");
      registry.write(registry.read().filter((item) => item.alarmId !== alarm.alarmId));
      return cancelled;
    }

    if (permission === "unsupported") return upsert(recordOf(alarm, "unsupported"));
    if (permission === "denied") {
      await cancelNative(alarm.alarmId);
      return upsert(recordOf(alarm, "permission-denied"));
    }
    if (permission !== "granted") return upsert(recordOf(alarm, "pending"));

    const exact = canExactAlarm();

    if (!force && existing && existing.enabled && matchesFingerprint(existing, alarm)) {
      const healthy =
        (exact && existing.schedulingState === "scheduled") ||
        (!exact && (existing.schedulingState === "listening" || existing.schedulingState === "fallback"));
      if (healthy) {
        if (exact && native) {
          const listed = await native.list();
          if (listed.some((item) => item.alarmId === alarm.alarmId)) return existing;
        } else if (!exact) {
          return existing;
        }
      }
    }

    if (exact && native) {
      const result = await native.schedule(toNativeRequest(alarm));
      if (result.ok) {
        return upsert(recordOf(alarm, "scheduled", { nativeHandle: result.handle }));
      }
      return upsert(recordOf(alarm, "fallback", { lastError: result.error || "Native schedule failed." }));
    }

    return upsert(recordOf(alarm, "listening"));
  }

  async function reconcile(alarms: DesiredAlarm[], force: boolean): Promise<SyncResult> {
    const desiredEnabled = alarms.filter((item) => item.enabled);
    const desiredIds = new Set(desiredEnabled.map((item) => item.alarmId));
    const current = registry.read();
    const cancelledIds: string[] = [];

    for (const record of current) {
      if (!desiredIds.has(record.alarmId)) {
        await cancelNative(record.alarmId);
        cancelledIds.push(record.alarmId);
      }
    }

    const stale = current.filter((item) => !desiredIds.has(item.alarmId)).map((item) => item.alarmId);
    if (stale.length) {
      registry.write(current.filter((item) => !stale.includes(item.alarmId)));
    }

    for (const alarm of alarms) {
      await place(alarm, force);
    }

    const next = registry.read();
    const scheduledIds: string[] = [];
    const listeningIds: string[] = [];
    const skipped: SyncResult["skipped"] = [];
    const exact = canExactAlarm();

    for (const record of next) {
      if (record.schedulingState === "scheduled" && exact) scheduledIds.push(record.checkpointId);
      else if (record.schedulingState === "listening" || record.schedulingState === "fallback") {
        listeningIds.push(record.checkpointId);
      } else {
        skipped.push({ id: record.checkpointId, reason: stateToStatus(record.schedulingState, exact) });
      }
    }

    return { scheduledIds, listeningIds, cancelledIds, skipped };
  }

  const scheduler: AlarmScheduler = {
    platform,
    getPlatformCapabilities: getCapabilities,
    checkPermission,
    permission: checkPermission,
    requestPermission: requestPermissionFn,
    canExactAlarm,
    async scheduleAlarm(alarm) {
      return place({ ...alarm, recurrence: [], enabled: true }, true);
    },
    async scheduleRepeatingAlarm(alarm) {
      return place({ ...alarm, enabled: true }, true);
    },
    async cancelAlarm(alarmId) {
      await cancelNative(alarmId);
      registry.write(registry.read().filter((item) => item.alarmId !== alarmId));
    },
    async updateAlarm(alarm) {
      await cancelNative(alarm.alarmId);
      return place(alarm, true);
    },
    getScheduledAlarms() {
      return registry.read().filter((item) => item.schedulingState !== "cancelled");
    },
    rescheduleAll(alarms) {
      return reconcile(alarms, true);
    },
    async cancelAll() {
      const current = registry.read();
      for (const record of current) await cancelNative(record.alarmId);
      registry.clear();
    },
    async sync(checkpoints, settings, routineId = "routine_default") {
      const desired = desiredAlarms({
        routineId,
        checkpoints,
        settings,
        timezone: timezoneOf(),
      });
      const result = await reconcile(desired, false);
      const exact = canExactAlarm();
      const permission = checkPermission();
      const known = new Set(result.scheduledIds.concat(result.listeningIds).concat(result.skipped.map((item) => item.id)));
      for (const checkpoint of checkpoints) {
        if (known.has(checkpoint.id)) continue;
        const status = classifyAlarmStatus(checkpoint, settings, permission, exact);
        if (status !== "listening" && status !== "scheduled") {
          result.skipped.push({ id: checkpoint.id, reason: status });
        }
      }
      return result;
    },
    status(checkpoint, settings, permission) {
      const exact = canExactAlarm();
      const classified = classifyAlarmStatus(checkpoint, settings, permission, exact);
      const record = registry.read().find((item) => item.checkpointId === checkpoint.id);
      if (!record) return classified;
      const fromState = stateToStatus(record.schedulingState, exact);
      if (fromState === "scheduled" && !exact) return "listening";
      if (classified === "off") return "off";
      return fromState;
    },
  };

  return scheduler;
}

const localRegistry = createLocalRegistry();

export const webNotificationScheduler: AlarmScheduler = createAlarmScheduler({
  platform: "web",
  registry: localRegistry,
  native: null,
});

export function createAndroidScheduler(adapter: NativeAlarmAdapter | null = null): AlarmScheduler {
  return createAlarmScheduler({
    platform: "android",
    registry: localRegistry,
    native: adapter,
    permission: adapter ? () => adapter.checkPermission() : reminderPermission,
    requestPermission: adapter ? () => adapter.requestPermission() : requestReminderPermission,
  });
}

export function createIosScheduler(adapter: NativeAlarmAdapter | null = null): AlarmScheduler {
  return createAlarmScheduler({
    platform: "ios",
    registry: localRegistry,
    native: adapter,
    permission: adapter ? () => adapter.checkPermission() : reminderPermission,
    requestPermission: adapter ? () => adapter.requestPermission() : requestReminderPermission,
  });
}

/** Only reports android/ios when a native shell injected the bridge. Never inferred from user-agent. */
export function getAlarmScheduler(): AlarmScheduler {
  const bridge = detectNativeBridge();
  if (bridge?.platform === "android") return createAndroidScheduler(wrapNativeBridge(bridge));
  if (bridge?.platform === "ios") return createIosScheduler(wrapNativeBridge(bridge));
  return webNotificationScheduler;
}

export const androidAlarmScheduler: AlarmScheduler = createAndroidScheduler(null);
export const iosAlarmScheduler: AlarmScheduler = createIosScheduler(null);
