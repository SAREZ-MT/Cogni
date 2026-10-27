import type { TiptapDoc, TiptapNode } from "../tiptap-doc";

// Test data: every node and mark of the content catalogue
// (../tiptap-catalogue.ts) at least once, with realistic attrs. Shared by
// the strict import schema tests (notebooks) and the editor round-trip and
// schema parity tests (editor/ui/tiptap/extensions/catalogue-parity.test.ts),
// so the import contract and the editor are proven against the same
// document. It ends with a paragraph so the editor's trailing-node plugin
// has nothing to append, and every table cell states its column widths
// (the editor's table plugin fills in any width a column leaves out).

const ASSET_ID = "6f1c2b9e-3d4a-4f5b-8c7d-9e0a1b2c3d4e";

const t = (text: string, marks?: TiptapNode["marks"]): TiptapNode =>
  marks ? { type: "text", text, marks } : { type: "text", text };
const p = (...content: TiptapNode[]): TiptapNode => ({
  type: "paragraph",
  content,
});
const item = (...content: TiptapNode[]): TiptapNode => ({
  type: "listItem",
  content,
});
const cell = (
  type: "tableHeader" | "tableCell",
  text: string,
  attrs?: Record<string, unknown>,
): TiptapNode => ({
  type,
  ...(attrs ? { attrs } : {}),
  content: [p(t(text))],
});

export const CATALOGUE_SAMPLE_DOC: TiptapDoc = {
  type: "doc",
  content: [
    { type: "tocBlock" },
    {
      type: "heading",
      attrs: { level: 1, textAlign: "center", blockId: "h-intro" },
      content: [t("Derivadas")],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "justify", nodeBackground: "yellow" },
      content: [
        t("La "),
        t("derivada", [{ type: "bold" }, { type: "italic" }]),
        t(" mide el "),
        t("cambio", [{ type: "underline" }]),
        t(" instantáneo; "),
        t("no la pendiente media", [{ type: "strike" }]),
        t(". Usa "),
        t("f'(x)", [{ type: "code" }]),
        t(", H"),
        t("2", [{ type: "subscript" }]),
        t("O, x"),
        t("2", [{ type: "superscript" }]),
        { type: "hardBreak" },
        t("Ver "),
        t("Khan Academy", [
          {
            type: "link",
            attrs: {
              href: "https://es.khanacademy.org/math/calculus-1",
              target: "_blank",
              rel: "noopener noreferrer",
              class: null,
              title: null,
            },
          },
        ]),
        t(" o "),
        t("escribe", [
          { type: "link", attrs: { href: "mailto:profe@example.com" } },
        ]),
        t(". "),
        t("Clave", [{ type: "highlight", attrs: { color: "pink" } }]),
        t(" y "),
        t("estilo", [
          {
            type: "textStyle",
            attrs: {
              color: "var(--color-pastel-purple-fg)",
              backgroundColor: "#fff3c4",
              fontFamily: "Inter, sans-serif",
              fontSize: "18px",
              lineHeight: "1.5",
            },
          },
        ]),
        t(": "),
        { type: "inlineMath", attrs: { latex: "\\frac{dy}{dx}" } },
        t(" "),
        { type: "emoji", attrs: { name: "brain" } },
        t(" "),
        {
          type: "mention",
          attrs: {
            id: "8a7b6c5d-4e3f-4a1b-9c8d-7e6f5a4b3c2d",
            label: "Límites",
            mentionSuggestionChar: "@",
            notebookId: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
          },
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 6, id: null, "data-toc-id": null },
      content: [t("Nivel 6")],
    },
    {
      type: "blockquote",
      attrs: { nodeBackground: "blue" },
      content: [p(t("Todo cambio tiene una tasa."))],
    },
    {
      type: "codeBlock",
      attrs: { language: "python" },
      content: [t("def f(x):\n    return x ** 2")],
    },
    { type: "horizontalRule" },
    {
      type: "bulletList",
      content: [
        item(p(t("Reglas")), {
          type: "orderedList",
          attrs: { start: 0, type: null },
          content: [item(p(t("Constante"))), item(p(t("Cadena")))],
        }),
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 3, type: "a" },
      content: [
        item(p(t("Producto")), {
          type: "bulletList",
          content: [item(p(t("f·g' + f'·g")))],
        }),
      ],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [p(t("Repasar límites"))],
        },
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [
            p(t("Practicar derivadas")),
            {
              type: "taskList",
              content: [
                {
                  type: "taskItem",
                  attrs: { checked: false },
                  content: [p(t("Regla de la cadena"))],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            cell("tableHeader", "Función y derivada", {
              colspan: 2,
              rowspan: 1,
              colwidth: [120, 80],
            }),
            cell("tableHeader", "Nota", { colwidth: [100] }),
          ],
        },
        {
          type: "tableRow",
          content: [
            cell("tableCell", "x²", {
              colspan: 1,
              rowspan: 1,
              colwidth: [120],
            }),
            cell("tableCell", "2x", { colwidth: [80] }),
            cell("tableCell", "Potencias", { rowspan: 2, colwidth: [100] }),
          ],
        },
        {
          type: "tableRow",
          content: [
            cell("tableCell", "sen x", { colwidth: [120] }),
            cell("tableCell", "cos x", { colwidth: [80] }),
          ],
        },
      ],
    },
    {
      type: "image",
      attrs: {
        assetId: ASSET_ID,
        pendingId: null,
        align: "left",
        caption: "Recta tangente",
        alt: "Gráfica de una recta tangente a una parábola",
      },
    },
    {
      type: "callout",
      attrs: { kind: "warning" },
      content: [p(t("La derivada no siempre existe."))],
    },
    {
      type: "details",
      attrs: { open: false },
      content: [
        { type: "detailsSummary", content: [t("Notas del orador")] },
        { type: "detailsContent", content: [p(t("Empieza con un ejemplo."))] },
      ],
    },
    {
      type: "blockMath",
      attrs: { latex: "f'(x)=\\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}" },
    },
    {
      type: "youtube",
      attrs: {
        src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        width: 640,
        height: 360,
        start: 42,
      },
    },
    p(t("Fin del resumen.")),
  ],
};
