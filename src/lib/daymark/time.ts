import type { Checkpoint, WeekDay } from "./types";

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Local calendar key. Never uses UTC, so DST and timezone changes stay on-device. */
export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function clockMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

export function sessionMinutes(hhmm: string) {
  const normalized = normalizeTime(hhmm);
  const [hours, minutes] = normalized.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function normalizeTime(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return value;
  const hours = Number(match[1]);
  if (hours > 23) return value;
  return `${pad(hours)}:${match[2]}`;
}

export function clockLabel(hhmm: string) {
  const normalized = normalizeTime(hhmm);
  const [hours, minutes] = normalized.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return hhmm;
  const suffix = hours >= 12 && hours < 24 ? "PM" : "AM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${pad(minutes)} ${suffix}`;
}

export function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalizeTime(value));
}

/** 0 = Monday … 6 = Sunday */
export function mondayIndex(date = new Date()): WeekDay {
  const sundayBased = date.getDay();
  return (sundayBased === 0 ? 6 : sundayBased - 1) as WeekDay;
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

/** Night-build wrap: times before 05:00 sort after evening. */
export function wrapMinutes(hhmmOrMinutes: string | number) {
  const minutes = typeof hhmmOrMinutes === "number" ? hhmmOrMinutes : sessionMinutes(hhmmOrMinutes);
  return minutes < 5 * 60 ? minutes + 24 * 60 : minutes;
}

export function sortCheckpoints(checkpoints: Checkpoint[]) {
  return [...checkpoints].sort((a, b) => wrapMinutes(a.time) - wrapMinutes(b.time));
}

export function todaysCheckpoints(checkpoints: Checkpoint[], date = new Date()) {
  const day = mondayIndex(date);
  return sortCheckpoints(checkpoints.filter((item) => item.enabled && item.repeatDays.includes(day)));
}

/**
 * The checkpoint that is "now". Compared in wrapped minutes, so a checkpoint
 * between 00:00 and 04:59 counts as the end of the previous evening, not the
 * start of the day. Before the first checkpoint of the day, the last one is
 * returned.
 */
export function liveCheckpointId(checkpoints: Checkpoint[], date = new Date()) {
  const list = todaysCheckpoints(checkpoints, date);
  if (list.length === 0) return null;
  const now = wrapMinutes(clockMinutes(date));
  if (now < wrapMinutes(list[0].time)) return list[list.length - 1].id;
  let current = list[0].id;
  for (const item of list) {
    if (wrapMinutes(item.time) <= now) current = item.id;
  }
  return current;
}

/** True once this checkpoint's local time has been reached in the current rhythm day. */
export function hasStartedInDay(time: string, now = new Date()) {
  return wrapMinutes(clockMinutes(now)) >= wrapMinutes(time);
}

export function localDateAt(date: Date, hhmm: string) {
  const normalized = normalizeTime(hhmm);
  const [hours, minutes] = normalized.split(":").map(Number);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
}

export function nextOccurrence(checkpoint: Checkpoint, now = new Date()): Date | null {
  if (!checkpoint.enabled) return null;
  for (let offset = 0; offset < 8; offset += 1) {
    const date = addDays(now, offset);
    if (!checkpoint.repeatDays.includes(mondayIndex(date))) continue;
    const fire = localDateAt(date, checkpoint.time);
    if (fire.getTime() > now.getTime()) return fire;
  }
  return null;
}

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  } catch {
    return "local";
  }
}

export function startOfWeek(date: Date, weekStartsOn: 0 | 1) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = weekStartsOn === 1 ? (day === 0 ? -6 : 1 - day) : -day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function addDays(date: Date, amount: number) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function isoFromDate(date: Date) {
  return todayKey(date);
}
