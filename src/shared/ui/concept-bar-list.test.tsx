import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConceptBarList } from "./concept-bar-list";

const ITEMS = [
  {
    id: "1",
    label: "Perspectiva lineal",
    meta: "Historia · Renacimiento",
    percent: 95,
    href: "/notebooks/h/pages/r",
  },
  {
    id: "2",
    label: "Microtúbulos",
    meta: "Biología · Citoesqueleto",
    percent: 140,
    href: "/notebooks/b/pages/c",
  },
];

describe("ConceptBarList", () => {
  it("renders an ordered, numbered list of links to each concept", () => {
    render(<ConceptBarList items={ITEMS} tone="success" />);

    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/notebooks/h/pages/r",
      "/notebooks/b/pages/c",
    ]);
    expect(screen.getByRole("list").tagName).toBe("OL");
    expect(links[0]).toHaveTextContent("1");
    expect(links[1]).toHaveTextContent("2");
  });

  it("shows label, location and percentage", () => {
    render(<ConceptBarList items={ITEMS} tone="success" />);

    expect(screen.getByText("Perspectiva lineal")).toBeInTheDocument();
    expect(screen.getByText("Historia · Renacimiento")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "95%" })).toBeInTheDocument();
    expect(screen.getAllByText("95%")).toHaveLength(1);
  });

  it("fills the track by percent, clamped to 100", () => {
    const { container } = render(<ConceptBarList items={ITEMS} tone="error" />);

    const fills = container.querySelectorAll<HTMLElement>("[role=img] > span");
    expect(fills[0].style.width).toBe("95%");
    expect(fills[1].style.width).toBe("100%");
  });

  it.each([
    ["success", "bg-success-500"],
    ["error", "bg-error-500"],
  ] as const)("colours the %s tone", (tone, cls) => {
    const { container } = render(<ConceptBarList items={ITEMS} tone={tone} />);

    expect(container.querySelector("[role=img] > span")).toHaveClass(cls);
  });

  it("renders nothing inside the list when empty", () => {
    render(<ConceptBarList items={[]} tone="success" />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
