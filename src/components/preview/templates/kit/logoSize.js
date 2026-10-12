// Edit > Hero > Logo size (copy.logoSize): how big the logo shows in the
// menu bar, as a percent of the design's own size. A template reads it
// through logoSizeOf, so a site without the key, or with anything
// unreadable in it, gets 100: the design exactly as it was.
export const LOGO_SIZE = Object.freeze({ min: 80, max: 200, step: 5, base: 100 });

// The saved value as a whole percent on the slider's own steps, clamped to
// its range. The editor stores a number; a numeric string (hand-edited
// copy) is read the same way.
export function logoSizeOf(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return LOGO_SIZE.base;
  const stepped = Math.round(n / LOGO_SIZE.step) * LOGO_SIZE.step;
  return Math.min(LOGO_SIZE.max, Math.max(LOGO_SIZE.min, stepped));
}

// What the editor saves for a slider position: nothing at 100, so an owner
// who drags back to the start leaves the site exactly as it was.
export function logoSizeValue(percent) {
  const p = logoSizeOf(percent);
  return p === LOGO_SIZE.base ? null : p;
}
