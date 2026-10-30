import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignUpConsentNotice } from "./terms-notice";

function expectLegalLinks() {
  expect(
    screen.getByRole("link", { name: "Términos y condiciones" }),
  ).toHaveAttribute("href", "/legal/terminos");
  expect(
    screen.getByRole("link", { name: "Política de privacidad" }),
  ).toHaveAttribute("href", "/legal/privacidad");
}

describe("SignUpConsentNotice", () => {
  it("states the acceptance, the data authorisation and the age on /register", () => {
    render(<SignUpConsentNotice variant="register" id="consent" />);

    expect(screen.getByTestId("sign-up-consent-notice")).toHaveTextContent(
      "Al crear tu cuenta o continuar con Google, aceptas los Términos y condiciones, autorizas el tratamiento de tus datos según la Política de privacidad y confirmas que eres mayor de 18 años.",
    );
    expect(screen.getByTestId("sign-up-consent-notice")).toHaveAttribute(
      "id",
      "consent",
    );
    expectLegalLinks();
  });

  it("scopes the login wording to new Google accounts", () => {
    render(<SignUpConsentNotice variant="login" id="consent" />);

    expect(screen.getByTestId("sign-up-consent-notice")).toHaveTextContent(
      "Si continúas con Google y aún no tienes cuenta, aceptas los Términos y condiciones, autorizas el tratamiento de tus datos según la Política de privacidad y confirmas que eres mayor de 18 años.",
    );
    expectLegalLinks();
  });

  it("has no checkbox: the button press is the acceptance", () => {
    render(<SignUpConsentNotice variant="register" id="consent" />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
