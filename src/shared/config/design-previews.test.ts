import { describe, expect, it, vi } from "vitest";

// The real `server-only` package throws outside a Server Component bundle.
vi.mock("server-only", () => ({}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import {
  designPreviewsEnabled,
  requireDesignPreviews,
} from "./design-previews";

describe("designPreviewsEnabled", () => {
  it("is enabled in development", () => {
    expect(designPreviewsEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is enabled under test", () => {
    expect(designPreviewsEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("is enabled when NODE_ENV is unset", () => {
    expect(designPreviewsEnabled({})).toBe(true);
  });

  it("is disabled in production", () => {
    expect(designPreviewsEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("is enabled in production when COGNI_DESIGN_PREVIEWS is exactly '1'", () => {
    expect(
      designPreviewsEnabled({
        NODE_ENV: "production",
        COGNI_DESIGN_PREVIEWS: "1",
      }),
    ).toBe(true);
  });

  it.each([
    "0",
    "true",
    "",
    "yes",
    " 1",
  ])("stays disabled in production when COGNI_DESIGN_PREVIEWS is %j", (value) => {
    expect(
      designPreviewsEnabled({
        NODE_ENV: "production",
        COGNI_DESIGN_PREVIEWS: value,
      }),
    ).toBe(false);
  });
});

describe("requireDesignPreviews", () => {
  it("lets a preview route render while previews are enabled", () => {
    notFound.mockClear();

    expect(() =>
      requireDesignPreviews({ NODE_ENV: "development" }),
    ).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("answers 404 for a preview route in production", () => {
    notFound.mockClear();

    expect(() => requireDesignPreviews({ NODE_ENV: "production" })).toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("lets a preview route render in production when the opt-in is set", () => {
    notFound.mockClear();

    expect(() =>
      requireDesignPreviews({
        NODE_ENV: "production",
        COGNI_DESIGN_PREVIEWS: "1",
      }),
    ).not.toThrow();
  });
});
