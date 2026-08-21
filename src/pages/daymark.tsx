import { useEffect, useState } from "react";
import { Bell, Check, Flame, RotateCcw, Sparkles, Target } from "lucide-react";

const CIRCUIT =
  "15 push-ups, 20 squats, 12 lunges per leg, 30-sec plank, 20 mountain climbers per leg, 15 glute bridges, 30-sec jumping jacks";

const routine = [
  [
    "06:00",
    "Workout",
    "⚡",
    [
      "Warm-up",
      `Round 1 — ${CIRCUIT}`,
      `Round 2 — ${CIRCUIT}`,
      `Round 3 — ${CIRCUIT}`,
      "Stretch",
    ],
  ],
  ["06:30", "Morning routine", "☀", ["Shower", "Breakfast / coffee", "Check overnight Forex and news", "Review top 3 priorities"]],
  ["07:00", "Forex", "◆", ["Chart review", "Forex journal", "Concept study", "Write one market takeaway"]],
  ["07:45", "Hackathon", "◇", ["Continue the active hackathon build", "Ship one concrete improvement", "Test what changed", "Record progress"]],
  ["09:00", "AI prompting + breakfast", "✦", ["Practice prompt design", "Test prompts on a real task", "Refine the strongest result", "Breakfast / light meal"]],
  ["11:30", "AI content", "✎", ["Create the day's AI content", "Develop the hook and core idea", "Prepare the asset for editing"]],
  ["13:00", "Editing / content", "◒", ["Edit content", "Continue content work", "Reading", "Capture one useful idea"]],
  ["14:30", "Forex session check", "↗", ["Check the active Forex session", "Review setups and market context", "Update journal if needed"]],
  ["15:00", "Arc building update", "⌁", ["Work on Arc", "Record what was built", "Prepare the daily building update"]],
  ["17:00", "Publish + engage", "↗", ["Publish content", "Engage with the community", "Reply to meaningful conversations"]],
  ["20:00", "Frontend → Backend → Security", "⌘", ["Frontend → Backend → Security rotation", "Study the current concept", "Complete a hands-on exercise", "Save one key takeaway"]],
  ["21:30", "Review + journal", "◌", ["Review the day", "Review Forex", "Journal wins and mistakes", "Write tomorrow's priorities"]],
  ["00:00", "Frontend development", "⌘", ["Concept study / hands-on build", "Work on a personal project", "Test and improve the implementation", "Commit meaningful work to GitHub"]],
] as const;

const TOTAL = routine.length;
const FOREX = routine.findIndex((item) => item[1] === "Forex");
const HACKATHON = routine.findIndex((item) => item[1] === "Hackathon");
const SLICE = 360 / TOTAL;

const weekly = [
  ["Mon", "Foundations"],
  ["Tue", "Practice"],
  ["Wed", "Ship"],
  ["Thu", "Review"],
  ["Fri", "Publish"],
  ["Sat", "Explore"],
  ["Sun", "Reset"],
] as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function weekDay(date = new Date()) {
  const sundayBasedDay = date.getDay();
  return sundayBasedDay === 0 ? 6 : sundayBasedDay - 1;
}

function clockMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function sessionMinutes(hhmm: string) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

function liveIndex(date = new Date()) {
  const now = clockMinutes(date);
  const first = sessionMinutes(routine[0][0]);
  if (now < first) return TOTAL - 1;
  let index = 0;
  for (let i = 0; i < TOTAL; i += 1) {
    const start = sessionMinutes(routine[i][0]);
    if (start === 0) continue;
    if (start <= now) index = i;
  }
  return index;
}

function clockLabel(hhmm: string) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const suffix = hours >= 12 && hours < 24 ? "PM" : "AM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${pad(minutes)} ${suffix}`;
}

export default function Daymark() {
  const [now, setNow] = useState(() => new Date());
  const today = todayKey(now);
  const day = weekDay(now);
  const current = liveIndex(now);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState(FOREX);
  const [alarms, setAlarms] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem("daymark-done") || "{}"));
      setChecked(JSON.parse(localStorage.getItem("daymark-tasks") || "{}"));
      setAlarms(localStorage.getItem("daymark-alarms") === "on");
      setNote(localStorage.getItem(`daymark-note-${todayKey()}`) || "");
    } catch {
      setDone({});
      setChecked({});
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("daymark-done", JSON.stringify(done));
  }, [done, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("daymark-tasks", JSON.stringify(checked));
  }, [checked, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(`daymark-note-${today}`, note);
  }, [note, today, ready]);

  useEffect(() => {
    if (!ready || !alarms || !("Notification" in window) || Notification.permission !== "granted") return;

    const fire = (date: Date) => {
      const stamp = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
      const index = routine.findIndex((item) => item[0] === stamp);
      if (index < 0) return;
      const key = `daymark-alarm-${todayKey(date)}-${index}`;
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      const session = routine[index];
      new Notification(`Daymark · ${session[1]}`, {
        body: `${clockLabel(session[0])} — time for ${session[1]}.`,
      });
      setSelected(index);
    };

    fire(new Date());
    const tick = window.setInterval(() => fire(new Date()), 15000);
    return () => window.clearInterval(tick);
  }, [alarms, ready]);

  const complete = routine.filter((_, index) => done[`${today}-${index}`]).length;
  const remaining = TOTAL - complete;
  const percent = Math.round((complete / TOTAL) * 100);
  const active = routine[selected] ?? routine[FOREX];
  const focusTitle = selected === FOREX ? "Forex deep dive" : selected === HACKATHON ? "Hackathon build" : active[1];
  const taskTotal = routine.reduce(
    (total, activity, activityIndex) =>
      total + activity[3].filter((_, taskIndex) => checked[`${today}-${activityIndex}-${taskIndex}`]).length,
    0,
  );

  const toggleDone = (index: number) => {
    setDone((value) => ({ ...value, [`${today}-${index}`]: !value[`${today}-${index}`] }));
  };

  const requestAlarms = async () => {
    if ("Notification" in window && Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
    setAlarms(true);
    localStorage.setItem("daymark-alarms", "on");
  };

  const reset = () => {
    setDone({});
    setChecked({});
    setNote("");
    localStorage.removeItem(`daymark-note-${today}`);
  };

  return (
    <main className="min-h-screen bg-[#f5f6f2] text-[#18201c] selection:bg-[#d5e84b]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
      <div className="mx-auto flex max-w-6xl flex-col lg:flex-row">
        <aside className="hidden min-h-screen w-64 flex-col border-r border-[#dfe4dc] bg-[#f9faf7] p-7 lg:flex">
          <div className="mb-16 flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid size-8 place-items-center rounded-xl bg-[#b9d62e] text-sm">◒</span>
            daymark
          </div>
          <nav className="space-y-2 text-sm">
            <a className="flex items-center gap-3 rounded-xl bg-[#e8efcf] px-4 py-3 font-semibold" href="#today">⌂ <span>Today</span></a>
            <a className="flex items-center gap-3 px-4 py-3 text-[#718078]" href="#week">▦ <span>Weekly rhythm</span></a>
            <a className="flex items-center gap-3 px-4 py-3 text-[#718078]" href="#progress">↗ <span>Progress</span></a>
          </nav>
          <div className="mt-auto space-y-5">
            <button onClick={requestAlarms} className="flex w-full items-center gap-2 rounded-xl border border-[#dfe4dc] bg-white px-4 py-3 text-left text-sm">
              <Bell size={16} /> {alarms ? "Alarms on" : "Set alarms"}<span className="ml-auto size-2 rounded-full bg-[#b9d62e]" />
            </button>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-[#1f3d2c] text-xs font-bold text-white">HC</span>
              <span className="text-xs"><b className="block">Haidee</b><small className="text-[#849088]">Building momentum</small></span>
            </div>
          </div>
        </aside>

        <section className="w-full px-5 py-6 sm:px-8 lg:px-12 lg:py-12" id="today">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#809087]">
                {now.toLocaleDateString("en-NG", { weekday: "long", month: "short", day: "numeric" })} <span className="text-[#b9d62e]">●</span> Your daily rhythm
              </p>
              <h1 className="text-3xl font-black tracking-[-.04em] sm:text-5xl">Make today count.</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={reset} aria-label="Reset today" className="grid size-10 place-items-center rounded-xl border border-[#dfe4dc] bg-white text-[#65746b]"><RotateCcw size={17} /></button>
              <button onClick={requestAlarms} className={`hidden items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold sm:flex ${alarms ? "bg-[#e8efcf] text-[#35501f]" : "bg-[#1f3d2c] text-white"}`}>
                <Bell size={16} /> {alarms ? "Alarms enabled" : "Enable alarms"}
              </button>
            </div>
          </header>

          <div className="mt-9 grid gap-4 md:grid-cols-[1.1fr_.9fr]">
            <div className="flex items-center justify-between rounded-3xl bg-[#1f3d2c] p-6 text-white sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid size-10 place-items-center rounded-2xl bg-[#b9d62e] text-[#1f3d2c]"><Target size={19} /></span>
                <div>
                  <span className="text-sm text-[#b7c8b9]">Today's project score</span>
                  <strong className="mt-1 block text-4xl">{complete}<i className="text-lg font-normal text-[#b7c8b9]"> / {TOTAL}</i></strong>
                  <p className="mt-1 text-sm text-[#b7c8b9]">{remaining} checkpoint{remaining === 1 ? "" : "s"} left to complete your rhythm.</p>
                </div>
              </div>
              <div className="grid size-24 place-items-center rounded-full" style={{ background: `conic-gradient(#b9d62e ${complete * SLICE}deg, #45634c ${complete * SLICE}deg)` }}>
                <div className="grid size-[76px] place-items-center rounded-full bg-[#1f3d2c] text-center"><b>{percent}%</b><small className="block text-[9px] text-[#b7c8b9]">done</small></div>
              </div>
            </div>
            <div className="rounded-3xl border border-[#dfe4dc] bg-white p-6 sm:p-8">
              <div className="flex items-center gap-2 text-sm font-semibold"><span className="text-[#c49b3d]"><Sparkles size={16} /></span> Today's focus <span className="ml-auto rounded-full bg-[#f4f0df] px-2.5 py-1 text-[10px] font-bold text-[#8a743e]">{weekly[day][0]} · {weekly[day][1]}</span></div>
              <h2 className="mt-4 text-2xl font-black tracking-tight">{focusTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[#718078]">{weekly[day][1]} day: turn your focus into a small, visible improvement.</p>
              <button onClick={() => setSelected(selected === FOREX ? HACKATHON : FOREX)} className="mt-4 flex items-center gap-1 text-sm font-bold text-[#536c28]">Switch to {selected === FOREX ? "Hackathon" : "Forex"} →</button>
            </div>
          </div>

          <div className="mt-10 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-tight">Today's routine</h2>
              <p className="mt-1 text-sm text-[#7a887f]">Tap a session to see its improvement tasks · {TOTAL} checkpoints.</p>
            </div>
            <span className="hidden rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#7b897f] sm:block">{taskTotal} tasks checked</span>
          </div>
          <div className="mt-4 space-y-2">
            {routine.map((activity, index) => (
              <div
                key={activity[0]}
                onClick={() => setSelected(index)}
                className={`group flex items-center gap-3 rounded-2xl border p-3 transition sm:gap-5 sm:p-4 ${selected === index ? "border-[#bfd57d] bg-[#fbfcf8] shadow-sm" : "border-transparent bg-white hover:border-[#dfe4dc]"}`}
              >
                <span className="w-14 shrink-0 text-xs font-bold text-[#7b8a81] sm:w-16">{clockLabel(activity[0])}</span>
                <span className="grid size-9 place-items-center rounded-xl bg-[#e8efcf] text-lg sm:size-10">{activity[2]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`truncate text-sm font-bold sm:text-base ${done[`${today}-${index}`] ? "text-[#91a096] line-through" : ""}`}>{activity[1]}</h3>
                    {index === current && <span className="rounded-full bg-[#e8efcf] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#5c762c]">now</span>}
                    {index === FOREX && <span className="hidden rounded-full bg-[#eee9fa] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#7866a9] sm:inline">auto-pick</span>}
                  </div>
                  <p className="truncate text-xs text-[#8a978f]">{activity[3].length} improvement tasks · {activity[3][0]}</p>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleDone(index);
                  }}
                  aria-label={`Mark ${activity[1]} done`}
                  className={`grid size-8 shrink-0 place-items-center rounded-full border-2 ${done[`${today}-${index}`] ? "border-[#b9d62e] bg-[#b9d62e] text-[#1f3d2c]" : "border-[#d6ded7] bg-white text-transparent"}`}
                >
                  <Check size={16} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-[1.2fr_.8fr]">
            <section className="rounded-3xl border border-[#dfe4dc] bg-white p-6 sm:p-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black tracking-[.18em] text-[#96a29a]">IMPROVEMENT PLAN</p>
                  <h2 className="mt-2 text-2xl font-black">{active[1]}</h2>
                </div>
                <span className="rounded-full bg-[#e8efcf] px-3 py-1 text-xs font-bold text-[#5c762c]">{weekly[day][0]}</span>
              </div>
              <p className="mt-3 text-sm text-[#718078]">
                {selected === 0
                  ? "Exact 3-round circuit. Check a round only after every move is done."
                  : `${weekly[day][1]} day · small progress beats perfect plans.`}
              </p>
              <div className="mt-5 space-y-2">
                {active[3].map((task, taskIndex) => (
                  <button
                    key={`${selected}-${taskIndex}`}
                    onClick={() =>
                      setChecked((value) => ({
                        ...value,
                        [`${today}-${selected}-${taskIndex}`]: !value[`${today}-${selected}-${taskIndex}`],
                      }))
                    }
                    className="flex w-full items-center gap-3 rounded-xl bg-[#f6f8f3] p-3 text-left text-sm"
                  >
                    <span className={`grid size-5 shrink-0 place-items-center rounded-md border ${checked[`${today}-${selected}-${taskIndex}`] ? "border-[#b9d62e] bg-[#b9d62e]" : "border-[#cbd7cc] bg-white"}`}>
                      {checked[`${today}-${selected}-${taskIndex}`] && <Check size={13} />}
                    </span>
                    <span className={checked[`${today}-${selected}-${taskIndex}`] ? "text-[#91a096] line-through" : ""}>{task}</span>
                  </button>
                ))}
              </div>
              <label className="mt-6 block text-xs font-bold text-[#718078]">
                Daily note
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="What did you learn or ship today?"
                  className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#e0e6df] bg-[#fbfcfa] p-3 text-sm outline-none focus:border-[#b9d62e]"
                />
              </label>
            </section>
            <section className="rounded-3xl bg-[#e8efcf] p-6 sm:p-8" id="progress">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black tracking-[.18em] text-[#71834b]">KEEP GOING</p>
                  <h2 className="mt-2 text-2xl font-black">Momentum</h2>
                </div>
                <Flame className="text-[#b07825]" size={25} />
              </div>
              <strong className="mt-7 block text-5xl font-black">03 <small className="text-lg font-medium">days</small></strong>
              <p className="mt-2 text-sm leading-6 text-[#66745b]">Small wins compound. Show up for the next session.</p>
              <div className="mt-7 flex justify-between gap-2" id="week">
                {weekly.map(([label], index) => (
                  <div className="flex flex-1 flex-col items-center gap-2" key={label}>
                    <span className={`h-12 w-full rounded-lg ${index <= day ? "bg-[#7f9d35]" : "bg-[#d3e2af]"}`} />
                    <small className="text-[10px] font-bold text-[#71834b]">{label}</small>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex gap-2 rounded-xl bg-white/60 p-3 text-xs leading-5 text-[#61714f]">
                <Sparkles size={15} className="mt-0.5 shrink-0" />
                <span><b>Build the habit:</b> finish one task before opening a new tab.</span>
              </div>
            </section>
          </div>
          <footer className="mt-10 flex justify-between border-t border-[#dfe4dc] py-5 text-[11px] text-[#8a978f]">
            <span>daymark · {TOTAL} checkpoints · personal routine system</span>
            <span className="hidden sm:block">Browser alarms fire while this page is open.</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
