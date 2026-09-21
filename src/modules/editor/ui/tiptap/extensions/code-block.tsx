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

const lowlight = createLowlight();
lowlight.register({ bash, css, javascript, json, python, typescript, xml });

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

function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const language =
    typeof node.attrs.language === "string" ? node.attrs.language : "";

  return (
    <NodeViewWrapper
      data-testid="code-block"
      className="not-prose relative my-2 overflow-hidden rounded-2xl bg-muted"
    >
      <select
        aria-label="Lenguaje"
        contentEditable={false}
        data-testid="code-block-language"
        className="absolute top-2 right-2 rounded-md border border-border bg-background px-2 py-1 text-xs text-fg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={language}
        onChange={(event) => {
          updateAttributes({ language: event.target.value || null });
        }}
      >
        {CODE_BLOCK_LANGUAGES.map((option) => (
          <option key={option.label} value={option.value ?? ""}>
            {option.label}
          </option>
        ))}
      </select>
      <pre className="overflow-x-auto p-4 pr-28 font-mono text-sm">
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({ lowlight });
