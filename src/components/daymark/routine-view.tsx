import { Bell, BellOff, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { CheckpointIcon } from "@/lib/daymark/icons";
import { useDaymark } from "@/lib/daymark/store";
import { clockLabel } from "@/lib/daymark/time";
import type { DaymarkView } from "./nav";
import { RoutineBuilder } from "./routine-builder";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function RoutineView({
  onAdd,
  onEdit,
  onNavigate,
}: {
  onAdd: () => void;
  onEdit: (id: string) => void;
  onNavigate: (view: DaymarkView) => void;
}) {
  const { routine, updateRoutineMeta, moveCheckpoint, toggleCheckpointEnabled, toggleCheckpointReminder } = useDaymark();
  const checkpoints = routine?.checkpoints ?? [];

  return (
    <section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-quiet">Routine</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Your rhythm</h1>
      <label className="mt-6 block text-xs font-bold text-quiet">
        Routine name
        <input
          value={routine?.name ?? ""}
          onChange={(event) => updateRoutineMeta({ name: event.target.value })}
          className="mt-2 h-12 w-full max-w-md rounded-2xl border border-line bg-paper px-4 text-sm font-bold outline-none focus:border-lime"
        />
      </label>

      <RoutineBuilder />

      {checkpoints.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-line bg-paper p-8">
          <h2 className="text-2xl font-black">Your rhythm starts here.</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-quiet">
            Create your first checkpoint and build a day that works for you.
          </p>
          <button type="button" onClick={onAdd} className="mt-6 h-12 rounded-2xl bg-forest px-5 text-sm font-bold text-paper">
            Add checkpoint
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {checkpoints.map((item, index) => (
            <div key={item.id} className={`rounded-2xl border bg-paper p-4 ${item.enabled ? "border-line" : "border-line opacity-60"}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mist text-olive">
                  <CheckpointIcon name={item.icon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-quiet">{clockLabel(item.time)}</p>
                  <h3 className="truncate text-base font-bold">{item.title}</h3>
                  <p className="mt-1 text-[11px] font-bold tracking-wide text-soft">
                    {DAYS.map((label, day) => (
                      <span key={`${item.id}-${day}`} className={item.repeatDays.includes(day as 0 | 1 | 2 | 3 | 4 | 5 | 6) ? "text-olive" : "text-line"}>
                        {label}{" "}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => moveCheckpoint(item.id, -1)}
                    className="grid size-10 place-items-center rounded-xl border border-line disabled:opacity-30"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === checkpoints.length - 1}
                    onClick={() => moveCheckpoint(item.id, 1)}
                    className="grid size-10 place-items-center rounded-xl border border-line disabled:opacity-30"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(item.id)}
                  className="inline-flex h-11 items-center gap-1 rounded-xl bg-canvas px-3 text-xs font-bold"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggleCheckpointEnabled(item.id)}
                  className="h-11 rounded-xl bg-canvas px-3 text-xs font-bold"
                >
                  {item.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleCheckpointReminder(item.id)}
                  className="inline-flex h-11 items-center gap-1 rounded-xl bg-canvas px-3 text-xs font-bold"
                >
                  {item.reminderEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                  Reminder {item.reminderEnabled ? "on" : "off"}
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={onAdd}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-bold text-olive"
          >
            <Plus size={16} /> Add checkpoint
          </button>
        </div>
      )}

      <button type="button" onClick={() => onNavigate("settings")} className="mt-8 text-sm font-bold text-olive">
        Reminder settings →
      </button>
    </section>
  );
}
