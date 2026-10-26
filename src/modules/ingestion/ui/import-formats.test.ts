import { describe, expect, it } from "vitest";
import {
  IMPORT_INPUT_ACCEPT,
  importMimeOf,
  NOT_YET_IMPORTABLE_IN_UI,
  UI_IMPORT_FORMATS,
} from "./import-formats";

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

// document-import T11: the picker offers the domain's formats minus the
// ones whose adapter has not landed yet (PPTX until T7).
describe("import formats offered by the picker", () => {
  it("offers PDF and Word, holding PowerPoint back until its adapter exists", () => {
    expect([...NOT_YET_IMPORTABLE_IN_UI]).toEqual(["pptx"]);
    expect(UI_IMPORT_FORMATS).toEqual(["pdf", "docx"]);
  });

  it("accepts the offered extensions and their mimes in the file input", () => {
    expect(IMPORT_INPUT_ACCEPT).toBe(`.pdf,.docx,${PDF},${DOCX}`);
  });
});

describe("importMimeOf", () => {
  it.each([
    ["apuntes.pdf", PDF, PDF],
    ["apuntes.docx", DOCX, DOCX],
    // Some systems report no type at all: the extension decides.
    ["apuntes.DOCX", "", DOCX],
    ["apuntes.pdf", "", PDF],
  ])("takes %s (%j) as %j", (name, type, expected) => {
    expect(importMimeOf({ name, type })).toBe(expected);
  });

  it.each([
    ["diapositivas.pptx", PPTX],
    ["diapositivas.pptx", ""],
    ["antiguo.doc", "application/msword"],
    ["antiguo.doc", ""],
    ["foto.png", "image/png"],
    // A declared type wins over the extension: a PNG named .pdf is refused.
    ["foto.pdf", "image/png"],
  ])("refuses %s (%j)", (name, type) => {
    expect(importMimeOf({ name, type })).toBeNull();
  });
});
