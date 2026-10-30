import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AcceptTermsForm } from "./accept-terms-form";

const state = vi.hoisted(() => ({
  current: { status: "idle" } as { status: string; message?: string },
}));

vi.mock("../actions", () => ({ acceptTermsAction: vi.fn() }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [state.current, vi.fn(), false],
  };
});

describe("AcceptTermsForm", () => {
  it("renders a required checkbox with the acceptance copy", () => {
    state.current = { status: "idle" };
    render(<AcceptTermsForm next="/" />);

    const box = screen.getByLabelText(
      "Confirmo que tengo 18 años o más, acepto los Términos y condiciones y autorizo el tratamiento de mis datos según la Política de privacidad",
    );
    expect(box).toHaveAttribute("name", "accept");
    expect(box).toHaveAttribute("data-testid", "terms-accept-checkbox");
    expect(box).not.toBeChecked();
  });

  it("posts the path to return to as a hidden field", () => {
    state.current = { status: "idle" };
    const { container } = render(<AcceptTermsForm next="/notebooks/a" />);

    expect(container.querySelector('input[name="next"]')).toHaveValue(
      "/notebooks/a",
    );
    expect(container.querySelector('input[name="next"]')).toHaveAttribute(
      "type",
      "hidden",
    );
  });

  it("offers the submit button", () => {
    state.current = { status: "idle" };
    render(<AcceptTermsForm next="/" />);

    const submit = screen.getByRole("button", { name: "Aceptar y continuar" });
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit).toHaveAttribute("data-testid", "terms-accept-submit");
  });

  it("announces an action error as an alert", () => {
    state.current = {
      status: "error",
      message: "Debes aceptar los términos para continuar.",
    };
    render(<AcceptTermsForm next="/" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Debes aceptar los términos para continuar.",
    );
  });
});
