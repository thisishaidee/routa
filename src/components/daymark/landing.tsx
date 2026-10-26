import { Check } from "lucide-react";
import { DaymarkMark } from "@/lib/daymark/icons";

const REPO_URL = "https://github.com/thisishaidee/routa";

type Status = "done" | "missed" | "now" | "next";

const STATUS_LABEL: Record<Status, string> = {
  done: "done",
  missed: "missed",
  now: "now",
  next: "upcoming",
};

const PREVIEW: { time: string; title: string; status: Status }[] = [
  { time: "06:00", title: "Workout", status: "done" },
  { time: "07:00", title: "Deep work", status: "done" },
  { time: "09:00", title: "Learning", status: "done" },
  { time: "11:30", title: "Create", status: "missed" },
  { time: "13:00", title: "Editing", status: "now" },
  { time: "17:00", title: "Publish", status: "next" },
];

const STEPS = [
  { title: "Pick a rhythm", line: "Start from a template or describe your goal." },
  { title: "Check off checkpoints", line: "One clear next step, all day." },
  { title: "Recover, don’t restart", line: "Missed one? Move it today, change its time, or leave it." },
] as const;

const FEATURES = [
  { title: "Local-first", line: "No account. Your routine stays on this device.", swatch: "bg-mist" },
  { title: "Gentle recovery", line: "Slips become a choice, not a failure.", swatch: "daymark-hatch border border-line" },
  { title: "Real progress", line: "Streaks and a weekly view built from your check-offs.", swatch: "bg-forest" },
  { title: "Honest reminders", line: "Alerts fire while ROUTA is open. We say so.", swatch: "bg-lime" },
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
    <main className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto w-full max-w-md px-5 pb-12 sm:px-8 lg:max-w-6xl lg:px-12">
        <header className="daymark-rise flex h-20 items-center justify-between">
          <div className="flex items-center gap-3 text-lg font-extrabold tracking-[0.14em]">
            <DaymarkMark />
            ROUTA
          </div>
          <nav className="flex items-center gap-8 text-sm font-semibold" aria-label="Page">
            <a href="#how" className="hidden hover:text-forest lg:inline">
              How it works
            </a>
            <a href="#features" className="hidden hover:text-forest lg:inline">
              Features
            </a>
            <a href="#agents" className="hidden hover:text-forest lg:inline">
              Agents
            </a>
            {ready ? (
              <button
                type="button"
                onClick={onEnter}
                className="h-11 rounded-full border border-line bg-paper px-5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                Open app
              </button>
            ) : null}
          </nav>
        </header>

        <section className="grid gap-8 pt-4 lg:grid-cols-[1fr_26rem] lg:items-center lg:gap-x-20 lg:pt-12">
          <div className="flex flex-col">
            <h1 className="daymark-rise-delay text-[2.6rem] font-black leading-[1.02] tracking-[-0.045em] text-balance lg:text-7xl">
              Your day, with a direction.
            </h1>
            <p className="daymark-rise-delay mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-quiet lg:text-lg">
              Build a routine around what matters, stay on track, and recover calmly when a checkpoint slips.
            </p>
            <div className="daymark-rise-action mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
              <EnterButton ready={ready} returning={returning} onEnter={onEnter} className="w-full lg:w-auto" />
              <p className="text-center text-xs text-quiet lg:text-left lg:text-sm">No account. Stays on your device.</p>
            </div>
          </div>
          <SampleDay className="daymark-rise-action" />
        </section>

        <section id="how" className="mt-16 scroll-mt-6 lg:mt-24" aria-labelledby="how-title">
          <h2 id="how-title" className="text-[11px] font-black tracking-[0.12em] text-quiet">
            HOW IT WORKS
          </h2>
          <ol className="mt-4 grid gap-4 lg:grid-cols-3 lg:gap-6">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="flex items-start gap-4 lg:flex-col lg:rounded-3xl lg:border lg:border-line lg:bg-paper lg:p-6"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lime text-xs font-black text-forest">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-base font-extrabold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-quiet">{step.line}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className="mt-16 scroll-mt-6 lg:mt-24" aria-labelledby="features-title">
          <h2 id="features-title" className="text-[11px] font-black tracking-[0.12em] text-quiet">
            BUILT DIFFERENTLY
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="rounded-3xl border border-line bg-paper p-4 lg:p-6">
                <span aria-hidden="true" className={`mb-3 block size-9 rounded-xl ${feature.swatch}`} />
                <h3 className="text-sm font-extrabold lg:text-base">{feature.title}</h3>
                <p className="mt-1 text-xs leading-5 text-quiet lg:text-sm lg:leading-6">{feature.line}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="agents"
          className="mt-16 scroll-mt-6 rounded-3xl bg-ink p-6 text-paper lg:mt-24 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:p-10"
          aria-labelledby="agents-title"
        >
          <div className="max-w-xl">
            <p className="text-[11px] font-black tracking-[0.12em] text-lime">FOR AI AGENTS</p>
            <h2 id="agents-title" className="mt-2 text-2xl font-extrabold tracking-tight lg:text-3xl">
              Let Claude or Cursor edit your routine.
            </h2>
            <p className="mt-2 text-sm leading-6 text-paper/75">
              Connect through the local MCP server and change checkpoints in plain language.
            </p>
          </div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex h-12 items-center rounded-full bg-lime px-6 text-sm font-bold text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime lg:mt-0 lg:shrink-0"
          >
            View on GitHub
          </a>
        </section>

        <section className="mt-6 rounded-3xl border border-line bg-paper p-5" aria-labelledby="note-title">
          <h2 id="note-title" className="text-sm font-extrabold">
            Good to know
          </h2>
          <p className="mt-1 text-sm leading-6 text-quiet">
            Reminders are browser notifications, so they only fire while the page is open.
          </p>
        </section>

        <section className="mt-16 flex flex-col items-center gap-5 text-center lg:mt-24">
          <h2 className="text-3xl font-black leading-[1.05] tracking-[-0.04em] lg:text-5xl">
            Ready for a day
            <br />
            with direction?
          </h2>
          <EnterButton ready={ready} returning={returning} onEnter={onEnter} className="w-full lg:w-auto" />
        </section>

        <footer className="mt-16 flex items-center justify-between border-t border-line pt-5 text-xs lg:mt-24">
          <span className="font-extrabold tracking-[0.14em]">ROUTA</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="font-semibold text-quiet hover:text-forest">
            GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}

function EnterButton({
  ready,
  returning,
  onEnter,
  className,
}: {
  ready: boolean;
  returning: boolean;
  onEnter: () => void;
  className?: string;
}) {
  if (!ready) return <div className="h-14" aria-hidden="true" />;
  return (
    <button
      type="button"
      onClick={onEnter}
      className={`inline-flex h-14 items-center justify-center rounded-full bg-forest px-8 text-sm font-bold text-paper transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${className ?? ""}`}
    >
      {returning ? "Continue →" : "Build my routine →"}
    </button>
  );
}

function Marker({ status }: { status: Status }) {
  if (status === "done") {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-lime text-forest" aria-hidden="true">
        <Check size={12} strokeWidth={3} />
      </span>
    );
  }
  if (status === "missed") {
    return <span className="daymark-hatch size-6 shrink-0 rounded-full border-2 border-paper/40" aria-hidden="true" />;
  }
  if (status === "now") {
    return <span className="size-6 shrink-0 rounded-full border-4 border-lime bg-forest" aria-hidden="true" />;
  }
  return <span className="size-6 shrink-0 rounded-full border-2 border-paper/40" aria-hidden="true" />;
}

function SampleDay({ className }: { className?: string }) {
  return (
    <section
      className={`rounded-3xl bg-[radial-gradient(120%_120%_at_100%_0%,var(--color-forest-mid)_0,var(--color-forest)_60%)] p-5 text-paper lg:p-6 ${className ?? ""}`}
      aria-label="Sample day with six checkpoints"
    >
      <p className="text-[11px] font-black tracking-[0.12em] text-mist">TODAY</p>
      <ol className="mt-3 space-y-1">
        {PREVIEW.map((item) => (
          <li
            key={item.time}
            className={`flex h-12 items-center gap-3 rounded-2xl px-3 ${item.status === "now" ? "bg-white/10" : ""}`}
          >
            <span
              className={`w-12 shrink-0 text-xs font-bold tabular-nums ${item.status === "now" ? "text-mist" : "text-paper/70"}`}
            >
              {item.time}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-sm ${item.status === "now" ? "font-extrabold" : "font-semibold"} ${
                item.status === "done" ? "text-paper/70" : ""
              }`}
            >
              {item.title}
            </span>
            <Marker status={item.status} />
            <span className="sr-only">{STATUS_LABEL[item.status]}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs font-bold text-paper/80">
        <span className="tabular-nums">3 / 6</span> checkpoints
      </p>
      <ul className="mt-3 flex gap-4 text-[11px] text-paper/80" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-lime" />
          Done
        </li>
        <li className="flex items-center gap-1.5">
          <span className="daymark-hatch size-2.5 rounded-full border border-paper/40" />
          Missed
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-lime" />
          Now
        </li>
      </ul>
    </section>
  );
}
