import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { OfficeParser } from "officeparser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeZip, type ZipTestEntry } from "../application/testing/make-zip";
import { hasTextContent } from "../domain/imported-doc";
import { OOXML_LIMITS } from "../domain/ooxml-guard";
import { openOoxmlPackage } from "./ooxml-package";
import { PptxDocumentExtractor } from "./pptx-document-extractor";

// document-import T7: the PPTX adapter on variants of the T1 fixture,
// built by rewriting its parts in the test (hidden slides and shapes,
// untitled slides, master bullets, an empty deck, limit breaches) so no
// extra binary fixture is committed.
const MiB = 1024 * 1024;
const fixture = new Uint8Array(
  readFileSync(
    join(process.cwd(), "tests/fixtures/documents/files/all-constructs.pptx"),
  ),
);
const encoder = new TextEncoder();

function fixtureText(name: string): string {
  const opened = openOoxmlPackage(fixture);
  if (!opened.ok) throw new Error("fixture");
  return opened.value.readText(name);
}

// The fixture's own parts, re-zipped, with `replace` overriding entries
// (a string is a new text for that part).
function repack(replace: Record<string, ZipTestEntry | string>): Uint8Array {
  const opened = openOoxmlPackage(fixture);
  if (!opened.ok) throw new Error("fixture");
  const pkg = opened.value;
  return makeZip(
    pkg.names().map((name) => {
      const override = replace[name];
      if (typeof override === "string") {
        return { name, data: encoder.encode(override) };
      }
      return override ?? { name, data: pkg.readBytes(name) };
    }),
  );
}

async function extract(bytes: Uint8Array) {
  return new PptxDocumentExtractor().extract(bytes, "pptx");
}

async function extractOk(bytes: Uint8Array) {
  const result = await extract(bytes);
  if (!result.ok) throw new Error(`extract failed: ${result.error.code}`);
  return result.value;
}

type AnyNode = { type: string; text?: string; content?: AnyNode[] };
const textOf = (node: AnyNode): string =>
  node.type === "text"
    ? (node.text ?? "")
    : (node.content ?? []).map(textOf).join("");

const headings = (content: { content: AnyNode[] }) =>
  content.content
    .filter((block) => block.type === "heading")
    .map((block) => textOf(block));

const SLIDE = (n: number) => `ppt/slides/slide${n}.xml`;
const NOTES = (n: number) => `ppt/notesSlides/notesSlide${n}.xml`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PptxDocumentExtractor hidden content", () => {
  it("skips a hidden slide and its notes; the others keep their numbers", async () => {
    const hidden = fixtureText(SLIDE(2)).replace("<p:sld ", '<p:sld show="0" ');
    const { content, totalPages, images } = await extractOk(
      repack({ [SLIDE(2)]: hidden }),
    );

    expect(headings(content)).toEqual([
      "Slide 1 title",
      "Slide 3 title",
      "Slide 4 title",
      "Slide 5 title",
    ]);
    expect(content.content.some((block) => block.type === "table")).toBe(false);
    expect(JSON.stringify(content)).not.toContain("slide 2.");
    expect(totalPages).toBe(4);
    expect(images).toHaveLength(1);
  });

  it("drops a hidden shape's text", async () => {
    const slide = fixtureText(SLIDE(5)).replace(
      '<p:cNvPr id="3" name="Text 1">',
      '<p:cNvPr id="3" name="Text 1" hidden="1">',
    );
    const { content } = await extractOk(repack({ [SLIDE(5)]: slide }));
    expect(JSON.stringify(content)).not.toContain("Body paragraph");
  });
});

describe("PptxDocumentExtractor titles", () => {
  it("names an untitled slide by its number in the deck", async () => {
    const slide = fixtureText(SLIDE(5)).replace(
      /<p:sp><p:nvSpPr><p:cNvPr id="2" name="Text 0">[\s\S]*?<\/p:sp>/,
      "",
    );
    expect(slide).not.toContain("Slide 5 title");
    const { content } = await extractOk(repack({ [SLIDE(5)]: slide }));

    const heading = content.content.find(
      (block) => block.type === "heading" && textOf(block) === "Diapositiva 5",
    );
    expect(heading).toEqual({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Diapositiva 5" }],
    });
  });

  it("maps a title slide's centred title (ctrTitle) to heading 1", async () => {
    const slide = fixtureText(SLIDE(1)).replace(
      /type="title"/,
      'type="ctrTitle"',
    );
    const { content } = await extractOk(repack({ [SLIDE(1)]: slide }));
    expect(content.content[0]).toEqual({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Slide 1 title" }],
    });
    expect(content.content[4]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
    });
  });
});

describe("PptxDocumentExtractor master bullets", () => {
  it("imports a content placeholder's paragraphs as the nested list the master's body style draws", async () => {
    const slide = fixtureText(SLIDE(5)).replace(
      /<p:sp><p:nvSpPr><p:cNvPr id="3" name="Text 1">[\s\S]*?<\/p:sp>/,
      `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="es"/><a:t>Primer punto</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:rPr lang="es"/><a:t>Subpunto</a:t></a:r></a:p><a:p><a:r><a:rPr lang="es"/><a:t>Segundo punto</a:t></a:r></a:p></p:txBody></p:sp>`,
    );
    const { content } = await extractOk(repack({ [SLIDE(5)]: slide }));
    const list = content.content.at(-2);

    expect(list).toEqual({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Primer punto" }],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Subpunto" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Segundo punto" }],
            },
          ],
        },
      ],
    });
  });

  // T7b: officeparser splits a bulleted `a:p` at each `a:br` into the list
  // node and continuation paragraphs; a separate `a:p` (even indented with
  // marL) is a paragraph of its own.
  it("keeps a bullet's soft line breaks in its item and an indented body paragraph apart", async () => {
    const bullet = (runs: string) =>
      `<a:p><a:pPr marL="342900" indent="-342900"><a:buChar char="•"/></a:pPr>${runs}</a:p>`;
    const run = (value: string) =>
      `<a:r><a:rPr lang="es"/><a:t>${value}</a:t></a:r>`;
    const slide = fixtureText(SLIDE(5)).replace(
      /<p:sp><p:nvSpPr><p:cNvPr id="3" name="Text 1">[\s\S]*?<\/p:sp>/,
      `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Text 1"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${bullet(
        `${run("Punto")}<a:br/>${run("misma viñeta")}`,
      )}${bullet(`${run(" ")}<a:br/>${run("Tras una línea en blanco")}`)}<a:p><a:pPr marL="457200" indent="0"><a:buNone/></a:pPr>${run(
        "Cuerpo sangrado",
      )}</a:p></p:txBody></p:sp>`,
    );
    const { content } = await extractOk(repack({ [SLIDE(5)]: slide }));
    const item = (...inlines: object[]) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: inlines }],
    });

    expect(content.content.slice(-3, -1)).toEqual([
      {
        type: "bulletList",
        content: [
          item(
            { type: "text", text: "Punto" },
            { type: "hardBreak" },
            { type: "text", text: "misma viñeta" },
          ),
          item({ type: "text", text: "Tras una línea en blanco" }),
        ],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Cuerpo sangrado" }],
      },
    ]);
  });
});

describe("PptxDocumentExtractor empty decks", () => {
  const emptySlide = (xml: string) =>
    xml.replace(
      /(<p:spTree>[\s\S]*?<\/p:grpSpPr>)[\s\S]*(<\/p:spTree>)/,
      "$1$2",
    );

  it("returns content with no text for a deck whose slides and notes hold none (processImportJob: empty_document)", async () => {
    const replace: Record<string, string> = {};
    for (let n = 1; n <= 5; n++) {
      replace[SLIDE(n)] = emptySlide(fixtureText(SLIDE(n)));
      replace[NOTES(n)] = emptySlide(fixtureText(NOTES(n)));
    }
    const result = await extractOk(repack(replace));

    expect(hasTextContent(result.content)).toBe(false);
    expect(result.totalPages).toBe(5);
    expect(result.pagesWithoutText).toBe(5);
  });

  it("counts an empty slide among the pages without text and leaves it out", async () => {
    const result = await extractOk(
      repack({
        [SLIDE(4)]: emptySlide(fixtureText(SLIDE(4))),
        [NOTES(4)]: emptySlide(fixtureText(NOTES(4))),
      }),
    );

    expect(result.totalPages).toBe(5);
    expect(result.pagesWithoutText).toBe(1);
    expect(headings(result.content)).toEqual([
      "Slide 1 title",
      "Slide 2 title",
      "Slide 3 title",
      "Slide 5 title",
    ]);
  });

  it("counts a slide with only a picture as without text but keeps it under its number", async () => {
    const slide = fixtureText(SLIDE(3)).replace(
      /<p:sp><p:nvSpPr><p:cNvPr id="2" name="Text 0">[\s\S]*?<\/p:sp>/,
      "",
    );
    const result = await extractOk(repack({ [SLIDE(3)]: slide }));

    expect(result.pagesWithoutText).toBe(1);
    expect(headings(result.content)).toContain("Diapositiva 3");
    expect(result.images).toHaveLength(1);
  });
});

describe("PptxDocumentExtractor limits", () => {
  // 200 MiB of zeros deflate to ~200 KiB.
  const BOMB = deflateRawSync(Buffer.alloc(200 * MiB));

  it("refuses a zip bomb in a slide before officeparser runs", async () => {
    const parse = vi.spyOn(OfficeParser, "parseOffice");
    const result = await extract(
      repack({
        [SLIDE(1)]: {
          name: SLIDE(1),
          data: new Uint8Array(0),
          compressed: BOMB,
          declaredSize: 200 * MiB,
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
    expect(parse).not.toHaveBeenCalled();
  }, 30_000);

  it("refuses an XML element flood in a slide", async () => {
    const flood = fixtureText(SLIDE(5)).replace(
      "</p:spTree>",
      `${"<p:sp/>".repeat(OOXML_LIMITS.maxXmlElements + 1)}</p:spTree>`,
    );
    const result = await extract(repack({ [SLIDE(5)]: flood }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
  }, 30_000);

  it("skips a picture that declares more than the image cap and imports the rest", async () => {
    const big = new Uint8Array(OOXML_LIMITS.maxImageBytes + 1);
    const result = await extractOk(
      repack({
        "ppt/media/image-3-1.png": {
          name: "ppt/media/image-3-1.png",
          data: big,
          // Stored, so the compression-ratio guard does not refuse the deck.
          method: 0,
        },
      }),
    );

    expect(result.images).toHaveLength(0);
    expect(result.skippedImages).toBe(1);
    expect(result.content.content.some((block) => block.type === "image")).toBe(
      false,
    );
    expect(headings(result.content)).toHaveLength(5);
  }, 30_000);

  it("skips a picture whose bytes are not png/jpeg/gif/webp", async () => {
    const result = await extractOk(
      repack({
        "ppt/media/image-3-1.png": {
          name: "ppt/media/image-3-1.png",
          data: encoder.encode("<svg xmlns='http://www.w3.org/2000/svg'/>"),
        },
      }),
    );
    expect(result.images).toHaveLength(0);
    expect(result.skippedImages).toBe(1);
  });
});
