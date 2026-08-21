import type { Checkpoint, WeekDay } from "./types";

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

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

export function sortCheckpoints(checkpoints: Checkpoint[]) {
  return [...checkpoints].sort((a, b) => {
    const aMin = sessionMinutes(a.time);
    const bMin = sessionMinutes(b.time);
    const aWrap = aMin < 5 * 60 ? aMin + 24 * 60 : aMin;
    const bWrap = bMin < 5 * 60 ? bMin + 24 * 60 : bMin;
    return aWrap - bWrap;
  });
}

export function todaysCheckpoints(checkpoints: Checkpoint[], date = new Date()) {
  const day = mondayIndex(date);
  return sortCheckpoints(checkpoints.filter((item) => item.enabled && item.repeatDays.includes(day)));
}

export function liveCheckpointId(checkpoints: Checkpoint[], date = new Date()) {
  const list = todaysCheckpoints(checkpoints, date);
  if (list.length === 0) return null;
  const now = clockMinutes(date);
  const first = sessionMinutes(list[0].time);
  if (now < first) return list[list.length - 1].id;
  let current = list[0].id;
  for (const item of list) {
    const start = sessionMinutes(item.time);
    if (start === 0 && now >= 5 * 60) continue;
    if (start <= now) current = item.id;
  }
  return current;
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
