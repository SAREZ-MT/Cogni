"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { CanvasState } from "./constellation-canvas";
import { ProductFragments } from "./product-fragments";

// Three.js stays out of the main bundle and off the server: the chunk is
// requested only after hydration, never blocks the form, and the static
// brand-glow gradient underneath is the fallback while it loads, without
// WebGL, on reduced motion and below md (where this panel is hidden).
const ConstellationCanvas = dynamic(() => import("./constellation-canvas"), {
  ssr: false,
});

const WIDE_QUERY = "(min-width: 768px)";

function subscribeWide(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsWide() {
  return useSyncExternalStore(
    subscribeWide,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

export function AuthShowcase() {
  const reduce = useReducedMotion();
  const wide = useIsWide();
  const [canvasState, setCanvasState] = useState<CanvasState>("loading");
  const enabled = wide && !reduce;
  // A disabled panel unmounts the canvas; a later re-enable starts over.
  useEffect(() => {
    if (!enabled) setCanvasState("loading");
  }, [enabled]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        data-testid="public-showcase"
        // Deterministic hook for tests: "disabled" (small screen or reduced
        // motion: static gradient by design) or the canvas lifecycle state.
        data-canvas-state={enabled ? canvasState : "disabled"}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="brand-glow absolute inset-0" />
        {/* Faint nebula: layered violet haze behind the field for depth. */}
        <div className="absolute inset-0 bg-[radial-gradient(45%_35%_at_62%_40%,rgb(124_58_237/0.22),transparent_70%),radial-gradient(35%_30%_at_30%_62%,rgb(167_139_250/0.12),transparent_70%),radial-gradient(30%_25%_at_80%_75%,rgb(190_24_93/0.08),transparent_70%)]" />
        {/* The canvas fades itself in once a frame rendered and out on a
            context loss; "unavailable" unmounts it so the static gradient
            stays for the rest of this mount. */}
        {enabled && canvasState !== "unavailable" && (
          <ConstellationCanvas
            onStateChange={setCanvasState}
            className="absolute inset-0"
          />
        )}
        {/* Soft vignette keeps the copy at the edges legible over the field. */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_45%,transparent_40%,rgb(12_10_9/0.7)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-neutral-900 via-neutral-900/75 to-transparent" />
        <div className="absolute inset-x-0 top-[44%] flex -translate-y-1/2 justify-center">
          <ProductFragments className="scale-[0.82] lg:scale-100" />
        </div>
      </div>
    </MotionConfig>
  );
}
