"use client";

import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {
  NodeViewContent,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
// Code block with syntax highlighting (specs/editor/spec.md, "Conjunto
// completo de bloques de §3.2", Scenario "Bloque de código con lenguaje").
// `@tiptap/extension-code-block-lowlight` replaces starter-kit's own
// `codeBlock` (disabled in `../extensions/index.ts`) and decorates the
// code text with `.hljs-*` classes at render time via a ProseMirror
// plugin; the actual color mapping for those classes lives in
// `src/app/globals.css` (design.md, "Aplicar el tema de resaltado de
// sintaxis"), never here or in a third-party theme.
//
// `createLowlight()` starts with an empty grammar registry — only the
// subset below is registered, per tasks.md 5b.1 ("al menos JS/TS, Python,
// HTML, CSS, JSON, bash"), instead of `common` (60+ languages) to keep
// the selector short and the bundle lean.
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { createLowlight } from "lowlight";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { createCodeBlockPastePlugin } from "./code-block-paste";

const registry = createLowlight();
registry.register({ bash, css, javascript, json, python, typescript, xml });

// document-import T11b: the lowlight plugin falls back to
// `highlightAuto` whenever a block's `language` is null (or not
// registered), and 3.31.3 has no option to turn that off — so a block the
// selector labels "Texto sin formato" still came out coloured. Answering
// auto-detection with the text as one unclassed node keeps such blocks
// plain; blocks with a registered language still go through `highlight`.
const lowlight: typeof registry = {
  ...registry,
  highlightAuto: (value) => ({
    type: "root",
    children: [{ type: "text", value }],
    data: { language: undefined, relevance: 0 },
  }),
};

export interface CodeBlockLanguageOption {
  value: string | null;
  label: string;
}

// Human labels for the language selector (Spanish, "tú", sentence case).
// `null` ("Texto sin formato") disables highlighting for that block.
export const CODE_BLOCK_LANGUAGES: CodeBlockLanguageOption[] = [
  { value: null, label: "Texto sin formato" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "xml", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash" },
];

// H6-E4 (odd/tasks/phase-8-design-flows.md): Notion's discreet language
// control instead of a native select — a quiet label at the block's
// top-right that shows on hover, while the caret is in the block, or on
// keyboard focus, and opens a small menu of the registered languages. The
// trigger stays in the tab order and Radix's menu handles Enter/arrows.
function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const language =
    typeof node.attrs.language === "string" ? node.attrs.language : "";
  const current =
    CODE_BLOCK_LANGUAGES.find((option) => (option.value ?? "") === language) ??
    CODE_BLOCK_LANGUAGES[0];

  return (
    <NodeViewWrapper
      data-testid="code-block"
      className="group/code not-prose relative my-1 overflow-hidden rounded-(--radius-editor) bg-code-block"
    >
      <div contentEditable={false} className="absolute top-1.5 right-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Lenguaje: ${current.label}`}
              data-testid="code-block-language"
              data-language={language}
              className="flex items-center gap-1 rounded-(--radius-editor) px-1.5 py-0.5 text-xs text-fg-muted opacity-0 outline-none transition-opacity duration-150 hover:bg-hover hover:text-fg-secondary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/code:opacity-100 group-focus-within/code:opacity-100 data-[state=open]:opacity-100"
            >
              {current.label}
              <ChevronDown aria-hidden="true" size={12} strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="editor-surface w-auto min-w-40 p-1"
          >
            <DropdownMenuRadioGroup
              value={language}
              onValueChange={(value) => {
                updateAttributes({ language: value || null });
              }}
            >
              {CODE_BLOCK_LANGUAGES.map((option) => (
                <DropdownMenuRadioItem
                  key={option.label}
                  value={option.value ?? ""}
                  className="text-[13px]"
                >
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm">
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlock = CodeBlockLowlight.extend({
  // H8-6: pasted code keeps its lines and indentation (code-block-paste.ts).
  // Listed first so it runs before the parent's VS Code paste handler.
  addProseMirrorPlugins() {
    return [
      createCodeBlockPastePlugin(this.editor, this.name),
      ...(this.parent?.() ?? []),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({ lowlight });
