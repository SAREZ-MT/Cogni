// Table block (specs/editor/spec.md, "Conjunto completo de bloques de
// §3.2", Scenario "Tabla editable"). `resizable: false` per the tasks.md
// note — column resize handles are out of scope for this slice; only the
// insert/add-row/add-column/edit-cell affordances are required.
import type { AnyExtension } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import { NumericCells } from "./numeric-cells";

// H7: NumericCells right-aligns cells that hold only a number (a view
// decoration; see numeric-cells.ts).
export function createTableExtensions(): AnyExtension[] {
  return [TableKit.configure({ table: { resizable: false } }), NumericCells];
}
