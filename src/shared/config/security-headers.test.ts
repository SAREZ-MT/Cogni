import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

function header(key: string): string | undefined {
  return securityHeaders.find((h) => h.key === key)?.value;
}

describe("securityHeaders", () => {
  it("declares every header the spec requires", () => {
    expect(securityHeaders.map((h) => h.key)).toEqual([
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]);
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("locks framing, objects and base URI in the CSP", () => {
    const csp = header("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toContain("\n");
  });

  it("lets posthog-js load its remote config and lazy modules", () => {
    const csp = header("Content-Security-Policy") ?? "";
    const script =
      csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    const worker =
      csp.split("; ").find((d) => d.startsWith("worker-src")) ?? "";
    expect(script).toContain("https://*.posthog.com");
    expect(worker).toContain("data:");
  });

  it("lets the browser reach Supabase, Sentry and PostHog only", () => {
    const connect =
      header("Content-Security-Policy")
        ?.split("; ")
        .find((d) => d.startsWith("connect-src")) ?? "";
    expect(connect).toContain("https://*.supabase.co");
    expect(connect).toContain("sentry.io");
    expect(connect).toContain("posthog.com");
    expect(connect).not.toContain("*.com");
  });
});
