import { randomBytes } from "node:crypto";

// UUID v7 (RFC 9562): a 48-bit millisecond timestamp followed by random
// bits. Being time-ordered makes it a good primary key for Postgres
// (documento-maestro §6.1: "id (UUID v7) ... generados en aplicación").
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createId(): string {
  // Plain number math (not BigInt/bitwise) because the project targets
  // ES2017; a 48-bit millisecond timestamp is well within Number's safe
  // integer range, so division/modulo is enough to extract each byte.
  const timestamp = Date.now();
  const random = randomBytes(10);
  const bytes = new Uint8Array(16);

  // bytes 0-5: 48-bit unix timestamp in milliseconds, big-endian.
  for (let i = 0; i < 6; i++) {
    bytes[i] = Math.floor(timestamp / 2 ** (40 - i * 8)) % 256;
  }

  // byte 6: version nibble (0111) + 4 random bits (rand_a high nibble).
  bytes[6] = 0x70 | (random[0] & 0x0f);
  // byte 7: remaining 8 random bits (rand_a low byte).
  bytes[7] = random[1];

  // byte 8: variant bits (10) + 6 random bits (rand_b start).
  bytes[8] = 0x80 | (random[2] & 0x3f);
  // bytes 9-15: remaining 56 random bits (rand_b).
  for (let i = 0; i < 7; i++) {
    bytes[9 + i] = random[3 + i];
  }

  return formatUuid(bytes);
}

export function isValidId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
