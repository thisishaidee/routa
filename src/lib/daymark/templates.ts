import { createId } from "./ids";
import { ALL_DAYS, type Checkpoint, type Routine, type WeekDay } from "./types";

const WEEKDAYS: WeekDay[] = [0, 1, 2, 3, 4];

type Draft = {
  time: string;
  title: string;
  icon: string;
  description?: string;
  tasks: string[];
  repeatDays?: WeekDay[];
};

function stamp(): string {
  return new Date().toISOString();
}

function checkpoint(draft: Draft): Checkpoint {
  return {
    id: createId("cp"),
    time: draft.time,
    title: draft.title,
    description: draft.description,
    icon: draft.icon,
    tasks: draft.tasks.filter((title) => title.trim()).map((title) => ({ id: createId("tk"), title })),
    enabled: true,
    repeatDays: draft.repeatDays ?? [...ALL_DAYS],
    reminderEnabled: true,
  };
}

function routine(name: string, templateId: string, drafts: Draft[]): Routine {
  const createdAt = stamp();
  return {
    id: createId("rt"),
    name,
    active: true,
    checkpoints: drafts.map(checkpoint),
    createdAt,
    updatedAt: createdAt,
    templateId,
  };
}

const CIRCUIT =
  "15 push-ups, 20 squats, 12 lunges per leg, 30-sec plank, 20 mountain climbers per leg, 15 glute bridges, 30-sec jumping jacks";

export const TEMPLATE_OPTIONS = [
  { id: "student", name: "Student", blurb: "Study blocks, reviews, and a calm close." },
  { id: "developer", name: "Developer", blurb: "Deep work, shipping, and evening learning." },
  { id: "creator", name: "Creator", blurb: "Ideate, make, edit, and publish." },
  { id: "entrepreneur", name: "Entrepreneur", blurb: "Priorities, outreach, and a numbers review." },
  { id: "fitness", name: "Fitness", blurb: "Training, fuel, recovery, and a journal." },
  { id: "balanced", name: "Balanced day", blurb: "Work, life, and a daily reset." },
  { id: "builder", name: "Builder", blurb: "A full-day making rhythm with thirteen checkpoints." },
  { id: "custom", name: "Start from scratch", blurb: "Empty routine, add only what you need." },
] as const;

export type TemplateId = (typeof TEMPLATE_OPTIONS)[number]["id"];

export function buildTemplate(templateId: TemplateId): Routine {
  switch (templateId) {
    case "student":
      return routine("Student rhythm", "student", [
        { time: "06:30", title: "Morning routine", icon: "sun", tasks: ["Make the bed", "Shower", "Eat breakfast", "Review today's classes"] },
        { time: "08:00", title: "Lectures / class", icon: "book", tasks: ["Arrive prepared", "Take notes", "Capture unclear points"], repeatDays: WEEKDAYS },
        { time: "12:30", title: "Midday reset", icon: "coffee", tasks: ["Eat", "Stretch", "Skim afternoon plan"] },
        { time: "14:00", title: "Deep study", icon: "target", tasks: ["One focused block", "Practice problems", "Summarize what stuck"] },
        { time: "17:30", title: "Review", icon: "pencil", tasks: ["Rewrite key notes", "Plan tomorrow's study", "File assignments"] },
        { time: "21:00", title: "Wind down", icon: "moon", tasks: ["Put the phone away", "Journal one win", "Set out tomorrow's materials"] },
      ]);
    case "developer":
      return routine("Developer rhythm", "developer", [
        { time: "07:30", title: "Morning reset", icon: "sun", tasks: ["Shower", "Breakfast", "Read overnight messages"] },
        { time: "09:00", title: "Deep work", icon: "code", tasks: ["Pick one hard problem", "Ship a small slice", "Write a test or check"], repeatDays: WEEKDAYS },
        { time: "12:30", title: "Break", icon: "coffee", tasks: ["Step away from the screen", "Eat", "Walk"] },
        { time: "13:30", title: "Build", icon: "laptop", tasks: ["Continue the active project", "Unblock one issue", "Commit meaningful work"], repeatDays: WEEKDAYS },
        { time: "16:30", title: "Review + ship", icon: "flag", tasks: ["Read the diff", "Update notes", "Plan the next slice"] },
        { time: "21:00", title: "Learning", icon: "book", tasks: ["Study one concept", "Try it in a small example", "Save a takeaway"] },
      ]);
    case "creator":
      return routine("Creator rhythm", "creator", [
        { time: "08:00", title: "Morning", icon: "sun", tasks: ["Move your body", "Breakfast", "Capture one idea"] },
        { time: "09:30", title: "Ideation", icon: "sparkles", tasks: ["List hooks", "Pick today's piece", "Outline the structure"] },
        { time: "11:00", title: "Create", icon: "pencil", tasks: ["Draft or shoot", "Stay on the one piece", "Don't edit yet"] },
        { time: "14:00", title: "Edit", icon: "video", tasks: ["Cut the first pass", "Tighten the hook", "Export a draft"] },
        { time: "17:00", title: "Publish + engage", icon: "megaphone", tasks: ["Publish", "Reply to comments", "Note what resonated"] },
        { time: "21:00", title: "Reflect", icon: "moon", tasks: ["What shipped?", "What to try tomorrow", "Rest"] },
      ]);
    case "entrepreneur":
      return routine("Entrepreneur rhythm", "entrepreneur", [
        { time: "07:00", title: "Morning", icon: "sun", tasks: ["Move", "Breakfast", "Write the top 3"] },
        { time: "08:00", title: "Priorities", icon: "target", tasks: ["Protect the one thing", "Clear calendar noise", "Start before inbox"] },
        { time: "09:30", title: "Deep work", icon: "briefcase", tasks: ["Build the product or offer", "Finish one concrete piece", "Document the result"], repeatDays: WEEKDAYS },
        { time: "13:00", title: "Outreach", icon: "megaphone", tasks: ["Send messages", "Follow up", "Log conversations"], repeatDays: WEEKDAYS },
        { time: "16:00", title: "Ops", icon: "laptop", tasks: ["Admin and money", "Unblock the team", "Close open loops"] },
        { time: "20:00", title: "Numbers review", icon: "flag", tasks: ["Check the day's metrics", "Note one lesson", "Plan tomorrow"] },
      ]);
    case "fitness":
      return routine("Fitness rhythm", "fitness", [
        { time: "06:00", title: "Workout", icon: "dumbbell", tasks: ["Warm-up", "Main session", "Stretch"] },
        { time: "08:00", title: "Fuel", icon: "coffee", tasks: ["Breakfast", "Hydrate", "Prep a later meal"] },
        { time: "12:30", title: "Movement", icon: "leaf", tasks: ["Walk", "Stand and stretch", "Drink water"] },
        { time: "17:30", title: "Training / skill", icon: "flame", tasks: ["Second session or mobility", "Practice one skill", "Cool down"] },
        { time: "20:00", title: "Recovery", icon: "heart", tasks: ["Eat well", "Prep tomorrow's kit", "Lights down"] },
        { time: "21:30", title: "Journal", icon: "pencil", tasks: ["How did the body feel?", "Sleep plan", "One win"] },
      ]);
    case "balanced":
      return routine("Balanced rhythm", "balanced", [
        { time: "07:00", title: "Morning routine", icon: "sun", tasks: ["Wake up slowly", "Shower", "Breakfast"] },
        { time: "09:00", title: "Focus work", icon: "briefcase", tasks: ["One important task", "No extra tabs", "Take a short break after"], repeatDays: WEEKDAYS },
        { time: "12:30", title: "Midday reset", icon: "coffee", tasks: ["Eat away from the desk", "Walk", "Reset the afternoon list"] },
        { time: "15:00", title: "Secondary work", icon: "laptop", tasks: ["Admin and messages", "A smaller project", "Close loops"] },
        { time: "18:00", title: "Life", icon: "heart", tasks: ["People, chores, or rest", "Cook or move", "Be present"] },
        { time: "21:00", title: "Review", icon: "moon", tasks: ["What mattered today?", "Note tomorrow's first step", "Wind down"] },
      ]);
    case "builder":
      return routine("Builder rhythm", "builder", [
        {
          time: "06:00",
          title: "Workout",
          icon: "dumbbell",
          tasks: ["Warm-up", `Round 1: ${CIRCUIT}`, `Round 2: ${CIRCUIT}`, `Round 3: ${CIRCUIT}`, "Stretch"],
        },
        { time: "06:30", title: "Morning routine", icon: "sun", tasks: ["Shower", "Breakfast / coffee", "Check overnight news", "Review top 3 priorities"] },
        { time: "07:00", title: "Markets / craft", icon: "target", tasks: ["Chart or craft review", "Journal", "Study one concept", "Write one takeaway"] },
        { time: "07:45", title: "Build sprint", icon: "code", tasks: ["Continue the active build", "Ship one concrete improvement", "Test what changed", "Record progress"] },
        { time: "09:00", title: "Deep practice + breakfast", icon: "sparkles", tasks: ["Practice the craft", "Test it on a real task", "Refine the strongest result", "Eat"] },
        { time: "11:30", title: "Create", icon: "pencil", tasks: ["Make today's piece", "Develop the hook", "Prepare it for editing"] },
        { time: "13:00", title: "Editing", icon: "video", tasks: ["Edit content", "Continue the piece", "Capture one useful idea"] },
        { time: "14:30", title: "Session check", icon: "flag", tasks: ["Check the active session", "Review context", "Update the journal if needed"] },
        { time: "15:00", title: "Project update", icon: "laptop", tasks: ["Work on the long project", "Record what was built", "Prepare a short update"] },
        { time: "17:00", title: "Video editing tutorials", icon: "video", tasks: ["Watch one tutorial", "Practice one technique from it", "Apply it to a real clip", "Save one editing takeaway"] },
        { time: "20:00", title: "Computer review", icon: "laptop", tasks: ["Review what shipped", "Check open issues", "Note blockers", "Plan the next session"] },
        { time: "21:30", title: "Review + journal", icon: "moon", tasks: ["Review the day", "Journal wins and mistakes", "Write tomorrow's priorities"] },
        { time: "00:00", title: "Night build", icon: "code", tasks: ["Concept study or hands-on build", "Work on a personal project", "Test the implementation", "Save the work"] },
      ]);
    case "custom":
      return routine("My routine", "custom", []);
  }
}

export function emptyRoutine(name = "My routine"): Routine {
  return routine(name, "custom", []);
}

export function blankCheckpoint(): Checkpoint {
  return {
    id: createId("cp"),
    time: "09:00",
    title: "",
    icon: "target",
    tasks: [{ id: createId("tk"), title: "" }],
    enabled: true,
    repeatDays: [...ALL_DAYS],
    reminderEnabled: true,
  };
}
