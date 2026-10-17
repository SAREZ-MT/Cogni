import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RegisterPage from "./page";

describe("RegisterPage", () => {
  it("says the terms are accepted right after creating the account, with a link to them", () => {
    render(<RegisterPage />);

    expect(
      screen.getByText(/Al crear tu cuenta aceptarás los/),
    ).toBeInTheDocument();
    expect(screen.getByText(/en el siguiente paso/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "términos de uso" }),
    ).toHaveAttribute("href", "/terminos");
  });

  it("tells the password rule before the form is sent", () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText("Contraseña")).toHaveAccessibleDescription(
      "Mínimo 8 caracteres",
    );
  });

  it("sells the product in the subtitle and still mentions the verification email", () => {
    render(<RegisterPage />);

    expect(
      screen.getByText(/Empieza a estudiar con IA en minutos/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Te enviaremos un correo/)).toBeInTheDocument();
  });
});
