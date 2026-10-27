import { describe, expect, it } from "vitest";
import {
  isHiddenSlide,
  markInheritedBullets,
  readMasterBodyBullets,
  readRelationships,
  readTableSpans,
  relsPathOf,
  slideRelIds,
  slideTitleKind,
  stripInvisibleShapes,
} from "./pptx-xml";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const slide = (tree: string, rootAttrs = "") =>
  `<?xml version="1.0"?><p:sld ${NS}${rootAttrs}><p:cSld><p:spTree>${tree}</p:spTree></p:cSld></p:sld>`;
const shape = (nvAttrs: string, ph: string, body: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"${nvAttrs}/><p:cNvSpPr/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>${body}</p:txBody></p:sp>`;
const para = (text: string, pPr = "") =>
  `<a:p>${pPr}<a:r><a:rPr lang="es"/><a:t>${text}</a:t></a:r></a:p>`;

describe("relsPathOf", () => {
  it("names a part's relationships part", () => {
    expect(relsPathOf("ppt/slides/slide3.xml")).toBe(
      "ppt/slides/_rels/slide3.xml.rels",
    );
    expect(relsPathOf("ppt/presentation.xml")).toBe(
      "ppt/_rels/presentation.xml.rels",
    );
  });
});

describe("readRelationships", () => {
  it("resolves relative targets against the part's folder and keeps external ones as written", () => {
    const rels = readRelationships(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/?a=1&amp;b=2" TargetMode="External"/>
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="/ppt/slides/slide2.xml"/>
      </Relationships>`,
      "ppt/slides/slide1.xml",
    );
    expect(rels.get("rId1")).toEqual({
      type: "image",
      target: "ppt/media/image1.png",
      external: false,
    });
    expect(rels.get("rId2")).toEqual({
      type: "hyperlink",
      target: "https://example.com/?a=1&b=2",
      external: true,
    });
    expect(rels.get("rId3")?.target).toBe("ppt/slides/slide2.xml");
  });
});

describe("slideRelIds", () => {
  it("lists the slide list's relationship ids in presentation order", () => {
    const presentation = `<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="257" r:id="rId7"/><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`;
    expect(slideRelIds(presentation)).toEqual(["rId7", "rId2"]);
  });
});

describe("isHiddenSlide", () => {
  it("is true only for show=0/false on the slide root", () => {
    expect(isHiddenSlide(slide("", ' show="0"'))).toBe(true);
    expect(isHiddenSlide(slide("", ' show="false"'))).toBe(true);
    expect(isHiddenSlide(slide("", ' show="1"'))).toBe(false);
    expect(isHiddenSlide(slide(""))).toBe(false);
  });
});

describe("slideTitleKind", () => {
  it("tells a title slide (ctrTitle) from a slide title and from no title", () => {
    expect(
      slideTitleKind(slide(shape("", '<p:ph type="ctrTitle"/>', para("T")))),
    ).toBe("ctrTitle");
    expect(
      slideTitleKind(slide(shape("", '<p:ph type="title"/>', para("T")))),
    ).toBe("title");
    expect(slideTitleKind(slide(shape("", '<p:ph idx="1"/>', para("B"))))).toBe(
      null,
    );
  });
});

describe("stripInvisibleShapes", () => {
  it("removes hidden shapes (also inside groups) and slide-number/date/footer placeholders, byte for byte otherwise", () => {
    const visible = shape("", '<p:ph type="title"/>', para("Visible"));
    const hidden = shape(' hidden="1"', "", para("SECRETO"));
    const number = shape("", '<p:ph type="sldNum" idx="12"/>', para("4"));
    const date = shape("", '<p:ph type="dt" idx="10"/>', para("hoy"));
    const footer = shape("", '<p:ph type="ftr" idx="11"/>', para("pie"));
    const hiddenGroup = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="9" name="g" hidden="true"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>${shape("", "", para("EN GRUPO"))}</p:grpSp>`;
    const groupWithHiddenChild = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="8" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>${hidden}${shape("", "", para("Kept"))}</p:grpSp>`;
    const hiddenPicture = `<p:pic><p:nvPicPr><p:cNvPr id="5" name="p" descr="x" hidden="1"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/></p:blipFill></p:pic>`;

    const out = stripInvisibleShapes(
      slide(
        visible +
          hidden +
          number +
          date +
          footer +
          hiddenGroup +
          groupWithHiddenChild +
          hiddenPicture,
      ),
    );

    expect(out).toBe(
      slide(
        visible +
          `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="8" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>${shape("", "", para("Kept"))}</p:grpSp>`,
      ),
    );
  });

  it("returns the input unchanged when nothing is invisible", () => {
    const xml = slide(shape("", "", para("A")));
    expect(stripInvisibleShapes(xml)).toBe(xml);
  });
});

describe("readTableSpans", () => {
  it("reads gridSpan, rowSpan, hMerge and vMerge of every cell, table by table", () => {
    const cell = (attrs = "") =>
      `<a:tc${attrs}><a:txBody><a:bodyPr/><a:p/></a:txBody><a:tcPr/></a:tc>`;
    const table = (rows: string[][]) =>
      `<p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tblGrid/>${rows
        .map((row) => `<a:tr h="0">${row.join("")}</a:tr>`)
        .join("")}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
    const xml = slide(
      table([
        [cell(' gridSpan="2"'), `<a:tc hMerge="1"><a:tcPr/></a:tc>`, cell()],
        [cell(' rowSpan="2"'), cell(), cell()],
        [cell(' vMerge="1"'), cell(), cell()],
      ]) + table([[cell()]]),
    );

    const plain = { gridSpan: 1, rowSpan: 1, hMerge: false, vMerge: false };
    expect(readTableSpans(xml)).toEqual([
      [
        [{ ...plain, gridSpan: 2 }, { ...plain, hMerge: true }, plain],
        [{ ...plain, rowSpan: 2 }, plain, plain],
        [{ ...plain, vMerge: true }, plain, plain],
      ],
      [[plain]],
    ]);
  });

  it("returns no tables for a slide without one", () => {
    expect(readTableSpans(slide(""))).toEqual([]);
  });
});

describe("readMasterBodyBullets", () => {
  it("reads which body levels the master bullets, numbers or leaves plain", () => {
    const master = `<p:sldMaster ${NS}><p:txStyles><p:titleStyle><a:lvl1pPr><a:buNone/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr marL="0"><a:buFont typeface="Arial"/><a:buChar char="•"/></a:lvl1pPr><a:lvl2pPr><a:buAutoNum type="arabicPeriod"/></a:lvl2pPr><a:lvl3pPr><a:buNone/></a:lvl3pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:buChar char="x"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
    const levels = readMasterBodyBullets(master);
    expect(levels.slice(0, 4)).toEqual(["bullet", "number", "none", "none"]);
    expect(levels).toHaveLength(9);
  });
});

describe("markInheritedBullets", () => {
  const levels = [
    "bullet",
    "bullet",
    "number",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
  ] as const;

  it("adds the master's bullet to body-placeholder paragraphs that do not set one", () => {
    const xml = slide(
      shape("", '<p:ph type="title"/>', para("Title")) +
        shape(
          "",
          '<p:ph idx="1"/>',
          para("Level one") +
            para("Level two", '<a:pPr lvl="1"/>') +
            para("Level three", '<a:pPr lvl="2" marL="0"></a:pPr>') +
            para("Explicit none", "<a:pPr><a:buNone/></a:pPr>") +
            para("Explicit char", '<a:pPr><a:buChar char="-"/></a:pPr>'),
        ) +
        shape("", "", para("Text box")),
    );

    const out = markInheritedBullets(xml, levels);

    expect(out).toBe(
      slide(
        shape("", '<p:ph type="title"/>', para("Title")) +
          shape(
            "",
            '<p:ph idx="1"/>',
            para("Level one", '<a:pPr><a:buChar char="•"/></a:pPr>') +
              para("Level two", '<a:pPr lvl="1"><a:buChar char="•"/></a:pPr>') +
              para(
                "Level three",
                '<a:pPr lvl="2" marL="0"><a:buAutoNum type="arabicPeriod"/></a:pPr>',
              ) +
              para("Explicit none", "<a:pPr><a:buNone/></a:pPr>") +
              para("Explicit char", '<a:pPr><a:buChar char="-"/></a:pPr>'),
          ) +
          shape("", "", para("Text box")),
      ),
    );
  });

  it("respects a shape's own list style that turns a level's bullet off", () => {
    const xml = slide(
      shape(
        "",
        '<p:ph type="body" idx="1"/>',
        `<a:lstStyle><a:lvl1pPr><a:buNone/></a:lvl1pPr></a:lstStyle>${para("Plain")}`,
      ),
    );
    expect(markInheritedBullets(xml, levels)).toBe(xml);
  });

  it("leaves an empty paragraph alone", () => {
    const xml = slide(
      shape("", '<p:ph idx="1"/>', '<a:p><a:endParaRPr lang="es"/></a:p>'),
    );
    expect(markInheritedBullets(xml, levels)).toBe(xml);
  });
});
