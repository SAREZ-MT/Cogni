import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TodayReviewRow } from "./today-review-row";

const PROPS = {
  href: "/flashcards/n1/p1?repasar=1",
  "aria-label": "Flashcards de Mitocondria: 8 pendientes",
  tone: "yellow",
  title: "Mitocondria y respiración celular",
  waitingTitle: "Desde ayer",
  waitingDetail: "1 día esperando",
  techniqueLabel: "Flashcards",
  notebookTitle: "Biología celular",
  amountLabel: "8 tarjetas",
} as const;

describe("TodayReviewRow", () => {
  it("is one link named by the technique and page, opening the session", () => {
    render(<TodayReviewRow {...PROPS} data-testid="today-row" />);

    const link = screen.getByRole("link", {
      name: "Flashcards de Mitocondria: 8 pendientes",
    });
    expect(link).toHaveAttribute("href", "/flashcards/n1/p1?repasar=1");
    expect(link).toHaveAttribute("data-slot", "today-review-row");
    expect(link).toHaveAttribute("data-testid", "today-row");
  });

  it("shows the wait, the title, the technique / notebook / amount pills and a Repasar cue", () => {
    render(<TodayReviewRow {...PROPS} />);

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Desde ayer");
    expect(link).toHaveTextContent("1 día esperando");
    expect(link).toHaveTextContent("Mitocondria y respiración celular");
    const pills = link.querySelectorAll('[data-slot="pill"]');
    expect([...pills].map((pill) => pill.textContent)).toEqual([
      "Flashcards",
      "Biología celular",
      "8 tarjetas",
    ]);
    expect(pills[0]).toHaveClass("bg-pastel-yellow");
    expect(pills[1]).toHaveClass("bg-neutral-150");
    // A visual button only: the row itself is the link.
    expect(screen.queryByRole("button")).toBeNull();
    expect(link.querySelector('[data-part="action"]')).toHaveTextContent(
      "Repasar",
    );
  });

  it.each([
    ["green", "bg-pastel-mint", "bg-technique-recall-accent"],
    ["rose", "bg-pastel-pink", "bg-technique-exam-accent"],
  ] as const)("colours a %s row's technique pill and bar", (tone, pill, bar) => {
    render(<TodayReviewRow {...PROPS} tone={tone} />);

    const link = screen.getByRole("link");
    expect(link.querySelector('[data-slot="pill"]')).toHaveClass(pill);
    expect(link.querySelector('[data-part="accent"]')).toHaveClass(bar);
  });

  it("in scheduled mode drops the wait column and Repasar for a muted Programado marker", () => {
    render(
      <TodayReviewRow
        href="/notebooks/n1/pages/p1"
        aria-label="Flashcards de Mitocondria: 8 programados"
        tone="yellow"
        title="Mitocondria"
        techniqueLabel="Flashcards"
        notebookTitle="Biología celular"
        amountLabel="8 tarjetas"
        scheduled
      />,
    );

    const link = screen.getByRole("link", {
      name: "Flashcards de Mitocondria: 8 programados",
    });
    expect(link).toHaveAttribute("data-mode", "scheduled");
    expect(link.querySelector('[data-part="waiting"]')).toBeNull();
    expect(link.querySelector('[data-part="action"]')).toBeNull();
    expect(link.querySelector('[data-part="status"]')).toHaveTextContent(
      "Programado",
    );
  });
});
