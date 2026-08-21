import { DaymarkMark } from "@/lib/daymark/icons";

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
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 text-ink">
      <div className="flex flex-col items-center text-center">
        <div className="daymark-rise mb-5 flex items-center justify-center gap-2 text-lg font-bold tracking-tight">
          <DaymarkMark />
          routa
        </div>
        <p className="daymark-rise-delay text-sm text-quiet">Build a daily rhythm that works for you.</p>
        {ready ? (
          <button
            type="button"
            onClick={onEnter}
            className="daymark-rise-action mt-10 h-12 min-w-44 rounded-2xl bg-forest px-6 text-sm font-bold text-paper transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            {returning ? "Continue" : "Get started"}
          </button>
        ) : (
          <div className="mt-10 h-12" aria-hidden="true" />
        )}
      </div>
    </main>
  );
}
