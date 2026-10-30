import Image from "next/image";
import type * as React from "react";
import { cn } from "@/shared/ui/utils";

type BrandTone = "light" | "dark";

type BrandMarkProps = React.ComponentProps<"span"> & {
  // "light" sits on paper/warm-neutral surfaces (paper glass, ink wordmark);
  // "dark" sits on ink surfaces such as the auth brand panel (ink glass,
  // paper wordmark).
  tone?: BrandTone;
  // "sm" for the app sidebar (20px mark), "md" for auth screens (28px).
  size?: "sm" | "md";
  // false renders the mark alone (collapsed sidebar); the caller then owns
  // the accessible name.
  wordmark?: boolean;
};

// Mark heights in px. At 20px and below the glass blur turns to mush, so
// the dedicated favicon build (no blur, heavier c) takes over.
const MARK_PX = { sm: 20, md: 28 } as const;
const FAVICON_BUILD_MAX_PX = 20;
// The outlined wordmark shares the mark's vertical box in the approved
// lockup (public/brand/cogni-lockup.svg), so at the same height it keeps
// the lockup's proportions: width = 2.1462 × mark.
const WORDMARK_RATIO = 2.1462;

function markSrc(tone: BrandTone, px: number) {
  if (px <= FAVICON_BUILD_MAX_PX) return "/brand/cogni-favicon.svg";
  return tone === "dark"
    ? "/brand/cogni-mark-ink.svg"
    : "/brand/cogni-mark.svg";
}

// The Cogni mark ("7 v2 Glass", docs/design-system/assets/logo.md): a
// frosted violet squircle with a white lowercase "c" in Manrope ExtraBold.
// Same-origin static SVG with outlined paths, so it is CSP-safe and keeps
// colour out of the component. Always decorative.
export function BrandGlyph({
  tone = "light",
  px = MARK_PX.md,
  className,
}: {
  tone?: BrandTone;
  px?: number;
  className?: string;
}) {
  return (
    <Image
      data-slot="brand-glyph"
      src={markSrc(tone, px)}
      alt=""
      aria-hidden="true"
      width={px}
      height={px}
      unoptimized
      className={cn("shrink-0", className)}
    />
  );
}

// Cogni brand: the mark plus the outlined lowercase "cogni" wordmark
// (Manrope ExtraBold, -0.03em; the app does not load Manrope, so the
// wordmark ships as paths, with a visually hidden "Cogni" as its name). Single source of truth for the brand in the app
// (auth screens, sidebar Logo). Not a link; wrap it when it must navigate.
export function BrandMark({
  tone = "light",
  size = "md",
  wordmark = true,
  className,
  ...props
}: BrandMarkProps) {
  const px = MARK_PX[size];
  return (
    <span
      data-slot="brand-mark"
      data-tone={tone}
      className={cn(
        "inline-flex items-center",
        size === "sm" ? "gap-1.5" : "gap-2",
        className,
      )}
      {...props}
    >
      <BrandGlyph tone={tone} px={px} />
      {wordmark && (
        <>
          <Image
            data-slot="brand-wordmark"
            src={
              tone === "dark"
                ? "/brand/cogni-wordmark-ink.svg"
                : "/brand/cogni-wordmark.svg"
            }
            alt=""
            aria-hidden="true"
            width={Math.round(px * WORDMARK_RATIO)}
            height={px}
            unoptimized
            className="shrink-0"
          />
          {/* The outlined wordmark is a picture; this text is the brand's
              accessible name and text content. */}
          <span className="sr-only">Cogni</span>
        </>
      )}
    </span>
  );
}
