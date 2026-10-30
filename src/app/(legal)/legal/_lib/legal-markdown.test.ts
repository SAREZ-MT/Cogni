import { describe, expect, it } from "vitest";
import {
  buildLegalPage,
  headingId,
  parseLegalSource,
  sliceByHeading,
  slugify,
  splitPending,
} from "./legal-markdown";

const SOURCE = `# Política de ejemplo

- **Versión:** 1.0
- **Fecha de última actualización:** [PENDIENTE: fecha de entrada en vigor]
- **Responsable:** [PENDIENTE: nombre completo], persona natural

> **En resumen**

## 1. Primera

Texto uno.

## 2. Segunda

Texto dos.
`;

describe("parseLegalSource", () => {
  it("lifts the title and the metadata list out of the body", () => {
    const parsed = parseLegalSource(SOURCE);

    expect(parsed.title).toBe("Política de ejemplo");
    expect(parsed.metadata).toEqual({
      version: "1.0",
      effectiveFrom: "[PENDIENTE: fecha de entrada en vigor]",
      responsible: "[PENDIENTE: nombre completo], persona natural",
    });
    expect(parsed.body.startsWith("> **En resumen**")).toBe(true);
    expect(parsed.body).not.toContain("**Versión:**");
  });
});

describe("sliceByHeading", () => {
  const { body } = parseLegalSource(SOURCE);

  it("keeps everything before the `until` heading", () => {
    const slice = sliceByHeading(body, { until: "## 2." });
    expect(slice).toContain("Texto uno.");
    expect(slice).not.toContain("Texto dos.");
  });

  it("starts at the `from` heading", () => {
    expect(sliceByHeading(body, { from: "## 2." })).toBe(
      "## 2. Segunda\n\nTexto dos.",
    );
  });

  it("fails loudly when a slicing heading disappears from the source", () => {
    expect(() => sliceByHeading(body, { until: "## 9." })).toThrow(
      "Heading not found",
    );
  });
});

describe("slugify / headingId", () => {
  it("drops accents and punctuation", () => {
    expect(slugify("1. Quién presta el servicio")).toBe(
      "1-quien-presta-el-servicio",
    );
    expect(slugify("3.1 Dónde se usa la IA en Cogni")).toBe(
      "3-1-donde-se-usa-la-ia-en-cogni",
    );
  });

  it("scopes merged-section headings under their anchor", () => {
    expect(headingId("1. Categorías", "cookies")).toBe("cookies-1-categorias");
  });
});

describe("splitPending", () => {
  it("isolates every [PENDIENTE: …] placeholder", () => {
    expect(splitPending("Hola [PENDIENTE: a], y [PENDIENTE: b].")).toEqual([
      { text: "Hola ", pending: false },
      { text: "[PENDIENTE: a]", pending: true },
      { text: ", y ", pending: false },
      { text: "[PENDIENTE: b]", pending: true },
      { text: ".", pending: false },
    ]);
  });
});

describe("buildLegalPage (real sources)", () => {
  it("merges subencargados right after section 10 of the privacy policy, then the aviso and the cookies", () => {
    const page = buildLegalPage("privacidad");
    const ids = page.index.map((entry) => entry.id);

    expect(page.title).toBe(
      "Política de tratamiento de datos personales de Cogni",
    );
    const transfers = ids.findIndex((id) => id.startsWith("10-"));
    expect(ids[transfers + 1]).toBe("subencargados");
    expect(ids[transfers + 2]).toMatch(/^11-/);
    expect(ids.slice(-2)).toEqual(["aviso-de-privacidad", "cookies"]);
    expect(page.sections.map((section) => section.anchor)).toEqual([
      undefined,
      "subencargados",
      undefined,
      "aviso-de-privacidad",
      "cookies",
    ]);
  });

  it("merges the academic integrity code into acceptable use", () => {
    const page = buildLegalPage("uso-aceptable");
    expect(page.index.at(-1)).toEqual({
      id: "integridad-academica",
      label: "Código de integridad académica de Cogni",
    });
  });

  it("keeps every published document at version 1.0 with a pending effective date", () => {
    for (const slug of [
      "terminos",
      "privacidad",
      "uso-aceptable",
      "derechos-de-autor",
    ] as const) {
      const { metadata } = buildLegalPage(slug);
      expect(metadata.version).toBe("1.0");
      expect(metadata.effectiveFrom).toBe(
        "[PENDIENTE: fecha de entrada en vigor]",
      );
    }
  });
});
