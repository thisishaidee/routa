import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { CHECKPOINT_ICONS } from "@/lib/daymark/icons";
import { createId } from "@/lib/daymark/ids";
import { isValidTime, normalizeTime } from "@/lib/daymark/time";
import { ALL_DAYS, type Checkpoint, type WeekDay } from "@/lib/daymark/types";

const DAY_LABELS: { id: WeekDay; label: string }[] = [
  { id: 0, label: "Mon" },
  { id: 1, label: "Tue" },
  { id: 2, label: "Wed" },
  { id: 3, label: "Thu" },
  { id: 4, label: "Fri" },
  { id: 5, label: "Sat" },
  { id: 6, label: "Sun" },
];

interface Props {
  initial: Checkpoint;
  onSave: (checkpoint: Checkpoint) => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function CheckpointEditor({ initial, onSave, onClose, onDelete }: Props) {
  const [draft, setDraft] = useState<Checkpoint>(initial);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleDay = (day: WeekDay) => {
    setDraft((value) => {
      const has = value.repeatDays.includes(day);
      const repeatDays = has ? value.repeatDays.filter((item) => item !== day) : [...value.repeatDays, day];
      return { ...value, repeatDays: repeatDays.length ? repeatDays : [...ALL_DAYS] };
    });
  };

  const submit = () => {
    const time = normalizeTime(draft.time);
    if (!draft.title.trim()) {
      setError("Give this checkpoint a name.");
      return;
    }
    if (!isValidTime(time)) {
      setError("Use a valid time, like 07:30.");
      return;
    }
    onSave({ ...draft, time, title: draft.title.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-soft">Checkpoint</p>
            <h2 className="text-lg font-bold">{initial.title.trim() ? "Edit checkpoint" : "Add checkpoint"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-xl border border-line">
            <X size={18} />
          </button>
        </header>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <label className="block text-xs font-bold text-quiet">
            Title
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Morning routine"
              className="mt-2 h-12 w-full rounded-xl border border-line bg-canvas px-3 text-sm font-medium text-ink outline-none focus:border-lime"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-quiet">
              Time
              <input
                type="time"
                value={draft.time}
                onChange={(event) => setDraft({ ...draft, time: event.target.value })}
                className="mt-2 h-12 w-full rounded-xl border border-line bg-canvas px-3 text-sm font-medium text-ink outline-none focus:border-lime"
              />
            </label>
            <label className="block text-xs font-bold text-quiet">
              Reminder
              <button
                type="button"
                onClick={() => setDraft({ ...draft, reminderEnabled: !draft.reminderEnabled })}
                className={`mt-2 flex h-12 w-full items-center justify-between rounded-xl border px-3 text-sm font-bold ${
                  draft.reminderEnabled ? "border-lime bg-mist text-olive" : "border-line bg-canvas text-quiet"
                }`}
              >
                {draft.reminderEnabled ? "On" : "Off"}
              </button>
            </label>
          </div>

          <label className="block text-xs font-bold text-quiet">
            Description
            <textarea
              value={draft.description ?? ""}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="Optional note about this block"
              className="mt-2 min-h-20 w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm font-medium outline-none focus:border-lime"
            />
          </label>

          <div>
            <p className="text-xs font-bold text-quiet">Tasks</p>
            <div className="mt-2 space-y-2">
              {draft.tasks.map((task, index) => (
                <div key={task.id} className="flex gap-2">
                  <input
                    value={task.title}
                    onChange={(event) => {
                      const tasks = [...draft.tasks];
                      tasks[index] = { ...task, title: event.target.value };
                      setDraft({ ...draft, tasks });
                    }}
                    placeholder="Improvement task"
                    className="h-12 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-lime"
                  />
                  <button
                    type="button"
                    aria-label="Remove task"
                    onClick={() => setDraft({ ...draft, tasks: draft.tasks.filter((item) => item.id !== task.id) })}
                    className="grid size-12 place-items-center rounded-xl border border-line text-quiet"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDraft({ ...draft, tasks: [...draft.tasks, { id: createId("tk"), title: "" }] })}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-bold text-olive"
              >
                <Plus size={16} /> Add task
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-quiet">Repeats</p>
            <div className="mt-2 flex gap-1.5">
              {DAY_LABELS.map((day) => {
                const selected = draft.repeatDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`h-11 flex-1 rounded-xl text-[11px] font-bold ${
                      selected ? "bg-forest text-paper" : "bg-canvas text-quiet"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex min-h-12 items-center justify-between rounded-xl bg-canvas px-3 text-sm font-bold">
            Enabled
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              className="size-5 accent-lime"
            />
          </label>

          <div>
            <p className="text-xs font-bold text-quiet">Icon</p>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {CHECKPOINT_ICONS.map((item) => {
                const selected = draft.icon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    onClick={() => setDraft({ ...draft, icon: item.id })}
                    className={`grid h-12 place-items-center rounded-xl border ${
                      selected ? "border-lime bg-mist text-olive" : "border-line bg-canvas text-ink"
                    }`}
                  >
                    <item.Icon size={18} />
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          {onDelete ? (
            confirmDelete ? (
              <div className="flex gap-2 rounded-xl bg-canvas p-3 text-sm">
                <p className="flex-1 font-medium">Delete this checkpoint?</p>
                <button type="button" onClick={() => setConfirmDelete(false)} className="font-bold text-quiet">
                  No
                </button>
                <button type="button" onClick={onDelete} className="font-bold text-danger">
                  Delete
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-bold text-danger">
                Delete checkpoint
              </button>
            )
          ) : null}
        </div>

        <footer className="flex gap-3 border-t border-line p-4">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-line text-sm font-bold">
            Cancel
          </button>
          <button type="button" onClick={submit} className="h-12 flex-1 rounded-xl bg-forest text-sm font-bold text-paper">
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
