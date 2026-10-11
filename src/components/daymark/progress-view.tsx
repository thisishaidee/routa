import { useDaymark } from "@/lib/daymark/store";
import { BADGES } from "@/lib/daymark/checkins";

export function ProgressView() {
  const { stats, note, notes, insights, suggestions, health, checkInStreak, badges, checkInHistory } = useDaymark();
  const history = Object.entries(notes)
    .filter(([, text]) => text.trim())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 5);

  return (
    <section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-quiet">Progress</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Your week</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Stat label="Today" value={`${stats.todayDone} / ${stats.todayTotal}`} hint="completed of planned" />
        <Stat label="Remaining" value={String(stats.todayRemaining)} hint={`${stats.todayMissed} missed`} />
        <Stat label="Tasks" value={`${stats.todayTasksDone} / ${stats.todayTasksTotal}`} hint="checked today" />
        <Stat label="This week" value={`${stats.weekDone} / ${stats.weekTotal}`} hint={`${stats.weekPercent}% completed of planned`} />
        <Stat label="Routine streak" value={String(stats.streak)} hint={`best ${stats.bestStreak} · ${stats.completedDays} finished days`} />
        <Stat label="Check-in" value={String(checkInStreak.current)} hint={`best ${checkInStreak.best} · ${checkInStreak.total} days`} />
        <Stat label="Completed" value={String(stats.lifetimeDone)} hint="checkpoints all time" />
      </div>
      <p className="mt-4 text-pretty text-sm leading-6 text-quiet">
        Planned versus completed uses only checkpoints you scheduled and marked done. Missed means the time passed and it is still open.
      </p>

      <section className="mt-8 rounded-3xl border border-line bg-paper p-6">
        <p className="text-[10px] font-black tracking-[0.18em] text-soft">RHYTHM HEALTH</p>
        <h2 className="mt-2 text-2xl font-black">{health.label}</h2>
        <p className="mt-2 text-pretty text-sm leading-6 text-quiet">{health.detail}</p>
        <p className="mt-3 text-xs text-quiet">A finished day means every scheduled checkpoint was completed.</p>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-6">
        <p className="text-[10px] font-black tracking-[0.18em] text-soft">BADGES</p>
        {badges.length === 0 ? (
          <p className="mt-3 text-pretty text-sm leading-6 text-quiet">Badges show up here only after you earn them.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {BADGES.filter((item) => badges.some((earned) => earned.id === item.id)).map((item) => (
              <li key={item.id}>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="text-sm text-quiet">{item.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-6">
        <p className="text-[10px] font-black tracking-[0.18em] text-soft">CHECK-IN HISTORY</p>
        {checkInHistory.length === 0 ? (
          <p className="mt-3 text-sm text-quiet">No check-ins yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {checkInHistory.map((item) => (
              <li key={item.date} className="text-sm text-quiet">
                {item.date}
                {item.startedAt ? " · started" : ""}
                {item.closedAt ? " · closed" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-paper p-6">
        <p className="text-[10px] font-black tracking-[0.18em] text-soft">INTELLIGENCE</p>
        <p className="mt-2 text-pretty text-sm leading-6 text-quiet">
          Only from checkpoints you scheduled and marked done. No guessed reasons.
        </p>
        {insights.length === 0 ? (
          <p className="mt-3 text-sm text-quiet">Not enough recorded days to say more than that.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {insights.map((item) => (
              <li key={item.id} className="text-pretty text-sm leading-6 text-ink">
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      {suggestions.length > 0 ? (
        <section className="mt-4 rounded-3xl bg-mist p-6">
          <p className="text-[10px] font-black tracking-[0.18em] text-olive">OPTIONS</p>
          <p className="mt-2 text-sm leading-6 text-olive">Suggestions only. The routine stays put until you change it.</p>
          <ul className="mt-3 space-y-2">
            {suggestions.map((item) => (
              <li key={item.id} className="text-pretty text-sm leading-6 text-olive">
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
        <h2 className="text-xl font-black">Notes</h2>
        {note.trim() ? (
          <p className="mt-3 whitespace-pre-wrap text-pretty text-sm leading-6 text-quiet">{note}</p>
        ) : (
          <p className="mt-3 text-pretty text-sm leading-6 text-quiet">No note for today yet.</p>
        )}
        {history.length > 0 ? (
          <ul className="mt-5 space-y-3 border-t border-line pt-4">
            {history.map(([date, text]) => (
              <li key={date}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-soft">{date}</p>
                <p className="mt-1 whitespace-pre-wrap text-pretty text-sm leading-6 text-quiet">{text}</p>
              </li>
            ))}
          </ul>
        ) : null}
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
