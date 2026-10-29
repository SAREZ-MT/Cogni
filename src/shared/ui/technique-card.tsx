import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { IconTile } from "@/shared/ui/icon-tile";
import { cn } from "@/shared/ui/utils";

// Study-technique colour vocabulary (Phase 6 T5b, user decisions
// 2026-10-06): Flashcards yellow, Recordación activa green, Examen red, as
// the design system's soft pastel pairs (solid fills were too strong). The
// icon tile and the "Generar" button share the technique's pair.
export type TechniqueTone = "yellow" | "green" | "rose";

const TONE_TILE: Record<TechniqueTone, "yellow" | "mint" | "pink"> = {
  yellow: "yellow",
  green: "mint",
  rose: "pink",
};

// Pastel "Generar" fill per technique; everything else about the button is
// shared (GENERATE_BUTTON_CLASS). Each -fg meets WCAG AA for the 11.5px
// label on its pastel: pastel-yellow-fg 6.4:1, pastel-mint-fg 6.8:1 (chosen
// over pastel-green-fg, 4.6:1), pastel-pink-fg 5.9:1. Hover darkens the
// same pair slightly (brightness-95) instead of switching colour.
// The pastel pair itself is exported so every technique-coloured surface
// (TechniqueChip on the calendar) reuses exactly this mapping.
export const TECHNIQUE_PAIR_CLASS: Record<TechniqueTone, string> = {
  yellow: "bg-pastel-yellow text-pastel-yellow-fg",
  green: "bg-pastel-mint text-pastel-mint-fg",
  rose: "bg-pastel-pink text-pastel-pink-fg",
};

// Technique accent fill (Phase 8 H3, user decisions 2026-10-19): a soft
// but visible pastel (yellow, mint, pink) for the bars, dots and progress
// fills that mark a technique where the pastel background alone is too
// faint — calendar chips, review rows, the week's split and progress bars,
// status-pill dots. Never carries text.
export const TECHNIQUE_ACCENT_CLASS: Record<TechniqueTone, string> = {
  yellow: "bg-technique-flashcards-accent",
  green: "bg-technique-recall-accent",
  rose: "bg-technique-exam-accent",
};

// The same accents as a text colour, for SVG strokes drawn with
// currentColor (TechniqueRing).
export const TECHNIQUE_ACCENT_TEXT_CLASS: Record<TechniqueTone, string> = {
  yellow: "text-technique-flashcards-accent",
  green: "text-technique-recall-accent",
  rose: "text-technique-exam-accent",
};

// H9-T1 (user, 2026-10-29): the panel lacked presence, so the tile itself
// now carries the technique colour — its pastel at half strength as the
// surface and a border in the same hue (the -fg at 18%) — instead of a
// white card with a pastel button. Each class is spelled out per tone so
// Tailwind sees the literal names.
const TONE_CARD_CLASS: Record<TechniqueTone, string> = {
  yellow: "bg-pastel-yellow/55 border-pastel-yellow-fg/18",
  green: "bg-pastel-mint/55 border-pastel-mint-fg/18",
  rose: "bg-pastel-pink/55 border-pastel-pink-fg/18",
};

// On the tinted tile the icon sits on a white tile in the technique's -fg,
// so it pops instead of blending into the surface.
const TONE_ICON_CLASS: Record<TechniqueTone, string> = {
  yellow: "text-pastel-yellow-fg",
  green: "text-pastel-mint-fg",
  rose: "text-pastel-pink-fg",
};

// "Generar" is a white button with the -fg label and a border in the same
// hue: the tile's one clear action. Every -fg meets WCAG AA on white
// (pastel-yellow-fg 7.1:1, pastel-mint-fg 7.7:1, pastel-pink-fg 7.6:1).
// Hover fills it with the technique pastel; the label keeps its colour.
const TONE_BUTTON_CLASS: Record<TechniqueTone, string> = {
  yellow:
    "text-pastel-yellow-fg border-pastel-yellow-fg/25 hover:bg-pastel-yellow",
  green: "text-pastel-mint-fg border-pastel-mint-fg/25 hover:bg-pastel-mint",
  rose: "text-pastel-pink-fg border-pastel-pink-fg/25 hover:bg-pastel-pink",
};

const GENERATE_BUTTON_CLASS =
  "h-8 w-full border bg-card font-semibold text-[12px] shadow-xs disabled:cursor-not-allowed disabled:opacity-60";

export interface TechniqueCardProps {
  icon: LucideIcon;
  tone: TechniqueTone;
  name: string;
  // No technique is built yet (design/shell-look, user decision
  // 2026-09-24): every card's "Generar" action stays disabled until a real
  // Server Action exists. Kept as a prop rather than hardcoded so a future
  // technique can flip it once it's actually wired up.
  disabled?: boolean;
  // Wires the card to a real action (Flashcards, Phase 3): the button is then
  // enabled by default and calls this on click. Without it the card stays the
  // inert preview described above.
  onGenerate?: () => void;
  // The action is running: the button is disabled, busy and reads
  // "Generando…".
  pending?: boolean;
  generateTestId?: string;
  // One short line under the name (H9-T1: the remaining generations); the
  // caller owns the copy. There is no description line any more.
  meta?: ReactNode;
  // Options of the action rendered between the header and the button
  // (e.g. Examen's question count); the caller owns them.
  controls?: ReactNode;
  // Feedback under the button (notices, errors); the caller owns the copy.
  children?: ReactNode;
  className?: string;
}

// Technique tile (H9-T1, user 2026-10-29; was the design/shell-look
// studyplatform StudyPanel.tsx card): icon + name (+ the meta line) and a
// single full-width "Generar" — no description, no navigation. The whole
// tile is tinted in the technique colour so the panel reads colourful and
// alive; a disabled button keeps that colour at `disabled:opacity-60`.
export function TechniqueCard({
  icon: Icon,
  tone,
  name,
  disabled,
  onGenerate,
  pending = false,
  generateTestId,
  meta,
  controls,
  children,
  className,
}: TechniqueCardProps) {
  const wired = onGenerate !== undefined;
  const isDisabled = pending || (disabled ?? !wired);
  return (
    <Card
      padding="none"
      data-part="technique-card"
      data-tone={tone}
      className={cn(
        "flex flex-col gap-2.5 rounded-lg p-3 shadow-none",
        TONE_CARD_CLASS[tone],
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <IconTile
          size="30"
          radius="md"
          data-part="technique-icon"
          className={cn("bg-card shadow-xs", TONE_ICON_CLASS[tone])}
        >
          <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[13px] text-fg leading-tight">{name}</p>
          {meta}
        </div>
      </div>
      {controls}
      <Button
        type="button"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={pending || undefined}
        data-testid={generateTestId}
        onClick={onGenerate}
        title={isDisabled && !wired ? "Disponible pronto" : undefined}
        size="sm"
        className={cn(GENERATE_BUTTON_CLASS, TONE_BUTTON_CLASS[tone])}
      >
        <Sparkles aria-hidden="true" size={12} strokeWidth={2} />
        {pending ? "Generando…" : "Generar"}
      </Button>
      {children}
    </Card>
  );
}

// Empty-state glyph of the panel's "Generado en esta página" (H9-T1): three
// small tiles fanned like a stack of study material, one per technique
// colour (Examen at the back, Flashcards in front). Purely decorative.
const STACK_LAYERS: readonly {
  tone: TechniqueTone;
  className: string;
}[] = [
  {
    tone: "rose",
    className:
      "bg-pastel-pink border-pastel-pink-fg/25 -translate-x-3.5 translate-y-0.5 -rotate-[14deg]",
  },
  {
    tone: "green",
    className:
      "bg-pastel-mint border-pastel-mint-fg/25 translate-x-3.5 translate-y-0.5 rotate-[14deg]",
  },
  {
    tone: "yellow",
    className: "bg-pastel-yellow border-pastel-yellow-fg/25 -translate-y-1",
  },
];

export function TechniqueStack({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block h-9 w-16", className)}
    >
      {STACK_LAYERS.map((layer) => (
        <span
          key={layer.tone}
          data-part="technique-layer"
          data-tone={layer.tone}
          className={cn(
            "absolute inset-x-4 inset-y-0.5 rounded-md border shadow-xs",
            layer.className,
          )}
        />
      ))}
    </span>
  );
}

export interface TechniqueIconStripProps {
  icon: LucideIcon;
  tone: TechniqueTone;
  title: string;
  available?: boolean;
}

// Collapsed-state icon (design/shell-look, studyplatform StudyPanel.tsx
// `IconStrip`): a 36x36 tinted tile with a native `title` tooltip, dimmed
// when the technique isn't available yet.
export function TechniqueIconStrip({
  icon: Icon,
  tone,
  title,
  available = false,
}: TechniqueIconStripProps) {
  return (
    <IconTile
      tone={TONE_TILE[tone]}
      size="36"
      radius="input"
      title={title}
      className={cn("shadow-xs", !available && "opacity-35")}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
    </IconTile>
  );
}
