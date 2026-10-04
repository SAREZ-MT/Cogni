import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// /terminos is a third category next to "auth paths" and "app paths": the
// terms of use are readable by anyone, including signed-in users, who must
// not be bounced to "/" like they are from /login. The proxy also exposes
// the request path to Server Components (x-pathname) so the (app) layout
// gate can carry it as `next`.
const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/modules/identity/infrastructure/supabase-proxy-client", () => ({
  updateSession,
}));
vi.mock("@/shared/config/env.client", () => ({
  clientEnv: () => ({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
}));

function buildRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function session(user: { id: string; email: string } | null) {
  let seen: Headers | undefined;
  updateSession.mockImplementation(async (request: NextRequest) => {
    seen = request.headers;
    return { response: NextResponse.next({ request }), user };
  });
  return () => seen;
}

describe("proxy /terminos", () => {
  beforeEach(() => {
    updateSession.mockReset();
  });

  it("lets an anonymous visitor read the terms", async () => {
    session(null);
    const { proxy } = await import("@/proxy");

    const response = await proxy(buildRequest("/terminos"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps a signed-in user on the terms instead of bouncing them to /", async () => {
    session({ id: "u1", email: "a@b.test" });
    const { proxy } = await import("@/proxy");

    const response = await proxy(buildRequest("/terminos?next=%2Fnotebooks"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("still bounces a signed-in user away from /login", async () => {
    session({ id: "u1", email: "a@b.test" });
    const { proxy } = await import("@/proxy");

    const response = await proxy(buildRequest("/login"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("forwards the request path and query as x-pathname", async () => {
    const seen = session({ id: "u1", email: "a@b.test" });
    const { proxy } = await import("@/proxy");

    await proxy(buildRequest("/notebooks/abc?tab=1"));

    expect(seen()?.get("x-pathname")).toBe("/notebooks/abc?tab=1");
  });
});
