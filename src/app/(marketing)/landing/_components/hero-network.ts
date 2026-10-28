// Layout and growth rules of the hero's background network. Pure and
// seeded, so the server render, the client and the tests agree on every
// node. Positions are fractions of the scene (x across, y down); `z` is
// depth (0 far, 1 near). Growth `g` runs 0 → 1 with the scroll: dots are
// born first, lines join them next, and some nodes turn into study icons.

export type NetworkSize = "desktop" | "mobile";

export type NetworkNode = { x: number; y: number; z: number; born: number };
export type NetworkLink = { a: number; b: number; born: number };
export type NetworkIcon = {
  node: number;
  born: number;
  glyph: number;
  hue: number;
  size: number;
};

export type Network = {
  nodes: NetworkNode[];
  links: NetworkLink[];
  icons: NetworkIcon[];
};

type Spec = {
  cols: number;
  rows: number;
  aspect: number;
  keep: number;
  radius: number;
  // Tight groups of extra nodes, so the web reads organic, not gridded.
  clusters: number;
  clusterNodes: number;
  icons: number;
  // Half-width and half-height of the text block, where no icon may sit.
  textZone: [number, number];
};

const SPECS: Record<NetworkSize, Spec> = {
  desktop: {
    cols: 16,
    rows: 10,
    aspect: 1.6,
    keep: 0.8,
    radius: 0.2,
    clusters: 9,
    clusterNodes: 7,
    icons: 46,
    textZone: [0.24, 0.2],
  },
  mobile: {
    cols: 7,
    rows: 12,
    aspect: 0.46,
    keep: 0.8,
    radius: 0.17,
    clusters: 4,
    clusterNodes: 5,
    icons: 18,
    textZone: [0.44, 0.24],
  },
};

export const GLYPH_COUNT = 24;
export const HUE_COUNT = 8;

const NODE_FADE = 0.08;
const LINK_DRAW = 0.12;
const ICON_FADE = 0.1;
const NEIGHBOURS = 4;
const LONG_LINK_SHARE = 0.14;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function span(g: number, start: number, length: number) {
  return Math.min(1, Math.max(0, (g - start) / length));
}

export function buildNetwork(size: NetworkSize): Network {
  const spec = SPECS[size];
  const random = mulberry32(size === "desktop" ? 20261027 : 20261028);

  // Jittered grid: even coverage of the whole scene, never a visible grid.
  // It overflows the edges a little so lines run off-screen like a web.
  const nodes: NetworkNode[] = [];
  for (let row = 0; row < spec.rows; row++) {
    for (let col = 0; col < spec.cols; col++) {
      if (random() > spec.keep) continue;
      nodes.push({
        x: (col + 0.15 + random() * 0.7) / spec.cols,
        y: (row + 0.15 + random() * 0.7) / spec.rows,
        z: random(),
        born: random() * 0.5,
      });
    }
  }

  for (let c = 0; c < spec.clusters; c++) {
    const cx = 0.05 + random() * 0.9;
    const cy = 0.05 + random() * 0.9;
    for (let k = 0; k < spec.clusterNodes; k++) {
      const angle = random() * Math.PI * 2;
      const r = 0.015 + random() * 0.07;
      nodes.push({
        x: cx + (Math.cos(angle) * r) / spec.aspect,
        y: cy + Math.sin(angle) * r,
        z: random(),
        born: random() * 0.5,
      });
    }
  }

  const distance = (i: number, j: number) => {
    const dx = (nodes[i].x - nodes[j].x) * spec.aspect;
    const dy = nodes[i].y - nodes[j].y;
    return Math.hypot(dx, dy);
  };

  const pairs = new Set<string>();
  const links: NetworkLink[] = [];
  const addLink = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (a === b || pairs.has(key)) return;
    pairs.add(key);
    // A line starts after both of its ends exist.
    const after = Math.max(nodes[a].born, nodes[b].born) + 0.05;
    const born = Math.min(after + random() * 0.32, 1 - LINK_DRAW);
    links.push({ a, b, born: Math.max(born, after) });
  };

  nodes.forEach((_, i) => {
    const nearest = nodes
      .map((__, j) => [distance(i, j), j] as const)
      .filter(([d, j]) => j !== i && d < spec.radius)
      .sort((p, q) => p[0] - q[0])
      .slice(0, NEIGHBOURS);
    for (const [, j] of nearest) addLink(i, j);
    // A few long threads across the scene, as in a real knowledge web.
    if (random() < LONG_LINK_SHARE) {
      const far = Math.floor(random() * nodes.length);
      if (distance(i, far) > spec.radius * 1.8) addLink(i, far);
    }
  });

  // Icons: nodes outside the text block, chosen at random.
  const [zoneX, zoneY] = spec.textZone;
  const candidates = nodes
    .map((node, index) => ({ node, index, order: random() }))
    .filter(
      ({ node }) =>
        Math.abs(node.x - 0.5) >= zoneX || Math.abs(node.y - 0.5) >= zoneY,
    )
    .filter(({ node }) => node.x > 0.02 && node.x < 0.98 && node.y > 0.04)
    .sort((p, q) => p.order - q.order)
    .slice(0, spec.icons);

  const glyphOffset = Math.floor(random() * GLYPH_COUNT);
  const icons: NetworkIcon[] = candidates.map(({ node, index }, k) => ({
    node: index,
    born: Math.max(0.4 + random() * 0.45, node.born + 0.1),
    glyph: (glyphOffset + k) % GLYPH_COUNT,
    hue: Math.floor(random() * HUE_COUNT),
    // Near nodes are larger: depth by size, as well as by blur.
    size: Math.round(13 + node.z * 11),
  }));

  return { nodes, links, icons };
}

/** Opacity of a dot at growth `g`. */
export function nodeAlpha(node: NetworkNode, g: number) {
  return span(g, node.born, NODE_FADE);
}

/** Share of a line drawn at growth `g` (it grows from end `a` to `b`). */
export function linkReach(link: NetworkLink, g: number) {
  return span(g, link.born, LINK_DRAW);
}

/** Opacity (and scale-in) of an icon at growth `g`. */
export function iconAlpha(icon: NetworkIcon, g: number) {
  return span(g, icon.born, ICON_FADE);
}

/** Largest ambient offset of a node on each axis, in CSS pixels. */
export const DRIFT_PX = 7;

// Stable per-node noise from its position, so the drift never changes the
// seeded layout above.
function hash(x: number, y: number, salt: number) {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Ambient drift of a node at time `t` (ms): a slow Lissajous wander, wider
 * for near nodes so depth reads as parallax. Lines and icons follow it.
 */
export function nodeDrift(node: NetworkNode, t: number) {
  const phase = hash(node.x, node.y, 1) * Math.PI * 2;
  const speed = 0.00018 + hash(node.x, node.y, 2) * 0.00022;
  const amplitude = DRIFT_PX * (0.4 + 0.6 * node.z);
  return {
    dx: Math.sin(t * speed + phase) * amplitude,
    dy: Math.cos(t * speed * 0.8 + phase * 1.7) * amplitude,
  };
}
