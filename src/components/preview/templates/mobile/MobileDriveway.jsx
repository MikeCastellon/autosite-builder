// Driveway (mobile_driveway): a light page with black bands, a floating
// menu box over a full-bleed hero, numbered service tabs beside a sticky
// detail panel, photo-card steps and a card footer. Custom websites only:
// registered hidden, so the free wizard and the editor's template switcher
// skip it and the custom-website Design step offers it.
// Theme-ready (CLAUDE.md, "Template contract"):
//   - every color is a deriveTheme() token exposed as a --dw-* variable;
//     the dark bands, their cards and the photo bands get their own scoped
//     text / muted pairs, contrast-repaired for the background they sit on;
//   - all CSS lives in the one prefixed <style> below: @container layout,
//     hover inside (hover:hover), motion inside prefers-reduced-motion;
//   - no hooks or browser globals: the service list is CSS-only radio tabs,
//     the nav glass comes from html[data-acg-scrolled] (siteRuntime.js);
//   - facts (rating, stats, hours, prices) render only when the owner
//     entered them, and editor hints go through PhotoSlot / EditorOnly.
// Photos: hero, about, the second About photo (about2), the How It Works
// step photos (howStep<i>), logo and the CTA background come from their own
// slots; the editor shows a placeholder for each one still empty. A gallery
// photo the Before & After band or a service card shows is left out of the
// gallery. The gallery band shows the first six gallery photos, the next one
// fills the footer photo card, and any left after that join the band, so
// every photo shows once. The review row scrolls sideways; its arrows are
// data-acg-scroll buttons the page runtime drives (siteRuntime.js).
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import IconOrEmoji from '../IconOrEmoji.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS } from '../../../../lib/businessHours.js';
import { deriveTheme, mix, alpha, ensureContrast, isDark, overPhoto } from '../kit/theme.js';
import { PhotoSlot } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';
import { Accented } from '../kit/Accented.jsx';
import { LucideIcon } from '../kit/icons.jsx';
import { sectionTitle, serviceIncludes, phoneDisplay, telHref } from '../kit/content.js';
import { nameKey, bookingAttrs, reviewStars } from '../kit/features.js';
import { BeforeAfterBand, beforeAfterCss } from '../kit/BeforeAfter.jsx';
import { beforeAfterPairs, BA_DEFAULTS } from '../kit/beforeAfter.js';
import { FaqBand, faqCss } from '../kit/Faq.jsx';
import { faqItems, faqHeading, FAQ_DEFAULTS, FAQ_HINTS } from '../kit/faq.js';
import { howItWorksSteps, howItWorksHeading, howStepPhotos, HOW_DEFAULTS, HOW_HINTS } from '../kit/howItWorks.js';
import { VehicleTypeIcon } from '../kit/VehicleTypes.jsx';
import { vehicleTypesOf, vehicleTypesHeading, VT_DEFAULTS, VT_HINTS } from '../kit/vehicleTypes.js';
import { comparisonOf, comparisonHeading, CMP_DEFAULTS, CMP_HINTS } from '../kit/comparison.js';
import { StarRow, GOOGLE_STAR_GOLD, googleRatingOf, googleBadgePlacements } from '../kit/GoogleRatingBadge.jsx';

export const themeReady = true;

// Default top-to-bottom order. Ids are the ones every template shares, so
// a site switching to this design keeps its order, hidden sections and
// headings. Never rename an id.
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'statsBar', label: 'Info Bar' },
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Services' },
  { id: 'vehicleTypes', label: 'Vehicle Types' },
  { id: 'process', label: 'How It Works' },
  { id: 'beforeAfter', label: 'Before & After' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'faq', label: 'FAQ' },
  { id: 'cta', label: 'Contact / CTA' },
];

// Eyebrows, numbers and small labels are set in a monospace.
export const extraFonts = ["'JetBrains Mono', monospace"];
const MONO = "'JetBrains Mono', monospace";

// Edit > Headings: the copy.sectionTitles fields each section uses. Bands
// whose heading lives on their own copy key name it (titleFrom / introFrom).
export const headingFields = {
  hero: { fields: ['eyebrow', 'title', 'accent'], titleFrom: 'headline' },
  about: { fields: ['eyebrow', 'title', 'accent'] },
  services: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'servicesSection.title', introFrom: 'servicesSection.intro' },
  vehicleTypes: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'vehicleTypes.title', introFrom: 'vehicleTypes.intro' },
  process: { fields: ['eyebrow', 'title', 'accent', 'intro'] },
  beforeAfter: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'beforeAfter.title', introFrom: 'beforeAfter.intro', placeholder: { intro: BA_DEFAULTS.intro } },
  gallery: { fields: ['eyebrow', 'title', 'accent'] },
  comparison: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'comparison.title', introFrom: 'comparison.intro' },
  testimonials: { fields: ['eyebrow', 'title', 'accent'] },
  faq: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'faq.title', introFrom: 'faq.intro' },
  cta: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'ctaHeadline', introFrom: 'ctaSubtext' },
};

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);

// The design's own section words while the owner typed none (no claims).
export function headingDefaults() {
  return {
    hero: { eyebrow: '', title: '', accent: '' },
    about: { eyebrow: 'About Us', title: '', accent: '' },
    services: { eyebrow: 'Our Services', title: 'Our Services', accent: '' },
    vehicleTypes: { eyebrow: VT_DEFAULTS.eyebrow, title: VT_DEFAULTS.title, accent: '' },
    process: { eyebrow: HOW_DEFAULTS.eyebrow, title: HOW_DEFAULTS.title, accent: '' },
    beforeAfter: { eyebrow: BA_DEFAULTS.eyebrow, title: BA_DEFAULTS.title, accent: '' },
    gallery: { eyebrow: 'Gallery', title: 'Our Work', accent: '' },
    comparison: { eyebrow: CMP_DEFAULTS.eyebrow, title: CMP_DEFAULTS.title, accent: '' },
    testimonials: { eyebrow: 'Reviews', title: 'What Customers Say', accent: '' },
    faq: { eyebrow: FAQ_DEFAULTS.eyebrow, title: FAQ_DEFAULTS.title, accent: '' },
    cta: { eyebrow: 'Contact', title: 'Get in Touch', accent: '' },
  };
}

// Hours as display rows { days, time }. Only the per-day editor's shape
// (exactly the seven HOURS_DAYS keys, '' = closed) may say a day is
// "Closed"; older free-text hours are shown as the owner wrote them.
const DAY = '(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?';
const DAY_SPAN_RE = new RegExp(`^${DAY}(?:\\s*[-–]\\s*${DAY})?$`, 'i');
const cleanTime = (v) => txt(v).replace(/\s*[-–]\s*$/, '').replace(/\s*[-–]\s*/, ' – ');
function hoursRows(hours) {
  if (!hours) return [];
  if (isObj(hours)) {
    const keys = Object.keys(hours);
    if (keys.length === HOURS_DAYS.length && HOURS_DAYS.every((d) => keys.includes(d))) {
      if (!HOURS_DAYS.some((d) => cleanTime(hours[d]))) return [];
      const runs = [];
      for (const d of HOURS_DAYS) {
        const time = cleanTime(hours[d]);
        const last = runs[runs.length - 1];
        if (last && last.time === time) last.end = d;
        else runs.push({ start: d, end: d, time });
      }
      return runs.map((r) => ({ days: r.start === r.end ? r.start : `${r.start}–${r.end}`, time: r.time || 'Closed' }));
    }
    if (keys.length > 0 && keys.every((k) => DAY_SPAN_RE.test(k.trim()) && cleanTime(hours[k]))) {
      return keys.map((k) => ({ days: k.trim(), time: cleanTime(hours[k]) }));
    }
  }
  const flat = formatHours(hours).trim();
  return flat ? [{ days: flat, time: '' }] : [];
}
// The info bar's "Hours" value: the open rows in a few words, or nothing.
function hoursFact(rows) {
  if (rows.length === 1 && !rows[0].time) return rows[0].days.length <= 40 ? rows[0].days : '';
  const open = rows.filter((r) => r.time && !/^closed$/i.test(r.time));
  return open.length > 0 && open.length <= 2 ? open.map((r) => `${r.days} ${r.time}`).join(', ') : '';
}

// Two-letter initials for a review card's avatar.
function initials(name) {
  const parts = txt(name).replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

// `text` cut to at most `max` characters at a word break, closed with "…".
function clipWords(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`;
}

// The about text split into its lead (the big statement) and the rest.
function aboutParts(text) {
  const paras = txt(text).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return { lead: paras[0] || '', rest: paras.slice(1) };
}

// Tokens for the dark bands, their cards and the photo bands, from the
// owner's palette: the dark band is the palette's darkest color pushed
// toward black, so a light palette gets near-black bands and a dark one
// bands darker than its page.
function replicaTokens(t) {
  const darkBase = t.isDark ? mix(t.bg, '#000000', 0.55) : isDark(t.text) ? mix(t.text, '#000000', 0.35) : mix('#000000', '#ffffff', 0.045);
  const darkBg = darkBase;
  const darkText = ensureContrast('#ffffff', darkBg, 7);
  const cardBg = mix(darkBg, '#ffffff', 0.08);
  const cardText = ensureContrast(darkText, cardBg, 4.5);
  const cardMuted = ensureContrast(mix(cardText, cardBg, 0.32), cardBg, 4.5);
  const darkMuted = ensureContrast(mix(darkText, darkBg, 0.34), cardBg, 4.5);
  // Accent words and numbers on the dark bands: readable on the card, the
  // lighter of the two dark fills, so they read on the band as well.
  const darkAccent = ensureContrast(t.accent, cardBg, 4.5);
  const altBg = t.surface;
  const hero = overPhoto({ base: '#000000', text: '#ffffff', muted: mix('#ffffff', '#000000', 0.2), minScrim: 0.55 });
  const cta = overPhoto({ base: '#000000', text: '#ffffff', muted: mix('#ffffff', '#000000', 0.22), minScrim: 0.62 });
  // The comparison table: the business's column is a dark card, the other
  // column a lighter fill of the page.
  const themBg = mix(t.bg, altBg, 0.55);
  return {
    '--dw-bg': t.bg,
    '--dw-surface': t.surface,
    '--dw-text': t.text,
    '--dw-muted': t.textMuted,
    '--dw-accent': t.accent,
    '--dw-on-accent': t.onAccent,
    '--dw-accent-text': t.accentText,
    '--dw-border': t.border,
    '--dw-border-strong': t.borderStrong,
    '--dw-focus': t.focus,
    '--dw-alt-bg': altBg,
    '--dw-alt-text': ensureContrast(t.text, altBg, 4.5),
    '--dw-alt-muted': ensureContrast(t.textMuted, altBg, 4.5),
    '--dw-dark-bg': darkBg,
    '--dw-dark-text': darkText,
    '--dw-dark-muted': darkMuted,
    '--dw-dark-accent': darkAccent,
    '--dw-dark-line': alpha(darkText, 0.14),
    '--dw-card-bg': cardBg,
    '--dw-card-text': cardText,
    '--dw-card-muted': cardMuted,
    '--dw-card-line': alpha(cardText, 0.14),
    '--dw-them-bg': themBg,
    '--dw-them-text': ensureContrast(t.text, themBg, 4.5),
    '--dw-them-muted': ensureContrast(t.textMuted, themBg, 4.5),
    '--dw-hero-bg': hero.lit,
    '--dw-hero-text': hero.text,
    '--dw-hero-muted': hero.muted,
    '--dw-cta-bg': cta.lit,
    '--dw-cta-text': cta.text,
    '--dw-cta-muted': cta.muted,
    // White buttons with a dark arrow box (the box's arrow in the accent,
    // readable on the box).
    '--dw-btn-bg': '#ffffff',
    '--dw-btn-text': ensureContrast(darkBg, '#ffffff', 7),
    '--dw-btn-box': darkBg,
    '--dw-btn-arrow': darkAccent,
    // The info bar labels and the eyebrow squares.
    '--dw-mark': t.accent,
  };
}

const CSS = `
.dw-root *,.dw-root *::before,.dw-root *::after{box-sizing:border-box}
.dw-wrap{width:100%;max-width:1440px;margin:0 auto;padding:0 clamp(16px,2cqi,29px)}
.dw-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.dw-skip{position:absolute;left:8px;top:8px;z-index:200;padding:10px 14px;border-radius:3px;background:var(--dw-accent);color:var(--dw-on-accent);font-weight:600;text-decoration:none}
.dw-mono{font-family:${MONO};font-weight:400;letter-spacing:.02em;text-transform:uppercase}
.dw-eyebrow{display:inline-flex;align-items:center;gap:10px;margin:0 0 22px;font-family:${MONO};font-size:11px;line-height:1.3;letter-spacing:.06em;text-transform:uppercase;color:inherit}
.dw-eyebrow::before{content:'';flex:none;width:9px;height:9px;background:var(--dw-mark)}
.dw-h2{margin:0;font-family:var(--dw-head);font-size:clamp(32px,3cqi,43px);font-weight:500;line-height:1.1;letter-spacing:-.035em;text-wrap:balance}
.dw-h2 .dw-em{color:var(--dw-accent-text)}
.dw-dark .dw-h2 .dw-em,.dw-photo .dw-h2 .dw-em{color:var(--dw-dark-accent)}
.dw-intro{margin:20px 0 0;font-size:clamp(15px,1.15cqi,16px);line-height:1.5;color:var(--dw-muted)}
.dw-center{text-align:center}
.dw-center .dw-intro{margin-left:auto;margin-right:auto;max-width:620px}
.dw-sec{padding:clamp(64px,8cqi,116px) 0}
.dw-dark{background:var(--dw-dark-bg);color:var(--dw-dark-text)}
.dw-dark .dw-intro{color:var(--dw-dark-muted)}
.dw-light{background:var(--dw-bg);color:var(--dw-text)}
.dw-alt{background:var(--dw-alt-bg);color:var(--dw-alt-text)}
.dw-alt .dw-intro{color:var(--dw-alt-muted)}
.dw-head{margin:0 0 clamp(36px,4.5cqi,64px)}
.dw-btn{display:inline-flex;align-items:center;gap:12px;min-height:38px;padding:4px 4px 4px 14px;border-radius:3px;background:var(--dw-btn-bg);color:var(--dw-btn-text);font-size:15px;font-weight:500;line-height:1.2;text-decoration:none;white-space:nowrap}
.dw-btn-box{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:2px;background:var(--dw-btn-box);color:var(--dw-btn-arrow)}
.dw-btn:focus-visible,.dw-root a:focus-visible,.dw-root summary:focus-visible{outline:2px solid var(--dw-focus);outline-offset:3px}

.dw-top{order:-2;display:flex;align-items:center;justify-content:center;gap:10px;min-height:32px;padding:6px 16px;background:var(--dw-dark-bg);color:var(--dw-dark-text);font-size:13px;line-height:1.3;text-align:center}
.dw-top svg{color:var(--dw-dark-accent);flex:none}
.dw-nav{position:sticky;top:0;order:-1;z-index:100;height:0;overflow:visible;padding:0 clamp(16px,2cqi,29px)}
.dw-nav-box{display:flex;align-items:center;gap:clamp(12px,1.6cqi,22px);width:fit-content;max-width:100%;margin:20px auto 0;padding:8px 8px 8px 16px;border-radius:6px;background:var(--dw-nav-bg);color:var(--dw-dark-text);box-shadow:0 10px 30px rgba(0,0,0,.25)}
html[data-acg-scrolled] .dw-nav-box{background:var(--dw-dark-bg)}
.dw-logo{display:flex;align-items:center;gap:10px;min-width:0;color:inherit;text-decoration:none}
.dw-logo-name{font-family:var(--dw-head);font-size:17px;font-weight:600;letter-spacing:-.02em;line-height:1.1;white-space:nowrap}
.dw-links{display:flex;align-items:center;gap:clamp(14px,2cqi,28px);margin:0 6px}
.dw-links a{color:inherit;font-size:15px;text-decoration:none;white-space:nowrap}
.dw-nav-phone{font-family:${MONO};font-size:13px;color:inherit;text-decoration:none;white-space:nowrap}
.dw-nav .acg-menu{margin-left:4px}

.dw-hero{position:relative;display:flex;align-items:flex-end;min-height:clamp(620px,62cqi,880px);padding:120px 0 clamp(28px,3cqi,44px);background:var(--dw-hero-bg);color:var(--dw-hero-text);overflow:clip}
.dw-hero-media{position:absolute;inset:0}
.dw-hero-media::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.42) 38%,rgba(0,0,0,.12) 70%,rgba(0,0,0,.3) 100%)}
.dw-hero-in{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:28px}
.dw-hero-copy{max-width:760px}
.dw-chip{display:inline-flex;align-items:center;gap:10px;margin:0 0 24px;padding:8px 12px;border-radius:2px;background:rgba(0,0,0,.55);font-family:${MONO};font-size:clamp(12px,1.15cqi,16px);line-height:1.3;letter-spacing:.02em;text-transform:uppercase;color:var(--dw-hero-text)}
.dw-chip svg{color:var(--dw-hero-text);flex:none}
.dw-h1{margin:0;font-family:var(--dw-head);font-size:clamp(36px,3.5cqi,52px);font-weight:500;line-height:1.08;letter-spacing:-.04em;text-wrap:balance}
.dw-h1 .dw-em{color:inherit;text-decoration:underline;text-decoration-thickness:.06em;text-underline-offset:.12em}
.dw-hero-sub{margin:18px 0 0;max-width:560px;font-size:clamp(15px,1.25cqi,18px);line-height:1.5;color:var(--dw-hero-muted)}
.dw-hero-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.dw-rating{flex:none;width:295px;padding:14px;border-radius:4px;background:#fff;color:#000;text-decoration:none}
.dw-rating-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:12px;border-bottom:1px solid rgba(0,0,0,.14)}
.dw-rating-src{font-family:${MONO};font-size:9px;letter-spacing:.04em;text-transform:uppercase}
.dw-rating-row{display:flex;align-items:center;gap:18px;padding-top:12px}
.dw-rating-num{font-family:var(--dw-head);font-size:30px;font-weight:500;letter-spacing:-.04em;line-height:1}
.dw-rating-num small{font-size:13px;vertical-align:top}
.dw-rating-txt{font-size:13px;line-height:1.35}
.dw-hq-mark{font-family:var(--dw-head);font-size:34px;font-weight:600;line-height:.5;height:14px}
.dw-hq-text{display:block;padding-top:12px;font-size:14px;line-height:1.45}
.dw-hq-who{display:block;margin-top:10px;font-family:${MONO};font-size:10px;letter-spacing:.04em;text-transform:uppercase}

.dw-info{background:var(--dw-dark-bg);color:var(--dw-dark-text)}
.dw-info-row{display:flex;justify-content:space-between;gap:24px;padding-top:28px;padding-bottom:30px}
.dw-info-item{min-width:0}
.dw-info-label{display:block;margin:0 0 10px;font-family:${MONO};font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--dw-dark-accent)}
.dw-info-value{display:block;font-size:16px;font-weight:500;line-height:1.35;color:inherit;text-decoration:none;overflow-wrap:anywhere}

.dw-about-top{display:grid;grid-template-columns:1fr 2fr;gap:24px;align-items:start;margin-bottom:clamp(48px,6cqi,84px)}
.dw-about-top .dw-eyebrow{margin-top:12px}
.dw-about-lead{margin:0;font-family:var(--dw-head);font-size:clamp(26px,2.8cqi,40px);font-weight:500;line-height:1.12;letter-spacing:-.035em;white-space:pre-line}
.dw-about-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;align-items:start}
.dw-about-one{grid-template-columns:minmax(0,1fr) minmax(0,2fr)}
.dw-about-ph{overflow:hidden;border-radius:6px;aspect-ratio:1/1}
.dw-about-ph2{margin-top:86px}
.dw-about-ph img,.dw-about-ph>div{width:100%;height:100%;object-fit:cover}
.dw-about-card{display:flex;flex-direction:column;justify-content:space-between;gap:48px;align-self:stretch;margin-top:174px;padding:28px;border-radius:6px;background:var(--dw-alt-bg);color:var(--dw-alt-text)}
.dw-about-one .dw-about-card{margin-top:86px}
.dw-about-none{grid-template-columns:minmax(0,1fr)}
.dw-about-none .dw-about-card{margin-top:0}
.dw-about-card p{margin:0 0 14px;font-size:17px;line-height:1.5;white-space:pre-line}
.dw-about-card p:last-child{margin-bottom:0}
.dw-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.dw-stat-v{display:block;font-family:var(--dw-head);font-size:clamp(40px,3.6cqi,52px);font-weight:400;letter-spacing:-.05em;line-height:1}
.dw-stat-l{display:block;margin-top:12px;font-size:13px;color:var(--dw-alt-muted)}

.dw-svc-in{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}
.dw-svc{display:grid;grid-template-columns:minmax(0,332px) minmax(0,1fr);gap:clamp(24px,15cqi,221px);align-items:start}
.dw-svc-list{display:flex;flex-direction:column}
.dw-svc-tab{display:flex;align-items:center;gap:20px;min-height:62px;padding:12px 22px;border-bottom:1px solid var(--dw-dark-line);border-radius:7px;font-size:18px;line-height:1.25;cursor:pointer;color:var(--dw-dark-text)}
.dw-svc-num{font-family:${MONO};font-size:16px;color:var(--dw-dark-muted)}
.dw-svc-panels{position:sticky;top:96px;min-width:0}
.dw-svc-panel{display:none;padding:22px;border-radius:8px;background:var(--dw-card-bg);color:var(--dw-card-text)}
.dw-svc-main{display:grid;grid-template-columns:minmax(0,1fr);gap:28px}
.dw-svc-panel.dw-has-ph .dw-svc-main{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.dw-svc-body{display:flex;flex-direction:column;align-items:flex-start;min-height:100%}
.dw-svc-panel:not(.dw-has-ph) .dw-svc-main{grid-template-columns:minmax(0,1fr) auto;min-height:260px}
.dw-svc-big{align-self:end;font-family:${MONO};font-size:clamp(96px,11cqi,168px);font-weight:300;line-height:.8;letter-spacing:-.06em;color:transparent;-webkit-text-stroke:1px var(--dw-card-line)}
.dw-svc-cat{margin:0 0 10px;font-family:${MONO};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dw-dark-accent)}
.dw-svc-name{margin:0;font-family:var(--dw-head);font-size:clamp(22px,1.9cqi,26px);font-weight:500;line-height:1.2;letter-spacing:-.025em}
.dw-svc-desc{margin:14px 0 28px;font-size:16px;line-height:1.4;color:var(--dw-card-muted)}
.dw-svc-price{margin:auto 0 0;padding-top:40px;font-family:var(--dw-head);font-size:clamp(26px,2.2cqi,30px);font-weight:500;line-height:1.1;letter-spacing:-.03em}
.dw-svc-book{margin-top:22px}
.dw-svc-ph{overflow:hidden;border-radius:4px;aspect-ratio:374/253}
.dw-svc-ph img{width:100%;height:100%;object-fit:cover}
.dw-inc{margin-top:22px;padding-top:22px;border-top:1px solid var(--dw-card-line)}
.dw-inc-h{margin:0 0 18px;font-size:16px;color:var(--dw-card-muted)}
.dw-inc ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 30px;margin:0;padding:0;list-style:none}
.dw-inc li{display:flex;gap:10px;font-size:16px;line-height:1.35}
.dw-inc li::before{content:'+';flex:none;font-size:20px;line-height:.9;color:var(--dw-dark-accent)}
.dw-inc li.dw-inc-sub{grid-column:1/-1;font-family:${MONO};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dw-card-muted)}
.dw-inc li.dw-inc-sub::before{content:none}

.dw-vt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,2.6cqi,40px) clamp(14px,5cqi,72px);max-width:1120px;margin:0 auto}
.dw-vt-item{display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center}
.dw-vt-art{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:16/9;border-radius:8px;background:var(--dw-alt-bg);color:var(--dw-alt-text)}
.dw-vt-art svg{width:42%;height:auto}
.dw-vt-name{margin:0;font-size:17px;line-height:1.3}
.dw-vt-desc{margin:-12px 0 0;font-size:14px;line-height:1.45;color:var(--dw-muted)}

.dw-how{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,604px);gap:clamp(24px,4cqi,64px);align-items:start;max-width:1382px}
.dw-how-head{position:sticky;top:110px}
.dw-how-list{display:flex;flex-direction:column;gap:30px;margin:0;padding:0;list-style:none}
.dw-step{padding:22px;border-radius:10px;background:var(--dw-card-bg);color:var(--dw-card-text)}
.dw-step-ph{overflow:hidden;margin-bottom:22px;border-radius:6px;aspect-ratio:562/400}
.dw-step-ph img,.dw-step-ph>div{width:100%;height:100%;object-fit:cover}
.dw-step-h{display:flex;align-items:baseline;gap:14px;margin:0;font-size:18px;font-weight:500;line-height:1.3;letter-spacing:-.01em;text-transform:uppercase}
.dw-step-n{font-family:${MONO};font-size:17px;color:var(--dw-dark-accent)}
.dw-step-e{margin-left:auto;font-size:20px;line-height:1}
.dw-step-d{margin:14px 0 0;font-size:16px;line-height:1.45;color:var(--dw-card-muted)}

.dw-gal{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:clamp(40px,5cqi,72px) 22px;align-items:start}
.dw-gal-item{margin:0;overflow:hidden;border-radius:6px}
.dw-gal-item img{display:block;width:100%;height:100%;object-fit:cover}
.dw-g0{grid-column:1/5;aspect-ratio:440/560}
.dw-g1{grid-column:7/13;margin-top:96px;aspect-ratio:676/445}
.dw-g2{grid-column:4/10;aspect-ratio:676/430}
.dw-g3{grid-column:1/6;aspect-ratio:558/500}
.dw-g4{grid-column:8/13;margin-top:104px;aspect-ratio:558/530}
.dw-g5{grid-column:3/11;aspect-ratio:900/480}

.dw-cmp-wrap{max-width:864px;margin:0 auto}
.dw-cmp{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;overflow:hidden;border-radius:8px;font-size:14px;line-height:1.35}
.dw-cmp th,.dw-cmp td{padding:0 22px;height:70px;vertical-align:middle;border-bottom:1px solid var(--dw-border)}
.dw-cmp tr:last-child th,.dw-cmp tr:last-child td{border-bottom:0}
.dw-cmp-label{width:36%;text-align:left;font-weight:500;background:var(--dw-bg);color:var(--dw-text)}
.dw-cmp thead th{height:86px}
.dw-cmp-us{width:32%;text-align:center;background:var(--dw-card-bg);color:var(--dw-card-text);border-bottom-color:var(--dw-card-line)!important}
.dw-cmp-them{width:32%;text-align:center;background:var(--dw-them-bg);color:var(--dw-them-text)}
.dw-cmp-name{font-family:var(--dw-head);font-size:17px;font-weight:600;font-style:italic;letter-spacing:-.02em;text-transform:uppercase;line-height:1.1}
.dw-cmp-yes{display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;border-radius:50%;border:1.5px solid var(--dw-dark-accent);color:var(--dw-dark-accent)}
.dw-cmp-them .dw-cmp-yes{border-color:var(--dw-them-text);color:var(--dw-them-text)}
.dw-cmp-no{display:inline-block;width:18px;height:2px;border-radius:1px;background:currentColor;opacity:.55;vertical-align:middle}
.dw-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

.dw-rev-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.dw-rev-nav{display:flex;flex:none;gap:10px;margin-bottom:clamp(36px,4.5cqi,64px)}
.dw-rev-btn{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;margin:0;padding:0;border:1px solid var(--dw-dark-line);border-radius:3px;background:none;color:var(--dw-dark-accent);cursor:pointer}
.dw-rev-btn:focus-visible,.dw-rev:focus-visible{outline:2px solid var(--dw-dark-accent);outline-offset:3px}
.dw-rev-few .dw-rev-nav{display:none}
.dw-rev{display:grid;grid-auto-flow:column;grid-auto-columns:calc((100% - 44px)/3);gap:22px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px;scrollbar-width:none}
.dw-rev::-webkit-scrollbar{display:none}
.dw-q{display:flex;flex-direction:column;justify-content:space-between;gap:36px;min-height:314px;margin:0;padding:28px;border-radius:8px;scroll-snap-align:start;background:linear-gradient(180deg,var(--dw-card-bg),var(--dw-card-bg2));color:var(--dw-card-text)}
.dw-q blockquote{margin:0;font-size:17px;line-height:1.5}
.dw-q-foot{display:flex;flex-direction:column;gap:22px}
.dw-q-who{display:flex;align-items:center;gap:14px}
.dw-q-av{display:inline-flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;border-radius:50%;background:var(--dw-card-line);font-size:12px;font-weight:600}
.dw-q-name{display:block;font-size:16px;font-weight:500}
.dw-q-src{display:block;margin-top:2px;font-size:13px;color:var(--dw-card-muted)}


.dw-cta{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,655px);gap:clamp(24px,8cqi,124px);align-items:center;padding:clamp(64px,7cqi,100px) clamp(16px,2cqi,29px);background:var(--dw-cta-bg);color:var(--dw-cta-text);overflow:clip}
.dw-cta-media{position:absolute;inset:0;z-index:0}
.dw-cta-media img{filter:grayscale(1)}
.dw-cta-media::after{content:'';position:absolute;inset:0;background:rgba(0,0,0,.62)}
.dw-cta>*:not(.dw-cta-media){position:relative;z-index:1}
.dw-cta-copy{max-width:470px}
.dw-cta .dw-intro{color:var(--dw-cta-muted)}
.dw-cta-tag{margin:56px 0 24px;font-family:var(--dw-head);font-size:22px;font-weight:500;letter-spacing:-.02em}
.dw-cta-list{display:flex;flex-direction:column;gap:22px;margin:0;padding:0;list-style:none}
.dw-cta-label{display:block;margin-bottom:6px;font-family:${MONO};font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--dw-cta-muted)}
.dw-cta-value{font-size:20px;color:inherit;text-decoration:none;overflow-wrap:anywhere}
.dw-cta-card{display:flex;flex-direction:column;align-items:flex-start;gap:18px;padding:38px;border-radius:8px;background:var(--dw-card-bg);color:var(--dw-card-text)}
.dw-cta-card p{margin:0;font-size:16px;line-height:1.5;color:var(--dw-card-muted)}
.dw-cta>[data-acg-inquiry]{max-width:none!important;margin:0!important;padding:38px!important;border-radius:8px;background:var(--dw-card-bg);color:var(--dw-card-text)}
.dw-cta>[data-acg-inquiry] h3{font-family:var(--dw-head);font-weight:500!important;letter-spacing:-.02em}
.dw-cta>[data-acg-inquiry] input,.dw-cta>[data-acg-inquiry] textarea{border:0!important;border-bottom:1px solid var(--dw-card-line)!important;border-radius:0!important;background:transparent!important;color:var(--dw-card-text)!important;padding:12px 0!important;margin-bottom:18px!important}
.dw-cta>[data-acg-inquiry] input::placeholder,.dw-cta>[data-acg-inquiry] textarea::placeholder{color:var(--dw-card-muted)}
.dw-cta>[data-acg-inquiry] button[type=submit]{border-radius:3px!important;padding:16px!important;text-align:left}

.dw-foot{order:9999;padding:clamp(40px,7cqi,116px) 0 29px;background:var(--dw-dark-bg);color:var(--dw-dark-text)}
.dw-foot-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr);gap:22px}
.dw-foot-nophoto{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}
.dw-foot-ph{position:relative;overflow:hidden;min-height:440px;border-radius:8px;background:var(--dw-card-bg)}
.dw-foot-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dw-foot-ph::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.6),rgba(0,0,0,0) 45%)}
.dw-foot-ph .dw-eyebrow{position:absolute;left:28px;bottom:22px;z-index:1;margin:0;color:#fff}
.dw-foot-card{padding:28px;border-radius:8px;background:var(--dw-card-bg);color:var(--dw-card-text)}
.dw-foot-mid{display:flex;flex-direction:column;justify-content:space-between;gap:40px}
.dw-foot-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.dw-foot-h{margin:0 0 18px;font-family:${MONO};font-size:10px;font-weight:400;letter-spacing:.04em;text-transform:uppercase;color:var(--dw-card-muted)}
.dw-foot-links{display:flex;flex-direction:column;gap:10px;margin:0;padding:0;list-style:none}
.dw-foot-links a,.dw-foot-links span{color:inherit;font-size:14px;text-decoration:none;overflow-wrap:anywhere}
.dw-foot-copy{margin:0;font-size:11px;line-height:1.5;color:var(--dw-card-muted)}
.dw-foot-side{display:flex;flex-direction:column;gap:22px}
.dw-foot-area{flex:1;display:flex;flex-direction:column;gap:14px}
.dw-foot-pin{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:16/9;border-radius:6px;background:var(--dw-dark-bg);color:var(--dw-dark-accent)}
.dw-foot-area h3{margin:6px 0 0;font-family:var(--dw-head);font-size:17px;font-weight:500;letter-spacing:-.02em}
.dw-foot-area p{margin:0;font-size:13px;color:var(--dw-card-muted)}
.dw-foot-book{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;color:inherit;font-size:13px;text-decoration:none}
.dw-foot-book svg{color:var(--dw-dark-accent)}
.dw-foot-brand{display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center}
.dw-foot-brand p{margin:0;font-size:11px;color:var(--dw-card-muted)}

@media (hover:hover){
  .dw-links a:hover,.dw-foot-links a:hover{opacity:.72}
  .dw-btn:hover .dw-btn-box{background:var(--dw-accent);color:var(--dw-on-accent)}
  .dw-svc-tab:hover{background:var(--dw-card-bg)}
  .dw-foot-book:hover{opacity:.8}
  .dw-rev-btn:hover{border-color:var(--dw-dark-text)}
}
@media (prefers-reduced-motion: no-preference){
  .dw-nav-box,.dw-btn-box,.dw-svc-tab{transition:background-color .2s ease,color .2s ease,opacity .2s ease}
  .dw-rev{scroll-behavior:smooth}
  .dw-rev-btn{transition:border-color .2s ease}
}
@container (max-width: 1000px){
  .dw-links{display:none}
  .dw-svc{gap:28px}
  .dw-how{grid-template-columns:minmax(0,1fr)}
  .dw-how-head{position:static}
  .dw-cta{grid-template-columns:minmax(0,1fr)}
  .dw-foot-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .dw-foot-ph{grid-column:1/-1;min-height:360px}
}
@container (max-width: 600px){
  .dw-nav-phone{display:none}
  .dw-nav-box{width:auto;margin-top:16px;padding:8px 8px 8px 14px}
  .dw-nav-box .dw-logo{margin-right:auto}
  .dw-nav-box .dw-btn{font-size:13px;padding-left:10px}
  .dw-hero{min-height:760px}
  .dw-hero-in{flex-direction:column;align-items:flex-start}
  .dw-rating{width:100%}
  .dw-info-row{flex-direction:column;gap:18px;padding-top:16px;padding-bottom:20px}
  .dw-info-label{margin-bottom:6px}
  .dw-about-top{grid-template-columns:1fr;gap:0}
  .dw-about-grid{grid-template-columns:1fr}
  .dw-about-ph2,.dw-about-card,.dw-about-one .dw-about-card{margin-top:0}
  .dw-about-one{grid-template-columns:minmax(0,1fr)}
  .dw-svc{grid-template-columns:minmax(0,1fr)}
  .dw-svc-list{display:none}
  .dw-svc-panels{display:flex;flex-direction:column;gap:24px}
  .dw-svc-panel{display:block!important}
  .dw-svc-panel.dw-has-ph .dw-svc-main{grid-template-columns:minmax(0,1fr)}
  .dw-svc-panel.dw-has-ph .dw-svc-ph{order:-1}
  .dw-svc-panels{position:static}
  .dw-svc-panel:not(.dw-has-ph) .dw-svc-main{min-height:0}
  .dw-svc-big{display:none}
  .dw-inc ul{grid-template-columns:minmax(0,1fr)}
  .dw-vt{grid-template-columns:repeat(2,minmax(0,1fr))}
  .dw-gal{grid-template-columns:minmax(0,1fr);gap:22px}
  .dw-gal-item{grid-column:1/-1!important;margin-top:0!important}
  .dw-cmp th,.dw-cmp td{padding:0 10px;height:62px}
  .dw-cmp-label{width:40%}
  .dw-cmp-us,.dw-cmp-them{width:30%}
  .dw-cmp-name{font-size:13px;overflow-wrap:anywhere}
  .dw-rev{grid-auto-columns:86%}
  .dw-rev-few .dw-rev-nav{display:flex}
  .dw-cta-card,.dw-cta>[data-acg-inquiry]{padding:24px!important}
  .dw-foot-grid{grid-template-columns:minmax(0,1fr)}
  .dw-foot-cols{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
}
`;

// The kit FAQ band, restyled: two columns of questions with a rule under
// each and the accent "+" (faqCss reads these --dw-faq-* aliases).
const FAQ_CSS = `
.dw-faq-band{--dw-faq-text:var(--dw-text);--dw-faq-muted:var(--dw-muted);--dw-faq-accent:var(--dw-accent-text);--dw-faq-line:var(--dw-border-strong);--dw-faq-focus:var(--dw-focus);--dw-faq-r:0px;--dw-faq-q-w:400}
.dw-faq-band .dw-faq-list{column-gap:72px;max-width:1066px;margin:0 auto}
.dw-faq-band .dw-faq-col{gap:0}
.dw-faq-band .dw-faq-item{border:0;border-bottom:1px solid var(--dw-faq-line);border-radius:0}
.dw-faq-band .dw-faq-q{padding:22px 44px 22px 0;font-size:17px;letter-spacing:-.01em}
.dw-faq-band .dw-faq-icon{top:22px;right:0}
.dw-faq-band .dw-faq-a{padding:0 0 22px}
`;

// The kit Before & After slider on the dark band.
const BA_CSS = `
.dw-ba-band{--dw-ba-text:var(--dw-dark-text);--dw-ba-muted:var(--dw-dark-muted);--dw-ba-line:var(--dw-dark-line);--dw-ba-focus:var(--dw-dark-accent);--dw-ba-tag-bg:rgba(0,0,0,.6);--dw-ba-tag-text:#fff;--dw-ba-tag2-bg:rgba(0,0,0,.6);--dw-ba-tag2-text:#fff;--dw-ba-knob-bg:#fff;--dw-ba-knob-text:#000;--dw-ba-r:8px;--dw-ba-tag-r:2px;--dw-ba-ratio-wide:3 / 2}
.dw-ba-band .dw-ba-slider,.dw-ba-band .dw-ba-nav,.dw-ba-band .dw-ba-cap{max-width:806px;margin-left:auto;margin-right:auto}
`;

function Arrow({ size = 16 }) {
  return <LucideIcon name="arrowRight" size={size} stroke={1.75} />;
}

function Heading({ h, center = true, id, className = '' }) {
  return (
    <div className={`dw-head${center ? ' dw-center' : ''} ${className}`.trim()} data-acg-reveal="">
      {h.eyebrow && <p className="dw-eyebrow">{h.eyebrow}</p>}
      <h2 id={id} className="dw-h2"><Accented title={h.title} accent={h.accent} className="dw-em" /></h2>
      {h.intro && <p className="dw-intro">{h.intro}</p>}
    </div>
  );
}

function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p data-acg-editor-only="" style={{ margin: '18px 0 0', padding: '10px 14px', border: '1.5px dashed rgba(128,128,128,.55)', borderRadius: 6, fontSize: 13, lineHeight: 1.45, opacity: 0.85 }}>{children}</p>
    </EditorOnly>
  );
}

export default function MobileDriveway({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const head = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const tokens = replicaTokens(t);

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrder(copy, sections.map((s) => s.id));
  const hd = headingDefaults();
  const st = (id) => sectionTitle(copy.sectionTitles, id);
  // A band's heading: the owner's (Edit > Headings), else the design's own.
  const heading = (id, own = {}) => {
    const s = st(id);
    return {
      eyebrow: s.eyebrow || hd[id].eyebrow,
      title: txt(own.title) || s.title || hd[id].title,
      accent: s.accent,
      intro: txt(own.intro) || s.intro,
    };
  };

  const name = txt(biz.businessName);
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const phoneText = phoneDisplay(phone);
  const email = txt(biz.email);
  const area = txt(biz.serviceArea);
  const place = [txt(biz.city), txt(biz.state)].filter(Boolean).join(', ');
  const hours = hoursRows(biz.hours);
  const hoursText = hoursFact(hours);

  // Services: the owner's list (businessInfo.services, mirrored to packages
  // by normalizeBusinessInfo) wins over the AI list; an owner service with
  // no description borrows the AI description of the same service.
  const aiItems = list(copy.servicesSection?.items)
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }));
  const aiDesc = new Map(aiItems.filter((s) => s.name && s.description).map((s) => [nameKey(s.name), s.description]));
  const fromPackages = list(biz.packages).length > 0;
  const services = (fromPackages ? biz.packages : aiItems)
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({
      name: txt(s.name),
      price: txt(s.price),
      description: txt(s.description) || (fromPackages ? aiDesc.get(nameKey(s.name)) || '' : ''),
      image: txt(s.image),
      includes: serviceIncludes(s.includes),
      category: txt(s.category),
    }))
    .filter((s) => s.name || s.description || s.price)
    .slice(0, 24);
  const servicesOn = show('services') && services.length > 0;
  // One numbered tab per service, in the owner's order.
  const svcOrder = services.map((s) => ({ s }));
  const svcHead = heading('services', { title: copy.servicesSection?.title, intro: copy.servicesSection?.intro });
  const bookHref = show('cta') ? '#contact' : tel || (email ? `mailto:${email}` : '#top');

  // Before & After (kit band): opt-in through copy.beforeAfter, and on the
  // published page only with a pair that has both photos.
  const ba = beforeAfterPairs(copy.beforeAfter, images, { editor });
  const baOn = show('beforeAfter') && Boolean(ba) && (ba.pairs.length > 0 || editor);
  const baPhotos = new Set(baOn ? ba.pairs.flatMap((p) => [p.before, p.after]).filter(Boolean) : []);

  // Photos: a gallery photo the Before & After band or a service card shows
  // stays out of the gallery. The gallery band shows the first six, the next
  // one fills the footer card, and whatever is left joins the band, so every
  // photo shows once.
  const usedElsewhere = new Set([...baPhotos, ...(servicesOn ? services.map((x) => x.image).filter(Boolean) : [])]);
  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k] && !usedElsewhere.has(images[k]))
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);
  const how = howItWorksSteps(copy.howSteps);
  const howOn = show('process') && Boolean(how) && (how.steps.length > 0 || editor);
  // Edit > How It Works > Step Photo, one per step. The published page
  // shows them once every step has one (an even row of cards); the editor
  // shows a placeholder for each one still missing.
  const stepPhotos = howOn ? howStepPhotos(copy.howSteps, images) : [];
  const stepPhotosOn = editor || (stepPhotos.length > 0 && stepPhotos.every(Boolean));
  const about = aboutParts(copy.aboutText);
  const aboutOn = show('about') && Boolean(about.lead || editor);
  // About > About Photo and Second About Photo: the editor shows both slots
  // (a placeholder for an empty one); the published page only the photos
  // that exist, the story card taking the room of a missing one.
  const aboutPhoto2 = typeof images.about2 === 'string' && images.about2.trim() ? images.about2 : '';
  const aboutPhotos = [{ src: txt(images.about) ? images.about : '', slot: 'about' }, { src: aboutPhoto2, slot: 'about2' }]
    .filter((p) => editor || p.src);
  const gallerySlots = show('gallery') ? 6 : 0;
  const spare = galleryImages.slice(gallerySlots);
  let take = 0;
  // Out of spare photos, the footer card borrows the About photo only while
  // the About section isn't showing it.
  const footPhoto = spare[take] ? spare[take++] : (!aboutOn && images.about) || '';
  const galleryShown = show('gallery') ? [...galleryImages.slice(0, gallerySlots), ...spare.slice(take)] : [];

  // Google rating card (Edit > Google Rating): only from the owner's
  // connected place, in the hero unless they turned that spot off.
  const rating = googleRatingOf(biz.googlePlace);
  const badgeAt = googleBadgePlacements(copy.googleBadge, ['hero']);
  const ratingOn = Boolean(rating) && badgeAt.includes('hero');

  // Info bar: what the owner entered, two facts or more.
  const info = [
    phone && { label: 'Call', value: phoneText, href: tel },
    (area || place) && { label: area ? 'Service area' : 'Based in', value: area || place },
    hoursText && { label: 'Hours', value: hoursText },
    email && { label: 'Email', value: email, href: `mailto:${email}` },
  ].filter(Boolean);
  const infoOn = show('statsBar') && info.length >= 2;

  // About: the first paragraph is the big statement, the rest sits in the
  // card with the owner's stats (About > Stats Box) when there are any.
  const aboutHead = heading('about');
  const stats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label)
    .slice(0, 2);

  const vt = vehicleTypesOf(copy.vehicleTypes, { editor });
  const vtOn = show('vehicleTypes') && Boolean(vt) && (vt.items.length > 0 || editor);
  const vtHead = vehicleTypesHeading(copy.vehicleTypes, copy.sectionTitles, VT_DEFAULTS);

  const howHead = howItWorksHeading(copy.sectionTitles, HOW_DEFAULTS);

  const baT = st('beforeAfter');
  const baHead = { eyebrow: baT.eyebrow || BA_DEFAULTS.eyebrow, title: ba?.title || baT.title || BA_DEFAULTS.title, accent: baT.accent, intro: ba?.intro || baT.intro || BA_DEFAULTS.intro };

  const cmp = comparisonOf(copy.comparison, { editor, businessName: name });
  const cmpOn = show('comparison') && Boolean(cmp) && (cmp.rows.length > 0 || editor);
  const cmpHead = comparisonHeading(copy.comparison, copy.sectionTitles, CMP_DEFAULTS);

  const faq = faqItems(copy.faq, { editor });
  const faqOn = show('faq') && Boolean(faq) && (faq.items.length > 0 || editor);
  const faqHead = faqHeading(copy.faq, copy.sectionTitles, FAQ_DEFAULTS);

  const testimonials = list(copy.testimonialPlaceholders).filter((q) => txt(q?.text));
  const reviews = copy.googleWidgetKey ? 'google' : testimonials.length > 0 ? 'quotes' : null;
  const reviewsOn = show('testimonials') && Boolean(reviews);
  // Without a connected Google rating, the hero card quotes the first review
  // the Reviews section shows (stars and the Google label only for a quote
  // the owner marked as a Google review), linking down to the rest.
  const heroQuote = !ratingOn && reviewsOn && reviews === 'quotes' ? testimonials[0] : null;
  const heroQuoteStars = heroQuote ? reviewStars(heroQuote) : 0;

  const ctaHead = heading('cta', { title: copy.ctaHeadline, intro: copy.ctaSubtext });
  const ctaPhoto = images.cta || images.hero || '';

  const navLinks = [
    servicesOn && { href: '#services', label: 'Services' },
    galleryShown.length > 0 && { href: '#gallery', label: 'Work' },
    reviewsOn && { href: '#reviews', label: 'Reviews' },
    faqOn && { href: '#faq', label: 'FAQ' },
  ].filter(Boolean);
  const menuLinks = [
    ...navLinks,
    show('about') && { href: '#about', label: 'About' },
    show('cta') && { href: '#contact', label: 'Contact' },
  ].filter(Boolean);

  const heroT = st('hero');
  const headline = txt(copy.headline) || heroT.title || name;
  const chip = heroT.eyebrow || (area ? `Serving ${area}` : place);
  const primaryHref = txt(copy.ctaPrimaryUrl) || (servicesOn ? '#services' : bookHref);
  const primaryLabel = txt(copy.ctaPrimary) || (servicesOn ? 'View Services' : 'Book Now');
  const tagline = txt(copy.footerTagline) || txt(biz.tagline);

  const logo = images.logo ? (
    <PhotoSlot src={images.logo} slot="logo" alt={name ? `${name} logo` : 'Logo'} style={{ width: 'auto', height: 38, maxWidth: 150, objectFit: 'contain', borderRadius: 3 }} />
  ) : (
    <span className="dw-logo-name">{name}</span>
  );

  // CSS-only service tabs: one radio per service (the first checked); the
  // checked radio shows its panel and lights its label.
  const svcCss = svcOrder.map((_, i) => (
    `#dw-svc-${i}:checked~.dw-svc .dw-svc-p${i}{display:block}`
    + `#dw-svc-${i}:checked~.dw-svc .dw-svc-t${i}{background:var(--dw-card-bg);border-bottom-color:transparent;color:var(--dw-dark-accent)}`
    + `#dw-svc-${i}:checked~.dw-svc .dw-svc-t${i} .dw-svc-num{color:var(--dw-dark-accent)}`
    + `#dw-svc-${i}:focus-visible~.dw-svc .dw-svc-t${i}{outline:2px solid var(--dw-focus);outline-offset:2px}`
  )).join('\n');

  const css = CSS + svcCss
    + (faqOn ? faqCss('dw-faq', { twoFrom: 601 }) + FAQ_CSS : '')
    + (baOn ? beforeAfterCss('dw-ba') + BA_CSS : '');

  const rootVars = {
    ...tokens,
    '--dw-head': head,
    '--dw-nav-bg': alpha(mix(tokens['--dw-dark-bg'], '#ffffff', 0.12), 0.88),
    '--dw-card-bg2': mix(tokens['--dw-card-bg'], tokens['--dw-dark-bg'], 0.55),
  };

  return (
    <div className="dw-root" style={{ ...rootVars, position: 'relative', containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.5 }}>
      <style>{css}</style>
      <a className="dw-skip" href="#top">Skip to main content</a>

      {tagline && (
        <div className="dw-top" style={{ order: -2 }}>
          <LucideIcon name="sparkles" size={14} />
          <span>{tagline}</span>
        </div>
      )}

      <header className="dw-nav" style={{ order: -1 }}>
        <nav className="dw-nav-box" aria-label="Main">
          <a className="dw-logo" href="#top">{logo}</a>
          {navLinks.length > 0 && (
            <div className="dw-links">
              {navLinks.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
            </div>
          )}
          {tel && <a className="dw-nav-phone" href={tel}>{phoneText}</a>}
          <a className="dw-btn" href={bookHref} {...bookingAttrs(true)}>
            Book Now
            <span className="dw-btn-box"><Arrow /></span>
          </a>
          <MobileMenu
            links={menuLinks}
            cta={tel ? { href: tel, label: `Call ${phoneText}` } : { href: bookHref, label: 'Book Now', bookingTrigger: true }}
            colors={{ ...t, bg: tokens['--dw-dark-bg'], surface: tokens['--dw-card-bg'], text: tokens['--dw-dark-text'], textMuted: tokens['--dw-dark-muted'] }}
            font={body}
          />
        </nav>
      </header>

      {show('hero') && (
        <section data-section="hero" id="top" className="dw-hero" style={{ order: order('hero') }}>
          <div className="dw-hero-media">
            <PhotoSlot src={images.hero} slot="hero" alt="" loading="eager" fetchPriority="high" />
          </div>
          <div className="dw-wrap dw-hero-in">
            <div className="dw-hero-copy">
              {chip && (
                <p className="dw-chip"><LucideIcon name="pin" size={14} />{chip}</p>
              )}
              <h1 className="dw-h1"><Accented title={headline} accent={heroT.accent} className="dw-em" /></h1>
              {txt(copy.subheadline) && <p className="dw-hero-sub">{copy.subheadline}</p>}
              <div className="dw-hero-cta">
                <a className="dw-btn" href={primaryHref}>
                  {primaryLabel}
                  <span className="dw-btn-box"><Arrow /></span>
                </a>
              </div>
            </div>
            {ratingOn && (
              <a className="dw-rating" href={rating.url || undefined} target={rating.url ? '_blank' : undefined} rel={rating.url ? 'noopener noreferrer' : undefined}>
                <span className="dw-rating-top">
                  <StarRow rating={rating.rating} size={20} color={GOOGLE_STAR_GOLD} />
                  <span className="dw-rating-src">Google reviews</span>
                </span>
                <span className="dw-rating-row">
                  <span className="dw-rating-num">{rating.ratingText}<small>/5</small></span>
                  <span className="dw-rating-txt">{rating.countText} {rating.reviewCount === 1 ? 'review' : 'reviews'} on Google</span>
                </span>
              </a>
            )}
            {heroQuote && (
              <a className="dw-rating dw-hq" href="#reviews">
                <span className="dw-rating-top">
                  {heroQuoteStars > 0
                    ? <StarRow rating={heroQuoteStars} size={20} color={GOOGLE_STAR_GOLD} />
                    : <span className="dw-hq-mark" aria-hidden="true">“</span>}
                  <span className="dw-rating-src">{heroQuote.source === 'google' ? 'Google review' : 'Reviews'}</span>
                </span>
                <span className="dw-hq-text">“{clipWords(txt(heroQuote.text), 150)}”</span>
                <span className="dw-hq-who">{txt(heroQuote.name) || 'Customer'}</span>
              </a>
            )}
          </div>
        </section>
      )}

      {infoOn && (
        <section data-section="statsBar" className="dw-info" aria-label="At a glance" style={{ order: order('statsBar') }}>
          <div className="dw-wrap dw-info-row">
            {info.map((f) => (
              <div key={f.label} className="dw-info-item">
                <span className="dw-info-label">{f.label}</span>
                {f.href ? <a className="dw-info-value" href={f.href}>{f.value}</a> : <span className="dw-info-value">{f.value}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {aboutOn && (
        <section data-section="about" id="about" className="dw-sec dw-light" style={{ order: order('about') }}>
          <div className="dw-wrap">
            <div className="dw-about-top" data-acg-reveal="">
              <p className="dw-eyebrow">{aboutHead.eyebrow}</p>
              <div>
                {aboutHead.title && <h2 className="dw-h2" style={{ marginBottom: 20 }}><Accented title={aboutHead.title} accent={aboutHead.accent} className="dw-em" /></h2>}
                <p className="dw-about-lead">{about.lead}</p>
                {!about.lead && <EditorHint>Add your story in Edit &gt; About.</EditorHint>}
              </div>
            </div>
            <div className={`dw-about-grid${['dw-about-none', 'dw-about-one', ''].map((c) => (c ? ` ${c}` : ''))[aboutPhotos.length]}`}>
              {aboutPhotos.map((p, i) => (
                <div key={p.slot} className={i ? 'dw-about-ph dw-about-ph2' : 'dw-about-ph'} data-acg-reveal="" style={i ? { '--acg-delay': '120ms' } : undefined}>
                  <PhotoSlot src={p.src} slot={p.slot} alt={i === 0 && name ? `${name} at work` : ''} />
                </div>
              ))}
              {(about.rest.length > 0 || stats.length > 0) && (
                <div className="dw-about-card" data-acg-reveal="" style={{ '--acg-delay': '220ms' }}>
                  <div>{about.rest.map((p, i) => <p key={i}>{p}</p>)}</div>
                  {stats.length > 0 && (
                    <div className="dw-stats">
                      {stats.map((s) => (
                        <div key={s.label}>
                          <span className="dw-stat-v">{s.value}</span>
                          <span className="dw-stat-l">{s.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {servicesOn && (
        <section data-section="services" id="services" className="dw-sec dw-dark" aria-labelledby="dw-svc-h" style={{ order: order('services') }}>
          <div className="dw-wrap">
            <Heading h={svcHead} id="dw-svc-h" />
            {svcOrder.map((_, i) => (
              <input key={i} type="radio" name="dw-svc" id={`dw-svc-${i}`} className="dw-svc-in" defaultChecked={i === 0} aria-label={svcOrder[i].s.name || `Service ${i + 1}`} />
            ))}
            <div className="dw-svc">
              <div className="dw-svc-list">
                {svcOrder.map(({ s }, i) => (
                  <label key={i} htmlFor={`dw-svc-${i}`} className={`dw-svc-tab dw-svc-t${i}`}>
                    <span className="dw-svc-num">{String(i + 1).padStart(2, '0')}</span>
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
              <div className="dw-svc-panels">
                {svcOrder.map(({ s }, i) => (
                  <article key={i} className={`dw-svc-panel dw-svc-p${i}${s.image ? ' dw-has-ph' : ''}`}>
                    <div className="dw-svc-main">
                      <div className="dw-svc-body">
                        {s.category && <p className="dw-svc-cat">{s.category}</p>}
                        <h3 className="dw-svc-name">{s.name}</h3>
                        {s.description && <p className="dw-svc-desc">{s.description}</p>}
                        {s.price && <p className="dw-svc-price">{s.price}</p>}
                        <a className={`dw-btn dw-svc-book`} href={bookHref} {...bookingAttrs(true, s.name)} style={s.price ? undefined : { marginTop: 'auto', paddingTop: 4 }}>
                          Book Now
                          <span className="dw-btn-box"><Arrow /></span>
                        </a>
                      </div>
                      {s.image ? (
                        <div className="dw-svc-ph">
                          <PhotoSlot src={s.image} slot="service" alt={s.name} />
                        </div>
                      ) : <span className="dw-svc-big" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>}
                    </div>
                    {s.includes.length > 0 && (
                      <div className="dw-inc">
                        <p className="dw-inc-h">Includes:</p>
                        <ul>
                          {s.includes.map((it, k) => <li key={k} className={it.heading ? 'dw-inc-sub' : undefined}>{it.text}</li>)}
                        </ul>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {vtOn && (
        <section data-section="vehicleTypes" id="vehicle-types" className="dw-sec dw-light" aria-labelledby="dw-vt-h" style={{ order: order('vehicleTypes') }}>
          <div className="dw-wrap">
            <Heading h={vtHead} id="dw-vt-h" />
            {vt.items.length > 0 && (
              <ul className="dw-vt" style={{ listStyle: 'none', padding: 0 }}>
                {vt.items.map((it, i) => (
                  <li key={it.index} className="dw-vt-item" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <span className="dw-vt-art"><VehicleTypeIcon name={it.icon} size={120} stroke={1.1} /></span>
                    <p className="dw-vt-name">{it.name || <EditorOnly><span data-acg-editor-only="">{VT_HINTS.noName}</span></EditorOnly>}</p>
                    {it.desc && <p className="dw-vt-desc">{it.desc}</p>}
                  </li>
                ))}
              </ul>
            )}
            {vt.items.length === 0 && <EditorHint>{VT_HINTS.empty}</EditorHint>}
          </div>
        </section>
      )}

      {howOn && (
        <section data-section="process" id="process" className="dw-sec dw-alt" aria-labelledby="dw-how-h" style={{ order: order('process') }}>
          <div className="dw-wrap dw-how">
            <div className="dw-how-head">
              <Heading h={howHead} id="dw-how-h" center={false} className="dw-how-h" />
            </div>
            {how.steps.length > 0 ? (
              <ol className="dw-how-list">
                {how.steps.map((s, i) => (
                  <li key={i} className="dw-step" data-acg-reveal="">
                    {stepPhotosOn && (
                      <div className="dw-step-ph"><PhotoSlot src={stepPhotos[i]} slot="howStep" alt="" /></div>
                    )}
                    <h3 className="dw-step-h">
                      <span className="dw-step-n">{s.number}</span>
                      <span>{s.title}</span>
                      {s.emoji && <span className="dw-step-e" aria-hidden="true"><IconOrEmoji value={s.emoji} size={20} /></span>}
                    </h3>
                    {s.desc && <p className="dw-step-d">{s.desc}</p>}
                  </li>
                ))}
              </ol>
            ) : <EditorHint>{HOW_HINTS.empty}</EditorHint>}
          </div>
        </section>
      )}

      {baOn && (
        <BeforeAfterBand
          ns="dw-ba"
          beforeAfter={copy.beforeAfter}
          images={images}
          editor={editor}
          order={order('beforeAfter')}
          className="dw-sec dw-dark"
          wrapClassName="dw-wrap"
          labelledBy="dw-ba-h"
          heading={<Heading h={baHead} id="dw-ba-h" />}
        />
      )}

      {show('gallery') && (galleryShown.length > 0 || editor) && (
        <section data-section="gallery" id="gallery" className="dw-sec dw-dark" aria-labelledby="dw-gal-h" style={{ order: order('gallery') }}>
          <div className="dw-wrap">
            <Heading h={heading('gallery')} id="dw-gal-h" />
            {galleryShown.length > 0 ? (
              <div className="dw-gal">
                {galleryShown.map((src, i) => (
                  <figure key={src} className={`dw-gal-item dw-g${i % 6}`} data-acg-reveal="">
                    <PhotoSlot src={src} slot="gallery" alt={name ? `${name} work photo ${i + 1}` : `Work photo ${i + 1}`} loading="lazy" />
                  </figure>
                ))}
              </div>
            ) : <EditorHint>Add photos in Edit &gt; Gallery.</EditorHint>}
          </div>
        </section>
      )}

      {cmpOn && (
        <section data-section="comparison" id="comparison" className="dw-sec dw-alt" aria-labelledby="dw-cmp-h" style={{ order: order('comparison') }}>
          <div className="dw-wrap">
            <Heading h={cmpHead} id="dw-cmp-h" />
            {cmp.rows.length > 0 ? (
              <div className="dw-cmp-wrap" data-acg-reveal="">
                <table className="dw-cmp">
                  <thead>
                    <tr>
                      <th scope="col" className="dw-cmp-label"><span className="dw-sr">Compare</span></th>
                      <th scope="col" className="dw-cmp-us"><span className="dw-cmp-name">{cmp.usLabel}</span></th>
                      <th scope="col" className="dw-cmp-them">{cmp.themLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmp.rows.map((r) => (
                      <tr key={r.index}>
                        <th scope="row" className="dw-cmp-label">{r.label || <EditorOnly><span data-acg-editor-only="">{CMP_HINTS.noLabel}</span></EditorOnly>}</th>
                        {[['us', r.us], ['them', r.them]].map(([side, c]) => (
                          <td key={side} className={`dw-cmp-${side}`}>
                            {c.kind === 'yes' && <span className="dw-cmp-yes"><LucideIcon name="check" size={13} stroke={2.5} /><span className="dw-sr">Yes</span></span>}
                            {c.kind === 'no' && <span className="dw-cmp-no" role="img" aria-label="No" />}
                            {c.kind === 'text' && c.text}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EditorHint>{CMP_HINTS.empty}</EditorHint>}
          </div>
        </section>
      )}

      {reviewsOn && (
        <section data-section="testimonials" id="reviews" className="dw-sec dw-dark" aria-labelledby="dw-rev-h" style={{ order: order('testimonials') }}>
          <div className="dw-wrap">
            <div className={`dw-rev-head${testimonials.length <= 3 ? ' dw-rev-few' : ''}`}>
              <Heading h={heading('testimonials')} id="dw-rev-h" center={false} />
              {reviews === 'quotes' && testimonials.length > 1 && (
                <div className="dw-rev-nav">
                  <button type="button" className="dw-rev-btn" data-acg-scroll="prev" aria-controls="dw-rev-track" aria-label="Previous review"><LucideIcon name="arrowLeft" size={20} /></button>
                  <button type="button" className="dw-rev-btn" data-acg-scroll="next" aria-controls="dw-rev-track" aria-label="Next review"><LucideIcon name="arrowRight" size={20} /></button>
                </div>
              )}
            </div>
            {reviews === 'google' ? (
              <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
            ) : (
              <div id="dw-rev-track" className="dw-rev" data-acg-reveal="" {...(testimonials.length > 1 ? { role: 'region', 'aria-label': 'Customer reviews, scroll sideways for more', tabIndex: 0 } : {})}>
                {testimonials.map((q, i) => {
                  const stars = reviewStars(q);
                  const who = txt(q.name) || 'Customer';
                  return (
                    <figure key={i} className="dw-q">
                      <blockquote>“{txt(q.text)}”</blockquote>
                      <figcaption className="dw-q-foot">
                        {stars > 0 && <StarRow rating={stars} size={16} color={GOOGLE_STAR_GOLD} />}
                        <span className="dw-q-who">
                          <span className="dw-q-av" aria-hidden="true">{initials(who) || '•'}</span>
                          <span>
                            <span className="dw-q-name">{who}</span>
                            {(q.source === 'google' || txt(q.service)) && (
                              <span className="dw-q-src">{[txt(q.service), q.source === 'google' && 'Google review'].filter(Boolean).join(' · ')}</span>
                            )}
                          </span>
                        </span>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {faqOn && (
        <FaqBand
          ns="dw-faq"
          faq={copy.faq}
          editor={editor}
          order={order('faq')}
          className="dw-sec dw-light dw-faq-band"
          wrapClassName="dw-wrap"
          labelledBy="dw-faq-h"
          heading={<Heading h={faqHead} id="dw-faq-h" />}
          hints={editor && faq.items.length === 0 ? <EditorHint>{FAQ_HINTS.empty}</EditorHint> : null}
        />
      )}

      {show('cta') && (
        <section data-section="cta" id="contact" className="dw-cta dw-photo" aria-labelledby="dw-cta-h" style={{ order: order('cta') }}>
          {ctaPhoto && (
            <div className="dw-cta-media">
              <PhotoSlot src={ctaPhoto} slot="cta" alt="" loading="lazy" />
            </div>
          )}
          <div className="dw-cta-copy">
            <p className="dw-eyebrow">{ctaHead.eyebrow}</p>
            <h2 id="dw-cta-h" className="dw-h2"><Accented title={ctaHead.title} accent={ctaHead.accent} className="dw-em" /></h2>
            {ctaHead.intro && <p className="dw-intro">{ctaHead.intro}</p>}
            {(tel || email || area) && (
              <>
                {tagline && <p className="dw-cta-tag">{tagline}</p>}
                <ul className="dw-cta-list" style={tagline ? undefined : { marginTop: 40 }}>
                  {tel && <li><span className="dw-cta-label">Call us</span><a className="dw-cta-value" href={tel}>{phoneText}</a></li>}
                  {email && <li><span className="dw-cta-label">Email</span><a className="dw-cta-value" href={`mailto:${email}`}>{email}</a></li>}
                  {(area || place) && <li><span className="dw-cta-label">{area ? 'Service area' : 'Based in'}</span><span className="dw-cta-value">{area || place}</span></li>}
                </ul>
              </>
            )}
          </div>
          <EditorOnly>
            <div className="dw-cta-card" data-acg-editor-only="">
              <p>Your contact form appears in this card on the published site: messages go to your inbox in the dashboard.</p>
            </div>
          </EditorOnly>
        </section>
      )}

      <footer className="dw-foot" style={{ order: 9999 }}>
        <div className={`dw-wrap dw-foot-grid${footPhoto ? '' : ' dw-foot-nophoto'}`}>
          {footPhoto && (
            <div className="dw-foot-ph">
              <PhotoSlot src={footPhoto} slot="gallery" alt="" loading="lazy" />
              {name && <p className="dw-eyebrow">{name}</p>}
            </div>
          )}
          <div className="dw-foot-card dw-foot-mid">
            <div className="dw-foot-cols">
              <div>
                <p className="dw-foot-h">Explore</p>
                <ul className="dw-foot-links">
                  {menuLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
              <div>
                <p className="dw-foot-h">Contact</p>
                <ul className="dw-foot-links">
                  {tel && <li><a href={tel}>{phoneText}</a></li>}
                  {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                  {place && <li><span>{place}</span></li>}
                  {hours.map((h) => <li key={h.days}><span>{h.time ? `${h.days} ${h.time}` : h.days}</span></li>)}
                </ul>
              </div>
            </div>
            <div>
              <SocialRow biz={biz} images={images} size={18} gap={14} color={tokens['--dw-card-text']} style={{ marginBottom: 18 }} />
              <p className="dw-foot-copy">© <span data-acg-year="">{new Date().getFullYear()}</span> {name}. All rights reserved.</p>
            </div>
          </div>
          <div className="dw-foot-side">
            {(area || place) && (
              <div className="dw-foot-card dw-foot-area">
                <span className="dw-foot-pin"><LucideIcon name="pin" size={40} stroke={1.5} /></span>
                <h3>{area ? 'Where we work' : 'Where we are'}</h3>
                <p>{area || place}</p>
                <a className="dw-foot-book" href={bookHref} {...bookingAttrs(true)}>Book a detail <LucideIcon name="arrowUpRight" size={18} /></a>
              </div>
            )}
            <div className="dw-foot-card dw-foot-brand">
              {images.logo ? <PhotoSlot src={images.logo} slot="logo" alt={name ? `${name} logo` : 'Logo'} style={{ width: 'auto', height: 64, maxWidth: 220, objectFit: 'contain', borderRadius: 3 }} /> : <span className="dw-logo-name">{name}</span>}
              {tagline && <p>{tagline}</p>}
            </div>
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref={bookHref} colors={{ ...t, bg: tokens['--dw-dark-bg'], text: tokens['--dw-dark-text'] }} font={body} />
    </div>
  );
}
