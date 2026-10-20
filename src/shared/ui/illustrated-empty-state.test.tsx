import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const reduced = vi.hoisted(() => ({ value: false }));
// Motion elements render as plain tags that expose their `initial` and
// `transition` props, so the entrance contract is observable in jsdom.
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
              animate: _animate,
              transition,
              ...rest
            }: Record<string, unknown>) =>
              createElement(tag, {
                ...rest,
                "data-initial": JSON.stringify(initial),
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

import { IllustratedEmptyState } from "./illustrated-empty-state";

const IMAGE = {
  src: "/illustrations/calendar-empty.webp",
  width: 1600,
  height: 1102,
};

describe("IllustratedEmptyState", () => {
  it("shows a decorative illustration on a gradient backdrop over a big title and its message", () => {
    const { container } = render(
      <IllustratedEmptyState
        image={IMAGE}
        title="Hoy estás al día"
        description="No tienes repasos pendientes."
        action={<a href="/x">Ver la semana</a>}
      />,
    );

    const root = container.querySelector(
      '[data-slot="illustrated-empty-state"]',
    );
    expect(root).toHaveClass("empty-state-glow");
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image?.getAttribute("src")).toContain("calendar-empty.webp");
    expect(image).not.toHaveClass("mask-fade-edges");
    const art = container.querySelector('[data-part="art"]');
    expect(art).toHaveClass("illustration-backdrop");
    expect(art).toContainElement(image as HTMLElement);
    const title = screen.getByRole("heading", { name: "Hoy estás al día" });
    expect(title).toHaveClass("text-gradient-brand");
    expect(
      screen.getByText("No tienes repasos pendientes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver la semana" })).toHaveAttribute(
      "href",
      "/x",
    );
  });

  it("omits the action slot when none is given", () => {
    const { container } = render(
      <IllustratedEmptyState image={IMAGE} title="t" description="d" />,
    );
    expect(container.querySelector('[data-part="action"]')).toBeNull();
    expect(container.querySelector('[data-part="steps"]')).toBeNull();
  });

  // Phase 8 H4 (notebooks hub, user decision 2026-10-20): a plain variant
  // whose illustration keeps its own white background on the white page.
  it("uses the 480px art and the single block entrance by default", () => {
    const { container } = render(
      <IllustratedEmptyState image={IMAGE} title="t" description="d" />,
    );
    const root = container.querySelector(
      '[data-slot="illustrated-empty-state"]',
    );
    expect(root).toHaveAttribute("data-entrance", "block");
    expect(container.querySelector('[data-part="art"]')).toHaveClass(
      "max-w-[480px]",
    );
  });

  it("renders the steps as a numbered ordered list", () => {
    render(
      <IllustratedEmptyState
        image={IMAGE}
        title="t"
        description="d"
        steps={["Uno", "Dos", "Tres"]}
      />,
    );

    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "1Uno",
      "2Dos",
      "3Tres",
    ]);
  });

  // Phase 8 H4-T2 (user decision 2026-10-20): the notebooks hub keeps the
  // calendar's glow and blob around a smaller art, on a dotted
  // notebook-paper field, and enters as a short cascade.
  describe("hub options", () => {
    afterEach(() => {
      reduced.value = false;
    });

    function renderHub() {
      return render(
        <IllustratedEmptyState
          artSize="sm"
          entrance="cascade"
          paper
          image={IMAGE}
          title="t"
          description="d"
          steps={["Uno", "Dos"]}
          action={<a href="/x">Crear</a>}
        />,
      );
    }

    it("keeps the glow and the blob around a 400px art on the dotted paper", () => {
      const { container } = renderHub();

      const root = container.querySelector(
        '[data-slot="illustrated-empty-state"]',
      );
      expect(root).toHaveClass("empty-state-glow", "dotted-paper");
      expect(root).toHaveAttribute("data-surface", "paper");
      const art = container.querySelector('[data-part="art"]');
      expect(art).toHaveClass("illustration-backdrop", "max-w-[400px]");
      expect(art).not.toHaveClass("rounded-3xl");
      expect(container.querySelector("img")).toHaveAttribute(
        "sizes",
        "(min-width: 768px) 400px, 90vw",
      );
    });

    it("cascades art, title, message, each step and the action in order", () => {
      const { container } = renderHub();

      const parts = [
        container.querySelector('[data-part="art"]'),
        container.querySelector("h3"),
        container.querySelector("p"),
        ...container.querySelectorAll("li"),
        container.querySelector('[data-part="action"]'),
      ] as HTMLElement[];
      const delays = parts.map((part) => {
        expect(JSON.parse(part.dataset.initial ?? "null")).toEqual({
          opacity: 0,
          y: 10,
        });
        const transition = JSON.parse(part.dataset.transition ?? "{}");
        expect(transition.ease).toEqual([0.16, 1, 0.3, 1]);
        return transition.delay + transition.duration;
      });
      expect(delays).toEqual([...delays].sort((a, b) => a - b));
      expect(Math.max(...delays)).toBeLessThanOrEqual(0.7);
    });

    it("keeps `initial` and only zeroes the transitions under reduced motion", () => {
      reduced.value = true;
      const { container } = renderHub();

      for (const part of [
        container.querySelector('[data-part="art"]'),
        container.querySelector("h3"),
        ...container.querySelectorAll("li"),
      ] as HTMLElement[]) {
        expect(JSON.parse(part.dataset.initial ?? "null")).toEqual({
          opacity: 0,
          y: 10,
        });
        expect(JSON.parse(part.dataset.transition ?? "{}")).toEqual({
          duration: 0,
        });
      }
    });
  });

  it("keeps the calendar's single block entrance", () => {
    const { container } = render(
      <IllustratedEmptyState image={IMAGE} title="t" description="d" />,
    );

    const root = container.querySelector(
      '[data-slot="illustrated-empty-state"]',
    ) as HTMLElement;
    expect(root).toHaveAttribute("data-entrance", "block");
    expect(root).not.toHaveAttribute("data-surface");
    expect(root).not.toHaveClass("dotted-paper");
    expect(JSON.parse(root.dataset.transition ?? "{}")).toEqual({
      type: "spring",
      bounce: 0,
      visualDuration: 0.5,
    });
    expect(container.querySelector("h3")).not.toHaveAttribute("data-initial");
  });
});
