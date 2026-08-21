import { Check, Pencil, Sparkles, Target } from "lucide-react";
import { CheckpointIcon } from "@/lib/daymark/icons";
import { useDaymark } from "@/lib/daymark/store";
import { clockLabel, greeting, liveCheckpointId, todaysCheckpoints } from "@/lib/daymark/time";
import type { DaymarkView } from "./nav";

export function TodayView({
  onNavigate,
  onEdit,
}: {
  onNavigate: (view: DaymarkView) => void;
  onEdit: (id: string) => void;
}) {
  const {
    now,
    profile,
    routine,
    selectedId,
    setSelectedId,
    stats,
    checkpointDone,
    toggleCheckpointDone,
    taskDone,
    toggleTaskDone,
    note,
    setNote,
    settings,
  } = useDaymark();

  const list = todaysCheckpoints(routine?.checkpoints ?? [], now);
  const liveId = liveCheckpointId(routine?.checkpoints ?? [], now);
  const selected = list.find((item) => item.id === selectedId) ?? list.find((item) => item.id === liveId) ?? list[0];
  const remaining = Math.max(stats.todayTotal - stats.todayDone, 0);
  const slice = stats.todayTotal === 0 ? 0 : stats.todayDone * (360 / stats.todayTotal);
  const firstName = profile.name.trim().split(" ")[0];
  const hello = firstName ? `${greeting(now)}, ${firstName}.` : `${greeting(now)}.`;
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  if (!routine || list.length === 0) {
    return (
      <section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-12">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-quiet">
          {dateLabel} <span className="text-lime">●</span> Your daily rhythm
        </p>
        <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-5xl">{hello}</h1>
        <div className="mt-10 rounded-3xl border border-line bg-paper p-8">
          <h2 className="text-2xl font-black">Your rhythm starts here.</h2>
          <p className="mt-2 max-w-md text-pretty text-sm leading-6 text-quiet">
            Create your first checkpoint and build a day that works for you.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("routine")}
            className="mt-6 h-12 rounded-2xl bg-forest px-5 text-sm font-bold text-paper"
          >
            Create routine
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-12">
      <header>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-quiet">
          {dateLabel} <span className="text-lime">●</span> Your daily rhythm
        </p>
        <h1 className="text-3xl font-black tracking-[-0.04em] text-balance sm:text-5xl">{hello}</h1>
      </header>

      <div className="mt-9 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="flex items-center justify-between gap-4 rounded-3xl bg-forest p-6 text-paper sm:p-8">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-lime text-forest">
              <Target size={19} />
            </span>
            <div className="min-w-0">
              <span className="text-sm text-mist">Today's progress</span>
              <strong className="mt-1 block text-4xl tabular-nums">
                {stats.todayDone}
                <i className="text-lg font-normal text-mist"> / {stats.todayTotal}</i>
              </strong>
              <p className="mt-1 text-sm text-mist">
                {remaining} checkpoint{remaining === 1 ? "" : "s"} remaining
              </p>
            </div>
          </div>
          <div
            className="grid size-24 shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(var(--color-lime) ${slice}deg, var(--color-forest-mid) ${slice}deg)` }}
          >
            <div className="grid size-[76px] place-items-center rounded-full bg-forest text-center">
              <b className="tabular-nums">{stats.todayPercent}%</b>
              <small className="block text-[9px] text-mist">done</small>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={16} className="text-olive" />
            Today's focus
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight">{selected ? selected.title : "Your day"}</h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-quiet">
            {selected?.description || "Turn this block into one visible improvement."}
          </p>
          {selected ? (
            <a href="#checkpoint-detail" className="mt-4 inline-flex text-sm font-bold text-olive">
              Open checkpoint →
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-10 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight">Today's routine</h2>
          <p className="mt-1 text-sm text-quiet">Tap a session to see its tasks · {list.length} checkpoints</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {list.map((activity) => {
          const done = checkpointDone(activity.id);
          const active = selected?.id === activity.id;
          return (
            <div
              key={activity.id}
              className={`flex items-center gap-3 rounded-2xl border p-3 sm:gap-5 sm:p-4 ${
                active ? "border-lime bg-cream shadow-sm" : "border-transparent bg-paper"
              }`}
            >
              <button type="button" onClick={() => setSelectedId(activity.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-5">
                <span className="w-14 shrink-0 text-xs font-bold text-quiet sm:w-16">{clockLabel(activity.time)}</span>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mist text-olive">
                  <CheckpointIcon name={activity.icon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`truncate text-sm font-bold sm:text-base ${done ? "text-soft line-through" : ""}`}>
                      {activity.title}
                    </h3>
                    {activity.id === liveId ? (
                      <span className="rounded-full bg-mist px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-olive">
                        now
                      </span>
                    ) : null}
                    {activity.reminderEnabled && settings.remindersEnabled ? (
                      <span className="hidden rounded-full bg-canvas px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-quiet sm:inline">
                        reminder
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-soft">
                    {activity.tasks.length} task{activity.tasks.length === 1 ? "" : "s"}
                    {activity.tasks[0] ? ` · ${activity.tasks[0].title}` : ""}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => toggleCheckpointDone(activity.id)}
                aria-label={`Mark ${activity.title} done`}
                className={`grid size-11 shrink-0 place-items-center rounded-full border-2 ${
                  done ? "border-lime bg-lime text-forest" : "border-line bg-paper text-transparent"
                }`}
              >
                <Check size={16} strokeWidth={3} />
              </button>
            </div>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-10 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <section id="checkpoint-detail" className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.18em] text-soft">CHECKPOINT</p>
                <h2 className="mt-2 text-2xl font-black">{selected.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => onEdit(selected.id)}
                className="grid size-11 place-items-center rounded-xl border border-line text-quiet"
                aria-label="Edit checkpoint"
              >
                <Pencil size={16} />
              </button>
            </div>
            <p className="mt-3 text-pretty text-sm text-quiet">
              {selected.description || "Small progress beats a perfect plan."}
            </p>
            <p className="mt-2 text-xs font-bold text-quiet">
              Reminder {selected.reminderEnabled && settings.remindersEnabled ? "on" : "off"}
            </p>
            {selected.tasks.length === 0 ? (
              <p className="mt-5 text-sm text-quiet">No tasks yet. Add them from edit.</p>
            ) : (
              <div className="mt-5 space-y-2">
                {selected.tasks.map((task) => {
                  const done = taskDone(selected.id, task.id);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTaskDone(selected.id, task.id)}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-canvas p-3 text-left text-sm"
                    >
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                          done ? "border-lime bg-lime" : "border-line bg-paper"
                        }`}
                      >
                        {done ? <Check size={13} /> : null}
                      </span>
                      <span className={done ? "text-soft line-through" : ""}>{task.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <label className="mt-6 block text-xs font-bold text-quiet">
              Daily note
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What did you learn or ship today?"
                className="mt-2 min-h-20 w-full resize-none rounded-xl border border-line bg-cream p-3 text-sm outline-none focus:border-lime"
              />
            </label>
          </section>

          <section className="rounded-3xl bg-mist p-6 sm:p-8">
            <p className="text-[10px] font-black tracking-[0.18em] text-olive">KEEP GOING</p>
            <h2 className="mt-2 text-2xl font-black">Momentum</h2>
            <strong className="mt-7 block text-5xl font-black tabular-nums">
              {String(stats.streak).padStart(2, "0")}{" "}
              <small className="text-lg font-medium">day{stats.streak === 1 ? "" : "s"}</small>
            </strong>
            <p className="mt-2 text-pretty text-sm leading-6 text-olive">Show up for the next session. Streaks count fully finished days.</p>
            <div className="mt-7 flex justify-between gap-2">
              {stats.weekDays.map((day) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={day.dateKey}>
                  <span className={`h-12 w-full rounded-lg ${day.total > 0 && day.done === day.total ? "bg-olive" : "bg-lime/40"}`} />
                  <small className="text-[10px] font-bold text-olive">{day.label}</small>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => onNavigate("progress")} className="mt-6 text-sm font-bold text-olive">
              See weekly progress →
            </button>
          </section>
        </div>
      ) : null}
    </section>
  );
}
