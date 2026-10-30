import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarReviewCard } from "./calendar-review-card";

const PROPS = {
  href: "/notebooks/n1/pages/p1",
  tone: "rose",
  title:
    "Mitocondria y respiración celular, una página con un título muy largo",
  detail: "Biología celular",
  techniqueLabel: "Examen",
  "aria-label": "Examen de Mitocondria: 2 ítems",
} as const;

describe("CalendarReviewCard", () => {
  it("links to the page, named by technique, page and amount", () => {
    render(<CalendarReviewCard {...PROPS} />);

    const card = screen.getByRole("link", {
      name: "Examen de Mitocondria: 2 ítems",
    });
    expect(card).toHaveAttribute("href", "/notebooks/n1/pages/p1");
    expect(card).toHaveAttribute("data-slot", "calendar-review-card");
  });

  it("has one fixed height: the title on its own line, the notebook and a never-wrapping pill on the line below", () => {
    render(<CalendarReviewCard {...PROPS} />);

    const card = screen.getByRole("link");
    expect(card).toHaveClass("h-[60px]");
    const title = card.querySelector('[data-part="title"]');
    expect(title).toHaveClass("truncate");
    expect(title).toHaveAttribute("title", PROPS.title);
    const detail = card.querySelector('[data-part="detail"]');
    expect(detail).toHaveClass("truncate");
    expect(detail).toHaveAttribute("title", "Biología celular");
    const pill = card.querySelector('[data-slot="technique-status-pill"]');
    expect(pill).toHaveTextContent("Examen");
    expect(pill).toHaveAttribute("data-size", "sm");
    expect(pill).toHaveClass("shrink-0", "whitespace-nowrap");
    // The pill sits under the title, beside the notebook, so the title keeps
    // the card's full width.
    const meta = card.querySelector('[data-part="meta"]');
    expect(meta).toContainElement(detail as HTMLElement);
    expect(meta).toContainElement(pill as HTMLElement);
    expect(meta).not.toContainElement(title as HTMLElement);
  });

  it("marks the technique with an accent bar on the left", () => {
    render(<CalendarReviewCard {...PROPS} />);
    const bar = screen.getByRole("link").querySelector('[data-part="accent"]');
    expect(bar).toHaveClass("bg-technique-exam-accent", "w-[3px]");
    expect(bar).toHaveAttribute("aria-hidden", "true");
  });

  it("lifts gently on hover and focus, violet-tinted, only the colours under reduced motion", () => {
    render(<CalendarReviewCard {...PROPS} />);
    const card = screen.getByRole("link");
    expect(card).toHaveClass(
      "hover:border-primary-300",
      "hover:bg-primary-100/60",
      "focus-visible:border-primary-300",
      "motion-safe:hover:-translate-y-0.5",
      "motion-safe:focus-visible:-translate-y-0.5",
      "duration-200",
      "ease-out",
    );
    // The size never changes: the lift is a transform, the height is fixed.
    expect(card).toHaveClass("h-[60px]");
    expect(card.className).not.toMatch(/hover:(h-|py-|border-2)/);
  });
});
