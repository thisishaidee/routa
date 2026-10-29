import { useState } from "react";
import { ChartNoAxesColumn, House, ListChecks, Settings } from "lucide-react";
import { DaymarkMark } from "@/lib/daymark/icons";
import { useDaymark } from "@/lib/daymark/store";
import { blankCheckpoint } from "@/lib/daymark/templates";
import type { Checkpoint } from "@/lib/daymark/types";
import { CheckpointEditor } from "./checkpoint-editor";
import { Landing } from "./landing";
import { Onboarding } from "./onboarding";
import { ProgressView } from "./progress-view";
import { RoutineView } from "./routine-view";
import { SettingsView } from "./settings-view";
import { TodayView } from "./today-view";
import type { DaymarkView } from "./nav";

const NAV: { id: DaymarkView; label: string; Icon: typeof House }[] = [
  { id: "today", label: "Today", Icon: House },
  { id: "routine", label: "Routine", Icon: ListChecks },
  { id: "progress", label: "Progress", Icon: ChartNoAxesColumn },
  { id: "settings", label: "Settings", Icon: Settings },
];

export function DaymarkScreen({
  view,
  onNavigate,
}: {
  view: DaymarkView;
  onNavigate: (view: DaymarkView) => void;
}) {
  const { ready, entered, enterApp, profile, routine, saveCheckpoint, deleteCheckpoint } = useDaymark();
  const [editing, setEditing] = useState<Checkpoint | null>(null);

  if (!ready || !entered) {
    return (
      <Landing
        ready={ready}
        returning={Boolean(profile.onboarded || routine)}
        onEnter={enterApp}
      />
    );
  }

  if (!profile.onboarded && !routine) return <Onboarding />;

  const openEdit = (id: string) => {
    const found = routine?.checkpoints.find((item) => item.id === id);
    if (found) setEditing(found);
  };

  const initials = profile.name.trim()
    ? profile.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "You";

  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto flex max-w-6xl flex-col lg:flex-row">
        <aside className="hidden min-h-screen w-64 flex-col border-r border-line bg-cream p-7 lg:flex">
          <div className="mb-16 flex items-center gap-3 text-lg font-extrabold tracking-[0.14em]">
            <DaymarkMark />
            ROUTA
          </div>
          <nav className="space-y-2 text-sm" aria-label="Main">
            {NAV.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-full px-5 text-left ${
                    active ? "bg-lime font-bold text-forest" : "text-quiet"
                  }`}
                >
                  <item.Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-forest text-[10px] font-bold text-paper">
              {initials}
            </span>
            <span className="text-xs">
              <b className="block">{profile.name.trim() || "Your rhythm"}</b>
              <small className="text-quiet">{routine?.name || "ROUTA"}</small>
            </span>
          </div>
        </aside>

        <div className="w-full pb-24 lg:pb-0">
          {view === "today" ? <TodayView onNavigate={onNavigate} onEdit={openEdit} /> : null}
          {view === "routine" ? (
            <RoutineView onNavigate={onNavigate} onEdit={openEdit} onAdd={() => setEditing(blankCheckpoint())} />
          ) : null}
          {view === "progress" ? <ProgressView /> : null}
          {view === "settings" ? <SettingsView /> : null}

          <footer className="hidden justify-between border-t border-line px-12 py-5 text-[11px] text-soft lg:flex">
            <span>ROUTA · build your rhythm</span>
            <span>Reminders fire while this page is open.</span>
          </footer>
        </div>
      </div>

      <nav
        className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 rounded-full bg-forest p-2 shadow-lg lg:hidden"
        aria-label="Main"
      >
        <div className="flex items-center justify-between gap-1">
          {NAV.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full text-xs font-bold ${
                  active ? "bg-lime px-4 text-forest" : "text-paper/75"
                }`}
              >
                <item.Icon size={18} />
                <span className={active ? "" : "sr-only"}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {editing ? (
        <CheckpointEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(checkpoint) => {
            saveCheckpoint(checkpoint, { insert: true });
            setEditing(null);
          }}
          onDelete={
            routine?.checkpoints.some((item) => item.id === editing.id)
              ? () => {
                  deleteCheckpoint(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      ) : null}
    </main>
  );
}

export type { DaymarkView } from "./nav";
