// Pure logic behind the How It Works band (kit/HowItWorks.jsx): which
// steps a page shows, their numbers, and the band's heading. No React and
// no browser globals; tolerates whatever a saved row holds.
//
// The data is the one Bright & Bubbly, Obsidian Studio and Bubble Rush
// already read, written by the editor's How It Works tab:
//   copy.howSteps = [{ emoji?, title, desc }]
//   copy.sectionTitles.process = { eyebrow?, title?, accent?, intro? }
// (section id 'process'). Those designs show starter steps until the owner
// saves their own; the kit band has none. It is on only while
// copy.howSteps is a non-empty array, so a theme with live sites that adds
// it (Bold & Sporty) renders a saved site exactly as before, published and
// in the editor. The page shows the steps with a title or a description,
// numbered 01, 02, 03 in that order; the editor shows the same steps (a
// blank one would only shift the numbers), plus a hint when none is left.
import { sectionTitle } from './content.js';

// The section id (copy.sectionOrder / copy.hiddenSections, data-section,
// copy.sectionTitles key), shared with the designs that already have it.
export const HOW_SECTION = 'process';

// The design's own words while the owner typed none (Edit > Headings). No
// claims about speed or ease: the owner's steps say what happens.
export const HOW_DEFAULTS = Object.freeze({ eyebrow: 'The Process', title: 'How It Works' });

// The Edit panel tab the hint names (editorCapabilities.js EDITOR_TABS).
export const HOW_TAB = 'How It Works';
export const HOW_HINTS = Object.freeze({
  empty: `Add your steps in Edit > ${HOW_TAB}.`,
});

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

// The editor's emoji picker value: an emoji, 'icon:<name>' (IconOrEmoji's
// line icons) or ''. The old editor seed shipped U+1FAA7 PLACARD where
// BUBBLES (U+1FAE7) was meant, and saved steps still carry it; the designs
// that read howSteps repair it the same way.
export const stepEmoji = (v) => str(v).replace(/\u{1FAA7}/gu, '\u{1FAE7}');

// "01", "02" ... "10": every step number two digits wide.
export const stepNumber = (n) => String(n).padStart(2, '0');

// Columns for `n` steps where they sit in a row: all of them up to four,
// else rows of three or four that come out even (5 = 3 + 2, 7 = 4 + 3,
// 9 = 3 + 3 + 3), so a short last row is never a lone step when avoidable.
export function howColumns(n) {
  const count = Math.max(1, Math.floor(Number(n)) || 1);
  return count <= 4 ? count : Math.ceil(count / Math.ceil(count / 4));
}

// The band's steps, or null while copy.howSteps is not a non-empty array
// (the band is off). -> { steps: [{ number, emoji, title, desc }], cols }
// Entries that are not objects, or have neither a title nor a description,
// are left out before numbering.
export function howItWorksSteps(howSteps) {
  if (!Array.isArray(howSteps) || howSteps.length === 0) return null;
  const steps = howSteps
    .map((s) => (isObj(s) ? s : {}))
    .map((s) => ({ emoji: stepEmoji(s.emoji), title: str(s.title), desc: str(s.desc) }))
    .filter((s) => s.title || s.desc)
    .map((s, i) => ({ number: stepNumber(i + 1), ...s }));
  return { steps, cols: howColumns(steps.length) };
}

// The heading the band prints: copy.sectionTitles.process (Edit >
// Headings), else the design's own (HOW_DEFAULTS, or the theme's
// `defaults`). -> { eyebrow, title, accent, intro }
export function howItWorksHeading(sectionTitles, defaults = HOW_DEFAULTS) {
  const st = sectionTitle(sectionTitles, HOW_SECTION);
  const d = isObj(defaults) ? defaults : HOW_DEFAULTS;
  return {
    eyebrow: st.eyebrow || str(d.eyebrow),
    title: st.title || str(d.title),
    accent: st.accent,
    intro: st.intro,
  };
}
