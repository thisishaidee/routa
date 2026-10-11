import type { Checkpoint } from "./types";
import { isValidTime, normalizeTime, sessionMinutes } from "./time";

export interface PlannerCommitment {
  title: string;
  time?: string;
}

export interface PlannerInput {
  goal: string;
  dayStart: string;
  dayEnd: string;
  commitments: PlannerCommitment[];
  existing: Checkpoint[];
}

export interface DraftCheckpoint {
  key: string;
  title: string;
  time: string;
  tasks: string[];
  from: "commitment" | "goal";
  conflict?: string;
}

export interface PlannerExisting {
  id: string;
  title: string;
  time: string;
}

export interface PlannerDraft {
  summary: string;
  notes: string[];
  existing: PlannerExisting[];
  proposed: DraftCheckpoint[];
}

/** Callers depend on this shape, not on which model produced it. */
export interface RoutinePlanner {
  id: string;
  plan(input: PlannerInput): PlannerDraft;
}

const GAP = 15;
const STEP = 30;

function hhmm(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function goalLine(goal: string) {
  return goal.trim().replace(/\s+/g, " ");
}

function sameTitle(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function takenMinutes(items: { time: string }[]) {
  return items.filter((item) => isValidTime(item.time)).map((item) => sessionMinutes(item.time));
}

function firstOpen(start: string, end: string, taken: number[]) {
  if (!isValidTime(start) || !isValidTime(end)) return "";
  let cursor = sessionMinutes(start);
  const last = sessionMinutes(end);
  if (last < cursor) return "";
  if (cursor % STEP !== 0) cursor += STEP - (cursor % STEP);
  while (cursor <= last) {
    if (!taken.some((slot) => Math.abs(slot - cursor) < GAP)) return hhmm(cursor);
    cursor += STEP;
  }
  return "";
}

export function annotateConflicts(proposed: DraftCheckpoint[], existing: { title: string; time: string }[]): DraftCheckpoint[] {
  return proposed.map((item, index) => {
    if (!isValidTime(item.time)) {
      return { ...item, conflict: item.time.trim() ? "Enter a time like 18:30." : "Choose a time." };
    }
    const minute = sessionMinutes(item.time);
    const others = [
      ...existing.filter((entry) => isValidTime(entry.time)),
      ...proposed.filter((entry, entryIndex) => entryIndex !== index && isValidTime(entry.time)),
    ];
    const hit = others.find((entry) => Math.abs(sessionMinutes(entry.time) - minute) < GAP);
    return { ...item, conflict: hit ? `Overlaps ${hit.title}.` : undefined };
  });
}

function planLocal(input: PlannerInput): PlannerDraft {
  const existing = input.existing.map((item) => ({
    id: item.id,
    title: item.title,
    time: normalizeTime(item.time),
  }));
  const proposed: DraftCheckpoint[] = [];
  const named = input.commitments
    .map((item) => ({ title: item.title.trim().replace(/\s+/g, " "), time: item.time?.trim() ?? "" }))
    .filter((item) => item.title.length > 0);

  named.forEach((item, index) => {
    const time = isValidTime(item.time)
      ? normalizeTime(item.time)
      : item.time
        ? item.time
        : firstOpen(input.dayStart, input.dayEnd, takenMinutes([...existing, ...proposed]));
    proposed.push({
      key: `commitment-${index}`,
      title: item.title,
      time,
      tasks: [],
      from: "commitment",
    });
  });

  const goal = goalLine(input.goal);
  const goalTitle = goal.length > 48 ? `${goal.slice(0, 48).trim()}…` : goal;
  const alreadyNamed =
    goalTitle.length > 0 &&
    [...existing, ...proposed].some((item) => sameTitle(item.title, goalTitle) || sameTitle(item.title, goal));
  if (goalTitle && !alreadyNamed) {
    const time = firstOpen(input.dayStart, input.dayEnd, takenMinutes([...existing, ...proposed]));
    proposed.push({
      key: "goal",
      title: goalTitle,
      time,
      tasks: goal.length > goalTitle.length ? [goal.slice(0, 140)] : [],
      from: "goal",
    });
  }

  const notes = ["Nothing was added that you did not name."];
  if (named.length > 0) notes.push("Commitments stay at the time you set. A blank time uses an open hour inside the window you gave.");
  if (proposed.some((item) => item.from === "goal")) notes.push("One block uses your goal, in an open hour.");
  else if (!goal) notes.push("No goal block, because no goal was written.");
  else notes.push("No extra goal block, because that name is already in the plan.");
  if (existing.length > 0) {
    notes.push(
      `${existing.length} session${existing.length === 1 ? "" : "s"} already in your routine ${existing.length === 1 ? "was" : "were"} left as ${existing.length === 1 ? "it is" : "they are"}.`,
    );
  }

  const withConflicts = annotateConflicts(proposed, existing);
  const added = withConflicts.length;
  return {
    summary:
      added === 0
        ? "Nothing new to add. Your routine was not changed."
        : `${added} session${added === 1 ? "" : "s"} to review. Nothing is saved until you confirm.`,
    notes,
    existing,
    proposed: withConflicts,
  };
}

const localPlanner: RoutinePlanner = { id: "local", plan: planLocal };

/** Local planner today. A later model can replace this without changing the review screen. */
export function getRoutinePlanner(): RoutinePlanner {
  return localPlanner;
}
