import { describe, expect, it } from "vitest";
import { DomainError, isDomainError } from "./domain-error";

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
