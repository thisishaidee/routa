import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeStats, computeStreaks } from "./progress.ts";
import type { Checkpoint, ProgressMap, Routine } from "./types.ts";

function checkpoint(patch: Partial<Checkpoint> & Pick<Checkpoint, "id" | "time" | "title">): Checkpoint {
  return {
    icon: "target",
    tasks: [],
    enabled: true,
    repeatDays: [0, 1, 2, 3, 4],
    reminderEnabled: true,
    ...patch,
  };
}

function routineOf(checkpoints: Checkpoint[]): Routine {
  return {
    id: "rt_1",
    name: "Test",
    active: true,
    checkpoints,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

function doneOn(dates: string[], ids: string[] = ["cp"]): ProgressMap {
  const map: ProgressMap = {};
  for (const date of dates) map[date] = { completedCheckpointIds: [...ids], completedTaskIds: {} };
  return map;
}

// Weekday-only routine. 2026-10-28 is a Wednesday; 24 and 25 are the weekend.
const weekdays = routineOf([checkpoint({ id: "cp", time: "07:00", title: "Work" })]);

describe("computeStreaks", () => {
  it("skips days with nothing scheduled instead of breaking the streak", () => {
    const now = new Date(2026, 9, 28, 15, 0);
    const progress = doneOn(["2026-10-22", "2026-10-23", "2026-10-26", "2026-10-27", "2026-10-28"]);
    assert.equal(computeStreaks(weekdays, progress, now).streak, 5);
  });

  it("keeps the streak when today is an unscheduled day", () => {
    const sunday = new Date(2026, 9, 25, 12, 0);
    const progress = doneOn(["2026-10-22", "2026-10-23"]);
    assert.equal(computeStreaks(weekdays, progress, sunday).streak, 2);
  });

  it("does not zero the streak while today is unfinished", () => {
    const now = new Date(2026, 9, 28, 8, 0);
    const progress = doneOn(["2026-10-26", "2026-10-27"]);
    assert.equal(computeStreaks(weekdays, progress, now).streak, 2);
  });

  it("adds today once it is complete", () => {
    const now = new Date(2026, 9, 28, 20, 0);
    const progress = doneOn(["2026-10-26", "2026-10-27", "2026-10-28"]);
    assert.equal(computeStreaks(weekdays, progress, now).streak, 3);
  });

  it("ends the streak at an earlier scheduled day that was missed", () => {
    const now = new Date(2026, 9, 28, 20, 0);
    const progress = doneOn(["2026-10-27", "2026-10-28"]);
    assert.equal(computeStreaks(weekdays, progress, now).streak, 2);
  });

  it("needs every checkpoint scheduled that day, not just one", () => {
    const two = routineOf([
      checkpoint({ id: "cp", time: "07:00", title: "Work" }),
      checkpoint({ id: "cp2", time: "09:00", title: "Read" }),
    ]);
    const now = new Date(2026, 9, 28, 20, 0);
    const progress: ProgressMap = {
      "2026-10-27": { completedCheckpointIds: ["cp"], completedTaskIds: {} },
      "2026-10-28": { completedCheckpointIds: ["cp", "cp2"], completedTaskIds: {} },
    };
    const result = computeStreaks(two, progress, now);
    assert.equal(result.streak, 1);
    assert.equal(result.completedDays, 1);
  });

  it("tracks the best run across an off-day gap and counts finished days", () => {
    const now = new Date(2026, 9, 28, 8, 0);
    const progress = doneOn(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-26"]);
    const result = computeStreaks(weekdays, progress, now);
    assert.equal(result.bestStreak, 5);
    assert.equal(result.completedDays, 5);
    assert.equal(result.streak, 0);
  });

  it("returns zeros when nothing is scheduled", () => {
    const empty = routineOf([]);
    const result = computeStreaks(empty, {}, new Date(2026, 9, 28, 12, 0));
    assert.deepEqual(result, { streak: 0, bestStreak: 0, completedDays: 0 });
  });
});

describe("computeStats just after midnight", () => {
  const allDays = [0, 1, 2, 3, 4, 5, 6] as Checkpoint["repeatDays"];
  const nightRoutine = routineOf([
    checkpoint({ id: "workout", time: "06:00", title: "Workout", repeatDays: allDays }),
    checkpoint({ id: "review", time: "21:30", title: "Review", repeatDays: allDays }),
    checkpoint({ id: "night", time: "00:00", title: "Night build", repeatDays: allDays }),
  ]);
  const settings = { weekStartsOn: 1 as const, remindersEnabled: false };

  it("does not count the morning as missed at 00:05", () => {
    const stats = computeStats(nightRoutine, {}, new Date(2026, 9, 27, 0, 5), settings);
    assert.deepEqual(stats.missedIds, ["night"]);
  });

  it("counts nothing as missed at 05:01 and the morning at 07:00", () => {
    assert.deepEqual(computeStats(nightRoutine, {}, new Date(2026, 9, 27, 5, 1), settings).missedIds, []);
    assert.deepEqual(computeStats(nightRoutine, {}, new Date(2026, 9, 27, 7, 0), settings).missedIds, ["workout"]);
  });
});

describe("computeStats", () => {
  it("reports the same streak numbers as computeStreaks", () => {
    const now = new Date(2026, 9, 28, 8, 0);
    const progress = doneOn(["2026-10-26", "2026-10-27"]);
    const stats = computeStats(weekdays, progress, now, { weekStartsOn: 1, remindersEnabled: false });
    assert.equal(stats.streak, 2);
    assert.equal(stats.todayTotal, 1);
    assert.equal(stats.todayDone, 0);
  });
});
