// The plain Tiptap/ProseMirror JSON document shape, with no dependency on
// @tiptap/* or prosemirror-*. It lives in shared/kernel because two
// modules' domain layers need it: notebooks/domain (plain_text extraction,
// Page.content, repositories) and editor/domain (SavePagePort). A domain
// layer may only import its own module's domain or shared/kernel
// (.dependency-cruiser.cjs, `domain-is-pure`), so neither can own it.

export interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface TiptapDoc {
  type: "doc";
  content?: TiptapNode[];
}
