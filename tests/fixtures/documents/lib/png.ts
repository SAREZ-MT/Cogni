// Tiny dependency-free PNG and SVG payloads for the document fixtures.
// The PNG has a diagonal stripe so it is not trivially compressible and a
// parser cannot mistake it for an empty attachment.

import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// An 8-bit RGB PNG of `width` x `height` pixels: a blue field crossed by
// yellow diagonal stripes.
export function makePng(width = 64, height = 48): Buffer {
  const rowLength = width * 3 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowLength] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const offset = y * rowLength + 1 + x * 3;
      const stripe = (x + y) % 16 < 4;
      raw[offset] = stripe ? 255 : 37;
      raw[offset + 1] = stripe ? 200 : 99;
      raw[offset + 2] = stripe ? 0 : 235;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A 40x40 red circle. DOCX embeds it with a PNG fallback; the importer must
// skip the SVG (unsupported image format) and count it.
export const SVG_CIRCLE = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#e11d48"/></svg>',
);
