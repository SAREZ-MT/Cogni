import type { PaletteColor } from "@/shared/kernel/tiptap-catalogue";

// document-import T6: pure rules the per-format mappers share to turn
// source formatting into catalogue marks (shared/kernel/tiptap-catalogue).

// Same rule as the catalogue's link `href` check (and the editor's
// isAllowedLinkUri): http(s) with an authority, or mailto. Anything else
// (javascript:, data:, vbscript:, bookmarks, relative paths) returns null
// and the mapper keeps the text without the link mark.
const SAFE_HREF = /^(https?:\/\/[^\s/?#]+[^\s]*|mailto:[^\s]+)$/i;

export function safeLinkHref(href: string | null | undefined): string | null {
  if (typeof href !== "string") return null;
  const trimmed = href.trim();
  return SAFE_HREF.test(trimmed) ? trimmed : null;
}

// Word's highlight colours (ST_HighlightColor) mapped to the nearest of
// the 7 pastel palette names the editor's highlight mark accepts. Greys,
// black and white have no pastel counterpart and are dropped.
const DOCX_HIGHLIGHT_PALETTE: Readonly<Record<string, PaletteColor>> = {
  yellow: "yellow",
  darkYellow: "orange",
  green: "green",
  darkGreen: "green",
  cyan: "mint",
  darkCyan: "mint",
  blue: "blue",
  darkBlue: "blue",
  magenta: "purple",
  darkMagenta: "purple",
  red: "pink",
  darkRed: "pink",
};

export function docxHighlightToPalette(
  name: string | null | undefined,
): PaletteColor | null {
  if (!name || !Object.hasOwn(DOCX_HIGHLIGHT_PALETTE, name)) return null;
  return DOCX_HIGHLIGHT_PALETTE[name];
}

// "#RRGGBB" or "RRGGBB" → "#rrggbb"; anything else (auto, theme names,
// short hex) → null.
export function normalizeHexColor(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

// Run fonts that mark inline code (`code` mark) or, when a whole paragraph
// uses them, a code block.
const MONOSPACE_FONTS = new Set([
  "courier",
  "courier new",
  "consolas",
  "menlo",
  "monaco",
  "lucida console",
  "lucida sans typewriter",
  "andale mono",
  "inconsolata",
  "source code pro",
  "fira code",
  "cascadia code",
  "monospace",
]);

export function isMonospaceFont(font: string | null | undefined): boolean {
  if (typeof font !== "string") return false;
  const name = font.trim().toLowerCase();
  return MONOSPACE_FONTS.has(name) || /\bmono\b/.test(name);
}

// Pure black/white text or shading would vanish in one of the editor
// themes; they are the default look, not formatting worth keeping.
export const NEUTRAL_COLORS: ReadonlySet<string> = new Set([
  "#000000",
  "#ffffff",
]);

// A colour carried by at least this share of the body text is the
// document's base colour (a Normal style, a deck's text colour), not an
// emphasis: the mappers do not import it.
export const DOMINANT_COLOR_SHARE = 0.5;

// The colour of `weights` (characters per normalized colour) covering at
// least DOMINANT_COLOR_SHARE of `total` characters, or null.
export function dominantColor(
  weights: ReadonlyMap<string, number>,
  total: number,
): string | null {
  for (const [color, size] of weights) {
    if (total > 0 && size / total >= DOMINANT_COLOR_SHARE) return color;
  }
  return null;
}
