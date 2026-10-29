import { Plus } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/ui/utils";

export interface PageStripCreateRowProps
  extends Omit<ComponentProps<"button">, "children"> {
  // Visible label and accessible name ("Nueva página").
  label: string;
  // Short line beside the label, hidden on narrow rows.
  hint?: string;
}

// The first row of the notebook page's list view (Phase 8 H5-T2, user
// request 2026-10-29): a "new page" strip in the create tiles' violet
// language — `primary-50` fill, a 2px dashed `primary-300` border, a
// `primary-600` plus disc, a violet label and hint. Same height and radius
// as a page strip; on hover it lifts 1px and deepens its tint, never moving
// under reduced motion. A plain button: the caller wraps it in the create
// form (`type="submit"`).
export function PageStripCreateRow({
  label,
  hint,
  className,
  type = "button",
  ...props
}: PageStripCreateRowProps) {
  return (
    <button
      type={type}
      aria-label={label}
      data-slot="page-strip-create-row"
      className={cn(
        "@container/strip flex h-14 w-full items-center gap-3 rounded-[10px] border-2 border-primary-300 border-dashed bg-primary-50 px-3.5 text-left outline-none transition-[translate,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-px hover:border-primary-400 hover:bg-primary-100 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <span
        data-part="plus"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-[0_6px_14px_-6px_rgb(109_40_217/0.55)]"
      >
        <Plus aria-hidden="true" size={16} strokeWidth={2} />
      </span>
      <span className="font-semibold text-primary-700 text-sm">{label}</span>
      {hint !== undefined ? (
        <span className="hidden min-w-0 truncate text-[12.5px] text-primary-600/80 @[360px]/strip:inline">
          {hint}
        </span>
      ) : null}
    </button>
  );
}
