import { cva, type VariantProps } from "class-variance-authority";
import type { ElementType, ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

// Design-system empty state (figma-make-design-system.md Patterns "Empty
// state"/"Success state"): a centered icon tile + title + copy + optional
// action, in one of four framings actually shipped:
//   - "plain": no border/background — the full-page "no notebooks yet" body.
//   - "dashed": a dashed neutral border — "create your first X" prompts.
//   - "tinted": a solid neutral-50 tile — the permanent Temas débiles panel.
//   - "success": the green "¡Todo al día!" panel.
const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center",
  {
    variants: {
      variant: {
        plain: "gap-3",
        dashed:
          "gap-2 rounded-[20px] border border-neutral-300 border-dashed px-14 py-14",
        tinted:
          "gap-2 rounded-[16px] border border-border-default bg-neutral-50 px-7 py-7",
        success:
          "gap-2 rounded-lg border border-success-500/20 bg-success-50 px-5 py-6",
      },
    },
    defaultVariants: {
      variant: "dashed",
    },
  },
);

export interface EmptyStateProps
  extends VariantProps<typeof emptyStateVariants> {
  // Pre-built IconTile (or any node) — this atom only lays it out, it does
  // not own its size/tone, since those differ per screen.
  icon: ReactNode;
  title: ReactNode;
  titleAs?: ElementType;
  titleClassName?: string;
  description?: ReactNode;
  descriptionClassName?: string;
  action?: ReactNode;
  // Adds `flex-1` (fills the remaining height of a flex parent) — every
  // real usage except the permanent Temas débiles panel needs this.
  fill?: boolean;
  as?: ElementType;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  titleAs: TitleTag = "h2",
  titleClassName,
  description,
  descriptionClassName,
  action,
  variant,
  fill,
  as: Tag = "div",
  className,
}: EmptyStateProps) {
  return (
    <Tag
      className={cn(
        emptyStateVariants({ variant }),
        fill && "flex-1",
        className,
      )}
    >
      {icon}
      <TitleTag className={cn("font-semibold text-fg", titleClassName)}>
        {title}
      </TitleTag>
      {description && (
        <p className={cn("text-fg-muted text-sm", descriptionClassName)}>
          {description}
        </p>
      )}
      {action}
    </Tag>
  );
}
