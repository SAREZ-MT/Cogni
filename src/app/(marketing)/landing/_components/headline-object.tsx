"use client";

import { Cards } from "@phosphor-icons/react/dist/csr/Cards";
import { Notebook } from "@phosphor-icons/react/dist/csr/Notebook";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { bayerThreshold } from "./ascii-field";

export type HeadlineImage = { src: string; alt: string };

// The study object each section's placeholder stands for, kept as a name
// so the prop stays serialisable.
const GLYPHS = { notebook: Notebook, cards: Cards } as const;
export type HeadlineGlyph = keyof typeof GLYPHS;

// The tile's colour, from the platform technique palette, so the objects
// alternate down the page instead of all repeating violet. Each tone sets
// its three dither steps and a glyph ink that keeps contrast (.lp-hobj in
// landing.css).
export type HeadlineTone = "violet" | "yellow" | "mint" | "red";

// Logical pixels of the dithered placeholder; CSS scales it up pixelated.
const DITHER_PX = 36;

// The object that sits between two words of a section headline, as a
// small 3D study object (a Dovetail-style dithered render). It is about one
// cap height and a half tall, square, and dips slightly below the baseline
// (.lp-hobj in landing.css).
//
// TODO(higgsfield): generate each section's dithered or grainy 3D study
// object with Higgsfield (square, transparent background, about 480×480)
// and save it under public/landing/: how-it-works-object.webp (a notebook)
// and techniques-object.webp (a fanned stack of cards). Then pass
// image={{ src: "/landing/<name>.webp", alt: "" }} to the section. Until
// then a dithered tile in the section's tone with the matching glyph holds
// the exact size and position.
export function HeadlineObject({
  image,
  glyph = "notebook",
  tone = "violet",
}: {
  image?: HeadlineImage;
  glyph?: HeadlineGlyph;
  tone?: HeadlineTone;
}) {
  if (image) {
    return (
      <span className="lp-hobj lp-hobj-image">
        <Image
          src={image.src}
          alt={image.alt}
          width={480}
          height={480}
          sizes="(min-width: 768px) 120px, 56px"
          className="size-full object-contain"
        />
      </span>
    );
  }
  const Glyph = GLYPHS[glyph];
  return (
    <span
      aria-hidden="true"
      data-glyph={glyph}
      data-tone={tone}
      className="lp-hobj lp-hobj-placeholder"
    >
      <DitherTile />
      <Glyph weight="duotone" className="lp-hobj-glyph" />
    </span>
  );
}

// A soft-lit tile shaded from the top left, quantised to three violets
// through a 4×4 ordered dither. Drawn once; the canvas is tiny.
function DitherTile() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const style = getComputedStyle(canvas);
    const tones = ["--hobj-dark", "--hobj-mid", "--hobj-light"].map((name) =>
      style.getPropertyValue(name).trim(),
    );
    canvas.width = DITHER_PX;
    canvas.height = DITHER_PX;
    for (let y = 0; y < DITHER_PX; y++) {
      for (let x = 0; x < DITHER_PX; x++) {
        const u = x / (DITHER_PX - 1);
        const v = y / (DITHER_PX - 1);
        const dx = u - 0.3;
        const dy = v - 0.26;
        // Key light at the top left, falling off toward the far corner.
        const light = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 1.05);
        const level = light * 2 + (bayerThreshold(x, y) - 0.5);
        const tone = tones[Math.max(0, Math.min(2, Math.round(level)))];
        if (!tone) continue;
        ctx.fillStyle = tone;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, []);
  return <canvas ref={ref} className="lp-hobj-dither" />;
}
