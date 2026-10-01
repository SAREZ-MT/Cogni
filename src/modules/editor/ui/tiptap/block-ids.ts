// Helpers around the stable `blockId` attribute that `UniqueID`
// (extensions/index.ts) assigns to blocks. Ids are bookkeeping, not content:
// assigning them is never an edit (editor.tsx), and "Copiar enlace" may only
// link to an id that is already persisted (block-context-menu.tsx).
import type { JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const BLOCK_ID_ATTR = "blockId";

export function collectBlockIds(node: JSONContent): Set<string> {
  const ids = new Set<string>();
  const visit = (current: JSONContent) => {
    const id = current.attrs?.[BLOCK_ID_ATTR];
    if (typeof id === "string" && id) ids.add(id);
    current.content?.forEach(visit);
  };
  visit(node);
  return ids;
}

export function stripBlockIds(node: JSONContent): JSONContent {
  const { [BLOCK_ID_ATTR]: _removed, ...attrs } = node.attrs ?? {};
  const copy: JSONContent = { ...node };
  if (node.attrs) copy.attrs = attrs;
  if (node.content) copy.content = node.content.map(stripBlockIds);
  return copy;
}

// True when two documents differ at most in their block ids — the shape of
// the transaction UniqueID dispatches to label existing blocks.
export function isBlockIdOnlyChange(
  before: ProseMirrorNode,
  after: ProseMirrorNode,
): boolean {
  return (
    JSON.stringify(stripBlockIds(before.toJSON())) ===
    JSON.stringify(stripBlockIds(after.toJSON()))
  );
}
