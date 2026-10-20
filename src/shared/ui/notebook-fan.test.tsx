import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const reduced = vi.hoisted(() => ({ value: false }));
// Motion elements render as plain tags that expose their `initial`,
// `animate` and `transition` props, so the entrance contract is observable
// in jsdom.
vi.mock("motion/react", async (importOriginal) => {
  const { createElement } = await import("react");
  const cache = new Map<string, unknown>();
  const motion = new Proxy(
    {},
    {
      get: (_, tag: string) => {
        if (!cache.has(tag)) {
          cache.set(
            tag,
            ({
              initial,
              animate,
              transition,
              ...rest
            }: Record<string, unknown>) =>
              createElement(tag, {
                ...rest,
                "data-initial": JSON.stringify(initial),
                "data-animate": JSON.stringify(animate),
                "data-transition": JSON.stringify(transition),
              }),
          );
        }
        return cache.get(tag);
      },
    },
  );
  return {
    ...(await importOriginal<typeof import("motion/react")>()),
    motion,
    useReducedMotion: () => reduced.value,
  };
});

import { NotebookFan } from "./notebook-fan";

function books(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-part="fan-notebook"]'),
  );
}

// Phase 8 H4-T3 (user decision 2026-10-20, option D palette 1): the
// notebooks hub's hero is three closed notebooks fanned, the new one in
// front.
describe("NotebookFan", () => {
  afterEach(() => {
    reduced.value = false;
  });

  it("fans two sample subjects behind the new notebook, which comes last and on top", () => {
    const { container } = render(<NotebookFan />);

    const all = books(container);
    expect(all.map((book) => book.dataset.notebook)).toEqual([
      "left",
      "right",
      "front",
    ]);
    expect(all.map((book) => book.textContent)).toEqual([
      "Historia18 páginas",
      "Biología9 páginas",
      "Nueva materiaTu primer cuaderno",
    ]);
    const front = all[2] as HTMLElement;
    expect(front.parentElement?.lastElementChild).toBe(front);
    expect(front).toHaveClass("z-10");
    // Tilted outward, the front one upright and raised.
    const poses = all.map((book) => JSON.parse(book.dataset.animate ?? "{}"));
    expect(poses.map((pose) => pose.rotate)).toEqual([-9, 9, 0]);
    expect(poses.map((pose) => pose.x)).toEqual([-150, 150, 0]);
    expect(poses[2].y).toBeLessThan(poses[0].y);
  });

  // Phase 8 H4-T4: every book is the shared `NotebookCover` atom; the front
  // one keeps its default violet palette, the hub header's badge.
  it("draws each book with the shared NotebookCover, the front one violet", () => {
    const { container } = render(<NotebookFan />);

    const all = books(container);
    for (const book of all) {
      expect(
        book.querySelector(':scope > [data-slot="notebook-cover"]'),
      ).toHaveClass("size-full");
    }
    expect(all[2]?.querySelector('[data-part="cover"]')).toHaveClass(
      "from-primary-500",
      "to-primary-700",
    );
    expect(all[0]?.querySelector('[data-part="cover"]')).toHaveClass(
      "from-amber-200",
    );
  });

  it("is decorative: hidden from assistive technology and not interactive", () => {
    const { container } = render(<NotebookFan />);

    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-slot", "notebook-fan");
    expect(container.querySelector("button, a, img")).toBeNull();
  });

  it("settles from one squared stack, springy without overshoot, within 500 ms", () => {
    const { container } = render(<NotebookFan />);

    for (const book of books(container)) {
      expect(JSON.parse(book.dataset.initial ?? "null")).toMatchObject({
        x: 0,
        rotate: 0,
      });
      const transition = JSON.parse(book.dataset.transition ?? "{}");
      expect(transition).toMatchObject({ type: "spring", bounce: 0 });
      expect(transition.visualDuration + transition.delay).toBeLessThanOrEqual(
        0.5,
      );
    }
  });

  it("keeps `initial` and only zeroes the transitions under reduced motion", () => {
    const initials = books(render(<NotebookFan />).container).map(
      (book) => book.dataset.initial,
    );
    reduced.value = true;
    const { container } = render(<NotebookFan />);

    const all = books(container);
    expect(all.map((book) => book.dataset.initial)).toEqual(initials);
    for (const book of all) {
      expect(JSON.parse(book.dataset.transition ?? "{}")).toEqual({
        duration: 0,
      });
    }
  });
});
