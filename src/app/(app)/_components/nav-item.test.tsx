import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home } from "lucide-react";
import { describe, expect, it } from "vitest";
import { NavItem } from "./nav-item";

describe("NavItem", () => {
  it("renders a link with the label and icon", () => {
    render(<NavItem href="/" icon={Home} label="Inicio" />);

    const link = screen.getByRole("link", { name: "Inicio" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("marks the active item with aria-current='page'", () => {
    render(<NavItem href="/" icon={Home} label="Inicio" active />);

    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders a disabled entry as non-interactive with a visible 'pronto' pill", () => {
    render(
      <NavItem
        href="/flashcards"
        icon={Home}
        label="Flashcards"
        disabled
        hint="pronto"
      />,
    );

    expect(
      screen.queryByRole("link", { name: /Flashcards/ }),
    ).not.toBeInTheDocument();
    const item = screen.getByText("Flashcards").closest("[aria-disabled]");
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("pronto")).toBeInTheDocument();
  });

  it("collapses to an icon-only link with a tooltip of the label", async () => {
    const user = userEvent.setup();
    render(<NavItem href="/" icon={Home} label="Inicio" collapsed />);

    const link = screen.getByRole("link", { name: "Inicio" });
    expect(link).toBeInTheDocument();
    expect(link.textContent).toBe("");

    await user.hover(link);
    await waitFor(() => {
      expect(screen.getAllByText("Inicio").length).toBeGreaterThan(0);
    });
  });

  it("shows the hint inside the tooltip instead of inline text when collapsed and disabled", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NavItem
        href="/flashcards"
        icon={Home}
        label="Flashcards"
        disabled
        hint="pronto"
        collapsed
      />,
    );

    expect(screen.queryByText("Flashcards")).not.toBeInTheDocument();
    expect(screen.queryByText("pronto")).not.toBeInTheDocument();
    const item = container.querySelector('[aria-disabled="true"]');
    expect(item).toBeInTheDocument();

    await user.hover(item as HTMLElement);
    await waitFor(() => {
      expect(screen.getAllByText(/Flashcards/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/pronto/).length).toBeGreaterThan(0);
    });
  });
});
