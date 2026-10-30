import { describe, expect, it, vi } from "vitest";
import {
  persistTourOutcome,
  shouldAutoLaunchTour,
  TOUR_STORAGE_KEY,
} from "./tour-storage";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    values,
  };
}

describe("shouldAutoLaunchTour", () => {
  it("uses a versioned key", () => {
    expect(TOUR_STORAGE_KEY).toBe("cogni.tour.v1");
  });

  it("launches for an owner with no notebooks and no stored key", () => {
    expect(shouldAutoLaunchTour(true, memoryStorage())).toBe(true);
  });

  it("does not launch once the key is stored", () => {
    expect(
      shouldAutoLaunchTour(true, memoryStorage({ [TOUR_STORAGE_KEY]: "done" })),
    ).toBe(false);
    expect(
      shouldAutoLaunchTour(
        true,
        memoryStorage({ [TOUR_STORAGE_KEY]: "dismissed" }),
      ),
    ).toBe(false);
  });

  it("does not launch for an owner who already has notebooks", () => {
    expect(shouldAutoLaunchTour(false, memoryStorage())).toBe(false);
  });

  it("does not launch when storage throws (private mode)", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("SecurityError");
      }),
      setItem: vi.fn(),
    };

    expect(shouldAutoLaunchTour(true, storage)).toBe(false);
  });

  it("does not launch when storage is unavailable", () => {
    expect(shouldAutoLaunchTour(true, null)).toBe(false);
  });
});

describe("persistTourOutcome", () => {
  it("stores done or dismissed under the key", () => {
    const storage = memoryStorage();

    persistTourOutcome(storage, "dismissed");
    expect(storage.values.get(TOUR_STORAGE_KEY)).toBe("dismissed");

    persistTourOutcome(storage, "done");
    expect(storage.values.get(TOUR_STORAGE_KEY)).toBe("done");
  });

  it("swallows storage errors", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
    };

    expect(() => persistTourOutcome(storage, "done")).not.toThrow();
    expect(() => persistTourOutcome(null, "done")).not.toThrow();
  });
});
