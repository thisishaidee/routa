import type { Checkpoint, DayProgress, ProgressMap, Routine, Settings } from "./types";
import { addDays, hasStartedInDay, isoFromDate, mondayIndex, startOfWeek, todaysCheckpoints } from "./time";

export function isDone(day: DayProgress, checkpointId: string) {
  return day.completedCheckpointIds.includes(checkpointId);
}

export function isTaskDone(day: DayProgress, checkpointId: string, taskId: string) {
  return day.completedTaskIds[checkpointId]?.includes(taskId) ?? false;
}

export function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export interface WeekCell {
  dateKey: string;
  label: string;
  scheduled: boolean;
  done: boolean;
}

export interface CheckpointWeek {
  checkpoint: Checkpoint;
  cells: WeekCell[];
}

export interface DaymarkStats {
  todayDone: number;
  todayTotal: number;
  todayPercent: number;
  todayMissed: number;
  todayRemaining: number;
  todayTasksDone: number;
  todayTasksTotal: number;
  weekDone: number;
  weekTotal: number;
  weekPercent: number;
  bestDayLabel: string;
  lifetimeDone: number;
  streak: number;
  bestStreak: number;
  completedDays: number;
  missedIds: string[];
  weekDays: { dateKey: string; label: string; done: number; total: number }[];
  grid: CheckpointWeek[];
}

const SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function emptyStats(): DaymarkStats {
  return {
    todayDone: 0,
    todayTotal: 0,
    todayPercent: 0,
    todayMissed: 0,
    todayRemaining: 0,
    todayTasksDone: 0,
    todayTasksTotal: 0,
    weekDone: 0,
    weekTotal: 0,
    weekPercent: 0,
    bestDayLabel: "—",
    lifetimeDone: 0,
    streak: 0,
    bestStreak: 0,
    completedDays: 0,
    missedIds: [],
    weekDays: [],
    grid: [],
  };
}

function isDayComplete(list: Checkpoint[], day: DayProgress) {
  return list.length > 0 && list.every((item) => isDone(day, item.id));
}

export interface StreakSummary {
  streak: number;
  bestStreak: number;
  completedDays: number;
}

/**
 * Streak rules:
 * - A day counts when every checkpoint scheduled that day is done.
 * - A day with nothing scheduled is skipped. It neither extends nor breaks a streak.
 * - Today is skipped while it is unfinished. It adds one once it is complete.
 * - Any earlier scheduled day that was not completed ends the current streak.
 */
export function computeStreaks(routine: Routine, progress: ProgressMap, now: Date): StreakSummary {
  let current = 0;
  let counting = true;
  let run = 0;
  let best = 0;
  let completedDays = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = addDays(now, -offset);
    const list = todaysCheckpoints(routine.checkpoints, date);
    if (list.length === 0) continue;
    const day = progress[isoFromDate(date)] ?? { completedCheckpointIds: [], completedTaskIds: {} };
    if (isDayComplete(list, day)) {
      completedDays += 1;
      run += 1;
      if (run > best) best = run;
      if (counting) current += 1;
    } else if (offset === 0) {
      continue;
    } else {
      run = 0;
      counting = false;
    }
  }
  return { streak: current, bestStreak: Math.max(best, current), completedDays };
}

export function computeStats(
  routine: Routine | null,
  progress: ProgressMap,
  now: Date,
  settings: Settings,
  todayOverrides: Record<string, string> = {},
): DaymarkStats {
  if (!routine) return emptyStats();
  const todayList = todaysCheckpoints(
    routine.checkpoints.map((item) => (todayOverrides[item.id] ? { ...item, time: todayOverrides[item.id] } : item)),
    now,
  );
  const todayKeyValue = isoFromDate(now);
  const todayDay = progress[todayKeyValue] ?? { completedCheckpointIds: [], completedTaskIds: {} };
  const todayDone = todayList.filter((item) => isDone(todayDay, item.id)).length;
  const todayTotal = todayList.length;
  const missedIds = todayList
    .filter((item) => !isDone(todayDay, item.id) && hasStartedInDay(item.time, now))
    .map((item) => item.id);
  const todayRemaining = todayTotal - todayDone;
  let todayTasksDone = 0;
  let todayTasksTotal = 0;
  for (const item of todayList) {
    todayTasksTotal += item.tasks.length;
    todayTasksDone += item.tasks.filter((task) => isTaskDone(todayDay, item.id, task.id)).length;
  }

  const start = startOfWeek(now, settings.weekStartsOn);
  const weekDays: DaymarkStats["weekDays"] = [];
  let weekDone = 0;
  let weekTotal = 0;
  let bestDayLabel = "—";
  let bestRatio = -1;

  for (let i = 0; i < 7; i += 1) {
    const date = addDays(start, i);
    const key = isoFromDate(date);
    const list = todaysCheckpoints(routine.checkpoints, date);
    const day = progress[key] ?? { completedCheckpointIds: [], completedTaskIds: {} };
    const done = list.filter((item) => isDone(day, item.id)).length;
    weekDays.push({
      dateKey: key,
      label: SHORT[date.getDay()],
      done,
      total: list.length,
    });
    weekDone += done;
    weekTotal += list.length;
    if (list.length > 0) {
      const ratio = done / list.length;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestDayLabel = FULL[date.getDay()];
      }
    }
  }

  const enabled = routine.checkpoints.filter((item) => item.enabled);
  const grid: CheckpointWeek[] = enabled.map((checkpoint) => ({
    checkpoint,
    cells: weekDays.map((day, index) => {
      const date = addDays(start, index);
      const scheduled = checkpoint.repeatDays.includes(mondayIndex(date));
      const map = progress[day.dateKey] ?? { completedCheckpointIds: [], completedTaskIds: {} };
      return {
        dateKey: day.dateKey,
        label: day.label,
        scheduled,
        done: scheduled && isDone(map, checkpoint.id),
      };
    }),
  }));

  let lifetimeDone = 0;
  for (const day of Object.values(progress)) {
    lifetimeDone += day.completedCheckpointIds.length;
  }

  const { streak, bestStreak, completedDays } = computeStreaks(routine, progress, now);

  return {
    todayDone,
    todayTotal,
    todayPercent: todayTotal === 0 ? 0 : Math.round((todayDone / todayTotal) * 100),
    todayMissed: missedIds.length,
    todayRemaining,
    todayTasksDone,
    todayTasksTotal,
    weekDone,
    weekTotal,
    weekPercent: weekTotal === 0 ? 0 : Math.round((weekDone / weekTotal) * 100),
    bestDayLabel,
    lifetimeDone,
    streak,
    bestStreak,
    completedDays,
    missedIds,
    weekDays,
    grid,
  };
}
