"use client";

import { useProductTour } from "./product-tour";

// Home empty state's secondary action: replays the product tour (§2.1 item
// 6). A button, since it opens an overlay rather than navigating.
export function ReplayTourLink() {
  const { start } = useProductTour();
  return (
    <button
      type="button"
      onClick={start}
      className="rounded-sm text-fg-secondary text-sm underline underline-offset-4 outline-none transition-colors hover:text-fg focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Ver tutorial
    </button>
  );
}
