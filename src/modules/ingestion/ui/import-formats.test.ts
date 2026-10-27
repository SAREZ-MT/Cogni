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
// ones whose adapter has not landed yet (none since T7 enabled PPTX).
describe("import formats offered by the picker", () => {
  it("offers PDF, Word and PowerPoint, holding nothing back", () => {
    expect([...NOT_YET_IMPORTABLE_IN_UI]).toEqual([]);
    expect(UI_IMPORT_FORMATS).toEqual(["pdf", "docx", "pptx"]);
  });

  it("accepts the offered extensions and their mimes in the file input", () => {
    expect(IMPORT_INPUT_ACCEPT).toBe(`.pdf,.docx,.pptx,${PDF},${DOCX},${PPTX}`);
  });
});

describe("importMimeOf", () => {
  it.each([
    ["apuntes.pdf", PDF, PDF],
    ["apuntes.docx", DOCX, DOCX],
    // Some systems report no type at all: the extension decides.
    ["apuntes.DOCX", "", DOCX],
    ["apuntes.pdf", "", PDF],
    // Machines without Office may report a generic type: the extension decides.
    ["apuntes.docx", "application/octet-stream", DOCX],
    ["apuntes.docx", "application/zip", DOCX],
    ["apuntes.pdf", "application/octet-stream", PDF],
    ["diapositivas.pptx", PPTX, PPTX],
    ["diapositivas.pptx", "", PPTX],
    ["diapositivas.PPTX", "application/zip", PPTX],
  ])("takes %s (%j) as %j", (name, type, expected) => {
    expect(importMimeOf({ name, type })).toBe(expected);
  });

  it.each([
    ["antiguo.doc", "application/msword"],
    ["antiguo.ppt", "application/vnd.ms-powerpoint"],
    ["antiguo.ppt", ""],
    ["antiguo.doc", ""],
    ["foto.png", "image/png"],
    // A declared type wins over the extension: a PNG named .pdf is refused.
    ["foto.pdf", "image/png"],
    // A generic type does not let an unoffered extension through.
    ["hoja.xlsx", "application/zip"],
    ["antiguo.doc", "application/octet-stream"],
  ])("refuses %s (%j)", (name, type) => {
    expect(importMimeOf({ name, type })).toBeNull();
  });
});
