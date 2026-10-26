import { describe, expect, it } from "vitest";
import { buildSecurityHeaders, securityHeaders } from "./security-headers";

function header(key: string): string | undefined {
  return securityHeaders.find((h) => h.key === key)?.value;
}

function directive(csp: string, name: string): string {
  return csp.split("; ").find((d) => d.startsWith(name)) ?? "";
}

describe("securityHeaders", () => {
  // document-import T3: the editor's YouTube embed (extensions/youtube.ts)
  // always loads from youtube-nocookie.com; that is the only frame origin.
  it("allows only the youtube-nocookie embed in frame-src", () => {
    for (const csp of [
      header("Content-Security-Policy") ?? "",
      buildSecurityHeaders("abc123")[0].value,
    ]) {
      expect(directive(csp, "frame-src ")).toBe(
        "frame-src https://www.youtube-nocookie.com",
      );
    }
  });

  it("keeps every other CSP directive unchanged", () => {
    const csp = buildSecurityHeaders("abc123")[0].value;
    expect(csp.split("; ").filter((d) => !d.startsWith("frame-src "))).toEqual([
      "default-src 'self'",
      "script-src 'self' 'nonce-abc123' 'strict-dynamic' https://*.posthog.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://*.googleusercontent.com https://*.supabase.co",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.posthog.com https://*.i.posthog.com",
      "worker-src 'self' blob: data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.supabase.co https://accounts.google.com",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ]);
  });

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

  it("lets images load from Supabase Storage, blob and data URLs (design.md, page-assets)", () => {
    const img =
      header("Content-Security-Policy")
        ?.split("; ")
        .find((d) => d.startsWith("img-src")) ?? "";
    expect(img).toContain("https://*.supabase.co");
    expect(img).toContain("blob:");
    expect(img).toContain("data:");
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

// Requirement "Nonces de CSP" (specs/observability-and-delivery/spec.md):
// src/proxy.ts calls buildSecurityHeaders(nonce) once per request.
describe("buildSecurityHeaders(nonce)", () => {
  it("replaces 'unsafe-inline' in script-src with the given nonce and 'strict-dynamic'", () => {
    const csp =
      buildSecurityHeaders("abc123").find(
        (h) => h.key === "Content-Security-Policy",
      )?.value ?? "";

    const script = directive(csp, "script-src");
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
  });

  // A nonce never covers style="" attributes, so a nonce-based style-src
  // blocks every server-rendered inline style on a hard load (progress bar
  // widths render at 100 %). Styles keep 'unsafe-inline'; the nonce only
  // protects scripts.
  it("keeps style-src on 'self' 'unsafe-inline' without the nonce so SSR inline styles apply", () => {
    const csp =
      buildSecurityHeaders("abc123").find(
        (h) => h.key === "Content-Security-Policy",
      )?.value ?? "";

    expect(directive(csp, "style-src")).toBe(
      "style-src 'self' 'unsafe-inline'",
    );
  });

  it("produces a different script-src directive for a different nonce (triangulation)", () => {
    const cspA =
      buildSecurityHeaders("nonce-a").find(
        (h) => h.key === "Content-Security-Policy",
      )?.value ?? "";
    const cspB =
      buildSecurityHeaders("nonce-b").find(
        (h) => h.key === "Content-Security-Policy",
      )?.value ?? "";

    expect(directive(cspA, "script-src")).not.toBe(
      directive(cspB, "script-src"),
    );
  });

  it("keeps every non-nonce directive and header identical to the static export", () => {
    const dynamicHeaders = buildSecurityHeaders("abc123");
    expect(dynamicHeaders.map((h) => h.key)).toEqual(
      securityHeaders.map((h) => h.key),
    );
    for (const key of [
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]) {
      expect(dynamicHeaders.find((h) => h.key === key)?.value).toBe(
        header(key),
      );
    }
    const dynamicCsp =
      dynamicHeaders.find((h) => h.key === "Content-Security-Policy")?.value ??
      "";
    expect(directive(dynamicCsp, "img-src")).toBe(
      directive(header("Content-Security-Policy") ?? "", "img-src"),
    );
  });
});
