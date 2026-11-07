import { SNAPSHOT_VERSION, type DaymarkSnapshot, type RoutaBackup } from "./types";
import { coerceSnapshot, loadSnapshot } from "./storage";
import { coerceCheckIns, type CheckInState } from "./checkins";
import { coerceRecovery, type RecoveryState } from "./recovery";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const SNAPSHOT_FIELDS = ["profile", "routine", "progress", "notes", "settings"] as const;

const DATE_KEY = /^\\d{4}-\\d{2}-\\d{2}$/;
const TIME_VALUE = /^(?:[01]\\d|2[0-3]):[0-5]\\d$/;

function validStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validSnapshotSection(field: (typeof SNAPSHOT_FIELDS)[number], value: unknown): boolean {
  if (field === "routine") {
    if (value === null) return true;
    if (!isRecord(value) || !Array.isArray(value.checkpoints)) return false;
    return value.checkpoints.every((checkpoint) => {
      if (!isRecord(checkpoint) || typeof checkpoint.title !== "string" || !checkpoint.title.trim()
        || typeof checkpoint.time !== "string" || !TIME_VALUE.test(checkpoint.time)) return false;
      if (checkpoint.tasks !== undefined && (!Array.isArray(checkpoint.tasks) || !checkpoint.tasks.every((task) =>
        (typeof task === "string" && task.trim().length > 0)
        || (isRecord(task) && typeof task.title === "string" && task.title.trim().length > 0
          && (task.id === undefined || typeof task.id === "string"))))) return false;
      if (checkpoint.repeatDays !== undefined && (!Array.isArray(checkpoint.repeatDays)
        || !checkpoint.repeatDays.every((day) => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6))) return false;
      for (const key of ["enabled", "reminderEnabled"] as const) {
        if (checkpoint[key] !== undefined && typeof checkpoint[key] !== "boolean") return false;
      }
      return true;
    });
  }

  if (!isRecord(value)) return false;
  if (field === "profile") {
    return (value.name === undefined || typeof value.name === "string")
      && (value.onboarded === undefined || typeof value.onboarded === "boolean")
      && (value.focusAreas === undefined || validStringArray(value.focusAreas));
  }
  if (field === "progress") {
    return Object.entries(value).every(([date, entry]) => DATE_KEY.test(date) && isRecord(entry)
      && (entry.completedCheckpointIds === undefined || validStringArray(entry.completedCheckpointIds))
      && (entry.completedTaskIds === undefined || (isRecord(entry.completedTaskIds)
        && Object.values(entry.completedTaskIds).every(validStringArray))));
  }
  if (field === "notes") {
    return Object.entries(value).every(([date, note]) => DATE_KEY.test(date) && typeof note === "string");
  }
  return (value.weekStartsOn === undefined || value.weekStartsOn === 0 || value.weekStartsOn === 1)
    && (value.remindersEnabled === undefined || typeof value.remindersEnabled === "boolean");
}

function validDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function validCheckIns(value: unknown): value is CheckInState {
  if (!isRecord(value) || !Array.isArray(value.checkIns) || !Array.isArray(value.badges)) return false;
  const validBadgeIds = new Set([
    "first-check-in", "first-routine-completed", "check-in-streak-3",
    "consistency-7", "milestone-30", "first-full-day",
  ]);
  return value.checkIns.every((item) => isRecord(item)
      && validDateKey(item.date)
      && (item.startedAt === undefined || validTimestamp(item.startedAt))
      && (item.closedAt === undefined || validTimestamp(item.closedAt))
      && (item.startedAt !== undefined || item.closedAt !== undefined))
    && value.badges.every((item) => isRecord(item)
      && typeof item.id === "string" && validBadgeIds.has(item.id)
      && validDateKey(item.earnedOn) && validTimestamp(item.earnedAt));
}

function validRecovery(value: unknown): value is RecoveryState {
  if (!isRecord(value) || !Array.isArray(value.moves) || !Array.isArray(value.dismissed)) return false;
  return value.moves.every((item) => isRecord(item)
      && typeof item.routineId === "string" && item.routineId.length > 0
      && validDateKey(item.date)
      && typeof item.checkpointId === "string" && item.checkpointId.length > 0
      && typeof item.fromTime === "string" && TIME_VALUE.test(item.fromTime)
      && typeof item.time === "string" && TIME_VALUE.test(item.time)
      && validTimestamp(item.createdAt))
    && value.dismissed.every((item) => isRecord(item)
      && validDateKey(item.date)
      && typeof item.checkpointId === "string" && item.checkpointId.length > 0);
}

export interface BackupExtras {
  checkIns?: CheckInState;
  recovery?: RecoveryState;
}

export function buildBackup(
  snapshot: DaymarkSnapshot,
  exportedAt = new Date().toISOString(),
  extras: BackupExtras = {},
): RoutaBackup {
  return {
    app: "routa",
    version: SNAPSHOT_VERSION,
    exportedAt,
    snapshot,
    ...(extras.checkIns ? { checkIns: extras.checkIns } : {}),
    ...(extras.recovery ? { recovery: extras.recovery } : {}),
  };
}

export function snapshotToJson(snapshot: DaymarkSnapshot, extras: BackupExtras = {}) {
  return `${JSON.stringify(buildBackup(snapshot, new Date().toISOString(), extras), null, 2)}\n`;
}

export function parseBackup(raw: string): {
  ok: true;
  snapshot: DaymarkSnapshot;
  checkIns?: CheckInState;
  recovery?: RecoveryState;
} | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }

  if (!isRecord(parsed)) return { ok: false, error: "That backup is empty." };

  const app = parsed.app;
  if (app !== undefined && app !== "routa" && app !== "daymark") {
    return { ok: false, error: "That file is not a Routa backup." };
  }

  if (parsed.version !== undefined) {
    if (typeof parsed.version !== "number" || !Number.isInteger(parsed.version) || parsed.version < 1) {
      return { ok: false, error: "That backup has an invalid version." };
    }
    if (parsed.version > SNAPSHOT_VERSION) {
      return { ok: false, error: "That backup is from a newer Routa. Update the app, then import again." };
    }
  }

  const hasWrappedSnapshot = Object.prototype.hasOwnProperty.call(parsed, "snapshot");
  if (hasWrappedSnapshot && !isRecord(parsed.snapshot)) {
    return { ok: false, error: "The snapshot in that backup could not be read." };
  }

  const nested = hasWrappedSnapshot ? parsed.snapshot as Record<string, unknown> : parsed;
  const hasSnapshotData = SNAPSHOT_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(nested, field),
  );
  if (!hasSnapshotData) {
    return { ok: false, error: "This file does not contain ROUTA backup data." };
  }

  // Validate supplied sections before coercion so malformed nested records cannot disappear silently.
  for (const field of SNAPSHOT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(nested, field) && !validSnapshotSection(field, nested[field])) {
      return { ok: false, error: `The ${field} data in that backup could not be read.` };
    }
  }

  const snapshot = coerceSnapshot(nested);

  if (parsed.checkIns !== undefined && !validCheckIns(parsed.checkIns)) {
    return { ok: false, error: "The check-in history in that backup could not be read." };
  }
  if (parsed.recovery !== undefined && !validRecovery(parsed.recovery)) {
    return { ok: false, error: "The recovery history in that backup could not be read." };
  }

  return {
    ok: true,
    snapshot,
    ...(parsed.checkIns !== undefined ? { checkIns: coerceCheckIns(parsed.checkIns) } : {}),
    ...(parsed.recovery !== undefined ? { recovery: coerceRecovery(parsed.recovery) } : {}),
  };
}

export function currentSnapshotJson(extras: BackupExtras = {}) {
  return snapshotToJson(loadSnapshot(), extras);
}

export function backupFilename(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  return `routa-backup-${stamp}.json`;
}
