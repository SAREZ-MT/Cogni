import type * as React from "react";
import type { ReactNode } from "react";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/ui/utils";

export interface ChartCardProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  // Leading icon tile before eyebrow/title (dashboard v2 header row,
  // reference layout's "icon + title" card heads). Pairs with `divider`.
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  // Right-aligned slot next to the title (a legend, a mini filter, a delta
  // pill…).
  actions?: ReactNode;
  // Accessible name for the chart body (chart spec: "every chart inside a
  // figure with aria-label").
  ariaLabel: string;
  // Legend/footnote row below the chart body.
  footer?: ReactNode;
  // Hairline rule between the header row and the body (dashboard v2:
  // matches the reference's icon-header cards, e.g. the activity chart and
  // the accuracy ring).
  divider?: boolean;
  bodyClassName?: string;
}

// Chart-bearing card shell (dashboard chart spec, atom plan "ChartCard"):
// the same white/rounded-xl/shadow-card chrome every Cogni card already
// uses, with an in-card header (eyebrow/title/description, `SectionTitle`
// proportions) and a `<figure>` body so every chart gets a real
// accessible name instead of being a silent canvas.
export function ChartCard({
  icon,
  eyebrow,
  title,
  description,
  actions,
  ariaLabel,
  footer,
  divider,
  className,
  bodyClassName,
  children,
  ...props
}: ChartCardProps) {
  return (
    <Card
      padding="lg"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className={cn(icon && "flex items-center gap-2.5")}>
            {icon}
            <div>
              {eyebrow && (
                <p className="font-medium text-[11px] text-fg-muted uppercase tracking-wider">
                  {eyebrow}
                </p>
              )}
              <h3
                className={cn(
                  "font-semibold text-fg text-sm",
                  eyebrow && "mt-0.5",
                )}
              >
                {title}
              </h3>
              {description && (
                <p className="mt-1 text-fg-muted text-xs">{description}</p>
              )}
            </div>
          </div>
          {actions}
        </div>
        {divider && <div className="border-border-subtle border-b" />}
      </div>
      <figure
        aria-label={ariaLabel}
        className={cn("flex flex-1 flex-col gap-2", bodyClassName)}
      >
        {children}
      </figure>
      {footer}
    </Card>
  );
}
