import { useDaymark } from "@/lib/daymark/store";

export function ProgressView() {
  const { stats, note } = useDaymark();

  return (
    <section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-quiet">Progress</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Your week</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Stat label="Today" value={`${stats.todayDone} / ${stats.todayTotal}`} hint="checkpoints" />
        <Stat label="This week" value={`${stats.weekPercent}%`} hint={`${stats.weekDone} of ${stats.weekTotal}`} />
        <Stat label="Best day" value={stats.bestDayLabel} hint="highest completion" />
        <Stat label="Completed" value={String(stats.lifetimeDone)} hint="checkpoints all time" />
      </div>

      {stats.grid.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-line bg-paper p-8">
          <h2 className="text-2xl font-black">No rhythm to chart yet.</h2>
          <p className="mt-2 text-sm text-quiet">Add checkpoints and this week will fill in as you complete them.</p>
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-line bg-paper p-5">
          <div className="mb-4 flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-wide text-quiet">
            <span className="mr-auto hidden sm:block">Checkpoint</span>
            {stats.weekDays.map((day) => (
              <span key={day.dateKey} className="w-8 text-center sm:w-9">
                {day.label}
              </span>
            ))}
          </div>
          <div className="space-y-4">
            {stats.grid.map((row) => (
              <div key={row.checkpoint.id} className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-bold">{row.checkpoint.title}</p>
                <div className="flex shrink-0 items-center gap-1">
                  {row.cells.map((cell) => (
                    <span
                      key={cell.dateKey}
                      className={`size-8 rounded-full sm:size-9 ${
                        !cell.scheduled ? "bg-canvas" : cell.done ? "bg-olive" : "bg-mist"
                      }`}
                      aria-label={`${row.checkpoint.title} ${cell.label} ${cell.done ? "done" : cell.scheduled ? "open" : "off"}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[11px] font-bold text-quiet">Filled = completed · Pale = scheduled · Empty = off that day</p>
        </div>
      )}

      <section className="mt-8 rounded-3xl border border-line bg-paper p-6">
        <h2 className="text-xl font-black">Today's note</h2>
        {note.trim() ? (
          <p className="mt-3 whitespace-pre-wrap text-pretty text-sm leading-6 text-quiet">{note}</p>
        ) : (
          <p className="mt-3 text-pretty text-sm leading-6 text-quiet">
            No reflection yet. Your notes will appear here as you move through your days.
          </p>
        )}
      </section>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl bg-forest p-5 text-paper">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-mist">{label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-mist">{hint}</p>
    </div>
  );
}
