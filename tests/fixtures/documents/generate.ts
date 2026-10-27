// Regenerates every document-import fixture into ./files.
// Run with `pnpm fixtures:documents`. See README.md for what each file is.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildOoxmlFixtures } from "./lib/ooxml-fixtures";
import { makePdfs } from "./lib/pdf-fixture";

const outDir = fileURLToPath(new URL("./files/", import.meta.url));

function write(name: string, bytes: Uint8Array) {
  writeFileSync(`${outDir}${name}`, bytes);
  console.log(`${name.padEnd(24)} ${bytes.length} bytes`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  // OOXML files and the broken inputs that need no Chromium; the
  // determinism test regenerates exactly this set.
  for (const [name, bytes] of Object.entries(await buildOoxmlFixtures())) {
    write(name, bytes);
  }

  const pdfs = await makePdfs(30);
  write("tagged.pdf", pdfs.tagged);
  write("untagged.pdf", pdfs.untagged);
  write("large-30p.pdf", pdfs.large);
  write("scanned.pdf", pdfs.scanned);

  // Broken PDF for the error paths.
  write(
    "corrupt.pdf",
    Buffer.concat([
      pdfs.tagged.subarray(0, 600),
      Buffer.from("garbage".repeat(50)),
    ]),
  );
}

await main();
