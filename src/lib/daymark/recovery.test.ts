import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dropDayMove, optionStillFree, suggestRecovery, timeOverrides, upsertDayMove, type DayMove } from "./recovery.ts";
import type { Checkpoint, DayProgress } from "./types.ts";

function checkpoint(patch: Partial<Checkpoint> & Pick<Checkpoint, "id" | "time" | "title">): Checkpoint {
  return {
    icon: "target",
    tasks: [],
    enabled: true,
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    reminderEnabled: true,
    ...patch,
  };
}

const emptyDay: DayProgress = { completedCheckpointIds: [], completedTaskIds: {} };

describe("suggestRecovery", () => {
  const now = new Date(2026, 8, 4, 16, 40, 0);
  const study = checkpoint({ id: "cp_study", time: "16:00", title: "Study" });
  const read = checkpoint({ id: "cp_read", time: "17:00", title: "Read" });

  it("offers today and every-day options for a missed checkpoint", () => {
    const proposals = suggestRecovery({
      routineId: "rt_1",
      checkpoints: [study],
      day: emptyDay,
      now,
      date: "2026-09-04",
      moves: [],
      dismissedIds: [],
    });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].options.some((item) => item.scope === "today"), true);
    assert.equal(proposals[0].options.some((item) => item.scope === "recurring"), true);
    assert.equal(proposals[0].options[0].time, "17:00");
  });

  it("does not invent a slot that collides", () => {
    const proposals = suggestRecovery({
      routineId: "rt_1",
      checkpoints: [study, read],
      day: emptyDay,
      now,
      date: "2026-09-04",
      moves: [],
      dismissedIds: [],
    });
    const times = proposals[0].options.filter((item) => item.scope === "today").map((item) => item.time);
    assert.equal(times.includes("17:00"), false);
    assert.equal(times[0], "17:30");
  });

  it("skips completed and future checkpoints", () => {
    const later = checkpoint({ id: "cp_later", time: "21:00", title: "Review" });
    const proposals = suggestRecovery({
      routineId: "rt_1",
      checkpoints: [study, later],
      day: { completedCheckpointIds: ["cp_study"], completedTaskIds: {} },
      now,
      date: "2026-09-04",
      moves: [],
      dismissedIds: [],
    });
    assert.deepEqual(proposals, []);
  });

  it("skips a checkpoint the user already dismissed today", () => {
    const proposals = suggestRecovery({
      routineId: "rt_1",
      checkpoints: [study],
      day: emptyDay,
      now,
      date: "2026-09-04",
      moves: [],
      dismissedIds: ["cp_study"],
    });
    assert.deepEqual(proposals, []);
  });

  it("uses a today-only move and does not treat the old time as still missed", () => {
    const move: DayMove = {
      routineId: "rt_1",
      date: "2026-09-04",
      checkpointId: "cp_study",
      fromTime: "16:00",
      time: "18:00",
      createdAt: now.toISOString(),
    };
    const proposals = suggestRecovery({
      routineId: "rt_1",
      checkpoints: [study],
      day: emptyDay,
      now,
      date: "2026-09-04",
      moves: [move],
      dismissedIds: [],
    });
    assert.deepEqual(proposals, []);
    assert.equal(timeOverrides([move], "2026-09-04").cp_study, "18:00");
  });

  it("rejects a today option once another session takes that time", () => {
    const option = suggestRecovery({
      routineId: "rt_1",
      checkpoints: [study],
      day: emptyDay,
      now,
      date: "2026-09-04",
      moves: [],
      dismissedIds: [],
    })[0].options[0];
    const blocked = checkpoint({ id: "cp_block", time: option.time, title: "Block" });
    assert.equal(optionStillFree(option, [study, blocked], now, {}), false);
  });

  it("stores a today move without dropping other days", () => {
    const move: DayMove = {
      routineId: "rt_1",
      date: "2026-09-04",
      checkpointId: "cp_study",
      fromTime: "16:00",
      time: "18:00",
      createdAt: now.toISOString(),
    };
    const other: DayMove = { ...move, date: "2026-09-03", time: "19:00" };
    const next = upsertDayMove([other], move);
    assert.equal(next.length, 2);
    assert.equal(dropDayMove(next, "2026-09-04", "cp_study").length, 1);
    assert.equal(study.time, "16:00");
  });
});
