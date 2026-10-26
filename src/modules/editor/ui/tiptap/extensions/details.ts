// document-import T3: collapsible blocks (`details` > `detailsSummary` +
// `detailsContent`), which the importer uses for slide speaker notes
// ("Notas del orador"). Rendering only: no slash item or toolbar yet.
//
// node_modules/@tiptap/extension-details (3.31.3): `persist: true` adds the
// `open` attr (content catalogue `details.open`), so a block a reader
// expanded stays expanded after a save. The summary holds plain text: the
// catalogue forbids marks there, so the editor does too (`marks: ""`),
// otherwise a bolded summary would fail the import contract.
import {
  Details,
  DetailsContent,
  DetailsSummary,
} from "@tiptap/extension-details";

export function createDetailsExtensions() {
  return [
    Details.configure({ persist: true }),
    DetailsSummary.extend({ marks: "" }),
    DetailsContent,
  ];
}
