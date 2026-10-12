import { createId } from "../ids";
import { emptyRoutine } from "../templates";
import { clockLabel, isValidTime, normalizeTime, sessionMinutes, todaysCheckpoints } from "../time";
import { ALL_DAYS, type Checkpoint, type Routine, type WeekDay } from "../types";

/** The document an agent and Routa share. Progress and notes stay on the device. */
export interface AgentFile {
  token: string;
  updatedAt: string;
  remindersEnabled: boolean;
  routine: Routine | null;
}

export interface ToolOutcome {
  file: AgentFile;
  text: string;
  isError: boolean;
}

const DAY_NAMES: Record<string, WeekDay> = {
  monday: 0,
  mon: 0,
  tuesday: 1,
  tue: 1,
  wednesday: 2,
  wed: 2,
  thursday: 3,
  thu: 3,
  friday: 4,
  fri: 4,
  saturday: 5,
  sat: 5,
  sunday: 6,
  sun: 6,
};

const REMINDER_NOTE = "Reminder is on in Routa. It notifies while Routa is open. It was not added to the phone Clock.";

export function emptyAgentFile(token = ""): AgentFile {
  return { token, updatedAt: "", remindersEnabled: false, routine: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function coerceAgentFile(value: unknown): AgentFile {
  if (!isRecord(value)) return emptyAgentFile();
  const routine = isRecord(value.routine) && typeof value.routine.id === "string" ? (value.routine as unknown as Routine) : null;
  return {
    token: typeof value.token === "string" ? value.token : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    remindersEnabled: value.remindersEnabled === true,
    routine,
  };
}

export function parseRepeat(value: unknown): WeekDay[] | { error: string } {
  if (value == null || value === "" || value === "daily" || value === "every day") return [...ALL_DAYS];
  if (value === "weekdays") return [0, 1, 2, 3, 4];
  if (value === "weekends") return [5, 6];
  if (typeof value === "string" && DAY_NAMES[value.toLowerCase()] != null) return [DAY_NAMES[value.toLowerCase()]];
  if (!Array.isArray(value)) return { error: "Repeat must be daily, weekdays, weekends, or a list of days." };
  const days: WeekDay[] = [];
  for (const item of value) {
    if (typeof item === "number" && item >= 0 && item <= 6) days.push(item as WeekDay);
    else if (typeof item === "string" && DAY_NAMES[item.toLowerCase()] != null) days.push(DAY_NAMES[item.toLowerCase()]);
    else return { error: "Use Monday–Sunday, or 0–6 where 0 is Monday." };
  }
  if (days.length === 0) return { error: "Pick at least one day." };
  return [...new Set(days)];
}

function ensureRoutine(file: AgentFile, nowIso: string): Routine {
  if (file.routine) return file.routine;
  const created = emptyRoutine();
  created.createdAt = nowIso;
  created.updatedAt = nowIso;
  return created;
}

function findSession(routine: Routine, args: Record<string, unknown>) {
  const id = typeof args.id === "string" ? args.id : "";
  const title = typeof args.title === "string" ? args.title.trim().toLowerCase() : "";
  if (id) return routine.checkpoints.filter((item) => item.id === id);
  if (!title) return [];
  return routine.checkpoints.filter((item) => item.title.trim().toLowerCase() === title);
}

function overlap(routine: Routine, time: string, skipId?: string) {
  const minute = sessionMinutes(time);
  return routine.checkpoints.find(
    (item) => item.id !== skipId && item.enabled && Math.abs(sessionMinutes(item.time) - minute) < 15,
  );
}

function stamp(file: AgentFile, routine: Routine, nowIso: string, remindersEnabled = file.remindersEnabled): AgentFile {
  return { ...file, routine: { ...routine, updatedAt: nowIso }, remindersEnabled, updatedAt: nowIso };
}

function tasksFrom(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 12)
    .map((title) => ({ id: createId("tk"), title }));
}

export function callTool(file: AgentFile, name: string, args: Record<string, unknown>, now = new Date()): ToolOutcome {
  const nowIso = now.toISOString();
  if (name === "routa_get_routine") {
    if (!file.routine || file.routine.checkpoints.length === 0) {
      return { file, isError: false, text: "No sessions yet." };
    }
    const lines = file.routine.checkpoints.map(
      (item) =>
        `${item.id} · ${item.time} ${item.title} · ${item.reminderEnabled ? "reminder on" : "reminder off"} · ${item.enabled ? "enabled" : "disabled"}`,
    );
    return {
      file,
      isError: false,
      text: `${file.routine.name}\nReminders ${file.remindersEnabled ? "on" : "off"} while Routa is open.\n${lines.join("\n")}`,
    };
  }

  if (name === "routa_today") {
    const list = todaysCheckpoints(file.routine?.checkpoints ?? [], now);
    if (list.length === 0) return { file, isError: false, text: "Nothing is scheduled today. This is the plan, not completed sessions." };
    return {
      file,
      isError: false,
      text: `Plan for today, not completed sessions:\n${list.map((item) => `${item.time} ${item.title}`).join("\n")}`,
    };
  }

  if (name === "routa_add_session") {
    const title = typeof args.title === "string" ? args.title.trim() : "";
    const time = typeof args.time === "string" ? normalizeTime(args.time) : "";
    if (!title) return { file, isError: true, text: "A session needs a title." };
    if (!isValidTime(time)) return { file, isError: true, text: "Time must look like 18:30." };
    const repeat = parseRepeat(args.repeat);
    if ("error" in repeat) return { file, isError: true, text: repeat.error };
    const routine = ensureRoutine(file, nowIso);
    const reminder = args.reminder === true;
    const checkpoint: Checkpoint = {
      id: createId("cp"),
      time,
      title,
      icon: "target",
      tasks: tasksFrom(args.tasks),
      enabled: true,
      repeatDays: repeat,
      reminderEnabled: reminder,
    };
    const next = { ...routine, checkpoints: [...routine.checkpoints, checkpoint] };
    const clash = overlap(next, time, checkpoint.id);
    const remindersEnabled = reminder ? true : file.remindersEnabled;
    const text = [
      `Added ${title} at ${clockLabel(time)}.`,
      reminder ? REMINDER_NOTE : "Reminder left off.",
      clash ? `This time is close to ${clash.title}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return { file: stamp(file, next, nowIso, remindersEnabled), isError: false, text };
  }

  if (name === "routa_update_session" || name === "routa_set_reminder" || name === "routa_remove_session") {
    if (!file.routine) return { file, isError: true, text: "There is no routine yet." };
    const matches = findSession(file.routine, args);
    if (matches.length === 0) return { file, isError: true, text: "No session matched that id or title." };
    if (matches.length > 1) return { file, isError: true, text: "More than one session uses that title. Pass the id." };

    if (name === "routa_remove_session") {
      const next = {
        ...file.routine,
        checkpoints: file.routine.checkpoints.filter((item) => item.id !== matches[0].id),
      };
      return { file: stamp(file, next, nowIso), isError: false, text: `Removed ${matches[0].title}. Other sessions were left as they are.` };
    }

    let reminder = matches[0].reminderEnabled;
    let remindersEnabled = file.remindersEnabled;
    if (name === "routa_set_reminder" || typeof args.reminder === "boolean") {
      reminder = name === "routa_set_reminder" ? args.enabled === true : args.reminder === true;
      if (reminder) remindersEnabled = true;
    }
    let time = matches[0].time;
    if (typeof args.time === "string" && name === "routa_update_session") {
      const normalized = normalizeTime(args.time);
      if (!isValidTime(normalized)) return { file, isError: true, text: "Time must look like 18:30." };
      time = normalized;
    }
    let title = matches[0].title;
    if (typeof args.title === "string" && args.title.trim() && name === "routa_update_session" && typeof args.id === "string") {
      title = args.title.trim();
    }
    const repeat = args.repeat == null || name !== "routa_update_session" ? matches[0].repeatDays : parseRepeat(args.repeat);
    if ("error" in repeat) return { file, isError: true, text: repeat.error };
    const checkpoint: Checkpoint = {
      ...matches[0],
      title,
      time,
      reminderEnabled: reminder,
      repeatDays: repeat,
      enabled: typeof args.enabled === "boolean" && name === "routa_update_session" ? args.enabled : matches[0].enabled,
    };
    const next = {
      ...file.routine,
      checkpoints: file.routine.checkpoints.map((item) => (item.id === checkpoint.id ? checkpoint : item)),
    };
    const clash = overlap(next, checkpoint.time, checkpoint.id);
    const text =
      name === "routa_set_reminder"
        ? reminder
          ? `${checkpoint.title}: ${REMINDER_NOTE}`
          : `Reminder off for ${checkpoint.title}.`
        : [`Updated ${checkpoint.title} at ${clockLabel(checkpoint.time)}.`, reminder ? REMINDER_NOTE : "", clash ? `This time is close to ${clash.title}.` : ""]
            .filter(Boolean)
            .join(" ");
    return { file: stamp(file, next, nowIso, remindersEnabled), isError: false, text };
  }

  return { file, isError: true, text: `Unknown tool ${name}.` };
}

export function acceptBrowserRoutine(file: AgentFile, routine: Routine | null, remindersEnabled: boolean, now = new Date()): AgentFile {
  if (!routine) return file;
  const remoteAt = file.routine?.updatedAt ?? "";
  if (file.routine && remoteAt >= routine.updatedAt && file.remindersEnabled === remindersEnabled) return file;
  if (file.routine && remoteAt > routine.updatedAt) return file;
  return {
    ...file,
    routine,
    remindersEnabled,
    updatedAt: now.toISOString(),
  };
}
