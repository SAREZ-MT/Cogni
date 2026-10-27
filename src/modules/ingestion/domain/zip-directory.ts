// document-import T9b: the ZIP central directory, read in pure TypeScript
// (no npm dependency, `domain-no-npm`). Shared by format detection
// (document-format.ts, entry names only) and the OOXML guard
// (ooxml-guard.ts, sizes, methods and flags before any parser inflates a
// part). Extracted from document-format.ts, whose T5/T6 search rules it
// keeps: the end-of-central-directory record is searched backwards past an
// optional comment, and a candidate that does not lead to a well-formed
// directory — or declares no entries — is skipped.
export type ZipEntry = {
  name: string;
  // General purpose bit flag (bit 0: encrypted).
  flags: number;
  // 0 stored, 8 deflate; anything else is refused by the guard.
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAX_ZIP_COMMENT = 0xffff;

export function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

export function u32(bytes: Uint8Array, offset: number): number {
  return (u16(bytes, offset) | (u16(bytes, offset + 2) << 16)) >>> 0;
}

// Entry names are ASCII for the entries we look for; decoding byte by
// byte avoids TextDecoder edge cases with malformed input.
export function asciiName(
  bytes: Uint8Array,
  start: number,
  length: number,
): string {
  let name = "";
  for (let index = start; index < start + length; index++) {
    name += String.fromCharCode(bytes[index]);
  }
  return name;
}

function entriesFromEocd(bytes: Uint8Array, eocd: number): ZipEntry[] | null {
  const count = u16(bytes, eocd + 10);
  if (count === 0) return null;
  let offset = u32(bytes, eocd + 16);
  const entries: ZipEntry[] = [];
  for (let entry = 0; entry < count; entry++) {
    if (offset + 46 > bytes.length) return null;
    if (u32(bytes, offset) !== CENTRAL_HEADER_SIGNATURE) return null;
    const nameLength = u16(bytes, offset + 28);
    const extraLength = u16(bytes, offset + 30);
    const commentLength = u16(bytes, offset + 32);
    if (offset + 46 + nameLength > bytes.length) return null;
    entries.push({
      name: asciiName(bytes, offset + 46, nameLength),
      flags: u16(bytes, offset + 8),
      method: u16(bytes, offset + 10),
      compressedSize: u32(bytes, offset + 20),
      uncompressedSize: u32(bytes, offset + 24),
      localHeaderOffset: u32(bytes, offset + 42),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// The entries of the central directory, or null when no end-of-central-
// directory candidate leads to a valid one (a truncated or corrupt
// archive).
export function readZipDirectory(bytes: Uint8Array): ZipEntry[] | null {
  const lowest = Math.max(
    0,
    bytes.length - END_OF_CENTRAL_DIRECTORY_SIZE - MAX_ZIP_COMMENT,
  );
  for (
    let eocd = bytes.length - END_OF_CENTRAL_DIRECTORY_SIZE;
    eocd >= lowest;
    eocd--
  ) {
    if (u32(bytes, eocd) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const entries = entriesFromEocd(bytes, eocd);
    if (entries) return entries;
  }
  return null;
}
