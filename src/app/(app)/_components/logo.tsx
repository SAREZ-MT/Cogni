import Link from "next/link";
import { cn } from "@/shared/ui/utils";

type LogoProps = {
  collapsed?: boolean;
};

// Cogni logo (docs/design-system/preview/brand-logo.html,
// docs/design-system/assets/logo-placeholder.svg, Engram obs 140): a 36 px
// black rounded-square mark with the three-circle glyph, plus the "Cogni"
// wordmark (14 px / 700) next to it. Collapsed drops the wordmark and moves
// the accessible name onto the link itself, so the icon-only sidebar column
// (sidebar.tsx) still announces "Cogni" to assistive tech.
export function Logo({ collapsed = false }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label={collapsed ? "Cogni" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-neutral-900">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="size-4"
        >
          <circle cx="8" cy="12" r="3" fill="white" />
          <circle cx="12" cy="8" r="2.5" fill="white" />
          <circle cx="16" cy="12" r="3" fill="white" />
        </svg>
      </span>
      {!collapsed && (
        <span className="font-bold text-[14px] text-fg">Cogni</span>
      )}
    </Link>
  );
}
