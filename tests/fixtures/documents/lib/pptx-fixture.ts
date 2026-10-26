// PPTX golden fixtures built with `pptxgenjs`. Slides cycle through five
// layouts so a 5-slide deck holds every PPTX construct once; the 40-slide
// deck repeats them for the time-budget test.

import PptxGenJS from "pptxgenjs";
import { makePng } from "./png";

const pngData = `image/png;base64,${makePng().toString("base64")}`;

type Slide = ReturnType<PptxGenJS["addSlide"]>;

function bulletsSlide(slide: Slide) {
  slide.addText(
    [
      { text: "Level 1 bullet", options: { bullet: true, indentLevel: 0 } },
      { text: "Level 2 bullet", options: { bullet: true, indentLevel: 1 } },
      { text: "Level 3 bullet", options: { bullet: true, indentLevel: 2 } },
      {
        text: "Numbered one",
        options: { bullet: { type: "number" }, indentLevel: 0 },
      },
      {
        text: "Numbered two",
        options: { bullet: { type: "number" }, indentLevel: 0 },
      },
    ],
    { x: 0.5, y: 1.3, w: 9, h: 3 },
  );
}

function tableSlide(slide: Slide) {
  slide.addTable(
    [
      [
        { text: "H1", options: { bold: true } },
        { text: "H2", options: { bold: true } },
        { text: "H3", options: { bold: true } },
      ],
      [{ text: "Colspan 2", options: { colspan: 2 } }, { text: "C3" }],
      [
        { text: "Rowspan 2", options: { rowspan: 2 } },
        { text: "B2" },
        { text: "B3" },
      ],
      [{ text: "C2" }, { text: "C3b" }],
    ],
    { x: 0.5, y: 1.3, w: 9 },
  );
}

function imageSlide(slide: Slide) {
  slide.addImage({
    data: pngData,
    x: 1,
    y: 1.5,
    w: 2,
    h: 1.5,
    altText: "Blue stripe",
  });
}

function formattedTextSlide(slide: Slide) {
  slide.addText(
    [
      { text: "Bold part", options: { bold: true } },
      { text: ", italic", options: { italic: true } },
      { text: ", underline", options: { underline: { style: "sng" } } },
      { text: ", red", options: { color: "FF0000" } },
      {
        text: ", link",
        options: { hyperlink: { url: "https://example.com/slides" } },
      },
      {
        text: ", evil",
        options: { hyperlink: { url: "javascript:alert(1)" } },
      },
    ],
    { x: 0.5, y: 1.3, w: 9, h: 1 },
  );
}

function paragraphsSlide(slide: Slide) {
  slide.addText("Body paragraph one.\nBody paragraph two on a new line.", {
    x: 0.5,
    y: 1.3,
    w: 9,
    h: 1.5,
  });
}

const layouts = [
  bulletsSlide,
  tableSlide,
  imageSlide,
  formattedTextSlide,
  paragraphsSlide,
];

export async function makeDeck(slideCount: number): Promise<Buffer> {
  const deck = new PptxGenJS();
  deck.author = "Cogni fixtures";
  deck.company = "Cogni";
  deck.title = "Cogni document import fixture";
  deck.defineSlideMaster({
    title: "FIXTURE",
    objects: [
      {
        placeholder: {
          options: {
            name: "title",
            type: "title",
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.8,
          },
          text: "",
        },
      },
    ],
  });

  for (let i = 0; i < slideCount; i++) {
    const slide = deck.addSlide({ masterName: "FIXTURE" });
    slide.addText(`Slide ${i + 1} title`, { placeholder: "title" });
    layouts[i % layouts.length](slide);
    slide.addNotes(`Speaker notes for slide ${i + 1}.`);
  }

  const output = await deck.write({ outputType: "nodebuffer" });
  return output as Buffer;
}
