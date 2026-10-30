import { describe, expect, it } from "vitest";
import { longDateLabel, streakHelper } from "./home-copy";

const week = (todayStudied: boolean) =>
  Array.from({ length: 7 }, (_, index) => ({
    key: String(index),
    initial: "L",
    name: "lunes",
    studied: index === 6 ? todayStudied : true,
    isToday: index === 6,
  }));

describe("longDateLabel", () => {
  it("names the local weekday, day and month in Spanish, capitalised", () => {
    // 18 Oct 03:00 UTC is still Saturday 17 Oct in Bogotá.
    const instant = new Date("2026-10-18T03:00:00.000Z");
    expect(longDateLabel(instant, "America/Bogota")).toBe(
      "Sábado 17 de octubre",
    );
    expect(longDateLabel(instant, "Europe/Madrid")).toBe(
      "Domingo 18 de octubre",
    );
  });
});

describe("streakHelper", () => {
  it("invites to start a streak when there is none", () => {
    expect(streakHelper(0, week(false))).toBe(
      "Repasa hoy para empezar una racha.",
    );
  });

  it("warns that the streak is at stake when today has no review yet", () => {
    expect(streakHelper(4, week(false))).toBe(
      "Repasa hoy para no perder tu racha.",
    );
  });

  it("cheers by streak length once today is done", () => {
    expect(streakHelper(1, week(true))).toBe(
      "Buen comienzo. Vuelve mañana para seguir.",
    );
    expect(streakHelper(3, week(true))).toBe("Ya repasaste hoy. ¡Sigue así!");
    expect(streakHelper(7, week(true))).toBe(
      "Una semana o más sin fallar. Gran constancia.",
    );
  });
});
