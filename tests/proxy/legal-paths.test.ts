import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The public legal pages (feature legal-consent, L1) are linked from the
// sign-up notice: anyone must reach them, signed in or not.
const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/modules/identity/infrastructure/supabase-proxy-client", () => ({
  updateSession,
}));
vi.mock("@/shared/config/env.client", () => ({
  clientEnv: () => ({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
}));

const LEGAL_PATHS = [
  "/legal/terminos",
  "/legal/privacidad",
  "/legal/uso-aceptable",
  "/legal/derechos-de-autor",
];

function session(user: { id: string; email: string } | null) {
  updateSession.mockImplementation(async (request: NextRequest) => ({
    response: NextResponse.next({ request }),
    user,
  }));
}

function buildRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("proxy /legal pages", () => {
  beforeEach(() => updateSession.mockReset());

  it.each(LEGAL_PATHS)("lets an anonymous visitor read %s", async (path) => {
    session(null);
    const { proxy } = await import("@/proxy");

    const response = await proxy(buildRequest(path));

    expect(response.headers.get("location")).toBeNull();
  });

  it.each(LEGAL_PATHS)("keeps a signed-in user on %s", async (path) => {
    session({ id: "u1", email: "a@b.test" });
    const { proxy } = await import("@/proxy");

    const response = await proxy(buildRequest(`${path}#cookies`));

    expect(response.headers.get("location")).toBeNull();
  });

  it("still sends an anonymous visitor on an unknown /legal path to /login", async () => {
    session(null);
    const { proxy } = await import("@/proxy");

    const response = await proxy(buildRequest("/legal/subencargados"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });
});
