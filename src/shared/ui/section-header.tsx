import type * as React from "react";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export interface SectionHeaderProps {
  // Small uppercase overline above the title (BadgesSection-adjacent
  // "Overline"), e.g. "Biblioteca"/"Cuaderno".
  eyebrow?: ReactNode;
  title: ReactNode;
  // A list renders as one line of phrases joined by small violet dots
  // (Phase 8 H4-T4: "Tus materias, organizadas · 2 cuadernos").
  description?: ReactNode | string[];
  // Right-aligned slot (a primary CTA, a "Nueva página" form, etc.).
  actions?: ReactNode;
  // Leading icon tile rendered before the eyebrow/title/description block
  // (notebookId/page.tsx's colored notebook icon). Only wraps the text
  // block in its own flex row when present, so screens without one keep
  // the exact same DOM the "no icon" screens already render.
  icon?: ReactNode;
  // Overrides the icon + text row (e.g. `gap-4` for a larger badge).
  leadingClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  className?: string;
}

// Design-system page head (figma-make-design-system.md CardsSection
// "Section header pattern"): eyebrow + bold title + muted description on
// the left, an actions slot on the right. Real screens disagree on the
// exact title size (24px on /notebooks, 20px on the notebook detail route,
// 28px on Home) and on whether the eyebrow's `mt-1` spacing applies, so
// both are overridable per call site via `titleClassName`/
// `descriptionClassName` instead of being baked into a fixed scale.
export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
  leadingClassName,
  titleClassName,
  descriptionClassName,
  className,
}: SectionHeaderProps) {
  const textBlock = (
    <div>
      {eyebrow && (
        <p className="font-medium text-[11px] text-fg-muted uppercase tracking-wider">
          {eyebrow}
        </p>
      )}
      <h1
        className={cn(
          "font-bold text-2xl text-fg",
          eyebrow && "mt-1",
          titleClassName,
        )}
      >
        {title}
      </h1>
      {Array.isArray(description) ? (
        <p
          className={cn(
            "mt-1 flex flex-wrap items-center gap-x-2 text-fg-muted text-sm",
            descriptionClassName,
          )}
        >
          {description.map((part, index) => (
            <Fragment key={part}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  data-part="separator"
                  className="size-1.5 shrink-0 rounded-full bg-primary-300"
                />
              )}
              <span>{part}</span>
            </Fragment>
          ))}
        </p>
      ) : (
        description && (
          <p className={cn("mt-1 text-fg-muted text-sm", descriptionClassName)}>
            {description}
          </p>
        )
      )}
    </div>
  );

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      {icon ? (
        <div className={cn("flex items-center gap-3", leadingClassName)}>
          {icon}
          {textBlock}
        </div>
      ) : (
        textBlock
      )}
      {actions}
    </div>
  );
}

export interface SectionTitleProps extends React.ComponentProps<"h2"> {
  // A right-aligned link/action switches the title to 16px/600 with a
  // `justify-between` row (Home's "Mis cuadernos" heading); without one it
  // stays the plain 14px/600 heading ReadyToReview/RecentPages use.
  action?: ReactNode;
}

// In-page section title (figma-make-design-system.md "Section header
// pattern", the smaller in-card variant — not the page-level SectionHeader
// above).
export function SectionTitle({
  action,
  className,
  children,
  ...props
}: SectionTitleProps) {
  if (!action) {
    return (
      <h2
        className={cn("mb-3.5 font-semibold text-fg text-sm", className)}
        {...props}
      >
        {children}
      </h2>
    );
  }

  return (
    <div className="mb-3.5 flex items-center justify-between">
      <h2
        className={cn("font-semibold text-fg text-base", className)}
        {...props}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}
