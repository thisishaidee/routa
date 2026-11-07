import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateV1IfNeeded } from "./migration";
import { loadSnapshot, STORAGE_KEYS } from "./storage";

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key: string) { return values.get(key) ?? null; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    removeItem(key: string) { values.delete(key); },
    setItem(key: string, value: string) { values.set(key, String(value)); },
  } as Storage;
}

function withStorage<T>(storage: Storage, run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try {
    return run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

describe("legacy V1 migration", () => {
  it("restores completed checkpoints, tasks, notes, and reminder settings", () => {
    const date = "2026-11-07";
    const storage = memoryStorage({
      "daymark-done": JSON.stringify({ [`${date}-0`]: true }),
      "daymark-tasks": JSON.stringify({ [`${date}-0-0`]: true }),
      "daymark-alarms": "on",
      [`daymark-note-${date}`]: "Legacy note",
    });

    const result = withStorage(storage, () => {
      const migrated = migrateV1IfNeeded();
      return { migrated, snapshot: loadSnapshot() };
    });

    assert.equal(result.migrated, true);
    assert.ok(result.snapshot.routine);
    const firstCheckpoint = result.snapshot.routine!.checkpoints[0];
    assert.ok(result.snapshot.progress[date].completedCheckpointIds.includes(firstCheckpoint.id));
    assert.ok(result.snapshot.progress[date].completedTaskIds[firstCheckpoint.id].includes(firstCheckpoint.tasks[0].id));
    assert.equal(result.snapshot.notes[date], "Legacy note");
    assert.equal(result.snapshot.settings.remindersEnabled, true);
    assert.ok(storage.getItem(STORAGE_KEYS.routine));
  });
});


describe("legacy migration protection", () => {
  it("does not overwrite partial current data when legacy V1 keys also exist", () => {
    const existingProgress = JSON.stringify({ "2026-11-07": { completedCheckpointIds: ["keep-me"], completedTaskIds: {} } });
    const storage = memoryStorage({
      "daymark-done": JSON.stringify({ "2026-11-07-0": true }),
      "routa:v2:progress": existingProgress,
    });
    const result = withStorage(storage, () => {
      const migrated = migrateV1IfNeeded();
      return { migrated, progress: storage.getItem("routa:v2:progress"), routine: storage.getItem("routa:v2:routine") };
    });
    assert.equal(result.migrated, false);
    assert.equal(result.progress, existingProgress);
    assert.equal(result.routine, null);
  });
});
