import type { Checkpoint, DayProgress } from "./types";
import { clockLabel, hasStartedInDay, pad, sessionMinutes, todaysCheckpoints } from "./time";

/** One day's time change. Does not rewrite the repeating checkpoint or past days. */
export interface DayMove {
  routineId: string;
  date: string;
  checkpointId: string;
  fromTime: string;
  time: string;
  createdAt: string;
}

export type RecoveryScope = "today" | "recurring";

export interface RecoveryOption {
  id: string;
  checkpointId: string;
  scope: RecoveryScope;
  fromTime: string;
  time: string;
  label: string;
  detail: string;
}

export interface RecoveryProposal {
  checkpointId: string;
  title: string;
  fromTime: string;
  message: string;
  options: RecoveryOption[];
}

export interface RecoveryInput {
  routineId: string;
  checkpoints: Checkpoint[];
  day: DayProgress;
  now: Date;
  date: string;
  moves: DayMove[];
  dismissedIds: string[];
}

const STEP = 30;
const GAP = 15;
const LAST_MINUTE = 23 * 60;

export function movesOnDate(moves: DayMove[], date: string, routineId?: string) {
  return moves.filter((move) => move.date === date && (!routineId || move.routineId === routineId));
}

export function timeOverrides(moves: DayMove[], date: string, routineId?: string) {
  const overrides: Record<string, string> = {};
  for (const move of movesOnDate(moves, date, routineId)) overrides[move.checkpointId] = move.time;
  return overrides;
}

export function withDayTimes(checkpoints: Checkpoint[], overrides: Record<string, string>) {
  if (Object.keys(overrides).length === 0) return checkpoints;
  return checkpoints.map((item) => (overrides[item.id] ? { ...item, time: overrides[item.id] } : item));
}

export function upsertDayMove(moves: DayMove[], move: DayMove) {
  return [
    ...moves.filter((item) => !(item.date === move.date && item.checkpointId === move.checkpointId && item.routineId === move.routineId)),
    move,
  ];
}

export function dropDayMove(moves: DayMove[], date: string, checkpointId: string) {
  return moves.filter((item) => !(item.date === date && item.checkpointId === checkpointId));
}

function hhmm(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

function occupiedMinutes(checkpoints: Checkpoint[], date: Date, skipId: string) {
  return todaysCheckpoints(checkpoints, date)
    .filter((item) => item.id !== skipId)
    .map((item) => sessionMinutes(item.time));
}

function conflictsAt(minutes: number, occupied: number[]) {
  return occupied.some((slot) => Math.abs(slot - minutes) < GAP);
}

function openSlots(now: Date, occupied: number[], limit: number) {
  const current = now.getHours() * 60 + now.getMinutes();
  let cursor = Math.ceil((current + GAP) / STEP) * STEP;
  if (cursor <= current) cursor += STEP;
  const slots: string[] = [];
  while (cursor <= LAST_MINUTE && slots.length < limit) {
    if (!conflictsAt(cursor, occupied)) slots.push(hhmm(cursor));
    cursor += STEP;
  }
  return slots;
}

function recurringConflict(checkpoints: Checkpoint[], checkpoint: Checkpoint, time: string) {
  const minute = sessionMinutes(time);
  const titles: string[] = [];
  for (const other of checkpoints) {
    if (other.id === checkpoint.id || !other.enabled) continue;
    if (sessionMinutes(other.time) !== minute) continue;
    if (!other.repeatDays.some((day) => checkpoint.repeatDays.includes(day))) continue;
    titles.push(other.title);
  }
  return titles;
}

/**
 * Local assistant. A future model can replace this function; callers only see proposals.
 * It never applies a change.
 */
export function suggestRecovery(input: RecoveryInput): RecoveryProposal[] {
  const overrides = timeOverrides(input.moves, input.date, input.routineId);
  const timed = withDayTimes(input.checkpoints, overrides);
  const today = todaysCheckpoints(timed, input.now);
  const proposals: RecoveryProposal[] = [];

  for (const checkpoint of today) {
    if (input.dismissedIds.includes(checkpoint.id)) continue;
    if (input.day.completedCheckpointIds.includes(checkpoint.id)) continue;
    if (!hasStartedInDay(checkpoint.time, input.now)) continue;
    const occupied = occupiedMinutes(timed, input.now, checkpoint.id);
    const slots = openSlots(input.now, occupied, 2);
    const options: RecoveryOption[] = slots.map((time) => ({
      id: `today-${checkpoint.id}-${time}`,
      checkpointId: checkpoint.id,
      scope: "today",
      fromTime: checkpoint.time,
      time,
      label: `Today at ${clockLabel(time)}`,
      detail: "Only this occurrence moves. The usual time stays.",
    }));
    const recurring = slots[0];
    if (recurring && recurringConflict(input.checkpoints, checkpoint, recurring).length === 0) {
      options.push({
        id: `recurring-${checkpoint.id}-${recurring}`,
        checkpointId: checkpoint.id,
        scope: "recurring",
        fromTime: checkpoint.time,
        time: recurring,
        label: `Every day at ${clockLabel(recurring)}`,
        detail: "Changes the usual time. Past days stay as they were.",
      });
    }
    proposals.push({
      checkpointId: checkpoint.id,
      title: checkpoint.title,
      fromTime: checkpoint.time,
      message:
        options.length > 0
          ? `${checkpoint.title} at ${clockLabel(checkpoint.time)} has passed. I can move it, or you can leave it.`
          : `${checkpoint.title} has passed, and there's no open time left today. You can leave it.`,
      options,
    });
    if (proposals.length >= 2) break;
  }
  return proposals;
}

export const RECOVERY_KEY = "routa:v2:recovery";

export interface RecoveryState {
  moves: DayMove[];
  dismissed: { date: string; checkpointId: string }[];
}

export const EMPTY_RECOVERY: RecoveryState = { moves: [], dismissed: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function coerceRecovery(value: unknown): RecoveryState {
  if (!isRecord(value)) return { moves: [], dismissed: [] };
  const moves = Array.isArray(value.moves)
    ? value.moves.flatMap((item) => {
        if (!isRecord(item)) return [];
        const date = typeof item.date === "string" ? item.date : "";
        const checkpointId = typeof item.checkpointId === "string" ? item.checkpointId : "";
        const time = typeof item.time === "string" ? item.time : "";
        const fromTime = typeof item.fromTime === "string" ? item.fromTime : time;
        const routineId = typeof item.routineId === "string" ? item.routineId : "";
        if (!date || !checkpointId || !time || !routineId) return [];
        return [
          {
            routineId,
            date,
            checkpointId,
            fromTime,
            time,
            createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
          } satisfies DayMove,
        ];
      })
    : [];
  const dismissed = Array.isArray(value.dismissed)
    ? value.dismissed.flatMap((item) => {
        if (!isRecord(item)) return [];
        const date = typeof item.date === "string" ? item.date : "";
        const checkpointId = typeof item.checkpointId === "string" ? item.checkpointId : "";
        if (!date || !checkpointId) return [];
        return [{ date, checkpointId }];
      })
    : [];
  return { moves, dismissed };
}

export function loadRecovery(): RecoveryState {
  try {
    if (typeof localStorage === "undefined") return { moves: [], dismissed: [] };
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return { moves: [], dismissed: [] };
    return coerceRecovery(JSON.parse(raw) as unknown);
  } catch {
    return { moves: [], dismissed: [] };
  }
}

export function saveRecovery(state: RecoveryState) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function optionStillFree(
  option: RecoveryOption,
  checkpoints: Checkpoint[],
  now: Date,
  overrides: Record<string, string>,
): boolean {
  const timed = withDayTimes(checkpoints, overrides);
  if (option.scope === "today") {
    const occupied = occupiedMinutes(timed, now, option.checkpointId);
    return !conflictsAt(sessionMinutes(option.time), occupied);
  }
  const checkpoint = checkpoints.find((item) => item.id === option.checkpointId);
  if (!checkpoint) return false;
  return recurringConflict(checkpoints, checkpoint, option.time).length === 0;
}
