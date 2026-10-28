"use client";

import { Notebook } from "@phosphor-icons/react/dist/csr/Notebook";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { bayerThreshold } from "./ascii-field";

export type HeadlineImage = { src: string; alt: string };

// Logical pixels of the dithered placeholder; CSS scales it up pixelated.
const DITHER_PX = 36;

// The object that sits between two words of a section headline, as a
// small 3D study object (a Dovetail-style dithered render). It is about one
// cap height and a half tall, square, and dips slightly below the baseline
// (.lp-hobj in landing.css).
//
// TODO(higgsfield): generate the dithered or grainy 3D study object with
// Higgsfield and save it as public/landing/how-it-works-object.webp
// (square, transparent background, about 480×480), then pass
// image={{ src: "/landing/how-it-works-object.webp", alt: "" }} to the
// section. Until then a dithered violet tile with a notebook glyph holds
// the exact size and position.
export function HeadlineObject({ image }: { image?: HeadlineImage }) {
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
  return (
    <span aria-hidden="true" className="lp-hobj lp-hobj-placeholder">
      <DitherTile />
      <Notebook weight="duotone" className="lp-hobj-glyph" />
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
