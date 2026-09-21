import { describe, expect, it } from "vitest";
import {
  DomainError,
  isDomainError,
  isDomainErrorLike,
  toActionError,
} from "./domain-error";

describe("DomainError", () => {
  it("carries a machine-readable code and a human message", () => {
    const error = new DomainError("PROFILE_NOT_FOUND", "Profile not found");

    expect(error.code).toBe("PROFILE_NOT_FOUND");
    expect(error.message).toBe("Profile not found");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DomainError");
  });

  it("isDomainError() returns true for a DomainError instance", () => {
    const error = new DomainError("INVALID_EMAIL", "Invalid email");

    expect(isDomainError(error)).toBe(true);
  });

  it("isDomainError() returns false for a plain Error", () => {
    expect(isDomainError(new Error("generic"))).toBe(false);
  });

  it("isDomainError() returns false for a non-error value", () => {
    expect(isDomainError({ code: "FAKE" })).toBe(false);
  });
});

// A Server Action's returned DomainError does not survive the RSC/Flight
// boundary as a DomainError instance: React redacts Error subclasses (a
// generic digest-bearing Error in production, a plain object shape at
// best) — `instanceof DomainError` can never be true again on the client.
// toActionError()/isDomainErrorLike() replace that instanceof check with a
// shape check so callers on either side of the boundary agree on what an
// error looks like.
describe("toActionError", () => {
  it("maps a DomainError to a plain { code, message } object", () => {
    const error = new DomainError(
      "PAGE_VERSION_CONFLICT",
      "current version is 4",
    );

    const actionError = toActionError(error);

    expect(actionError).toEqual({
      code: "PAGE_VERSION_CONFLICT",
      message: "current version is 4",
    });
    expect(actionError).not.toBeInstanceOf(DomainError);
    expect(actionError).not.toBeInstanceOf(Error);
  });
});

describe("isDomainErrorLike", () => {
  it("returns true for a real DomainError instance (in-process callers)", () => {
    expect(isDomainErrorLike(new DomainError("PAGE_NOT_FOUND", "gone"))).toBe(
      true,
    );
  });

  it("returns true for a plain { code, message } object (post-boundary shape)", () => {
    expect(
      isDomainErrorLike({ code: "PAGE_VERSION_CONFLICT", message: "stale" }),
    ).toBe(true);
  });

  it("returns false for a generic redacted Error with no code", () => {
    expect(isDomainErrorLike(new Error("An error occurred"))).toBe(false);
  });

  it("returns false for a non-error value", () => {
    expect(isDomainErrorLike(null)).toBe(false);
    expect(isDomainErrorLike(undefined)).toBe(false);
    expect(isDomainErrorLike("boom")).toBe(false);
    expect(isDomainErrorLike({ code: 42, message: "wrong type" })).toBe(false);
  });
});
