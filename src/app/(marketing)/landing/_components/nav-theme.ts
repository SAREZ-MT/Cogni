// Colour scheme of the fixed landing nav. Every section declares the ground
// it paints with `data-nav-theme="dark|light"`; the nav reads whichever one
// crosses a one-pixel probe line through its own middle, so the bar always
// contrasts with what is directly under it.

export type NavTheme = "dark" | "light";

export function readNavTheme(value: string | undefined): NavTheme | null {
  return value === "dark" || value === "light" ? value : null;
}

/**
 * The section that decides the theme. `order` is its document position: at
 * a boundary, where two sections touch the probe, the later one is the one
 * scrolling in under the bar. With none (between marked sections), keep
 * the previous theme instead of flickering.
 */
export function resolveNavTheme(
  intersecting: readonly { theme: NavTheme; order: number }[],
  previous: NavTheme,
): NavTheme {
  let best: { theme: NavTheme; order: number } | null = null;
  for (const entry of intersecting) {
    if (!best || entry.order > best.order) best = entry;
  }
  return best ? best.theme : previous;
}

/** IntersectionObserver rootMargin for a 1px line at `lineY` from the top. */
export function navProbeMargin(viewportHeight: number, lineY: number) {
  const below = Math.max(0, Math.round(viewportHeight - lineY - 1));
  return `-${lineY}px 0px ${below > 0 ? `-${below}px` : "0px"} 0px`;
}
