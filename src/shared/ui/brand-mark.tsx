import type * as React from "react";
import { cn } from "@/shared/ui/utils";

type BrandMarkProps = React.ComponentProps<"span"> & {
  // "light" sits on warm-neutral surfaces (near-black tile, dark wordmark);
  // "dark" sits on the near-black brand panel (glass tile, white wordmark).
  tone?: "light" | "dark";
  // Wordmark size: "sm" for the app sidebar (14px), "md" for auth screens.
  size?: "sm" | "md";
  // false renders the tile alone (collapsed sidebar); the caller then owns
  // the accessible name.
  wordmark?: boolean;
};

// The Cogni glyph (docs/design-system/assets/logo.svg): a "C" arc whose two
// ends are knowledge nodes, with a violet node at its centre — the memory
// the arc keeps reinforcing. Geometric so it survives 16px.
export function BrandGlyph({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      data-slot="brand-glyph"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      <path
        d="M16.95 7.05A7 7 0 1 0 16.95 16.95"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="16.95" cy="7.05" r="2.2" fill="white" />
      <circle cx="16.95" cy="16.95" r="2.2" fill="white" />
      <circle cx="12" cy="12" r="2.3" fill="var(--color-primary-400)" />
    </svg>
  );
}

// Cogni brand: rounded tile with the glyph plus the "Cogni" wordmark. Single
// source of truth for the brand (auth screens, app sidebar Logo). Not a
// link; wrap it when it must navigate.
export function BrandMark({
  tone = "light",
  size = "md",
  wordmark = true,
  className,
  ...props
}: BrandMarkProps) {
  const dark = tone === "dark";
  return (
    <span
      data-slot="brand-mark"
      data-tone={tone}
      className={cn("inline-flex items-center gap-3", className)}
      {...props}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
          dark ? "border border-white/15 bg-white/10" : "bg-neutral-900",
        )}
      >
        <BrandGlyph className="size-[22px]" />
      </span>
      {wordmark && (
        <span
          className={cn(
            "font-bold tracking-tight",
            size === "sm" ? "text-[14px]" : "text-base",
            dark ? "text-neutral-0" : "text-fg",
          )}
        >
          Cogni
        </span>
      )}
    </span>
  );
}
