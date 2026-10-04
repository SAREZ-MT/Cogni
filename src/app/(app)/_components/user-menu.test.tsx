import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { UserMenu } from "./user-menu";

const USER = { id: "u1", email: "jane.doe@example.com" };

describe("UserMenu", () => {
  it("is closed by default", () => {
    render(<UserMenu user={USER} />);

    expect(
      screen.getByRole("button", { name: "Menú de usuario" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders a gradient avatar trigger with the user's initials", () => {
    render(<UserMenu user={USER} />);

    const trigger = screen.getByRole("button", { name: "Menú de usuario" });
    expect(trigger).toHaveClass("avatar-gradient");
    expect(trigger).toHaveTextContent("JD");
  });

  it("falls back to generic initials without an email", () => {
    render(<UserMenu user={{ id: "u1", email: null }} />);

    expect(
      screen.getByRole("button", { name: "Menú de usuario" }),
    ).toHaveTextContent("CU");
  });

  it("opens on click and offers sign-out", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} />);

    await user.click(screen.getByRole("button", { name: "Menú de usuario" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });

  it("links to the terms of use from the menu", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} />);

    await user.click(screen.getByRole("button", { name: "Menú de usuario" }));

    expect(
      screen.getByRole("menuitem", { name: "Términos de uso" }),
    ).toHaveAttribute("href", "/terminos");
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={USER} />);

    await user.click(screen.getByRole("button", { name: "Menú de usuario" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
