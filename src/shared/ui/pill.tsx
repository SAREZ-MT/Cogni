import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

// Design-system pill (figma-make-design-system.md BadgesSection "Status
// pill" / NavigationSection "pronto" badge): a small rounded-full label
// used for status/count/technique/"pronto" indicators. `size` follows the
// spec's sm(10.5px)/md(11.5px) scale; call sites that ship at a slightly
// different literal size (the two "pronto" pills render at 10px) override
// it with `className`.
const pillVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-pill font-semibold",
  {
    variants: {
      size: {
        sm: "px-2 py-0.5 text-[10.5px]",
        md: "px-2.5 py-0.5 text-[11.5px]",
      },
      tone: {
        neutral: "bg-neutral-150 text-fg-muted",
        muted: "bg-transparent text-fg-muted",
        purple: "bg-pastel-purple text-pastel-purple-fg",
        pink: "bg-pastel-pink text-pastel-pink-fg",
        green: "bg-pastel-green text-pastel-green-fg",
        yellow: "bg-pastel-yellow text-pastel-yellow-fg",
        orange: "bg-pastel-orange text-pastel-orange-fg",
        blue: "bg-pastel-blue text-pastel-blue-fg",
        mint: "bg-pastel-mint text-pastel-mint-fg",
        primary: "bg-primary-100 text-primary-600",
        success: "bg-success-100 text-success-700",
        warning: "bg-warning-100 text-warning-700",
        error: "bg-error-100 text-error-700",
        info: "bg-info-100 text-info-700",
        // Exams "preguntas" management screen (2026-09-24): the exam
        // accent for a "Variante" origin pill. No `--color-rose-100` token
        // exists yet, so this uses the existing `rose-500` theme color with
        // an opacity modifier — the same pattern status-banner.tsx already
        // uses for its `rose` tone border.
        rose: "bg-rose-500/10 text-rose-600",
      },
    },
    defaultVariants: {
      size: "sm",
      tone: "neutral",
    },
  },
);

export interface PillProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof pillVariants> {
  // Leading colored dot (BadgesSection "Status pill"), colored via
  // `currentColor` so it always matches the pill's own tone text color.
  dot?: boolean;
  icon?: ReactNode;
}

function Pill({
  className,
  size,
  tone,
  dot,
  icon,
  children,
  ...props
}: PillProps) {
  return (
    <span
      data-slot="pill"
      className={cn(pillVariants({ size, tone }), className)}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {icon}
      {children}
    </span>
  );
}

export { Pill, pillVariants };
