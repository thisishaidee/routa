import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasStartedInDay, liveCheckpointId } from "./time.ts";
import type { Checkpoint } from "./types.ts";

function checkpoint(id: string, time: string): Checkpoint {
  return {
    id,
    time,
    title: id,
    icon: "target",
    tasks: [],
    enabled: true,
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    reminderEnabled: false,
  };
}

const at = (hour: number, minute: number) => new Date(2026, 9, 28, hour, minute);
const day = [checkpoint("work", "06:00"), checkpoint("build", "07:45"), checkpoint("review", "21:30")];

describe("liveCheckpointId", () => {
  it("returns null when nothing is scheduled", () => {
    assert.equal(liveCheckpointId([], at(10, 0)), null);
  });

  it("follows the day in order", () => {
    assert.equal(liveCheckpointId(day, at(6, 0)), "work");
    assert.equal(liveCheckpointId(day, at(10, 0)), "build");
    assert.equal(liveCheckpointId(day, at(21, 30)), "review");
    assert.equal(liveCheckpointId(day, at(23, 59)), "review");
  });

  it("keeps a midnight checkpoint at the end of the day", () => {
    const list = [...day, checkpoint("night", "00:00")];
    assert.equal(liveCheckpointId(list, at(10, 0)), "build");
    assert.equal(liveCheckpointId(list, at(0, 5)), "night");
  });

  it("keeps a 00:30 checkpoint at the end of the day, not the start", () => {
    const list = [...day, checkpoint("night", "00:30")];
    assert.equal(liveCheckpointId(list, at(10, 0)), "build");
    assert.equal(liveCheckpointId(list, at(15, 0)), "build");
    assert.equal(liveCheckpointId(list, at(23, 0)), "review");
  });

  it("marks an after-midnight checkpoint as now once its time has passed", () => {
    const list = [...day, checkpoint("night", "00:30")];
    assert.equal(liveCheckpointId(list, at(0, 40)), "night");
    assert.equal(liveCheckpointId(list, at(4, 59)), "night");
  });

  it("returns the last checkpoint before the first one of the day starts", () => {
    const list = [...day, checkpoint("night", "01:00")];
    assert.equal(liveCheckpointId(list, at(5, 30)), "night");
    assert.equal(liveCheckpointId(day, at(5, 30)), "review");
  });

  it("handles several after-midnight checkpoints in order", () => {
    const list = [...day, checkpoint("late", "00:30"), checkpoint("later", "02:00")];
    assert.equal(liveCheckpointId(list, at(1, 0)), "late");
    assert.equal(liveCheckpointId(list, at(2, 30)), "later");
    assert.equal(liveCheckpointId(list, at(12, 0)), "build");
  });
});

describe("hasStartedInDay", () => {
  it("only counts after-midnight checkpoints that have passed between 00:00 and 04:59", () => {
    assert.equal(hasStartedInDay("00:00", at(0, 5)), true);
    assert.equal(hasStartedInDay("00:30", at(0, 5)), false);
    assert.equal(hasStartedInDay("00:30", at(0, 40)), true);
    assert.equal(hasStartedInDay("02:00", at(4, 59)), true);
    assert.equal(hasStartedInDay("06:00", at(0, 5)), false);
    assert.equal(hasStartedInDay("21:30", at(4, 59)), false);
  });

  it("keeps after-midnight checkpoints at the end of the day from 05:00 on", () => {
    assert.equal(hasStartedInDay("00:00", at(5, 0)), false);
    assert.equal(hasStartedInDay("00:30", at(10, 0)), false);
    assert.equal(hasStartedInDay("00:30", at(23, 59)), false);
  });

  it("follows the clock through the day", () => {
    assert.equal(hasStartedInDay("06:00", at(5, 59)), false);
    assert.equal(hasStartedInDay("06:00", at(6, 0)), true);
    assert.equal(hasStartedInDay("21:30", at(21, 29)), false);
    assert.equal(hasStartedInDay("21:30", at(23, 59)), true);
  });
});
