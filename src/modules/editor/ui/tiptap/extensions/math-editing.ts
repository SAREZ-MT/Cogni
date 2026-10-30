// H7 (editor polish round 2): writing formulas. The block and inline math
// nodes (@tiptap/extension-mathematics, KaTeX) were render-only; this adds
// the ways in:
// - `$…$` typed in text becomes inline math (CogniInlineMath; the
//   extension's own `$$…$$` rule stays);
// - the slash menu's "Ecuación" / "Ecuación en línea", a click on a
//   formula, or Enter on a selected one ask the editor's LaTeX input
//   (math-editor.tsx) to open, through a DOM event on the editor view;
// - `commitMath` writes what the input holds: insert, update, or remove
//   when emptied, so an empty formula is never stored (the catalogue
//   requires non-empty LaTeX).
import { type Editor, Extension, InputRule } from "@tiptap/core";
import { InlineMath } from "@tiptap/extension-mathematics";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";

export type MathKind = "block" | "inline";

export interface MathEditRequest {
  kind: MathKind;
  // The existing formula's position, or null to insert at the selection.
  pos: number | null;
  latex: string;
}

export const MATH_EDIT_EVENT = "cogni:math-edit";

export function requestMathEdit(editor: Editor, request: MathEditRequest) {
  editor.view.dom.dispatchEvent(
    new CustomEvent<MathEditRequest>(MATH_EDIT_EVENT, { detail: request }),
  );
}

// Pasted formulas often keep their delimiters ($$…$$, $…$, \[…\], \(…\));
// the node stores the bare LaTeX.
const DELIMITERS: RegExp[] = [
  /^\$\$([\s\S]*)\$\$$/,
  /^\$([\s\S]*)\$$/,
  /^\\\[([\s\S]*)\\\]$/,
  /^\\\(([\s\S]*)\\\)$/,
];

export function normalizeLatex(input: string): string {
  const trimmed = input.trim();
  for (const delimiter of DELIMITERS) {
    const match = trimmed.match(delimiter);
    if (match) return match[1].trim();
  }
  return trimmed;
}

export function mathKindOf(node: ProseMirrorNode): MathKind | null {
  if (node.type.name === "blockMath") return "block";
  if (node.type.name === "inlineMath") return "inline";
  return null;
}

export function commitMath(
  editor: Editor,
  request: MathEditRequest,
  raw: string,
): boolean {
  const latex = normalizeLatex(raw);
  const block = request.kind === "block";
  const chain = editor.chain().focus();
  if (request.pos === null) {
    if (!latex) return false;
    return block
      ? chain.insertBlockMath({ latex }).run()
      : chain.insertInlineMath({ latex }).run();
  }
  const pos = request.pos;
  if (!latex) {
    return block
      ? chain.deleteBlockMath({ pos }).run()
      : chain.deleteInlineMath({ pos }).run();
  }
  return block
    ? chain.updateBlockMath({ pos, latex }).run()
    : chain.updateInlineMath({ pos, latex }).run();
}

// `$x^2$`: a single dollar on each side, not preceded by another dollar or
// a letter/digit, with content that neither starts nor ends with a space —
// so prices ("$5 y $ 10") and `$$…$$` stay untouched.
export const INLINE_DOLLAR_MATH = /(?<![$\w])\$([^\s$](?:[^$\n]*[^\s$])?)\$$/;

export const CogniInlineMath = InlineMath.extend({
  addInputRules() {
    return [
      ...(this.parent?.() ?? []),
      new InputRule({
        find: INLINE_DOLLAR_MATH,
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(
            range.from,
            range.to,
            this.type.create({ latex: match[1] }),
          );
        },
      }),
    ];
  },
});

export const MathEditing = Extension.create({
  name: "mathEditing",
  // Ahead of the default Enter handlers, which would otherwise act on the
  // selected formula first.
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection)) return false;
        const kind = mathKindOf(selection.node);
        if (!kind) return false;
        requestMathEdit(editor, {
          kind,
          pos: selection.from,
          latex: String(selection.node.attrs.latex ?? ""),
        });
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("mathEditing"),
        props: {
          handleClickOn: (_view, _pos, node, nodePos, _event, direct) => {
            if (!direct || !editor.isEditable) return false;
            const kind = mathKindOf(node);
            if (!kind) return false;
            requestMathEdit(editor, {
              kind,
              pos: nodePos,
              latex: String(node.attrs.latex ?? ""),
            });
            return true;
          },
        },
      }),
    ];
  },
});
