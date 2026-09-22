import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Requirement "Nonces de CSP" (specs/observability-and-delivery/spec.md),
// Scenario "Nonce único por petición": two distinct requests to the same
// route must carry two distinct nonces in their Content-Security-Policy
// header. The session refresh (Supabase) is not under test here, so
// updateSession is mocked entirely — this proves the proxy's own nonce
// generation, never a real Supabase round trip.
const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/modules/identity/infrastructure/supabase-proxy-client", () => ({
  updateSession,
}));

vi.mock("@/shared/config/env.client", () => ({
  clientEnv: () => ({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
}));

function buildRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

function cspHeader(response: Response): string {
  return response.headers.get("Content-Security-Policy") ?? "";
}

function extractNonce(csp: string): string | undefined {
  return csp.match(/'nonce-([^']+)'/)?.[1];
}

describe("proxy CSP nonce", () => {
  beforeEach(() => {
    updateSession.mockReset();
  });

  it("issues two different nonces for two distinct requests to the same route", async () => {
    const { NextResponse } = await import("next/server");
    updateSession.mockImplementation(async (request: NextRequest) => ({
      response: NextResponse.next({ request }),
      user: { id: "u1", email: "a@b.test" },
    }));
    const { proxy } = await import("@/proxy");

    const first = await proxy(buildRequest("/notebooks"));
    const second = await proxy(buildRequest("/notebooks"));

    const nonce1 = extractNonce(cspHeader(first));
    const nonce2 = extractNonce(cspHeader(second));

    expect(nonce1).toBeDefined();
    expect(nonce2).toBeDefined();
    expect(nonce1).not.toBe(nonce2);
  });

  it("forwards the same nonce used in the CSP header as x-nonce on the request seen by rendering", async () => {
    const { NextResponse } = await import("next/server");
    let seenRequestHeaders: Headers | undefined;
    updateSession.mockImplementation(async (request: NextRequest) => {
      seenRequestHeaders = request.headers;
      return {
        response: NextResponse.next({ request }),
        user: { id: "u1", email: "a@b.test" },
      };
    });
    const { proxy } = await import("@/proxy");

    const response = await proxy(buildRequest("/notebooks"));
    const nonce = extractNonce(cspHeader(response));

    expect(nonce).toBeDefined();
    expect(seenRequestHeaders?.get("x-nonce")).toBe(nonce);
  });
});
