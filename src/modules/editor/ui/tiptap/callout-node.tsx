"use client";

// Callout block (specs/editor/spec.md, "Conjunto completo de bloques de
// §3.2" and "Paleta de resaltado de Cogni y callouts"): a block-level node
// with a `kind` attribute in `idea | note | warning`, mapped to the
// callout design tokens (H7: yellow | violet | rose), a matching Lucide icon
// and an italic label by kind, inline at the start of the text.
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

// H7 follow-up (user reference callout-ref.png, translated to the light
// theme): each kind is a light tint of its hue with a 1px border in the mid
// step and a rounded frame (`--radius-callout`, the editor's one rounded
// block besides tables); the outlined icon takes the strong step and the
// text the deep step, so bold and inline code stay legible (globals.css
// `--color-callout-*`). Idea yellow, note violet, warning rose.
const CALLOUT_CLASSES: Record<CalloutKind, string> = {
  idea: "bg-callout-idea border-callout-idea-edge text-callout-idea-fg",
  note: "bg-callout-note border-callout-note-edge text-callout-note-fg",
  warning:
    "bg-callout-warning border-callout-warning-edge text-callout-warning-fg",
};

const CALLOUT_ICON_CLASSES: Record<CalloutKind, string> = {
  idea: "text-callout-idea-icon",
  note: "text-callout-note-icon",
  warning: "text-callout-warning-icon",
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
      className={`callout my-1.5 flex gap-3 rounded-(--radius-callout) border px-4 py-2.5 ${CALLOUT_CLASSES[kind]}`}
    >
      <Icon
        data-testid="callout-icon"
        aria-hidden="true"
        className={`mt-[5px] size-[18px] shrink-0 ${CALLOUT_ICON_CLASSES[kind]}`}
        strokeWidth={2}
      />
      {/* The label floats at the start of the first text row ("Idea clave ·
          Sin luz…"); flow-root contains the float. */}
      <div className="flow-root min-w-0 flex-1">
        <span
          data-testid="callout-label"
          contentEditable={false}
          className="float-left mr-1.5 select-none pt-[2px] text-base font-semibold italic leading-6"
        >
          {CALLOUT_LABELS[kind]} ·
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
