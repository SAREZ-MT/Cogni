// The notebooks hub's empty-state illustration (Phase 8 H4, user decision
// 2026-10-20): a student reading among bookshelves, 1600×1067. Since H4-T2
// its white background is keyed out to transparency like the calendar's
// (a flood fill from the borders, so the white shirt and book pages stay)
// with the cut edges feathered; renamed so no optimizer or browser cache
// serves the old opaque version.
export const NOTEBOOKS_EMPTY_IMAGE = {
  src: "/illustrations/notebooks-empty-v2.webp",
  width: 1600,
  height: 1067,
} as const;
