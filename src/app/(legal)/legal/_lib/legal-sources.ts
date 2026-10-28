import { readFileSync } from "node:fs";
import { join } from "node:path";

// The published legal texts live in src/content/legal/*.md (authoritative
// copy, see docs/legal/README.md). Each read uses a literal
// `join(process.cwd(), "...")` path, the pattern Next.js output file tracing
// follows (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md),
// so the files ship with the deployed routes.
const READERS = {
  terminos: () =>
    readFileSync(
      join(process.cwd(), "src/content/legal/terminos-y-condiciones.md"),
      "utf8",
    ),
  datos: () =>
    readFileSync(
      join(
        process.cwd(),
        "src/content/legal/politica-de-tratamiento-de-datos.md",
      ),
      "utf8",
    ),
  aviso: () =>
    readFileSync(
      join(process.cwd(), "src/content/legal/aviso-de-privacidad.md"),
      "utf8",
    ),
  cookies: () =>
    readFileSync(
      join(process.cwd(), "src/content/legal/politica-de-cookies.md"),
      "utf8",
    ),
  subencargados: () =>
    readFileSync(
      join(process.cwd(), "src/content/legal/subencargados.md"),
      "utf8",
    ),
  usoAceptable: () =>
    readFileSync(
      join(
        process.cwd(),
        "src/content/legal/politica-de-uso-aceptable-e-ia.md",
      ),
      "utf8",
    ),
  integridad: () =>
    readFileSync(
      join(
        process.cwd(),
        "src/content/legal/codigo-de-integridad-academica.md",
      ),
      "utf8",
    ),
  derechosDeAutor: () =>
    readFileSync(
      join(process.cwd(), "src/content/legal/politica-de-derechos-de-autor.md"),
      "utf8",
    ),
} as const;

export type LegalSourceId = keyof typeof READERS;

export function readLegalSource(id: LegalSourceId): string {
  return READERS[id]();
}
