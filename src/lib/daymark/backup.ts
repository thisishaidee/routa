import { SNAPSHOT_VERSION, type DaymarkSnapshot, type RoutaBackup } from "./types";
import { coerceSnapshot, loadSnapshot } from "./storage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildBackup(
  snapshot: DaymarkSnapshot,
  exportedAt = new Date().toISOString(),
): RoutaBackup {
  return {
    app: "routa",
    version: SNAPSHOT_VERSION,
    exportedAt,
    snapshot,
  };
}

export function snapshotToJson(snapshot: DaymarkSnapshot) {
  return `${JSON.stringify(buildBackup(snapshot), null, 2)}\n`;
}

export function parseBackup(raw: string): { ok: true; snapshot: DaymarkSnapshot } | { ok: false; error: string } {
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

  const version = typeof parsed.version === "number" ? parsed.version : 2;
  if (version > SNAPSHOT_VERSION) {
    return { ok: false, error: "That backup is from a newer Routa. Update the app, then import again." };
  }

  const nested = isRecord(parsed.snapshot) ? parsed.snapshot : parsed;
  const snapshot = coerceSnapshot(nested);
  if (nested.routine && !snapshot.routine) {
    return { ok: false, error: "The routine in that backup could not be read." };
  }

  return { ok: true, snapshot };
}

export function currentSnapshotJson() {
  return snapshotToJson(loadSnapshot());
}

export function backupFilename(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  return `routa-backup-${stamp}.json`;
}
