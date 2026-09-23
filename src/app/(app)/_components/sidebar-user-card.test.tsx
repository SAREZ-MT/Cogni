import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SidebarUserCard } from "./sidebar-user-card";

describe("SidebarUserCard", () => {
  it("shows initials derived from the email and a caption", () => {
    render(
      <SidebarUserCard user={{ id: "u1", email: "jane.doe@example.com" }} />,
    );

    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText(/Jane/)).toBeInTheDocument();
    expect(screen.getByText("Plan gratuito")).toBeInTheDocument();
  });

  // R3-fallback-initials-test-mismatch: the previous version of this test
  // claimed "single-letter initials" in its title without ever asserting
  // them; initialsFrom's actual fallback for a one-word label is the first
  // two letters ("Cuenta" -> "CU"), so this now asserts the real output.
  it("falls back to a generic label and two-letter initials without an email", () => {
    render(<SidebarUserCard user={{ id: "u1", email: null }} />);

    expect(screen.getByText("Cuenta")).toBeInTheDocument();
    expect(screen.getByText("CU")).toBeInTheDocument();
  });

  it("opens the same sign-out menu as the topbar from its own trigger", async () => {
    const user = userEvent.setup();
    render(
      <SidebarUserCard user={{ id: "u1", email: "jane.doe@example.com" }} />,
    );

    const trigger = screen.getByRole("button", {
      name: "Opciones de la cuenta",
    });
    await user.click(trigger);

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });

  it("does not collide with the topbar's 'Menú de usuario' accessible name", () => {
    render(
      <SidebarUserCard user={{ id: "u1", email: "jane.doe@example.com" }} />,
    );

    expect(
      screen.queryByRole("button", { name: "Menú de usuario" }),
    ).not.toBeInTheDocument();
  });

  // R3-collapsed-card-test-no-assertion: hovered but never asserted the
  // tooltip content actually appeared.
  it("renders an avatar-only trigger with a tooltip when collapsed", async () => {
    const user = userEvent.setup();
    render(
      <SidebarUserCard
        user={{ id: "u1", email: "jane.doe@example.com" }}
        collapsed
      />,
    );

    expect(screen.queryByText("Plan gratuito")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", {
      name: "Opciones de la cuenta",
    });
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getAllByText("Jane.doe").length).toBeGreaterThan(0);
    });
  });

  // R3-collapsed-card-unreachable: the collapsed trigger used to be a
  // non-focusable <span>, unreachable by keyboard. It must now be a real
  // button that opens the same account menu as the expanded state.
  it("opens the account menu from the collapsed trigger via keyboard", async () => {
    const user = userEvent.setup();
    render(
      <SidebarUserCard
        user={{ id: "u1", email: "jane.doe@example.com" }}
        collapsed
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Opciones de la cuenta",
    });
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });
});
