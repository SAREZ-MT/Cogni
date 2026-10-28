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
  HUE_COUNT,
  iconAlpha,
  linkAlpha,
  linkReach,
  type NetworkSize,
  nodeAlpha,
  nodeDrift,
  starLight,
} from "./hero-network";
import { networkGrowth } from "./hero-timeline";

// The hero's background: a living knowledge web. Scroll progress decides
// how much of it exists (dots, then lines, then icons); an ambient loop
// keeps it alive on top of that, like the login constellation: nodes
// wander, lines stretch with them, signals in the icon hues travel along
// edges and make the node they reach pulse, and unlinked stars twinkle.
// A mouse carries a soft light that brightens the web under it.
//
// Canvas 2D, not WebGL: the study icons are DOM SVGs that must sit exactly
// on their nodes every frame, which is trivial in the same 2D pixel space
// and needs no 3D projection; additive light ("lighter") plus pre-rendered
// glow sprites give the login's glow; and there is no GPU context to lose,
// restore or count against the browser's limit. Lines and dots are batched
// into a few paths per frame. The loop runs only while the scene is in view
// and the tab is visible; reduced motion paints one static frame.

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
const LINE_RGB = "222, 216, 246";
const LINE_ALPHA = 0.22;
const DOT_ALPHA = 0.75;
const ALPHA_BUCKETS = 8;
const SIGNAL_EVERY_MS = 360;
const SIGNAL_MS = 1700;
const MAX_SIGNALS = 16;
const MAX_HOPS = 2;
const PULSE_MS = 1600;
// Cursor light: radius in CSS px, position lerp and fade per frame.
const LIGHT_RADIUS = 170;
const LIGHT_FOLLOW = 0.2;
const LIGHT_FADE = 0.08;
const WHITE: Rgb = [255, 255, 255];
const SPRITE_PX = 64;

type Rgb = [number, number, number];
type Signal = {
  link: number;
  forward: boolean;
  start: number;
  hue: number;
  hops: number;
};

function parseHex(value: string): Rgb {
  const hex = value.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [255, 255, 255];
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

// Soft round glow (bright core, gaussian-like halo), drawn once per hue.
function glowSprite([r, g, b]: Rgb) {
  const sprite = document.createElement("canvas");
  sprite.width = SPRITE_PX;
  sprite.height = SPRITE_PX;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  const half = SPRITE_PX / 2;
  const gradient = context.createRadialGradient(
    half,
    half,
    0,
    half,
    half,
    half,
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.12, `rgba(${r}, ${g}, ${b}, 0.95)`);
  gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.28)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
  return sprite;
}

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
    const { nodes, links, icons } = network;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const styles = getComputedStyle(host);
    const hues = Array.from({ length: HUE_COUNT }, (_, i) =>
      parseHex(styles.getPropertyValue(`--lp-net-${i}`)),
    );
    const sprites = context ? hues.map(glowSprite) : [];
    const starSprites = context ? [...hues, WHITE].map(glowSprite) : [];
    // The lit copy of the web under the cursor is drawn here, masked by a
    // radial falloff, then added onto the main canvas.
    const lit = document.createElement("canvas");
    const litSize = Math.ceil(LIGHT_RADIUS * 2 * ratio);
    lit.width = litSize;
    lit.height = litSize;
    let litContext: CanvasRenderingContext2D | null = null;
    try {
      litContext = context ? lit.getContext("2d") : null;
    } catch {
      litContext = null;
    }
    const finePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    const iconAt = new Map(icons.map((icon, k) => [icon.node, k]));
    const nodeHue = nodes.map((_, i) => {
      const k = iconAt.get(i);
      return k === undefined ? i % HUE_COUNT : icons[k].hue;
    });
    const adjacency: number[][] = nodes.map(() => []);
    links.forEach((link, index) => {
      adjacency[link.a].push(index);
      adjacency[link.b].push(index);
    });

    const px = new Float32Array(nodes.length);
    const py = new Float32Array(nodes.length);
    const shownAlpha = new Float32Array(icons.length).fill(-1);
    const signals: Signal[] = [];
    const pulses = new Map<number, { start: number; hue: number }>();
    const light = { x: 0, y: 0, tx: 0, ty: 0, on: false, level: 0 };
    const iconLit = new Float32Array(icons.length);
    let width = 0;
    let height = 0;
    let frame = 0;
    let inView = true;
    let elapsed = 0;
    let previous = 0;
    let lastSpawn = 0;

    const pulseLevel = (node: number) => {
      const pulse = pulses.get(node);
      if (!pulse) return 0;
      const t = (elapsed - pulse.start) / PULSE_MS;
      if (t >= 1) {
        pulses.delete(node);
        return 0;
      }
      return Math.sin(Math.PI * Math.min(t * 2.4, 1)) * (1 - t);
    };

    const advanceSignals = (g: number) => {
      if (
        elapsed - lastSpawn > SIGNAL_EVERY_MS &&
        signals.length < MAX_SIGNALS
      ) {
        lastSpawn = elapsed;
        const ready = links.length
          ? Math.floor(Math.random() * links.length)
          : -1;
        if (ready >= 0 && linkReach(links[ready], g) >= 1) {
          const forward = Math.random() < 0.5;
          const from = forward ? links[ready].a : links[ready].b;
          signals.push({
            link: ready,
            forward,
            start: elapsed,
            hue: nodeHue[from],
            hops: 0,
          });
        }
      }
      for (let s = signals.length - 1; s >= 0; s--) {
        const signal = signals[s];
        if (elapsed - signal.start < SIGNAL_MS) continue;
        signals.splice(s, 1);
        const link = links[signal.link];
        const target = signal.forward ? link.b : link.a;
        pulses.set(target, { start: elapsed, hue: signal.hue });
        if (signal.hops >= MAX_HOPS || Math.random() > 0.6) continue;
        const next = adjacency[target].filter(
          (l) => l !== signal.link && linkReach(links[l], g) >= 1,
        );
        if (!next.length) continue;
        const hop = next[Math.floor(Math.random() * next.length)];
        signals.push({
          link: hop,
          forward: links[hop].a === target,
          start: elapsed,
          hue: signal.hue,
          hops: signal.hops + 1,
        });
      }
    };

    const paint = () => {
      const g = reduced ? 1 : networkGrowth(progress.get());
      if (light.level < 0.01 && light.on) {
        light.x = light.tx;
        light.y = light.ty;
      }
      light.x += (light.tx - light.x) * LIGHT_FOLLOW;
      light.y += (light.ty - light.y) * LIGHT_FOLLOW;
      light.level += ((light.on ? 1 : 0) - light.level) * LIGHT_FADE;
      if (light.level < 0.002) light.level = 0;
      nodes.forEach((node, i) => {
        const { dx, dy } = reduced
          ? { dx: 0, dy: 0 }
          : nodeDrift(node, elapsed);
        px[i] = node.x * width + dx;
        py[i] = node.y * height + dy;
      });
      if (!reduced) advanceSignals(g);

      // Icons ride their node (drift, signal pulse) and glow under the light.
      icons.forEach((icon, k) => {
        const element = iconRefs.current[k];
        if (!element) return;
        const a = iconAlpha(icon, g);
        if (a !== shownAlpha[k]) {
          shownAlpha[k] = a;
          element.style.opacity = String(a);
        }
        const node = nodes[icon.node];
        const ox = (px[icon.node] - node.x * width).toFixed(2);
        const oy = (py[icon.node] - node.y * height).toFixed(2);
        const scale = (0.55 + 0.45 * a) * (1 + 0.28 * pulseLevel(icon.node));
        element.style.transform = `translate(-50%, -50%) translate(${ox}px, ${oy}px) scale(${scale.toFixed(3)})`;
        const reachLight = light.level
          ? Math.max(
              0,
              1 -
                Math.hypot(px[icon.node] - light.x, py[icon.node] - light.y) /
                  LIGHT_RADIUS,
            ) **
              2 *
            light.level
          : 0;
        if (
          Math.abs(reachLight - iconLit[k]) > 0.02 ||
          (!reachLight && iconLit[k])
        ) {
          iconLit[k] = reachLight;
          element.style.filter = reachLight
            ? `brightness(${(1 + 0.7 * reachLight).toFixed(3)})`
            : "";
        }
      });

      if (!context || !width || !height) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.globalCompositeOperation = "source-over";
      context.clearRect(0, 0, width, height);

      // Stars: unlinked, twinkling; one static frame under reduced motion.
      for (const star of network.stars) {
        const { alpha, size: starSize } = reduced
          ? { alpha: star.base * 0.65, size: star.size }
          : starLight(star, elapsed);
        const spriteSize = starSize * 5;
        context.globalAlpha = alpha;
        context.drawImage(
          starSprites[star.hue],
          star.x * width - spriteSize / 2,
          star.y * height - spriteSize / 2,
          spriteSize,
          spriteSize,
        );
      }
      const lighting = Boolean(litContext) && light.level > 0;
      const litPath = new Path2D();
      const near = (x: number, y: number) =>
        Math.abs(x - light.x) < LIGHT_RADIUS &&
        Math.abs(y - light.y) < LIGHT_RADIUS;

      // Lines, batched by alpha into a few paths.
      const linePaths = Array.from(
        { length: ALPHA_BUCKETS },
        () => new Path2D(),
      );
      const used = new Array<boolean>(ALPHA_BUCKETS).fill(false);
      for (const link of links) {
        const reach = linkReach(link, g);
        if (reach <= 0) continue;
        const depth = Math.min(nodes[link.a].z, nodes[link.b].z);
        const level = (0.45 + 0.55 * depth) * linkAlpha(link) * reach ** 0.5;
        const bucket = Math.min(
          ALPHA_BUCKETS - 1,
          Math.floor(level * ALPHA_BUCKETS),
        );
        const path = linePaths[bucket];
        used[bucket] = true;
        const ex = px[link.a] + (px[link.b] - px[link.a]) * reach;
        const ey = py[link.a] + (py[link.b] - py[link.a]) * reach;
        path.moveTo(px[link.a], py[link.a]);
        path.lineTo(ex, ey);
        if (lighting && (near(px[link.a], py[link.a]) || near(ex, ey))) {
          litPath.moveTo(px[link.a], py[link.a]);
          litPath.lineTo(ex, ey);
        }
      }
      context.lineWidth = 0.7;
      context.strokeStyle = `rgb(${LINE_RGB})`;
      linePaths.forEach((path, bucket) => {
        if (!used[bucket]) return;
        context.globalAlpha = (LINE_ALPHA * (bucket + 1)) / ALPHA_BUCKETS;
        context.stroke(path);
      });

      // Dots, batched the same way; a dot gives way to its icon.
      const dotPaths = Array.from(
        { length: ALPHA_BUCKETS },
        () => new Path2D(),
      );
      used.fill(false);
      nodes.forEach((node, i) => {
        const k = iconAt.get(i);
        const alpha =
          nodeAlpha(node, g) *
          (1 - (k === undefined ? 0 : iconAlpha(icons[k], g))) *
          (0.35 + 0.65 * node.z);
        if (alpha <= 0) return;
        const bucket = Math.min(
          ALPHA_BUCKETS - 1,
          Math.floor(alpha * ALPHA_BUCKETS),
        );
        const radius = 0.8 + node.z * 0.9;
        dotPaths[bucket].moveTo(px[i] + radius, py[i]);
        dotPaths[bucket].arc(px[i], py[i], radius, 0, Math.PI * 2);
        used[bucket] = true;
        if (lighting && near(px[i], py[i])) {
          litPath.moveTo(px[i] + radius + 0.4, py[i]);
          litPath.arc(px[i], py[i], radius + 0.4, 0, Math.PI * 2);
        }
      });
      context.fillStyle = `rgb(${LINE_RGB})`;
      dotPaths.forEach((path, bucket) => {
        if (!used[bucket]) return;
        context.globalAlpha = (DOT_ALPHA * (bucket + 1)) / ALPHA_BUCKETS;
        context.fill(path);
      });

      // Cursor light: the web under it, brighter, behind a radial falloff,
      // plus a faint violet-white haze. Additive, so never a hard disc.
      if (lighting && litContext) {
        const half = LIGHT_RADIUS;
        litContext.setTransform(1, 0, 0, 1, 0, 0);
        litContext.globalCompositeOperation = "source-over";
        litContext.clearRect(0, 0, litSize, litSize);
        litContext.setTransform(
          ratio,
          0,
          0,
          ratio,
          (half - light.x) * ratio,
          (half - light.y) * ratio,
        );
        litContext.strokeStyle = "rgb(255, 255, 255)";
        litContext.fillStyle = "rgb(255, 255, 255)";
        litContext.lineWidth = 0.9;
        litContext.globalAlpha = 0.75;
        litContext.stroke(litPath);
        litContext.fill(litPath);
        litContext.setTransform(1, 0, 0, 1, 0, 0);
        litContext.globalCompositeOperation = "destination-in";
        const c = litSize / 2;
        const mask = litContext.createRadialGradient(c, c, 0, c, c, c);
        mask.addColorStop(0, "rgba(0, 0, 0, 1)");
        mask.addColorStop(0.45, "rgba(0, 0, 0, 0.55)");
        mask.addColorStop(1, "rgba(0, 0, 0, 0)");
        litContext.fillStyle = mask;
        litContext.globalAlpha = 1;
        litContext.fillRect(0, 0, litSize, litSize);
        context.globalCompositeOperation = "lighter";
        context.globalAlpha = 0.6 * light.level;
        context.drawImage(
          lit,
          light.x - half,
          light.y - half,
          half * 2,
          half * 2,
        );
        const haze = context.createRadialGradient(
          light.x,
          light.y,
          0,
          light.x,
          light.y,
          half,
        );
        haze.addColorStop(0, "rgba(196, 181, 253, 0.07)");
        haze.addColorStop(1, "rgba(196, 181, 253, 0)");
        context.globalAlpha = light.level;
        context.fillStyle = haze;
        context.fillRect(light.x - half, light.y - half, half * 2, half * 2);
      }

      // Light: signals with a coloured trail, and pulses on arrival.
      context.globalCompositeOperation = "lighter";
      context.lineWidth = 1.6;
      context.lineCap = "round";
      for (const signal of signals) {
        const t = Math.min((elapsed - signal.start) / SIGNAL_MS, 1);
        const head = t * t * (3 - 2 * t);
        const tail = Math.max(0, head - 0.28);
        const link = links[signal.link];
        const from = signal.forward ? link.a : link.b;
        const to = signal.forward ? link.b : link.a;
        const at = (k: number) => [
          px[from] + (px[to] - px[from]) * k,
          py[from] + (py[to] - py[from]) * k,
        ];
        const [hx, hy] = at(head);
        const [tx, ty] = at(tail);
        const [r, gg, b] = hues[signal.hue];
        const fade = Math.sin(Math.PI * Math.min(t * 1.1, 1));
        const trail = context.createLinearGradient(tx, ty, hx, hy);
        trail.addColorStop(0, `rgba(${r}, ${gg}, ${b}, 0)`);
        trail.addColorStop(1, `rgba(${r}, ${gg}, ${b}, ${0.85 * fade})`);
        context.globalAlpha = 1;
        context.strokeStyle = trail;
        context.beginPath();
        context.moveTo(tx, ty);
        context.lineTo(hx, hy);
        context.stroke();
        const spriteSize = 12 + 10 * fade;
        context.globalAlpha = fade;
        context.drawImage(
          sprites[signal.hue],
          hx - spriteSize / 2,
          hy - spriteSize / 2,
          spriteSize,
          spriteSize,
        );
      }
      for (const [node, pulse] of pulses) {
        const level = pulseLevel(node);
        if (level <= 0) continue;
        const spriteSize = 18 + 34 * level;
        context.globalAlpha = level * 0.9;
        context.drawImage(
          sprites[pulse.hue],
          px[node] - spriteSize / 2,
          py[node] - spriteSize / 2,
          spriteSize,
          spriteSize,
        );
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
    };

    const tick = (now: number) => {
      // Time only advances while frames run: a hidden tab resumes in place.
      const delta = previous ? Math.min(now - previous, 50) : 16;
      previous = now;
      elapsed += delta;
      paint();
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (reduced || frame || !inView || document.hidden) return;
      previous = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const sync = () => (inView && !document.hidden ? start() : stop());

    const resize = () => {
      width = host.clientWidth;
      height = host.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      paint();
    };
    resize();
    const resizer = new ResizeObserver(resize);
    resizer.observe(host);
    const watcher = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
      sync();
    });
    watcher.observe(host);
    document.addEventListener("visibilitychange", sync);
    // Mouse only: touch and reduced motion never get the light.
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = host.getBoundingClientRect();
      light.tx = event.clientX - rect.left;
      light.ty = event.clientY - rect.top;
      light.on =
        light.tx >= 0 &&
        light.ty >= 0 &&
        light.tx <= rect.width &&
        light.ty <= rect.height;
    };
    const onLeave = () => {
      light.on = false;
    };
    const lightEnabled = finePointer && !reduced;
    if (lightEnabled) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    // Reduced motion paints the single static frame above and never loops.
    start();

    return () => {
      stop();
      resizer.disconnect();
      watcher.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      lit.width = 0;
      lit.height = 0;
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
