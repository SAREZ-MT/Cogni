"use client";

import { Atom } from "@phosphor-icons/react/dist/csr/Atom";
import { Binoculars } from "@phosphor-icons/react/dist/csr/Binoculars";
import { Book } from "@phosphor-icons/react/dist/csr/Book";
import { BookmarkSimple } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { BookOpen } from "@phosphor-icons/react/dist/csr/BookOpen";
import { Books } from "@phosphor-icons/react/dist/csr/Books";
import { Brain } from "@phosphor-icons/react/dist/csr/Brain";
import { Calculator } from "@phosphor-icons/react/dist/csr/Calculator";
import { Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { Dna } from "@phosphor-icons/react/dist/csr/Dna";
import { Flask } from "@phosphor-icons/react/dist/csr/Flask";
import { GlobeHemisphereWest } from "@phosphor-icons/react/dist/csr/GlobeHemisphereWest";
import { GraduationCap } from "@phosphor-icons/react/dist/csr/GraduationCap";
import { Lightbulb } from "@phosphor-icons/react/dist/csr/Lightbulb";
import { MathOperations } from "@phosphor-icons/react/dist/csr/MathOperations";
import { Microscope } from "@phosphor-icons/react/dist/csr/Microscope";
import { MusicNotes } from "@phosphor-icons/react/dist/csr/MusicNotes";
import { Notebook } from "@phosphor-icons/react/dist/csr/Notebook";
import { Palette } from "@phosphor-icons/react/dist/csr/Palette";
import { PencilSimple } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { Planet } from "@phosphor-icons/react/dist/csr/Planet";
import { PuzzlePiece } from "@phosphor-icons/react/dist/csr/PuzzlePiece";
import { Ruler } from "@phosphor-icons/react/dist/csr/Ruler";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import type { MotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildNetwork,
  GLYPH_COUNT,
  iconAlpha,
  linkReach,
  type NetworkSize,
  nodeAlpha,
} from "./hero-network";
import { networkGrowth } from "./hero-timeline";

// The hero's background: a knowledge web that grows with the scroll.
// Canvas 2D draws the dots and hairlines (hundreds of 1px strokes, redrawn
// only when the scroll moves, so an idle page costs nothing); the study
// icons are crisp SVGs in the DOM on top, moved only by opacity and
// transform. No WebGL: no context to lose, nothing to restore.

const GLYPHS = [
  Book,
  Lightbulb,
  Atom,
  GraduationCap,
  Flask,
  Brain,
  GlobeHemisphereWest,
  Calculator,
  PencilSimple,
  Microscope,
  MusicNotes,
  Compass,
  Dna,
  Palette,
  BookOpen,
  Ruler,
  PuzzlePiece,
  Notebook,
  Trophy,
  Planet,
  BookmarkSimple,
  MathOperations,
  Binoculars,
  Books,
];
if (GLYPHS.length !== GLYPH_COUNT) {
  throw new Error("hero-network: GLYPHS must match GLYPH_COUNT");
}

const MAX_DPR = 1.5;
const LINE_RGB = "214, 222, 235";
const LINE_ALPHA = 0.2;
const DOT_ALPHA = 0.7;

export function HeroNetwork({
  progress,
  className,
}: {
  progress: MotionValue<number>;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // The server renders the desktop web; phones swap to the lighter one
  // after mount, which is a plain state change, not a hydration mismatch.
  const [size, setSize] = useState<NetworkSize>("desktop");
  const network = useMemo(() => buildNetwork(size), [size]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setSize(query.matches ? "mobile" : "desktop");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext("2d");
    } catch {
      context = null;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let width = 0;
    let height = 0;
    let frame = 0;
    let inView = true;
    let drawnGrowth = -1;
    const iconShown = new Float32Array(network.icons.length).fill(-1);

    const growthNow = () => (reduced ? 1 : networkGrowth(progress.get()));

    const paint = (g: number) => {
      // Icons: write only what changed since the last frame.
      network.icons.forEach((icon, k) => {
        const a = iconAlpha(icon, g);
        if (a === iconShown[k]) return;
        iconShown[k] = a;
        const element = iconRefs.current[k];
        if (!element) return;
        element.style.opacity = String(a);
        element.style.transform = `translate(-50%, -50%) scale(${0.55 + 0.45 * a})`;
      });

      if (!context || !width || !height) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const { nodes, links } = network;

      context.lineWidth = 0.7;
      context.strokeStyle = `rgb(${LINE_RGB})`;
      for (const link of links) {
        const reach = linkReach(link, g);
        if (reach <= 0) continue;
        const from = nodes[link.a];
        const to = nodes[link.b];
        const x1 = from.x * width;
        const y1 = from.y * height;
        context.globalAlpha =
          LINE_ALPHA * (0.45 + 0.55 * Math.min(from.z, to.z)) * reach ** 0.5;
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(
          x1 + (to.x * width - x1) * reach,
          y1 + (to.y * height - y1) * reach,
        );
        context.stroke();
      }

      // Dots: a dot gives way to its icon as the icon arrives.
      const iconAt = new Map(network.icons.map((icon) => [icon.node, icon]));
      context.fillStyle = `rgb(${LINE_RGB})`;
      nodes.forEach((node, index) => {
        const icon = iconAt.get(index);
        const alpha =
          nodeAlpha(node, g) * (1 - (icon ? iconAlpha(icon, g) : 0));
        if (alpha <= 0) return;
        context.globalAlpha = DOT_ALPHA * alpha * (0.35 + 0.65 * node.z);
        context.beginPath();
        context.arc(
          node.x * width,
          node.y * height,
          0.8 + node.z * 0.9,
          0,
          Math.PI * 2,
        );
        context.fill();
      });
      context.globalAlpha = 1;
    };

    const draw = () => {
      frame = 0;
      const g = growthNow();
      if (g === drawnGrowth) return;
      drawnGrowth = g;
      paint(g);
    };
    // One frame per scroll burst, and only while the scene can be seen.
    const schedule = () => {
      if (frame || !inView || document.hidden) return;
      frame = requestAnimationFrame(draw);
    };

    const resize = () => {
      width = host.clientWidth;
      height = host.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      drawnGrowth = -1;
      paint(growthNow());
      drawnGrowth = growthNow();
    };
    resize();
    const resizer = new ResizeObserver(resize);
    resizer.observe(host);

    const watcher = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
      schedule();
    });
    watcher.observe(host);
    document.addEventListener("visibilitychange", schedule);
    const unsubscribe = reduced ? () => {} : progress.on("change", schedule);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      resizer.disconnect();
      watcher.disconnect();
      document.removeEventListener("visibilitychange", schedule);
      // Release the backing store right away instead of waiting for GC.
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [network, progress]);

  return (
    <div ref={hostRef} aria-hidden="true" className={className}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      {network.icons.map((icon, k) => {
        const node = network.nodes[icon.node];
        const Glyph = GLYPHS[icon.glyph];
        const depth = node.z < 0.3 ? "far" : node.z > 0.75 ? "near" : "mid";
        return (
          <span
            key={`${icon.node}-${size}`}
            ref={(element) => {
              iconRefs.current[k] = element;
            }}
            data-net-icon=""
            className={`lp-net-icon lp-net-hue-${icon.hue}`}
            style={{
              left: `${node.x * 100}%`,
              top: `${node.y * 100}%`,
              opacity: 0,
              transform: "translate(-50%, -50%) scale(0.55)",
            }}
          >
            <Glyph
              weight="fill"
              size={icon.size}
              className={`lp-net-glyph lp-net-${depth}`}
            />
          </span>
        );
      })}
    </div>
  );
}
