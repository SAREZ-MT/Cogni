import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "./page";

describe("LoginPage", () => {
  it("renders labelled email and password fields with a submit button", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "type",
      "email",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "type",
      "password",
    );
    expect(
      screen.getByRole("button", { name: "Iniciar sesión" }),
    ).toHaveAttribute("type", "submit");
  });

  it("never falls back to a GET submission", () => {
    const { container } = render(<LoginPage />);
    const form = container.querySelector("form");

    expect(form).not.toBeNull();
    expect(form?.getAttribute("method")).not.toBe("get");
    expect(form?.getAttribute("action")).not.toBeNull();
  });
});
