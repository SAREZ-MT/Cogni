import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/shared/ui/utils";

// Design-system surface card (figma-make-design-system.md CardsSection):
// the white 16px-radius bordered box every notebook/stat/list card in the
// app shell is built from. `padding` follows the spec's sm(16)/md(20)/
// lg(24) scale; a card that needs a non-standard padding (e.g. StatCard's
// 18px) keeps `padding="none"` and overrides via `className`, which
// `cn()`/tailwind-merge resolves onto the base classes without conflict.
const cardVariants = cva("rounded-xl border", {
  variants: {
    tone: {
      default: "border-border-subtle bg-card shadow-xs",
      subtle: "border-border-subtle bg-neutral-50 shadow-xs",
      success: "border-success-500/20 bg-success-50",
      error: "border-error-500/20 bg-error-50",
      achievement:
        "border-primary-300/40 bg-gradient-to-br from-primary-50 to-primary-100",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
    },
    interactive: {
      true: "transition-all hover:-translate-y-0.5 hover:shadow-card-hover",
    },
  },
  defaultVariants: {
    tone: "default",
    padding: "none",
  },
});

export interface CardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {
  // Renders the styling onto the single child element instead of a `div`
  // (radix-ui Slot, same pattern as Button's `asChild`) — needed for a
  // card that is itself a semantic `<article>` or a Next.js `<Link>`.
  asChild?: boolean;
}

function Card({
  className,
  tone,
  padding,
  interactive,
  asChild = false,
  ...props
}: CardProps) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="card"
      className={cn(cardVariants({ tone, padding, interactive }), className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("font-semibold text-fg text-sm leading-none", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-fg-muted text-xs", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
};
