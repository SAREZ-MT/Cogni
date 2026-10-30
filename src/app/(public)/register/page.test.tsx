import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RegisterPage from "./page";

vi.mock("@/modules/identity/actions", () => ({
  signUpAction: vi.fn(),
  signInWithGoogleAction: vi.fn(),
}));

describe("RegisterPage", () => {
  it("shows the consent notice between the sign-up button and the Google button", () => {
    render(<RegisterPage />);

    const submit = screen.getByRole("button", { name: "Crear cuenta" });
    const notice = screen.getByTestId("sign-up-consent-notice");
    const google = screen.getByRole("button", { name: "Continuar con Google" });

    expect(notice).toHaveTextContent(
      /^Al crear tu cuenta o continuar con Google, aceptas los Términos y condiciones/,
    );
    expect(
      submit.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      notice.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Both account-creating buttons point screen readers at the notice.
    expect(submit).toHaveAttribute("aria-describedby", notice.id);
    expect(google).toHaveAttribute("aria-describedby", notice.id);
  });

  it("links the full terms and privacy policy", () => {
    render(<RegisterPage />);

    expect(
      screen.getByRole("link", { name: "Términos y condiciones" }),
    ).toHaveAttribute("href", "/legal/terminos");
    expect(
      screen.getByRole("link", { name: "Política de privacidad" }),
    ).toHaveAttribute("href", "/legal/privacidad");
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
