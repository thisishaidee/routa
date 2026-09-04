import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Checkpoint, ReminderPermission, Settings } from "../types";
import { reminderUxCopy } from "./copy";
import { alarmIdFor, desiredAlarms, dueNow, isReminderEligible } from "./policy";
import { createMemoryRegistry } from "./registry";
import { createAlarmScheduler } from "./scheduler";
import { nextOccurrence } from "../time";
import type { DesiredAlarm, NativeAlarmAdapter, NativeAlarmRequest, PlatformCapabilities } from "./types";

const WEEKDAYS: Checkpoint["repeatDays"] = [0, 1, 2, 3, 4];

function checkpoint(patch: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: "cp_workout",
    time: "06:00",
    title: "Workout",
    icon: "target",
    tasks: [],
    enabled: true,
    repeatDays: [...WEEKDAYS],
    reminderEnabled: true,
    ...patch,
  };
}

function settings(remindersEnabled = true): Settings {
  return { weekStartsOn: 1, remindersEnabled };
}

function desiredFrom(cp: Checkpoint, enabled = true): DesiredAlarm {
  return {
    alarmId: alarmIdFor("rt_1", cp.id),
    routineId: "rt_1",
    checkpointId: cp.id,
    title: cp.title,
    time: cp.time,
    recurrence: [...cp.repeatDays],
    enabled,
    timezone: "Africa/Lagos",
  };
}

function mockNative(options?: {
  platform?: "android" | "ios";
  exact?: boolean;
  permission?: ReminderPermission;
  failSchedule?: boolean;
}): NativeAlarmAdapter & { scheduled: Map<string, NativeAlarmRequest>; scheduleCalls: number; cancelCalls: string[] } {
  const scheduled = new Map<string, NativeAlarmRequest>();
  const cancelCalls: string[] = [];
  let scheduleCalls = 0;
  const permission = options?.permission ?? "granted";
  const adapter: NativeAlarmAdapter & {
    scheduled: Map<string, NativeAlarmRequest>;
    scheduleCalls: number;
    cancelCalls: string[];
  } = {
    platform: options?.platform ?? "android",
    canExactAlarm() {
      return options?.exact !== false;
    },
    checkPermission() {
      return permission;
    },
    async requestPermission() {
      return permission;
    },
    async schedule(request) {
      scheduleCalls += 1;
      adapter.scheduleCalls = scheduleCalls;
      if (options?.failSchedule) return { ok: false, error: "native-failed" };
      scheduled.set(request.alarmId, request);
      return { ok: true, handle: `os:${request.alarmId}` };
    },
    async cancel(alarmId) {
      cancelCalls.push(alarmId);
      scheduled.delete(alarmId);
    },
    async list() {
      return [...scheduled.keys()].map((alarmId) => ({ alarmId, handle: `os:${alarmId}` }));
    },
    async rescheduleAll(requests) {
      scheduled.clear();
      for (const request of requests) scheduled.set(request.alarmId, request);
    },
    scheduled,
    scheduleCalls: 0,
    cancelCalls,
  };
  return adapter;
}

function webCaps(): PlatformCapabilities {
  return {
    platform: "web",
    notifications: true,
    webPush: "available",
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

describe("desiredAlarms", () => {
  it("builds a stable repeating alarm from a checkpoint", () => {
    const alarms = desiredAlarms({
      routineId: "rt_1",
      checkpoints: [checkpoint()],
      settings: settings(true),
      timezone: "Africa/Lagos",
    });
    assert.equal(alarms.length, 1);
    assert.equal(alarms[0].alarmId, "al_rt_1_cp_workout");
    assert.equal(alarms[0].time, "06:00");
    assert.deepEqual(alarms[0].recurrence, [0, 1, 2, 3, 4]);
    assert.equal(alarms[0].enabled, true);
  });

  it("marks disabled / reminder-off checkpoints as not schedulable", () => {
    const off = desiredAlarms({
      routineId: "rt_1",
      checkpoints: [checkpoint({ reminderEnabled: false }), checkpoint({ id: "cp_2", enabled: false })],
      settings: settings(true),
      timezone: "UTC",
    });
    assert.equal(off.every((item) => item.enabled === false), true);
  });
});

describe("dueNow policy", () => {
  const at = new Date(2026, 8, 4, 6, 0, 0); // Friday 06:00 local
  it("fires when permission is granted", () => {
    const due = dueNow({
      checkpoints: [checkpoint()],
      settings: settings(true),
      at,
      permission: "granted",
    });
    assert.equal(due.length, 1);
    assert.equal(due[0].checkpoint.id, "cp_workout");
  });

  it("does not fire when permission is denied", () => {
    const due = dueNow({
      checkpoints: [checkpoint()],
      settings: settings(true),
      at,
      permission: "denied",
    });
    assert.equal(due.length, 0);
  });

  it("does not fire on a non-repeat day", () => {
    const sunday = new Date(2026, 8, 6, 6, 0, 0);
    assert.equal(isReminderEligible(checkpoint(), settings(true), sunday), false);
  });
});

describe("web scheduler", () => {
  it("never reports scheduled ids", async () => {
    const scheduler = createAlarmScheduler({
      platform: "web",
      registry: createMemoryRegistry(),
      native: null,
      permission: () => "granted",
      timezone: () => "Africa/Lagos",
    });
    const result = await scheduler.sync([checkpoint()], settings(true), "rt_1");
    assert.deepEqual(result.scheduledIds, []);
    assert.deepEqual(result.listeningIds, ["cp_workout"]);
    assert.equal(scheduler.status(checkpoint(), settings(true), "granted"), "listening");
    assert.equal(scheduler.canExactAlarm(), false);
    assert.equal(scheduler.getPlatformCapabilities().clockAppInjection, false);
    assert.equal(scheduler.getPlatformCapabilities().exactAlarms, false);
  });

  it("stores listening records, not scheduled", async () => {
    const scheduler = createAlarmScheduler({
      platform: "web",
      registry: createMemoryRegistry(),
      native: null,
      permission: () => "granted",
      timezone: () => "UTC",
    });
    await scheduler.scheduleRepeatingAlarm(desiredFrom(checkpoint()));
    const records = scheduler.getScheduledAlarms();
    assert.equal(records[0].schedulingState, "listening");
    assert.equal(records[0].platform, "web");
  });

  it("unsupported browser stays unsupported", async () => {
    const scheduler = createAlarmScheduler({
      platform: "web",
      registry: createMemoryRegistry(),
      permission: () => "unsupported",
    });
    const result = await scheduler.sync([checkpoint()], settings(true), "rt_1");
    assert.equal(result.skipped[0]?.reason, "unsupported");
    assert.equal(scheduler.status(checkpoint(), settings(true), "unsupported"), "unsupported");
  });
});

describe("permission", () => {
  it("granted schedules on native", async () => {
    const native = mockNative({ platform: "android" });
    const scheduler = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native,
      permission: () => "granted",
      timezone: () => "Africa/Lagos",
      capabilities: () => ({
        ...webCaps(),
        platform: "android",
        exactAlarms: true,
        repeatingAlarms: true,
        bootReschedule: true,
        timezoneReschedule: true,
        backgroundWhenClosed: true,
        requiresOpenApp: false,
        alarmManager: true,
        webPush: "unsupported",
      }),
    });
    const result = await scheduler.sync([checkpoint()], settings(true), "rt_1");
    assert.deepEqual(result.scheduledIds, ["cp_workout"]);
    assert.equal(scheduler.status(checkpoint(), settings(true), "granted"), "scheduled");
    assert.equal(native.scheduled.size, 1);
  });

  it("denied cancels and does not schedule", async () => {
    const native = mockNative();
    const registry = createMemoryRegistry();
    const scheduler = createAlarmScheduler({
      platform: "android",
      registry,
      native,
      permission: () => "denied",
      capabilities: () => ({ ...webCaps(), platform: "android", exactAlarms: true, alarmManager: true, webPush: "unsupported" }),
    });
    await scheduler.sync([checkpoint()], settings(true), "rt_1");
    assert.equal(scheduler.getScheduledAlarms()[0].schedulingState, "permission-denied");
    assert.equal(native.scheduled.size, 0);
    assert.equal(scheduler.status(checkpoint(), settings(true), "denied"), "permission-denied");
  });

  it("revoked later cancels the native alarm", async () => {
    const scheduled = new Map<string, NativeAlarmRequest>();
    let permission: ReminderPermission = "granted";
    const native = mockNative();
    native.schedule = async (request) => {
      scheduled.set(request.alarmId, request);
      return { ok: true, handle: request.alarmId };
    };
    native.cancel = async (id) => {
      scheduled.delete(id);
    };
    native.list = async () => [...scheduled.keys()].map((alarmId) => ({ alarmId }));
    const scheduler = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native,
      permission: () => permission,
      capabilities: () => ({
        ...webCaps(),
        platform: "android",
        exactAlarms: true,
        alarmManager: true,
        webPush: "unsupported",
      }),
    });
    await scheduler.sync([checkpoint()], settings(true), "rt_1");
    assert.equal(scheduled.size, 1);
    permission = "denied";
    await scheduler.sync([checkpoint()], settings(true), "rt_1");
    assert.equal(scheduled.size, 0);
    assert.equal(scheduler.getScheduledAlarms()[0].schedulingState, "permission-denied");
  });
});

describe("sync from routine", () => {
  it("creates, updates time, disables, and deletes without duplicates", async () => {
    const native = mockNative({ platform: "ios" });
    const scheduler = createAlarmScheduler({
      platform: "ios",
      registry: createMemoryRegistry(),
      native,
      permission: () => "granted",
      timezone: () => "Africa/Lagos",
      capabilities: () => ({
        ...webCaps(),
        platform: "ios",
        exactAlarms: true,
        repeatingAlarms: true,
        alarmKit: true,
        webPush: "unsupported",
      }),
    });
    const workout = checkpoint();
    await scheduler.sync([workout], settings(true), "rt_1");
    assert.equal(native.scheduleCalls, 1);

    await scheduler.sync([workout], settings(true), "rt_1");
    assert.equal(native.scheduleCalls, 1, "duplicate prevention");

    await scheduler.sync([{ ...workout, time: "06:30" }], settings(true), "rt_1");
    assert.equal(native.scheduleCalls, 2);
    assert.equal([...native.scheduled.values()][0].hour, 6);
    assert.equal([...native.scheduled.values()][0].minute, 30);

    await scheduler.sync([{ ...workout, time: "06:30", reminderEnabled: false }], settings(true), "rt_1");
    assert.equal(native.scheduled.size, 0);

    await scheduler.sync([], settings(true), "rt_1");
    assert.equal(scheduler.getScheduledAlarms().length, 0);
  });

  it("schedules repeating weekdays", async () => {
    const native = mockNative();
    const scheduler = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native,
      permission: () => "granted",
      timezone: () => "UTC",
      capabilities: () => ({ ...webCaps(), platform: "android", exactAlarms: true, alarmManager: true, webPush: "unsupported" }),
    });
    await scheduler.scheduleRepeatingAlarm(desiredFrom(checkpoint()));
    const request = [...native.scheduled.values()][0];
    assert.equal(request.oneShot, false);
    assert.deepEqual(request.weekdays, [0, 1, 2, 3, 4]);
  });
});

describe("reboot, timezone, reinstall, devices", () => {
  it("reschedules after a simulated reboot (OS list empty, registry still scheduled)", async () => {
    const native = mockNative();
    const registry = createMemoryRegistry();
    const scheduler = createAlarmScheduler({
      platform: "android",
      registry,
      native,
      permission: () => "granted",
      timezone: () => "Africa/Lagos",
      capabilities: () => ({ ...webCaps(), platform: "android", exactAlarms: true, alarmManager: true, webPush: "unsupported" }),
    });
    await scheduler.sync([checkpoint()], settings(true), "rt_1");
    native.scheduled.clear();
    assert.equal(native.scheduleCalls, 1);
    await scheduler.sync([checkpoint()], settings(true), "rt_1");
    assert.equal(native.scheduled.size, 1);
    assert.equal(native.scheduleCalls, 2);
  });

  it("rescheduleAll force-schedules every enabled alarm", async () => {
    const native = mockNative();
    const scheduler = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native,
      permission: () => "granted",
      timezone: () => "UTC",
      capabilities: () => ({ ...webCaps(), platform: "android", exactAlarms: true, alarmManager: true, webPush: "unsupported" }),
    });
    const alarms = desiredAlarms({
      routineId: "rt_1",
      checkpoints: [checkpoint()],
      settings: settings(true),
      timezone: "UTC",
    });
    await scheduler.rescheduleAll(alarms);
    await scheduler.rescheduleAll(alarms);
    assert.equal(native.scheduleCalls, 2);
  });

  it("treats a timezone change as a new schedule", async () => {
    const native = mockNative();
    let timezone = "Africa/Lagos";
    const scheduler = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native,
      permission: () => "granted",
      timezone: () => timezone,
      capabilities: () => ({ ...webCaps(), platform: "android", exactAlarms: true, alarmManager: true, webPush: "unsupported" }),
    });
    await scheduler.sync([checkpoint()], settings(true), "rt_1");
    timezone = "America/New_York";
    await scheduler.sync([checkpoint()], settings(true), "rt_1");
    assert.equal(native.scheduleCalls, 2);
    assert.equal(scheduler.getScheduledAlarms()[0].timezone, "America/New_York");
  });

  it("app reinstall starts from an empty registry", async () => {
    const native = mockNative();
    const first = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native,
      permission: () => "granted",
      capabilities: () => ({ ...webCaps(), platform: "android", exactAlarms: true, alarmManager: true, webPush: "unsupported" }),
    });
    await first.sync([checkpoint()], settings(true), "rt_1");
    const reinstalled = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native: mockNative(),
      permission: () => "granted",
      capabilities: () => ({ ...webCaps(), platform: "android", exactAlarms: true, alarmManager: true, webPush: "unsupported" }),
    });
    assert.equal(reinstalled.getScheduledAlarms().length, 0);
    await reinstalled.sync([checkpoint()], settings(true), "rt_1");
    assert.equal(reinstalled.getScheduledAlarms().length, 1);
  });

  it("two devices derive independently from the same routine", async () => {
    const phone = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native: mockNative({ platform: "android" }),
      permission: () => "granted",
      capabilities: () => ({ ...webCaps(), platform: "android", exactAlarms: true, alarmManager: true, webPush: "unsupported" }),
    });
    const tablet = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native: mockNative({ platform: "android" }),
      permission: () => "granted",
      capabilities: () => ({ ...webCaps(), platform: "android", exactAlarms: true, alarmManager: true, webPush: "unsupported" }),
    });
    await phone.sync([checkpoint()], settings(true), "rt_1");
    await tablet.sync([checkpoint()], settings(true), "rt_1");
    assert.equal(phone.getScheduledAlarms()[0].alarmId, tablet.getScheduledAlarms()[0].alarmId);
    assert.equal(phone.getScheduledAlarms()[0].alarmId, "al_rt_1_cp_workout");
  });
});

describe("fallback", () => {
  it("native failure falls back to notifications, never scheduled", async () => {
    const native = mockNative({ failSchedule: true });
    const scheduler = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native,
      permission: () => "granted",
      capabilities: () => ({ ...webCaps(), platform: "android", exactAlarms: true, alarmManager: true, webPush: "unsupported" }),
    });
    const result = await scheduler.sync([checkpoint()], settings(true), "rt_1");
    assert.deepEqual(result.scheduledIds, []);
    assert.deepEqual(result.listeningIds, ["cp_workout"]);
    assert.equal(scheduler.getScheduledAlarms()[0].schedulingState, "fallback");
    assert.equal(scheduler.status(checkpoint(), settings(true), "granted"), "listening");
  });

  it("android without a bridge is listening, not scheduled", async () => {
    const scheduler = createAlarmScheduler({
      platform: "android",
      registry: createMemoryRegistry(),
      native: null,
      permission: () => "granted",
    });
    const result = await scheduler.sync([checkpoint()], settings(true), "rt_1");
    assert.deepEqual(result.scheduledIds, []);
    assert.equal(scheduler.status(checkpoint(), settings(true), "granted"), "listening");
  });
});

describe("copy and next occurrence", () => {
  it("never claims an alarm was added to the phone on web", () => {
    const copy = reminderUxCopy(webCaps(), "granted", true);
    assert.match(copy.body, /notification system/);
    assert.equal(copy.granted, "ROUTA notifications are enabled");
    assert.doesNotMatch(copy.body, /Alarm added to your phone/);
    assert.doesNotMatch(copy.granted ?? "", /Alarm added to your phone/);
    const denied = reminderUxCopy(webCaps(), "denied", false);
    assert.equal(denied.denied, "Reminders are disabled");
  });

  it("nextOccurrence stays in local time", () => {
    const now = new Date(2026, 8, 4, 5, 0, 0);
    const next = nextOccurrence(checkpoint(), now);
    assert.ok(next);
    assert.equal(next.getHours(), 6);
    assert.equal(next.getMinutes(), 0);
    assert.equal(next.getDay(), 5);
  });
});
