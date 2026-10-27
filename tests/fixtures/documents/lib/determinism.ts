// Makes the OOXML generators reproducible. `docx` and `pptxgenjs` stamp the
// current time into docProps/core.xml, JSZip stamps it into every ZIP entry,
// `docx` draws relationship and hyperlink ids from crypto.getRandomValues
// (nanoid) and both libraries call Math.random. Inside `withFrozenRuntime`
// all four sources are fixed, so two runs produce byte-identical files.

// 2026-01-01T00:00:00Z: the fixed "now" written into every generated file.
export const FIXED_TIME_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

// mulberry32: a small seeded PRNG, good enough for ids in test fixtures.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function withFrozenRuntime<T>(
  seed: number,
  run: () => Promise<T>,
): Promise<T> {
  const RealDate = Date;
  const realRandom = Math.random;
  const realGetRandomValues = globalThis.crypto.getRandomValues;

  class FrozenDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(FIXED_TIME_MS);
      } else {
        super(...(args as [number]));
      }
    }

    static now(): number {
      return FIXED_TIME_MS;
    }
  }

  const random = seededRandom(seed);
  globalThis.Date = FrozenDate as DateConstructor;
  Math.random = random;
  globalThis.crypto.getRandomValues = <A extends ArrayBufferView | null>(
    array: A,
  ): A => {
    if (array) {
      const bytes = new Uint8Array(
        array.buffer,
        array.byteOffset,
        array.byteLength,
      );
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(random() * 256);
      }
    }
    return array;
  };

  try {
    return await run();
  } finally {
    globalThis.Date = RealDate;
    Math.random = realRandom;
    globalThis.crypto.getRandomValues = realGetRandomValues;
  }
}

// Chromium writes the wall-clock time into the PDF Info dictionary
// (/CreationDate and /ModDate). Rewrite each date string in place with a
// fixed date of the same length, so every xref offset stays valid.
export function freezePdfDates(pdf: Buffer): Buffer {
  const text = pdf.toString("latin1");
  const frozen = text.replace(
    /\/(CreationDate|ModDate) \(D:([^)]*)\)/g,
    (_match, key: string, value: string) => {
      const fixed = "20260101000000+00'00'";
      const replacement = fixed
        .padEnd(value.length, " ")
        .slice(0, value.length);
      return `/${key} (D:${replacement})`;
    },
  );
  return Buffer.from(frozen, "latin1");
}
