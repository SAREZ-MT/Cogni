import type { ReactNode } from "react";
import {
  StudyItemRow,
  type StudyItemRowProps,
} from "@/shared/ui/study-item-row";
import { cn } from "@/shared/ui/utils";

export interface SavedStudySectionProps {
  label: string;
  items: StudyItemRowProps[];
  // Shown under the label when there are no items; without it an empty
  // group renders nothing.
  empty?: ReactNode;
  className?: string;
}

// One labelled group of saved study items inside the "Técnicas" panel
// (design/shell-look, studyplatform StudyPanel.tsx "Mazos guardados" /
// "Sesiones de Active Recall" / "Exámenes recientes" groups): a divider, an
// uppercase muted sub-label, then one StudyItemRow per item. Renders
// nothing when the group is empty, so the panel only shows the groups that
// actually have content — same behavior as the reference.
export function SavedStudySection({
  label,
  items,
  empty,
  className,
}: SavedStudySectionProps) {
  if (items.length === 0 && !empty) return null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="h-px bg-border-subtle" />
      <p className="pl-0.5 font-medium text-[10px] text-fg-muted uppercase tracking-[0.06em]">
        {label}
      </p>
      {items.length === 0 ? (
        empty
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <StudyItemRow
              key={`${item.tone}-${item.href}-${item.label}`}
              {...item}
            />
          ))}
        </div>
      )}
    </div>
  );
}
