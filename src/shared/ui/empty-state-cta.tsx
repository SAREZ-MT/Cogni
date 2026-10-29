import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/utils";

export interface EmptyStateCtaProps {
  href: string;
  children: ReactNode;
  className?: string;
}

// The illustrated empty states' primary step as a link (Phase 8 H10): the
// same violet pill with a soft violet shadow as the notebooks hub's
// "Crear mi primer cuaderno" (H4-T1) and the empty notebook's "Nueva
// página" (H5-T4), for a CTA that navigates instead of opening a dialog.
export function EmptyStateCta({
  href,
  children,
  className,
}: EmptyStateCtaProps) {
  return (
    <Button
      asChild
      size="lg"
      className={cn(
        // Wraps instead of clipping when a narrow column squeezes it.
        "h-auto min-h-12 max-w-full whitespace-normal rounded-pill bg-primary-600 px-6 py-2.5 text-center font-semibold text-[15px] text-white shadow-[0_6px_18px_-6px_rgb(124_58_237/0.55)] hover:bg-primary-700",
        className,
      )}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}
