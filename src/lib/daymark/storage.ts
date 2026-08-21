import {
  ALL_DAYS,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  FOCUS_AREAS,
  type Checkpoint,
  type DaymarkSnapshot,
  type DayProgress,
  type FocusAreaId,
  type NotesMap,
  type Profile,
  type ProgressMap,
  type Routine,
  type Settings,
  type Task,
  type WeekDay,
} from "./types";
import { isValidTime, normalizeTime } from "./time";

export const STORAGE_KEYS = {
  profile: "daymark:v2:profile",
  routine: "daymark:v2:routine",
  progress: "daymark:v2:progress",
  notes: "daymark:v2:notes",
  settings: "daymark:v2:settings",
} as const;

export const SESSION_KEY = "daymark:v2:entered";

export function readSessionEntered(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSessionEntered() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearSessionEntered() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

const FOCUS_IDS = new Set<string>(FOCUS_AREAS.map((item) => item.id));

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full — fail closed.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function coerceTask(value: unknown, index: number): Task | null {
  if (typeof value === "string" && value.trim()) {
    return { id: `tk_legacy_${index}`, title: value.trim() };
  }
  if (!isRecord(value)) return null;
  const title = asString(value.title).trim();
  if (!title) return null;
  return {
    id: asString(value.id) || `tk_legacy_${index}`,
    title,
  };
}

function coerceRepeatDays(value: unknown): WeekDay[] {
  if (!Array.isArray(value)) return [...ALL_DAYS];
  const days = value
    .map((item) => Number(item))
    .filter((item): item is WeekDay => Number.isInteger(item) && item >= 0 && item <= 6);
  return days.length > 0 ? [...new Set(days)] : [...ALL_DAYS];
}

export function coerceCheckpoint(value: unknown, index: number): Checkpoint | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title).trim();
  const time = normalizeTime(asString(value.time));
  if (!title || !isValidTime(time)) return null;
  const tasks = Array.isArray(value.tasks)
    ? value.tasks.map(coerceTask).filter((task): task is Task => task !== null)
    : [];
  const seen = new Set<string>();
  const uniqueTasks = tasks.map((task, taskIndex) => {
    let id = task.id;
    if (!id || seen.has(id)) id = `tk_legacy_${index}_${taskIndex}`;
    seen.add(id);
    return { ...task, id };
  });
  return {
    id: asString(value.id) || `cp_legacy_${index}`,
    time,
    title,
    description: asString(value.description) || undefined,
    icon: asString(value.icon, "target"),
    tasks: uniqueTasks,
    enabled: asBoolean(value.enabled, true),
    repeatDays: coerceRepeatDays(value.repeatDays),
    reminderEnabled: asBoolean(value.reminderEnabled, true),
  };
}

export function coerceRoutine(value: unknown): Routine | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.checkpoints)) return null;
  const seen = new Set<string>();
  const checkpoints = value.checkpoints
    .map(coerceCheckpoint)
    .filter((item): item is Checkpoint => item !== null)
    .map((item, index) => {
      let id = item.id;
      if (!id || seen.has(id)) id = `cp_legacy_${index}`;
      seen.add(id);
      return { ...item, id };
    });
  return {
    id: asString(value.id, "routine_default"),
    name: asString(value.name, "My routine"),
    checkpoints,
    createdAt: asString(value.createdAt) || new Date().toISOString(),
    updatedAt: asString(value.updatedAt) || new Date().toISOString(),
    templateId: asString(value.templateId) || undefined,
  };
}

function coerceProfile(value: unknown): Profile {
  if (!isRecord(value)) return { ...DEFAULT_PROFILE };
  const focusAreas = Array.isArray(value.focusAreas)
    ? value.focusAreas.filter((item): item is FocusAreaId => typeof item === "string" && FOCUS_IDS.has(item))
    : [];
  return {
    name: asString(value.name).trim(),
    focusAreas,
    onboarded: asBoolean(value.onboarded, false),
  };
}

function coerceSettings(value: unknown): Settings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
  return {
    weekStartsOn: value.weekStartsOn === 0 ? 0 : 1,
    remindersEnabled: asBoolean(value.remindersEnabled, false),
  };
}

function coerceProgress(value: unknown): ProgressMap {
  if (!isRecord(value)) return {};
  const next: ProgressMap = {};
  for (const [date, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    const completedCheckpointIds = Array.isArray(entry.completedCheckpointIds)
      ? entry.completedCheckpointIds.filter((id): id is string => typeof id === "string")
      : [];
    const completedTaskIds: Record<string, string[]> = {};
    if (isRecord(entry.completedTaskIds)) {
      for (const [checkpointId, ids] of Object.entries(entry.completedTaskIds)) {
        if (Array.isArray(ids)) {
          completedTaskIds[checkpointId] = ids.filter((id): id is string => typeof id === "string");
        }
      }
    }
    next[date] = { completedCheckpointIds, completedTaskIds };
  }
  return next;
}

function coerceNotes(value: unknown): NotesMap {
  if (!isRecord(value)) return {};
  const next: NotesMap = {};
  for (const [date, note] of Object.entries(value)) {
    if (typeof note === "string") next[date] = note;
  }
  return next;
}

export function loadSnapshot(): DaymarkSnapshot {
  return {
    profile: coerceProfile(readJson(STORAGE_KEYS.profile)),
    routine: coerceRoutine(readJson(STORAGE_KEYS.routine)),
    progress: coerceProgress(readJson(STORAGE_KEYS.progress)),
    notes: coerceNotes(readJson(STORAGE_KEYS.notes)),
    settings: coerceSettings(readJson(STORAGE_KEYS.settings)),
  };
}

export function saveProfile(profile: Profile) {
  writeJson(STORAGE_KEYS.profile, profile);
}

export function saveRoutine(routine: Routine | null) {
  if (!routine) {
    try {
      localStorage.removeItem(STORAGE_KEYS.routine);
    } catch {
      /* ignore */
    }
    return;
  }
  writeJson(STORAGE_KEYS.routine, routine);
}

export function saveProgress(progress: ProgressMap) {
  writeJson(STORAGE_KEYS.progress, progress);
}

export function saveNotes(notes: NotesMap) {
  writeJson(STORAGE_KEYS.notes, notes);
}

export function saveSettings(settings: Settings) {
  writeJson(STORAGE_KEYS.settings, settings);
}

export function clearV2Storage() {
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function dayProgress(map: ProgressMap, dateKey: string): DayProgress {
  return map[dateKey] ?? { completedCheckpointIds: [], completedTaskIds: {} };
}
