import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  TechniqueHubFilter,
  TechniqueHubGroupTitle,
} from "./technique-hub-filter";

const chips = [
  {
    key: "all",
    label: "Todos",
    count: 3,
    href: "/exams",
    active: false,
    tone: null,
  },
  {
    key: "n1",
    label: "Cuaderno 1",
    count: 2,
    href: "/exams?cuaderno=n1",
    active: true,
    tone: "green",
  },
  {
    key: "n2",
    label: "Cuaderno 2",
    count: 1,
    href: "/exams?cuaderno=n2",
    active: false,
    tone: "not-a-colour",
  },
];

// Phase 8 H17: the notebook filter row of the technique hubs.
describe("TechniqueHubFilter", () => {
  it("is a navigation of chip links with their counts", () => {
    render(<TechniqueHubFilter chips={chips} />);

    const nav = screen.getByRole("navigation", {
      name: "Filtrar por cuaderno",
    });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Todos3",
      "Cuaderno 12",
      "Cuaderno 21",
    ]);
    expect(links[1]).toHaveAttribute("href", "/exams?cuaderno=n1");
  });

  it("marks only the active chip as the current page, in the technique's soft colours", () => {
    render(<TechniqueHubFilter chips={chips} />);

    const active = screen.getByRole("link", { current: "page" });
    expect(active).toHaveTextContent("Cuaderno 1");
    expect(active).toHaveClass("bg-(--theme-soft)");
    expect(screen.getByRole("link", { name: /Todos/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("draws each notebook's colour dot, violet for an unknown colour, none for Todos", () => {
    render(<TechniqueHubFilter chips={chips} />);

    const dot = (name: RegExp) =>
      screen.getByRole("link", { name }).querySelector("[aria-hidden]");
    expect(dot(/Todos/)).toBeNull();
    expect(dot(/Cuaderno 1/)).toHaveClass("bg-emerald-400");
    expect(dot(/Cuaderno 2/)).toHaveClass("bg-primary-500");
  });

  it("scrolls sideways instead of wrapping", () => {
    render(<TechniqueHubFilter chips={chips} />);
    expect(screen.getByRole("navigation")).toHaveClass("overflow-x-auto");
  });
});

describe("TechniqueHubGroupTitle", () => {
  it("is a heading with its count in the technique ink", () => {
    render(<TechniqueHubGroupTitle label="Para hoy" count={3} />);

    const heading = screen.getByRole("heading", { name: "Para hoy 3" });
    expect(heading).toHaveClass("uppercase");
    expect(within(heading).getByText("3")).toHaveClass("text-(--theme-ink)");
  });
});
