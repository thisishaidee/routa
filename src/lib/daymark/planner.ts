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

interface ReadSession {
  title: string;
  time: string;
  duration: number;
  dayPart: { name: string; start: number; end: number } | null;
}

const WINDOWS = [
  { name: "morning", start: 5 * 60, end: 12 * 60 },
  { name: "afternoon", start: 12 * 60, end: 17 * 60 },
  { name: "evening", start: 17 * 60, end: 21 * 60 },
  { name: "night", start: 21 * 60, end: 23 * 60 },
];

function hasSignal(text: string) {
  return /\b(?:at|by|from)\s+\d|\b(?:morning|afternoon|evening|night)\b|\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?)|\ban\s+hour\b/i.test(
    text,
  );
}

function splitClauses(goal: string) {
  const chunks = goal
    .split(/\n+|;|\.\s+|\bthen\b/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
  const clauses: string[] = [];
  for (const chunk of chunks) {
    const pieces = chunk
      .split(/\s*,\s*|\s+and\s+/i)
      .map((item) => item.trim())
      .filter((item) => item.length > 1);
    if (pieces.length > 1 && pieces.some(hasSignal)) clauses.push(...pieces);
    else clauses.push(chunk);
  }
  return clauses;
}

function readClock(clause: string) {
  const match = clause.match(/\b(?:at|by|from)\s+(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?\b/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const suffix = match[3]?.toLowerCase();
  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return { minutes: hours * 60 + minutes, phrase: match[0] };
}

function readDuration(clause: string) {
  const hours = clause.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?)\b/i);
  if (hours) return { minutes: Math.round(Number(hours[1]) * 60), phrase: hours[0] };
  const mins = clause.match(/\b(\d+)\s*(minutes?|mins?)\b/i);
  if (mins) return { minutes: Number(mins[1]), phrase: mins[0] };
  const anHour = clause.match(/\ban\s+hour\b/i);
  if (anHour) return { minutes: 60, phrase: anHour[0] };
  return null;
}

function asTitle(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function durationLabel(minutes: number) {
  if (minutes > 0 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `About ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (minutes > 0) return `About ${minutes} minutes`;
  return "";
}

/** Sessions named in the goal. Times and durations come only from words that are actually there. */
export function interpretGoal(goal: string): ReadSession[] {
  const sessions: ReadSession[] = [];
  for (const clause of splitClauses(goal)) {
    if (sessions.length >= 6) break;
    const clock = readClock(clause);
    const duration = readDuration(clause);
    const dayPart = WINDOWS.find((item) => new RegExp(`\\b${item.name}\\b`, "i").test(clause)) ?? null;
    const title = asTitle(
      clause
        .replace(clock?.phrase ?? "\u0000", "")
        .replace(duration?.phrase ?? "\u0000", "")
        .replace(/\b(?:in the |this )?(morning|afternoon|evening|night)\b/gi, "")
        .replace(/^(?:i want to|i need to|i'd like to|please|also|can you|help me|i should)\s+/i, "")
        .replace(/^(?:go to the |go to |do )\s+/i, "")
        .replace(/\b(?:for|at|by|from|in the)\b/gi, "")
        .replace(/^[\s,.-]+|[\s,.-]+$/g, ""),
    );
    if (title.length < 2) continue;
    sessions.push({
      title,
      time: clock ? hhmm(clock.minutes) : "",
      duration: duration?.minutes ?? 0,
      dayPart,
    });
  }
  return sessions;
}

function sameTitle(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function takenMinutes(items: { time: string }[]) {
  return items.filter((item) => isValidTime(item.time)).map((item) => sessionMinutes(item.time));
}

function firstOpen(start: string, end: string, taken: number[]) {
  if (!isValidTime(start) || !isValidTime(end)) return "";
  return firstOpenRange(sessionMinutes(start), sessionMinutes(end), taken);
}

function firstOpenRange(start: number, end: number, taken: number[]) {
  if (end < start) return "";
  let cursor = start;
  if (cursor % STEP !== 0) cursor += STEP - (cursor % STEP);
  while (cursor <= end) {
    if (!taken.some((slot) => Math.abs(slot - cursor) < GAP)) return hhmm(cursor);
    cursor += STEP;
  }
  return "";
}

function hold(taken: number[], time: string, duration: number) {
  if (!isValidTime(time)) return;
  const start = sessionMinutes(time);
  const span = Math.max(duration, STEP);
  for (let cursor = start; cursor < start + span; cursor += STEP) taken.push(cursor);
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

  const taken: number[] = [];
  for (const item of [...existing, ...proposed]) hold(taken, item.time, 0);

  const read = interpretGoal(input.goal);
  read.forEach((session, index) => {
    if ([...existing, ...proposed].some((item) => sameTitle(item.title, session.title))) return;
    const dayStart = isValidTime(input.dayStart) ? sessionMinutes(input.dayStart) : 7 * 60;
    const dayEnd = isValidTime(input.dayEnd) ? sessionMinutes(input.dayEnd) : 22 * 60;
    let time = session.time;
    if (!time && session.dayPart) {
      time = firstOpenRange(Math.max(dayStart, session.dayPart.start), Math.min(dayEnd, session.dayPart.end), taken);
    }
    if (!time) time = firstOpenRange(dayStart, dayEnd, taken);
    hold(taken, time, session.duration);
    const about = durationLabel(session.duration);
    proposed.push({
      key: `goal-${index}`,
      title: session.title,
      time,
      tasks: about ? [about] : [],
      from: "goal",
    });
  });

  const notes = ["Nothing was added that you did not name."];
  const goalCount = proposed.filter((item) => item.from === "goal").length;
  if (named.length > 0) notes.push("Commitments stay at the time you set. A blank time uses an open hour inside the window you gave.");
  if (goalCount > 1) notes.push(`${goalCount} sessions were read from your goal. Nothing else was invented.`);
  else if (goalCount === 1) notes.push("One session was read from your goal. Nothing else was invented.");
  else if (!goalLine(input.goal)) notes.push("No goal block, because no goal was written.");
  else notes.push("No extra goal block, because that name is already in the plan.");
  if (splitClauses(input.goal).length > 6) notes.push("Only the first 6 things you named were drafted.");
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
