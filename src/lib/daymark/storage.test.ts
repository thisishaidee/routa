import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySnapshot, clearSessionEntered, clearV2Storage, findCorruptSnapshotKeys, LEGACY_STORAGE_KEYS, loadSnapshot, SESSION_KEY, STORAGE_KEYS } from "./storage";
import type { DaymarkSnapshot } from "./types";

const snapshot: DaymarkSnapshot = {
  profile: { name: "ROUTA", focusAreas: ["study"], onboarded: true },
  routine: null,
  progress: { "2026-11-07": { completedCheckpointIds: ["cp_1"], completedTaskIds: {} } },
  notes: { "2026-11-07": "A note" },
  settings: { weekStartsOn: 1, remindersEnabled: true },
};

function memoryStorage(seed: Record<string, string> = {}, failKey?: string, failRemoveKey?: string): Storage {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key: string) { return values.get(key) ?? null; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    removeItem(key: string) { if (key === failRemoveKey) throw new Error("storage unavailable"); values.delete(key); },
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


describe("clear local data safety", () => {
  it("clears ROUTA data and legacy notes but leaves unrelated storage untouched", () => {
    const storage = memoryStorage({
      [STORAGE_KEYS.profile]: "profile",
      [STORAGE_KEYS.routine]: "routine",
      "routa:v2:alarms": "alarms",
      "daymark-note-2026-11-07": "legacy note",
      unrelated: "keep",
    });
    const result = withStorage(storage, () => clearV2Storage());
    assert.deepEqual(result, { ok: true });
    assert.equal(storage.getItem(STORAGE_KEYS.profile), null);
    assert.equal(storage.getItem("daymark-note-2026-11-07"), null);
    assert.equal(storage.getItem("unrelated"), "keep");
  });

  it("restores previously stored values when any removal fails", () => {
    const seed = {
      [STORAGE_KEYS.profile]: "profile",
      [STORAGE_KEYS.routine]: "routine",
      [STORAGE_KEYS.progress]: "progress",
    };
    const storage = memoryStorage(seed, undefined, STORAGE_KEYS.progress);
    const result = withStorage(storage, () => clearV2Storage());
    assert.equal(result.ok, false);
    for (const [key, value] of Object.entries(seed)) {
      assert.equal(storage.getItem(key), value, `preserves ${key}`);
    }
  });
});


describe("session reset safety", () => {
  it("clears both current and legacy session markers", () => {
    const values = new Map<string, string>([[SESSION_KEY, "1"], ["daymark:v2:entered", "1"]]);
    const session = {
      get length() { return values.size; },
      clear() { values.clear(); },
      getItem(key: string) { return values.get(key) ?? null; },
      key(index: number) { return [...values.keys()][index] ?? null; },
      removeItem(key: string) { values.delete(key); },
      setItem(key: string, value: string) { values.set(key, String(value)); },
    } as Storage;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: session });
    try {
      assert.equal(clearSessionEntered(), true);
      assert.equal(session.getItem(SESSION_KEY), null);
      assert.equal(session.getItem("daymark:v2:entered"), null);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "sessionStorage", descriptor);
      else Reflect.deleteProperty(globalThis, "sessionStorage");
    }
  });
});


describe("legacy key migration fallback", () => {
  it("loads existing legacy data if copying it to the current key fails", () => {
    const storage = memoryStorage({
      [LEGACY_STORAGE_KEYS.profile]: JSON.stringify({ name: "Legacy ROUTA", focusAreas: ["study"], onboarded: true }),
      [LEGACY_STORAGE_KEYS.settings]: JSON.stringify({ weekStartsOn: 0, remindersEnabled: true }),
    }, STORAGE_KEYS.profile);
    const loaded = withStorage(storage, () => loadSnapshot());
    assert.equal(loaded.profile.name, "Legacy ROUTA");
    assert.equal(loaded.settings.weekStartsOn, 0);
    assert.equal(loaded.settings.remindersEnabled, true);
  });
});


describe("corrupt local snapshot detection", () => {
  it("identifies malformed JSON without modifying the original record", () => {
    const damaged = "{not valid json";
    const storage = memoryStorage({ [STORAGE_KEYS.progress]: damaged });
    const result = withStorage(storage, () => findCorruptSnapshotKeys());
    assert.deepEqual(result, ["progress"]);
    assert.equal(storage.getItem(STORAGE_KEYS.progress), damaged);
  });

  it("identifies structurally invalid snapshot records", () => {
    const storage = memoryStorage({
      [STORAGE_KEYS.profile]: JSON.stringify([]),
      [STORAGE_KEYS.routine]: JSON.stringify({ name: "Broken routine" }),
      [STORAGE_KEYS.settings]: JSON.stringify({ weekStartsOn: 1, remindersEnabled: true }),
    });
    const result = withStorage(storage, () => findCorruptSnapshotKeys());
    assert.deepEqual(result, ["profile", "routine"]);
  });

  it("accepts a valid empty routine and ignores absent records", () => {
    const storage = memoryStorage({
      [STORAGE_KEYS.routine]: JSON.stringify(null),
      [STORAGE_KEYS.profile]: JSON.stringify({ name: "", focusAreas: [], onboarded: false }),
    });
    const result = withStorage(storage, () => findCorruptSnapshotKeys());
    assert.deepEqual(result, []);
  });
});
