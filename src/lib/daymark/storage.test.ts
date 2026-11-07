import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySnapshot, STORAGE_KEYS } from "./storage";
import type { DaymarkSnapshot } from "./types";

const snapshot: DaymarkSnapshot = {
  profile: { name: "ROUTA", focusAreas: ["study"], onboarded: true },
  routine: null,
  progress: { "2026-11-07": { completedCheckpointIds: ["cp_1"], completedTaskIds: {} } },
  notes: { "2026-11-07": "A note" },
  settings: { weekStartsOn: 1, remindersEnabled: true },
};

function memoryStorage(seed: Record<string, string> = {}, failKey?: string): Storage {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key: string) { return values.get(key) ?? null; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    removeItem(key: string) { values.delete(key); },
    setItem(key: string, value: string) {
      if (key === failKey && value !== "previous-progress") throw new Error("quota exceeded");
      values.set(key, String(value));
    },
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

describe("snapshot persistence", () => {
  it("writes and verifies the complete snapshot", () => {
    const storage = memoryStorage();
    const result = withStorage(storage, () => applySnapshot(snapshot));
    assert.deepEqual(result, { ok: true });
    assert.equal(storage.getItem(STORAGE_KEYS.profile), JSON.stringify(snapshot.profile));
    assert.equal(storage.getItem(STORAGE_KEYS.settings), JSON.stringify(snapshot.settings));
  });

  it("rolls back earlier writes when a later storage write fails", () => {
    const seed = Object.fromEntries(Object.values(STORAGE_KEYS).map((key) => [key, `previous:${key}`]));
    seed[STORAGE_KEYS.progress] = "previous-progress";
    const storage = memoryStorage(seed, STORAGE_KEYS.progress);
    const result = withStorage(storage, () => applySnapshot(snapshot));
    assert.equal(result.ok, false);
    for (const key of Object.values(STORAGE_KEYS)) {
      assert.equal(storage.getItem(key), seed[key], `preserves ${key}`);
    }
  });
});


describe("complete backup restore persistence", () => {
  const checkIns = {
    checkIns: [{ date: "2026-11-07", startedAt: "2026-11-07T07:00:00.000Z" }],
    badges: [{
      id: "first-check-in" as const,
      earnedOn: "2026-11-07",
      earnedAt: "2026-11-07T07:00:00.000Z",
    }],
  };
  const recovery = {
    moves: [{
      routineId: "routine_default",
      date: "2026-11-07",
      checkpointId: "cp_1",
      fromTime: "08:00",
      time: "09:00",
      createdAt: "2026-11-07T08:00:00.000Z",
    }],
    dismissed: [{ date: "2026-11-07", checkpointId: "cp_2" }],
  };

  it("persists check-ins, earned badges, and recovery history with the snapshot", async () => {
    const { CHECKIN_KEY } = await import("./checkins");
    const { RECOVERY_KEY } = await import("./recovery");
    const storage = memoryStorage();
    const result = withStorage(storage, () => applySnapshot(snapshot, { checkIns, recovery }));
    assert.deepEqual(result, { ok: true });
    assert.equal(storage.getItem(CHECKIN_KEY), JSON.stringify(checkIns));
    assert.equal(storage.getItem(RECOVERY_KEY), JSON.stringify(recovery));
  });

  it("rolls back history too if a later restore write fails", async () => {
    const { CHECKIN_KEY } = await import("./checkins");
    const { RECOVERY_KEY } = await import("./recovery");
    const seed = {
      [CHECKIN_KEY]: "previous-checkins",
      [RECOVERY_KEY]: "previous-recovery",
      [STORAGE_KEYS.profile]: "previous-profile",
      [STORAGE_KEYS.routine]: "previous-routine",
      [STORAGE_KEYS.progress]: "previous-progress",
      [STORAGE_KEYS.notes]: "previous-notes",
      [STORAGE_KEYS.settings]: "previous-settings",
    };
    const storage = memoryStorage(seed, RECOVERY_KEY);
    const result = withStorage(storage, () => applySnapshot(snapshot, { checkIns, recovery }));
    assert.equal(result.ok, false);
    for (const [key, value] of Object.entries(seed)) {
      assert.equal(storage.getItem(key), value, `preserves ${key}`);
    }
  });
});
