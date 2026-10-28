import { render, screen, within } from "@testing-library/react";
import { motionValue } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hero } from "./hero";
import { HeroNetwork } from "./hero-network-canvas";
import { HERO_SENTENCE, HERO_WORDS } from "./hero-timeline";

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver ??=
  IntersectionObserverStub as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Hero", () => {
  it("names the scene with the static headline", () => {
    mockReducedMotion(false);
    render(<Hero />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Recuerda lo que estudias.");
    expect(
      screen.getByRole("region", { name: "Recuerda lo que estudias." }),
    ).toBeInTheDocument();
  });

  it("gives assistive tech the full sentence once, and hides the word spans", () => {
    mockReducedMotion(false);
    const { container } = render(<Hero />);
    expect(screen.getByText(HERO_SENTENCE)).toHaveClass("sr-only");
    const words = container.querySelectorAll("[data-word]");
    expect(Array.from(words, (w) => w.textContent)).toEqual(HERO_WORDS);
    for (const word of words) {
      expect(word.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("offers both actions, reachable as plain links", () => {
    mockReducedMotion(false);
    const { container } = render(<Hero />);
    const actions = container.querySelector<HTMLElement>(
      '[data-part="hero-actions"]',
    );
    if (!actions) throw new Error("hero actions not rendered");
    expect(
      within(actions).getByRole("link", { name: /Empieza gratis/ }),
    ).toHaveAttribute("href", "/register");
    expect(
      within(actions).getByRole("link", { name: /Ver cómo funciona/ }),
    ).toHaveAttribute("href", "#como-funciona");
    expect(
      screen.getByText(/Cogni convierte tus apuntes en flashcards/),
    ).toBeInTheDocument();
  });
});

describe("HeroNetwork", () => {
  it("starts empty while the scroll has not begun", () => {
    mockReducedMotion(false);
    const { container } = render(<HeroNetwork progress={motionValue(0)} />);
    const icons = container.querySelectorAll<HTMLElement>("[data-net-icon]");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.style.opacity).toBe("0");
  });

  it("shows the complete, static network under reduced motion", () => {
    mockReducedMotion(true);
    const { container } = render(<HeroNetwork progress={motionValue(0)} />);
    const icons = container.querySelectorAll<HTMLElement>("[data-net-icon]");
    for (const icon of icons) expect(icon.style.opacity).toBe("1");
  });
});
