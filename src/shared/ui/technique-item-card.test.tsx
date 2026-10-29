import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Layers, RotateCcw } from "lucide-react";
import Link from "next/link";
import { describe, expect, it } from "vitest";
import { DropdownMenuItem } from "./dropdown-menu";
import {
  TechniqueItemCard,
  TechniqueItemCheck,
  TechniqueItemPill,
} from "./technique-item-card";

const baseProps = {
  technique: "flashcards",
  href: "/flashcards/n1/p1?repasar=1&desde=hub",
  notebook: { title: "Cuaderno 1", tone: "yellow" },
  title: "Tema 1",
  metric: { icon: Layers, value: 12, unit: "tarjetas" },
  status: <TechniqueItemPill>3 para hoy</TechniqueItemPill>,
  action: { label: "Repasar" },
} as const;

// Phase 8 H17 (user-approved flat hubs, 2026-10-29): one card per
// generated item in the three technique hubs, themed by the technique.
describe("TechniqueItemCard", () => {
  it("is an article themed by the technique whose action link covers the card", () => {
    render(<TechniqueItemCard {...baseProps} />);

    const article = screen.getByRole("article");
    expect(article).toHaveAttribute("data-slot", "technique-item-card");
    expect(article).toHaveAttribute("data-technique-theme", "flashcards");
    const link = within(article).getByRole("link", {
      name: "Repasar: Tema 1",
    });
    expect(link).toHaveAttribute(
      "href",
      "/flashcards/n1/p1?repasar=1&desde=hub",
    );
    expect(link).toHaveClass("after:absolute", "after:inset-0");
  });

  it("shows the notebook label, the title clamped to two lines with its full text in a tooltip, and the metric", () => {
    render(
      <TechniqueItemCard
        {...baseProps}
        title="Unidad 2: un título muy largo que no cabe en dos líneas"
      />,
    );

    expect(screen.getByText("Cuaderno 1")).toBeInTheDocument();
    const title = screen.getByRole("heading", {
      name: "Unidad 2: un título muy largo que no cabe en dos líneas",
    });
    expect(title).toHaveClass("line-clamp-2");
    expect(title).toHaveAttribute(
      "title",
      "Unidad 2: un título muy largo que no cabe en dos líneas",
    );
    const metric = screen.getByTestId("technique-item-metric");
    expect(metric).toHaveTextContent("12 tarjetas");
    expect(screen.getByText("3 para hoy")).toBeInTheDocument();
  });

  it("colours the notebook label and falls back to violet without a colour", () => {
    const { rerender } = render(<TechniqueItemCard {...baseProps} />);
    expect(screen.getByTestId("technique-item-notebook")).toHaveAttribute(
      "data-tone",
      "yellow",
    );

    rerender(
      <TechniqueItemCard
        {...baseProps}
        notebook={{ title: "Cuaderno 1", tone: null }}
      />,
    );
    expect(screen.getByTestId("technique-item-notebook")).toHaveAttribute(
      "data-tone",
      "purple",
    );
  });

  it("fills the action only when the emphasis is primary; soft by default", () => {
    const { rerender } = render(<TechniqueItemCard {...baseProps} />);
    expect(screen.getByRole("link")).toHaveAttribute("data-emphasis", "soft");

    rerender(
      <TechniqueItemCard
        {...baseProps}
        emphasis="primary"
        action={{ label: "Repetir examen", icon: RotateCcw }}
      />,
    );
    const link = screen.getByRole("link", { name: "Repetir examen: Tema 1" });
    expect(link).toHaveAttribute("data-emphasis", "primary");
    expect(link).toHaveClass("bg-(--theme-cta)");
  });

  it("draws a progress bar only when a progress is given", () => {
    const { rerender } = render(<TechniqueItemCard {...baseProps} />);
    expect(screen.queryByRole("progressbar")).toBeNull();

    rerender(<TechniqueItemCard {...baseProps} progress={64} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "64",
    );
  });

  it("rises on hover with the card-hover shadow, and never moves under reduced motion", () => {
    render(<TechniqueItemCard {...baseProps} />);

    const article = screen.getByRole("article");
    expect(article).toHaveClass(
      "hover:-translate-y-0.5",
      "hover:shadow-card-hover",
      "hover:border-(--theme-soft-edge)",
      "motion-reduce:hover:translate-y-0",
    );
  });

  it("opens its menu from a kebab named after the item, above the stretched link", async () => {
    const user = userEvent.setup();
    render(
      <TechniqueItemCard
        {...baseProps}
        menu={
          <DropdownMenuItem asChild>
            <Link href="/notebooks/n1/pages/p1">Abrir página</Link>
          </DropdownMenuItem>
        }
      />,
    );

    const kebab = screen.getByRole("button", { name: "Acciones de Tema 1" });
    expect(kebab.parentElement).toHaveClass("relative", "z-10");
    await user.click(kebab);
    expect(
      await screen.findByRole("menuitem", { name: "Abrir página" }),
    ).toHaveAttribute("href", "/notebooks/n1/pages/p1");
  });

  it("has no kebab without a menu", () => {
    render(<TechniqueItemCard {...baseProps} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("TechniqueItemCheck", () => {
  it("is the success tick and label of an up-to-date item", () => {
    render(<TechniqueItemCheck>Al día</TechniqueItemCheck>);
    expect(screen.getByText("Al día")).toHaveClass("text-success-600");
  });
});
