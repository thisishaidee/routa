import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBackup, snapshotToJson } from "./backup";
import { SNAPSHOT_VERSION, type DaymarkSnapshot } from "./types";

const snapshot: DaymarkSnapshot = {
  profile: { name: "Haidee", focusAreas: ["study"], onboarded: true },
  routine: null,
  progress: {},
  notes: {},
  settings: { weekStartsOn: 1, remindersEnabled: false },
};

describe("ROUTA backup validation", () => {
  it("round-trips a current ROUTA backup", () => {
    const result = parseBackup(snapshotToJson(snapshot));
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.snapshot, snapshot);
  });

  it("rejects an empty object instead of replacing user data with defaults", () => {
    const result = parseBackup("{}");
    assert.equal(result.ok, false);
  });

  it("rejects unrelated JSON objects", () => {
    const result = parseBackup(JSON.stringify({ name: "not a backup", data: [] }));
    assert.equal(result.ok, false);
  });

  it("rejects a snapshot field with the wrong shape", () => {
    const result = parseBackup(JSON.stringify({ app: "routa", version: SNAPSHOT_VERSION, snapshot: [] }));
    assert.equal(result.ok, false);
  });

  it("rejects an invalid version", () => {
    const result = parseBackup(JSON.stringify({ app: "routa", version: "four", snapshot }));
    assert.equal(result.ok, false);
  });

  it("rejects a backup from a newer version", () => {
    const result = parseBackup(JSON.stringify({ app: "routa", version: SNAPSHOT_VERSION + 1, snapshot }));
    assert.equal(result.ok, false);
  });

  it("keeps compatibility with a legacy unwrapped snapshot", () => {
    const result = parseBackup(JSON.stringify(snapshot));
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.snapshot, snapshot);
  });

  it("rejects a malformed non-null routine", () => {
    const result = parseBackup(JSON.stringify({
      app: "routa",
      version: SNAPSHOT_VERSION,
      snapshot: { ...snapshot, routine: { checkpoints: "not-an-array" } },
    }));
    assert.equal(result.ok, false);
  });
});


describe("complete ROUTA backup data", () => {
  it("preserves check-ins, badges, and recovery records", () => {
    const checkIns = {
      checkIns: [{ date: "2026-11-07", startedAt: "2026-11-07T07:00:00.000Z", closedAt: undefined }],
      badges: [{ id: "first-check-in" as const, earnedOn: "2026-11-07", earnedAt: "2026-11-07T07:00:00.000Z" }],
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
    const result = parseBackup(snapshotToJson(snapshot, { checkIns, recovery }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.checkIns, checkIns);
      assert.deepEqual(result.recovery, recovery);
    }
  });

  it("keeps older backups valid without inventing missing history", () => {
    const result = parseBackup(JSON.stringify({ app: "routa", version: 4, snapshot }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.checkIns, undefined);
      assert.equal(result.recovery, undefined);
    }
  });

  it("rejects malformed optional history containers", () => {
    const result = parseBackup(JSON.stringify({
      app: "routa",
      version: 5,
      snapshot,
      checkIns: [],
    }));
    assert.equal(result.ok, false);
  });

  it("rejects malformed progress instead of silently importing an empty history", () => {
    const result = parseBackup(JSON.stringify({
      app: "routa", version: SNAPSHOT_VERSION,
      snapshot: { ...snapshot, progress: [] },
    }));
    assert.equal(result.ok, false);
  });

  it("rejects malformed notes and settings sections", () => {
    for (const [field, value] of [["notes", null], ["settings", "dark"]] as const) {
      const result = parseBackup(JSON.stringify({
        app: "routa", version: SNAPSHOT_VERSION,
        snapshot: { ...snapshot, [field]: value },
      }));
      assert.equal(result.ok, false);
    }
  });

  it("rejects malformed nested progress entries instead of dropping completed work", () => {
    const result = parseBackup(JSON.stringify({
      app: "routa", version: SNAPSHOT_VERSION,
      snapshot: { ...snapshot, progress: { "2026-11-07": { completedCheckpointIds: "done" } } },
    }));
    assert.equal(result.ok, false);
  });

  it("rejects non-string note values instead of silently omitting notes", () => {
    const result = parseBackup(JSON.stringify({
      app: "routa", version: SNAPSHOT_VERSION,
      snapshot: { ...snapshot, notes: { "2026-11-07": 42 } },
    }));
    assert.equal(result.ok, false);
  });

  it("rejects malformed task entries inside otherwise valid checkpoints", () => {
    const result = parseBackup(JSON.stringify({
      app: "routa", version: SNAPSHOT_VERSION,
      snapshot: {
        ...snapshot,
        routine: {
          id: "routine_1", name: "My routine",
          checkpoints: [{ id: "cp_1", title: "Study", time: "08:00", tasks: [{ title: "" }] }],
        },
      },
    }));
    assert.equal(result.ok, false);
  });

  it("rejects a routine when one or more checkpoints cannot be parsed", () => {
    const result = parseBackup(JSON.stringify({
      app: "routa", version: SNAPSHOT_VERSION,
      snapshot: {
        ...snapshot,
        routine: {
          id: "routine_1", name: "My routine", checkpoints: [{ title: "", time: "bad-time" }],
        },
      },
    }));
    assert.equal(result.ok, false);
  });

});