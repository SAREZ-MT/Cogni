import { Brain } from "lucide-react";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";

// Home two-column row, right card (Home study-metrics decisions): a
// permanent placeholder until Active recall/Exámenes ship — reuses figma-
// make-design-system.md Patterns "Empty state" verbatim (violet tile,
// bold title, muted copy, disabled small button).
export function WeakTopics() {
  return (
    <EmptyState
      variant="tinted"
      icon={
        <IconTile size="52" tone="primary">
          <Brain aria-hidden="true" size={24} strokeWidth={1.75} />
        </IconTile>
      }
      title="Temas débiles"
      titleClassName="text-[15px]"
      description="Cuando actives Active recall y Exámenes verás aquí lo que más te cuesta."
      descriptionClassName="max-w-xs text-[12.5px] leading-relaxed"
      action={
        <button
          type="button"
          disabled
          title="pronto"
          className="mt-1 rounded-input bg-neutral-150 px-3 py-1.5 font-medium text-[12.5px] text-fg-muted disabled:cursor-not-allowed"
        >
          pronto
        </button>
      }
    />
  );
}
