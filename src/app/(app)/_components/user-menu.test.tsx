import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  it("is closed by default", () => {
    render(<UserMenu />);

    expect(
      screen.getByRole("button", { name: "Menú de usuario" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens on click and offers sign-out", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByRole("button", { name: "Menú de usuario" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByRole("button", { name: "Menú de usuario" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
