import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignInForm } from "@/modules/identity/ui";

describe("SignInForm", () => {
  it("renders labelled email and password fields with a submit button", () => {
    render(<SignInForm />);

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

  it("binds the form to a Server Action so it never submits with GET", () => {
    const { container } = render(<SignInForm />);
    const form = container.querySelector("form");

    expect(form?.getAttribute("method")).not.toBe("get");
    expect(form?.getAttribute("action")).toBeTruthy();
  });
});
