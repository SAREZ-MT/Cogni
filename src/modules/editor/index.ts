// Public API of the "editor" module (cross-module-via-index in
// .dependency-cruiser.cjs forbids importing anything else from it).
// PR3a exported only the framework-agnostic autosave state and hook; PR3b
// adds the Tiptap-backed `Editor` component (design.md, "Tiptap y
// ProseMirror solo en editor/ui").

export type {
  UseAutosaveOptions,
  UseAutosaveResult,
} from "./application/use-autosave";
export { useAutosave } from "./application/use-autosave";
export type { AutosaveState, AutosaveStatus } from "./domain/autosave-state";
export type {
  ImageUploadGrant,
  ImageUploadPort,
  PageAssetSummary,
} from "./domain/image-upload-port";
export type { MentionCandidate, MentionPort } from "./domain/mention-port";
export type {
  SavePagePort,
  TiptapDoc,
  TiptapNode,
} from "./domain/save-page-port";
export type { EditorProps } from "./ui/tiptap/editor";
export { Editor } from "./ui/tiptap/editor";
export type { SlashCommandItem } from "./ui/tiptap/slash-command-items";
