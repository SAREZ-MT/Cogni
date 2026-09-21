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
import type { AnyExtension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { CogniHighlight } from "../highlight-palette";
import { SlashCommand } from "../slash-command";
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
export function createEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
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
    ...createTableExtensions(),
    SlashCommand,
  ];
}
