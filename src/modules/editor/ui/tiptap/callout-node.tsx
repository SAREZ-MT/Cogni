"use client";

// Callout block (specs/editor/spec.md, "Conjunto completo de bloques de
// §3.2" and "Paleta de resaltado de Cogni y callouts"): a block-level node
// with a `kind` attribute in `idea | note | warning`, mapped to the
// callout design tokens (H7: yellow | violet | rose), a matching Lucide icon
// and an italic label by kind.
// `content: "block+"` so a callout can hold any number of paragraphs/
// lists, like blockquote in @tiptap/starter-kit.
import { mergeAttributes, Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import {
  CALLOUT_KINDS,
  type CalloutKind,
} from "@/shared/kernel/tiptap-catalogue";

// The kinds come from the content catalogue (the import contract), so the
// editor and imported content cannot drift apart.
export { CALLOUT_KINDS, type CalloutKind };

export function isCalloutKind(value: unknown): value is CalloutKind {
  return (
    typeof value === "string" &&
    (CALLOUT_KINDS as readonly string[]).includes(value)
  );
}

// H7 (editor polish round 2): the kinds take the landing pillar band hues
// with real body — idea yellow, note violet, warning rose (globals.css
// `--color-callout-*`) — behind ink text. The icon and the label carry the
// kind's deep ink.
const CALLOUT_CLASSES: Record<CalloutKind, string> = {
  idea: "bg-callout-idea",
  note: "bg-callout-note",
  warning: "bg-callout-warning",
};

const CALLOUT_INK_CLASSES: Record<CalloutKind, string> = {
  idea: "text-callout-idea-fg",
  note: "text-callout-note-fg",
  warning: "text-callout-warning-fg",
};

const CALLOUT_ICONS: Record<CalloutKind, typeof Lightbulb> = {
  idea: Lightbulb,
  note: Info,
  warning: TriangleAlert,
};

// The label is rendered by kind, outside the editable content, so the
// stored document, the plain text the AI reads and the content catalogue
// never see it.
export const CALLOUT_LABELS: Record<CalloutKind, string> = {
  idea: "Idea clave",
  note: "Nota",
  warning: "Cuidado",
};

function CalloutView({ node }: ReactNodeViewProps) {
  const kind: CalloutKind = isCalloutKind(node.attrs.kind)
    ? node.attrs.kind
    : "idea";
  const Icon = CALLOUT_ICONS[kind];

  return (
    <NodeViewWrapper
      data-testid="callout"
      data-kind={kind}
      className={`my-1.5 flex gap-3 rounded-(--radius-editor) px-4 py-3 text-fg ${CALLOUT_CLASSES[kind]}`}
    >
      <Icon
        data-testid="callout-icon"
        aria-hidden="true"
        className={`mt-0.5 size-5 shrink-0 ${CALLOUT_INK_CLASSES[kind]}`}
        strokeWidth={2}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          data-testid="callout-label"
          contentEditable={false}
          className={`select-none text-sm font-semibold italic leading-6 ${CALLOUT_INK_CLASSES[kind]}`}
        >
          {CALLOUT_LABELS[kind]}
        </span>
        <NodeViewContent className="min-w-0" />
      </div>
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: "idea",
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-kind");
          return isCalloutKind(value) ? value : "idea";
        },
        renderHTML: (attributes: { kind?: unknown }) => {
          const kind = isCalloutKind(attributes.kind)
            ? attributes.kind
            : "idea";
          return { "data-kind": kind };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});
