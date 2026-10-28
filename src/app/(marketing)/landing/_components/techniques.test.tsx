import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TECHNIQUES, Techniques } from "./techniques";

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const NAMES = [
  "Flashcards",
  "Recuperación activa",
  "Exámenes",
  "La IA prepara, tú decides",
];

function panel(name: string) {
  return screen.getByRole("region", { name });
}

describe("Techniques", () => {
  it("is a light section named by its full headline", () => {
    render(<Techniques />);
    const section = panel("Una técnica para cada momento.");
    expect(section).toHaveAttribute("id", "tecnicas");
    expect(section).toHaveAttribute("data-nav-theme", "light");
  });

  it("sets exactly one keyword of the headline in the serif italic", () => {
    render(<Techniques />);
    const heading = screen.getByRole("heading", { level: 2 });
    const accents = heading.querySelectorAll("em");
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent("momento");
  });

  it("holds a mint cards object in the headline, or a supplied image", () => {
    const { unmount } = render(<Techniques />);
    const slot = screen
      .getByRole("heading", { level: 2 })
      .querySelector('[data-glyph="cards"]');
    expect(slot).toHaveAttribute("data-tone", "mint");
    unmount();

    render(
      <Techniques
        image={{ src: "/landing/techniques-object.webp", alt: "" }}
      />,
    );
    const img = screen.getByRole("heading", { level: 2 }).querySelector("img");
    expect(img?.getAttribute("src")).toContain("techniques-object");
  });

  it("gives every technique its own region with title, benefit and points", () => {
    render(<Techniques />);
    expect(TECHNIQUES.map((technique) => technique.name)).toEqual(NAMES);
    for (const technique of TECHNIQUES) {
      const region = panel(technique.name);
      expect(
        within(region).getByRole("heading", { level: 3 }),
      ).toHaveAccessibleName(technique.name);
      expect(region).toHaveTextContent(technique.benefit);
      const points = within(region).getAllByRole("listitem");
      expect(points.length).toBeGreaterThanOrEqual(2);
      expect(points.length).toBeLessThanOrEqual(3);
      expect(points.map((point) => point.textContent)).toEqual(
        technique.points,
      );
    }
  });

  it("alternates the side of each technique's visual", () => {
    render(<Techniques />);
    const sides = NAMES.map((name) => panel(name).getAttribute("data-visual"));
    expect(sides).toEqual(["left", "right", "left", "right"]);
  });

  it("uses the platform technique tones", () => {
    render(<Techniques />);
    expect(NAMES.map((name) => panel(name).getAttribute("data-tone"))).toEqual([
      "yellow",
      "mint",
      "red",
      "violet",
    ]);
  });

  it("renders a supplied illustration in a technique's visual slot", () => {
    render(
      <Techniques
        art={{
          recall: { src: "/landing/technique-recall.webp", alt: "Ilustración" },
        }}
      />,
    );
    const img = within(panel("Recuperación activa")).getByRole("img", {
      name: "Ilustración",
    });
    expect(img.getAttribute("src")).toContain("technique-recall");
    expect(
      within(panel("Flashcards")).queryByRole("img"),
    ).not.toBeInTheDocument();
  });

  it("shows a decorative 01–04 progress indicator", () => {
    render(<Techniques />);
    const indicator = document.querySelector('[data-part="tech-progress"]');
    expect(indicator).toHaveAttribute("aria-hidden", "true");
    expect(
      Array.from(indicator?.querySelectorAll("[data-step]") ?? []).map(
        (step) => step.textContent,
      ),
    ).toEqual(["01", "02", "03", "04"]);
  });
});
