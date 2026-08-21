export type DaymarkView = "today" | "routine" | "progress" | "settings";

export const VIEW_PATH: Record<DaymarkView, string> = {
  today: "/",
  routine: "/routine",
  progress: "/progress",
  settings: "/settings",
};
