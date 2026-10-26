// Regenerates every document-import fixture into ./files.
// Run with `pnpm fixtures:documents`. See README.md for what each file is.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { withFrozenRuntime } from "./lib/determinism";
import { allConstructsDocx, largeDocx } from "./lib/docx-fixture";
import { makePdfs } from "./lib/pdf-fixture";
import { makeDeck } from "./lib/pptx-fixture";

const outDir = fileURLToPath(new URL("./files/", import.meta.url));

function write(name: string, bytes: Uint8Array) {
  writeFileSync(`${outDir}${name}`, bytes);
  console.log(`${name.padEnd(24)} ${bytes.length} bytes`);
}

// OLE2 compound-file signature: what a legacy .doc/.ppt starts with.
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

async function main() {
  mkdirSync(outDir, { recursive: true });

  const docx = await withFrozenRuntime(1, allConstructsDocx);
  write("all-constructs.docx", docx);
  write("large-30p.docx", await withFrozenRuntime(2, () => largeDocx(30)));
  write("all-constructs.pptx", await withFrozenRuntime(3, () => makeDeck(5)));
  write("large-40s.pptx", await withFrozenRuntime(4, () => makeDeck(40)));

  const pdfs = await makePdfs(30);
  write("tagged.pdf", pdfs.tagged);
  write("untagged.pdf", pdfs.untagged);
  write("large-30p.pdf", pdfs.large);
  write("scanned.pdf", pdfs.scanned);

  // Broken inputs for the error paths.
  write(
    "corrupt.pdf",
    Buffer.concat([
      pdfs.tagged.subarray(0, 600),
      Buffer.from("garbage".repeat(50)),
    ]),
  );
  write("corrupt.docx", docx.subarray(0, Math.floor(docx.length / 2)));
  write(
    "garbage.bin",
    Buffer.from("this is not any document at all ".repeat(10)),
  );
  write(
    "legacy.doc",
    Buffer.concat([Buffer.from(OLE2_SIGNATURE), Buffer.alloc(4096, 0)]),
  );
}

await main();
