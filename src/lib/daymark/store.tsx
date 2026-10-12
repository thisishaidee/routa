import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { snapshotToJson, parseBackup } from "./backup";
import { computeHealth, computeInsights, computeSuggestions } from "./insights";
import { createId } from "./ids";
import { migrateV1IfNeeded } from "./migration";
import {
  getAlarmScheduler,
  registerReminderWorker,
  reminderPermission,
  tickReminders,
} from "./notifications";
import type { PlatformCapabilities } from "./alarms";
import { computeStats, isDone, isTaskDone, toggleId } from "./progress";
import {
  checkInStreak,
  EMPTY_CHECKINS,
  loadCheckIns,
  markCheckIn,
  recentCheckIns,
  saveCheckIns,
  syncBadges,
  type CheckInRecord,
  type CheckInState,
  type EarnedBadge,
} from "./checkins";
import type { DraftCheckpoint } from "./planner";
import {
  dropDayMove,
  EMPTY_RECOVERY,
  loadRecovery,
  optionStillFree,
  saveRecovery,
  suggestRecovery,
  timeOverrides,
  upsertDayMove,
  withDayTimes,
  type RecoveryOption,
  type RecoveryState,
} from "./recovery";
import {
  applySnapshot,
  clearSessionEntered,
  clearV2Storage,
  dayProgress,
  loadSnapshot,
  migrateLegacyV2IfNeeded,
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
  ALL_DAYS,
  type AlarmStatus,
  type Checkpoint,
  type DaymarkSnapshot,
  type NotesMap,
  type Profile,
  type ProgressMap,
  type ReminderPermission,
  type Routine,
  type Settings,
} from "./types";
import { isValidTime, normalizeTime, todayKey as dateKey, deviceTimeZone } from "./time";
import {
  createAgentToken,
  emptyAgentLink,
  isLocalAgentOrigin,
  loadAgentLink,
  pullAgent,
  pushAgent,
  saveAgentLink,
  type AgentLink,
} from "./mcp/link";

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
  notes: NotesMap;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  stats: ReturnType<typeof computeStats>;
  insights: ReturnType<typeof computeInsights>;
  suggestions: ReturnType<typeof computeSuggestions>;
  health: ReturnType<typeof computeHealth>;
  alarmStatus: (checkpoint: Checkpoint) => AlarmStatus;
  capabilities: PlatformCapabilities;
  updateProfile: (patch: Partial<Profile>) => void;
  completeOnboarding: (profile: Profile, routine: Routine) => void;
  updateRoutineMeta: (patch: Partial<Pick<Routine, "name" | "description" | "active">>) => void;
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
  exportBackup: () => string;
  importBackup: (raw: string) => { ok: boolean; error?: string };
  recoveryProposals: ReturnType<typeof suggestRecovery>;
  acceptRecovery: (option: RecoveryOption) => boolean;
  dismissRecovery: (checkpointId: string) => void;
  todayCheckpoints: Checkpoint[];
  todayCheckIn: CheckInRecord | null;
  checkInStreak: { current: number; best: number; total: number };
  badges: EarnedBadge[];
  checkInHistory: CheckInRecord[];
  startCheckIn: () => void;
  closeCheckIn: () => void;
  applyPlanner: (proposed: DraftCheckpoint[], reminders: boolean) => Promise<{ ok: boolean; reminders?: "on" | "off" | "denied"; error?: string }>;
  agentLink: AgentLink;
  agentStatus: "idle" | "connected" | "offline" | "unauthorized";
  updateAgentLink: (patch: Partial<AgentLink>) => void;
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

function hydrateRoutine(routine: Routine | null): Routine | null {
  if (!routine) return null;
  return {
    ...routine,
    active: routine.active !== false,
    description: routine.description?.trim() || undefined,
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
  const [recovery, setRecovery] = useState<RecoveryState>(EMPTY_RECOVERY);
  const [journal, setJournal] = useState<CheckInState>(EMPTY_CHECKINS);
  const [agentLink, setAgentLink] = useState<AgentLink>(emptyAgentLink);
  const [agentStatus, setAgentStatus] = useState<"idle" | "connected" | "offline" | "unauthorized">("idle");
  const routineRef = useRef(routine);
  const remindersRef = useRef(false);
  routineRef.current = routine;
  remindersRef.current = settings.remindersEnabled;

  const today = dateKey(now);
  const timeZone = deviceTimeZone();
  const todayProgress = dayProgress(progress, today);
  const todayOverrides = useMemo(
    () => timeOverrides(recovery.moves, today, routine?.id),
    [recovery.moves, today, routine?.id],
  );
  const todayCheckpoints = useMemo(
    () => withDayTimes(routine?.checkpoints ?? [], todayOverrides),
    [routine, todayOverrides],
  );
  const stats = computeStats(routine, progress, now, settings, todayOverrides);
  const recoveryProposals = routine
    ? suggestRecovery({
        routineId: routine.id,
        checkpoints: routine.checkpoints,
        day: todayProgress,
        now,
        date: today,
        moves: recovery.moves,
        dismissedIds: recovery.dismissed.filter((item) => item.date === today).map((item) => item.checkpointId),
      })
    : [];
  const insights = useMemo(() => computeInsights(routine, progress, now), [routine, progress, now]);
  const suggestions = useMemo(() => computeSuggestions(routine, progress, now), [routine, progress, now]);
  const health = useMemo(() => computeHealth(routine, progress, now), [routine, progress, now]);
  const checkInKey = journal.checkIns.map((item) => `${item.date}:${item.startedAt ?? ""}:${item.closedAt ?? ""}`).join("|");
  const streakInfo = checkInStreak(journal.checkIns, today);
  const todayCheckIn = journal.checkIns.find((item) => item.date === today) ?? null;

  useEffect(() => {
    try {
      migrateV1IfNeeded();
      migrateLegacyV2IfNeeded();
      const snapshot = loadSnapshot();
      setProfile(snapshot.profile);
      setRoutine(hydrateRoutine(snapshot.routine));
      setProgress(snapshot.progress);
      setNotes(snapshot.notes);
      setSettings(snapshot.settings);
      setRecovery(loadRecovery());
      setJournal(loadCheckIns());
      setAgentLink(loadAgentLink());
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
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
    if (!ready) return;
    saveRecovery(recovery);
  }, [recovery, ready]);

  useEffect(() => {
    if (!ready) return;
    saveCheckIns(journal);
  }, [journal, ready]);

  useEffect(() => {
    if (!ready) return;
    saveAgentLink(agentLink);
  }, [agentLink, ready]);

  useEffect(() => {
    if (!ready || !agentLink.enabled) {
      if (ready && !agentLink.enabled) setAgentStatus("idle");
      return;
    }
    let cancel = false;
    const run = async () => {
      const pulled = await pullAgent(agentLink.origin, agentLink.token);
      if (cancel) return;
      if ("error" in pulled) {
        setAgentStatus(pulled.error === "unauthorized" ? "unauthorized" : "offline");
        return;
      }
      setAgentStatus("connected");
      const local = routineRef.current;
      const remoteAt = pulled.routine?.updatedAt ?? "";
      const localAt = local?.updatedAt ?? "";
      if (pulled.routine && remoteAt > localAt) {
        setRoutine(hydrateRoutine(pulled.routine));
        setSettings((current) =>
          current.remindersEnabled === pulled.remindersEnabled ? current : { ...current, remindersEnabled: pulled.remindersEnabled },
        );
        return;
      }
      if (local && (localAt > remoteAt || remindersRef.current !== pulled.remindersEnabled)) {
        await pushAgent(agentLink.origin, agentLink.token, { routine: local, remindersEnabled: remindersRef.current });
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), 4000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [ready, agentLink.enabled, agentLink.origin, agentLink.token]);

  useEffect(() => {
    if (!ready) return;
    setJournal((current) => syncBadges(current, routine, progress, today));
  }, [ready, routine, progress, today, checkInKey]);

  useEffect(() => {
    if (!ready || !routine) return;
    if (getAlarmScheduler().canExactAlarm()) return;
    const fire = () => tickReminders({ checkpoints: todayCheckpoints, settings, permission });
    fire();
    const tick = window.setInterval(fire, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, routine, todayCheckpoints, settings, permission]);

  useEffect(() => {
    if (!ready || !routine) return;
    void getAlarmScheduler().sync(routine.checkpoints, settings, routine.id);
  }, [ready, routine, settings, permission, timeZone]);

  useEffect(() => {
    if (!ready) return;
    const refreshPermission = () => {
      const next = reminderPermission();
      setPermission((current) => (current === next ? current : next));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshPermission();
    };
    document.addEventListener("visibilitychange", onVisible);
    let permissionStatus: PermissionStatus | null = null;
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((status) => {
          permissionStatus = status;
          status.onchange = refreshPermission;
        })
        .catch(() => undefined);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [ready]);

  const enterApp = () => {
    writeSessionEntered();
    setEntered(true);
  };

  const updateProfile = (patch: Partial<Profile>) => {
    setProfile((value) => ({ ...value, ...patch }));
  };

  const completeOnboarding = (nextProfile: Profile, nextRoutine: Routine) => {
    setProfile({ ...nextProfile, onboarded: true });
    setRoutine(hydrateRoutine(nextRoutine));
  };

  const touchRoutine = (mutate: (current: Routine) => Routine) => {
    setRoutine((current) => {
      const base = current ?? emptyRoutine(profile.name ? `${profile.name}'s routine` : "My routine");
      return { ...mutate(base), updatedAt: new Date().toISOString() };
    });
  };

  const updateRoutineMeta = (patch: Partial<Pick<Routine, "name" | "description" | "active">>) => {
    touchRoutine((current) => ({ ...current, ...patch }));
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
    if (permission === "denied" || permission === "unsupported") return permission;
    const next = await getAlarmScheduler().requestPermission();
    setPermission(next);
    if (next === "granted") updateSettings({ remindersEnabled: true });
    return next;
  };

  const startCheckIn = () => {
    setJournal((current) => markCheckIn(current, today, "start", new Date().toISOString()));
  };

  const closeCheckIn = () => {
    setJournal((current) => markCheckIn(current, today, "close", new Date().toISOString()));
  };

  const applyPlanner = async (proposed: DraftCheckpoint[], reminders: boolean) => {
    if (proposed.length === 0) return { ok: false, error: "Nothing new to add." };
    if (proposed.some((item) => item.conflict || !item.title.trim() || !isValidTime(item.time))) {
      return { ok: false, error: "Fix overlapping or empty times before saving." };
    }
    let remindersState: "on" | "off" | "denied" = "off";
    if (reminders) {
      const next = await requestReminders();
      remindersState = next === "granted" ? "on" : next === "denied" || next === "unsupported" ? "denied" : "off";
    }
    const remindersOn = remindersState === "on";
    touchRoutine((current) => ({
      ...current,
      checkpoints: [
        ...current.checkpoints,
        ...proposed.map((item) => ({
          id: createId("cp"),
          time: normalizeTime(item.time),
          title: item.title.trim(),
          icon: "target",
          tasks: item.tasks.filter((title) => title.trim()).map((title) => ({ id: createId("tk"), title: title.trim() })),
          enabled: true,
          repeatDays: [...ALL_DAYS],
          reminderEnabled: remindersOn,
        })),
      ],
    }));
    return { ok: true, reminders: remindersState };
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
    void getAlarmScheduler().cancelAll();
    clearV2Storage();
    clearSessionEntered();
    setProfile(DEFAULT_PROFILE);
    setRoutine(null);
    setProgress({});
    setNotes({});
    setSettings(DEFAULT_SETTINGS);
    setRecovery(EMPTY_RECOVERY);
    setJournal(EMPTY_CHECKINS);
    setAgentLink(emptyAgentLink());
    setSelectedId(null);
    setEntered(false);
  };

  const currentSnapshot = (): DaymarkSnapshot => ({
    profile,
    routine,
    progress,
    notes,
    settings,
  });

  const exportBackup = () => snapshotToJson(currentSnapshot());

  const importBackup = (raw: string) => {
    const parsed = parseBackup(raw);
    if (!parsed.ok) return parsed;
    applySnapshot(parsed.snapshot);
    setProfile(parsed.snapshot.profile);
    setRoutine(hydrateRoutine(parsed.snapshot.routine));
    setProgress(parsed.snapshot.progress);
    setNotes(parsed.snapshot.notes);
    setSettings(parsed.snapshot.settings);
    setSelectedId(null);
    return { ok: true };
  };

  const acceptRecovery = (option: RecoveryOption) => {
    if (!routine) return false;
    const overrides = timeOverrides(recovery.moves, today, routine.id);
    if (!optionStillFree(option, routine.checkpoints, now, overrides)) return false;
    if (option.scope === "today") {
      setRecovery((current) => ({
        ...current,
        moves: upsertDayMove(current.moves, {
          routineId: routine.id,
          date: today,
          checkpointId: option.checkpointId,
          fromTime: option.fromTime,
          time: option.time,
          createdAt: new Date().toISOString(),
        }),
      }));
      return true;
    }
    patchCheckpoint(option.checkpointId, { time: option.time });
    setRecovery((current) => ({
      ...current,
      moves: dropDayMove(current.moves, today, option.checkpointId),
    }));
    return true;
  };

  const dismissRecovery = (checkpointId: string) => {
    setRecovery((current) => {
      if (current.dismissed.some((item) => item.date === today && item.checkpointId === checkpointId)) return current;
      return { ...current, dismissed: [...current.dismissed, { date: today, checkpointId }] };
    });
  };

  const alarmStatusFor = (checkpoint: Checkpoint): AlarmStatus =>
    getAlarmScheduler().status(checkpoint, settings, permission);

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
    notes,
    selectedId,
    setSelectedId,
    stats,
    insights,
    suggestions,
    health,
    alarmStatus: alarmStatusFor,
    capabilities: getAlarmScheduler().getPlatformCapabilities(),
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
    exportBackup,
    importBackup,
    recoveryProposals,
    acceptRecovery,
    dismissRecovery,
    todayCheckpoints,
    todayCheckIn,
    checkInStreak: streakInfo,
    badges: journal.badges,
    checkInHistory: recentCheckIns(journal.checkIns),
    startCheckIn,
    closeCheckIn,
    applyPlanner,
    agentLink,
    agentStatus,
    updateAgentLink: (patch) => {
      setAgentLink((current) => {
        if (patch.origin && !isLocalAgentOrigin(patch.origin)) return current;
        const next = { ...current, ...patch };
        if (next.enabled && !next.token) next.token = createAgentToken();
        return next;
      });
    },
  };

  return <DaymarkContext.Provider value={value}>{children}</DaymarkContext.Provider>;
}

export function useDaymark() {
  const value = useContext(DaymarkContext);
  if (!value) throw new Error("useDaymark must be used inside DaymarkProvider");
  return value;
}
