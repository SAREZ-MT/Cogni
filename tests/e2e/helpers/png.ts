import { deflateSync } from "node:zlib";

// Minimal CRC32 (PNG's checksum algorithm), computed once at module load.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

// Builds a real, decodable 8-bit RGB PNG of roughly `targetBytes` (Supabase
// Storage's `allowed_mime_types` sniffs the real file bytes, not just the
// declared Content-Type or filename — tests/e2e/image-upload.spec.ts needs
// an actual valid PNG, not a fake header). Deflate level 0 ("store") keeps
// the IDAT chunk close to the raw scanline size instead of collapsing on
// uniform pixel data, and each pixel byte is derived from its position so
// the content is non-uniform without needing a real image asset on disk.
export function buildPng(targetBytes: number): Buffer {
  const width = 1000;
  const rowBytes = 1 + width * 3; // 1 filter byte + 3 bytes (RGB) per pixel
  const height = Math.max(1, Math.round(targetBytes / rowBytes));

  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0; // filter type: None
    for (let x = 0; x < width * 3; x++) {
      raw[rowStart + 1 + x] = (x + y) & 0xff;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor (RGB)
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const idatData = deflateSync(raw, { level: 0 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idatData),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
