import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { annotateConflicts, getRoutinePlanner, type DraftCheckpoint } from "./planner.ts";
import type { Checkpoint } from "./types.ts";

function existing(time: string, title: string, id = "cp_old"): Checkpoint {
  return {
    id,
    time,
    title,
    icon: "target",
    tasks: [],
    enabled: true,
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    reminderEnabled: true,
  };
}

describe("routine planner", () => {
  const plan = getRoutinePlanner().plan;

  it("does not invent commitments that were not written", () => {
    const draft = plan({
      goal: "",
      dayStart: "08:00",
      dayEnd: "18:00",
      commitments: [{ title: "School", time: "09:00" }],
      existing: [],
    });
    assert.deepEqual(
      draft.proposed.map((item) => item.title),
      ["School"],
    );
    assert.equal(draft.proposed[0].time, "09:00");
    assert.equal(draft.proposed[0].from, "commitment");
  });

  it("keeps the existing routine and flags a colliding commitment without moving it", () => {
    const current = existing("09:00", "Deep work");
    const draft = plan({
      goal: "Write the notes",
      dayStart: "08:00",
      dayEnd: "18:00",
      commitments: [{ title: "School", time: "09:00" }],
      existing: [current],
    });
    assert.equal(current.time, "09:00");
    assert.equal(draft.existing[0].time, "09:00");
    assert.equal(draft.existing[0].title, "Deep work");
    const school = draft.proposed.find((item) => item.title === "School");
    assert.ok(school);
    assert.equal(school.time, "09:00");
    assert.match(school.conflict ?? "", /Deep work/);
    const goal = draft.proposed.find((item) => item.from === "goal");
    assert.equal(goal?.title, "Write the notes");
    assert.notEqual(goal?.time, "09:00");
    assert.equal(goal?.conflict, undefined);
  });

  it("places a blank commitment in an open hour instead of stacking it", () => {
    const draft = plan({
      goal: "",
      dayStart: "09:00",
      dayEnd: "12:00",
      commitments: [{ title: "Errand" }],
      existing: [existing("09:00", "Standup")],
    });
    assert.equal(draft.proposed[0].title, "Errand");
    assert.equal(draft.proposed[0].time, "09:30");
    assert.equal(draft.proposed[0].conflict, undefined);
  });

  it("does not add a second block when the goal is already a commitment", () => {
    const draft = plan({
      goal: "Ship the landing page",
      dayStart: "08:00",
      dayEnd: "18:00",
      commitments: [{ title: "Ship the landing page", time: "16:00" }],
      existing: [],
    });
    assert.equal(draft.proposed.length, 1);
    assert.equal(draft.proposed[0].from, "commitment");
  });

  it("reads a goal into the sessions you named and does not invent the rest of the day", () => {
    const draft = plan({
      goal: "study for 2 hours in the morning and gym at 6pm",
      dayStart: "07:00",
      dayEnd: "22:00",
      commitments: [],
      existing: [],
    });
    assert.deepEqual(
      draft.proposed.map((item) => item.title),
      ["Study", "Gym"],
    );
    assert.equal(draft.proposed[0].time < "12:00", true);
    assert.equal(draft.proposed[0].tasks[0], "About 2 hours");
    assert.equal(draft.proposed[1].time, "18:00");
    assert.equal(draft.proposed.some((item) => /lunch|breakfast|sleep|meeting/i.test(item.title)), false);
  });

  it("clears a conflict once the time is free", () => {
    const blocked: DraftCheckpoint = {
      key: "commitment-0",
      title: "School",
      time: "09:00",
      tasks: [],
      from: "commitment",
      conflict: "Overlaps Deep work.",
    };
    const next = annotateConflicts([{ ...blocked, time: "11:00" }], [{ title: "Deep work", time: "09:00" }]);
    assert.equal(next[0].conflict, undefined);
    assert.equal(next[0].time, "11:00");
  });
});
