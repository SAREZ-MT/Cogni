import { Brain } from "lucide-react";

// Home two-column row, right card (Home study-metrics decisions): a
// permanent placeholder until Active recall/Exámenes ship — reuses figma-
// make-design-system.md Patterns "Empty state" verbatim (violet tile,
// bold title, muted copy, disabled small button).
export function WeakTopics() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[16px] border border-border-default bg-neutral-50 px-7 py-7 text-center">
      <span className="flex size-[52px] items-center justify-center rounded-tile bg-primary-100 text-primary-600">
        <Brain aria-hidden="true" size={24} strokeWidth={1.75} />
      </span>
      <p className="font-bold text-[15px] text-fg">Temas débiles</p>
      <p className="max-w-xs text-[12.5px] text-fg-muted leading-relaxed">
        Cuando actives Active recall y Exámenes verás aquí lo que más te cuesta.
      </p>
      <button
        type="button"
        disabled
        title="pronto"
        className="mt-1 rounded-input bg-neutral-150 px-3 py-1.5 font-medium text-[12.5px] text-fg-muted disabled:cursor-not-allowed"
      >
        pronto
      </button>
    </div>
  );
}
