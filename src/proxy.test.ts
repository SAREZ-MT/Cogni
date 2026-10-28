import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, isOpenPath, proxy } from "./proxy";

// The session refresh is Supabase's concern; requests are anonymous unless
// a test signs a user in, so the redirect rules are exercised on their own.
const session = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
}));
vi.mock("@/modules/identity/proxy", () => ({
  updateSession: vi.fn(async () => ({
    response: NextResponse.next(),
    user: session.user,
  })),
}));

vi.mock("@/shared/config/env.client", () => ({
  clientEnv: () => ({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
}));

// Next.js compiles each matcher into a path regex; this mirrors that check
// closely enough to pin which routes the session proxy must never touch.
function matches(pathname: string): boolean {
  return config.matcher.some((pattern) =>
    new RegExp(`^${pattern}$`).test(pathname),
  );
}

describe("proxy matcher", () => {
  it("guards pages and auth screens", () => {
    expect(matches("/")).toBe(true);
    expect(matches("/login")).toBe(true);
    expect(matches("/auth/callback")).toBe(true);
  });

  it("skips route handlers: the cron bearer is not a browser session", () => {
    expect(matches("/api/keep-alive")).toBe(false);
  });

  it("skips the Sentry tunnel so error reports are never redirected", () => {
    expect(matches("/monitoring")).toBe(false);
  });

  it("skips static assets", () => {
    expect(matches("/_next/static/chunks/app.js")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
    expect(matches("/logo.svg")).toBe(false);
  });
});

describe("proxy redirects for anonymous visitors", () => {
  function anonymousRequest(pathname: string): NextRequest {
    return new NextRequest(new URL(pathname, "http://localhost:3000"));
  }

  it("sends an anonymous visitor on a private page to /login", async () => {
    const response = await proxy(anonymousRequest("/inicio"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });

  it("lets an anonymous visitor read the public landing at the root", async () => {
    const response = await proxy(anonymousRequest("/"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("no longer treats /landing as an open page (next.config redirects it)", () => {
    expect(isOpenPath("/landing")).toBe(false);
  });

  it.each([
    "/ciencia",
    "/creditos",
  ])("lets an anonymous visitor read the public page %s", async (pathname) => {
    const response = await proxy(anonymousRequest(pathname));

    expect(response.headers.get("location")).toBeNull();
  });

  it("matches open pages exactly, not by prefix", async () => {
    const response = await proxy(anonymousRequest("/ciencia-privada"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });
});

describe("proxy redirects for signed-in users", () => {
  afterEach(() => {
    session.user = null;
  });

  function signedInRequest(pathname: string): NextRequest {
    session.user = { id: "u1", email: "a@b.test" };
    return new NextRequest(new URL(pathname, "http://localhost:3000"));
  }

  it("sends a signed-in user from the landing (/) to Inicio", async () => {
    const response = await proxy(signedInRequest("/"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/inicio",
    );
  });

  it.each([
    "/ciencia",
    "/creditos",
  ])("lets a signed-in user read the marketing page %s", async (pathname) => {
    const response = await proxy(signedInRequest(pathname));

    expect(response.headers.get("location")).toBeNull();
  });

  it.each([
    "/login",
    "/register",
    "/forgot-password",
  ])("sends a signed-in user on %s to Inicio", async (pathname) => {
    const response = await proxy(signedInRequest(pathname));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/inicio",
    );
  });

  it.each([
    "/legal/terminos",
    "/legal/privacidad",
    "/terminos",
  ])("lets a signed-in user read the legal page %s", async (pathname) => {
    const response = await proxy(signedInRequest(pathname));

    expect(response.headers.get("location")).toBeNull();
  });

  it("lets a signed-in user into the app", async () => {
    const response = await proxy(signedInRequest("/inicio"));

    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy open paths", () => {
  it("opens the terms gate and the four public legal pages", () => {
    for (const path of [
      "/terminos",
      "/legal/terminos",
      "/legal/privacidad",
      "/legal/uso-aceptable",
      "/legal/derechos-de-autor",
    ]) {
      expect(isOpenPath(path)).toBe(true);
    }
  });

  it("matches exact paths only", () => {
    expect(isOpenPath("/legal")).toBe(false);
    expect(isOpenPath("/legal/subencargados")).toBe(false);
    expect(isOpenPath("/legal/terminos/extra")).toBe(false);
    expect(isOpenPath("/notebooks")).toBe(false);
  });
});
