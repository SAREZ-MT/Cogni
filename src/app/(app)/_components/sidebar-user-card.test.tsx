import { render, screen } from "@testing-library/react";
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

  it("falls back to a generic label and single-letter initials without an email", () => {
    render(<SidebarUserCard user={{ id: "u1", email: null }} />);

    expect(screen.getByText("Cuenta")).toBeInTheDocument();
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

  it("renders an avatar-only trigger with a tooltip when collapsed", async () => {
    const user = userEvent.setup();
    render(
      <SidebarUserCard
        user={{ id: "u1", email: "jane.doe@example.com" }}
        collapsed
      />,
    );

    expect(screen.queryByText("Plan gratuito")).not.toBeInTheDocument();
    const avatar = screen.getByText("JD");
    await user.hover(avatar);
  });
});
