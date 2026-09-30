import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionHeader, SectionTitle } from "./section-header";

describe("SectionHeader", () => {
  it("renders the title as the page h1", () => {
    render(<SectionHeader title="Mis cuadernos" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Mis cuadernos" }),
    ).toBeInTheDocument();
  });

  it("omits the eyebrow, description and actions when absent", () => {
    const { container } = render(<SectionHeader title="Solo título" />);

    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the eyebrow and description around the title", () => {
    render(
      <SectionHeader
        eyebrow="Biblioteca"
        title="Cuadernos"
        description="Todo tu material"
      />,
    );

    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Todo tu material")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("mt-1");
  });

  it("does not add the eyebrow spacing to the title without an eyebrow", () => {
    render(<SectionHeader title="Cuadernos" />);

    expect(screen.getByRole("heading", { level: 1 })).not.toHaveClass("mt-1");
  });

  it("renders the actions slot", () => {
    render(
      <SectionHeader
        title="Cuadernos"
        actions={<button type="button">Nuevo</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Nuevo" })).toBeInTheDocument();
  });

  it("renders the leading icon before the title", () => {
    render(
      <SectionHeader title="Cuaderno" icon={<span data-testid="icon" />} />,
    );

    const icon = screen.getByTestId("icon");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(
      icon.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(icon.parentElement).toContainElement(heading);
  });

  it("keeps the title directly in the root row without an icon", () => {
    const { container } = render(<SectionHeader title="Cuadernos" />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.firstElementChild).toContainElement(
      screen.getByRole("heading", { level: 1 }),
    );
    expect(root.querySelector(".gap-3")).toBeNull();
  });

  it("forwards className, titleClassName and descriptionClassName", () => {
    const { container } = render(
      <SectionHeader
        title="T"
        description="D"
        className="root-x"
        titleClassName="text-xl"
        descriptionClassName="desc-x"
      />,
    );

    expect(container.firstElementChild).toHaveClass("root-x");
    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveClass("text-xl");
    expect(title).not.toHaveClass("text-2xl");
    expect(screen.getByText("D")).toHaveClass("desc-x");
  });
});

describe("SectionTitle", () => {
  it("renders a plain h2 without an action", () => {
    render(<SectionTitle>Recientes</SectionTitle>);

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Recientes",
    });
    expect(heading).toHaveClass("text-sm");
    expect(heading.parentElement).toBe(document.body.firstElementChild);
  });

  it("renders the heading and action in one row when an action is given", () => {
    render(
      <SectionTitle action={<a href="/notebooks">Ver todos</a>}>
        Mis cuadernos
      </SectionTitle>,
    );

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Mis cuadernos",
    });
    const link = screen.getByRole("link", { name: "Ver todos" });
    expect(heading).toHaveClass("text-base");
    expect(heading).not.toHaveClass("text-sm");
    expect(heading.parentElement).toBe(link.parentElement);
  });

  it("forwards className and props to the heading in both shapes", () => {
    const { rerender } = render(
      <SectionTitle className="x" id="a">
        T
      </SectionTitle>,
    );
    expect(screen.getByRole("heading")).toHaveClass("x");
    expect(screen.getByRole("heading")).toHaveAttribute("id", "a");

    rerender(
      <SectionTitle className="x" id="a" action={<span>acción</span>}>
        T
      </SectionTitle>,
    );
    expect(screen.getByRole("heading")).toHaveClass("x");
    expect(screen.getByRole("heading")).toHaveAttribute("id", "a");
  });
});
