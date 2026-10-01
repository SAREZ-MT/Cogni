"use client";

// Table-of-contents block (goal doc §2): "a TOC block node ... (like the
// template's toc-node: a card listing headings with anchor links, empty
// state 'Añade encabezados para ver el índice')". `@tiptap/extension-table-
// of-contents` (registered in extensions/index.ts) is a heading-tracking
// utility extension with no node/UI of its own — its `onUpdate` callback
// contract and storage shape aren't confirmed anywhere in the fetched
// Tiptap docs beyond one ambiguous snippet, so instead of guessing it, this
// node view computes its own heading list directly from `editor.state.doc`
// on every `update`/`selectionUpdate` event. That keeps it self-contained
// and always correct, at the cost of one small duplication (this node
// already knows how to find headings; the registered extension is honest
// idle capacity for a future E2 sidebar or `insertTocNode`-style command
// that wants the official incremental tracking instead of a full doc walk).
import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { ListTree } from "lucide-react";
import { useEffect, useState } from "react";

interface TocHeading {
  pos: number;
  level: number;
  text: string;
}

function collectHeadings(doc: PMNode) {
  const headings: TocHeading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    headings.push({
      pos,
      level: (node.attrs.level as number | undefined) ?? 1,
      text: node.textContent,
    });
  });
  return headings;
}

function headingsEqual(a: TocHeading[], b: TocHeading[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every(
    (heading, index) =>
      heading.pos === b[index].pos &&
      heading.level === b[index].level &&
      heading.text === b[index].text,
  );
}

function TocView({ editor }: ReactNodeViewProps) {
  const [headings, setHeadings] = useState<TocHeading[]>(() =>
    collectHeadings(editor.state.doc),
  );

  // Runtime-error fix (E2 coordinator report, "Maximum update depth
  // exceeded" right after the page loads, before typing — reproduced on a
  // page whose content already has a `tocBlock`, so this view mounts
  // immediately): `update`/`selectionUpdate` fire for every transaction,
  // including ones this component's own re-render can indirectly cause
  // (e.g. a sibling node view's own decoration sync during the same
  // document pass). Without an equality check, `refresh` handed React a
  // brand-new array on every single one of those notifications forever,
  // even when the heading list itself hadn't changed — this guard makes
  // `setHeadings` a no-op once the computed list stops differing, the same
  // "recompute, compare, only update when it actually changed" contract
  // `useEditorState`'s own selector uses (bubble-toolbar.tsx) elsewhere in
  // this editor.
  useEffect(() => {
    function refresh() {
      setHeadings((current) => {
        const next = collectHeadings(editor.state.doc);
        return headingsEqual(current, next) ? current : next;
      });
    }
    editor.on("update", refresh);
    editor.on("selectionUpdate", refresh);
    return () => {
      editor.off("update", refresh);
      editor.off("selectionUpdate", refresh);
    };
  }, [editor]);

  return (
    <NodeViewWrapper
      data-testid="toc-block"
      contentEditable={false}
      className="flex flex-col gap-2 rounded-2xl border border-border-default bg-card p-4"
    >
      <div className="flex items-center gap-1.5 font-semibold text-fg-secondary text-xs uppercase tracking-wide">
        <ListTree aria-hidden="true" size={14} strokeWidth={1.75} />
        Tabla de contenidos
      </div>
      {headings.length === 0 ? (
        <p className="text-fg-muted text-sm">
          Añade encabezados para ver el índice
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {headings.map((heading) => (
            <li
              key={heading.pos}
              style={{ marginLeft: (heading.level - 1) * 12 }}
            >
              <button
                type="button"
                data-testid="toc-block-item"
                className="text-left text-fg-secondary text-sm hover:text-fg hover:underline"
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .setTextSelection(heading.pos + 1)
                    .scrollIntoView()
                    .run()
                }
              >
                {heading.text || "Sin título"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </NodeViewWrapper>
  );
}

export const TocBlock = Node.create({
  name: "tocBlock",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="toc-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toc-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocView);
  },
});
