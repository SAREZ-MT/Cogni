import { Plus } from "lucide-react";
import type { ComponentProps } from "react";
import type { TechniqueTheme } from "@/shared/ui/technique-theme";
import { cn } from "@/shared/ui/utils";

export interface TechniqueCreateTileProps
  extends Omit<ComponentProps<"button">, "children"> {
  // The hub's technique: the tile carries its theme (Phase 8 H17).
  technique: TechniqueTheme;
  // Visible label and accessible name ("Crear flashcards").
  label: string;
  // Short line under the label.
  hint?: string;
}

// The first, fixed item of a technique hub's grid (Phase 8 H11, user-
// approved flow 2026-10-29), in the create-tile language of the notebooks
// hub's "Nuevo cuaderno" and the notebook's "Nueva página". Since H17
// (user-approved flat hubs, 2026-10-29) it is themed by its technique
// (`data-technique-theme`): the technique tint, a 2px dashed
// `--theme-dash` border, the technique CTA's plus disc and the technique
// ink. Shaped like the grid's `TechniqueItemCard` (18px radius, at least
// its 212px height, filling the row; a row under 520px). It lifts 2px on
// hover like the cards beside it, presses to 0.98 and never moves under
// reduced motion. A plain button (default `type="button"`), so
// `DialogTrigger asChild` can wrap it.
export function TechniqueCreateTile({
  technique,
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
      data-technique-theme={technique}
      className={cn(
        "group/new flex h-full min-h-[212px] w-full flex-col items-center justify-center gap-3 rounded-[18px] border-(--theme-dash) border-2 border-dashed bg-(--theme-tint) px-5 py-5 text-center outline-none transition-[translate,scale,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-(--theme-soft-edge) focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none",
        "max-[520px]:min-h-0 max-[520px]:flex-row max-[520px]:justify-start max-[520px]:gap-3.5 max-[520px]:px-4 max-[520px]:py-3.5 max-[520px]:text-left",
        className,
      )}
      {...props}
    >
      <span
        data-part="plus"
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-(--theme-cta-edge) bg-(--theme-cta) text-(--theme-cta-fg) shadow-[0_8px_18px_-8px_var(--theme-cta-edge)]"
      >
        <Plus aria-hidden="true" size={22} strokeWidth={2} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-semibold text-(--theme-ink-deep) text-sm">
          {label}
        </span>
        {hint !== undefined ? (
          <span className="text-balance text-(--theme-ink) text-[12px] leading-snug opacity-85">
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  );
}
