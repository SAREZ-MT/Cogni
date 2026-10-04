import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/modules/identity";
import TerminosPage from "./page";

const identity = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  ensureProfileForUser: vi.fn(),
}));

vi.mock("@/modules/identity", async () => {
  const domain = await import("@/modules/identity/domain");
  const { safeNext } = await import("@/modules/identity/application/safe-next");
  return {
    getCurrentUser: identity.getCurrentUser,
    ensureProfileForUser: identity.ensureProfileForUser,
    hasAcceptedCurrentTerms: domain.hasAcceptedCurrentTerms,
    safeNext,
    TERMS_VERSION: domain.TERMS_VERSION,
  };
});
vi.mock("@/modules/identity/actions", () => ({ acceptTermsAction: vi.fn() }));

const USER = { id: "u1", email: "a@b.test" };

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "u1",
    displayName: null,
    locale: "es",
    timezone: "UTC",
    onboardingCompletedAt: null,
    termsAcceptedVersion: null,
    termsAcceptedAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  } as Profile;
}

async function renderPage(next?: string) {
  const ui = await TerminosPage({
    searchParams: Promise.resolve(next ? { next } : {}),
  } as never);
  return render(ui);
}

describe("/terminos page", () => {
  beforeEach(() => {
    identity.getCurrentUser.mockReset();
    identity.ensureProfileForUser.mockReset();
  });

  it("shows the terms with login and register links to an anonymous visitor", async () => {
    identity.getCurrentUser.mockResolvedValue(null);
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Términos de uso" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.queryByTestId("terms-accept-checkbox")).toBeNull();
    expect(identity.ensureProfileForUser).not.toHaveBeenCalled();
  });

  it("treats a failing session read as anonymous instead of crashing", async () => {
    identity.getCurrentUser.mockRejectedValue(new Error("boom"));
    await renderPage();

    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
  });

  it("offers the acceptance form to a signed-in account that has not accepted", async () => {
    identity.getCurrentUser.mockResolvedValue(USER);
    identity.ensureProfileForUser.mockResolvedValue(profile());
    const { container } = await renderPage("/notebooks/a");

    expect(screen.getByTestId("terms-accept-checkbox")).toBeInTheDocument();
    expect(screen.getByTestId("terms-accept-submit")).toBeInTheDocument();
    expect(container.querySelector('input[name="next"]')).toHaveValue(
      "/notebooks/a",
    );
    expect(screen.queryByTestId("terms-accepted-state")).toBeNull();
  });

  it("sanitises the next parameter before handing it to the form", async () => {
    identity.getCurrentUser.mockResolvedValue(USER);
    identity.ensureProfileForUser.mockResolvedValue(profile());
    const { container } = await renderPage("//evil.test");

    expect(container.querySelector('input[name="next"]')).toHaveValue("/");
  });

  it("shows the accepted version and date with a way back once accepted", async () => {
    identity.getCurrentUser.mockResolvedValue(USER);
    identity.ensureProfileForUser.mockResolvedValue(
      profile({
        termsAcceptedVersion: "2026-10-04",
        termsAcceptedAt: new Date("2026-10-05T15:00:00Z"),
      }),
    );
    await renderPage();

    expect(screen.getByTestId("terms-accepted-state")).toHaveTextContent(
      "Aceptaste la versión 2026-10-04 el 5 de octubre de 2026.",
    );
    expect(
      screen.getByRole("link", { name: "Volver a Cogni" }),
    ).toHaveAttribute("href", "/");
    expect(screen.queryByTestId("terms-accept-checkbox")).toBeNull();
  });

  it("still offers the form when the profile could not be loaded", async () => {
    identity.getCurrentUser.mockResolvedValue(USER);
    identity.ensureProfileForUser.mockResolvedValue(null);
    await renderPage();

    expect(screen.getByTestId("terms-accept-checkbox")).toBeInTheDocument();
  });
});
