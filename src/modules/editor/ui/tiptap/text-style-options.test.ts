import { Editor } from "@tiptap/core";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { findCatalogueViolations } from "@/shared/kernel/tiptap-catalogue";
import type { TiptapDoc } from "@/shared/kernel/tiptap-doc";
import {
  applyFontFamily,
  applyFontSize,
  currentFontFamily,
  currentFontSize,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
} from "./text-style-options";

function createEditor() {
  return new Editor({
    extensions: [StarterKit, TextStyle, FontFamily, FontSize],
    content: "<p>hola mundo</p>",
  });
}

function textStyleAttrs(editor: Editor) {
  const mark = editor
    .getJSON()
    .content?.[0]?.content?.[0]?.marks?.find((m) => m.type === "textStyle");
  return mark?.attrs;
}

describe("text style options", () => {
  it("lists the seven families after the default, labelled by name", () => {
    expect(FONT_FAMILY_OPTIONS.map((option) => option.label)).toEqual([
      "Predeterminada",
      "Inter",
      "Bitter",
      "JetBrains Mono",
      "Arial",
      "Times New Roman",
      "Georgia",
      "Verdana",
    ]);
  });

  it("lists five sizes from small to very large, Normal storing none", () => {
    expect(
      FONT_SIZE_OPTIONS.map((option) => [option.label, option.value]),
    ).toEqual([
      ["Pequeño", "14px"],
      ["Normal", null],
      ["Mediano", "18px"],
      ["Grande", "22px"],
      ["Muy grande", "28px"],
    ]);
  });

  it("sets a family and a size on the selection, as catalogue content", () => {
    const editor = createEditor();
    try {
      editor.commands.selectAll();
      expect(applyFontFamily(editor, "Bitter, serif")).toBe(true);
      expect(applyFontSize(editor, "22px")).toBe(true);

      expect(textStyleAttrs(editor)).toMatchObject({
        fontFamily: "Bitter, serif",
        fontSize: "22px",
      });
      expect(currentFontFamily(editor).label).toBe("Bitter");
      expect(currentFontSize(editor).label).toBe("Grande");
      expect(
        findCatalogueViolations(editor.getJSON() as unknown as TiptapDoc),
      ).toEqual([]);
      expect(editor.getHTML()).toContain(
        "font-family: Bitter, serif; font-size: 22px",
      );
    } finally {
      editor.destroy();
    }
  });

  it("goes back to the defaults and drops the empty textStyle mark", () => {
    const editor = createEditor();
    try {
      editor.commands.selectAll();
      applyFontFamily(editor, "Georgia, serif");
      applyFontSize(editor, "14px");
      applyFontFamily(editor, null);
      applyFontSize(editor, null);

      expect(textStyleAttrs(editor)).toBeUndefined();
      expect(currentFontFamily(editor).label).toBe("Predeterminada");
      expect(currentFontSize(editor).label).toBe("Normal");
    } finally {
      editor.destroy();
    }
  });
});
