import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BreadcrumbProvider, SetBreadcrumb } from "./breadcrumb";
import { Topbar } from "./topbar";

const USER = { id: "u1", email: "jane.doe@example.com" };

describe("Topbar", () => {
  it("renders as the page banner landmark", () => {
    render(<Topbar user={USER} />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders the breadcrumb trail inside the banner", () => {
    render(
      <BreadcrumbProvider>
        <Topbar user={USER} />
      </BreadcrumbProvider>,
    );

    const banner = screen.getByRole("banner");
    expect(
      screen.getByRole("navigation", { name: "Ruta de navegación" }),
    ).toBeInTheDocument();
    expect(banner).toHaveTextContent("Cogni");
    expect(banner).toHaveTextContent("Inicio");
  });

  it("reflects a route's published crumbs", () => {
    render(
      <BreadcrumbProvider>
        <SetBreadcrumb
          items={[{ label: "Biología Celular" }, { label: "Mitocondria" }]}
        />
        <Topbar user={USER} />
      </BreadcrumbProvider>,
    );

    const banner = screen.getByRole("banner");
    expect(banner).toHaveTextContent("Biología Celular");
    expect(banner).toHaveTextContent("Mitocondria");
  });

  it("renders the user menu trigger as a gradient avatar with initials", () => {
    render(<Topbar user={USER} />);

    const trigger = screen.getByRole("button", { name: "Menú de usuario" });
    expect(trigger).toHaveClass("avatar-gradient");
    expect(trigger).toHaveTextContent("JD");
  });
});
