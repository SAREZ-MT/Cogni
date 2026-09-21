import { describe, expect, it } from "vitest";
import { supabaseImageRemotePatterns } from "./image-remote-patterns";

// next.config.ts is loaded by tooling that runs without the app env (the
// `postinstall` typegen in CI's verify job, for example), so deriving the
// Storage host must never throw: no variable means no remote pattern.
describe("supabaseImageRemotePatterns", () => {
  it("pins the exact project host and the signed-URL path", () => {
    expect(supabaseImageRemotePatterns("https://abc.supabase.co")).toEqual([
      {
        protocol: "https",
        hostname: "abc.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ]);
  });

  it("keeps http for a local Supabase stack", () => {
    expect(
      supabaseImageRemotePatterns("http://127.0.0.1:54321")[0]?.protocol,
    ).toBe("http");
  });

  it("returns no patterns when the variable is absent", () => {
    expect(supabaseImageRemotePatterns(undefined)).toEqual([]);
    expect(supabaseImageRemotePatterns("")).toEqual([]);
  });

  it("returns no patterns for a value that is not a URL", () => {
    expect(supabaseImageRemotePatterns("not a url")).toEqual([]);
  });
});
