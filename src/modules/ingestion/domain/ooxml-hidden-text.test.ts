import { describe, expect, it } from "vitest";
import { countStringScans } from "../application/testing/count-string-scans";
import { stripHiddenRuns } from "./ooxml-hidden-text";

const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const doc = (body: string) =>
  `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`;
const run = (text: string, props = "") =>
  `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t>${text}</w:t></w:r>`;
const p = (...runs: string[]) => `<w:p>${runs.join("")}</w:p>`;

describe("stripHiddenRuns", () => {
  it("removes runs marked w:vanish or w:specVanish and keeps the rest byte for byte", () => {
    const xml = doc(
      p(
        run("Visible "),
        run("OCULTO", "<w:b/><w:vanish/>"),
        run("ESPECIAL", "<w:specVanish/>"),
        run("fin"),
      ),
    );
    expect(stripHiddenRuns(xml)).toBe(doc(p(run("Visible "), run("fin"))));
  });

  it("keeps runs whose vanish is explicitly off", () => {
    const xml = doc(
      p(
        run("a", '<w:vanish w:val="0"/>'),
        run("b", '<w:vanish w:val="false"/>'),
        run("c", '<w:vanish w:val="off"/>'),
      ),
    );
    expect(stripHiddenRuns(xml)).toBe(xml);
  });

  it("ignores a vanish recorded only in a tracked formatting change", () => {
    const xml = doc(
      p(
        run(
          "visible",
          '<w:rPrChange w:id="1"><w:rPr><w:vanish/></w:rPr></w:rPrChange>',
        ),
      ),
    );
    expect(stripHiddenRuns(xml)).toBe(xml);
  });

  it("hides runs of a character style, or a paragraph style, that vanishes (basedOn followed)", () => {
    const styles = `<w:styles ${W}>
      <w:style w:type="character" w:styleId="Secret"><w:rPr><w:vanish/></w:rPr></w:style>
      <w:style w:type="character" w:styleId="MoreSecret"><w:basedOn w:val="Secret"/></w:style>
      <w:style w:type="paragraph" w:styleId="HiddenPara"><w:rPr><w:vanish/></w:rPr></w:style>
    </w:styles>`;
    const xml = doc(
      p(run("uno", '<w:rStyle w:val="MoreSecret"/>'), run("dos")) +
        `<w:p><w:pPr><w:pStyle w:val="HiddenPara"/></w:pPr>${run("tres")}${run("cuatro", '<w:vanish w:val="0"/>')}</w:p>`,
    );
    expect(stripHiddenRuns(xml, styles)).toBe(
      doc(
        p(run("dos")) +
          `<w:p><w:pPr><w:pStyle w:val="HiddenPara"/></w:pPr>${run("cuatro", '<w:vanish w:val="0"/>')}</w:p>`,
      ),
    );
  });

  it("removes a hidden run containing a text box once, with everything inside it", () => {
    const inner = p(run("caja"));
    const xml = doc(
      p(
        `<w:r><w:rPr><w:vanish/></w:rPr><w:pict><w:txbxContent>${inner}</w:txbxContent></w:pict></w:r>`,
        run("afuera"),
      ),
    );
    expect(stripHiddenRuns(xml)).toBe(doc(p(run("afuera"))));
  });

  it("removes a hidden run nested in a visible text box run", () => {
    const xml = doc(
      p(
        `<w:r><w:pict><w:txbxContent>${p(run("ve"), run("no", "<w:vanish/>"))}</w:txbxContent></w:pict></w:r>`,
      ),
    );
    expect(stripHiddenRuns(xml)).toBe(
      doc(
        p(
          `<w:r><w:pict><w:txbxContent>${p(run("ve"))}</w:txbxContent></w:pict></w:r>`,
        ),
      ),
    );
  });

  it("resolves the WordprocessingML prefix from its namespace", () => {
    const xml = `<x:document xmlns:x="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><x:body><x:p><x:r><x:rPr><x:vanish/></x:rPr><x:t>no</x:t></x:r><x:r><x:t>si</x:t></x:r></x:p></x:body></x:document>`;
    expect(stripHiddenRuns(xml)).toBe(
      `<x:document xmlns:x="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><x:body><x:p><x:r><x:t>si</x:t></x:r></x:p></x:body></x:document>`,
    );
  });

  it("does not confuse w:rPr, w:rFonts or attributes containing '>' with a run", () => {
    const xml = doc(
      p(`<w:r><w:rPr><w:rFonts w:ascii="a>b"/></w:rPr><w:t>ok</w:t></w:r>`),
    );
    expect(stripHiddenRuns(xml)).toBe(xml);
  });

  it("returns the input untouched when nothing is hidden", () => {
    const xml = doc(p(run("todo visible")));
    expect(stripHiddenRuns(xml)).toBe(xml);
  });

  it("stays linear on a large part, including an unterminated quote at the end", () => {
    const body = p(
      ...Array.from({ length: 100_000 }, (_, i) =>
        run(`t${i}`, i % 2 ? "<w:vanish/>" : ""),
      ),
    );
    const xml = `${doc(body)}<w:r a="never closed`;
    // T10: characters scanned (countStringScans), not wall-clock time; the
    // test timeout is only a safety net.
    const { result: out, scanned } = countStringScans(() =>
      stripHiddenRuns(xml),
    );
    // T11: a lower bound too, so the upper one cannot pass vacuously — a
    // scanner that stopped going through indexOf/charCodeAt would count ~0.
    // indexOf jumps over run text it does not need, so a quarter of the
    // input is the floor, well under the ~55% the scanner walks today.
    expect(scanned).toBeGreaterThanOrEqual(xml.length / 4);
    expect(scanned).toBeLessThanOrEqual(2 * xml.length);
    expect(out).toContain("t0");
    expect(out).not.toContain("t1<");
  }, 30_000);
});
