export const FOCUS_AREAS = [
  { id: "work", label: "Work" },
  { id: "study", label: "Study" },
  { id: "fitness", label: "Fitness" },
  { id: "business", label: "Business" },
  { id: "content", label: "Content" },
  { id: "growth", label: "Personal growth" },
  { id: "balanced", label: "Balanced life" },
  { id: "other", label: "Other" },
] as const;

export type FocusAreaId = (typeof FOCUS_AREAS)[number]["id"];

export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Task {
  id: string;
  title: string;
}

export interface Checkpoint {
  id: string;
  time: string;
  title: string;
  description?: string;
  icon: string;
  tasks: Task[];
  enabled: boolean;
  repeatDays: WeekDay[];
  reminderEnabled: boolean;
}

export interface Routine {
  id: string;
  name: string;
  checkpoints: Checkpoint[];
  createdAt: string;
  updatedAt: string;
  templateId?: string;
}

export interface Profile {
  name: string;
  focusAreas: FocusAreaId[];
  onboarded: boolean;
}

export interface Settings {
  weekStartsOn: 0 | 1;
  remindersEnabled: boolean;
}

export interface DayProgress {
  completedCheckpointIds: string[];
  completedTaskIds: Record<string, string[]>;
}

export type ProgressMap = Record<string, DayProgress>;
export type NotesMap = Record<string, string>;

export type ReminderPermission = "granted" | "denied" | "default" | "unsupported";

export interface DaymarkSnapshot {
  profile: Profile;
  routine: Routine | null;
  progress: ProgressMap;
  notes: NotesMap;
  settings: Settings;
}

export const ALL_DAYS: WeekDay[] = [0, 1, 2, 3, 4, 5, 6];

export const DEFAULT_PROFILE: Profile = {
  name: "",
  focusAreas: [],
  onboarded: false,
};

export const DEFAULT_SETTINGS: Settings = {
  weekStartsOn: 1,
  remindersEnabled: false,
};

export const EMPTY_DAY: DayProgress = {
  completedCheckpointIds: [],
  completedTaskIds: {},
};
