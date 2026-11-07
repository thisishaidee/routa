import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALARMS_KEY, createLocalRegistry } from "./registry";
import type { AlarmRecord } from "./types";

const record: AlarmRecord = {
  alarmId: "al_routine_cp",
  routineId: "routine",
  checkpointId: "cp",
  time: "08:00",
  recurrence: [1, 2, 3],
  enabled: true,
  platform: "web",
  schedulingState: "listening",
  lastSyncAt: "2026-11-07T08:00:00.000Z",
  timezone: "Africa/Lagos",
};

function withStorage<T>(storage: Storage, run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

function storage(options: { failWrite?: boolean; failRemove?: boolean } = {}): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key) { return values.get(key) ?? null; },
    key(index) { return [...values.keys()][index] ?? null; },
    setItem(key, value) { if (options.failWrite) throw new Error("quota exceeded"); values.set(key, String(value)); },
    removeItem(key) { if (options.failRemove) throw new Error("storage unavailable"); values.delete(key); },
  } as Storage;
}

describe("local alarm registry", () => {
  it("verifies successful writes and clear operations", () => {
    const deviceStorage = storage();
    withStorage(deviceStorage, () => {
      const registry = createLocalRegistry();
      assert.equal(registry.write([record]), true);
      assert.equal(registry.read()[0]?.alarmId, record.alarmId);
      assert.equal(registry.clear(), true);
      assert.equal(deviceStorage.getItem(ALARMS_KEY), null);
    });
  });

  it("reports write and clear failures instead of silently succeeding", () => {
    withStorage(storage({ failWrite: true, failRemove: true }), () => {
      const registry = createLocalRegistry();
      assert.equal(registry.write([record]), false);
      assert.equal(registry.read()[0]?.alarmId, record.alarmId, "failed persistence keeps runtime scheduling state available");
      assert.equal(registry.clear(), false);
    });
  });
});
