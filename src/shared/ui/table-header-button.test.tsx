import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TableHeaderButton } from "./table-header-button";

describe("TableHeaderButton", () => {
  it("is a keyboard-reachable button named by its label", () => {
    render(<TableHeaderButton onClick={() => {}}>Brecha</TableHeaderButton>);

    const button = screen.getByRole("button", { name: "Brecha" });
    expect(button).toHaveAttribute("type", "button");
  });

  it("calls onClick on click and on Enter", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<TableHeaderButton onClick={onClick}>Brecha</TableHeaderButton>);

    await user.click(screen.getByRole("button"));
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("highlights only the active column", () => {
    const { rerender } = render(
      <TableHeaderButton onClick={() => {}}>Brecha</TableHeaderButton>,
    );
    expect(screen.getByRole("button")).not.toHaveClass("text-fg");

    rerender(
      <TableHeaderButton direction="asc" onClick={() => {}}>
        Brecha
      </TableHeaderButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("text-fg");
  });

  it("swaps the icon with the sort direction", () => {
    const { rerender } = render(
      <TableHeaderButton onClick={() => {}}>Brecha</TableHeaderButton>,
    );
    const icon = () => screen.getByRole("button").querySelector("svg");
    expect(icon()).toHaveClass("lucide-chevrons-up-down");

    rerender(
      <TableHeaderButton direction="asc" onClick={() => {}}>
        Brecha
      </TableHeaderButton>,
    );
    expect(icon()).toHaveClass("lucide-arrow-up");

    rerender(
      <TableHeaderButton direction="desc" onClick={() => {}}>
        Brecha
      </TableHeaderButton>,
    );
    expect(icon()).toHaveClass("lucide-arrow-down");
    expect(icon()).toHaveAttribute("aria-hidden", "true");
  });

  it("merges className", () => {
    render(
      <TableHeaderButton onClick={() => {}} className="ml-auto">
        x
      </TableHeaderButton>,
    );

    expect(screen.getByRole("button")).toHaveClass("ml-auto");
  });
});
