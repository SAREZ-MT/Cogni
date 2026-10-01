import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export interface QuestionCardProps {
  // Uppercase eyebrow label next to the 6px success dot (default "Pregunta").
  eyebrowLabel?: string;
  question: ReactNode;
  // Extra content below the question text (e.g. a hint) — reserved slot,
  // unused by the current Active recall session.
  children?: ReactNode;
  className?: string;
}

// Active recall's open-question card (design preview, studyplatform-
// active-recall-style.md §"Session"): white card, 6px success dot + uppercase
// eyebrow, then the question text at 19/600.
export function QuestionCard({
  eyebrowLabel = "Pregunta",
  question,
  children,
  className,
}: QuestionCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border-subtle bg-card p-9 shadow-md",
        className,
      )}
    >
      <div className="mb-3.5 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-success-500"
        />
        <span className="font-medium text-[11px] text-fg-muted uppercase tracking-[0.05em]">
          {eyebrowLabel}
        </span>
      </div>
      <p className="font-semibold text-[19px] text-fg leading-[1.5]">
        {question}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
