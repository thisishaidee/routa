import { useState } from "react";
import { annotateConflicts, getRoutinePlanner, type DraftCheckpoint, type PlannerDraft } from "@/lib/daymark/planner";
import { useDaymark } from "@/lib/daymark/store";
import { clockLabel } from "@/lib/daymark/time";

export function RoutineBuilder() {
  const { routine, applyPlanner } = useDaymark();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [dayStart, setDayStart] = useState("07:00");
  const [dayEnd, setDayEnd] = useState("22:00");
  const [rows, setRows] = useState([{ title: "", time: "" }]);
  const [draft, setDraft] = useState<PlannerDraft | null>(null);
  const [proposed, setProposed] = useState<DraftCheckpoint[]>([]);
  const [reminders, setReminders] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const review = () => {
    const next = getRoutinePlanner().plan({
      goal,
      dayStart,
      dayEnd,
      commitments: rows.filter((row) => row.title.trim()).map((row) => ({ title: row.title, time: row.time || undefined })),
      existing: routine?.checkpoints ?? [],
    });
    setDraft(next);
    setProposed(next.proposed);
    setMessage("");
  };

  const updateProposed = (key: string, patch: Partial<DraftCheckpoint>) => {
    if (!draft) return;
    const next = proposed.map((item) => (item.key === key ? { ...item, ...patch } : item));
    setProposed(annotateConflicts(next, draft.existing));
  };

  const save = async () => {
    setSaving(true);
    const result = await applyPlanner(proposed, reminders);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error ?? "Could not save that plan.");
      return;
    }
    setMessage(
      result.reminders === "on"
        ? "Added. Reminders follow these times while Routa is open."
        : result.reminders === "denied"
          ? "Added. Reminders stay off until you allow them."
          : "Added to your routine.",
    );
    setDraft(null);
    setProposed([]);
    setGoal("");
    setRows([{ title: "", time: "" }]);
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="mt-6">
        <button type="button" onClick={() => setOpen(true)} className="h-12 rounded-2xl bg-forest px-5 text-sm font-bold text-paper">
          Build from a goal
        </button>
        {message ? <p className="mt-3 text-sm text-olive">{message}</p> : null}
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-line bg-paper p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black tracking-[0.18em] text-soft">ASSISTANT</p>
          <h2 className="mt-1 text-xl font-black">Build from a goal</h2>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-bold text-quiet">
          Close
        </button>
      </div>
      <p className="mt-2 text-pretty text-sm leading-6 text-quiet">
        Write the day in your own words. Routa reads the sessions, times, and lengths you actually mention. It does not invent the rest, and nothing is saved until you review it.
      </p>

      {draft ? (
        <div className="mt-5">
          <p className="text-sm font-bold">{draft.summary}</p>
          <ul className="mt-2 space-y-1">
            {draft.notes.map((note) => (
              <li key={note} className="text-pretty text-sm leading-6 text-quiet">
                {note}
              </li>
            ))}
          </ul>
          {draft.existing.length > 0 ? (
            <ul className="mt-4 space-y-1">
              {draft.existing.map((item) => (
                <li key={item.id} className="text-sm text-quiet">
                  {clockLabel(item.time)} · {item.title} · already yours
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 space-y-3">
            {proposed.map((item) => (
              <div key={item.key} className="rounded-2xl bg-canvas p-3">
                <input
                  value={item.title}
                  onChange={(event) => updateProposed(item.key, { title: event.target.value })}
                  aria-label="Session name"
                  className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-bold outline-none focus:border-lime"
                />
                {item.tasks[0] ? <p className="mt-2 text-xs text-quiet">{item.tasks[0]}</p> : null}
                <div className="mt-2 flex gap-2">
                  <input
                    type="time"
                    value={item.time}
                    onChange={(event) => updateProposed(item.key, { time: event.target.value })}
                    aria-label={`Time for ${item.title}`}
                    className="h-11 flex-1 rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-lime"
                  />
                  <button
                    type="button"
                    onClick={() => setProposed(annotateConflicts(proposed.filter((entry) => entry.key !== item.key), draft.existing))}
                    className="h-11 rounded-xl border border-line px-3 text-xs font-bold"
                  >
                    Remove
                  </button>
                </div>
                {item.conflict ? <p className="mt-2 text-sm text-danger">{item.conflict}</p> : null}
              </div>
            ))}
          </div>
          {proposed.length > 0 ? (
            <label className="mt-4 flex items-start gap-3 text-sm leading-6">
              <input type="checkbox" checked={reminders} onChange={(event) => setReminders(event.target.checked)} className="mt-1" />
              <span>
                Remind me at these times
                <span className="mt-1 block text-quiet">
                  On this device, reminders notify while Routa is open. They are not added to your phone clock.
                </span>
              </span>
            </label>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || proposed.length === 0 || proposed.some((item) => Boolean(item.conflict) || !item.title.trim())}
              onClick={() => void save()}
              className="h-12 rounded-2xl bg-forest px-5 text-sm font-bold text-paper disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save into routine"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="h-12 rounded-2xl border border-line px-5 text-sm font-bold">
              Edit answers
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <label className="block text-xs font-bold text-quiet">
            Goal
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={3}
              placeholder="What should this day make room for?"
              className="mt-2 w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-sm outline-none focus:border-lime"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-quiet">
              Hours from
              <input type="time" value={dayStart} onChange={(event) => setDayStart(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm" />
            </label>
            <label className="text-xs font-bold text-quiet">
              Hours until
              <input type="time" value={dayEnd} onChange={(event) => setDayEnd(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm" />
            </label>
          </div>
          <div>
            <p className="text-xs font-bold text-quiet">Commitments you already have</p>
            <div className="mt-2 space-y-2">
              {rows.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={row.title}
                    onChange={(event) => setRows(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value } : item)))}
                    placeholder="Name"
                    aria-label="Commitment name"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-lime"
                  />
                  <input
                    type="time"
                    value={row.time}
                    onChange={(event) => setRows(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, time: event.target.value } : item)))}
                    aria-label="Commitment time"
                    className="h-11 w-28 rounded-xl border border-line bg-canvas px-2 text-sm"
                  />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setRows([...rows, { title: "", time: "" }])} className="mt-2 text-sm font-bold text-olive">
              Add another
            </button>
          </div>
          <button type="button" onClick={review} className="h-12 rounded-2xl bg-forest px-5 text-sm font-bold text-paper">
            Review a plan
          </button>
        </div>
      )}
      {message ? <p className="mt-3 text-sm text-olive">{message}</p> : null}
    </section>
  );
}
