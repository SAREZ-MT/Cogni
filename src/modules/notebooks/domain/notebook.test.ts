import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import {
  COLOR_PALETTE,
  createNotebook,
  TITLE_MAX_LENGTH,
  validateColor,
  validateTitle,
} from "./notebook";

const NOW = new Date("2026-09-20T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

describe("createNotebook", () => {
  it("creates a notebook with a valid title (Scenario: Creacion con titulo valido)", () => {
    const result = createNotebook(
      { id: "0", ownerId: OWNER_ID, title: "Calculo I", position: 1 },
      createFixedClock(NOW),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe("Calculo I");
    expect(result.value.archivedAt).toBeNull();
    expect(result.value.ownerId).toBe(OWNER_ID);
    expect(result.value.icon).toBeNull();
    expect(result.value.color).toBeNull();
    expect(result.value.createdAt).toEqual(NOW);
    expect(result.value.updatedAt).toEqual(NOW);
  });

  it("rejects a blank title (Scenario: Titulo vacio rechazado)", () => {
    const result = createNotebook(
      { id: "0", ownerId: OWNER_ID, title: "   ", position: 1 },
      createFixedClock(NOW),
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("NOTEBOOK_INVALID_TITLE");
  });

  it("rejects a title longer than 120 characters", () => {
    const result = createNotebook(
      { id: "0", ownerId: OWNER_ID, title: "a".repeat(121), position: 1 },
      createFixedClock(NOW),
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("NOTEBOOK_INVALID_TITLE");
  });

  it("rejects a color outside the pastel palette (Scenario: Color fuera de la paleta rechazado)", () => {
    const result = createNotebook(
      {
        id: "0",
        ownerId: OWNER_ID,
        title: "Calculo I",
        color: "red",
        position: 1,
      },
      createFixedClock(NOW),
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("NOTEBOOK_INVALID_COLOR");
  });

  it("accepts every color in the pastel palette", () => {
    for (const color of COLOR_PALETTE) {
      const result = createNotebook(
        { id: "0", ownerId: OWNER_ID, title: "Calculo I", color, position: 1 },
        createFixedClock(NOW),
      );
      expect(result.ok && result.value.color).toBe(color);
    }
  });
});

describe("validateTitle", () => {
  it("trims surrounding whitespace", () => {
    const result = validateTitle("  Calculo I  ");
    expect(result.ok && result.value).toBe("Calculo I");
  });

  it(`rejects titles longer than ${TITLE_MAX_LENGTH} characters`, () => {
    const result = validateTitle("a".repeat(TITLE_MAX_LENGTH + 1));
    expect(result.ok).toBe(false);
  });
});

describe("validateColor", () => {
  it("accepts a null color", () => {
    expect(validateColor(null)).toEqual({ ok: true, value: null });
  });

  it("accepts an undefined color", () => {
    expect(validateColor(undefined)).toEqual({ ok: true, value: null });
  });
});
