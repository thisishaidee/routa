import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkInStreak, eligibleBadgeIds, markCheckIn, scheduledFinishStreak, syncBadges, EMPTY_CHECKINS, type CheckInState } from "./checkins.ts";
import type { Checkpoint, ProgressMap, Routine } from "./types.ts";
import { addDays, isoFromDate, mondayIndex } from "./time.ts";

function checkpoint(repeatDays: Checkpoint["repeatDays"]): Checkpoint {
  return {
    id: "cp",
    time: "09:00",
    title: "Work",
    icon: "target",
    tasks: [],
    enabled: true,
    repeatDays,
    reminderEnabled: false,
  };
}

function routine(repeatDays: Checkpoint["repeatDays"], done: string[]): { routine: Routine; progress: ProgressMap } {
  const progress: ProgressMap = {};
  for (const date of done) progress[date] = { completedCheckpointIds: ["cp"], completedTaskIds: {} };
  return {
    routine: {
      id: "rt",
      name: "Rhythm",
      active: true,
      checkpoints: [checkpoint(repeatDays)],
      createdAt: "",
      updatedAt: "",
    },
    progress,
  };
}

const now = new Date(2026, 9, 11, 15, 0, 0);
const today = "2026-10-11";

describe("check-in streak", () => {
  it("counts consecutive days and does not clear yesterday before today is checked", () => {
    const state = ["2026-10-09", "2026-10-10"].reduce<CheckInState>(
      (current, date) => markCheckIn(current, date, "start", `${date}T08:00:00.000Z`),
      EMPTY_CHECKINS,
    );
    const streak = checkInStreak(state.checkIns, today);
    assert.equal(streak.current, 2);
    assert.equal(streak.best, 2);
    assert.equal(streak.total, 2);
  });

  it("breaks on a missed day and keeps the best run", () => {
    let state = EMPTY_CHECKINS;
    for (const date of ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05"]) {
      state = markCheckIn(state, date, "close", `${date}T21:00:00.000Z`);
    }
    const streak = checkInStreak(state.checkIns, today);
    assert.equal(streak.best, 3);
    assert.equal(streak.current, 0);
    assert.equal(eligibleBadgeIds(state.checkIns, today, null, {}, now).includes("check-in-streak-3"), true);
    assert.equal(eligibleBadgeIds(state.checkIns, today, null, {}, now).includes("milestone-30"), false);
  });

  it("does not treat three separate days as a 3-day streak", () => {
    let state = EMPTY_CHECKINS;
    for (const date of ["2026-10-01", "2026-10-03", "2026-10-06"]) {
      state = markCheckIn(state, date, "start", `${date}T08:00:00.000Z`);
    }
    assert.equal(checkInStreak(state.checkIns, today).best, 1);
    assert.equal(eligibleBadgeIds(state.checkIns, today, null, {}, now).includes("check-in-streak-3"), false);
  });
});

describe("badges", () => {
  it("awards each badge once from recorded activity only", () => {
    let state = markCheckIn(EMPTY_CHECKINS, today, "start", "2026-10-11T08:00:00.000Z");
    const { routine: dayRoutine, progress } = routine([0, 1, 2, 3, 4, 5, 6], [today]);
    state = syncBadges(state, dayRoutine, progress, today, now);
    const once = state.badges.map((item) => item.id).sort();
    state = syncBadges(state, dayRoutine, progress, today, now);
    assert.deepEqual(state.badges.map((item) => item.id).sort(), once);
    assert.equal(once.includes("first-check-in"), true);
    assert.equal(once.includes("first-routine-completed"), true);
    assert.equal(once.includes("first-full-day"), true);
    assert.equal(once.includes("consistency-7"), false);
    assert.equal(once.filter((id) => id === "first-check-in").length, 1);
  });

  it("keeps the check-in streak independent from finished days", () => {
    let state = EMPTY_CHECKINS;
    for (const date of ["2026-10-09", "2026-10-10", "2026-10-11"]) {
      state = markCheckIn(state, date, "start", `${date}T08:00:00.000Z`);
    }
    const ids = eligibleBadgeIds(state.checkIns, today, null, {}, now);
    assert.equal(checkInStreak(state.checkIns, today).current, 3);
    assert.equal(ids.includes("check-in-streak-3"), true);
    assert.equal(ids.includes("first-routine-completed"), false);
    assert.equal(ids.includes("first-full-day"), false);
  });

  it("earns 7-day consistency only after seven scheduled days are finished", () => {
    const weekdays: Checkpoint["repeatDays"] = [0, 1, 2, 3, 4];
    const done: string[] = [];
    for (let offset = 1; offset <= 20; offset += 1) {
      const date = addDays(now, -offset);
      if (mondayIndex(date) <= 4) done.push(isoFromDate(date));
    }
    const full = routine(weekdays, done);
    assert.equal(scheduledFinishStreak(full.routine, full.progress, now).best >= 7, true);
    assert.equal(eligibleBadgeIds([], today, full.routine, full.progress, now).includes("consistency-7"), true);

    const short = routine(weekdays, done.slice(0, 6));
    assert.equal(eligibleBadgeIds([], today, short.routine, short.progress, now).includes("consistency-7"), false);
  });

  it("earns the 30-day milestone from thirty check-in days, not a guess", () => {
    let state = EMPTY_CHECKINS;
    for (let offset = 0; offset < 30; offset += 1) {
      const date = isoFromDate(addDays(now, -offset));
      state = markCheckIn(state, date, "start", `${date}T08:00:00.000Z`);
    }
    assert.equal(eligibleBadgeIds(state.checkIns, today, null, {}, now).includes("milestone-30"), true);
    const fewer = state.checkIns.slice(0, 29);
    assert.equal(eligibleBadgeIds(fewer, today, null, {}, now).includes("milestone-30"), false);
  });
});
