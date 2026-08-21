import { Check } from "lucide-react";
import { DaymarkMark } from "@/lib/daymark/icons";

const PREVIEW = [
  { time: "06:00", title: "Workout", done: true },
  { time: "07:00", title: "Deep work", done: true },
  { time: "09:00", title: "Learning", done: true },
  { time: "11:30", title: "Create", done: false },
  { time: "17:00", title: "Publish", done: false },
  { time: "21:30", title: "Review", done: false },
] as const;

const VALUES = [
  { label: "Plan", line: "Build your rhythm." },
  { label: "Follow", line: "Stay on track." },
  { label: "Grow", line: "See your progress." },
] as const;

export function Landing({
  ready,
  returning,
  onEnter,
}: {
  ready: boolean;
  returning: boolean;
  onEnter: () => void;
}) {
  return (
    <main className="min-h-dvh bg-canvas px-5 text-ink sm:px-8">
      <div className="mx-auto grid min-h-dvh w-full max-w-md grid-cols-1 content-center py-8 lg:max-w-4xl lg:grid-cols-2 lg:items-center lg:gap-x-16 lg:py-16">
        <header className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="daymark-rise flex items-center gap-2 text-lg font-bold tracking-tight">
            <DaymarkMark />
            routa
          </div>
          <h1 className="daymark-rise-delay mt-6 max-w-sm text-4xl font-black tracking-[-0.04em] text-balance sm:mt-7 sm:text-5xl lg:max-w-md">
            Your day, with a direction.
          </h1>
          <p className="daymark-rise-delay mt-3 max-w-sm text-pretty text-sm leading-6 text-quiet sm:mt-4">
            Build a routine around what matters, stay on track, and make progress one checkpoint at a time.
          </p>
        </header>

        <RoutinePreview className="daymark-rise-action mt-6 sm:mt-8 lg:col-start-2 lg:row-span-3 lg:mt-0" />

        <ul className="daymark-rise mt-6 grid grid-cols-3 gap-3 sm:mt-8 lg:col-start-1 lg:max-w-md" style={{ animationDelay: "320ms" }}>
          {VALUES.map((item) => (
            <li key={item.label} className="min-w-0 text-center lg:text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-soft">{item.label}</p>
              <p className="mt-1 text-pretty text-xs leading-5 text-quiet">{item.line}</p>
            </li>
          ))}
        </ul>

        {ready ? (
          <button
            type="button"
            onClick={onEnter}
            className="daymark-rise relative z-10 mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-forest px-6 text-sm font-bold text-paper transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime sm:mt-8 lg:col-start-1 lg:w-auto lg:min-w-52"
            style={{ animationDelay: "400ms" }}
          >
            {returning ? "Continue →" : "Build my routine →"}
          </button>
        ) : (
          <div className="mt-6 h-12 sm:mt-8 lg:col-start-1" aria-hidden="true" />
        )}
      </div>
    </main>
  );
}

function RoutinePreview({ className }: { className?: string }) {
  return (
    <section
      className={`w-full rounded-3xl border border-line bg-paper p-5 text-left shadow-sm ${className ?? ""}`}
      aria-label="Sample day with six checkpoints"
    >
      <p className="text-[10px] font-black tracking-[0.18em] text-soft">TODAY</p>
      <ol className="mt-4 space-y-0.5">
        {PREVIEW.map((item) => (
          <li key={item.time} className="flex items-center gap-3 rounded-xl py-1.5">
            <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-quiet">{item.time}</span>
            <span className={`min-w-0 flex-1 truncate text-sm font-bold ${item.done ? "text-soft" : "text-ink"}`}>
              {item.title}
            </span>
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                item.done ? "border-lime bg-lime text-forest" : "border-line bg-paper text-transparent"
              }`}
              aria-hidden="true"
            >
              <Check size={12} strokeWidth={3} />
            </span>
            {item.done ? <span className="sr-only">done</span> : null}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs font-bold text-quiet">
        <span className="tabular-nums">3 / 13</span> checkpoints
      </p>
    </section>
  );
}
