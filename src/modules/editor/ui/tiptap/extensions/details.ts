// document-import T3: collapsible blocks (`details` > `detailsSummary` +
// `detailsContent`), which the importer uses for slide speaker notes
// ("Notas del orador"). Rendering only: no slash item or toolbar yet.
//
// node_modules/@tiptap/extension-details (3.31.3): `persist: true` adds the
// `open` attr (content catalogue `details.open`), so a block a reader
// expanded stays expanded after a save. The summary holds plain text: the
// catalogue forbids marks there, so the editor does too (`marks: ""`),
// otherwise a bolded summary would fail the import contract.
//
// The extension's node view applies a stored `open` in a setTimeout that
// *toggles* the class, while its `update()` sets it to the node's value. An
// update landing before that timer (any change inside the block right after
// load) opened the block and the timer then closed it again — a persisted
// open block rendered closed (CI run 41101107557, pptx-import.spec.ts).
// `SyncedOpenDetails` re-applies the node's state once that timer has run.
import {
  Details,
  DetailsContent,
  DetailsSummary,
} from "@tiptap/extension-details";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const SyncedOpenDetails = Details.extend({
  addNodeView() {
    const parent = this.parent?.();
    if (!parent) return null;
    return (props) => {
      const view = parent(props);
      const update = view.update?.bind(view);
      if (!update || !props.node.attrs.open) return view;
      let current: ProseMirrorNode = props.node;
      view.update = (node, decorations, innerDecorations) => {
        const updated = update(node, decorations, innerDecorations);
        if (updated) current = node;
        return updated;
      };
      // Queued after the extension's own timer, so it runs right after it.
      setTimeout(() => update(current, [], props.innerDecorations));
      return view;
    };
  },
});

export function createDetailsExtensions() {
  return [
    SyncedOpenDetails.configure({ persist: true }),
    DetailsSummary.extend({ marks: "" }),
    DetailsContent,
  ];
}
