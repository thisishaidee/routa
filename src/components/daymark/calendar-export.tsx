import { useState } from "react";
import { buildRoutineIcs, countExportable, icsFilename } from "@/lib/daymark/ics";
import { useDaymark } from "@/lib/daymark/store";

export function CalendarExportCard() {
  const { routine } = useDaymark();
  const [message, setMessage] = useState("");
  const count = routine ? countExportable(routine) : 0;

  const download = () => {
    if (!routine || count === 0) return;
    const blob = new Blob([buildRoutineIcs(routine)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = icsFilename(routine);
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Downloaded ${count} repeating event${count === 1 ? "" : "s"}.`);
  };

  return (
    <div className="rounded-3xl border border-line bg-paper p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Calendar</p>
      <h2 className="mt-2 text-xl font-black">Alerts that work when ROUTA is closed</h2>
      <p className="mt-2 text-pretty text-sm leading-6 text-quiet">
        Download your routine as a calendar file and import it into Apple, Google or Outlook Calendar. Each checkpoint
        becomes a weekly repeating event, with an alert at its time when its reminder is on.
      </p>
      <p className="mt-2 text-xs text-quiet">
        It is a snapshot, so download it again after you change your routine. Disabled checkpoints are left out.
      </p>
      <button
        type="button"
        onClick={download}
        disabled={count === 0}
        className="mt-4 h-12 rounded-full bg-forest px-5 text-sm font-bold text-paper disabled:opacity-50"
      >
        Download calendar file
      </button>
      {count === 0 ? <p className="mt-3 text-sm text-quiet">Add an enabled checkpoint to export.</p> : null}
      {message ? (
        <p role="status" className="mt-3 text-sm font-medium text-olive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
