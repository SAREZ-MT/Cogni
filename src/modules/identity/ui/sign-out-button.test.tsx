import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./sign-out-button";

// specs/identity-auth/spec.md, "Cierre de sesión", Scenario "Error al
// cerrar sesión no se oculta": the UI must not assume the session ended
// when signOutAction reports a Supabase error.
const { signOutAction } = vi.hoisted(() => ({ signOutAction: vi.fn() }));
vi.mock("../actions", () => ({ signOutAction }));

describe("SignOutButton", () => {
  beforeEach(() => {
    signOutAction.mockReset();
  });

  it("shows the Supabase error instead of hiding it as a closed session", async () => {
    signOutAction.mockResolvedValue({
      status: "error",
      message:
        "No pudimos completar la acción. Inténtalo de nuevo en unos minutos.",
    });
    const user = userEvent.setup();
    render(<SignOutButton />);

    await user.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos completar la acción",
    );
  });

  it("calls signOutAction once and shows no error on success", async () => {
    signOutAction.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SignOutButton />);

    await user.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));

    expect(signOutAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
