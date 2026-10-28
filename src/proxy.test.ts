import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

// The session refresh is Supabase's concern; here every request is
// anonymous so the redirect rules are exercised on their own.
vi.mock("@/modules/identity/proxy", () => ({
  updateSession: vi.fn(async () => ({
    response: NextResponse.next(),
    user: null,
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
    const response = await proxy(anonymousRequest("/"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });

  it("lets an anonymous visitor read the public landing", async () => {
    const response = await proxy(anonymousRequest("/landing"));

    expect(response.headers.get("location")).toBeNull();
  });
});
