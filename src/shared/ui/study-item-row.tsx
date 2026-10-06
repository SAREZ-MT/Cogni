import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/shared/ui/utils";

// Same colour vocabulary as TechniqueCard/TechniqueTone (Flashcards yellow,
// Recordación activa green, Examen red) without importing it, so this atom
// stays usable outside the "Técnicas" panel.
export type StudyItemTone = "yellow" | "green" | "rose";

const DOT_TONE_CLASS: Record<StudyItemTone, string> = {
  yellow: "bg-warning-500",
  green: "bg-success-600",
  rose: "bg-rose-600",
};

export interface StudyItemRowProps {
  href: string;
  label: string;
  detail: string;
  tone: StudyItemTone;
  testId?: string;
  // Native tooltip (e.g. the answer side of a flashcard row).
  title?: string;
  className?: string;
}

// Generated-item row (docs/design-system/screenshots/editor.png, "Mazos
// guardados" rows): a white bordered row with a tone dot, the label over a
// muted meta line, and a muted chevron. The whole row is a link straight to
// that item's practice route.
export function StudyItemRow({
  href,
  label,
  detail,
  tone,
  testId,
  title,
  className,
}: StudyItemRowProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      title={title}
      className={cn(
        "flex items-center gap-2.5 rounded-input border border-border-subtle bg-card px-3 py-2 no-underline transition-colors hover:bg-hover",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", DOT_TONE_CLASS[tone])}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-[11.5px] text-fg">
          {label}
        </span>
        <span className="truncate text-[10px] text-fg-muted">{detail}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        size={12}
        strokeWidth={2}
        className="shrink-0 text-fg-muted"
      />
    </Link>
  );
}
