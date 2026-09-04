import type { Checkpoint, ProgressMap, Routine } from "./types";
import { isDone, isTaskDone } from "./progress";
import { addDays, clockLabel, isoFromDate, mondayIndex, sessionMinutes, todaysCheckpoints } from "./time";

export interface Insight {
  id: string;
  text: string;
}

export interface Suggestion {
  id: string;
  text: string;
}

export interface RoutineHealth {
  label: "New" | "Strong" | "Steady" | "Uneven" | "Overloaded";
  detail: string;
}

function dayComplete(list: Checkpoint[], progress: ProgressMap, date: Date) {
  if (list.length === 0) return false;
  const map = progress[isoFromDate(date)] ?? { completedCheckpointIds: [], completedTaskIds: {} };
  return list.every((item) => isDone(map, item.id));
}

export function computeInsights(routine: Routine | null, progress: ProgressMap, now: Date): Insight[] {
  if (!routine) return [];
  const todayList = todaysCheckpoints(routine.checkpoints, now);
  const todayMap = progress[isoFromDate(now)] ?? { completedCheckpointIds: [], completedTaskIds: {} };
  const todayDone = todayList.filter((item) => isDone(todayMap, item.id)).length;
  const insights: Insight[] = [];

  if (todayList.length > 0) {
    insights.push({
      id: "today-count",
      text: `You completed ${todayDone} of ${todayList.length} checkpoint${todayList.length === 1 ? "" : "s"} today.`,
    });
  }

  let morningDone = 0;
  let morningTotal = 0;
  const missCounts = new Map<string, { title: string; time: string; missed: number }>();
  const start = addDays(now, -6);

  for (let i = 0; i < 7; i += 1) {
    const date = addDays(start, i);
    const list = todaysCheckpoints(routine.checkpoints, date);
    const map = progress[isoFromDate(date)] ?? { completedCheckpointIds: [], completedTaskIds: {} };
    for (const item of list) {
      const done = isDone(map, item.id);
      if (sessionMinutes(item.time) < 12 * 60) {
        morningTotal += 1;
        if (done) morningDone += 1;
      }
      if (!done) {
        const current = missCounts.get(item.id) ?? { title: item.title, time: item.time, missed: 0 };
        current.missed += 1;
        missCounts.set(item.id, current);
      }
    }
  }

  if (morningTotal >= 3) {
    const rate = morningDone / morningTotal;
    if (rate >= 0.75) {
      insights.push({ id: "morning", text: "You usually complete your morning routine." });
    } else if (rate <= 0.4) {
      insights.push({ id: "morning-miss", text: "Morning checkpoints are slipping this week." });
    }
  }

  let topMiss: { title: string; time: string; missed: number } | null = null;
  for (const item of missCounts.values()) {
    if (!topMiss || item.missed > topMiss.missed) topMiss = item;
  }
  if (topMiss && topMiss.missed >= 3) {
    insights.push({
      id: "week-miss",
      text: `You missed your ${clockLabel(topMiss.time)} ${topMiss.title} ${topMiss.missed} times this week.`,
    });
  }

  return insights.slice(0, 3);
}

export function computeSuggestions(routine: Routine | null, progress: ProgressMap, now: Date): Suggestion[] {
  if (!routine) return [];
  const suggestions: Suggestion[] = [];
  const enabled = routine.checkpoints.filter((item) => item.enabled);
  const miss = new Map<string, { checkpoint: Checkpoint; missed: number; scheduled: number }>();

  for (let offset = 0; offset < 14; offset += 1) {
    const date = addDays(now, -offset);
    const day = mondayIndex(date);
    const map = progress[isoFromDate(date)] ?? { completedCheckpointIds: [], completedTaskIds: {} };
    for (const item of enabled) {
      if (!item.repeatDays.includes(day)) continue;
      const entry = miss.get(item.id) ?? { checkpoint: item, missed: 0, scheduled: 0 };
      entry.scheduled += 1;
      if (!isDone(map, item.id)) entry.missed += 1;
      miss.set(item.id, entry);
    }
  }

  for (const entry of miss.values()) {
    if (entry.scheduled >= 3 && entry.missed >= 3) {
      suggestions.push({
        id: `move-${entry.checkpoint.id}`,
        text: `You often miss ${entry.checkpoint.title} at ${clockLabel(entry.checkpoint.time)}. Consider moving it later.`,
      });
    } else if (entry.scheduled >= 5 && entry.missed === 0) {
      suggestions.push({
        id: `steady-${entry.checkpoint.id}`,
        text: `You complete ${entry.checkpoint.title} consistently.`,
      });
    }
  }

  const packed: Checkpoint[] = [];
  const sorted = [...enabled].sort((a, b) => sessionMinutes(a.time) - sessionMinutes(b.time));
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sessionMinutes(sorted[i].time) - sessionMinutes(sorted[i - 1].time);
    if (gap >= 0 && gap <= 30) {
      if (!packed.includes(sorted[i - 1])) packed.push(sorted[i - 1]);
      packed.push(sorted[i]);
    }
  }
  if (packed.length >= 3) {
    const hour = sessionMinutes(packed[0].time);
    const when = hour < 12 * 60 ? "morning" : hour < 17 * 60 ? "afternoon" : "evening";
    suggestions.push({
      id: "packed",
      text: `Your ${when} schedule has several closely packed checkpoints.`,
    });
  }

  const dailyHeavy = enabled.filter((item) => item.repeatDays.length >= 6).length;
  if (dailyHeavy >= 12) {
    suggestions.push({
      id: "heavy",
      text: `This rhythm has ${dailyHeavy} daily checkpoints. Disabling a few can make it easier to keep.`,
    });
  }

  const unique: Suggestion[] = [];
  const seen = new Set<string>();
  for (const item of suggestions) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
    if (unique.length >= 3) break;
  }
  return unique;
}

export function computeHealth(routine: Routine | null, progress: ProgressMap, now: Date): RoutineHealth {
  if (!routine) {
    return { label: "New", detail: "Add checkpoints to start measuring this rhythm." };
  }
  const enabled = routine.checkpoints.filter((item) => item.enabled);
  let scheduledDays = 0;
  let finishedDays = 0;
  for (let offset = 0; offset < 14; offset += 1) {
    const date = addDays(now, -offset);
    const list = todaysCheckpoints(routine.checkpoints, date);
    if (list.length === 0) continue;
    scheduledDays += 1;
    if (dayComplete(list, progress, date)) finishedDays += 1;
  }

  const dailyCount = enabled.filter((item) => item.repeatDays.length >= 6).length;
  if (dailyCount >= 12) {
    return {
      label: "Overloaded",
      detail: `${dailyCount} checkpoints run most days. That density is hard to finish consistently.`,
    };
  }
  if (scheduledDays < 3) {
    return { label: "New", detail: "Not enough completed days yet to judge this rhythm." };
  }
  const rate = finishedDays / scheduledDays;
  if (rate >= 0.8) {
    return {
      label: "Strong",
      detail: `You finished ${finishedDays} of ${scheduledDays} scheduled days in the last two weeks.`,
    };
  }
  if (rate >= 0.5) {
    return {
      label: "Steady",
      detail: `You finished ${finishedDays} of ${scheduledDays} scheduled days in the last two weeks.`,
    };
  }
  return {
    label: "Uneven",
    detail: `You finished ${finishedDays} of ${scheduledDays} scheduled days in the last two weeks.`,
  };
}

export function todayTaskCounts(routine: Routine | null, progress: ProgressMap, now: Date) {
  const list = todaysCheckpoints(routine?.checkpoints ?? [], now);
  const map = progress[isoFromDate(now)] ?? { completedCheckpointIds: [], completedTaskIds: {} };
  let total = 0;
  let done = 0;
  for (const item of list) {
    total += item.tasks.length;
    done += item.tasks.filter((task) => isTaskDone(map, item.id, task.id)).length;
  }
  return { done, total };
}
