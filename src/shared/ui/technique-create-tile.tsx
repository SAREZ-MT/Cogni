import { Plus } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/ui/utils";

export interface TechniqueCreateTileProps
  extends Omit<ComponentProps<"button">, "children"> {
  // Visible label and accessible name ("Crear flashcards").
  label: string;
  // Short line under the label.
  hint?: string;
}

// The first, fixed item of a technique hub's notebooks grid (Phase 8 H11,
// user-approved flow 2026-10-29), in the create-tile language of the
// notebooks hub's "Nuevo cuaderno" and the notebook's "Nueva página":
// `primary-50` fill, a 2px dashed `primary-300` border, a `primary-600`
// plus disc and a violet label and hint. Shaped like the grid's
// `DeckSummaryCard` (18px radius, at least its 156px height, filling the
// row). It lifts 2px and deepens its tint on hover like the cards beside
// it, presses to 0.98 and never moves under reduced motion. A plain button
// (default `type="button"`), so `DialogTrigger asChild` can wrap it.
export function TechniqueCreateTile({
  label,
  hint,
  className,
  type = "button",
  ...props
}: TechniqueCreateTileProps) {
  return (
    <button
      type={type}
      aria-label={label}
      data-slot="technique-create-tile"
      className={cn(
        "group/new flex h-full min-h-[156px] w-full flex-col items-center justify-center gap-3 rounded-[18px] border-2 border-primary-300 border-dashed bg-primary-50 px-5 py-5 text-center outline-none transition-[translate,scale,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-primary-400 hover:bg-primary-100 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <span
        data-part="plus"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-[0_8px_18px_-8px_rgb(109_40_217/0.55)]"
      >
        <Plus aria-hidden="true" size={22} strokeWidth={2} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-semibold text-primary-700 text-sm">{label}</span>
        {hint !== undefined ? (
          <span className="text-balance text-[12px] text-primary-600/80 leading-snug">
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  );
}
