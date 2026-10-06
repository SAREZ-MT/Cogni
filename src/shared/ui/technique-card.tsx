import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { IconTile } from "@/shared/ui/icon-tile";
import { cn } from "@/shared/ui/utils";

// Study-technique colour vocabulary (Phase 6 T5b, user decision
// 2026-10-06): Flashcards yellow, Recordación activa green, Examen red. The
// icon tile uses the existing semantic IconTile pastel pairs (the flashcards
// hub already shows Flashcards on `warning`, exams on `rose`).
export type TechniqueTone = "yellow" | "green" | "rose";

const TONE_TILE: Record<TechniqueTone, "warning" | "success" | "rose"> = {
  yellow: "warning",
  green: "success",
  rose: "rose",
};

// Solid, tone-coloured "Generar" button (full width, sparkles icon — the
// look of docs/design-system/screenshots "Generar"). Foregrounds meet WCAG
// AA for the 11.5px label: near-black on warning-500 (8.2:1, white would be
// 2.1:1), white on success-700 (7.7:1; success-600 is only 3.8:1) and white
// on rose-600 (4.7:1).
const TONE_BUTTON_CLASS: Record<TechniqueTone, string> = {
  yellow: "bg-warning-500 text-fg hover:bg-warning-600",
  green: "bg-success-700 text-white hover:bg-success-700/90",
  rose: "bg-rose-600 text-white hover:bg-rose-600/90",
};

export interface TechniqueCardProps {
  icon: LucideIcon;
  tone: TechniqueTone;
  name: string;
  description: string;
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
  // Options of the action rendered between the description and the button
  // (e.g. Examen's question count); the caller owns them.
  controls?: ReactNode;
  // Feedback under the button (remaining quota, notices, errors); the caller
  // owns the copy.
  children?: ReactNode;
  className?: string;
}

// Expanded technique card (design/shell-look, studyplatform StudyPanel.tsx
// anatomy, simplified per user decision 2026-09-24): icon tile + name +
// description, and a single full-width "Generar" action — no meta line, no
// navigation, no "pronto" pill. The disabled button keeps the technique's
// full tone color at `disabled:opacity-60` instead of going fully gray, so
// the panel still "reads colourful and alive" while every action is inert.
export function TechniqueCard({
  icon: Icon,
  tone,
  name,
  description,
  disabled,
  onGenerate,
  pending = false,
  generateTestId,
  controls,
  children,
  className,
}: TechniqueCardProps) {
  const wired = onGenerate !== undefined;
  const isDisabled = pending || (disabled ?? !wired);
  return (
    <Card
      padding="none"
      className={cn("flex flex-col gap-2.5 rounded-lg p-2.5", className)}
    >
      <div className="flex items-start gap-2.5">
        <IconTile tone={TONE_TILE[tone]} size="30" radius="md">
          <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-fg">{name}</p>
          <p className="mt-0.5 text-[10.5px] text-fg-muted">{description}</p>
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
        className={cn(
          "w-full text-[11.5px] disabled:cursor-not-allowed disabled:opacity-60",
          TONE_BUTTON_CLASS[tone],
        )}
      >
        <Sparkles aria-hidden="true" size={12} strokeWidth={2} />
        {pending ? "Generando…" : "Generar"}
      </Button>
      {children}
    </Card>
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
