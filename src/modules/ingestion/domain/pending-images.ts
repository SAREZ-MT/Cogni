import type { ImportedBlock, ImportedDoc } from "./imported-doc";

// document-import T9: turns the extractor's pending image nodes
// (`attrs.pendingId`, an ExtractedImage key; document-extractor.ts) into
// real editor images once their bytes are stored as page assets. Pure: no
// I/O, never mutates its input.

type ImageBlock = Extract<ImportedBlock, { type: "image" }>;

// Every node that holds blocks needs at least one block in the content
// catalogue (doc, blockquote, callout, table cells, detailsContent); a
// listItem/taskItem always keeps its leading paragraph. When dropping
// images empties one, an empty paragraph keeps it valid.
const EMPTY_PARAGRAPH: ImportedBlock = { type: "paragraph" };

// Generic walk: only nodes with a `content` array of blocks can hold an
// image, so text/inline nodes come back as they are.
type AnyNode = { type: string; content?: unknown[]; attrs?: unknown };

function isPendingImage(node: AnyNode): node is ImageBlock {
  if (node.type !== "image") return false;
  const pendingId = (node as ImageBlock).attrs?.pendingId;
  return typeof pendingId === "string" && pendingId.length > 0;
}

// The ExtractedImage keys the content references, each once, in document
// order: only these are worth uploading.
export function pendingImageKeys(doc: ImportedDoc): string[] {
  const keys = new Set<string>();
  const visit = (node: AnyNode) => {
    if (isPendingImage(node)) keys.add(node.attrs.pendingId as string);
    for (const child of node.content ?? []) visit(child as AnyNode);
  };
  for (const block of doc.content) visit(block as AnyNode);
  return [...keys];
}

// `resolved` maps an ExtractedImage key to the page_assets id it was
// stored as. A pending image whose key is resolved gets that `assetId` and
// loses `pendingId` (the editor would otherwise try to upload it again); a
// pending image whose key is missing (upload failed, format or size not
// allowed, budget exhausted) is removed and counted in `removed`. Images
// that already carry an `assetId` and no `pendingId` are left untouched.
export function resolvePendingImages(
  doc: ImportedDoc,
  resolved: ReadonlyMap<string, string>,
): { content: ImportedDoc; removed: number } {
  let removed = 0;

  const resolveImage = (image: ImageBlock): ImageBlock | null => {
    const { pendingId, ...attrs } = image.attrs;
    const assetId = resolved.get(pendingId as string);
    if (!assetId) {
      removed++;
      return null;
    }
    return { ...image, attrs: { ...attrs, assetId } };
  };

  const visitChildren = (children: unknown[]): unknown[] => {
    const next: unknown[] = [];
    for (const child of children) {
      const node = child as AnyNode;
      if (isPendingImage(node)) {
        const image = resolveImage(node);
        if (image) next.push(image);
        continue;
      }
      next.push(visit(node));
    }
    if (next.length === 0 && children.length > 0) next.push(EMPTY_PARAGRAPH);
    return next;
  };

  const visit = (node: AnyNode): AnyNode => {
    if (!Array.isArray(node.content)) return node;
    return { ...node, content: visitChildren(node.content) };
  };

  const content = visitChildren(doc.content) as ImportedBlock[];
  return { content: { ...doc, content }, removed };
}
