// PDF golden fixtures printed by Playwright's Chromium (`page.pdf`). The
// same HTML is printed tagged (structure tree) and untagged, so the two
// files differ only in their accessibility structure.

import { chromium } from "@playwright/test";
import { freezePdfDates } from "./determinism";
import { makePng } from "./png";

const imageSrc = `data:image/png;base64,${makePng(120, 80).toString("base64")}`;

function constructsSection(suffix = ""): string {
  return `
<h1>Fixture Heading One${suffix}</h1>
<p>Plain, <b>bold</b>, <i>italic</i>, <u>underline</u>, <s>strike</s>, H<sub>2</sub>O, x<sup>2</sup>, <span style="color:#ff0000">red</span>, <mark>highlight</mark>, <code>inlineMono</code>. Link: <a href="https://example.com/docs">safe link</a> and <a href="javascript:alert(1)">evil link</a>.</p>
<h2>Heading Two</h2>
<ul><li>Bullet A<ul><li>Bullet A.1<ul><li>Bullet A.1.a</li></ul></li></ul></li><li>Bullet B</li></ul>
<ol start="3"><li>Number three<ol><li>Number sub a</li></ol></li><li>Number four</li></ol>
<h3>Heading Three</h3>
<table border="1" cellpadding="4"><thead><tr><th>H1</th><th>H2</th><th>H3</th></tr></thead>
<tbody><tr><td colspan="2">Colspan 2</td><td>C3</td></tr><tr><td rowspan="2">Rowspan 2</td><td>B2</td><td>B3</td></tr><tr><td>C2</td><td>C3b</td></tr></tbody></table>
<pre><code>function add(a, b) {
  return a + b;
}</code></pre>
<blockquote>A quoted sentence from someone wise.</blockquote>
<p><img src="${imageSrc}" alt="Blue stripe" width="120" height="80"></p>
<div style="columns:2;column-gap:40px"><p>LEFTCOL first paragraph of the left column with enough words to wrap across several lines of text in the column.</p><p>LEFTCOL second paragraph continues the left column, still more words so it fills the column height.</p><p>RIGHTCOL first paragraph of the right column also with plenty of words to wrap across lines.</p><p>RIGHTCOL second paragraph closes the two-column section of this page.</p></div>
<hr>
<p>After horizontal rule.</p>`;
}

function html(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cogni document import fixture</title><style>body{font-family:Helvetica,Arial,sans-serif;font-size:12pt} h1{font-size:24pt} h2{font-size:18pt} h3{font-size:14pt}</style></head><body>${body}</body></html>`;
}

const SCANNED_PARAGRAPH =
  "<p>La fotosíntesis es el proceso mediante el cual las plantas, algas y algunas bacterias convierten la energía luminosa en energía química. Durante este proceso se libera oxígeno y se produce glucosa a partir de dióxido de carbono y agua.</p>";

export type PdfFixtures = {
  tagged: Buffer;
  untagged: Buffer;
  large: Buffer;
  scanned: Buffer;
};

export async function makePdfs(largePages = 30): Promise<PdfFixtures> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html(constructsSection()));
    const tagged = await page.pdf({ tagged: true, format: "A4" });
    const untagged = await page.pdf({ tagged: false, format: "A4" });

    const filler = `<p>${"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore. ".repeat(8)}</p>`;
    const largeBody = Array.from(
      { length: largePages },
      (_, i) =>
        `<div style="break-after:page">${constructsSection(` ${i + 1}`)}${filler}</div>`,
    ).join("");
    await page.setContent(html(largeBody));
    const large = await page.pdf({ tagged: true, format: "A4" });

    // Scanned: rasterise a Spanish page to JPEG, then print a PDF whose only
    // content is that image, so there is no text layer at all.
    const camera = await browser.newPage({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 2,
    });
    await camera.setContent(
      `<html lang="es"><body style="font-family:'Times New Roman',serif;font-size:12pt;padding:60px"><h1>Capítulo 3: Fotosíntesis</h1>${SCANNED_PARAGRAPH.repeat(6)}</body></html>`,
    );
    const shot = await camera.screenshot({ type: "jpeg", quality: 80 });
    const printer = await browser.newPage();
    await printer.setContent(
      `<html><body style="margin:0"><img src="data:image/jpeg;base64,${shot.toString("base64")}" style="width:210mm;height:296mm;display:block"></body></html>`,
    );
    const scanned = await printer.pdf({
      format: "A4",
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    return {
      tagged: freezePdfDates(tagged),
      untagged: freezePdfDates(untagged),
      large: freezePdfDates(large),
      scanned: freezePdfDates(scanned),
    };
  } finally {
    await browser.close();
  }
}
