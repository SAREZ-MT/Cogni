import Link from "next/link";
import { BrandMark } from "@/shared/ui/brand-mark";

type LogoProps = {
  collapsed?: boolean;
};

// Sidebar logo: the shared BrandMark (single source of truth for the Cogni
// brand) wrapped in a home link. Collapsed drops the wordmark and moves the
// accessible name onto the link itself, so the icon-only sidebar column
// (sidebar.tsx) still announces "Cogni" to assistive tech.
export function Logo({ collapsed = false }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label={collapsed ? "Cogni" : undefined}
      className="flex items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <BrandMark size="sm" wordmark={!collapsed} />
    </Link>
  );
}
