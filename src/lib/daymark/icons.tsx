import {
  Bell,
  BookOpen,
  Briefcase,
  Camera,
  Code,
  Coffee,
  Dumbbell,
  Flag,
  Flame,
  Heart,
  Laptop,
  Leaf,
  Megaphone,
  Moon,
  Pencil,
  Sparkles,
  Sun,
  Target,
  Timer,
  Video,
  type LucideIcon,
} from "lucide-react";

export const CHECKPOINT_ICONS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "sun", label: "Morning", Icon: Sun },
  { id: "dumbbell", label: "Fitness", Icon: Dumbbell },
  { id: "flame", label: "Energy", Icon: Flame },
  { id: "target", label: "Focus", Icon: Target },
  { id: "briefcase", label: "Work", Icon: Briefcase },
  { id: "code", label: "Build", Icon: Code },
  { id: "laptop", label: "Computer", Icon: Laptop },
  { id: "book", label: "Study", Icon: BookOpen },
  { id: "pencil", label: "Write", Icon: Pencil },
  { id: "sparkles", label: "Ideas", Icon: Sparkles },
  { id: "video", label: "Video", Icon: Video },
  { id: "camera", label: "Capture", Icon: Camera },
  { id: "megaphone", label: "Publish", Icon: Megaphone },
  { id: "coffee", label: "Break", Icon: Coffee },
  { id: "leaf", label: "Reset", Icon: Leaf },
  { id: "heart", label: "Life", Icon: Heart },
  { id: "moon", label: "Evening", Icon: Moon },
  { id: "flag", label: "Review", Icon: Flag },
  { id: "timer", label: "Timed", Icon: Timer },
  { id: "bell", label: "Reminder", Icon: Bell },
];

const MAP: Record<string, LucideIcon> = Object.fromEntries(CHECKPOINT_ICONS.map((item) => [item.id, item.Icon]));

export function CheckpointIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && MAP[name]) || Target;
  return <Icon className={className} strokeWidth={2} aria-hidden="true" />;
}

export function DaymarkMark({ className = "size-8" }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-xl bg-lime text-forest ${className}`}>
      <svg viewBox="0 0 16 16" className="size-[55%]" aria-hidden="true">
        <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.35" />
        <path
          d="M8 2.8a5.2 5.2 0 1 1-3.68 1.52"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
