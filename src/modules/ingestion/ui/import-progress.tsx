import {
  CircleAlert,
  CircleCheck,
  FileText,
  LoaderCircle,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/shared/ui/utils";
import { INGESTION_COPY, pagesOmittedMessage } from "./ingestion-copy";

// specs/design-tokens-and-shell/spec.md, "Requirement: Indicador de
// progreso de importación" — the six states of an import job's lifecycle
// (design.md's table drops `done` into two icon/color variants depending
// on `pagesWithoutText`).
export type ImportProgressState =
  | "uploading"
  | "queued"
  | "processing"
  | "done"
  | "failed";

const ACTIVE_STATES: readonly ImportProgressState[] = [
  "uploading",
  "queued",
  "processing",
];

export interface ImportProgressProps {
  state: ImportProgressState;
  pagesWithoutText?: number;
  error?: string | null;
  // The 90-second "tardando más de lo esperado" notice (design.md's table,
  // last row). Owned by the caller (T11's polling view): this component
  // only renders the extra line alongside an active state.
  delayed?: boolean;
}

interface StateVisual {
  icon: LucideIcon;
  spin: boolean;
  // Card surface tokens per docs/design-system/preview/comp-cards.html:
  // bg-card, border-border-default, rounded-xl (16px), shadow-xs. Icon
  // circle colors map to @theme tokens only, no inline hex (spec
  // scenario "Ausencia de valores literales").
  circleClassName: string;
}

function visualFor(
  state: ImportProgressState,
  hasOmissions: boolean,
): StateVisual {
  switch (state) {
    case "uploading":
    case "processing":
      return {
        icon: LoaderCircle,
        spin: true,
        circleClassName: "bg-primary-50 text-primary-600",
      };
    case "queued":
      return {
        icon: FileText,
        spin: false,
        circleClassName: "bg-primary-50 text-primary-600",
      };
    case "done":
      return hasOmissions
        ? {
            icon: TriangleAlert,
            spin: false,
            circleClassName: "bg-warning-50 text-warning-600",
          }
        : {
            icon: CircleCheck,
            spin: false,
            circleClassName: "bg-success-50 text-success-600",
          };
    case "failed":
      return {
        icon: CircleAlert,
        spin: false,
        circleClassName: "bg-error-50 text-error-600",
      };
  }
}

function messageFor(
  state: ImportProgressState,
  pagesWithoutText: number,
  error: string | null | undefined,
): string {
  switch (state) {
    case "uploading":
      return INGESTION_COPY.progress.uploading;
    case "queued":
      return INGESTION_COPY.progress.queued;
    case "processing":
      return INGESTION_COPY.progress.processing;
    case "done":
      return pagesWithoutText > 0
        ? pagesOmittedMessage(pagesWithoutText)
        : INGESTION_COPY.progress.done;
    case "failed":
      return error ?? INGESTION_COPY.progress.genericError;
  }
}

// The six-state progress card (design.md, "Decision: Indicador de
// progreso y copy"): a11y roles/aria-live per state, Lucide icons at 1.75
// stroke, motion-reduce respected, `data-testid`/`data-status` for the
// e2e suite (tests/e2e/pdf-import.spec.ts).
export function ImportProgress({
  state,
  pagesWithoutText = 0,
  error,
  delayed = false,
}: ImportProgressProps) {
  const hasOmissions = state === "done" && pagesWithoutText > 0;
  const { icon: Icon, spin, circleClassName } = visualFor(state, hasOmissions);
  const text = messageFor(state, pagesWithoutText, error);
  const isAlert = state === "failed";

  return (
    <div
      data-testid="import-progress"
      data-status={state}
      className="flex items-center gap-3 rounded-xl border border-border-default bg-card p-4 shadow-xs"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          circleClassName,
        )}
      >
        <Icon
          size={18}
          strokeWidth={1.75}
          className={
            spin ? "animate-spin motion-reduce:animate-none" : undefined
          }
        />
      </span>
      <div className="flex flex-col gap-0.5">
        <p
          role={isAlert ? "alert" : "status"}
          aria-live={isAlert ? undefined : "polite"}
          className="text-fg text-sm"
        >
          {text}
        </p>
        {delayed && ACTIVE_STATES.includes(state) && (
          <output aria-live="polite" className="text-fg-muted text-xs">
            {INGESTION_COPY.progress.delay}
          </output>
        )}
      </div>
    </div>
  );
}
