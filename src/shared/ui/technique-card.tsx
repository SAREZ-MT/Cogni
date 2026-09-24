import type { LucideIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill, type PillProps } from "@/shared/ui/pill";
import { cn } from "@/shared/ui/utils";

// Study-technique color vocabulary (design/shell-look, studyplatform
// StudyPanel.tsx palette): mapped onto existing IconTile/Pill tones instead
// of adding new ones — `primary` (violet) already matches the reference's
// flashcards brand color, and `green`/`pink` already match its active-recall
// and exam hex pairs almost exactly (pastel-green-fg #1b7a43 vs reference
// #059669; pastel-pink-fg #9b2c4a is an exact match). No new IconTile/Pill
// tone was needed.
export type TechniqueTone = "primary" | "green" | "pink";

const TONE_BUTTON_CLASS: Record<TechniqueTone, string> = {
  primary: "bg-primary-100 text-primary-600 hover:bg-primary-100",
  green: "bg-pastel-green text-pastel-green-fg hover:bg-pastel-green",
  pink: "bg-pastel-pink text-pastel-pink-fg hover:bg-pastel-pink",
};

const TONE_PILL_TONE: Record<TechniqueTone, PillProps["tone"]> = {
  primary: "primary",
  green: "green",
  pink: "pink",
};

export interface TechniqueCardProps {
  icon: LucideIcon;
  tone: TechniqueTone;
  name: string;
  description: string;
  meta: string;
  actionLabel: string;
  className?: string;
}

// Expanded technique card (design/shell-look, studyplatform StudyPanel.tsx
// anatomy): icon tile + name + description, a muted meta line, and a
// disabled action button + "pronto" pill. The action stays disabled — the
// study techniques themselves aren't built yet — but keeps the technique's
// tone color at reduced opacity (Button's own `disabled:opacity-50`)
// instead of going fully gray, so the panel still "reads colourful and
// alive" per the design brief.
export function TechniqueCard({
  icon: Icon,
  tone,
  name,
  description,
  meta,
  actionLabel,
  className,
}: TechniqueCardProps) {
  return (
    <Card
      padding="none"
      className={cn("flex flex-col gap-2 rounded-lg p-2.5", className)}
    >
      <div className="flex items-start gap-2.5">
        <IconTile tone={tone} size="30" radius="md">
          <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-fg">{name}</p>
          <p className="mt-0.5 text-[10.5px] text-fg-muted">{description}</p>
        </div>
      </div>
      <p className="text-[10px] text-fg-muted">{meta}</p>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          disabled
          size="sm"
          className={cn("flex-1 text-[11.5px]", TONE_BUTTON_CLASS[tone])}
        >
          {actionLabel}
        </Button>
        <Pill size="sm" tone={TONE_PILL_TONE[tone]}>
          pronto
        </Pill>
      </div>
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
      tone={tone}
      size="36"
      radius="input"
      title={title}
      className={cn("shadow-xs", !available && "opacity-35")}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
    </IconTile>
  );
}
