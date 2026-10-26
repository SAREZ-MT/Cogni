"use client";

// Callout block (specs/editor/spec.md, "Conjunto completo de bloques de
// §3.2" and "Paleta de resaltado de Cogni y callouts"): a block-level node
// with a `kind` attribute in `idea | note | warning`, mapped to the
// `yellow | blue | orange` design tokens and a matching Lucide icon.
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

// specs/editor/spec.md: "idea" → yellow, "note" → blue, "warning" → orange.
const CALLOUT_CLASSES: Record<CalloutKind, string> = {
  idea: "bg-pastel-yellow text-pastel-yellow-fg",
  note: "bg-pastel-blue text-pastel-blue-fg",
  warning: "bg-pastel-orange text-pastel-orange-fg",
};

const CALLOUT_ICONS: Record<CalloutKind, typeof Lightbulb> = {
  idea: Lightbulb,
  note: Info,
  warning: TriangleAlert,
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
      className={`flex gap-2 rounded-2xl p-4 ${CALLOUT_CLASSES[kind]}`}
    >
      <Icon
        data-testid="callout-icon"
        className="mt-0.5 size-5 shrink-0"
        strokeWidth={1.75}
      />
      <NodeViewContent className="flex-1" />
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
