import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createId } from "./ids";
import { migrateV1IfNeeded } from "./migration";
import { registerReminderWorker, reminderPermission, requestReminderPermission, tickReminders } from "./notifications";
import { computeStats, isDone, isTaskDone, toggleId } from "./progress";
import {
  clearSessionEntered,
  clearV2Storage,
  dayProgress,
  loadSnapshot,
  readSessionEntered,
  saveNotes,
  saveProfile,
  saveProgress,
  saveRoutine,
  saveSettings,
  writeSessionEntered,
} from "./storage";
import { emptyRoutine } from "./templates";
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  type Checkpoint,
  type NotesMap,
  type Profile,
  type ProgressMap,
  type ReminderPermission,
  type Routine,
  type Settings,
} from "./types";
import { normalizeTime, todayKey as dateKey } from "./time";

interface DaymarkContextValue {
  ready: boolean;
  entered: boolean;
  enterApp: () => void;
  now: Date;
  today: string;
  profile: Profile;
  routine: Routine | null;
  settings: Settings;
  permission: ReminderPermission;
  note: string;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  stats: ReturnType<typeof computeStats>;
  updateProfile: (patch: Partial<Profile>) => void;
  completeOnboarding: (profile: Profile, routine: Routine) => void;
  updateRoutineMeta: (patch: Pick<Routine, "name">) => void;
  saveCheckpoint: (checkpoint: Checkpoint, options?: { insert?: boolean }) => string;
  deleteCheckpoint: (id: string) => void;
  moveCheckpoint: (id: string, direction: -1 | 1) => void;
  toggleCheckpointEnabled: (id: string) => void;
  toggleCheckpointReminder: (id: string) => void;
  toggleCheckpointDone: (id: string) => void;
  toggleTaskDone: (checkpointId: string, taskId: string) => void;
  checkpointDone: (id: string) => boolean;
  taskDone: (checkpointId: string, taskId: string) => boolean;
  setNote: (value: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  enableAllReminders: () => Promise<ReminderPermission>;
  disableAllReminders: () => void;
  requestReminders: () => Promise<ReminderPermission>;
  resetProgress: () => void;
  resetRoutine: () => void;
  clearAllData: () => void;
}

const DaymarkContext = createContext<DaymarkContextValue | null>(null);

function sanitizeCheckpoint(checkpoint: Checkpoint): Checkpoint {
  return {
    ...checkpoint,
    id: checkpoint.id || createId("cp"),
    time: normalizeTime(checkpoint.time),
    title: checkpoint.title.trim(),
    description: checkpoint.description?.trim() || undefined,
    tasks: checkpoint.tasks
      .map((task) => ({ ...task, title: task.title.trim(), id: task.id || createId("tk") }))
      .filter((task) => task.title.length > 0),
    repeatDays: checkpoint.repeatDays.length > 0 ? checkpoint.repeatDays : [0, 1, 2, 3, 4, 5, 6],
  };
}

export function DaymarkProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [notes, setNotes] = useState<NotesMap>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [permission, setPermission] = useState<ReminderPermission>("default");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = dateKey(now);
  const todayProgress = dayProgress(progress, today);
  const stats = computeStats(routine, progress, now, settings);

  useEffect(() => {
    try {
      migrateV1IfNeeded();
      const snapshot = loadSnapshot();
      setProfile(snapshot.profile);
      setRoutine(snapshot.routine);
      setProgress(snapshot.progress);
      setNotes(snapshot.notes);
      setSettings(snapshot.settings);
      setPermission(reminderPermission());
      void registerReminderWorker();
      if (readSessionEntered()) setEntered(true);
    } catch {
      // Corrupted storage should never trap the app on the loading screen.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveProfile(profile);
  }, [profile, ready]);

  useEffect(() => {
    if (!ready) return;
    saveRoutine(routine);
  }, [routine, ready]);

  useEffect(() => {
    if (!ready) return;
    saveProgress(progress);
  }, [progress, ready]);

  useEffect(() => {
    if (!ready) return;
    saveNotes(notes);
  }, [notes, ready]);

  useEffect(() => {
    if (!ready) return;
    saveSettings(settings);
  }, [settings, ready]);

  useEffect(() => {
    if (!ready || !routine) return;
    tickReminders({ checkpoints: routine.checkpoints, settings });
    const tick = window.setInterval(() => {
      tickReminders({ checkpoints: routine.checkpoints, settings });
    }, 15000);
    return () => window.clearInterval(tick);
  }, [ready, routine, settings]);

  const enterApp = () => {
    writeSessionEntered();
    setEntered(true);
  };

  const updateProfile = (patch: Partial<Profile>) => {
    setProfile((value) => ({ ...value, ...patch }));
  };

  const completeOnboarding = (nextProfile: Profile, nextRoutine: Routine) => {
    setProfile({ ...nextProfile, onboarded: true });
    setRoutine(nextRoutine);
  };

  const touchRoutine = (mutate: (current: Routine) => Routine) => {
    setRoutine((current) => {
      const base = current ?? emptyRoutine(profile.name ? `${profile.name}'s routine` : "My routine");
      return { ...mutate(base), updatedAt: new Date().toISOString() };
    });
  };

  const updateRoutineMeta = (patch: Pick<Routine, "name">) => {
    touchRoutine((current) => ({ ...current, name: patch.name }));
  };

  const saveCheckpoint = (checkpoint: Checkpoint, options?: { insert?: boolean }) => {
    const next = sanitizeCheckpoint(checkpoint);
    touchRoutine((current) => {
      const index = current.checkpoints.findIndex((item) => item.id === next.id);
      if (index >= 0) {
        const checkpoints = [...current.checkpoints];
        checkpoints[index] = next;
        return { ...current, checkpoints };
      }
      return { ...current, checkpoints: [...current.checkpoints, next] };
    });
    if (options?.insert) setSelectedId(next.id);
    return next.id;
  };

  const deleteCheckpoint = (id: string) => {
    touchRoutine((current) => ({
      ...current,
      checkpoints: current.checkpoints.filter((item) => item.id !== id),
    }));
    setSelectedId((current) => (current === id ? null : current));
  };

  const moveCheckpoint = (id: string, direction: -1 | 1) => {
    touchRoutine((current) => {
      const index = current.checkpoints.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.checkpoints.length) return current;
      const checkpoints = [...current.checkpoints];
      const [item] = checkpoints.splice(index, 1);
      checkpoints.splice(nextIndex, 0, item);
      return { ...current, checkpoints };
    });
  };

  const patchCheckpoint = (id: string, patch: Partial<Checkpoint>) => {
    touchRoutine((current) => ({
      ...current,
      checkpoints: current.checkpoints.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const toggleCheckpointEnabled = (id: string) => {
    const current = routine?.checkpoints.find((item) => item.id === id);
    if (!current) return;
    patchCheckpoint(id, { enabled: !current.enabled });
  };

  const toggleCheckpointReminder = (id: string) => {
    const current = routine?.checkpoints.find((item) => item.id === id);
    if (!current) return;
    patchCheckpoint(id, { reminderEnabled: !current.reminderEnabled });
  };

  const mutateToday = (updater: (day: typeof todayProgress) => typeof todayProgress) => {
    setProgress((current) => ({
      ...current,
      [today]: updater(dayProgress(current, today)),
    }));
  };

  const toggleCheckpointDone = (id: string) => {
    mutateToday((day) => ({
      ...day,
      completedCheckpointIds: toggleId(day.completedCheckpointIds, id),
    }));
  };

  const toggleTaskDone = (checkpointId: string, taskId: string) => {
    mutateToday((day) => ({
      ...day,
      completedTaskIds: {
        ...day.completedTaskIds,
        [checkpointId]: toggleId(day.completedTaskIds[checkpointId] ?? [], taskId),
      },
    }));
  };

  const setNoteValue = (value: string) => {
    setNotes((current) => ({ ...current, [today]: value }));
  };

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const requestReminders = async () => {
    const next = await requestReminderPermission();
    setPermission(next);
    if (next === "granted") updateSettings({ remindersEnabled: true });
    return next;
  };

  const enableAllReminders = async () => {
    const next = await requestReminders();
    if (next !== "granted") return next;
    touchRoutine((current) => ({
      ...current,
      checkpoints: current.checkpoints.map((item) => ({ ...item, reminderEnabled: true })),
    }));
    return next;
  };

  const disableAllReminders = () => {
    updateSettings({ remindersEnabled: false });
    touchRoutine((current) => ({
      ...current,
      checkpoints: current.checkpoints.map((item) => ({ ...item, reminderEnabled: false })),
    }));
  };

  const resetProgress = () => {
    setProgress({});
  };

  const resetRoutine = () => {
    setRoutine(emptyRoutine(profile.name ? `${profile.name}'s routine` : "My routine"));
    setSelectedId(null);
  };

  const clearAllData = () => {
    clearV2Storage();
    clearSessionEntered();
    setProfile(DEFAULT_PROFILE);
    setRoutine(null);
    setProgress({});
    setNotes({});
    setSettings(DEFAULT_SETTINGS);
    setSelectedId(null);
    setEntered(false);
  };

  const value: DaymarkContextValue = {
    ready,
    entered,
    enterApp,
    now,
    today,
    profile,
    routine,
    settings,
    permission,
    note: notes[today] ?? "",
    selectedId,
    setSelectedId,
    stats,
    updateProfile,
    completeOnboarding,
    updateRoutineMeta,
    saveCheckpoint,
    deleteCheckpoint,
    moveCheckpoint,
    toggleCheckpointEnabled,
    toggleCheckpointReminder,
    toggleCheckpointDone,
    toggleTaskDone,
    checkpointDone: (id) => isDone(todayProgress, id),
    taskDone: (checkpointId, taskId) => isTaskDone(todayProgress, checkpointId, taskId),
    setNote: setNoteValue,
    updateSettings,
    enableAllReminders,
    disableAllReminders,
    requestReminders,
    resetProgress,
    resetRoutine,
    clearAllData,
  };

  return <DaymarkContext.Provider value={value}>{children}</DaymarkContext.Provider>;
}

export function useDaymark() {
  const value = useContext(DaymarkContext);
  if (!value) throw new Error("useDaymark must be used inside DaymarkProvider");
  return value;
}
