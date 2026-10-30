"use client";

import { useEffect, useRef } from "react";
import { type AsciiVariant, asciiGlyph } from "./ascii-field";

const CELL_PX = 14;
const GLYPH_PX = 10;

// A static character texture (ascii-field.ts) drawn once into a Canvas 2D
// when it first comes near the viewport, and redrawn only when its size
// changes or the mono face finishes loading. No animation loop, so it costs
// nothing while scrolling and is identical under reduced motion.
//
// Colours are tokens read from the canvas' computed style:
// --ascii-ink (glyphs on night) and --ascii-ink-paper (glyphs on paper),
// each with its peak alpha in --ascii-alpha / --ascii-alpha-paper.
// Decorative: every caller places it inside an aria-hidden or role=img
// container, and a canvas without content exposes nothing.
export function AsciiTexture({
  variant,
  flip = false,
  seed = 1,
  className = "",
}: {
  variant: AsciiVariant;
  /** Dissolve upwards instead of downwards (paper above, night below). */
  flip?: boolean;
  seed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let size = "";
    let visible = false;

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const key = `${width}x${height}`;
      if (!visible || width === 0 || height === 0 || key === size) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      size = key;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const style = getComputedStyle(canvas);
      const ink = style.getPropertyValue("--ascii-ink").trim();
      const inkPaper = style.getPropertyValue("--ascii-ink-paper").trim();
      const alpha = Number(style.getPropertyValue("--ascii-alpha")) || 0.2;
      const alphaPaper =
        Number(style.getPropertyValue("--ascii-alpha-paper")) || 0.1;
      ctx.font = `${GLYPH_PX}px ${style.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const cols = Math.ceil(width / CELL_PX);
      const rows = Math.ceil(height / CELL_PX);
      for (let row = 0; row < rows; row++) {
        const v = (row + 0.5) / rows;
        // Depth into the night: 0 on paper, 1 deep in the night.
        const night = variant === "field" ? 1 : 1 - (flip ? 1 - v : v);
        const onNight = night > 0.45;
        ctx.fillStyle = onNight ? ink : inkPaper;
        ctx.globalAlpha = onNight
          ? alpha * Math.min(1, (night - 0.45) / 0.35)
          : alphaPaper * Math.min(1, (0.45 - night) / 0.25 + 0.4);
        for (let col = 0; col < cols; col++) {
          const glyph = asciiGlyph(
            variant,
            col,
            row,
            (col + 0.5) / cols,
            variant === "field" ? v : 1 - night,
            seed,
          );
          if (glyph)
            ctx.fillText(
              glyph,
              col * CELL_PX + CELL_PX / 2,
              row * CELL_PX + CELL_PX / 2,
            );
        }
      }
      ctx.globalAlpha = 1;
    };

    const redraw = () => {
      size = "";
      draw();
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        draw();
      },
      { rootMargin: "300px 0px" },
    );
    const ro = new ResizeObserver(() => draw());
    io.observe(canvas);
    ro.observe(canvas);
    document.fonts?.ready.then(redraw);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, [variant, flip, seed]);

  return (
    <canvas ref={ref} className={`lp-ascii pointer-events-none ${className}`} />
  );
}
