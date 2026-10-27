"use client";

import { LoaderCircle } from "lucide-react";
import { useIsImporting } from "./active-imports-provider";
import { INGESTION_COPY } from "./ingestion-copy";

export interface ImportingPageBadgeProps {
  pageId: string;
}

// design.md, "Decision: Vista de página, llamada en curso y polling con
// TanStack Query", last paragraph: injected through `pageBadge` (T9's
// notebooks/ui/notebook-actions-slot.tsx) next to a page with an active
// (queued/processing, non-abandoned) import; renders nothing once the job
// is no longer active — no polling of its own, it reads
// ActiveImportsProvider's shared query. Lucide at 1.75 stroke (README,
// "Iconography"), motion-reduce respected on the spin animation.
export function ImportingPageBadge({ pageId }: ImportingPageBadgeProps) {
  const isImporting = useIsImporting(pageId);
  if (!isImporting) return null;
  return (
    <LoaderCircle
      size={14}
      strokeWidth={1.75}
      role="img"
      aria-label={INGESTION_COPY.importingDocument}
      className="animate-spin text-muted-foreground motion-reduce:animate-none"
    />
  );
}
