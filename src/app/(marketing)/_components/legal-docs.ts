// The public legal documents of Cogni, in footer and side-index order. Each
// one is rendered from its markdown copy at /legal/<slug> (legal/_content,
// copied verbatim from docs/legal on the docs/legal-framework branch).
export type LegalDoc = {
  slug: string;
  // Markdown file name under legal/_content.
  file: string;
  // The document's own H1, used as the page title.
  title: string;
  // Short label for the footer and the side index.
  label: string;
};

export const LEGAL_DOCS: readonly LegalDoc[] = [
  {
    slug: "terminos",
    file: "terminos-y-condiciones.md",
    title: "Términos y condiciones de uso de Cogni",
    label: "Términos y condiciones",
  },
  {
    slug: "datos-personales",
    file: "politica-de-tratamiento-de-datos.md",
    title: "Política de tratamiento de datos personales de Cogni",
    label: "Tratamiento de datos",
  },
  {
    slug: "aviso-de-privacidad",
    file: "aviso-de-privacidad.md",
    title: "Aviso de privacidad de Cogni",
    label: "Aviso de privacidad",
  },
  {
    slug: "cookies",
    file: "politica-de-cookies.md",
    title: "Política de cookies de Cogni",
    label: "Cookies",
  },
  {
    slug: "uso-aceptable",
    file: "politica-de-uso-aceptable-e-ia.md",
    title: "Política de uso aceptable y de inteligencia artificial de Cogni",
    label: "Uso aceptable e IA",
  },
  {
    slug: "integridad-academica",
    file: "codigo-de-integridad-academica.md",
    title: "Código de integridad académica de Cogni",
    label: "Integridad académica",
  },
  {
    slug: "derechos-de-autor",
    file: "politica-de-derechos-de-autor.md",
    title: "Política de derechos de autor de Cogni",
    label: "Derechos de autor",
  },
  {
    slug: "subencargados",
    file: "subencargados.md",
    title: "Lista de subencargados y proveedores de Cogni",
    label: "Subencargados",
  },
];

export const legalHref = (slug: string) => `/legal/${slug}`;

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}
