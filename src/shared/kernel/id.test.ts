import { describe, expect, it } from "vitest";
import { createId, isValidId } from "./id";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("id", () => {
  it("createId() returns a well-formed UUID v7", () => {
    const id = createId();

    expect(id).toMatch(UUID_V7_PATTERN);
  });

  it("createId() produces lexicographically increasing ids over time", async () => {
    const first = createId();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = createId();

    expect(second > first).toBe(true);
  });

  it("isValidId() returns true for a generated id", () => {
    expect(isValidId(createId())).toBe(true);
  });

  it("isValidId() returns false for a clearly invalid string", () => {
    expect(isValidId("not-a-uuid")).toBe(false);
  });
});
