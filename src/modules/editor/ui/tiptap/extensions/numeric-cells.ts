// H7 (editor polish round 2): table cells that hold only a number get an
// `is-numeric` class so globals.css can right-align them (tables already use
// tabular figures). A view decoration, not an attribute: nothing new is
// stored, so the content catalogue, import and plain text stay unchanged.
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// An optional sign or currency, digits with `.`/`,`/space grouping and an
// optional decimal part, then an optional unit symbol (%, €, $). Words such
// as "12 tarjetas" or ranges such as "1-2" stay left-aligned text.
const NUMERIC_CELL =
  /^[+-]?(?:[$€£]\s?)?\d{1,3}(?:[.,\s]?\d{3})*(?:[.,]\d+)?\s?(?:%|€|\$)?$|^[+-]?(?:[$€£]\s?)?\d+(?:[.,]\d+)?\s?(?:%|€|\$)?$/;

export function isNumericCellText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && NUMERIC_CELL.test(trimmed);
}

const CELL_TYPES = new Set(["tableCell", "tableHeader"]);

function numericCellDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!CELL_TYPES.has(node.type.name)) return true;
    if (isNumericCellText(node.textContent)) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, { class: "is-numeric" }),
      );
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

const numericCellsKey = new PluginKey<DecorationSet>("numericCells");

export const NumericCells = Extension.create({
  name: "numericCells",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: numericCellsKey,
        state: {
          init: (_, state) => numericCellDecorations(state.doc),
          apply: (tr, previous) =>
            tr.docChanged ? numericCellDecorations(tr.doc) : previous,
        },
        props: {
          decorations: (state) => numericCellsKey.getState(state),
        },
      }),
    ];
  },
});
