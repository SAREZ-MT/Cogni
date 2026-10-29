import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/utils";

export interface EmptyStateCtaProps {
  href: string;
  children: ReactNode;
  // "brand" (default): the violet pill. "technique" (Phase 8 H11): the
  // technique's CTA colours from the surrounding `data-technique-theme`
  // (globals.css `technique-cta`: flashcards amber-300 with amber-900 ink,
  // recall emerald-700 and exams rose-700 with white ink).
  tone?: "brand" | "technique";
  className?: string;
}

// Shared shape: a 48px pill that wraps instead of clipping when a narrow
// column squeezes it.
export const EMPTY_STATE_CTA_SHAPE =
  "h-auto min-h-12 max-w-full whitespace-normal rounded-pill px-6 py-2.5 text-center font-semibold text-[15px]";

export const EMPTY_STATE_CTA_TONE = {
  brand:
    "bg-primary-600 text-white shadow-[0_6px_18px_-6px_rgb(124_58_237/0.55)] hover:bg-primary-700",
  // Arbitrary utilities so tailwind-merge drops the Button's own fill and
  // ink; `technique-cta` adds the edge and the coloured shadow.
  technique:
    "technique-cta bg-(--theme-cta) text-(--theme-cta-fg) hover:bg-(--theme-cta-hover)",
} as const;

// The illustrated empty states' primary step as a link (Phase 8 H10): the
// same violet pill with a soft violet shadow as the notebooks hub's
// "Crear mi primer cuaderno" (H4-T1) and the empty notebook's "Nueva
// página" (H5-T4), for a CTA that navigates instead of opening a dialog.
export function EmptyStateCta({
  href,
  children,
  tone = "brand",
  className,
}: EmptyStateCtaProps) {
  return (
    <Button
      asChild
      size="lg"
      className={cn(
        EMPTY_STATE_CTA_SHAPE,
        EMPTY_STATE_CTA_TONE[tone],
        className,
      )}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}
