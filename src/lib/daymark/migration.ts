import { buildTemplate } from "./templates";
import { hasAnyV2Data, saveNotes, saveProfile, saveProgress, saveRoutine, saveSettings } from "./storage";
import type { NotesMap, ProgressMap } from "./types";

const V1_DONE = "daymark-done";
const V1_TASKS = "daymark-tasks";
const V1_ALARMS = "daymark-alarms";
const V1_NOTE_PREFIX = "daymark-note-";

function parseRecord(raw: string | null): Record<string, boolean> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return {};
    const next: Record<string, boolean> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === true) next[key] = true;
    }
    return next;
  } catch {
    return {};
  }
}

function hasV2Data() {
  return hasAnyV2Data();
}

export function hasV1Data() {
  try {
    if (localStorage.getItem(V1_DONE) || localStorage.getItem(V1_TASKS) || localStorage.getItem(V1_ALARMS)) {
      return true;
    }
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(V1_NOTE_PREFIX)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function migrateV1IfNeeded() {
  if (hasV2Data()) return false;
  if (!hasV1Data()) return false;

  const routine = buildTemplate("builder");
  const done = parseRecord(localStorage.getItem(V1_DONE));
  const tasks = parseRecord(localStorage.getItem(V1_TASKS));
  const progress: ProgressMap = {};
  const notes: NotesMap = {};

  for (const [key, on] of Object.entries(done)) {
    if (!on) continue;
    const match = /^(\d{4}-\d{2}-\d{2})-(\d+)$/.exec(key);
    if (!match) continue;
    const [, date, indexRaw] = match;
    const checkpoint = routine.checkpoints[Number(indexRaw)];
    if (!checkpoint) continue;
    const day = progress[date] ?? { completedCheckpointIds: [], completedTaskIds: {} };
    if (!day.completedCheckpointIds.includes(checkpoint.id)) {
      day.completedCheckpointIds.push(checkpoint.id);
    }
    progress[date] = day;
  }

  for (const [key, on] of Object.entries(tasks)) {
    if (!on) continue;
    const match = /^(\d{4}-\d{2}-\d{2})-(\d+)-(\d+)$/.exec(key);
    if (!match) continue;
    const [, date, checkpointIndex, taskIndex] = match;
    const checkpoint = routine.checkpoints[Number(checkpointIndex)];
    const task = checkpoint?.tasks[Number(taskIndex)];
    if (!checkpoint || !task) continue;
    const day = progress[date] ?? { completedCheckpointIds: [], completedTaskIds: {} };
    const list = day.completedTaskIds[checkpoint.id] ?? [];
    if (!list.includes(task.id)) list.push(task.id);
    day.completedTaskIds[checkpoint.id] = list;
    progress[date] = day;
  }

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(V1_NOTE_PREFIX)) continue;
      const date = key.slice(V1_NOTE_PREFIX.length);
      const note = localStorage.getItem(key);
      if (date && note) notes[date] = note;
    }
  } catch {
    /* ignore */
  }

  saveRoutine(routine);
  saveProgress(progress);
  saveNotes(notes);
  saveSettings({
    weekStartsOn: 1,
    remindersEnabled: localStorage.getItem(V1_ALARMS) === "on",
  });
  saveProfile({
    name: "",
    focusAreas: [],
    onboarded: true,
  });

  return true;
}
