import { describe, expect, it } from "vitest";
import { decodeXmlEntities, qualifiedAttribute } from "./xml-tags";

// document-import T7b: the attribute and entity helpers the PPTX readers
// use on relationship ids and targets.
describe("qualifiedAttribute", () => {
  it("reads an attribute by its exact prefixed name", () => {
    expect(qualifiedAttribute(' Id="rId2" r:id="rId7"', "r:id")).toBe("rId7");
    expect(qualifiedAttribute(' Id="rId2" r:id="rId7"', "Id")).toBe("rId2");
  });

  it("does not match another prefix, the bare local name or a longer name", () => {
    const attrs = ' xr:id="a" rid="b" r:idx="c"';
    expect(qualifiedAttribute(attrs, "r:id")).toBeNull();
    expect(qualifiedAttribute(' r:id="a"', "id")).toBeNull();
  });

  it("treats regex-special characters in the name literally", () => {
    expect(qualifiedAttribute(' aXb="no" a.b="yes"', "a.b")).toBe("yes");
    expect(qualifiedAttribute(' ab="no"', "a.b")).toBeNull();
    expect(qualifiedAttribute(' a+b="yes"', "a+b")).toBe("yes");
    expect(qualifiedAttribute(' x="1"', "(x)")).toBeNull();
  });

  it("accepts single quotes and spaces around the equals sign", () => {
    expect(qualifiedAttribute(" r:id = 'rId3'", "r:id")).toBe("rId3");
  });

  it("decodes the value's entities", () => {
    expect(qualifiedAttribute(' Target="a&amp;b&#x2F;c&quot;"', "Target")).toBe(
      'a&b/c"',
    );
  });

  it("returns null when the attribute is missing", () => {
    expect(qualifiedAttribute("", "r:id")).toBeNull();
  });
});

describe("decodeXmlEntities", () => {
  it("decodes the five predefined entities", () => {
    expect(decodeXmlEntities("&lt;&gt;&amp;&quot;&apos;")).toBe(`<>&"'`);
  });

  it("decodes decimal and hexadecimal character references", () => {
    expect(decodeXmlEntities("&#233;&#xE9;&#XE9;&#x1F600;")).toBe("ééé😀");
  });

  it("decodes in one pass: &amp;lt; becomes &lt;, not <", () => {
    expect(decodeXmlEntities("&amp;lt;&amp;#65;")).toBe("&lt;&#65;");
  });

  it("keeps an unknown named entity as written", () => {
    expect(decodeXmlEntities("a&nbsp;b&copy;")).toBe("a&nbsp;b&copy;");
  });

  it("keeps a reference past U+10FFFF or too long to parse as written", () => {
    expect(decodeXmlEntities("&#x110000;")).toBe("&#x110000;");
    expect(decodeXmlEntities("&#1114112;")).toBe("&#1114112;");
    expect(decodeXmlEntities("&#99999999999999999999999;")).toBe(
      "&#99999999999999999999999;",
    );
  });

  it("keeps a reference to a character XML forbids (NUL, surrogates, U+FFFE) as written", () => {
    expect(decodeXmlEntities("&#0;&#x1;&#xD800;&#xDFFF;&#xFFFE;")).toBe(
      "&#0;&#x1;&#xD800;&#xDFFF;&#xFFFE;",
    );
    expect(decodeXmlEntities("&#9;&#10;&#13;")).toBe("\t\n\r");
  });

  it("keeps a malformed reference as written", () => {
    expect(decodeXmlEntities("&#xZZ; &#; &amp b &;")).toBe(
      "&#xZZ; &#; &amp b &;",
    );
  });
});
