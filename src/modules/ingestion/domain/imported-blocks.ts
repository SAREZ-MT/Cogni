import type {
  ImportedBlock,
  ImportedBulletList,
  ImportedInline,
  ImportedListItem,
  ImportedMark,
  ImportedOrderedList,
  ImportedParagraph,
} from "./imported-doc";

// document-import T6/T7: block builders the per-format mappers share
// (moved out of the DOCX mapper when the PPTX mapper needed the same
// rules).

// Longest alt text kept on an image node (and its ExtractedImage).
export const MAX_ALT_LENGTH = 2000;

export function sameMarks(
  a: ImportedMark[] | undefined,
  b: ImportedMark[] | undefined,
) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

// A list or task item must start with a paragraph.
export function itemContent(
  blocks: ImportedBlock[],
): [ImportedParagraph, ...ImportedBlock[]] {
  const [first, ...rest] = blocks;
  if (first?.type === "paragraph") return [first, ...rest];
  return [{ type: "paragraph" }, ...blocks];
}

export function mergeTexts(inlines: ImportedInline[]): ImportedInline[] {
  const out: ImportedInline[] = [];
  for (const inline of inlines) {
    const last = out.at(-1);
    if (
      inline.type === "text" &&
      last?.type === "text" &&
      sameMarks(last.marks, inline.marks)
    ) {
      out[out.length - 1] = { ...last, text: last.text + inline.text };
    } else if (inline.type !== "text" || inline.text.length > 0) {
      out.push(inline);
    }
  }
  return out;
}

// Drops leading/trailing hard breaks and a content that is only
// whitespace, so no empty paragraph survives.
export function trimInlines(inlines: ImportedInline[]): ImportedInline[] {
  let start = 0;
  let end = inlines.length;
  while (start < end && inlines[start].type === "hardBreak") start++;
  while (end > start && inlines[end - 1].type === "hardBreak") end--;
  const content = inlines.slice(start, end);
  const meaningful = content.some(
    (inline) => inline.type !== "text" || inline.text.trim().length > 0,
  );
  return meaningful ? content : [];
}

// Builds nested bullet/ordered lists from flat (level, ordered) items.
export class ListBuilder {
  private readonly roots: Array<ImportedBulletList | ImportedOrderedList> = [];
  private stack: Array<{
    list: ImportedBulletList | ImportedOrderedList;
    level: number;
    listId: string | null;
  }> = [];

  add(
    level: number,
    ordered: boolean,
    listId: string | null,
    start: () => number,
    content: ImportedListItem["content"],
  ): ImportedListItem {
    while (this.stack.length > 0 && (this.stack.at(-1)?.level ?? 0) > level) {
      this.stack.pop();
    }
    const top = this.stack.at(-1);
    const isOrdered = (list: ImportedBulletList | ImportedOrderedList) =>
      list.type === "orderedList";
    if (
      top &&
      top.level === level &&
      (isOrdered(top.list) !== ordered ||
        (this.stack.length === 1 &&
          listId !== null &&
          top.listId !== null &&
          listId !== top.listId))
    ) {
      this.stack.pop();
    }
    const item: ImportedListItem = { type: "listItem", content };
    const current = this.stack.at(-1);
    if (current && current.level === level) {
      current.list.content.push(item);
      return item;
    }
    const list = newList(ordered, start(), item);
    if (current) {
      // Nested under the parent's last item.
      const parentItem = current.list.content.at(-1);
      parentItem?.content.push(list);
    } else {
      this.roots.push(list);
    }
    this.stack.push({ list, level, listId });
    return item;
  }

  finish(): ImportedBlock[] {
    return this.roots;
  }
}

export function newList(
  ordered: boolean,
  start: number,
  item: ImportedListItem,
): ImportedBulletList | ImportedOrderedList {
  if (!ordered) return { type: "bulletList", content: [item] };
  return start !== 1
    ? { type: "orderedList", attrs: { start }, content: [item] }
    : { type: "orderedList", content: [item] };
}
