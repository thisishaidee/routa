import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { callTool, emptyAgentFile, parseRepeat } from "./apply.ts";

const now = new Date(2026, 9, 12, 9, 0, 0);

describe("routa agent tools", () => {
  it("adds a session without removing what is already there", () => {
    const first = callTool(emptyAgentFile(), "routa_add_session", { title: "Study", time: "07:00", repeat: "weekdays" }, now);
    const second = callTool(first.file, "routa_add_session", { title: "Gym", time: "18:00", reminder: true }, now);
    assert.equal(second.isError, false);
    assert.deepEqual(
      second.file.routine?.checkpoints.map((item) => item.title),
      ["Study", "Gym"],
    );
    assert.equal(second.file.routine?.checkpoints[0].repeatDays.join(","), "0,1,2,3,4");
    assert.match(second.text, /not added to the phone Clock/);
    assert.equal(second.file.remindersEnabled, true);
  });

  it("turns a reminder on and off by title", () => {
    const added = callTool(emptyAgentFile(), "routa_add_session", { title: "Study", time: "07:00" }, now);
    const on = callTool(added.file, "routa_set_reminder", { title: "Study", enabled: true }, now);
    assert.match(on.text, /while Routa is open/);
    assert.equal(on.file.routine?.checkpoints[0].reminderEnabled, true);
    const off = callTool(on.file, "routa_set_reminder", { title: "Study", enabled: false }, now);
    assert.equal(off.file.routine?.checkpoints[0].reminderEnabled, false);
    assert.match(off.text, /Reminder off/);
  });

  it("removes only the named session", () => {
    let file = callTool(emptyAgentFile(), "routa_add_session", { title: "Study", time: "07:00" }, now).file;
    file = callTool(file, "routa_add_session", { title: "Gym", time: "18:00" }, now).file;
    const removed = callTool(file, "routa_remove_session", { title: "Study" }, now);
    assert.deepEqual(
      removed.file.routine?.checkpoints.map((item) => item.title),
      ["Gym"],
    );
  });

  it("rejects a bad time and an unknown tool", () => {
    const bad = callTool(emptyAgentFile(), "routa_add_session", { title: "Study", time: "25:00" }, now);
    assert.equal(bad.isError, true);
    assert.equal(bad.file.routine, null);
    assert.equal(callTool(emptyAgentFile(), "routa_nope", {}, now).isError, true);
  });

  it("parses weekdays as Monday through Friday", () => {
    const days = parseRepeat("weekdays");
    assert.deepEqual(days, [0, 1, 2, 3, 4]);
  });
});
