import { describe, expect, it } from "vitest";
import { CATALOGUE_SAMPLE_DOC } from "./testing/catalogue-sample-doc";
import * as catalogue from "./tiptap-catalogue";
import {
  BLOCK_NODES,
  CATALOGUE_MARK_ATTRS,
  CATALOGUE_MARKS,
  CATALOGUE_NODE_ATTRS,
  CATALOGUE_NODES,
  findCatalogueViolations,
  INLINE_NODES,
} from "./tiptap-catalogue";
import type { TiptapDoc, TiptapNode } from "./tiptap-doc";

function doc(...content: TiptapNode[]): TiptapDoc {
  return { type: "doc", content };
}

function paragraph(...content: TiptapNode[]): TiptapNode {
  return { type: "paragraph", content };
}

function text(value: string, marks?: TiptapNode["marks"]): TiptapNode {
  return marks
    ? { type: "text", text: value, marks }
    : { type: "text", text: value };
}

function collectTypes(
  node: TiptapNode | TiptapDoc,
  nodes: Set<string>,
  marks: Set<string>,
) {
  nodes.add(node.type);
  for (const mark of (node as TiptapNode).marks ?? []) marks.add(mark.type);
  for (const child of node.content ?? []) collectTypes(child, nodes, marks);
}

describe("tiptap content catalogue", () => {
  it("lists every block and inline node as a catalogue node", () => {
    for (const name of [...BLOCK_NODES, ...INLINE_NODES]) {
      expect(CATALOGUE_NODES).toContain(name);
    }
  });

  it("keeps the sample document out of the production module", () => {
    expect("CATALOGUE_SAMPLE_DOC" in catalogue).toBe(false);
  });

  it("lists the attr names of every catalogue node and mark", () => {
    expect(Object.keys(CATALOGUE_NODE_ATTRS).sort()).toEqual(
      [...CATALOGUE_NODES].sort(),
    );
    expect(Object.keys(CATALOGUE_MARK_ATTRS).sort()).toEqual(
      [...CATALOGUE_MARKS].sort(),
    );
    expect(CATALOGUE_NODE_ATTRS.orderedList).toEqual(
      expect.arrayContaining(["start", "type", "blockId", "nodeBackground"]),
    );
    expect(CATALOGUE_MARK_ATTRS.textStyle).toEqual(
      expect.arrayContaining([
        "color",
        "backgroundColor",
        "fontFamily",
        "fontSize",
        "lineHeight",
      ]),
    );
  });

  it.each([0, 1, 7])("accepts an ordered list start of %s", (start) => {
    expect(
      findCatalogueViolations(
        doc({
          type: "orderedList",
          attrs: { start },
          content: [{ type: "listItem", content: [paragraph(text("a"))] }],
        }),
      ),
    ).toEqual([]);
  });

  it("accepts the catalogue sample document", () => {
    expect(findCatalogueViolations(CATALOGUE_SAMPLE_DOC)).toEqual([]);
  });

  it("exercises every catalogue node and mark in the sample document", () => {
    const nodes = new Set<string>();
    const marks = new Set<string>();
    collectTypes(CATALOGUE_SAMPLE_DOC, nodes, marks);
    expect([...nodes].sort()).toEqual([...CATALOGUE_NODES].sort());
    expect([...marks].sort()).toEqual([...CATALOGUE_MARKS].sort());
  });

  it("accepts the default attrs the editor's getJSON() emits", () => {
    const editorJson = doc(
      {
        type: "heading",
        attrs: {
          blockId: null,
          nodeBackground: null,
          id: null,
          "data-toc-id": null,
          textAlign: null,
          level: 2,
        },
        content: [text("Título")],
      },
      {
        type: "paragraph",
        attrs: { blockId: null, nodeBackground: null, textAlign: null },
      },
      {
        type: "orderedList",
        attrs: { blockId: null, nodeBackground: null, start: 1, type: null },
        content: [{ type: "listItem", content: [paragraph(text("uno"))] }],
      },
      {
        type: "image",
        attrs: {
          blockId: null,
          assetId: null,
          pendingId: null,
          align: "center",
          caption: null,
        },
      },
    );
    expect(findCatalogueViolations(editorJson)).toEqual([]);
  });

  describe("rejection rules", () => {
    const cases: Array<[string, TiptapDoc]> = [
      ["an unknown node name", doc({ type: "video", attrs: { src: "x" } })],
      ["an unknown mark name", doc(paragraph(text("a", [{ type: "blink" }])))],
      [
        "an unknown node attr",
        doc({
          type: "paragraph",
          attrs: { color: "red" },
          content: [text("a")],
        }),
      ],
      [
        "an unknown mark attr",
        doc(paragraph(text("a", [{ type: "bold", attrs: { weight: 700 } }]))),
      ],
      [
        "an unknown node key",
        doc({ ...paragraph(text("a")), html: "<b>" } as TiptapNode),
      ],
      [
        "a heading level outside 1-6",
        doc({ type: "heading", attrs: { level: 7 }, content: [text("a")] }),
      ],
      [
        "a heading without a level",
        doc({ type: "heading", content: [text("a")] }),
      ],
      [
        "a non-integer ordered list start",
        doc({
          type: "orderedList",
          attrs: { start: "3" },
          content: [{ type: "listItem", content: [paragraph(text("a"))] }],
        }),
      ],
      [
        "a negative ordered list start",
        doc({
          type: "orderedList",
          attrs: { start: -1 },
          content: [{ type: "listItem", content: [paragraph(text("a"))] }],
        }),
      ],
      [
        "a callout kind outside the enum",
        doc({
          type: "callout",
          attrs: { kind: "danger" },
          content: [paragraph(text("a"))],
        }),
      ],
      [
        "a highlight colour outside the palette",
        doc(
          paragraph(
            text("a", [{ type: "highlight", attrs: { color: "#ff0" } }]),
          ),
        ),
      ],
      [
        "a nodeBackground outside the palette",
        doc({
          type: "paragraph",
          attrs: { nodeBackground: "red" },
          content: [text("a")],
        }),
      ],
      [
        "a textStyle colour that is not a colour",
        doc(
          paragraph(
            text("a", [{ type: "textStyle", attrs: { color: "url(x)" } }]),
          ),
        ),
      ],
      [
        "a malformed textStyle fontSize",
        doc(
          paragraph(
            text("a", [{ type: "textStyle", attrs: { fontSize: "big" } }]),
          ),
        ),
      ],
      [
        "an image assetId that is not a uuid",
        doc({ type: "image", attrs: { assetId: "../etc/passwd" } }),
      ],
      [
        "a youtube src outside youtube",
        doc({
          type: "youtube",
          attrs: { src: "https://evil.example/embed/x" },
        }),
      ],
      [
        "a javascript: link",
        doc(
          paragraph(
            text("a", [
              { type: "link", attrs: { href: "javascript:alert(1)" } },
            ]),
          ),
        ),
      ],
      [
        "a data: link",
        doc(
          paragraph(
            text("a", [{ type: "link", attrs: { href: "data:text/html,x" } }]),
          ),
        ),
      ],
      ["an empty text node", doc(paragraph(text("")))],
      ["a text node without text", doc(paragraph({ type: "text" }))],
      ["text directly under doc", doc(text("suelto"))],
      [
        "a block inside a paragraph",
        doc(paragraph({ type: "horizontalRule" })),
      ],
      [
        "a listItem that does not start with a paragraph",
        doc({
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "bulletList", content: [] }],
            },
          ],
        }),
      ],
      ["an empty bulletList", doc({ type: "bulletList", content: [] })],
      [
        "a paragraph directly inside a table row",
        doc({
          type: "table",
          content: [{ type: "tableRow", content: [paragraph(text("a"))] }],
        }),
      ],
      [
        "a taskList holding a listItem",
        doc({
          type: "taskList",
          content: [{ type: "listItem", content: [paragraph(text("a"))] }],
        }),
      ],
      [
        "details without a summary",
        doc({
          type: "details",
          content: [
            { type: "detailsContent", content: [paragraph(text("a"))] },
          ],
        }),
      ],
      [
        "content inside a leaf node",
        doc({ type: "horizontalRule", content: [text("a")] }),
      ],
      [
        "marks inside a code block",
        doc({
          type: "codeBlock",
          content: [text("x = 1", [{ type: "bold" }])],
        }),
      ],
      [
        "marks on a block node",
        doc({ ...paragraph(text("a")), marks: [{ type: "bold" }] }),
      ],
      [
        "the same mark twice on one node",
        doc(paragraph(text("a", [{ type: "bold" }, { type: "bold" }]))),
      ],
      ["an empty doc", doc()],
    ];

    it.each(cases)("rejects %s", (_label, input) => {
      expect(findCatalogueViolations(input).length).toBeGreaterThan(0);
    });

    it("reports the path of the offending node", () => {
      const violations = findCatalogueViolations(
        doc(paragraph(text("a")), paragraph(text("b", [{ type: "blink" }]))),
      );
      expect(violations[0]?.path).toEqual([
        "content",
        1,
        "content",
        0,
        "marks",
        0,
      ]);
    });

    it("rejects a root that is not a doc", () => {
      expect(
        findCatalogueViolations(paragraph(text("a"))).length,
      ).toBeGreaterThan(0);
    });
  });

  it.each([
    "https://cogni.app/a?b=1",
    "http://example.com",
    "mailto:ana@example.com",
  ])("accepts the link href %s", (href) => {
    expect(
      findCatalogueViolations(
        doc(paragraph(text("a", [{ type: "link", attrs: { href } }]))),
      ),
    ).toEqual([]);
  });

  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])("accepts the youtube src %s", (src) => {
    expect(
      findCatalogueViolations(doc({ type: "youtube", attrs: { src } })),
    ).toEqual([]);
  });
});
