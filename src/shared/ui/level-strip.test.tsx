import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LevelStrip, type LevelStripBar } from "./level-strip";

const BARS: LevelStripBar[] = [
  { id: "a", label: "Apoptosis", level: "nuevo", score: 0 },
  { id: "b", label: "Núcleo", level: "dominado", score: 0.91 },
  { id: "c", label: "Ribosomas", level: "consolidando", score: 0.58 },
];

describe("LevelStrip", () => {
  it("summarises the strip for screen readers with the page count", () => {
    render(<LevelStrip bars={BARS} />);

    expect(
      screen.getByRole("img", { name: "Dominio por página: 3 páginas" }),
    ).toBeInTheDocument();
  });

  it("lists page, level and score in each bar's tooltip", () => {
    render(<LevelStrip bars={BARS} />);

    expect(screen.getByText("Núcleo")).toBeInTheDocument();
    expect(screen.getByText("Dominado · 91%")).toBeInTheDocument();
    expect(screen.getByText("Consolidando · 58%")).toBeInTheDocument();
    expect(screen.getByText("Nuevo · 0%")).toBeInTheDocument();
  });

  it("sizes each bar by score with a 6px floor", () => {
    const { container } = render(<LevelStrip bars={BARS} />);

    const heights = Array.from(
      container.querySelectorAll<HTMLElement>("span[aria-hidden][style]"),
    ).map((el) => el.style.height);
    expect(heights).toEqual(["6px", "36px", "23px"]);
  });

  it("colours each bar by its mastery level", () => {
    const { container } = render(<LevelStrip bars={BARS} />);

    const bars = container.querySelectorAll("span[aria-hidden][style]");
    expect(bars[0]).toHaveClass("bg-neutral-200");
    expect(bars[1]).toHaveClass("bg-success-500");
    expect(bars[2]).toHaveClass("bg-info-500");
  });

  it("shows a legend with three levels and omits Nuevo", () => {
    render(<LevelStrip bars={[]} />);

    expect(screen.getByText("Aprendiendo")).toBeInTheDocument();
    expect(screen.getByText("Consolidando")).toBeInTheDocument();
    expect(screen.getByText("Dominado")).toBeInTheDocument();
    expect(screen.queryByText("Nuevo")).not.toBeInTheDocument();
  });

  it("copes with no pages", () => {
    render(<LevelStrip bars={[]} />);

    expect(
      screen.getByRole("img", { name: "Dominio por página: 0 páginas" }),
    ).toBeInTheDocument();
  });
});
