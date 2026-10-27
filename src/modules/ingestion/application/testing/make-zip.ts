import { crc32, deflateRawSync } from "node:zlib";

// document-import T9b: builds real ZIP archives in tests (stored or
// deflated entries, honest or forged sizes), so the OOXML guard and the
// capped inflater are exercised against bytes a parser would accept —
// without committing large or malicious fixture files.
export type ZipTestEntry = {
  name: string;
  data: Uint8Array;
  // 0 = stored, 8 = deflate (default).
  method?: 0 | 8;
  // Overrides what the central directory and local header declare as the
  // uncompressed size (a lying archive); defaults to `data.length`.
  declaredSize?: number;
  // Already-compressed bytes to store as the entry's data (method 8),
  // e.g. a deflate stream built once and reused.
  compressed?: Uint8Array;
  flags?: number;
};

function u16(out: number[], value: number): void {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function u32(out: number[], value: number): void {
  out.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

export function makeZip(entries: readonly ZipTestEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: number[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const entry of entries) {
    const method = entry.method ?? 8;
    const name = encoder.encode(entry.name);
    const payload =
      entry.compressed ??
      (method === 8 ? deflateRawSync(entry.data) : entry.data);
    const size = entry.declaredSize ?? entry.data.length;
    const crc = crc32(entry.data);
    const header: number[] = [];
    u32(header, 0x04034b50);
    u16(header, 20);
    u16(header, entry.flags ?? 0);
    u16(header, method);
    u16(header, 0);
    u16(header, 0);
    u32(header, crc);
    u32(header, payload.length);
    u32(header, size);
    u16(header, name.length);
    u16(header, 0);
    chunks.push(Uint8Array.from(header), name, payload);

    u32(central, 0x02014b50);
    u16(central, 20);
    u16(central, 20);
    u16(central, entry.flags ?? 0);
    u16(central, method);
    u16(central, 0);
    u16(central, 0);
    u32(central, crc);
    u32(central, payload.length);
    u32(central, size);
    u16(central, name.length);
    u16(central, 0);
    u16(central, 0);
    u16(central, 0);
    u16(central, 0);
    u32(central, 0);
    u32(central, offset);
    central.push(...name);
    offset += header.length + name.length + payload.length;
  }
  const end: number[] = [];
  u32(end, 0x06054b50);
  u16(end, 0);
  u16(end, 0);
  u16(end, entries.length);
  u16(end, entries.length);
  u32(end, central.length);
  u32(end, offset);
  u16(end, 0);
  chunks.push(Uint8Array.from(central), Uint8Array.from(end));
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

// A deflated UTF-8 text entry.
export const textEntry = (name: string, text: string): ZipTestEntry => ({
  name,
  data: new TextEncoder().encode(text),
});
