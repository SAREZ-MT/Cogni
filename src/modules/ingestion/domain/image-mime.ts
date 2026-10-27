// document-import T6: the image formats the importer keeps (the
// page-assets bucket's allowed mimes) and how to recognise them from the
// bytes. Parsers report unreliable content types (officeparser says
// application/octet-stream for SVG; mammoth trusts the DOCX extension),
// so only the magic bytes decide. Everything else (SVG, EMF, WMF, TIFF,
// BMP, …) is skipped and counted by the adapter.
export const IMPORTABLE_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
export type ImportableImageMime = (typeof IMPORTABLE_IMAGE_MIMES)[number];

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const GIF87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]; // "GIF87a"
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // "GIF89a"
const RIFF = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP = [0x57, 0x45, 0x42, 0x50]; // "WEBP" at offset 8

function hasAt(bytes: Uint8Array, magic: readonly number[], offset = 0) {
  return (
    bytes.length >= offset + magic.length &&
    magic.every((byte, index) => bytes[offset + index] === byte)
  );
}

export function sniffImageMime(bytes: Uint8Array): ImportableImageMime | null {
  if (hasAt(bytes, PNG)) return "image/png";
  if (hasAt(bytes, JPEG)) return "image/jpeg";
  if (hasAt(bytes, GIF87) || hasAt(bytes, GIF89)) return "image/gif";
  if (hasAt(bytes, RIFF) && hasAt(bytes, WEBP, 8)) return "image/webp";
  return null;
}

// document-import T9b (audit: images all buffered): limits on the images
// one DOCX or PPTX may bring. Over them an image is skipped (counted in
// `skippedImages`), never the document.
const MiB = 1024 * 1024;
export const IMAGE_LIMITS = {
  maxImages: 100,
  // Also enforced before inflating by OoxmlPackage (OOXML_LIMITS).
  maxImageBytes: 10 * MiB,
  maxTotalBytes: 40 * MiB,
};

export type ImageLimits = typeof IMAGE_LIMITS;
