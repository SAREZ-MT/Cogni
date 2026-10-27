// Every fixture that does not need Chromium: the OOXML files written by
// `docx`/`pptxgenjs` plus the broken inputs derived from them or built by
// hand. `generate.ts` writes them, and the determinism test
// (src/modules/ingestion/infrastructure/document-fixtures.determinism.test.ts)
// regenerates them to compare hashes with the committed binaries.

import { withFrozenRuntime } from "./determinism";
import { allConstructsDocx, largeDocx } from "./docx-fixture";
import { makeDeck } from "./pptx-fixture";

// OLE2 compound-file signature: what a legacy .doc/.ppt starts with.
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export async function buildOoxmlFixtures(): Promise<Record<string, Buffer>> {
  // Sequential on purpose: withFrozenRuntime patches globals, so two
  // generators must never overlap.
  const docx = await withFrozenRuntime(1, allConstructsDocx);
  const large = await withFrozenRuntime(2, () => largeDocx(30));
  const deck = await withFrozenRuntime(3, () => makeDeck(5));
  const largeDeck = await withFrozenRuntime(4, () => makeDeck(40));
  return {
    "all-constructs.docx": docx,
    "large-30p.docx": large,
    "all-constructs.pptx": deck,
    "large-40s.pptx": largeDeck,
    // Broken inputs for the error paths.
    "corrupt.docx": docx.subarray(0, Math.floor(docx.length / 2)),
    "garbage.bin": Buffer.from("this is not any document at all ".repeat(10)),
    "legacy.doc": Buffer.concat([
      Buffer.from(OLE2_SIGNATURE),
      Buffer.alloc(4096, 0),
    ]),
  };
}
