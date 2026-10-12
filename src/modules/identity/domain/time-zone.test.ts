import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE } from "./profile";
import {
  EXPLICIT_UTC,
  hasChosenTimeZone,
  PROFILE_ERROR,
  parseTimeZone,
} from "./time-zone";

describe("parseTimeZone", () => {
  it.each([
    ["America/Bogota", "America/Bogota"],
    ["Europe/Madrid", "Europe/Madrid"],
    ["America/Argentina/Buenos_Aires", "America/Buenos_Aires"],
    ["Pacific/Kiritimati", "Pacific/Kiritimati"],
  ])("accepts the IANA zone %s", (input, expected) => {
    const result = parseTimeZone(input);

    expect(result.ok && result.value).toBe(expected);
  });

  it("stores the engine's canonical spelling of a zone", () => {
    const result = parseTimeZone("  america/bogota ");

    expect(result.ok && result.value).toBe("America/Bogota");
  });

  it("accepts a newer alias the browser reports and stores a name the server lists", () => {
    // Chrome may report Asia/Kolkata while Node 22's ICU canonicalizes to
    // Asia/Calcutta: both must be accepted and stored as one valid name.
    const result = parseTimeZone("Asia/Kolkata");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(() =>
      new Intl.DateTimeFormat("es", { timeZone: result.value }).format(),
    ).not.toThrow();
  });

  it.each([
    "UTC",
    "Etc/UTC",
    "GMT",
    "Etc/GMT",
  ])("stores an explicit UTC choice (%s) as Etc/UTC, never the unset default", (input) => {
    const result = parseTimeZone(input);

    expect(result.ok && result.value).toBe(EXPLICIT_UTC);
    expect(EXPLICIT_UTC).not.toBe(DEFAULT_TIMEZONE);
  });

  it.each([
    "",
    "   ",
    "Mars/Olympus_Mons",
    "+05:00",
    "-03:00",
    "Europe/../Madrid",
    "America/Bogota; drop table profiles",
    "A".repeat(80),
  ])("rejects %j", (input) => {
    const result = parseTimeZone(input);

    expect(!result.ok && result.error.code).toBe(
      PROFILE_ERROR.INVALID_TIME_ZONE,
    );
  });

  it.each([undefined, null, 42, {}])("rejects the non-string %j", (input) => {
    const result = parseTimeZone(input);

    expect(!result.ok && result.error.code).toBe(
      PROFILE_ERROR.INVALID_TIME_ZONE,
    );
  });
});

describe("hasChosenTimeZone", () => {
  it("treats the column default as never chosen", () => {
    expect(hasChosenTimeZone({ timezone: DEFAULT_TIMEZONE })).toBe(false);
  });

  it("treats an explicit UTC choice as chosen", () => {
    expect(hasChosenTimeZone({ timezone: EXPLICIT_UTC })).toBe(true);
  });

  it("treats any other zone as chosen", () => {
    expect(hasChosenTimeZone({ timezone: "America/Bogota" })).toBe(true);
  });
});
