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
