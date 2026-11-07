import { SNAPSHOT_VERSION, type DaymarkSnapshot, type RoutaBackup } from "./types";
import { coerceSnapshot, loadSnapshot } from "./storage";
import { coerceCheckIns, type CheckInState } from "./checkins";
import { coerceRecovery, type RecoveryState } from "./recovery";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const SNAPSHOT_FIELDS = ["profile", "routine", "progress", "notes", "settings"] as const;

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
  return `${JSON.stringify(buildBackup(snapshot, new Date().toISOString(), extras), null, 2)}\\n`;
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

  const snapshot = coerceSnapshot(nested);
  if (Object.prototype.hasOwnProperty.call(nested, "routine") && nested.routine !== null && !snapshot.routine) {
    return { ok: false, error: "The routine in that backup could not be read." };
  }

  if (parsed.checkIns !== undefined && !isRecord(parsed.checkIns)) {
    return { ok: false, error: "The check-in history in that backup could not be read." };
  }
  if (parsed.recovery !== undefined && !isRecord(parsed.recovery)) {
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
