import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubmitButton } from "./submit-button";

describe("SubmitButton", () => {
  it("renders an enabled submit button keeping its accessible name", () => {
    render(
      <form>
        <SubmitButton>Iniciar sesión</SubmitButton>
      </form>,
    );

    const button = screen.getByRole("button", { name: "Iniciar sesión" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy", "true");
  });

  it("disables itself and shows a spinner while pending", () => {
    render(
      <form>
        <SubmitButton pending>Iniciar sesión</SubmitButton>
      </form>,
    );

    const button = screen.getByRole("button", { name: "Iniciar sesión" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull();
  });
});
