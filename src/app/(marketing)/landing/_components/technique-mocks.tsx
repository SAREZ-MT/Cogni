import { Check, PenLine, Sparkles } from "lucide-react";

// Small static stand-ins for each technique's real screen, one per deck
// card. They are decorative (the card copy carries the meaning), so the
// deck hides them from assistive tech. Example content stays generic.

const RATINGS = [
  { label: "No la sé", tone: "bg-(--lp-rose-100)" },
  { label: "Difícil", tone: "bg-(--lp-yellow-100)" },
  { label: "Bien", tone: "bg-(--lp-mint-100)" },
  { label: "Fácil", tone: "bg-(--lp-violet-100)" },
] as const;

export function FlashcardMock() {
  return (
    <div className="flex w-full max-w-[340px] flex-col gap-5">
      <div className="relative h-[200px]">
        <div className="absolute inset-0 translate-x-4 -translate-y-2 rotate-[-6deg] rounded-[18px] border border-(--lp-yellow) bg-(--lp-yellow-100) p-5">
          <p className="text-right font-extrabold text-(--lp-amber-800) text-[11px] uppercase tracking-[0.12em]">
            Reverso
          </p>
        </div>
        <div className="lp-shadow-card absolute inset-0 flex flex-col justify-between rounded-[18px] border border-(--lp-yellow) bg-white p-5">
          <p className="font-bold text-(--lp-muted) text-[11px] uppercase tracking-[0.12em]">
            Tu apunte · Anverso
          </p>
          <p className="font-bold text-(--lp-ink) text-lg leading-snug">
            ¿Qué describe el concepto clave de esta página?
          </p>
          <p className="text-(--lp-muted) text-[13px]">
            Toca para ver la respuesta
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {RATINGS.map((rating) => (
          <span
            key={rating.label}
            className={`rounded-full px-3 py-1.5 font-bold text-(--lp-ink) text-[13px] ${rating.tone}`}
          >
            {rating.label}
          </span>
        ))}
      </div>
      <p className="text-(--lp-card-kicker) text-[13px]">
        Tu respuesta decide cuándo vuelve la tarjeta.
      </p>
    </div>
  );
}

export function RecallMock() {
  return (
    <div className="lp-shadow-card flex w-full max-w-[340px] flex-col gap-4 rounded-[18px] border border-(--lp-mint) bg-white p-5">
      <span className="w-fit rounded-full bg-(--lp-mint-100) px-3 py-1 font-extrabold text-(--lp-mint-800) text-[11px] uppercase tracking-[0.12em]">
        Explícalo con tus palabras
      </span>
      <p className="font-bold text-(--lp-ink) text-lg leading-snug">
        ¿Cómo le explicarías el concepto clave a alguien que no lo conoce?
      </p>
      <div className="rounded-xl border border-(--lp-line) bg-(--lp-soft) p-3.5 text-(--lp-ink-2) text-sm leading-relaxed">
        Es la idea que une las otras partes del tema, porque
        <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-(--lp-ink)" />
      </div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-(--lp-muted)">Sin mirar tu apunte</span>
        <span className="rounded-full bg-(--lp-ink) px-3.5 py-1.5 font-bold text-(--lp-paper)">
          Enviar
        </span>
      </div>
    </div>
  );
}

const OPTIONS = [
  { key: "A", text: "Opción A", picked: false },
  { key: "B", text: "Opción B", picked: true },
  { key: "C", text: "Opción C", picked: false },
] as const;

export function ExamMock() {
  return (
    <div className="lp-shadow-card flex w-full max-w-[340px] flex-col gap-4 rounded-[18px] border border-(--lp-rose) bg-white p-5">
      <div className="flex items-center justify-between font-bold text-[12px]">
        <span className="text-(--lp-rose-700) uppercase tracking-[0.12em]">
          Pregunta 3 de 10
        </span>
        <span className="text-(--lp-muted)">Tu apunte</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-(--lp-rose-100)">
        <div className="h-full w-[30%] rounded-full bg-(--lp-rose)" />
      </div>
      <p className="font-bold text-(--lp-ink) text-lg leading-snug">
        ¿Qué idea resume mejor el concepto clave?
      </p>
      <ul className="flex flex-col gap-2">
        {OPTIONS.map((option) => (
          <li
            key={option.key}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
              option.picked
                ? "border-(--lp-rose) bg-(--lp-rose-100) font-bold text-(--lp-ink)"
                : "border-(--lp-line) text-(--lp-ink-2)"
            }`}
          >
            <span
              className={`flex size-6 items-center justify-center rounded-full font-extrabold text-[12px] ${
                option.picked
                  ? "bg-(--lp-rose) text-white"
                  : "bg-(--lp-soft) text-(--lp-ink-3)"
              }`}
            >
              {option.picked ? <Check className="size-3.5" /> : option.key}
            </span>
            {option.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiReviewMock() {
  return (
    <div className="lp-shadow-card flex w-full max-w-[340px] flex-col gap-3.5 rounded-[18px] border border-(--lp-violet-400) bg-white p-5">
      <div className="flex items-center gap-2 font-extrabold text-(--lp-violet-deep) text-[12px] uppercase tracking-[0.12em]">
        <Sparkles className="size-4" />
        Borrador de la IA
      </div>
      <div className="flex items-start justify-between gap-3 rounded-xl border border-(--lp-line) p-3">
        <div className="flex flex-col gap-1">
          <span className="text-(--lp-muted) text-[11px] uppercase tracking-[0.1em]">
            Tarjeta 1
          </span>
          <span className="font-bold text-(--lp-ink) text-sm">
            ¿Qué es el concepto clave?
          </span>
        </div>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-(--lp-mint-100) text-(--lp-green-700)">
          <Check className="size-4" />
        </span>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border-2 border-(--lp-violet) p-3">
        <span className="flex items-center gap-1.5 text-(--lp-violet-deep) text-[11px] uppercase tracking-[0.1em]">
          <PenLine className="size-3.5" />
          Editando tarjeta 2
        </span>
        <span className="font-bold text-(--lp-ink) text-sm">
          ¿Con qué ideas se relaciona?
          <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-(--lp-violet)" />
        </span>
      </div>
      <div className="flex gap-2 text-[13px]">
        <span className="rounded-full border border-(--lp-line) px-3.5 py-1.5 font-bold text-(--lp-ink-2)">
          Editar
        </span>
        <span className="rounded-full bg-(--lp-violet) px-3.5 py-1.5 font-bold text-white">
          Aprobar
        </span>
      </div>
    </div>
  );
}
