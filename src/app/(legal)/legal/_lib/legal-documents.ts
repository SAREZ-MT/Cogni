import type { LegalSourceId } from "./legal-sources";

// The public legal page set (feature legal-consent, L1). Several source
// documents are merged into one page: each extra source becomes a section
// with a stable anchor that the other documents link to.
export type LegalPageSlug =
  | "terminos"
  | "privacidad"
  | "uso-aceptable"
  | "derechos-de-autor";

export type LegalPart = {
  source: LegalSourceId;
  // Set only on merged sources: the section anchor (e.g. "cookies").
  anchor?: string;
  // Slice the source by heading lines: keep from the first line that starts
  // with `from` and stop before the first line that starts with `until`.
  from?: string;
  until?: string;
};

export type LegalPageDefinition = {
  slug: LegalPageSlug;
  href: `/legal/${LegalPageSlug}`;
  navLabel: string;
  description: string;
  parts: readonly LegalPart[];
};

export const LEGAL_PAGES: readonly LegalPageDefinition[] = [
  {
    slug: "terminos",
    href: "/legal/terminos",
    navLabel: "Términos y condiciones",
    description: "Términos y condiciones de uso de Cogni.",
    parts: [{ source: "terminos" }],
  },
  {
    slug: "privacidad",
    href: "/legal/privacidad",
    navLabel: "Política de privacidad",
    description:
      "Política de tratamiento de datos personales, lista de subencargados, aviso de privacidad y política de cookies de Cogni.",
    parts: [
      { source: "datos", until: "## 11." },
      // Right after "10. Destinatarios, transmisiones y transferencias
      // internacionales", which links here (user decision 2026-10-28).
      { source: "subencargados", anchor: "subencargados" },
      { source: "datos", from: "## 11." },
      { source: "aviso", anchor: "aviso-de-privacidad" },
      { source: "cookies", anchor: "cookies" },
    ],
  },
  {
    slug: "uso-aceptable",
    href: "/legal/uso-aceptable",
    navLabel: "Uso aceptable e IA",
    description:
      "Política de uso aceptable y de inteligencia artificial y código de integridad académica de Cogni.",
    parts: [
      { source: "usoAceptable" },
      { source: "integridad", anchor: "integridad-academica" },
    ],
  },
  {
    slug: "derechos-de-autor",
    href: "/legal/derechos-de-autor",
    navLabel: "Derechos de autor",
    description: "Política de derechos de autor de Cogni.",
    parts: [{ source: "derechosDeAutor" }],
  },
];

export const LEGAL_DRAFT_NOTICE =
  "Borrador — pendiente de completar datos y de revisión legal";

export function legalPage(slug: LegalPageSlug): LegalPageDefinition {
  const page = LEGAL_PAGES.find((candidate) => candidate.slug === slug);
  if (!page) throw new Error(`Unknown legal page: ${slug}`);
  return page;
}
