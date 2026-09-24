// Tiptap extension set for the base editor (PR3b). This is the ONLY place
// in the editor module allowed to import Tiptap/ProseMirror packages
// (design.md, "Tiptap y ProseMirror solo en editor/ui"; enforced by the
// `editor-tiptap-only-in-ui` dependency-cruiser rule).
//
// This slice covers the blocks already provided by @tiptap/starter-kit
// (headings, paragraph, bullet/numbered list, blockquote, code block,
// horizontal rule) plus its bundled marks (bold, italic, underline,
// strike, inline code) and link, and adds the task list/item extensions.
// The remaining §3.2 blocks (table, image, highlight palette, callouts)
// land in later slices (tasks.md, Phase 3b traceability).
//
// E1 (editor pass, goal doc §2, "Block set = Tiptap template + Cogni
// extras"): adds the Notion-like-template's now-MIT block set — emoji,
// mention, math (KaTeX), table of contents, text align, superscript/
// subscript, text style + color, typography — on top of that. Every new
// package is pinned to 3.31.3, matching the rest of this file's Tiptap
// dependencies.
import type { AnyExtension } from "@tiptap/core";
import Emoji from "@tiptap/extension-emoji";
import { Mathematics } from "@tiptap/extension-mathematics";
import { NodeRange } from "@tiptap/extension-node-range";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableOfContents } from "@tiptap/extension-table-of-contents";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
// Context7-confirmed (tiptap-docs, editor/extensions/functionality/
// color.mdx): Color ships inside @tiptap/extension-text-style in 3.31, not
// a separate @tiptap/extension-color package.
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
// KaTeX's own stylesheet (goal doc §2, "add CSS for math (.katex sizing)"
// builds on top of this) — required for Mathematics's rendered nodes to
// look like actual typeset math instead of unstyled raw markup.
import "katex/dist/katex.min.css";
import type { ImageUploadPort } from "../../../domain/image-upload-port";
import type { MentionPort } from "../../../domain/mention-port";
import { Callout } from "../callout-node";
import { createEmojiSuggestion } from "../emoji-suggestion";
import { CogniHighlight } from "../highlight-palette";
import { ImageBlock } from "../image-node";
import { CogniMention, createMentionSuggestion } from "../mention-node";
import { SlashCommand } from "../slash-command";
import type { SlashCommandItem } from "../slash-command-items";
import { TocBlock } from "../toc-node";
import { CodeBlock } from "./code-block";
import { createTableExtensions } from "./table";

// specs/editor/spec.md, "Marcas de texto": a link MUST accept only http,
// https or mailto URLs; anything else (in particular `javascript:`) MUST be
// rejected without applying the mark. Tiptap's own `isAllowedUri` default
// is much more permissive (also allows ftp, tel, sms, etc.), so this
// extension set narrows it explicitly instead of relying on the default.
const ALLOWED_LINK_PROTOCOLS = ["http", "https", "mailto"] as const;

export function isAllowedLinkUri(uri: string | undefined): boolean {
  if (!uri) return false;
  const match = uri.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!match) return false;
  return (ALLOWED_LINK_PROTOCOLS as readonly string[]).includes(
    match[1].toLowerCase(),
  );
}

// specs/editor/spec.md, "Marcas de texto": a link MUST open in a new tab
// with rel="noopener noreferrer" (Tiptap's default also adds "nofollow",
// which the spec does not ask for and this extension set drops).
export interface CreateEditorExtensionsOptions {
  pageId?: string;
  imagePort?: ImageUploadPort | null;
  // E1 (goal doc §2, "@" mentions): injected by editor.tsx's `mentionPort`
  // prop, itself supplied by the app composition root — editor/ui must
  // never import notebooks directly (see mention-port.ts).
  mentionPort?: MentionPort | null;
  // E1 (coordinator addition, "Importar PDF" slash item): items the
  // composition root appends to SLASH_COMMAND_ITEMS (editor.tsx's
  // `extraSlashItems` prop) — see slash-command.tsx's SlashCommandOptions.
  extraSlashItems?: SlashCommandItem[];
}

export function createEditorExtensions(
  options: CreateEditorExtensionsOptions = {},
): AnyExtension[] {
  const pageId = options.pageId ?? "";
  const imagePort = options.imagePort ?? null;
  const mentionPort = options.mentionPort ?? null;
  const extraSlashItems = options.extraSlashItems ?? [];
  return [
    StarterKit.configure({
      // Replaced below by `CodeBlock` (`@tiptap/extension-code-block-
      // lowlight`), which adds syntax highlighting and a language
      // selector (design.md, "Tiptap y ProseMirror solo en editor/ui").
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: false,
        protocols: ["mailto"],
        isAllowedUri: (url) => isAllowedLinkUri(url),
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CogniHighlight,
    Callout,
    CodeBlock,
    ImageBlock.configure({ pageId, imagePort }),
    ...createTableExtensions(),
    SlashCommand.configure({ extraItems: extraSlashItems }),
    // S6b (odd/tasks/app-shell-restyle.md), Editor directive: a standalone
    // ProseMirror extension (unlike the React `DragHandle` component in
    // block-handle.tsx, which needs no extension registered) that decorates
    // a Shift/Ctrl multi-block selection with `ProseMirror-
    // selectednoderange`, styled in globals.css with Cogni tokens.
    NodeRange,
    // E1 (goal doc §2): ":" emoji popup. `emoji-suggestion.ts` only adds the
    // `items`/`render` pair on top of the extension's own default
    // char/command/allow (a `.configure()` deep-merge — see its own header
    // comment for why this isn't a separate hand-rolled Extension like
    // SlashCommand).
    Emoji.configure({ suggestion: createEmojiSuggestion() }),
    // E1: "@" mention popup, linking to one of the current user's pages.
    // `mentionPort` is null in a standalone/unit-test editor (no
    // composition-root wiring) — createMentionSuggestion resolves that to
    // an always-empty item list rather than throwing.
    CogniMention.configure({
      suggestion: createMentionSuggestion(mentionPort),
    }),
    // E1: KaTeX-rendered inline `$…$` / block `$$…$$` math, plus the "/"
    // menu's "Fórmula matemática" (slash-command-items.ts's
    // `insertBlockMath`).
    Mathematics.configure({
      katexOptions: { throwOnError: false },
    }),
    // E1: heading-tracking utility extension (see toc-node.tsx's header
    // comment for why the TOC *node view* computes its own heading list
    // directly from the document instead of depending on this extension's
    // storage/callback shape). Registered so the package is a real,
    // functioning part of the extension set, not dead weight — `onUpdate`
    // is a required option with no default.
    TableOfContents.configure({ onUpdate: () => {} }),
    TocBlock,
    // E1: text alignment (left/center/right/justify), applied to headings
    // and paragraphs — the template's confirmed alignment scope (bubble-
    // toolbar buttons for it are E2 chrome; the attribute/extension itself
    // is in scope for this pass).
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Superscript,
    Subscript,
    // E1: TextStyle + Color (Context7-confirmed: Color ships inside
    // `@tiptap/extension-text-style` in 3.31, not a separate package) and
    // Typography (smart quotes/dashes/etc.) — no bubble-toolbar UI yet
    // (E2), but the marks themselves are usable via editor commands.
    TextStyle,
    Color,
    Typography,
    // S6a (Editor directive, .agents/skills/cogni-design/SKILL.md
    // "Editor"): placeholder copy per the Tiptap docs Notion-style editor,
    // level-aware for headings. `.editor-content .is-empty::before`
    // (globals.css) reads the `data-placeholder` attribute this decorates
    // the empty node with (default `emptyNodeClass: "is-empty"`,
    // `dataAttribute: "placeholder"`).
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === "heading") {
          const level = (node.attrs.level as number | undefined) ?? 1;
          return `Título ${level}`;
        }
        return "Escribe / para ver los comandos";
      },
    }),
  ];
}
