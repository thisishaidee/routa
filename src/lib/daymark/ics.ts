import type { Checkpoint, Routine } from "@/lib/daymark/types";

const DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const EVENT_MINUTES = 15;

const pad = (value: number) => String(value).padStart(2, "0");

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line to 75 octets, as RFC 5545 requires. */
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = " ";
      bytes = 1;
      limit = 75;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n");
}

function localStamp(date: Date, hour: number, minute: number) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(hour)}${pad(minute)}00`;
}

function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 23) return null;
  return { hour, minute: Number(match[2]) };
}

/** Monday = 0 ... Sunday = 6, matching ROUTA's repeatDays. */
function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

/** First date on or after `from` that falls on one of the repeat days. */
function firstOccurrence(from: Date, repeatDays: number[]) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    if (repeatDays.includes(mondayIndex(candidate))) return candidate;
  }
  return null;
}

function eventLines(checkpoint: Checkpoint, now: Date): string[] | null {
  const time = parseTime(checkpoint.time);
  const repeatDays = [...new Set(checkpoint.repeatDays)].filter((day) => day >= 0 && day <= 6).sort();
  if (!time || repeatDays.length === 0) return null;
  const first = firstOccurrence(now, repeatDays);
  if (!first) return null;

  const tasks = checkpoint.tasks.map((task) => task.title.trim()).filter(Boolean);
  const description = [
    checkpoint.description?.trim() ?? "",
    tasks.length ? `Tasks:\n${tasks.map((task) => `- ${task}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const lines = [
    "BEGIN:VEVENT",
    `UID:${checkpoint.id}@routa`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${localStamp(first, time.hour, time.minute)}`,
    `DURATION:PT${EVENT_MINUTES}M`,
    `RRULE:FREQ=WEEKLY;BYDAY=${repeatDays.map((day) => DAY_CODES[day]).join(",")}`,
    `SUMMARY:${escapeText(checkpoint.title.trim() || "Checkpoint")}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (checkpoint.reminderEnabled) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(checkpoint.title.trim() || "Checkpoint")}`,
      "TRIGGER:PT0S",
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT");
  return lines;
}

/**
 * Build an iCalendar file for a routine. Times are "floating" (no time zone), so
 * each calendar app shows them at the same local clock time on the device that
 * imports them. Only enabled checkpoints are exported.
 */
export function buildRoutineIcs(routine: Routine, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ROUTA//Routine//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(routine.name.trim() || "ROUTA routine")}`,
  ];
  for (const checkpoint of routine.checkpoints) {
    if (!checkpoint.enabled) continue;
    const event = eventLines(checkpoint, now);
    if (event) lines.push(...event);
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function countExportable(routine: Routine): number {
  return routine.checkpoints.filter(
    (item) => item.enabled && parseTime(item.time) && item.repeatDays.length > 0,
  ).length;
}

export function icsFilename(routine: Routine) {
  const slug = routine.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `routa-${slug || "routine"}.ics`;
}
