// H7 (editor polish round 2): the bubble toolbar's "Texto" menu — font
// family and size for the selected text, through the textStyle mark's
// FontFamily / FontSize attributes (@tiptap/extension-text-style, already
// registered in extensions/index.ts). The values come from the content
// catalogue, so whatever the menu writes is content import accepts.
import type { Editor } from "@tiptap/core";
import {
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
  type EditorFontFamily,
  type EditorFontSize,
} from "@/shared/kernel/tiptap-catalogue";

export interface FontFamilyOption {
  label: string;
  // null = the editor's own font (no fontFamily stored).
  value: EditorFontFamily | null;
}

export interface FontSizeOption {
  label: string;
  // null = Normal (16px body, no fontSize stored).
  value: EditorFontSize | null;
}

const FAMILY_LABELS: Record<EditorFontFamily, string> = {
  "Inter, sans-serif": "Inter",
  "Bitter, serif": "Bitter",
  "JetBrains Mono, monospace": "JetBrains Mono",
  "Arial, Helvetica, sans-serif": "Arial",
  "Times New Roman, Times, serif": "Times New Roman",
  "Georgia, serif": "Georgia",
  "Verdana, Geneva, sans-serif": "Verdana",
};

export const FONT_FAMILY_OPTIONS: readonly FontFamilyOption[] = [
  { label: "Predeterminada", value: null },
  ...EDITOR_FONT_FAMILIES.map((value) => ({
    label: FAMILY_LABELS[value],
    value,
  })),
];

const SIZE_LABELS: Record<EditorFontSize, string> = {
  "14px": "Pequeño",
  "18px": "Mediano",
  "22px": "Grande",
  "28px": "Muy grande",
};

export const FONT_SIZE_OPTIONS: readonly FontSizeOption[] = [
  { label: SIZE_LABELS["14px"], value: "14px" },
  { label: "Normal", value: null },
  ...EDITOR_FONT_SIZES.filter((value) => value !== "14px").map((value) => ({
    label: SIZE_LABELS[value],
    value,
  })),
];

export function applyFontFamily(
  editor: Editor,
  value: EditorFontFamily | null,
): boolean {
  const chain = editor.chain().focus();
  return value
    ? chain.setFontFamily(value).run()
    : chain.unsetFontFamily().run();
}

export function applyFontSize(
  editor: Editor,
  value: EditorFontSize | null,
): boolean {
  const chain = editor.chain().focus();
  return value ? chain.setFontSize(value).run() : chain.unsetFontSize().run();
}

// The option matching the selection's textStyle, or the default (null)
// option when the selection carries none or a value the menu does not offer.
export function currentFontFamily(editor: Editor): FontFamilyOption {
  const value = editor.getAttributes("textStyle").fontFamily as unknown;
  return (
    FONT_FAMILY_OPTIONS.find((option) => option.value === value) ??
    FONT_FAMILY_OPTIONS[0]
  );
}

export function currentFontSize(editor: Editor): FontSizeOption {
  const value = editor.getAttributes("textStyle").fontSize as unknown;
  return (
    FONT_SIZE_OPTIONS.find((option) => option.value === value) ??
    FONT_SIZE_OPTIONS[1]
  );
}
