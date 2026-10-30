import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignInForm } from "@/modules/identity/ui";
import LoginPage from "./page";

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

describe("LoginPage", () => {
  it("reminds that creating an account requires accepting the terms, with a link to them", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) } as never));

    expect(
      screen.getByText(/Al crear una cuenta deberás aceptar los/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "términos de uso" }),
    ).toHaveAttribute("href", "/terminos");
  });

  it("separates the Google button with an 'o' divider and shows the Google G", async () => {
    const { container } = render(
      await LoginPage({ searchParams: Promise.resolve({}) } as never),
    );

    const divider = container.querySelector('[data-slot="text-divider"]');
    expect(divider).toHaveTextContent("o");
    const google = screen.getByRole("button", { name: "Continuar con Google" });
    expect(google.querySelector('[data-slot="google-icon"]')).not.toBeNull();
  });

  it("styles the sign-up and recovery links as links", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) } as never));

    expect(screen.getByRole("link", { name: "Crea una" })).toHaveAttribute(
      "data-slot",
      "text-link",
    );
    expect(
      screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" }),
    ).toHaveAttribute("data-slot", "text-link");
  });

  it("shows the Google copy only for error=google", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "google" }),
      } as never),
    );

    expect(
      screen.getByText(
        "No se completó el acceso con Google. Puedes intentarlo de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/El enlace no es válido/)).toBeNull();
  });

  it("shows the invalid-link copy for error=link, not the Google one", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "link" }),
      } as never),
    );

    expect(
      screen.getByText("El enlace no es válido o ya venció. Pide uno nuevo."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/acceso con Google/)).toBeNull();
  });
});
