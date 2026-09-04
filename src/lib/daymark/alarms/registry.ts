import type { WeekDay } from "../types";
import type { AlarmPlatform, AlarmRecord, AlarmRegistry, SchedulingState } from "./types";
import { sortedDays } from "./policy";

export const ALARMS_KEY = "routa:v2:alarms";

const STATES: SchedulingState[] = [
  "pending",
  "listening",
  "scheduled",
  "fallback",
  "permission-denied",
  "unsupported",
  "cancelled",
  "failed",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function coerceRecurrence(value: unknown): WeekDay[] {
  if (!Array.isArray(value)) return [];
  return sortedDays(
    value
      .map((item) => Number(item))
      .filter((item): item is WeekDay => Number.isInteger(item) && item >= 0 && item <= 6),
  );
}

function coerceState(value: unknown): SchedulingState {
  return STATES.includes(value as SchedulingState) ? (value as SchedulingState) : "pending";
}

function coercePlatform(value: unknown): AlarmPlatform {
  if (value === "android" || value === "ios" || value === "web") return value;
  return "web";
}

export function coerceAlarmRecord(value: unknown): AlarmRecord | null {
  if (!isRecord(value)) return null;
  const alarmId = asString(value.alarmId);
  const checkpointId = asString(value.checkpointId);
  const time = asString(value.time);
  if (!alarmId || !checkpointId || !time) return null;
  const record: AlarmRecord = {
    alarmId,
    routineId: asString(value.routineId, "routine_default"),
    checkpointId,
    time,
    recurrence: coerceRecurrence(value.recurrence),
    enabled: asBoolean(value.enabled, false),
    platform: coercePlatform(value.platform),
    schedulingState: coerceState(value.schedulingState),
    lastSyncAt: asString(value.lastSyncAt) || new Date().toISOString(),
    timezone: asString(value.timezone, "local"),
  };
  const title = asString(value.title);
  if (title) record.title = title;
  const handle = asString(value.nativeHandle);
  const error = asString(value.lastError);
  if (handle) record.nativeHandle = handle;
  if (error) record.lastError = error;
  return record;
}

export function createMemoryRegistry(initial: AlarmRecord[] = []): AlarmRegistry {
  let records = initial.map((item) => ({ ...item, recurrence: [...item.recurrence] }));
  return {
    read() {
      return records.map((item) => ({ ...item, recurrence: [...item.recurrence] }));
    },
    write(next) {
      records = next.map((item) => ({ ...item, recurrence: [...item.recurrence] }));
    },
    clear() {
      records = [];
    },
  };
}

export function createLocalRegistry(): AlarmRegistry {
  return {
    read() {
      try {
        if (typeof localStorage === "undefined") return [];
        const raw = localStorage.getItem(ALARMS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.map(coerceAlarmRecord).filter((item): item is AlarmRecord => item !== null);
      } catch {
        return [];
      }
    },
    write(records) {
      try {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(ALARMS_KEY, JSON.stringify(records));
      } catch {
        /* ignore */
      }
    },
    clear() {
      try {
        if (typeof localStorage === "undefined") return;
        localStorage.removeItem(ALARMS_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}

const localRegistry = createLocalRegistry();

export function readAlarmRegistry() {
  return localRegistry.read();
}

export function writeAlarmRegistry(records: AlarmRecord[]) {
  localRegistry.write(records);
}

export function clearAlarmRegistry() {
  localRegistry.clear();
}
