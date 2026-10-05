// Pure color helpers + deriveTheme(), shared by every theme-ready template.
// Owners can edit 5 color roles (bg, accent, text, secondary, muted); every
// other color a template needs (surfaces, borders, text-on-accent, hero
// scrims) is derived here so custom palettes stay readable (WCAG AA 4.5:1
// for text pairs). Nothing here may throw: saved rows can hold anything.

const HEX_RE = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i;

const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));

// '#abc' | '#aabbcc' | '#aabbccdd' | 'rgb(1,2,3)' -> { r, g, b } or null.
export function hexToRgb(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  const rgb = s.match(RGB_RE);
  if (rgb) return { r: clamp255(rgb[1]), g: clamp255(rgb[2]), b: clamp255(rgb[3]) };
  const m = s.match(HEX_RE);
  if (!m) return null;
  let h = m[1];
  if (h.length <= 4) h = h.split('').map((ch) => ch + ch).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// rgbToHex({ r, g, b }) or rgbToHex(r, g, b) -> '#rrggbb' (lowercase).
export function rgbToHex(r, g, b) {
  if (r && typeof r === 'object') ({ r, g, b } = r);
  return '#' + [r, g, b].map((n) => clamp255(n).toString(16).padStart(2, '0')).join('');
}

// Normalized '#rrggbb' for any parseable color, else null.
function normalize(color) {
  const rgb = hexToRgb(color);
  return rgb ? rgbToHex(rgb) : null;
}

// Linear blend in sRGB: t=0 -> a, t=1 -> b. Falls back to whichever input
// is valid, then black.
export function mix(a, b, t = 0.5) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return normalize(a) || normalize(b) || '#000000';
  const k = Math.max(0, Math.min(1, Number(t) || 0));
  return rgbToHex(
    ca.r + (cb.r - ca.r) * k,
    ca.g + (cb.g - ca.g) * k,
    ca.b + (cb.b - ca.b) * k,
  );
}

// alpha('#ff0000', 0.2) -> 'rgba(255, 0, 0, 0.2)'
export function alpha(color, a = 1) {
  const c = hexToRgb(color) || { r: 0, g: 0, b: 0 };
  const k = Math.max(0, Math.min(1, Number.isFinite(Number(a)) ? Number(a) : 1));
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${+k.toFixed(3)})`;
}

// WCAG 2.x relative luminance, 0 (black) .. 1 (white). Invalid -> 0.
export function luminance(color) {
  const c = hexToRgb(color);
  if (!c) return 0;
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// True when white text reads better than black text on this color.
export function isDark(color) {
  return contrastRatio(color, '#ffffff') > contrastRatio(color, '#000000');
}

export function readableOn(bg, { light = '#ffffff', dark = '#111111' } = {}) {
  return contrastRatio(light, bg) >= contrastRatio(dark, bg) ? light : dark;
}

// Returns fg unchanged when it already reaches `min` against bg; otherwise
// the smallest blend toward white or black (whichever needs less change)
// that does. If neither end can reach `min`, the better extreme wins.
export function ensureContrast(fg, bg, min = 4.5) {
  if (!hexToRgb(bg)) return normalize(fg) || fg;
  if (!hexToRgb(fg)) return readableOn(bg);
  if (contrastRatio(fg, bg) >= min) return fg;

  const solve = (target) => {
    if (contrastRatio(target, bg) < min) return null;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 18; i++) {
      const midT = (lo + hi) / 2;
      if (contrastRatio(mix(fg, target, midT), bg) >= min) hi = midT;
      else lo = midT;
    }
    // Rounding to 8-bit channels can land a hair under the target; step on.
    let t = hi;
    let out = mix(fg, target, t);
    while (contrastRatio(out, bg) < min && t < 1) {
      t = Math.min(1, t + 0.01);
      out = mix(fg, target, t);
    }
    return { t, out };
  };

  const up = solve('#ffffff');
  const down = solve('#000000');
  if (up && down) return up.t <= down.t ? up.out : down.out;
  if (up) return up.out;
  if (down) return down.out;
  return contrastRatio('#ffffff', bg) >= contrastRatio('#000000', bg) ? '#ffffff' : '#000000';
}

const DEFAULTS = { bg: '#ffffff', accent: '#2563eb' };

// Scrims keep white text readable over any photo: tinted with the page
// color on dark themes so the hero blends into the page, near-black on
// light themes. deriveTheme's heroScrim / heroScrimLeft use this base; a
// template that paints its own scrim over a photo starts from it too.
export function heroScrimBase(bg, dark = isDark(bg)) {
  return dark ? mix(bg, '#000000', 0.35) : '#0b0c10';
}

// Text over an owner's photo under a scrim of `base` (e.g. the contact
// section's background photo). minScrim is the scrim's lowest alpha where
// text sits, so up to 1 - minScrim of the photo shows through: text and
// muted are repaired to 4.5:1 against the plain base and against the scrim
// over a mid-grey and over a near-white photo pixel (the lightest it sees).
// Returns { lit, text, muted }; lit (the mid-grey mix) is the background
// theme:check pairs the text with.
export function overPhoto({ base, text, muted, minScrim = 0.8 }) {
  const through = 1 - Math.max(0, Math.min(1, Number(minScrim) || 0));
  const lit = mix(base, '#808080', through);
  const bgs = [base, lit, mix(base, '#f2f2f2', through)];
  const repair = (c) => {
    let out = c;
    for (let pass = 0; pass < 3; pass++) {
      for (const b of bgs) out = ensureContrast(out, b, 4.5);
      if (bgs.every((b) => contrastRatio(out, b) >= 4.5)) break;
    }
    return out;
  };
  return { lit, text: repair(text), muted: repair(muted) };
}

// Text over an owner's photo under a scrim of a colored band's own fill
// (a contact band that keeps the brand color over its CTA Background),
// where overPhoto's near-black base would lose that color. Up to
// 1 - minScrim of the photo shows through, and any pixel can sit behind
// the text: a white one lightens the scrim, a black one darkens it. On a
// mid-tone fill no ink reads at 4.5:1 over both, so the fill is deepened
// away from the text (toward black under light text, toward white under
// dark text) just enough that the text reads on the scrim alone and over
// either extreme; muted is blended toward the text until it does too. A
// text color no scrim can carry goes to its extreme (white or black) first.
// Returns { scrim, worst, text, muted }: paint `scrim` at minScrim..1
// alpha; `worst` (the scrim over the photo pixel the text reads worst on)
// is the background theme:check pairs the text with.
export function fillOverPhoto({ fill, text, muted = text, minScrim = 0.85 }) {
  const through = 1 - Math.max(0, Math.min(1, Number(minScrim) || 0));
  const base = normalize(fill) || '#000000';
  const ink0 = normalize(text) || readableOn(base);
  const light = !isDark(ink0);
  const away = light ? '#000000' : '#ffffff';
  const reads = (c, s) => [s, mix(s, '#ffffff', through), mix(s, '#000000', through)]
    .every((b) => contrastRatio(c, b) >= 4.5);
  const deepen = (ink) => {
    for (let i = 0; i <= 40; i++) {
      const s = mix(base, away, i / 40);
      if (reads(ink, s)) return s;
    }
    return null;
  };
  let ink = ink0;
  let scrim = deepen(ink);
  if (!scrim) {
    ink = light ? '#ffffff' : '#000000';
    scrim = deepen(ink) || away;
  }
  const m0 = normalize(muted) || ink;
  let soft = ink;
  for (let i = 0; i <= 20; i++) {
    const c = mix(m0, ink, i / 20);
    if (reads(c, scrim)) { soft = c; break; }
  }
  const worst = mix(scrim, light ? '#ffffff' : '#000000', through);
  return { scrim, worst, text: ink, muted: soft };
}

// fg repaired to 4.5:1 on bg and, when that doesn't break bg, on the
// surface too: cards and alternating sections sit on `surface` and
// templates reuse the same text tokens there.
function readableOnBoth(fg, bg, surface) {
  const onBg = ensureContrast(fg, bg, 4.5);
  if (contrastRatio(onBg, surface) >= 4.5) return onBg;
  const both = ensureContrast(onBg, surface, 4.5);
  return contrastRatio(both, bg) >= 4.5 ? both : onBg;
}

// colors = templateMeta.colors ({ bg, accent, text, secondary, muted }).
// Returns the full token set templates paint with. bg, accent and
// secondary pass through untouched (normalized to lowercase #rrggbb) so
// owner picks show exactly; text, textMuted and accentText are
// contrast-repaired against bg (and surface where possible).
export function deriveTheme(colors) {
  const src = colors && typeof colors === 'object' ? colors : {};

  // A missing bg is inferred from the text color when there is one.
  const rawText = normalize(src.text);
  const bg = normalize(src.bg) || (rawText ? readableOn(rawText, { light: '#ffffff', dark: '#111111' }) : DEFAULTS.bg);
  const dark = isDark(bg);

  const baseText = ensureContrast(rawText || (dark ? '#ffffff' : '#111111'), bg, 4.5);
  const surface = normalize(src.secondary) || mix(bg, baseText, dark ? 0.06 : 0.04);
  const surfaceAlt = mix(surface, baseText, dark ? 0.07 : 0.05);
  const text = readableOnBoth(baseText, bg, surface);
  const textMuted = readableOnBoth(normalize(src.muted) || mix(text, bg, 0.38), bg, surface);
  const accent = normalize(src.accent) || DEFAULTS.accent;
  const accentText = readableOnBoth(accent, bg, surface);

  const scrimBase = heroScrimBase(bg, dark);

  return {
    bg,
    surface,
    surfaceAlt,
    text,
    textMuted,
    accent,
    onAccent: readableOn(accent),
    accentText,
    accentSoft: alpha(accent, dark ? 0.16 : 0.1),
    border: alpha(text, dark ? 0.16 : 0.12),
    borderStrong: alpha(text, dark ? 0.32 : 0.26),
    focus: accentText,
    heroScrim: `linear-gradient(180deg, ${alpha(scrimBase, 0.5)} 0%, ${alpha(scrimBase, 0.62)} 50%, ${alpha(scrimBase, 0.85)} 100%)`,
    heroScrimLeft: `linear-gradient(90deg, ${alpha(scrimBase, 0.88)} 0%, ${alpha(scrimBase, 0.66)} 50%, ${alpha(scrimBase, 0.3)} 100%)`,
    onHero: '#ffffff',
    isDark: dark,
  };
}
