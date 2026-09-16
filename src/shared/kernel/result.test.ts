import { describe, expect, it } from "vitest";
import { err, isErr, isOk, map, ok, unwrapOr } from "./result";

describe("Result", () => {
  it("ok() builds a success result carrying the value", () => {
    const result = ok(42);

    expect(result.ok).toBe(true);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    }
  });

  it("err() builds a failure result carrying the error", () => {
    const result = err("profile-not-found");

    expect(result.ok).toBe(false);
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    if (isErr(result)) {
      expect(result.error).toBe("profile-not-found");
    }
  });

  it("map() transforms the value of an Ok result", () => {
    const result = map(ok(2), (value) => value * 10);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(20);
    }
  });

  it("map() leaves an Err result untouched", () => {
    const original = err("boom");
    const result = map(original, (value: number) => value * 10);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe("boom");
    }
  });

  it("unwrapOr() returns the value for an Ok result", () => {
    expect(unwrapOr(ok(7), 0)).toBe(7);
  });

  it("unwrapOr() returns the fallback for an Err result", () => {
    expect(unwrapOr(err("boom"), 99)).toBe(99);
  });
});
