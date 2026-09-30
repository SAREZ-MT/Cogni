import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

const icon = <span data-testid="icon" />;

describe("EmptyState", () => {
  it("renders the icon, an h2 title and the description", () => {
    render(
      <EmptyState icon={icon} title="Sin cuadernos" description="Crea uno" />,
    );

    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Sin cuadernos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Crea uno")).toBeInTheDocument();
  });

  it("omits the description paragraph when none is given", () => {
    const { container } = render(<EmptyState icon={icon} title="Vacío" />);

    expect(container.querySelector("p")).toBeNull();
  });

  it("renders the action slot", () => {
    render(
      <EmptyState
        icon={icon}
        title="Vacío"
        action={<button type="button">Crear</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Crear" })).toBeInTheDocument();
  });

  it("renders the title with a custom heading element", () => {
    render(<EmptyState icon={icon} title="Todo al día" titleAs="h3" />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Todo al día" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("renders the root as a custom element", () => {
    const { container } = render(
      <EmptyState icon={icon} title="Vacío" as="section" />,
    );

    expect(container.firstElementChild?.tagName).toBe("SECTION");
  });

  it("renders a div root by default", () => {
    const { container } = render(<EmptyState icon={icon} title="Vacío" />);

    expect(container.firstElementChild?.tagName).toBe("DIV");
  });

  it("defaults to the dashed variant", () => {
    const { container } = render(<EmptyState icon={icon} title="Vacío" />);

    expect(container.firstElementChild).toHaveClass("border-dashed");
  });

  it.each([
    ["plain", "gap-3"],
    ["dashed", "border-dashed"],
    ["tinted", "bg-neutral-50"],
    ["success", "bg-success-50"],
  ] as const)("maps the %s variant", (variant, expected) => {
    const { container } = render(
      <EmptyState icon={icon} title="Vacío" variant={variant} />,
    );

    expect(container.firstElementChild).toHaveClass(expected);
  });

  it("has no border for the plain variant", () => {
    const { container } = render(
      <EmptyState icon={icon} title="Vacío" variant="plain" />,
    );

    expect(container.firstElementChild).not.toHaveClass("border");
  });

  it("fills the remaining height only with fill", () => {
    const { container, rerender } = render(
      <EmptyState icon={icon} title="Vacío" />,
    );
    expect(container.firstElementChild).not.toHaveClass("flex-1");

    rerender(<EmptyState icon={icon} title="Vacío" fill />);
    expect(container.firstElementChild).toHaveClass("flex-1");
  });

  it("forwards className, titleClassName and descriptionClassName", () => {
    const { container } = render(
      <EmptyState
        icon={icon}
        title="T"
        description="D"
        className="root-x"
        titleClassName="title-x"
        descriptionClassName="desc-x"
      />,
    );

    expect(container.firstElementChild).toHaveClass("root-x");
    expect(screen.getByRole("heading")).toHaveClass("title-x");
    expect(screen.getByText("D")).toHaveClass("desc-x");
  });
});
