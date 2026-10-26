import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { CATALOGUE_SAMPLE_DOC } from "@/shared/kernel/testing/catalogue-sample-doc";
import {
  CATALOGUE_MARK_ATTRS,
  CATALOGUE_MARKS,
  CATALOGUE_NODE_ATTRS,
  CATALOGUE_NODES,
  findCatalogueViolations,
} from "@/shared/kernel/tiptap-catalogue";
import { createEditorExtensions } from "./index";

// document-import T3: the kernel content catalogue (the import contract)
// and the editor's real schema must describe exactly the same nodes, marks
// and attrs, and a document using every catalogue construct must survive a
// load into the real editor without losing anything.

let editor: Editor | undefined;

afterEach(() => {
  // destroy() before jsdom teardown (see table.test.tsx).
  editor?.destroy();
  editor = undefined;
});

function createEditor(content?: JSONContent): Editor {
  editor = new Editor({ extensions: createEditorExtensions(), content });
  return editor;
}

function diff(a: Iterable<string>, b: Iterable<string>): string[] {
  const right = new Set(b);
  return [...new Set(a)].filter((name) => !right.has(name)).sort();
}

function attrNames(spec: { attrs?: Record<string, unknown> | null }) {
  return Object.keys(spec.attrs ?? {}).sort();
}

// Attrs whose value the editor generates when the input leaves them null
// (UniqueID's blockId, TableOfContents' heading id and data-toc-id).
const GENERATED_ATTRS = new Set(["blockId", "id", "data-toc-id"]);

type Defaults = Map<string, Record<string, unknown>>;

function defaultsOf(types: Record<string, { spec: { attrs?: unknown } }>) {
  const out: Defaults = new Map();
  for (const [name, type] of Object.entries(types)) {
    const attrs = (type.spec.attrs ?? {}) as Record<
      string,
      { default?: unknown }
    >;
    out.set(
      name,
      Object.fromEntries(
        Object.entries(attrs).map(([key, attr]) => [key, attr.default]),
      ),
    );
  }
  return out;
}

// The expected getJSON() of `input`: every node and mark gets the schema's
// default for each attr the input omits, and marks are sorted by name (the
// editor orders marks by schema rank, not input order). Nothing from the
// input is removed or rewritten.
function withDefaults(
  input: JSONContent,
  nodeDefaults: Defaults,
  markDefaults: Defaults,
): JSONContent {
  const out: JSONContent = { type: input.type };
  const defaults = nodeDefaults.get(input.type ?? "") ?? {};
  if (Object.keys(defaults).length > 0) {
    out.attrs = { ...defaults, ...input.attrs };
  }
  if (input.text !== undefined) out.text = input.text;
  if (input.marks) {
    out.marks = [...input.marks]
      .map((mark) => {
        const markDefault = markDefaults.get(mark.type) ?? {};
        return Object.keys(markDefault).length > 0
          ? { type: mark.type, attrs: { ...markDefault, ...mark.attrs } }
          : { type: mark.type };
      })
      .sort((a, b) => a.type.localeCompare(b.type));
  }
  if (input.content) {
    out.content = input.content.map((child) =>
      withDefaults(child, nodeDefaults, markDefaults),
    );
  }
  return out;
}

// The editor-side normalisation of getJSON(): marks sorted by name (as in
// withDefaults) and a generated id replaced by the expected value only
// when the expected value is null (the editor filled it in) and the
// generated one is a non-empty string.
function normaliseEditorJson(
  actual: JSONContent,
  expected: JSONContent | undefined,
): JSONContent {
  const out: JSONContent = { ...actual };
  if (actual.attrs) {
    const attrs = { ...actual.attrs };
    for (const key of GENERATED_ATTRS) {
      const generated = attrs[key];
      if (
        key in attrs &&
        expected?.attrs?.[key] === null &&
        typeof generated === "string" &&
        generated.length > 0
      ) {
        attrs[key] = null;
      }
    }
    out.attrs = attrs;
  }
  if (actual.marks) {
    out.marks = [...actual.marks].sort((a, b) => a.type.localeCompare(b.type));
  }
  if (actual.content) {
    out.content = actual.content.map((child, index) =>
      normaliseEditorJson(child, expected?.content?.[index]),
    );
  }
  return out;
}

describe("editor schema and content catalogue parity", () => {
  it("registers exactly the catalogue's nodes", () => {
    const schemaNodes = Object.keys(createEditor().schema.nodes);
    expect({
      missingInEditor: diff(CATALOGUE_NODES, schemaNodes),
      missingInCatalogue: diff(schemaNodes, CATALOGUE_NODES),
    }).toEqual({ missingInEditor: [], missingInCatalogue: [] });
  });

  it("registers exactly the catalogue's marks", () => {
    const schemaMarks = Object.keys(createEditor().schema.marks);
    expect({
      missingInEditor: diff(CATALOGUE_MARKS, schemaMarks),
      missingInCatalogue: diff(schemaMarks, CATALOGUE_MARKS),
    }).toEqual({ missingInEditor: [], missingInCatalogue: [] });
  });

  it("declares the same attrs per node and mark as the catalogue", () => {
    const { schema } = createEditor();
    const mismatches: string[] = [];
    const compare = (
      kind: string,
      name: string,
      editorAttrs: string[],
      catalogueAttrs: readonly string[] | undefined,
    ) => {
      const catalogue = [...(catalogueAttrs ?? [])].sort();
      if (editorAttrs.join(",") !== catalogue.join(",")) {
        mismatches.push(
          `${kind} ${name}: editor [${editorAttrs}] vs catalogue [${catalogue}]`,
        );
      }
    };
    for (const [name, type] of Object.entries(schema.nodes)) {
      compare("node", name, attrNames(type.spec), CATALOGUE_NODE_ATTRS[name]);
    }
    for (const [name, type] of Object.entries(schema.marks)) {
      compare("mark", name, attrNames(type.spec), CATALOGUE_MARK_ATTRS[name]);
    }
    expect(mismatches).toEqual([]);
  });
});

describe("catalogue sample round-trip through the real editor", () => {
  it("loads the sample and returns it without losing anything", () => {
    const instance = createEditor();
    instance.commands.setContent(CATALOGUE_SAMPLE_DOC as JSONContent);
    const expected = withDefaults(
      CATALOGUE_SAMPLE_DOC as JSONContent,
      defaultsOf(instance.schema.nodes),
      defaultsOf(instance.schema.marks),
    );
    const actual = normaliseEditorJson(instance.getJSON(), expected);
    expect(actual).toEqual(expected);
  });

  // findCatalogueViolations is the check notebooks' tiptapContentSchema
  // applies per block (cross-module imports go through index.ts only).
  it("emits JSON that passes the strict import contract", () => {
    const instance = createEditor(CATALOGUE_SAMPLE_DOC as JSONContent);
    const json = instance.getJSON();
    expect(findCatalogueViolations(json)).toEqual([]);
  });

  it("renders every catalogue block to HTML", () => {
    const html = createEditor(CATALOGUE_SAMPLE_DOC as JSONContent).getHTML();
    const dom = new DOMParser().parseFromString(html, "text/html");
    const one = (selector: string) => dom.querySelector(selector);

    expect(one("table th[colspan='2']")).not.toBeNull();
    expect(one("table td[rowspan='2']")).not.toBeNull();
    expect(one("pre > code.language-python")).not.toBeNull();
    expect(one("blockquote")).not.toBeNull();
    expect(one("ul > li ol[start='0']")).not.toBeNull();
    expect(one("ol > li ul")).not.toBeNull();
    expect(
      one("ul[data-type='taskList'] input[type='checkbox']"),
    ).not.toBeNull();
    expect(one("details > summary")?.textContent).toBe("Notas del orador");
    expect(one("details [data-type='detailsContent']")).not.toBeNull();
    const iframe = one("div[data-youtube-video] iframe");
    expect(iframe?.getAttribute("src")).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/,
    );
    expect(iframe?.getAttribute("src")).toContain("start=42");
    expect(iframe?.getAttribute("src")).not.toContain("autoplay=1");
    expect(one("div[data-type='image']")?.getAttribute("data-alt")).toBe(
      "Gráfica de una recta tangente a una parábola",
    );
    expect(one("[data-type='block-math']")).not.toBeNull();
    expect(one("[data-type='inline-math']")).not.toBeNull();
    expect(one("a[data-type='mention']")).not.toBeNull();
    expect(one("[data-type='emoji']")).not.toBeNull();
    expect(one("[data-type='callout'][data-kind='warning']")).not.toBeNull();
  });

  it("forces the youtube-nocookie origin even for a youtube.com embed src", () => {
    const html = createEditor({
      type: "doc",
      content: [
        {
          type: "youtube",
          attrs: { src: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
        },
      ],
    }).getHTML();
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/');
    expect(html).not.toContain("https://www.youtube.com/embed/");
  });
});
