// Tiny shared predicate (E2b scope E, table-toolbar.tsx + bubble-toolbar.tsx
// mutual-exclusion logic): `@tiptap/pm/tables` re-exports `prosemirror-
// tables` verbatim (confirmed by reading node_modules/@tiptap/pm/dist/
// tables/index.d.cts: `export * from "prosemirror-tables"`), and a
// CellSelection (a multi-cell range, as opposed to a plain caret/text
// selection that merely happens to sit inside a table) is the one selection
// shape neither toolbar treats the same way a normal text selection.
import type { Selection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";

export function isTableCellSelection(
  selection: Selection,
): selection is CellSelection {
  return selection instanceof CellSelection;
}
