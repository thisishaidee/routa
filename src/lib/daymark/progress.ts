import type { Checkpoint, DayProgress, ProgressMap, Routine, Settings } from "./types";
import { addDays, isoFromDate, mondayIndex, startOfWeek, todaysCheckpoints } from "./time";

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
  weekDone: number;
  weekTotal: number;
  weekPercent: number;
  bestDayLabel: string;
  lifetimeDone: number;
  streak: number;
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
    weekDone: 0,
    weekTotal: 0,
    weekPercent: 0,
    bestDayLabel: "—",
    lifetimeDone: 0,
    streak: 0,
    weekDays: [],
    grid: [],
  };
}

export function computeStats(
  routine: Routine | null,
  progress: ProgressMap,
  now: Date,
  settings: Settings,
): DaymarkStats {
  if (!routine) return emptyStats();
  const todayList = todaysCheckpoints(routine.checkpoints, now);
  const todayKeyValue = isoFromDate(now);
  const todayDay = progress[todayKeyValue] ?? { completedCheckpointIds: [], completedTaskIds: {} };
  const todayDone = todayList.filter((item) => isDone(todayDay, item.id)).length;
  const todayTotal = todayList.length;
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

  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = addDays(now, -offset);
    const list = todaysCheckpoints(routine.checkpoints, date);
    if (list.length === 0) {
      if (offset === 0) continue;
      break;
    }
    const key = isoFromDate(date);
    const map = progress[key] ?? { completedCheckpointIds: [], completedTaskIds: {} };
    const complete = list.every((item) => isDone(map, item.id));
    if (!complete) break;
    streak += 1;
  }

  return {
    todayDone,
    todayTotal,
    todayPercent: todayTotal === 0 ? 0 : Math.round((todayDone / todayTotal) * 100),
    weekDone,
    weekTotal,
    weekPercent: weekTotal === 0 ? 0 : Math.round((weekDone / weekTotal) * 100),
    bestDayLabel,
    lifetimeDone,
    streak,
    weekDays,
    grid,
  };
}
