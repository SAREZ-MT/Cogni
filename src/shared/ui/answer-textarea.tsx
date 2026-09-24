import type * as React from "react";
import { cn } from "@/shared/ui/utils";

export type AnswerTextareaProps = React.ComponentProps<"textarea">;

// Active recall's open-answer field (design preview, studyplatform-
// active-recall-style.md §"Session"): a neutral-50 textarea that turns
// success-toned on focus. Built as its own atom rather than styling the
// generic `Textarea` (shared/ui/textarea.tsx) — its shadcn defaults
// (bg-transparent, border-input, min-h-16, focus:ring-ring) conflict with
// enough of this look (bg-neutral-50, min-h-[120px], focus:border-success-500)
// that overriding them would be more fragile than a plain element, the same
// call `RatingButton`/`DeckCard` already made for their own custom controls.
export function AnswerTextarea({ className, ...props }: AnswerTextareaProps) {
  return (
    <textarea
      data-testid="answer-textarea"
      className={cn(
        "min-h-[120px] w-full resize-none rounded-lg border-[1.5px] border-neutral-200/80 bg-neutral-50 px-4 py-3.5 text-fg text-sm leading-[1.6] outline-none transition-colors placeholder:text-fg-muted focus:border-success-500 focus:bg-card focus:ring-[3px] focus:ring-success-500/10",
        className,
      )}
      {...props}
    />
  );
}
