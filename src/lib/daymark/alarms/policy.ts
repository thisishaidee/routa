import type { AlarmStatus, Checkpoint, ReminderPermission, Settings, WeekDay } from "../types";
import { mondayIndex, pad, todayKey } from "../time";
import type { DesiredAlarm, DueReminder, ReminderPolicyInput, SchedulingState } from "./types";

export function alarmIdFor(routineId: string, checkpointId: string) {
  return `al_${routineId}_${checkpointId}`;
}

export function alarmKey(date: Date, checkpointId: string) {
  return `routa:v2:alarm:${todayKey(date)}:${checkpointId}`;
}

function legacyAlarmKey(date: Date, checkpointId: string) {
  return `daymark:v2:alarm:${todayKey(date)}:${checkpointId}`;
}

export function alreadyFired(date: Date, checkpointId: string) {
  const key = alarmKey(date, checkpointId);
  const legacy = legacyAlarmKey(date, checkpointId);
  try {
    return sessionStorage.getItem(key) === "1" || sessionStorage.getItem(legacy) === "1";
  } catch {
    return false;
  }
}

export function markFired(date: Date, checkpointId: string) {
  try {
    sessionStorage.setItem(alarmKey(date, checkpointId), "1");
  } catch {
    /* ignore */
  }
}

export function isReminderEligible(checkpoint: Checkpoint, settings: Settings, at: Date) {
  if (!settings.remindersEnabled) return false;
  if (!checkpoint.enabled || !checkpoint.reminderEnabled) return false;
  return checkpoint.repeatDays.includes(mondayIndex(at));
}

/** Pure: which checkpoints are due at this local minute. */
export function dueNow(input: ReminderPolicyInput): DueReminder[] {
  if (!input.settings.remindersEnabled) return [];
  if (input.permission !== "granted") return [];
  const stamp = `${pad(input.at.getHours())}:${pad(input.at.getMinutes())}`;
  const due: DueReminder[] = [];
  for (const checkpoint of input.checkpoints) {
    if (!isReminderEligible(checkpoint, input.settings, input.at)) continue;
    if (checkpoint.time !== stamp) continue;
    due.push({ checkpoint, key: alarmKey(input.at, checkpoint.id) });
  }
  return due;
}

export function shouldScheduleCheckpoint(checkpoint: Checkpoint, settings: Settings) {
  return Boolean(settings.remindersEnabled && checkpoint.enabled && checkpoint.reminderEnabled);
}

export function desiredAlarms(input: {
  routineId: string;
  checkpoints: Checkpoint[];
  settings: Settings;
  timezone: string;
}): DesiredAlarm[] {
  return input.checkpoints.map((checkpoint) => ({
    alarmId: alarmIdFor(input.routineId, checkpoint.id),
    routineId: input.routineId,
    checkpointId: checkpoint.id,
    title: checkpoint.title,
    time: checkpoint.time,
    recurrence: sortedDays(checkpoint.repeatDays),
    enabled: shouldScheduleCheckpoint(checkpoint, input.settings),
    timezone: input.timezone,
  }));
}

export function sortedDays(days: WeekDay[]): WeekDay[] {
  return [...new Set(days)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b) as WeekDay[];
}

export function alarmFingerprint(alarm: {
  time: string;
  recurrence: WeekDay[];
  enabled: boolean;
  timezone: string;
  title?: string;
}) {
  const days = sortedDays(alarm.recurrence).join(",");
  const title = alarm.title ?? "";
  return `${alarm.time}|${days}|${alarm.enabled ? 1 : 0}|${alarm.timezone}|${title}`;
}

export function splitTime(hhmm: string): { hour: number; minute: number } {
  const [hour, minute] = hhmm.split(":").map(Number);
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

export function classifyAlarmStatus(
  checkpoint: Checkpoint,
  settings: Settings,
  permission: ReminderPermission,
  canExact: boolean,
): AlarmStatus {
  if (!checkpoint.enabled || !checkpoint.reminderEnabled) return "off";
  if (permission === "unsupported") return "unsupported";
  if (permission === "denied") return "permission-denied";
  if (!settings.remindersEnabled) return "off";
  if (permission !== "granted") return "permission-required";
  return canExact ? "scheduled" : "listening";
}

export function stateToStatus(state: SchedulingState, canExact: boolean): AlarmStatus {
  switch (state) {
    case "scheduled":
      return canExact ? "scheduled" : "listening";
    case "listening":
    case "fallback":
      return "listening";
    case "permission-denied":
      return "permission-denied";
    case "unsupported":
      return "unsupported";
    case "pending":
      return "permission-required";
    case "cancelled":
    case "failed":
      return "off";
  }
}

export function alarmStatusLabel(status: AlarmStatus) {
  switch (status) {
    case "unsupported":
      return "Unsupported";
    case "permission-required":
      return "Permission required";
    case "permission-denied":
      return "Permission denied";
    case "off":
      return "Off";
    case "listening":
      return "On while open";
    case "scheduled":
      return "Scheduled";
  }
}
