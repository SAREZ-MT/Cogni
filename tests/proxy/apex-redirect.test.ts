import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Requirement "Redirect del dominio apex"
// (specs/observability-and-delivery/spec.md), Scenario "Apex redirige al
// dominio canónico": a request to the apex/www variant of the configured
// canonical host must get a permanent (308) redirect to the canonical host,
// preserving pathname and query string. A host that does not share the
// canonical domain (Vercel preview, localhost, CI) must never be redirected,
// and a request already on the canonical host must not be redirected either.
const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/modules/identity/infrastructure/supabase-proxy-client", () => ({
  updateSession,
}));

// Canonical host is the `www` variant here on purpose: it makes the apex
// request (no `www`) genuinely differ from NEXT_PUBLIC_SITE_URL, which is
// exactly the scenario the Requirement describes.
const CANONICAL = "https://www.cogni.app";
vi.mock("@/shared/config/env.client", () => ({
  clientEnv: () => ({ NEXT_PUBLIC_SITE_URL: CANONICAL }),
}));

function buildRequest(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

describe("proxy apex redirect", () => {
  beforeEach(() => {
    updateSession.mockReset();
  });

  it("redirects the apex host permanently to the canonical host, keeping path and query string", async () => {
    updateSession.mockRejectedValue(
      new Error("updateSession must not be called for an apex redirect"),
    );
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      buildRequest("https://cogni.app/notebooks/123?tab=history"),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.cogni.app/notebooks/123?tab=history",
    );
  });

  it("does NOT redirect a request already on the canonical host", async () => {
    const { NextResponse } = await import("next/server");
    updateSession.mockImplementation(async (request: NextRequest) => ({
      response: NextResponse.next({ request }),
      user: { id: "u1", email: "a@b.test" },
    }));
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      buildRequest("https://www.cogni.app/notebooks"),
    );

    expect(response.status).not.toBe(308);
    expect(updateSession).toHaveBeenCalledOnce();
  });

  it("does NOT redirect an unrelated host (Vercel preview)", async () => {
    const { NextResponse } = await import("next/server");
    updateSession.mockImplementation(async (request: NextRequest) => ({
      response: NextResponse.next({ request }),
      user: { id: "u1", email: "a@b.test" },
    }));
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      buildRequest("https://cogni-git-preview.vercel.app/notebooks"),
    );

    expect(response.status).not.toBe(308);
    expect(updateSession).toHaveBeenCalledOnce();
  });
});
