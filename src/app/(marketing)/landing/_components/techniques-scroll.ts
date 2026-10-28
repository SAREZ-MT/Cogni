// Scroll mapping of the techniques section's horizontal track. The rail
// holds the intro frame (`intro` frames wide, so the first technique can
// already peek in beside it) followed by `count` full technique frames.
// It travels until the last technique fills the frame. Pure, so the
// scroll handler stays a lookup.

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Frames travelled for 0..1 progress. */
const travelled = (progress: number, intro: number, count: number) =>
  clamp01(progress) * (count - 1 + intro);

/** translateX of the rail, as a share of its own width. */
export function trackShift(progress: number, intro: number, count: number) {
  const shift = (travelled(progress, intro, count) * 100) / (count + intro);
  // Rounded so the string is stable (no -0% or float noise).
  const rounded = Math.round(shift * 100) / 100;
  return rounded === 0 ? "0%" : `-${rounded}%`;
}

/**
 * Index of the technique nearest to filling the frame, or -1 while the
 * intro still leads (less than half of it has slid away). Technique k fills
 * the frame after intro + k frames of travel.
 */
export function activeTechnique(
  progress: number,
  intro: number,
  count: number,
) {
  const position = travelled(progress, intro, count);
  if (position < intro / 2) return -1;
  return Math.min(count - 1, Math.max(0, Math.round(position - intro)));
}
