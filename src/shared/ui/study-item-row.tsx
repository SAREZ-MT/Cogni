import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/shared/ui/utils";

// Reuses the same tone vocabulary as TechniqueCard/TechniqueTone (primary
// violet, success green, pink) instead of importing it, so this atom stays
// usable outside the "Técnicas" panel without a technique-card dependency.
export type StudyItemTone = "primary" | "green" | "pink";

const DOT_TONE_CLASS: Record<StudyItemTone, string> = {
  primary: "bg-primary-600",
  green: "bg-success-600",
  pink: "bg-pastel-pink-fg",
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

// Saved-study-item row (design/shell-look, studyplatform StudyPanel.tsx
// "Mazos guardados" / "Sesiones de Active Recall" / "Exámenes recientes"
// rows): a tone dot + truncated label + right-aligned detail text + a
// muted chevron, linking straight to that item's study session.
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
        "flex items-center gap-2 rounded-[9px] border border-border-subtle bg-neutral-50 px-[9px] py-[7px] no-underline transition-colors hover:bg-hover",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", DOT_TONE_CLASS[tone])}
      />
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-fg">
        {label}
      </span>
      <span className="shrink-0 text-[10px] text-fg-muted">{detail}</span>
      <ChevronRight
        aria-hidden="true"
        size={10}
        strokeWidth={2}
        className="shrink-0 text-fg-muted"
      />
    </Link>
  );
}
