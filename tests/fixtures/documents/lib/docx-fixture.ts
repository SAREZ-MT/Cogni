// DOCX golden fixtures built with the `docx` library. `allConstructsBody`
// holds one instance of every construct in the source-mapping table of
// odd/tasks/document-import.md; expected/all-constructs.docx.md lists the
// block each one must become.

import {
  AlignmentType,
  CheckBox,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  type IRunOptions,
  LevelFormat,
  MathFraction,
  Math as MathNode,
  MathRadical,
  MathRun,
  MathSum,
  MathSuperScript,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalMergeType,
  WidthType,
} from "docx";
import { makePng, SVG_CIRCLE } from "./png";

const png = makePng();

const indent = (level: number) => ({
  paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } },
});

const numbering = {
  config: [
    {
      reference: "bullets",
      levels: [0, 1, 2].map((level) => ({
        level,
        format: LevelFormat.BULLET,
        text: ["•", "◦", "▪"][level],
        alignment: AlignmentType.LEFT,
        style: indent(level),
      })),
    },
    {
      // Level 0 starts at 3: the importer must keep orderedList `start`.
      reference: "numbers",
      levels: [0, 1, 2].map((level) => ({
        level,
        format: [
          LevelFormat.DECIMAL,
          LevelFormat.LOWER_LETTER,
          LevelFormat.LOWER_ROMAN,
        ][level],
        text: `%${level + 1}.`,
        start: level === 0 ? 3 : 1,
        alignment: AlignmentType.LEFT,
        style: indent(level),
      })),
    },
  ],
};

const styles = {
  paragraphStyles: [
    {
      id: "Quote",
      name: "Quote",
      basedOn: "Normal",
      run: { italics: true, color: "555555" },
      paragraph: { indent: { left: 720 } },
    },
    {
      id: "Code",
      name: "Code",
      basedOn: "Normal",
      run: { font: "Courier New", size: 20 },
    },
  ],
};

const run = (text: string, options: Omit<IRunOptions, "text"> = {}) =>
  new TextRun({ text, ...options });

const cell = (text: string, options: { bold?: boolean } = {}) =>
  new TableCell({
    children: [
      new Paragraph({ children: [run(text, { bold: options.bold })] }),
    ],
  });

function headings(): Paragraph[] {
  const levels = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];
  return [
    new Paragraph({ text: "Fixture Title", heading: HeadingLevel.TITLE }),
    ...levels.map(
      (heading, index) =>
        new Paragraph({ text: `Heading level ${index + 1}`, heading }),
    ),
  ];
}

function inlineMarks(): Paragraph[] {
  return [
    new Paragraph({
      children: [
        run("Plain, "),
        run("bold", { bold: true }),
        run(", "),
        run("italic", { italics: true }),
        run(", "),
        run("underline", { underline: {} }),
        run(", "),
        run("strike", { strike: true }),
        run(", H"),
        run("2", { subScript: true }),
        run("O, x"),
        run("2", { superScript: true }),
        run(", "),
        run("red", { color: "FF0000" }),
        run(", "),
        run("highlight", { highlight: "yellow" }),
        run(", "),
        run("shading", { shading: { fill: "C6EFCE" } }),
        run(", "),
        run("inlineMono", { font: "Courier New" }),
        run("."),
      ],
    }),
    new Paragraph({
      children: [
        run("Link: "),
        new ExternalHyperlink({
          link: "https://example.com/docs",
          children: [run("safe link", { style: "Hyperlink" })],
        }),
        run(" and "),
        new ExternalHyperlink({
          link: "javascript:alert(1)",
          children: [run("evil link", { style: "Hyperlink" })],
        }),
        run("."),
      ],
    }),
  ];
}

function lists(): Paragraph[] {
  const bullets: [string, number][] = [
    ["Bullet A", 0],
    ["Bullet A.1", 1],
    ["Bullet A.1.a", 2],
    ["Bullet B", 0],
  ];
  const numbers: [string, number][] = [
    ["Number three", 0],
    ["Number sub a", 1],
    ["Number sub i", 2],
    ["Number four", 0],
  ];
  return [
    ...bullets.map(
      ([text, level]) =>
        new Paragraph({ text, numbering: { reference: "bullets", level } }),
    ),
    ...numbers.map(
      ([text, level]) =>
        new Paragraph({ text, numbering: { reference: "numbers", level } }),
    ),
    // Checkbox items in both encodings Word produces: a content-control
    // checkbox (w14:checkbox SDT) and a plain ☐/☑ glyph prefix.
    new Paragraph({
      children: [new CheckBox({ checked: true }), run(" Done task (sdt)")],
    }),
    new Paragraph({
      children: [new CheckBox({ checked: false }), run(" Open task (sdt)")],
    }),
    new Paragraph({ children: [run("☐ Open task (glyph)")] }),
    new Paragraph({ children: [run("☑ Done task (glyph)")] }),
  ];
}

function table(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell("H1", { bold: true }),
          cell("H2", { bold: true }),
          cell("H3", { bold: true }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph("Colspan 2")],
            columnSpan: 2,
          }),
          cell("C3"),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph("Rowspan 2")],
            verticalMerge: VerticalMergeType.RESTART,
          }),
          cell("B2"),
          cell("B3"),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph("")],
            verticalMerge: VerticalMergeType.CONTINUE,
          }),
          cell("C2"),
          cell("C3b"),
        ],
      }),
    ],
  });
}

function codeAndQuote(): Paragraph[] {
  return [
    ...["function add(a, b) {", "  return a + b;", "}"].map(
      (line) => new Paragraph({ style: "Code", children: [run(line)] }),
    ),
    new Paragraph({
      style: "Quote",
      children: [run("A quoted sentence from someone wise.")],
    }),
  ];
}

// OMML equations. Single-character arguments are the case where
// officeparser's LaTeX loses braces (spike finding); multi-character
// arguments exercise grouping.
function equations(): Paragraph[] {
  return [
    new Paragraph({
      children: [
        run("Equation: "),
        new MathNode({
          children: [
            new MathFraction({
              numerator: [new MathRun("a")],
              denominator: [new MathRun("b")],
            }),
            new MathRun(" + "),
            new MathSuperScript({
              children: [new MathRun("x")],
              superScript: [new MathRun("2")],
            }),
            new MathRun(" + "),
            new MathRadical({ children: [new MathRun("y")] }),
          ],
        }),
      ],
    }),
    new Paragraph({
      children: [
        new MathNode({
          children: [
            new MathFraction({
              numerator: [new MathRun("a+1")],
              denominator: [new MathRun("2b")],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      children: [
        new MathNode({
          children: [
            new MathRadical({ children: [new MathRun("x+y")] }),
            new MathRun("="),
            new MathSum({
              children: [new MathRun("i")],
              subScript: [new MathRun("i=1")],
              superScript: [new MathRun("n")],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      children: [
        new MathNode({
          children: [
            new MathSuperScript({
              children: [new MathRun("e")],
              superScript: [new MathRun("2x")],
            }),
          ],
        }),
      ],
    }),
  ];
}

function images(): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new ImageRun({
          type: "png",
          data: png,
          transformation: { width: 64, height: 48 },
          altText: {
            name: "Blue stripe",
            description: "A blue PNG",
            title: "png",
          },
        }),
      ],
    }),
    new Paragraph({
      children: [
        new ImageRun({
          type: "svg",
          data: SVG_CIRCLE,
          fallback: { type: "png", data: png },
          transformation: { width: 40, height: 40 },
          altText: {
            name: "Red circle",
            description: "An SVG with PNG fallback",
            title: "svg",
          },
        }),
      ],
    }),
  ];
}

export function allConstructsBody({ withHeadings = true } = {}) {
  return [
    ...(withHeadings ? headings() : []),
    ...inlineMarks(),
    ...lists(),
    table(),
    ...codeAndQuote(),
    ...equations(),
    ...images(),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ text: "After page break." }),
  ];
}

function makeDocument(children: (Paragraph | Table)[]): Document {
  return new Document({
    creator: "Cogni fixtures",
    lastModifiedBy: "Cogni fixtures",
    title: "Cogni document import fixture",
    styles,
    numbering,
    sections: [{ children }],
  });
}

export function allConstructsDocx(): Promise<Buffer> {
  return Packer.toBuffer(makeDocument(allConstructsBody()));
}

// About 30 pages: each chapter carries filler text plus the full construct
// set (which ends with a page break).
export function largeDocx(chapters = 30): Promise<Buffer> {
  const filler =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6);
  const children: (Paragraph | Table)[] = [];
  for (let i = 0; i < chapters; i++) {
    children.push(
      new Paragraph({
        text: `Chapter ${i + 1}`,
        heading: HeadingLevel.HEADING_1,
      }),
    );
    for (let p = 0; p < 6; p++) {
      children.push(new Paragraph({ text: filler }));
    }
    children.push(...allConstructsBody({ withHeadings: false }));
  }
  return Packer.toBuffer(makeDocument(children));
}
