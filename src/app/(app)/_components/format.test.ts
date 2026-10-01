import { describe, expect, it } from "vitest";
import { formatTimeAgo, formatUpdatedAt, greetingForHour } from "./format";

describe("greetingForHour", () => {
  it.each([
    [0, "Buenas noches, Ana"],
    [4, "Buenas noches, Ana"],
    [5, "Buenos días, Ana"],
    [11, "Buenos días, Ana"],
    [12, "Buenas tardes, Ana"],
    [18, "Buenas tardes, Ana"],
    [19, "Buenas noches, Ana"],
    [23, "Buenas noches, Ana"],
  ])("hour %i greets '%s'", (hour, expected) => {
    expect(greetingForHour(hour, "Ana")).toBe(expected);
  });
});

describe("formatTimeAgo", () => {
  const now = new Date("2026-09-23T12:00:00.000Z");

  it("shows 'justo ahora' for under a minute, including a future/clock-skewed date", () => {
    expect(formatTimeAgo(new Date("2026-09-23T11:59:31.000Z"), now)).toBe(
      "justo ahora",
    );
    expect(formatTimeAgo(new Date("2026-09-23T12:00:10.000Z"), now)).toBe(
      "justo ahora",
    );
  });

  it("shows minutes under an hour", () => {
    expect(formatTimeAgo(new Date("2026-09-23T11:55:00.000Z"), now)).toBe(
      "hace 5m",
    );
  });

  it("shows hours under a day", () => {
    expect(formatTimeAgo(new Date("2026-09-23T09:00:00.000Z"), now)).toBe(
      "hace 3h",
    );
  });

  it("shows 'ayer' between 1 and 2 days", () => {
    expect(formatTimeAgo(new Date("2026-09-22T01:00:00.000Z"), now)).toBe(
      "ayer",
    );
  });

  it("shows days under a week", () => {
    expect(formatTimeAgo(new Date("2026-09-20T12:00:00.000Z"), now)).toBe(
      "hace 3 días",
    );
  });

  it("shows weeks under a month", () => {
    expect(formatTimeAgo(new Date("2026-09-13T12:00:00.000Z"), now)).toBe(
      "hace 1 sem",
    );
  });

  it("shows months under a year, with singular/plural", () => {
    expect(formatTimeAgo(new Date("2026-08-20T12:00:00.000Z"), now)).toBe(
      "hace 1 mes",
    );
    expect(formatTimeAgo(new Date("2026-06-01T12:00:00.000Z"), now)).toBe(
      "hace 3 meses",
    );
  });

  it("shows years, with singular/plural", () => {
    expect(formatTimeAgo(new Date("2025-09-01T12:00:00.000Z"), now)).toBe(
      "hace 1 año",
    );
    expect(formatTimeAgo(new Date("2020-01-01T12:00:00.000Z"), now)).toBe(
      "hace 6 años",
    );
  });
});

describe("formatUpdatedAt", () => {
  it("formats a short Spanish day and month", () => {
    expect(formatUpdatedAt(new Date(2026, 8, 3, 12))).toBe("3 sept");
  });
});
