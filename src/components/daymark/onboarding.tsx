import { useState } from "react";
import { X } from "lucide-react";
import { DaymarkMark } from "@/lib/daymark/icons";
import { buildTemplate, TEMPLATE_OPTIONS, type TemplateId } from "@/lib/daymark/templates";
import { FOCUS_AREAS, type FocusAreaId, type Profile, type Routine } from "@/lib/daymark/types";
import { clockLabel } from "@/lib/daymark/time";
import { useDaymark } from "@/lib/daymark/store";

export function Onboarding() {
  const { completeOnboarding } = useDaymark();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [focusAreas, setFocusAreas] = useState<FocusAreaId[]>([]);
  const [templateId, setTemplateId] = useState<TemplateId>("balanced");
  const [draftRoutine, setDraftRoutine] = useState<Routine | null>(null);

  const toggleFocus = (id: FocusAreaId) => {
    setFocusAreas((current) => (current.includes(id) ? current.filter((item) => item.id !== id) : [...current, id]));
  };

  const goPreview = () => {
    const next = buildTemplate(templateId);
    if (name.trim() && templateId !== "custom") next.name = `${name.trim()}'s rhythm`;
    setDraftRoutine(next);
    setStep(3);
  };

  const removeCheckpoint = (id: string) => {
    setDraftRoutine((current) => {
      if (!current) return current;
      return { ...current, checkpoints: current.checkpoints.filter((item) => item.id !== id) };
    });
  };

  const finish = () => {
    const profile: Profile = {
      name: name.trim(),
      focusAreas,
      onboarded: true,
    };
    completeOnboarding(profile, draftRoutine ?? buildTemplate(templateId));
  };

  const preview = draftRoutine?.checkpoints ?? [];

  return (
    <main className="min-h-dvh bg-canvas px-5 py-10 text-ink">
      <div className="mx-auto flex min-h-[80dvh] max-w-lg flex-col">
        <div className="mb-10 flex items-center gap-2 text-lg font-bold tracking-tight">
          <DaymarkMark />
          routa
        </div>

        {step === 0 ? (
          <section className="flex flex-1 flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-quiet">Welcome</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-balance">Build a daily rhythm that fits your life.</h1>
            <p className="mt-4 text-pretty text-sm leading-6 text-quiet">
              Plan checkpoints, get reminded at the right time, and see the day through. No one else's routine, yours.
            </p>
            <label className="mt-8 text-xs font-bold text-quiet">
              What should we call you?
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                autoComplete="given-name"
                className="mt-2 h-12 w-full rounded-2xl border border-line bg-paper px-4 text-sm outline-none focus:border-lime"
              />
            </label>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-auto h-12 rounded-2xl bg-forest text-sm font-bold text-paper"
            >
              Build my routine
            </button>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="flex flex-1 flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-quiet">Focus</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-balance">What do you want this rhythm for?</h1>
            <p className="mt-2 text-sm text-quiet">Pick as many as you like.</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              {FOCUS_AREAS.map((area) => {
                const selected = focusAreas.includes(area.id);
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => toggleFocus(area.id)}
                    className={`min-h-14 rounded-2xl border px-4 text-left text-sm font-bold ${
                      selected ? "border-lime bg-mist text-olive" : "border-line bg-paper"
                    }`}
                  >
                    {area.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto flex gap-3 pt-8">
              <button type="button" onClick={() => setStep(0)} className="h-12 flex-1 rounded-2xl border border-line text-sm font-bold">
                Back
              </button>
              <button type="button" onClick={() => setStep(2)} className="h-12 flex-1 rounded-2xl bg-forest text-sm font-bold text-paper">
                Continue
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="flex flex-1 flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-quiet">Template</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-balance">Start from a rhythm, or from nothing.</h1>
            <div className="mt-6 space-y-2">
              {TEMPLATE_OPTIONS.map((option) => {
                const selected = templateId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTemplateId(option.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left ${
                      selected ? "border-lime bg-mist" : "border-line bg-paper"
                    }`}
                  >
                    <strong className="block text-sm">{option.name}</strong>
                    <span className="mt-1 block text-xs text-quiet">{option.blurb}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-auto flex gap-3 pt-8">
              <button type="button" onClick={() => setStep(1)} className="h-12 flex-1 rounded-2xl border border-line text-sm font-bold">
                Back
              </button>
              <button type="button" onClick={goPreview} className="h-12 flex-1 rounded-2xl bg-forest text-sm font-bold text-paper">
                Continue
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="flex flex-1 flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-quiet">Customize</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-balance">You're ready.</h1>
            <p className="mt-2 text-sm text-quiet">
              {preview.length
                ? "Remove anything that doesn't fit. You can edit times and tasks after you start."
                : "Your routine is empty. Add your first checkpoint from the Routine tab."}
            </p>
            <label className="mt-5 text-xs font-bold text-quiet">
              Routine name
              <input
                value={draftRoutine?.name ?? ""}
                onChange={(event) =>
                  setDraftRoutine((current) => (current ? { ...current, name: event.target.value } : current))
                }
                className="mt-2 h-12 w-full rounded-2xl border border-line bg-paper px-4 text-sm outline-none focus:border-lime"
              />
            </label>
            <div className="mt-5 space-y-2">
              {preview.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3">
                  <span className="w-16 shrink-0 text-xs font-bold text-quiet">{clockLabel(item.time)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.title}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${item.title}`}
                    onClick={() => removeCheckpoint(item.id)}
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-quiet"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-auto flex gap-3 pt-8">
              <button type="button" onClick={() => setStep(2)} className="h-12 flex-1 rounded-2xl border border-line text-sm font-bold">
                Back
              </button>
              <button type="button" onClick={finish} className="h-12 flex-1 rounded-2xl bg-forest text-sm font-bold text-paper">
                Start my Routa
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
