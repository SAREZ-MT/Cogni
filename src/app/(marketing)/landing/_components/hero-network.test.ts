import { describe, expect, it } from "vitest";
import {
  buildNetwork,
  DRIFT_PX,
  iconAlpha,
  linkAlpha,
  linkReach,
  nodeAlpha,
  nodeDrift,
  STAR_HUES,
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
