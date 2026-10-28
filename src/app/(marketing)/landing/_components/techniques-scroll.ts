// Scroll mapping of the techniques section's horizontal track. The track
// holds `panels` frames side by side (the intro, then one per technique)
// and is `panels` frames wide, so a shift of k/panels of its own width
// brings frame k into view. Pure, so the scroll handler stays a lookup.

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** translateX of the track, as a share of its own width, for 0..1 progress. */
export function trackShift(progress: number, panels: number) {
  const shift = (clamp01(progress) * (panels - 1) * 100) / panels;
  // Rounded so the string is stable (no -0% or float noise).
  const rounded = Math.round(shift * 100) / 100;
  return rounded === 0 ? "0%" : `-${rounded}%`;
}

/**
 * Index of the technique whose frame is nearest the centre, or -1 while the
 * intro is. Frame k (intro = 0) is centred at progress k / count.
 */
export function activeTechnique(progress: number, count: number) {
  const nearest = Math.round(clamp01(progress) * count);
  return nearest === 0 ? -1 : Math.min(count, nearest) - 1;
}
