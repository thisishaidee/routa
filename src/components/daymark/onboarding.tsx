import { useRef, useState } from "react";
import { X } from "lucide-react";
import { DaymarkMark } from "@/lib/daymark/icons";
import { buildTemplate, TEMPLATE_OPTIONS, type TemplateId } from "@/lib/daymark/templates";
import { FOCUS_AREAS, type FocusAreaId, type Profile, type Routine } from "@/lib/daymark/types";
import { clockLabel } from "@/lib/daymark/time";
import { useDaymark } from "@/lib/daymark/store";

const STEP_COUNT = 4;

export function Onboarding() {
  const { completeOnboarding } = useDaymark();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [focusAreas, setFocusAreas] = useState<FocusAreaId[]>([]);
  const [templateId, setTemplateId] = useState<TemplateId>("balanced");
  const [draftRoutine, setDraftRoutine] = useState<Routine | null>(null);

  const toggleFocus = (id: FocusAreaId) => {
    setFocusAreas((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const continueFromWelcome = () => {
    if (!name.trim()) {
      setNameError("Enter your name to continue.");
      nameInputRef.current?.focus();
      return;
    }
    setNameError("");
    setStep(1);
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-lg font-extrabold tracking-[0.14em]">
            <DaymarkMark />
            ROUTA
          </div>
          <p className="text-[11px] font-black tracking-[0.12em] text-quiet">
            STEP {step + 1} OF {STEP_COUNT}
          </p>
        </div>
        <div className="mb-8 mt-5 flex gap-1.5" aria-hidden="true">
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <span key={index} className={`h-1 flex-1 rounded-full ${index <= step ? "bg-forest" : "bg-line"}`} />
          ))}
        </div>

        {step === 0 ? (
          <section className="flex flex-1 flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-quiet">Welcome</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-balance">Build a daily rhythm that fits your life.</h1>
            <p className="mt-4 text-pretty text-sm leading-6 text-quiet">
              ROUTA helps you plan checkpoints, follow them through the day, and see real progress. You can start from a template or from nothing.
            </p>
            <ul className="mt-5 space-y-2 text-sm leading-6 text-quiet">
              <li>Create your own routine, including times and tasks.</li>
              <li>Optional reminders while ROUTA is open in this browser.</li>
              <li>Progress stays on this device unless you export a backup.</li>
            </ul>
            <label className="mt-8 text-xs font-bold text-quiet">
              What should we call you?
              <input
                ref={nameInputRef}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="Your name"
                autoComplete="given-name"
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "name-error" : undefined}
                className={`mt-2 h-12 w-full rounded-2xl border bg-paper px-4 text-sm outline-none focus:border-lime ${
                  nameError ? "border-danger" : "border-line"
                }`}
              />
            </label>
            {nameError ? (
              <p id="name-error" role="alert" className="mt-2 text-xs font-semibold text-danger">
                {nameError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={continueFromWelcome}
              className="mt-auto h-14 rounded-full bg-forest text-sm font-bold text-paper"
            >
              Build my routine →
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
                    aria-pressed={selected}
                    className={`min-h-14 rounded-2xl border px-4 text-left text-sm font-bold ${
                      selected ? "border-forest bg-cream ring-1 ring-forest" : "border-line bg-paper"
                    }`}
                  >
                    {area.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto flex gap-3 pt-8">
              <button type="button" onClick={() => setStep(0)} className="h-14 flex-1 rounded-full border border-line text-sm font-bold">
                Back
              </button>
              <button type="button" onClick={() => setStep(2)} className="h-14 flex-1 rounded-full bg-forest text-sm font-bold text-paper">
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
                    aria-pressed={selected}
                    className={`w-full rounded-3xl border px-5 py-4 text-left ${
                      selected ? "border-forest bg-cream ring-1 ring-forest" : "border-line bg-paper"
                    }`}
                  >
                    <strong className="block text-sm">{option.name}</strong>
                    <span className="mt-1 block text-xs text-quiet">{option.blurb}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-auto flex gap-3 pt-8">
              <button type="button" onClick={() => setStep(1)} className="h-14 flex-1 rounded-full border border-line text-sm font-bold">
                Back
              </button>
              <button type="button" onClick={goPreview} className="h-14 flex-1 rounded-full bg-forest text-sm font-bold text-paper">
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
            <p className="mt-2 text-sm text-quiet">
              Reminders are optional. Your data stays on this device. Export a backup anytime from Settings.
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
                    className="grid size-11 shrink-0 place-items-center rounded-full text-quiet"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-auto flex gap-3 pt-8">
              <button type="button" onClick={() => setStep(2)} className="h-14 flex-1 rounded-full border border-line text-sm font-bold">
                Back
              </button>
              <button type="button" onClick={finish} className="h-14 flex-1 rounded-full bg-forest text-sm font-bold text-paper">
                Start my ROUTA
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
