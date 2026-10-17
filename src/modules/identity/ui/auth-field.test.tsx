import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AuthField } from "./auth-field";

describe("AuthField", () => {
  it("links a hint to the input so screen readers announce it", () => {
    render(
      <AuthField
        label="Contraseña"
        name="password"
        hint="Mínimo 8 caracteres"
      />,
    );

    expect(screen.getByLabelText("Contraseña")).toHaveAccessibleDescription(
      "Mínimo 8 caracteres",
    );
  });

  it("lets a password be shown and hidden again", async () => {
    const user = userEvent.setup();
    render(<AuthField label="Contraseña" name="password" type="password" />);
    const input = screen.getByLabelText("Contraseña");

    expect(input).toHaveAttribute("type", "password");
    await user.click(
      screen.getByRole("button", { name: "Mostrar contraseña" }),
    );
    expect(input).toHaveAttribute("type", "text");
    await user.click(
      screen.getByRole("button", { name: "Ocultar contraseña" }),
    );
    expect(input).toHaveAttribute("type", "password");
  });

  it("offers no visibility toggle on non-password fields", () => {
    render(<AuthField label="Correo electrónico" name="email" type="email" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
