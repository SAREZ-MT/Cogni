import { describe, expect, it } from "vitest";
import { config } from "./proxy";

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
