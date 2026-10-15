"use client";

import { useEffect, useRef, useState } from "react";
import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  Fog,
  Group,
  type InterleavedBufferAttribute,
  type Material,
  OneFactor,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3,
  WebGLRenderer,
  ZeroFactor,
} from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { cn } from "@/shared/ui/utils";

// "Knowledge constellation": pages/ideas as glowing nodes in a deep field,
// joined by links that fade in (knowledge consolidating). Signals travel
// along the links in the technique colours — flashcards, active recall,
// exams — and light up the node they reach, like a memory being reinforced
// by a review; some hop on to a neighbour. A slow dust layer and fog give
// the field depth; the pointer tilts it slightly (parallax).
// Loaded lazily (next/dynamic, ssr:false) by AuthShowcase, which also skips
// it for reduced motion and small screens; this file owns the WebGL
// lifecycle: DPR cap, pause when the tab is hidden, full disposal.

const NODE_COUNT = 110;
const LINKS_PER_NODE = 3;
const MAX_LINK = 13;
const DUST_COUNT = 520;
const CONSOLIDATE_MS = 6000;
const SIGNAL_EVERY_MS = 850;
const SIGNAL_MS = 1500;
const MAX_SIGNALS = 10;
const MAX_HOPS = 3;
const PULSE_MS = 2400;
const MAX_DPR = 2;
const FOG_NEAR = 55;
const FOG_FAR = 125;

// How long a lost WebGL context may take to come back before the panel
// settles on the static gradient for good (this mount).
export const CONTEXT_RESTORE_TIMEOUT_MS = 3000;

// loading: no frame yet · ready: a frame rendered on a live context ·
// lost: context lost, waiting for restore (static gradient shows) ·
// unavailable: no WebGL, renderer/frame failure or restore timed out.
export type CanvasState = "loading" | "ready" | "lost" | "unavailable";

type ConstellationCanvasProps = {
  className?: string;
  onStateChange?: (state: CanvasState) => void;
};

type Signal = {
  link: number;
  forward: boolean;
  start: number;
  color: Color;
  hops: number;
};

// Deterministic PRNG so the constellation keeps the same shape on reload.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tokenColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return new Color(value || fallback);
}

function supportsWebGL() {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    // Release the probe context right away: an unreleased one lives until
    // GC and counts against the browser's per-process context limit.
    gl?.getExtension?.("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

// Glow sprite: a bright core plus a soft gaussian halo, faded by depth
// (atmospheric perspective) so far nodes read dimmer and smaller.
const glowVertex = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vFade;
  uniform float uPixelRatio;
  uniform float uFogNear;
  uniform float uFogFar;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFade = 1.0 - smoothstep(uFogNear, uFogFar, -mv.z);
    gl_PointSize = aSize * uPixelRatio * (230.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const glowFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;
  uniform float uCore;
  uniform float uHalo;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(uCore, 0.0, d);
    float halo = exp(-d * d * 4.0) * uHalo;
    float alpha = (core + halo * (1.0 - core)) * vFade;
    vec3 color = mix(vColor, vec3(1.0), core * 0.45);
    gl_FragColor = vec4(color, alpha);
  }
`;

// Dust: tiny motes that drift on their own slow sine paths.
const dustVertex = /* glsl */ `
  attribute float aSeed;
  varying float vFade;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uFogNear;
  uniform float uFogFar;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.00012 + aSeed * 6.283) * 1.6;
    p.x += cos(uTime * 0.0001 + aSeed * 4.0) * 1.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = (1.0 - smoothstep(uFogNear, uFogFar, -mv.z)) *
      (0.35 + 0.65 * fract(aSeed * 13.7));
    gl_PointSize = (1.2 + fract(aSeed * 7.3) * 2.2) * uPixelRatio * (110.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const dustFragment = /* glsl */ `
  varying float vFade;
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = smoothstep(1.0, 0.0, d) * 0.9 * vFade;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// Additive light: colour is added and alpha is left alone. The canvas is
// opaque black composited with `mix-blend-mode: screen`, so the added light
// shows over the CSS nebula and fogged (dim) pixels fade to nothing instead
// of drawing dark strokes.
function addLight<T extends Material>(material: T): T {
  material.blending = CustomBlending;
  material.blendEquation = AddEquation;
  material.blendSrc = SrcAlphaFactor;
  material.blendDst = OneFactor;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
  material.transparent = true;
  material.depthWrite = false;
  return material;
}

function glowMaterial(pixelRatio: number, core: number, halo: number) {
  return addLight(
    new ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: {
        uPixelRatio: { value: pixelRatio },
        uFogNear: { value: FOG_NEAR },
        uFogFar: { value: FOG_FAR },
        uCore: { value: core },
        uHalo: { value: halo },
      },
    }),
  );
}

export default function ConstellationCanvas({
  className,
  onStateChange,
}: ConstellationCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CanvasState>("loading");
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Reports transitions only, and never after unmount.
    let unmounted = false;
    let current: CanvasState = "loading";
    const emit = (next: CanvasState) => {
      if (unmounted || next === current) return;
      current = next;
      setState(next);
      onStateChangeRef.current?.(next);
    };

    if (!supportsWebGL()) {
      emit("unavailable");
      return;
    }

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      emit("unavailable");
      return;
    }
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    renderer.setPixelRatio(pixelRatio);
    // Opaque black + CSS `mix-blend-mode: screen` on the host: black drops
    // out and the scene adds light over the nebula. A transparent clear left
    // every pixel at alpha 0 (colour without coverage), which some Chrome
    // compositing paths on macOS discard, so the scene rendered invisible.
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    // Additive blending over black fog = far links fade out (atmosphere).
    scene.fog = new Fog(0x000000, FOG_NEAR, FOG_FAR);
    const camera = new PerspectiveCamera(50, 1, 1, 260);
    camera.position.set(0, 0, 82);
    const origin = new Vector3(0, 0, 0);
    const cloud = new Group();
    cloud.rotation.x = 0.3;
    scene.add(cloud);

    const random = mulberry32(20261015);
    const base = tokenColor("--color-primary-300", "rgb(196, 181, 253)");
    const deep = tokenColor("--color-primary-600", "rgb(124, 58, 237)");
    const techniques = [
      tokenColor("--color-warning-500", "rgb(245, 158, 11)"),
      tokenColor("--color-success-500", "rgb(16, 185, 129)"),
      tokenColor("--color-rose-400", "rgb(251, 113, 133)"),
    ];

    // Nodes: a wide, deep ellipsoid so near and far layers both read.
    const positions = new Float32Array(NODE_COUNT * 3);
    for (let i = 0; i < NODE_COUNT; i++) {
      const u = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const r = 34 * Math.cbrt(0.15 + random() * 0.85);
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = r * s * Math.cos(theta) * 1.2;
      positions[i * 3 + 1] = r * u;
      positions[i * 3 + 2] = r * s * Math.sin(theta) * 0.9;
    }
    const baseSizes = new Float32Array(NODE_COUNT);
    const sizes = new Float32Array(NODE_COUNT);
    const nodeColors = new Float32Array(NODE_COUNT * 3);
    const restColors: Color[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      // A few "hub" nodes (main ideas) are larger and brighter.
      const hub = random() < 0.12;
      baseSizes[i] = hub ? 9 + random() * 4 : 4 + random() * 3.5;
      sizes[i] = baseSizes[i];
      const rest = deep
        .clone()
        .lerp(base, hub ? 0.9 : 0.35 + random() * 0.4)
        .multiplyScalar(hub ? 1 : 0.8);
      restColors.push(rest);
      rest.toArray(nodeColors, i * 3);
    }
    const nodeGeometry = new BufferGeometry();
    nodeGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    nodeGeometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    nodeGeometry.setAttribute("aColor", new BufferAttribute(nodeColors, 3));
    const nodeMaterial = glowMaterial(pixelRatio, 0.16, 0.7);
    cloud.add(new Points(nodeGeometry, nodeMaterial));

    // Links: each node to its nearest neighbours, deduplicated, skipping
    // long ones so the field reads as clusters, not a stretched wireframe.
    const pairs = new Set<string>();
    for (let i = 0; i < NODE_COUNT; i++) {
      const distances: Array<[number, number]> = [];
      for (let j = 0; j < NODE_COUNT; j++) {
        if (i === j) continue;
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        distances.push([dx * dx + dy * dy + dz * dz, j]);
      }
      distances.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < LINKS_PER_NODE; k++) {
        const [distanceSq, j] = distances[k];
        if (distanceSq > MAX_LINK * MAX_LINK) break;
        pairs.add(i < j ? `${i}:${j}` : `${j}:${i}`);
      }
    }
    const links = Array.from(pairs, (key) => key.split(":").map(Number));
    const linkStrength = links.map(([a, b]) => {
      const dx = positions[a * 3] - positions[b * 3];
      const dy = positions[a * 3 + 1] - positions[b * 3 + 1];
      const dz = positions[a * 3 + 2] - positions[b * 3 + 2];
      // Short links are stronger connections: brighter.
      return 1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / (MAX_LINK * 1.15);
    });
    const adjacency: number[][] = Array.from({ length: NODE_COUNT }, () => []);
    links.forEach(([a, b], index) => {
      adjacency[a].push(index);
      adjacency[b].push(index);
    });
    const linkPositions = new Float32Array(links.length * 6);
    links.forEach(([a, b], index) => {
      linkPositions.set(positions.subarray(a * 3, a * 3 + 3), index * 6);
      linkPositions.set(positions.subarray(b * 3, b * 3 + 3), index * 6 + 3);
    });
    const linkColors = new Float32Array(links.length * 6);
    const linkGeometry = new LineSegmentsGeometry();
    linkGeometry.setPositions(linkPositions);
    linkGeometry.setColors(linkColors);
    // World-unit width: perspective makes near links thicker, far thinner.
    const linkMaterial = addLight(
      new LineMaterial({
        vertexColors: true,
        worldUnits: true,
        linewidth: 0.16,
      }),
    );
    linkMaterial.fog = true;
    cloud.add(new LineSegments2(linkGeometry, linkMaterial));
    const linkColorBuffer = (
      linkGeometry.attributes.instanceColorStart as InterleavedBufferAttribute
    ).data;

    // Signals travelling along links.
    const signalPositions = new Float32Array(MAX_SIGNALS * 3);
    const signalSizes = new Float32Array(MAX_SIGNALS);
    const signalColors = new Float32Array(MAX_SIGNALS * 3);
    const signalGeometry = new BufferGeometry();
    signalGeometry.setAttribute(
      "position",
      new BufferAttribute(signalPositions, 3),
    );
    signalGeometry.setAttribute("aSize", new BufferAttribute(signalSizes, 1));
    signalGeometry.setAttribute("aColor", new BufferAttribute(signalColors, 3));
    const signalMaterial = glowMaterial(pixelRatio, 0.24, 1.0);
    cloud.add(new Points(signalGeometry, signalMaterial));

    // Dust: a larger, sparser volume around the constellation.
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    const dustSeeds = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPositions[i * 3] = (random() * 2 - 1) * 70;
      dustPositions[i * 3 + 1] = (random() * 2 - 1) * 60;
      dustPositions[i * 3 + 2] = (random() * 2 - 1) * 45;
      dustSeeds[i] = random();
    }
    const dustGeometry = new BufferGeometry();
    dustGeometry.setAttribute(
      "position",
      new BufferAttribute(dustPositions, 3),
    );
    dustGeometry.setAttribute("aSeed", new BufferAttribute(dustSeeds, 1));
    const dustMaterial = addLight(
      new ShaderMaterial({
        vertexShader: dustVertex,
        fragmentShader: dustFragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
          uFogNear: { value: FOG_NEAR - 20 },
          uFogFar: { value: FOG_FAR + 20 },
          uColor: { value: base.clone().lerp(new Color(1, 1, 1), 0.3) },
        },
      }),
    );
    const dust = new Points(dustGeometry, dustMaterial);
    scene.add(dust);

    const signals: Signal[] = [];
    const pulses = new Map<number, { start: number; color: Color }>();
    const glow = new Float32Array(NODE_COUNT);
    const scratch = new Color();
    const linkRest = new Color();
    let colorIndex = 0;
    let lastSpawn = -SIGNAL_EVERY_MS;
    let frame = 0;
    let lost = false;
    let disposed = false;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;
    let elapsed = 0;
    let previous = 0;
    const pointer = { x: 0, y: 0 };
    const parallax = { x: 0, y: 0 };

    const resize = () => {
      const { clientWidth, clientHeight } = host;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      linkMaterial.resolution.set(
        clientWidth * pixelRatio,
        clientHeight * pixelRatio,
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const onPointer = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const spawn = (
      link: number,
      forward: boolean,
      hops: number,
      color?: Color,
    ) => {
      if (signals.length >= MAX_SIGNALS) return;
      signals.push({
        link,
        forward,
        start: elapsed,
        hops,
        color: color ?? techniques[colorIndex++ % techniques.length],
      });
    };

    const render = (now: number) => {
      // Elapsed time only advances while frames run, so a hidden tab resumes
      // where it left off instead of jumping.
      const delta = previous ? Math.min(now - previous, 50) : 16;
      previous = now;
      elapsed += delta;

      parallax.x += (pointer.x - parallax.x) * 0.03;
      parallax.y += (pointer.y - parallax.y) * 0.03;
      camera.position.x = parallax.x * 5;
      camera.position.y = -parallax.y * 3.5;
      camera.lookAt(origin);

      cloud.rotation.y = elapsed * 0.000035;
      cloud.rotation.x = 0.3 + Math.sin(elapsed * 0.0001) * 0.05;
      dust.rotation.y = elapsed * 0.000015;
      dustMaterial.uniforms.uTime.value = elapsed;

      if (elapsed - lastSpawn > SIGNAL_EVERY_MS && links.length) {
        lastSpawn = elapsed;
        spawn(Math.floor(random() * links.length), random() < 0.5, 0);
      }

      // Advance signals; on arrival pulse the node and maybe hop onward.
      glow.fill(0);
      for (let s = signals.length - 1; s >= 0; s--) {
        const signal = signals[s];
        const t = (elapsed - signal.start) / SIGNAL_MS;
        if (t < 1) continue;
        signals.splice(s, 1);
        const [a, b] = links[signal.link];
        const target = signal.forward ? b : a;
        pulses.set(target, { start: elapsed, color: signal.color });
        if (signal.hops < MAX_HOPS && random() < 0.65) {
          const next = adjacency[target].filter((l) => l !== signal.link);
          if (next.length) {
            const link = next[Math.floor(random() * next.length)];
            spawn(
              link,
              links[link][0] === target,
              signal.hops + 1,
              signal.color,
            );
          }
        }
      }

      for (let i = 0; i < NODE_COUNT; i++) {
        const pulse = pulses.get(i);
        let level = 0;
        if (pulse) {
          const t = (elapsed - pulse.start) / PULSE_MS;
          if (t >= 1) pulses.delete(i);
          else level = Math.sin(Math.PI * Math.min(t * 2.2, 1)) * (1 - t);
        }
        glow[i] = level;
        scratch.copy(restColors[i]);
        if (pulse) scratch.lerp(pulse.color, Math.min(level * 1.6, 1));
        scratch.toArray(nodeColors, i * 3);
        sizes[i] = baseSizes[i] * (1 + level * 1.6);
      }

      // Links: gradient between their two endpoint colours, dimmer when
      // long, fading in over the first seconds (consolidation).
      const consolidated = 1 - (1 - Math.min(elapsed / CONSOLIDATE_MS, 1)) ** 3;
      links.forEach(([a, b], index) => {
        const strength = 0.12 + 0.3 * linkStrength[index];
        linkRest
          .fromArray(nodeColors, a * 3)
          .multiplyScalar(strength * consolidated * (1 + glow[a] * 2));
        linkRest.toArray(linkColors, index * 6);
        linkRest
          .fromArray(nodeColors, b * 3)
          .multiplyScalar(strength * consolidated * (1 + glow[b] * 2));
        linkRest.toArray(linkColors, index * 6 + 3);
      });

      signalSizes.fill(0);
      signals.forEach((signal, s) => {
        const t = Math.min((elapsed - signal.start) / SIGNAL_MS, 1);
        const eased = t * t * (3 - 2 * t);
        const [a, b] = links[signal.link];
        const from = signal.forward ? a : b;
        const to = signal.forward ? b : a;
        for (let k = 0; k < 3; k++) {
          signalPositions[s * 3 + k] =
            positions[from * 3 + k] +
            (positions[to * 3 + k] - positions[from * 3 + k]) * eased;
        }
        signalSizes[s] = 8 * Math.sin(Math.PI * Math.min(t * 1.15, 1)) + 1;
        signal.color.toArray(signalColors, s * 3);
        // The travelled link glows in the signal colour, brightest at the head.
        const fromSlot = signal.forward ? 0 : 3;
        const toSlot = signal.forward ? 3 : 0;
        scratch.copy(signal.color).multiplyScalar(0.55 * (1 - eased));
        linkColors[signal.link * 6 + fromSlot] += scratch.r;
        linkColors[signal.link * 6 + fromSlot + 1] += scratch.g;
        linkColors[signal.link * 6 + fromSlot + 2] += scratch.b;
        scratch.copy(signal.color).multiplyScalar(0.8 * eased);
        linkColors[signal.link * 6 + toSlot] += scratch.r;
        linkColors[signal.link * 6 + toSlot + 1] += scratch.g;
        linkColors[signal.link * 6 + toSlot + 2] += scratch.b;
      });

      nodeGeometry.attributes.aColor.needsUpdate = true;
      nodeGeometry.attributes.aSize.needsUpdate = true;
      signalGeometry.attributes.position.needsUpdate = true;
      signalGeometry.attributes.aSize.needsUpdate = true;
      signalGeometry.attributes.aColor.needsUpdate = true;
      linkColorBuffer.needsUpdate = true;

      frame = 0;
      if (!draw()) return;
      frame = requestAnimationFrame(render);
    };

    function start() {
      if (frame || lost || disposed) return;
      previous = 0;
      frame = requestAnimationFrame(render);
    }
    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    // Context loss (GPU reset, driver hiccup, too many contexts): stop the
    // loop and let the static gradient show. Three rebuilds its GL state on
    // restore (WebGLRenderer.initGLContext), re-uploading geometries and
    // recompiling the shader materials on the next render.
    const onContextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      stop();
      emit("lost");
      clearTimeout(restoreTimer);
      restoreTimer = setTimeout(fail, CONTEXT_RESTORE_TIMEOUT_MS);
    };
    const onContextRestored = () => {
      clearTimeout(restoreTimer);
      lost = false;
      if (!document.hidden) start();
    };
    const canvas = renderer.domElement;
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    // Idempotent: removes every listener, timer, frame and GPU resource.
    function teardown() {
      if (disposed) return;
      disposed = true;
      stop();
      clearTimeout(restoreTimer);
      // Listeners go first so the forced loss below is not seen as a crash.
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      observer.disconnect();
      for (const disposable of [
        nodeGeometry,
        nodeMaterial,
        linkGeometry,
        linkMaterial,
        signalGeometry,
        signalMaterial,
        dustGeometry,
        dustMaterial,
      ]) {
        disposable.dispose();
      }
      renderer.dispose();
      // dispose() keeps the WebGL context alive until GC; release it now so
      // remounts (navigation, HMR) never pile up against the browser's
      // per-process context limit.
      renderer.forceContextLoss();
      canvas.remove();
    }
    function fail() {
      teardown();
      emit("unavailable");
    }
    // Renders one frame; "ready" only once a frame landed on a live context.
    function draw() {
      try {
        renderer.render(scene, camera);
      } catch {
        fail();
        return false;
      }
      if (!renderer.getContext().isContextLost()) emit("ready");
      return true;
    }

    if (draw() && !document.hidden) start();

    return () => {
      teardown();
      unmounted = true;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-canvas-state={state}
      className={cn(
        "mix-blend-screen transition-opacity ease-out",
        state === "ready"
          ? "opacity-100 duration-[1600ms]"
          : "opacity-0 duration-500",
        className,
      )}
    />
  );
}
