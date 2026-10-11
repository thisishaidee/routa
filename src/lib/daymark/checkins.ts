import { computeStats, isDone } from "./progress";
import { addDays, isoFromDate, todaysCheckpoints } from "./time";
import type { ProgressMap, Routine } from "./types";

/** A local-day check-in. Separate from checkpoint completion. */
export interface CheckInRecord {
  date: string;
  startedAt?: string;
  closedAt?: string;
}

export type BadgeId =
  | "first-check-in"
  | "first-routine-completed"
  | "check-in-streak-3"
  | "consistency-7"
  | "milestone-30"
  | "first-full-day";

export interface EarnedBadge {
  id: BadgeId;
  earnedOn: string;
  earnedAt: string;
}

export interface CheckInState {
  checkIns: CheckInRecord[];
  badges: EarnedBadge[];
}

export const CHECKIN_KEY = "routa:v2:checkins";
export const EMPTY_CHECKINS: CheckInState = { checkIns: [], badges: [] };

export const BADGES: { id: BadgeId; title: string; detail: string }[] = [
  { id: "first-check-in", title: "First Check-in", detail: "You checked in." },
  { id: "first-routine-completed", title: "First Routine Completed", detail: "You finished a checkpoint." },
  { id: "check-in-streak-3", title: "3-Day Check-in Streak", detail: "Three check-ins in a row." },
  { id: "consistency-7", title: "7-Day Consistency", detail: "Seven scheduled days finished in a row." },
  { id: "milestone-30", title: "30-Day Milestone", detail: "Thirty days you checked in." },
  { id: "first-full-day", title: "First Full Day Completed", detail: "Every scheduled checkpoint done in one day." },
];

const BADGE_IDS = new Set<string>(BADGES.map((item) => item.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shiftDateKey(key: string, amount: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return key;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + amount);
  return isoFromDate(date);
}

function activeDates(checkIns: CheckInRecord[]) {
  const dates = new Set<string>();
  for (const item of checkIns) {
    if (item.startedAt || item.closedAt) dates.add(item.date);
  }
  return dates;
}

export function markCheckIn(state: CheckInState, date: string, kind: "start" | "close", at: string): CheckInState {
  const existing = state.checkIns.find((item) => item.date === date);
  if (kind === "start" && existing?.startedAt) return state;
  if (kind === "close" && existing?.closedAt) return state;
  const next: CheckInRecord = existing
    ? {
        ...existing,
        startedAt: kind === "start" ? existing.startedAt ?? at : existing.startedAt,
        closedAt: kind === "close" ? existing.closedAt ?? at : existing.closedAt,
      }
    : kind === "start"
      ? { date, startedAt: at }
      : { date, closedAt: at };
  const checkIns = existing
    ? state.checkIns.map((item) => (item.date === date ? next : item))
    : [...state.checkIns, next];
  return { ...state, checkIns };
}

/** Consecutive local days with a check-in. Today still open does not wipe yesterday. */
export function checkInStreak(checkIns: CheckInRecord[], today: string) {
  const dates = activeDates(checkIns);
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    run = index > 0 && shiftDateKey(sorted[index - 1], 1) === sorted[index] ? run + 1 : 1;
    if (run > best) best = run;
  }
  let current = 0;
  let cursor = dates.has(today) ? today : shiftDateKey(today, -1);
  while (dates.has(cursor)) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  if (current > best) best = current;
  return { current, best, total: dates.size };
}

/**
 * Finished scheduled days in a row. Days with nothing scheduled are skipped,
 * not treated as misses. Today still unfinished does not break the current run.
 */
export function scheduledFinishStreak(routine: Routine | null, progress: ProgressMap, now: Date) {
  if (!routine) return { current: 0, best: 0, anyFinished: false };
  let best = 0;
  let run = 0;
  let current = 0;
  let broken = false;
  let anyFinished = false;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = addDays(now, -offset);
    const list = todaysCheckpoints(routine.checkpoints, date);
    if (list.length === 0) continue;
    const map = progress[isoFromDate(date)] ?? { completedCheckpointIds: [], completedTaskIds: {} };
    const done = list.every((item) => isDone(map, item.id));
    if (done) {
      anyFinished = true;
      run += 1;
      if (run > best) best = run;
      if (!broken) current += 1;
    } else if (offset !== 0) {
      run = 0;
      broken = true;
    }
  }
  return { current, best, anyFinished };
}

export function eligibleBadgeIds(
  checkIns: CheckInRecord[],
  today: string,
  routine: Routine | null,
  progress: ProgressMap,
  now: Date,
): BadgeId[] {
  const streak = checkInStreak(checkIns, today);
  const stats = computeStats(routine, progress, now, { weekStartsOn: 1, remindersEnabled: false });
  const finished = scheduledFinishStreak(routine, progress, now);
  const ids: BadgeId[] = [];
  if (streak.total >= 1) ids.push("first-check-in");
  if (stats.lifetimeDone >= 1) ids.push("first-routine-completed");
  if (streak.best >= 3) ids.push("check-in-streak-3");
  if (finished.best >= 7 || finished.current >= 7) ids.push("consistency-7");
  if (streak.total >= 30) ids.push("milestone-30");
  if (stats.completedDays >= 1 || finished.anyFinished) ids.push("first-full-day");
  return ids;
}

export function syncBadges(
  state: CheckInState,
  routine: Routine | null,
  progress: ProgressMap,
  today: string,
  now = new Date(),
): CheckInState {
  const have = new Set(state.badges.map((item) => item.id));
  const missing = eligibleBadgeIds(state.checkIns, today, routine, progress, now).filter((id) => !have.has(id));
  if (missing.length === 0) return state;
  const earnedAt = now.toISOString();
  return {
    ...state,
    badges: [...state.badges, ...missing.map((id) => ({ id, earnedOn: today, earnedAt }))],
  };
}

export function recentCheckIns(checkIns: CheckInRecord[], limit = 14) {
  return checkIns
    .filter((item) => item.startedAt || item.closedAt)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}

export function coerceCheckIns(value: unknown): CheckInState {
  if (!isRecord(value)) return { checkIns: [], badges: [] };
  const checkIns = Array.isArray(value.checkIns)
    ? value.checkIns.flatMap((item) => {
        if (!isRecord(item) || typeof item.date !== "string" || !item.date) return [];
        const startedAt = typeof item.startedAt === "string" ? item.startedAt : undefined;
        const closedAt = typeof item.closedAt === "string" ? item.closedAt : undefined;
        if (!startedAt && !closedAt) return [];
        return [{ date: item.date, startedAt, closedAt }];
      })
    : [];
  const badges = Array.isArray(value.badges)
    ? value.badges.flatMap((item) => {
        if (!isRecord(item) || typeof item.id !== "string" || !BADGE_IDS.has(item.id)) return [];
        const earnedOn = typeof item.earnedOn === "string" ? item.earnedOn : "";
        const earnedAt = typeof item.earnedAt === "string" ? item.earnedAt : "";
        if (!earnedOn || !earnedAt) return [];
        return [{ id: item.id as BadgeId, earnedOn, earnedAt }];
      })
    : [];
  const seen = new Set<string>();
  const unique = badges.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return { checkIns, badges: unique };
}

export function loadCheckIns(): CheckInState {
  try {
    if (typeof localStorage === "undefined") return { checkIns: [], badges: [] };
    const raw = localStorage.getItem(CHECKIN_KEY);
    if (!raw) return { checkIns: [], badges: [] };
    return coerceCheckIns(JSON.parse(raw) as unknown);
  } catch {
    return { checkIns: [], badges: [] };
  }
}

export function saveCheckIns(state: CheckInState) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
