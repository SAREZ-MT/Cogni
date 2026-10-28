import { describe, expect, it } from "vitest";
import {
  buildNetwork,
  CLUSTER_AMPLITUDE,
  clusterOffset,
  DRIFT_PX,
  FOCUS_BLUR_PX,
  iconAlpha,
  iconFocus,
  linkAlpha,
  linkReach,
  nodeAlpha,
  nodeDrift,
  STAR_HUES,
  spreadEvenly,
  starLight,
} from "./hero-network";

describe("hero network layout", () => {
  it("is deterministic for the same seed and size", () => {
    expect(buildNetwork("desktop")).toEqual(buildNetwork("desktop"));
  });

  it("uses fewer nodes and icons on phones", () => {
    const desktop = buildNetwork("desktop");
    const mobile = buildNetwork("mobile");
    expect(mobile.nodes.length).toBeLessThan(desktop.nodes.length);
    expect(mobile.icons.length).toBeLessThan(desktop.icons.length);
    expect(desktop.icons.length).toBeGreaterThanOrEqual(24);
  });

  it("spreads icons so every region of the scene holds at least one", () => {
    const { nodes, icons } = buildNetwork("desktop");
    // A 4×3 grid over the scene, skipping the two central cells under the copy.
    const cells = new Set(
      icons.map(({ node }) => {
        const { x, y } = nodes[node];
        return `${Math.min(3, Math.floor(x * 4))}:${Math.min(2, Math.floor(y * 3))}`;
      }),
    );
    for (const cell of [
      "0:0",
      "1:0",
      "2:0",
      "3:0",
      "0:1",
      "3:1",
      "0:2",
      "1:2",
      "2:2",
      "3:2",
    ]) {
      expect(cells.has(cell)).toBe(true);
    }
  });

  it("picks the farthest candidate first when spreading", () => {
    const pool = [
      { node: { x: 0, y: 0 } },
      { node: { x: 0.05, y: 0.05 } },
      { node: { x: 1, y: 1 } },
    ];
    expect(spreadEvenly(pool, 2, 1)).toEqual([pool[0], pool[2]]);
  });

  it("links only existing, distinct nodes", () => {
    const { nodes, links } = buildNetwork("desktop");
    expect(links.length).toBeGreaterThan(nodes.length);
    for (const link of links) {
      expect(link.a).not.toBe(link.b);
      expect(nodes[link.a]).toBeDefined();
      expect(nodes[link.b]).toBeDefined();
    }
  });

  it("keeps icons out of the text block in the centre", () => {
    const { nodes, icons } = buildNetwork("desktop");
    for (const icon of icons) {
      const { x, y } = nodes[icon.node];
      const insideText = Math.abs(x - 0.5) < 0.24 && Math.abs(y - 0.5) < 0.2;
      expect(insideText).toBe(false);
    }
  });
});

describe("hero network growth", () => {
  const network = buildNetwork("desktop");

  it("shows nothing at zero growth and everything at full growth", () => {
    for (const node of network.nodes) {
      expect(nodeAlpha(node, 0)).toBe(0);
      expect(nodeAlpha(node, 1)).toBe(1);
    }
    for (const link of network.links) {
      expect(linkReach(link, 0)).toBe(0);
      expect(linkReach(link, 1)).toBe(1);
    }
    for (const icon of network.icons) {
      expect(iconAlpha(icon, 0)).toBe(0);
      expect(iconAlpha(icon, 1)).toBe(1);
    }
  });

  it("grows dots first, then lines, then icons", () => {
    const share = (values: number[]) =>
      values.filter((v) => v > 0).length / values.length;
    const at = (g: number) => ({
      dots: share(network.nodes.map((n) => nodeAlpha(n, g))),
      lines: share(network.links.map((l) => linkReach(l, g))),
      icons: share(network.icons.map((i) => iconAlpha(i, g))),
    });
    const early = at(0.2);
    expect(early.dots).toBeGreaterThan(early.lines);
    expect(early.icons).toBe(0);
    const middle = at(0.55);
    expect(middle.lines).toBeGreaterThan(middle.icons);
    expect(middle.icons).toBeGreaterThan(0);
  });

  it("never draws a line before both of its ends exist", () => {
    for (const g of [0.1, 0.25, 0.4, 0.6, 0.8]) {
      for (const link of network.links) {
        if (linkReach(link, g) > 0) {
          expect(nodeAlpha(network.nodes[link.a], g)).toBeGreaterThan(0);
          expect(nodeAlpha(network.nodes[link.b], g)).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("hero network ambient drift", () => {
  const { nodes } = buildNetwork("desktop");

  it("keeps every node within a few pixels of its place", () => {
    for (const t of [0, 1500, 9000, 60000]) {
      for (const node of nodes) {
        const { dx, dy } = nodeDrift(node, t);
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(DRIFT_PX * Math.SQRT2);
      }
    }
  });

  it("moves the nodes over time, each on its own path", () => {
    const moved = nodes.filter((node) => {
      const a = nodeDrift(node, 0);
      const b = nodeDrift(node, 2000);
      return Math.hypot(a.dx - b.dx, a.dy - b.dy) > 0.5;
    });
    expect(moved.length).toBeGreaterThan(nodes.length * 0.8);
    const first = nodeDrift(nodes[0], 2000);
    const second = nodeDrift(nodes[1], 2000);
    expect(first).not.toEqual(second);
  });
});

describe("hero network density", () => {
  const { nodes, links } = buildNetwork("desktop");

  it("is a rich web: well over five links per three nodes", () => {
    expect(links.length / nodes.length).toBeGreaterThanOrEqual(2.6);
  });

  it("dims long lines more than short ones", () => {
    const sorted = [...links].sort((a, b) => a.length - b.length);
    const short = sorted[0];
    const long = sorted[sorted.length - 1];
    expect(linkAlpha(long)).toBeLessThan(linkAlpha(short));
    for (const link of links) {
      expect(linkAlpha(link)).toBeGreaterThan(0);
      expect(linkAlpha(link)).toBeLessThanOrEqual(1);
    }
  });
});

describe("hero stars", () => {
  const desktop = buildNetwork("desktop").stars;
  const mobile = buildNetwork("mobile").stars;

  it("scatters 120 to 200 stars on desktop and fewer on phones", () => {
    expect(desktop.length).toBeGreaterThanOrEqual(120);
    expect(desktop.length).toBeLessThanOrEqual(200);
    expect(mobile.length).toBeLessThan(desktop.length);
  });

  it("uses tiny varied sizes and the soft palette plus white", () => {
    for (const star of desktop) {
      expect(star.size).toBeGreaterThanOrEqual(0.6);
      expect(star.size).toBeLessThanOrEqual(1.8);
      expect(star.hue).toBeGreaterThanOrEqual(0);
      expect(star.hue).toBeLessThan(STAR_HUES);
    }
  });

  it("twinkles each star on its own rhythm, within bounds", () => {
    const changed = desktop.filter(
      (star) =>
        Math.abs(starLight(star, 0).alpha - starLight(star, 1800).alpha) > 0.02,
    );
    expect(changed.length).toBeGreaterThan(desktop.length * 0.6);
    for (const star of desktop) {
      for (const t of [0, 900, 5000]) {
        const { alpha, size } = starLight(star, t);
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThanOrEqual(1);
        expect(size).toBeLessThanOrEqual(star.size * 1.25);
      }
    }
  });

  it("keeps stars dimmer near the copy", () => {
    const brightness = (inside: boolean) => {
      const group = desktop.filter((star) => {
        const near =
          Math.abs(star.x - 0.5) < 0.24 && Math.abs(star.y - 0.5) < 0.2;
        return near === inside;
      });
      return group.reduce((sum, star) => sum + star.base, 0) / group.length;
    };
    expect(brightness(true)).toBeLessThan(brightness(false) * 0.6);
  });
});

describe("hero network cluster breathing", () => {
  const network = buildNetwork("desktop");
  const { nodes, icons, clusters, membership } = network;

  it("centres its clusters where the icons gather", () => {
    expect(clusters.length).toBeGreaterThanOrEqual(4);
    for (const cluster of clusters) {
      const nearby = icons.filter((icon) => {
        const node = nodes[icon.node];
        return Math.hypot((node.x - cluster.x) * 1.6, node.y - cluster.y) < 0.2;
      });
      expect(nearby.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps sparse areas calm: some nodes belong to no cluster", () => {
    const calm = membership.filter((m) => m.weight === 0);
    expect(calm.length).toBeGreaterThan(nodes.length * 0.1);
    for (const [i, m] of membership.entries()) {
      if (m.weight > 0) continue;
      expect(clusterOffset(network, i, 3000)).toEqual({ dx: 0, dy: 0 });
    }
  });

  it("moves cluster members by a few percent around their own centre", () => {
    for (const t of [0, 1700, 4200, 9000]) {
      for (const [i, m] of membership.entries()) {
        if (m.weight === 0) continue;
        const { dx, dy } = clusterOffset(network, i, t);
        const c = clusters[m.cluster];
        const r = Math.hypot(nodes[i].x - c.x, nodes[i].y - c.y);
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(
          r * CLUSTER_AMPLITUDE + 1e-9,
        );
      }
    }
  });

  it("breathes each cluster on its own rhythm", () => {
    const periods = new Set(clusters.map((c) => Math.round(c.period)));
    const phases = new Set(clusters.map((c) => c.phase.toFixed(3)));
    expect(periods.size).toBeGreaterThan(1);
    expect(phases.size).toBe(clusters.length);
    for (const c of clusters) {
      expect(c.period).toBeGreaterThanOrEqual(6000);
      expect(c.period).toBeLessThanOrEqual(10000);
    }
  });
});

describe("hero icon focus pulse", () => {
  const { icons } = buildNetwork("desktop");

  it("blurs up to about 3px and dims a little, never more", () => {
    expect(FOCUS_BLUR_PX).toBeGreaterThanOrEqual(2);
    expect(FOCUS_BLUR_PX).toBeLessThanOrEqual(3);
    for (const icon of icons) {
      for (const t of [0, 1300, 5200, 8800]) {
        const { blur, opacity } = iconFocus(icon, t);
        expect(blur).toBeGreaterThanOrEqual(0);
        expect(blur).toBeLessThanOrEqual(FOCUS_BLUR_PX);
        expect(opacity).toBeGreaterThanOrEqual(0.7);
        expect(opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps roughly a third to a half of the icons out of focus at a time", () => {
    const shares = [0, 2500, 5000, 7500, 10000, 12500].map(
      (t) =>
        icons.filter((icon) => iconFocus(icon, t).blur > 0.3).length /
        icons.length,
    );
    const average = shares.reduce((a, b) => a + b, 0) / shares.length;
    expect(average).toBeGreaterThanOrEqual(0.25);
    expect(average).toBeLessThanOrEqual(0.55);
  });

  it("gives each icon its own 4 to 9 second cycle", () => {
    for (const icon of icons) {
      expect(icon.focusPeriod).toBeGreaterThanOrEqual(4000);
      expect(icon.focusPeriod).toBeLessThanOrEqual(9000);
    }
    expect(new Set(icons.map((i) => i.focusPhase.toFixed(3))).size).toBe(
      icons.length,
    );
  });
});
