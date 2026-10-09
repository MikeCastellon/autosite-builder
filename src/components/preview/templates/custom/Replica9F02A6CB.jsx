// Exact replica template for custom site 9f02a6cb: layout modeled on the
// customer's reference; content, colors and logo are the customer's.
// Hidden (registry customFor), so only that project's Design step lists it.
// Theme-ready (CLAUDE.md, "Template contract"):
//   - every color is a deriveTheme() token exposed as a --r9f-* variable;
//     the dark bands, their cards and the photo bands get their own scoped
//     text / muted pairs, contrast-repaired for the background they sit on;
//   - all CSS lives in the one prefixed <style> below: @container layout,
//     hover inside (hover:hover), motion inside prefers-reduced-motion;
//   - no hooks or browser globals: the service list is CSS-only radio tabs,
//     the nav glass comes from html[data-acg-scrolled] (siteRuntime.js);
//   - facts (rating, stats, hours, prices) render only when the owner
//     entered them, and editor hints go through PhotoSlot / EditorOnly.
// Photos: hero, about, logo and the CTA background come from their own
// slots. The gallery band shows the first six gallery photos; the ones
// after those fill the second About photo, the How It Works cards and the
// footer photo card, so no photo repeats on the page.
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
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
import { howItWorksSteps, howItWorksHeading, HOW_DEFAULTS, HOW_HINTS } from '../kit/howItWorks.js';
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
    '--r9f-bg': t.bg,
    '--r9f-surface': t.surface,
    '--r9f-text': t.text,
    '--r9f-muted': t.textMuted,
    '--r9f-accent': t.accent,
    '--r9f-on-accent': t.onAccent,
    '--r9f-accent-text': t.accentText,
    '--r9f-border': t.border,
    '--r9f-border-strong': t.borderStrong,
    '--r9f-focus': t.focus,
    '--r9f-alt-bg': altBg,
    '--r9f-alt-text': ensureContrast(t.text, altBg, 4.5),
    '--r9f-alt-muted': ensureContrast(t.textMuted, altBg, 4.5),
    '--r9f-dark-bg': darkBg,
    '--r9f-dark-text': darkText,
    '--r9f-dark-muted': darkMuted,
    '--r9f-dark-accent': darkAccent,
    '--r9f-dark-line': alpha(darkText, 0.14),
    '--r9f-card-bg': cardBg,
    '--r9f-card-text': cardText,
    '--r9f-card-muted': cardMuted,
    '--r9f-card-line': alpha(cardText, 0.14),
    '--r9f-them-bg': themBg,
    '--r9f-them-text': ensureContrast(t.text, themBg, 4.5),
    '--r9f-them-muted': ensureContrast(t.textMuted, themBg, 4.5),
    '--r9f-hero-bg': hero.lit,
    '--r9f-hero-text': hero.text,
    '--r9f-hero-muted': hero.muted,
    '--r9f-cta-bg': cta.lit,
    '--r9f-cta-text': cta.text,
    '--r9f-cta-muted': cta.muted,
    // White buttons with a dark arrow box (the box's arrow in the accent,
    // readable on the box).
    '--r9f-btn-bg': '#ffffff',
    '--r9f-btn-text': ensureContrast(darkBg, '#ffffff', 7),
    '--r9f-btn-box': darkBg,
    '--r9f-btn-arrow': darkAccent,
    // The info bar labels and the eyebrow squares.
    '--r9f-mark': t.accent,
  };
}

const CSS = `
.r9f-root *,.r9f-root *::before,.r9f-root *::after{box-sizing:border-box}
.r9f-wrap{width:100%;max-width:1440px;margin:0 auto;padding:0 clamp(16px,2cqi,29px)}
.r9f-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.r9f-skip{position:absolute;left:8px;top:8px;z-index:200;padding:10px 14px;border-radius:3px;background:var(--r9f-accent);color:var(--r9f-on-accent);font-weight:600;text-decoration:none}
.r9f-mono{font-family:${MONO};font-weight:400;letter-spacing:.02em;text-transform:uppercase}
.r9f-eyebrow{display:inline-flex;align-items:center;gap:10px;margin:0 0 22px;font-family:${MONO};font-size:11px;line-height:1.3;letter-spacing:.06em;text-transform:uppercase;color:inherit}
.r9f-eyebrow::before{content:'';flex:none;width:9px;height:9px;background:var(--r9f-mark)}
.r9f-h2{margin:0;font-family:var(--r9f-head);font-size:clamp(32px,3cqi,43px);font-weight:500;line-height:1.1;letter-spacing:-.035em;text-wrap:balance}
.r9f-h2 .r9f-em{color:var(--r9f-accent-text)}
.r9f-dark .r9f-h2 .r9f-em,.r9f-photo .r9f-h2 .r9f-em{color:var(--r9f-dark-accent)}
.r9f-intro{margin:20px 0 0;font-size:clamp(15px,1.15cqi,16px);line-height:1.5;color:var(--r9f-muted)}
.r9f-center{text-align:center}
.r9f-center .r9f-intro{margin-left:auto;margin-right:auto;max-width:620px}
.r9f-sec{padding:clamp(64px,8cqi,116px) 0}
.r9f-dark{background:var(--r9f-dark-bg);color:var(--r9f-dark-text)}
.r9f-dark .r9f-intro{color:var(--r9f-dark-muted)}
.r9f-light{background:var(--r9f-bg);color:var(--r9f-text)}
.r9f-alt{background:var(--r9f-alt-bg);color:var(--r9f-alt-text)}
.r9f-alt .r9f-intro{color:var(--r9f-alt-muted)}
.r9f-head{margin:0 0 clamp(36px,4.5cqi,64px)}
.r9f-btn{display:inline-flex;align-items:center;gap:12px;min-height:38px;padding:4px 4px 4px 14px;border-radius:3px;background:var(--r9f-btn-bg);color:var(--r9f-btn-text);font-size:15px;font-weight:500;line-height:1.2;text-decoration:none;white-space:nowrap}
.r9f-btn-box{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:2px;background:var(--r9f-btn-box);color:var(--r9f-btn-arrow)}
.r9f-btn:focus-visible,.r9f-root a:focus-visible,.r9f-root summary:focus-visible{outline:2px solid var(--r9f-focus);outline-offset:3px}

.r9f-top{order:-2;display:flex;align-items:center;justify-content:center;gap:10px;min-height:32px;padding:6px 16px;background:var(--r9f-dark-bg);color:var(--r9f-dark-text);font-size:13px;line-height:1.3;text-align:center}
.r9f-top svg{color:var(--r9f-dark-accent);flex:none}
.r9f-nav{position:sticky;top:0;order:-1;z-index:100;height:0;overflow:visible;padding:0 clamp(16px,2cqi,29px)}
.r9f-nav-box{display:flex;align-items:center;gap:clamp(12px,1.6cqi,22px);width:fit-content;max-width:100%;margin:20px auto 0;padding:8px 8px 8px 16px;border-radius:6px;background:var(--r9f-nav-bg);color:var(--r9f-dark-text);box-shadow:0 10px 30px rgba(0,0,0,.25)}
html[data-acg-scrolled] .r9f-nav-box{background:var(--r9f-dark-bg)}
.r9f-logo{display:flex;align-items:center;gap:10px;min-width:0;color:inherit;text-decoration:none}
.r9f-logo-name{font-family:var(--r9f-head);font-size:17px;font-weight:600;letter-spacing:-.02em;line-height:1.1;white-space:nowrap}
.r9f-links{display:flex;align-items:center;gap:clamp(14px,2cqi,28px);margin:0 6px}
.r9f-links a{color:inherit;font-size:15px;text-decoration:none;white-space:nowrap}
.r9f-nav-phone{font-family:${MONO};font-size:13px;color:inherit;text-decoration:none;white-space:nowrap}
.r9f-nav .acg-menu{margin-left:4px}

.r9f-hero{position:relative;display:flex;align-items:flex-end;min-height:clamp(620px,62cqi,880px);padding:120px 0 clamp(28px,3cqi,44px);background:var(--r9f-hero-bg);color:var(--r9f-hero-text);overflow:clip}
.r9f-hero-media{position:absolute;inset:0}
.r9f-hero-media::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.42) 38%,rgba(0,0,0,.12) 70%,rgba(0,0,0,.3) 100%)}
.r9f-hero-in{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:28px}
.r9f-hero-copy{max-width:760px}
.r9f-chip{display:inline-flex;align-items:center;gap:10px;margin:0 0 24px;padding:8px 12px;border-radius:2px;background:rgba(0,0,0,.55);font-family:${MONO};font-size:clamp(12px,1.15cqi,16px);line-height:1.3;letter-spacing:.02em;text-transform:uppercase;color:var(--r9f-hero-text)}
.r9f-chip svg{color:var(--r9f-hero-text);flex:none}
.r9f-h1{margin:0;font-family:var(--r9f-head);font-size:clamp(36px,3.5cqi,52px);font-weight:500;line-height:1.08;letter-spacing:-.04em;text-wrap:balance}
.r9f-h1 .r9f-em{color:inherit;text-decoration:underline;text-decoration-thickness:.06em;text-underline-offset:.12em}
.r9f-hero-sub{margin:18px 0 0;max-width:560px;font-size:clamp(15px,1.25cqi,18px);line-height:1.5;color:var(--r9f-hero-muted)}
.r9f-hero-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.r9f-rating{flex:none;width:295px;padding:14px;border-radius:4px;background:#fff;color:#000;text-decoration:none}
.r9f-rating-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:12px;border-bottom:1px solid rgba(0,0,0,.14)}
.r9f-rating-src{font-family:${MONO};font-size:9px;letter-spacing:.04em;text-transform:uppercase}
.r9f-rating-row{display:flex;align-items:center;gap:18px;padding-top:12px}
.r9f-rating-num{font-family:var(--r9f-head);font-size:30px;font-weight:500;letter-spacing:-.04em;line-height:1}
.r9f-rating-num small{font-size:13px;vertical-align:top}
.r9f-rating-txt{font-size:13px;line-height:1.35}

.r9f-info{background:var(--r9f-dark-bg);color:var(--r9f-dark-text);border-top:8px solid var(--r9f-bg)}
.r9f-info-row{display:flex;justify-content:space-between;gap:24px;padding:28px 0 30px}
.r9f-info-item{min-width:0}
.r9f-info-label{display:block;margin:0 0 10px;font-family:${MONO};font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--r9f-dark-accent)}
.r9f-info-value{display:block;font-size:16px;font-weight:500;line-height:1.35;color:inherit;text-decoration:none;overflow-wrap:anywhere}

.r9f-about-top{display:grid;grid-template-columns:1fr 2fr;gap:24px;align-items:start;margin-bottom:clamp(48px,6cqi,84px)}
.r9f-about-top .r9f-eyebrow{margin-top:12px}
.r9f-about-lead{margin:0;font-family:var(--r9f-head);font-size:clamp(26px,2.8cqi,40px);font-weight:500;line-height:1.12;letter-spacing:-.035em;white-space:pre-line}
.r9f-about-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;align-items:start}
.r9f-about-ph{overflow:hidden;border-radius:6px;aspect-ratio:446/540}
.r9f-about-ph2{margin-top:86px;aspect-ratio:446/410}
.r9f-about-ph img,.r9f-about-ph>div{width:100%;height:100%;object-fit:cover}
.r9f-about-card{display:flex;flex-direction:column;justify-content:space-between;gap:48px;margin-top:174px;padding:28px;border-radius:6px;background:var(--r9f-alt-bg);color:var(--r9f-alt-text)}
.r9f-about-card p{margin:0 0 14px;font-size:17px;line-height:1.5;white-space:pre-line}
.r9f-about-card p:last-child{margin-bottom:0}
.r9f-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.r9f-stat-v{display:block;font-family:var(--r9f-head);font-size:clamp(40px,3.6cqi,52px);font-weight:400;letter-spacing:-.05em;line-height:1}
.r9f-stat-l{display:block;margin-top:12px;font-size:13px;color:var(--r9f-alt-muted)}

.r9f-svc-in{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}
.r9f-svc{display:grid;grid-template-columns:minmax(0,332px) minmax(0,1fr);gap:clamp(24px,15cqi,221px);align-items:start}
.r9f-svc-list{display:flex;flex-direction:column}
.r9f-svc-tab{display:flex;align-items:center;gap:20px;min-height:62px;padding:12px 22px;border-bottom:1px solid var(--r9f-dark-line);border-radius:7px;font-size:18px;line-height:1.25;cursor:pointer;color:var(--r9f-dark-text)}
.r9f-svc-num{font-family:${MONO};font-size:16px;color:var(--r9f-dark-muted)}
.r9f-svc-panels{position:sticky;top:96px;min-width:0}
.r9f-svc-panel{display:none;padding:22px;border-radius:8px;background:var(--r9f-card-bg);color:var(--r9f-card-text)}
.r9f-svc-main{display:grid;grid-template-columns:minmax(0,1fr);gap:28px}
.r9f-svc-panel.r9f-has-ph .r9f-svc-main{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.r9f-svc-body{display:flex;flex-direction:column;align-items:flex-start;min-height:100%}
.r9f-svc-panel:not(.r9f-has-ph) .r9f-svc-main{grid-template-columns:minmax(0,1fr) auto;min-height:260px}
.r9f-svc-big{align-self:end;font-family:${MONO};font-size:clamp(96px,11cqi,168px);font-weight:300;line-height:.8;letter-spacing:-.06em;color:transparent;-webkit-text-stroke:1px var(--r9f-card-line)}
.r9f-svc-cat{margin:0 0 10px;font-family:${MONO};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--r9f-dark-accent)}
.r9f-svc-name{margin:0;font-family:var(--r9f-head);font-size:clamp(22px,1.9cqi,26px);font-weight:500;line-height:1.2;letter-spacing:-.025em}
.r9f-svc-desc{margin:14px 0 28px;font-size:16px;line-height:1.4;color:var(--r9f-card-muted)}
.r9f-svc-price{margin:auto 0 0;padding-top:40px;font-family:var(--r9f-head);font-size:clamp(26px,2.2cqi,30px);font-weight:500;line-height:1.1;letter-spacing:-.03em}
.r9f-svc-book{margin-top:22px}
.r9f-svc-ph{overflow:hidden;border-radius:4px;aspect-ratio:374/253}
.r9f-svc-ph img{width:100%;height:100%;object-fit:cover}
.r9f-inc{margin-top:22px;padding-top:22px;border-top:1px solid var(--r9f-card-line)}
.r9f-inc-h{margin:0 0 18px;font-size:16px;color:var(--r9f-card-muted)}
.r9f-inc ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 30px;margin:0;padding:0;list-style:none}
.r9f-inc li{display:flex;gap:10px;font-size:16px;line-height:1.35}
.r9f-inc li::before{content:'+';flex:none;font-size:20px;line-height:.9;color:var(--r9f-dark-accent)}
.r9f-inc li.r9f-inc-sub{grid-column:1/-1;font-family:${MONO};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--r9f-card-muted)}
.r9f-inc li.r9f-inc-sub::before{content:none}

.r9f-vt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,2.6cqi,40px) clamp(14px,5cqi,72px);max-width:1120px;margin:0 auto}
.r9f-vt-item{display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center}
.r9f-vt-art{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:16/9;border-radius:8px;background:var(--r9f-alt-bg);color:var(--r9f-alt-text)}
.r9f-vt-art svg{width:42%;height:auto}
.r9f-vt-name{margin:0;font-size:17px;line-height:1.3}
.r9f-vt-desc{margin:-12px 0 0;font-size:14px;line-height:1.45;color:var(--r9f-muted)}

.r9f-how{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,604px);gap:clamp(24px,4cqi,64px);align-items:start;max-width:1382px}
.r9f-how-head{position:sticky;top:110px}
.r9f-how-list{display:flex;flex-direction:column;gap:30px;margin:0;padding:0;list-style:none}
.r9f-step{padding:22px;border-radius:10px;background:var(--r9f-card-bg);color:var(--r9f-card-text)}
.r9f-step-ph{overflow:hidden;margin-bottom:22px;border-radius:6px;aspect-ratio:562/400}
.r9f-step-ph img{width:100%;height:100%;object-fit:cover}
.r9f-step-h{display:flex;align-items:baseline;gap:14px;margin:0;font-size:18px;font-weight:500;line-height:1.3;letter-spacing:-.01em;text-transform:uppercase}
.r9f-step-n{font-family:${MONO};font-size:17px;color:var(--r9f-dark-accent)}
.r9f-step-e{margin-left:auto;font-size:20px;line-height:1}
.r9f-step-d{margin:14px 0 0;font-size:16px;line-height:1.45;color:var(--r9f-card-muted)}

.r9f-gal{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:clamp(40px,5cqi,72px) 22px;align-items:start}
.r9f-gal-item{margin:0;overflow:hidden;border-radius:6px}
.r9f-gal-item img{display:block;width:100%;height:100%;object-fit:cover}
.r9f-g0{grid-column:1/5;aspect-ratio:440/560}
.r9f-g1{grid-column:7/13;margin-top:96px;aspect-ratio:676/445}
.r9f-g2{grid-column:4/10;aspect-ratio:676/430}
.r9f-g3{grid-column:1/6;aspect-ratio:558/500}
.r9f-g4{grid-column:8/13;margin-top:104px;aspect-ratio:558/530}
.r9f-g5{grid-column:3/11;aspect-ratio:900/480}

.r9f-cmp-wrap{max-width:864px;margin:0 auto}
.r9f-cmp{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;overflow:hidden;border-radius:8px;font-size:14px;line-height:1.35}
.r9f-cmp th,.r9f-cmp td{padding:0 22px;height:70px;vertical-align:middle;border-bottom:1px solid var(--r9f-border)}
.r9f-cmp tr:last-child th,.r9f-cmp tr:last-child td{border-bottom:0}
.r9f-cmp-label{width:36%;text-align:left;font-weight:500;background:var(--r9f-bg);color:var(--r9f-text)}
.r9f-cmp thead th{height:86px}
.r9f-cmp-us{width:32%;text-align:center;background:var(--r9f-card-bg);color:var(--r9f-card-text);border-bottom-color:var(--r9f-card-line)!important}
.r9f-cmp-them{width:32%;text-align:center;background:var(--r9f-them-bg);color:var(--r9f-them-text)}
.r9f-cmp-name{font-family:var(--r9f-head);font-size:17px;font-weight:600;font-style:italic;letter-spacing:-.02em;text-transform:uppercase;line-height:1.1}
.r9f-cmp-yes{display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;border-radius:50%;border:1.5px solid var(--r9f-dark-accent);color:var(--r9f-dark-accent)}
.r9f-cmp-them .r9f-cmp-yes{border-color:var(--r9f-them-text);color:var(--r9f-them-text)}
.r9f-cmp-no{display:inline-block;width:18px;height:2px;border-radius:1px;background:currentColor;opacity:.55;vertical-align:middle}
.r9f-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

.r9f-rev-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.r9f-rev{display:grid;grid-auto-flow:column;grid-auto-columns:calc((100% - 44px)/3);gap:22px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px;scrollbar-width:none}
.r9f-rev::-webkit-scrollbar{display:none}
.r9f-q{display:flex;flex-direction:column;justify-content:space-between;gap:36px;min-height:314px;margin:0;padding:28px;border-radius:8px;scroll-snap-align:start;background:linear-gradient(180deg,var(--r9f-card-bg),var(--r9f-card-bg2));color:var(--r9f-card-text)}
.r9f-q blockquote{margin:0;font-size:17px;line-height:1.5}
.r9f-q-foot{display:flex;flex-direction:column;gap:22px}
.r9f-q-who{display:flex;align-items:center;gap:14px}
.r9f-q-av{display:inline-flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;border-radius:50%;background:var(--r9f-card-line);font-size:12px;font-weight:600}
.r9f-q-name{display:block;font-size:16px;font-weight:500}
.r9f-q-src{display:block;margin-top:2px;font-size:13px;color:var(--r9f-card-muted)}


.r9f-cta{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,655px);gap:clamp(24px,8cqi,124px);align-items:center;padding:clamp(64px,7cqi,100px) clamp(16px,2cqi,29px);background:var(--r9f-cta-bg);color:var(--r9f-cta-text);overflow:clip}
.r9f-cta-media{position:absolute;inset:0;z-index:0}
.r9f-cta-media img{filter:grayscale(1)}
.r9f-cta-media::after{content:'';position:absolute;inset:0;background:rgba(0,0,0,.62)}
.r9f-cta>*:not(.r9f-cta-media){position:relative;z-index:1}
.r9f-cta-copy{max-width:470px}
.r9f-cta .r9f-intro{color:var(--r9f-cta-muted)}
.r9f-cta-tag{margin:56px 0 24px;font-family:var(--r9f-head);font-size:22px;font-weight:500;letter-spacing:-.02em}
.r9f-cta-list{display:flex;flex-direction:column;gap:22px;margin:0;padding:0;list-style:none}
.r9f-cta-label{display:block;margin-bottom:6px;font-family:${MONO};font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--r9f-cta-muted)}
.r9f-cta-value{font-size:20px;color:inherit;text-decoration:none;overflow-wrap:anywhere}
.r9f-cta-card{display:flex;flex-direction:column;align-items:flex-start;gap:18px;padding:38px;border-radius:8px;background:var(--r9f-card-bg);color:var(--r9f-card-text)}
.r9f-cta-card p{margin:0;font-size:16px;line-height:1.5;color:var(--r9f-card-muted)}
.r9f-cta>[data-acg-inquiry]{max-width:none!important;margin:0!important;padding:38px!important;border-radius:8px;background:var(--r9f-card-bg);color:var(--r9f-card-text)}
.r9f-cta>[data-acg-inquiry] h3{font-family:var(--r9f-head);font-weight:500!important;letter-spacing:-.02em}
.r9f-cta>[data-acg-inquiry] input,.r9f-cta>[data-acg-inquiry] textarea{border:0!important;border-bottom:1px solid var(--r9f-card-line)!important;border-radius:0!important;background:transparent!important;color:var(--r9f-card-text)!important;padding:12px 0!important;margin-bottom:18px!important}
.r9f-cta>[data-acg-inquiry] input::placeholder,.r9f-cta>[data-acg-inquiry] textarea::placeholder{color:var(--r9f-card-muted)}
.r9f-cta>[data-acg-inquiry] button[type=submit]{border-radius:3px!important;padding:16px!important;text-align:left}

.r9f-foot{order:9999;padding:clamp(40px,7cqi,116px) 0 29px;background:var(--r9f-dark-bg);color:var(--r9f-dark-text)}
.r9f-foot-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr);gap:22px}
.r9f-foot-ph{position:relative;overflow:hidden;min-height:440px;border-radius:8px;background:var(--r9f-card-bg)}
.r9f-foot-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.r9f-foot-ph::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.6),rgba(0,0,0,0) 45%)}
.r9f-foot-ph .r9f-eyebrow{position:absolute;left:28px;bottom:22px;z-index:1;margin:0;color:#fff}
.r9f-foot-card{padding:28px;border-radius:8px;background:var(--r9f-card-bg);color:var(--r9f-card-text)}
.r9f-foot-mid{display:flex;flex-direction:column;justify-content:space-between;gap:40px}
.r9f-foot-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.r9f-foot-h{margin:0 0 18px;font-family:${MONO};font-size:10px;font-weight:400;letter-spacing:.04em;text-transform:uppercase;color:var(--r9f-card-muted)}
.r9f-foot-links{display:flex;flex-direction:column;gap:10px;margin:0;padding:0;list-style:none}
.r9f-foot-links a,.r9f-foot-links span{color:inherit;font-size:14px;text-decoration:none;overflow-wrap:anywhere}
.r9f-foot-copy{margin:0;font-size:11px;line-height:1.5;color:var(--r9f-card-muted)}
.r9f-foot-side{display:flex;flex-direction:column;gap:22px}
.r9f-foot-area{flex:1;display:flex;flex-direction:column;gap:14px}
.r9f-foot-pin{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:16/9;border-radius:6px;background:var(--r9f-dark-bg);color:var(--r9f-dark-accent)}
.r9f-foot-area h3{margin:6px 0 0;font-family:var(--r9f-head);font-size:17px;font-weight:500;letter-spacing:-.02em}
.r9f-foot-area p{margin:0;font-size:13px;color:var(--r9f-card-muted)}
.r9f-foot-book{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;color:inherit;font-size:13px;text-decoration:none}
.r9f-foot-book svg{color:var(--r9f-dark-accent)}
.r9f-foot-brand{display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center}
.r9f-foot-brand p{margin:0;font-size:11px;color:var(--r9f-card-muted)}

@media (hover:hover){
  .r9f-links a:hover,.r9f-foot-links a:hover{opacity:.72}
  .r9f-btn:hover .r9f-btn-box{background:var(--r9f-accent);color:var(--r9f-on-accent)}
  .r9f-svc-tab:hover{background:var(--r9f-card-bg)}
  .r9f-foot-book:hover{opacity:.8}
}
@media (prefers-reduced-motion: no-preference){
  .r9f-nav-box,.r9f-btn-box,.r9f-svc-tab{transition:background-color .2s ease,color .2s ease,opacity .2s ease}
}
@container (max-width: 1000px){
  .r9f-links{display:none}
  .r9f-svc{gap:28px}
  .r9f-how{grid-template-columns:minmax(0,1fr)}
  .r9f-how-head{position:static}
  .r9f-cta{grid-template-columns:minmax(0,1fr)}
  .r9f-foot-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .r9f-foot-ph{grid-column:1/-1;min-height:360px}
}
@container (max-width: 600px){
  .r9f-nav-phone{display:none}
  .r9f-nav-box{width:auto;margin-top:16px;padding:8px 8px 8px 14px}
  .r9f-nav-box .r9f-logo{margin-right:auto}
  .r9f-nav-box .r9f-btn{font-size:13px;padding-left:10px}
  .r9f-hero{min-height:760px}
  .r9f-hero-in{flex-direction:column;align-items:flex-start}
  .r9f-rating{width:100%}
  .r9f-info-row{flex-direction:column;gap:18px;padding:16px 0 20px}
  .r9f-info-label{margin-bottom:6px}
  .r9f-about-top{grid-template-columns:1fr;gap:0}
  .r9f-about-grid{grid-template-columns:1fr}
  .r9f-about-ph2,.r9f-about-card{margin-top:0}
  .r9f-svc{grid-template-columns:minmax(0,1fr)}
  .r9f-svc-list{display:none}
  .r9f-svc-panels{display:flex;flex-direction:column;gap:24px}
  .r9f-svc-panel{display:block!important}
  .r9f-svc-panel.r9f-has-ph .r9f-svc-main{grid-template-columns:minmax(0,1fr)}
  .r9f-svc-panel.r9f-has-ph .r9f-svc-ph{order:-1}
  .r9f-svc-panels{position:static}
  .r9f-svc-panel:not(.r9f-has-ph) .r9f-svc-main{min-height:0}
  .r9f-svc-big{display:none}
  .r9f-inc ul{grid-template-columns:minmax(0,1fr)}
  .r9f-vt{grid-template-columns:repeat(2,minmax(0,1fr))}
  .r9f-gal{grid-template-columns:minmax(0,1fr);gap:22px}
  .r9f-gal-item{grid-column:1/-1!important;margin-top:0!important}
  .r9f-cmp th,.r9f-cmp td{padding:0 10px;height:62px}
  .r9f-cmp-label{width:40%}
  .r9f-cmp-us,.r9f-cmp-them{width:30%}
  .r9f-cmp-name{font-size:13px;overflow-wrap:anywhere}
  .r9f-rev{grid-auto-columns:86%}
  .r9f-cta-card,.r9f-cta>[data-acg-inquiry]{padding:24px!important}
  .r9f-foot-grid{grid-template-columns:minmax(0,1fr)}
  .r9f-foot-cols{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
}
`;

// The kit FAQ band, restyled: two columns of questions with a rule under
// each and the accent "+" (faqCss reads these --r9f-faq-* aliases).
const FAQ_CSS = `
.r9f-faq-band{--r9f-faq-text:var(--r9f-text);--r9f-faq-muted:var(--r9f-muted);--r9f-faq-accent:var(--r9f-accent-text);--r9f-faq-line:var(--r9f-border-strong);--r9f-faq-focus:var(--r9f-focus);--r9f-faq-r:0px;--r9f-faq-q-w:400}
.r9f-faq-band .r9f-faq-list{column-gap:72px;max-width:1066px;margin:0 auto}
.r9f-faq-band .r9f-faq-col{gap:0}
.r9f-faq-band .r9f-faq-item{border:0;border-bottom:1px solid var(--r9f-faq-line);border-radius:0}
.r9f-faq-band .r9f-faq-q{padding:22px 44px 22px 0;font-size:17px;letter-spacing:-.01em}
.r9f-faq-band .r9f-faq-icon{top:22px;right:0}
.r9f-faq-band .r9f-faq-a{padding:0 0 22px}
`;

// The kit Before & After slider on the dark band.
const BA_CSS = `
.r9f-ba-band{--r9f-ba-text:var(--r9f-dark-text);--r9f-ba-muted:var(--r9f-dark-muted);--r9f-ba-line:var(--r9f-dark-line);--r9f-ba-focus:var(--r9f-dark-accent);--r9f-ba-tag-bg:rgba(0,0,0,.6);--r9f-ba-tag-text:#fff;--r9f-ba-tag2-bg:rgba(0,0,0,.6);--r9f-ba-tag2-text:#fff;--r9f-ba-knob-bg:#fff;--r9f-ba-knob-text:#000;--r9f-ba-r:8px;--r9f-ba-tag-r:2px}
.r9f-ba-band .r9f-ba-slider,.r9f-ba-band .r9f-ba-nav,.r9f-ba-band .r9f-ba-cap{max-width:806px;margin-left:auto;margin-right:auto}
`;

function Arrow({ size = 16 }) {
  return <LucideIcon name="arrowRight" size={size} stroke={1.75} />;
}

function Heading({ h, center = true, id, className = '' }) {
  return (
    <div className={`r9f-head${center ? ' r9f-center' : ''} ${className}`.trim()} data-acg-reveal="">
      {h.eyebrow && <p className="r9f-eyebrow">{h.eyebrow}</p>}
      <h2 id={id} className="r9f-h2"><Accented title={h.title} accent={h.accent} className="r9f-em" /></h2>
      {h.intro && <p className="r9f-intro">{h.intro}</p>}
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

export default function Replica9F02A6CB({ businessInfo, generatedCopy, templateMeta, images = {} }) {
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

  // Photos: the gallery band shows the first six; the rest fill the
  // second About photo, the How It Works cards and the footer card.
  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);
  const galleryShown = show('gallery') ? galleryImages.slice(0, 6) : [];
  const spare = show('gallery') ? galleryImages.slice(6) : galleryImages;
  const aboutPhoto2 = spare[0] || '';
  const stepPhotos = spare.slice(1, 4);
  const footPhoto = spare[4] || images.about || '';

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
  const about = aboutParts(copy.aboutText);
  const aboutHead = heading('about');
  const stats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label)
    .slice(0, 2);

  const vt = vehicleTypesOf(copy.vehicleTypes, { editor });
  const vtOn = show('vehicleTypes') && Boolean(vt) && (vt.items.length > 0 || editor);
  const vtHead = vehicleTypesHeading(copy.vehicleTypes, copy.sectionTitles, VT_DEFAULTS);

  const how = howItWorksSteps(copy.howSteps);
  const howOn = show('process') && Boolean(how) && (how.steps.length > 0 || editor);
  const howHead = howItWorksHeading(copy.sectionTitles, HOW_DEFAULTS);

  const ba = beforeAfterPairs(copy.beforeAfter, images, { editor });
  const baOn = show('beforeAfter') && Boolean(ba) && (ba.pairs.length > 0 || editor);
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
    <span className="r9f-logo-name">{name}</span>
  );

  // CSS-only service tabs: one radio per service (the first checked); the
  // checked radio shows its panel and lights its label.
  const svcCss = svcOrder.map((_, i) => (
    `#r9f-svc-${i}:checked~.r9f-svc .r9f-svc-p${i}{display:block}`
    + `#r9f-svc-${i}:checked~.r9f-svc .r9f-svc-t${i}{background:var(--r9f-card-bg);border-bottom-color:transparent;color:var(--r9f-dark-accent)}`
    + `#r9f-svc-${i}:checked~.r9f-svc .r9f-svc-t${i} .r9f-svc-num{color:var(--r9f-dark-accent)}`
    + `#r9f-svc-${i}:focus-visible~.r9f-svc .r9f-svc-t${i}{outline:2px solid var(--r9f-focus);outline-offset:2px}`
  )).join('\n');

  const css = CSS + svcCss
    + (faqOn ? faqCss('r9f-faq', { twoFrom: 601 }) + FAQ_CSS : '')
    + (baOn ? beforeAfterCss('r9f-ba') + BA_CSS : '');

  const rootVars = {
    ...tokens,
    '--r9f-head': head,
    '--r9f-nav-bg': alpha(mix(tokens['--r9f-dark-bg'], '#ffffff', 0.12), 0.88),
    '--r9f-card-bg2': mix(tokens['--r9f-card-bg'], tokens['--r9f-dark-bg'], 0.55),
  };

  return (
    <div className="r9f-root" style={{ ...rootVars, position: 'relative', containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.5 }}>
      <style>{css}</style>
      <a className="r9f-skip" href="#top">Skip to main content</a>

      {tagline && (
        <div className="r9f-top" style={{ order: -2 }}>
          <LucideIcon name="sparkles" size={14} />
          <span>{tagline}</span>
        </div>
      )}

      <header className="r9f-nav" style={{ order: -1 }}>
        <nav className="r9f-nav-box" aria-label="Main">
          <a className="r9f-logo" href="#top">{logo}</a>
          {navLinks.length > 0 && (
            <div className="r9f-links">
              {navLinks.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
            </div>
          )}
          {tel && <a className="r9f-nav-phone" href={tel}>{phoneText}</a>}
          <a className="r9f-btn" href={bookHref} {...bookingAttrs(true)}>
            Book Now
            <span className="r9f-btn-box"><Arrow /></span>
          </a>
          <MobileMenu
            links={menuLinks}
            cta={tel ? { href: tel, label: `Call ${phoneText}` } : { href: bookHref, label: 'Book Now', bookingTrigger: true }}
            colors={{ ...t, bg: tokens['--r9f-dark-bg'], surface: tokens['--r9f-card-bg'], text: tokens['--r9f-dark-text'], textMuted: tokens['--r9f-dark-muted'] }}
            font={body}
          />
        </nav>
      </header>

      {show('hero') && (
        <section data-section="hero" id="top" className="r9f-hero" style={{ order: order('hero') }}>
          <div className="r9f-hero-media">
            <PhotoSlot src={images.hero} slot="hero" alt="" loading="eager" fetchPriority="high" />
          </div>
          <div className="r9f-wrap r9f-hero-in">
            <div className="r9f-hero-copy">
              {chip && (
                <p className="r9f-chip"><LucideIcon name="pin" size={14} />{chip}</p>
              )}
              <h1 className="r9f-h1"><Accented title={headline} accent={heroT.accent} className="r9f-em" /></h1>
              {txt(copy.subheadline) && <p className="r9f-hero-sub">{copy.subheadline}</p>}
              <div className="r9f-hero-cta">
                <a className="r9f-btn" href={primaryHref}>
                  {primaryLabel}
                  <span className="r9f-btn-box"><Arrow /></span>
                </a>
              </div>
            </div>
            {ratingOn && (
              <a className="r9f-rating" href={rating.url || undefined} target={rating.url ? '_blank' : undefined} rel={rating.url ? 'noopener noreferrer' : undefined}>
                <span className="r9f-rating-top">
                  <StarRow rating={rating.rating} size={20} color={GOOGLE_STAR_GOLD} />
                  <span className="r9f-rating-src">Google reviews</span>
                </span>
                <span className="r9f-rating-row">
                  <span className="r9f-rating-num">{rating.ratingText}<small>/5</small></span>
                  <span className="r9f-rating-txt">{rating.countText} {rating.reviewCount === 1 ? 'review' : 'reviews'} on Google</span>
                </span>
              </a>
            )}
          </div>
        </section>
      )}

      {infoOn && (
        <section data-section="statsBar" className="r9f-info" aria-label="At a glance" style={{ order: order('statsBar') }}>
          <div className="r9f-wrap r9f-info-row">
            {info.map((f) => (
              <div key={f.label} className="r9f-info-item">
                <span className="r9f-info-label">{f.label}</span>
                {f.href ? <a className="r9f-info-value" href={f.href}>{f.value}</a> : <span className="r9f-info-value">{f.value}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {show('about') && (about.lead || editor) && (
        <section data-section="about" id="about" className="r9f-sec r9f-light" style={{ order: order('about') }}>
          <div className="r9f-wrap">
            <div className="r9f-about-top" data-acg-reveal="">
              <p className="r9f-eyebrow">{aboutHead.eyebrow}</p>
              <div>
                {aboutHead.title && <h2 className="r9f-h2" style={{ marginBottom: 20 }}><Accented title={aboutHead.title} accent={aboutHead.accent} className="r9f-em" /></h2>}
                <p className="r9f-about-lead">{about.lead}</p>
                {!about.lead && <EditorHint>Add your story in Edit &gt; About.</EditorHint>}
              </div>
            </div>
            <div className="r9f-about-grid">
              <div className="r9f-about-ph" data-acg-reveal="">
                <PhotoSlot src={images.about} slot="about" alt={name ? `${name} at work` : ''} />
              </div>
              {aboutPhoto2 ? (
                <div className="r9f-about-ph r9f-about-ph2" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                  <PhotoSlot src={aboutPhoto2} slot="gallery" alt="" />
                </div>
              ) : <div aria-hidden="true" />}
              {(about.rest.length > 0 || stats.length > 0) && (
                <div className="r9f-about-card" data-acg-reveal="" style={{ '--acg-delay': '220ms' }}>
                  <div>{about.rest.map((p, i) => <p key={i}>{p}</p>)}</div>
                  {stats.length > 0 && (
                    <div className="r9f-stats">
                      {stats.map((s) => (
                        <div key={s.label}>
                          <span className="r9f-stat-v">{s.value}</span>
                          <span className="r9f-stat-l">{s.label}</span>
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
        <section data-section="services" id="services" className="r9f-sec r9f-dark" aria-labelledby="r9f-svc-h" style={{ order: order('services') }}>
          <div className="r9f-wrap">
            <Heading h={svcHead} id="r9f-svc-h" />
            {svcOrder.map((_, i) => (
              <input key={i} type="radio" name="r9f-svc" id={`r9f-svc-${i}`} className="r9f-svc-in" defaultChecked={i === 0} aria-label={svcOrder[i].s.name || `Service ${i + 1}`} />
            ))}
            <div className="r9f-svc">
              <div className="r9f-svc-list">
                {svcOrder.map(({ s }, i) => (
                  <label key={i} htmlFor={`r9f-svc-${i}`} className={`r9f-svc-tab r9f-svc-t${i}`}>
                    <span className="r9f-svc-num">{String(i + 1).padStart(2, '0')}</span>
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
              <div className="r9f-svc-panels">
                {svcOrder.map(({ s }, i) => (
                  <article key={i} className={`r9f-svc-panel r9f-svc-p${i}${s.image ? ' r9f-has-ph' : ''}`}>
                    <div className="r9f-svc-main">
                      <div className="r9f-svc-body">
                        {s.category && <p className="r9f-svc-cat">{s.category}</p>}
                        <h3 className="r9f-svc-name">{s.name}</h3>
                        {s.description && <p className="r9f-svc-desc">{s.description}</p>}
                        {s.price && <p className="r9f-svc-price">{s.price}</p>}
                        <a className={`r9f-btn r9f-svc-book`} href={bookHref} {...bookingAttrs(true, s.name)} style={s.price ? undefined : { marginTop: 'auto', paddingTop: 4 }}>
                          Book Now
                          <span className="r9f-btn-box"><Arrow /></span>
                        </a>
                      </div>
                      {s.image ? (
                        <div className="r9f-svc-ph">
                          <PhotoSlot src={s.image} slot="service" alt={s.name} />
                        </div>
                      ) : <span className="r9f-svc-big" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>}
                    </div>
                    {s.includes.length > 0 && (
                      <div className="r9f-inc">
                        <p className="r9f-inc-h">Includes:</p>
                        <ul>
                          {s.includes.map((it, k) => <li key={k} className={it.heading ? 'r9f-inc-sub' : undefined}>{it.text}</li>)}
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
        <section data-section="vehicleTypes" id="vehicle-types" className="r9f-sec r9f-light" aria-labelledby="r9f-vt-h" style={{ order: order('vehicleTypes') }}>
          <div className="r9f-wrap">
            <Heading h={vtHead} id="r9f-vt-h" />
            {vt.items.length > 0 && (
              <ul className="r9f-vt" style={{ listStyle: 'none', padding: 0 }}>
                {vt.items.map((it, i) => (
                  <li key={it.index} className="r9f-vt-item" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <span className="r9f-vt-art"><VehicleTypeIcon name={it.icon} size={120} stroke={1.1} /></span>
                    <p className="r9f-vt-name">{it.name || <EditorOnly><span data-acg-editor-only="">{VT_HINTS.noName}</span></EditorOnly>}</p>
                    {it.desc && <p className="r9f-vt-desc">{it.desc}</p>}
                  </li>
                ))}
              </ul>
            )}
            {vt.items.length === 0 && <EditorHint>{VT_HINTS.empty}</EditorHint>}
          </div>
        </section>
      )}

      {howOn && (
        <section data-section="process" id="process" className="r9f-sec r9f-alt" aria-labelledby="r9f-how-h" style={{ order: order('process') }}>
          <div className="r9f-wrap r9f-how">
            <div className="r9f-how-head">
              <Heading h={howHead} id="r9f-how-h" center={false} className="r9f-how-h" />
            </div>
            {how.steps.length > 0 ? (
              <ol className="r9f-how-list">
                {how.steps.map((s, i) => (
                  <li key={i} className="r9f-step" data-acg-reveal="">
                    {stepPhotos[i] && (
                      <div className="r9f-step-ph"><PhotoSlot src={stepPhotos[i]} slot="gallery" alt="" /></div>
                    )}
                    <h3 className="r9f-step-h">
                      <span className="r9f-step-n">{s.number}</span>
                      <span>{s.title}</span>
                      {s.emoji && <span className="r9f-step-e" aria-hidden="true">{s.emoji}</span>}
                    </h3>
                    {s.desc && <p className="r9f-step-d">{s.desc}</p>}
                  </li>
                ))}
              </ol>
            ) : <EditorHint>{HOW_HINTS.empty}</EditorHint>}
          </div>
        </section>
      )}

      {baOn && (
        <BeforeAfterBand
          ns="r9f-ba"
          beforeAfter={copy.beforeAfter}
          images={images}
          editor={editor}
          order={order('beforeAfter')}
          className="r9f-sec r9f-dark"
          wrapClassName="r9f-wrap"
          labelledBy="r9f-ba-h"
          heading={<Heading h={baHead} id="r9f-ba-h" />}
        />
      )}

      {show('gallery') && (galleryShown.length > 0 || editor) && (
        <section data-section="gallery" id="gallery" className="r9f-sec r9f-dark" aria-labelledby="r9f-gal-h" style={{ order: order('gallery') }}>
          <div className="r9f-wrap">
            <Heading h={heading('gallery')} id="r9f-gal-h" />
            {galleryShown.length > 0 ? (
              <div className="r9f-gal">
                {galleryShown.map((src, i) => (
                  <figure key={src} className={`r9f-gal-item r9f-g${i}`} data-acg-reveal="">
                    <PhotoSlot src={src} slot="gallery" alt={name ? `${name} work photo ${i + 1}` : `Work photo ${i + 1}`} loading="lazy" />
                  </figure>
                ))}
              </div>
            ) : <EditorHint>Add photos in Edit &gt; Gallery.</EditorHint>}
          </div>
        </section>
      )}

      {cmpOn && (
        <section data-section="comparison" id="comparison" className="r9f-sec r9f-alt" aria-labelledby="r9f-cmp-h" style={{ order: order('comparison') }}>
          <div className="r9f-wrap">
            <Heading h={cmpHead} id="r9f-cmp-h" />
            {cmp.rows.length > 0 ? (
              <div className="r9f-cmp-wrap" data-acg-reveal="">
                <table className="r9f-cmp">
                  <thead>
                    <tr>
                      <th scope="col" className="r9f-cmp-label"><span className="r9f-sr">Compare</span></th>
                      <th scope="col" className="r9f-cmp-us"><span className="r9f-cmp-name">{cmp.usLabel}</span></th>
                      <th scope="col" className="r9f-cmp-them">{cmp.themLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmp.rows.map((r) => (
                      <tr key={r.index}>
                        <th scope="row" className="r9f-cmp-label">{r.label || <EditorOnly><span data-acg-editor-only="">{CMP_HINTS.noLabel}</span></EditorOnly>}</th>
                        {[['us', r.us], ['them', r.them]].map(([side, c]) => (
                          <td key={side} className={`r9f-cmp-${side}`}>
                            {c.kind === 'yes' && <span className="r9f-cmp-yes"><LucideIcon name="check" size={13} stroke={2.5} /><span className="r9f-sr">Yes</span></span>}
                            {c.kind === 'no' && <span className="r9f-cmp-no" role="img" aria-label="No" />}
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
        <section data-section="testimonials" id="reviews" className="r9f-sec r9f-dark" aria-labelledby="r9f-rev-h" style={{ order: order('testimonials') }}>
          <div className="r9f-wrap">
            <div className="r9f-rev-head">
              <Heading h={heading('testimonials')} id="r9f-rev-h" center={false} />
            </div>
            {reviews === 'google' ? (
              <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
            ) : (
              <div className="r9f-rev" role="list">
                {testimonials.map((q, i) => {
                  const stars = reviewStars(q);
                  const who = txt(q.name) || 'Customer';
                  return (
                    <figure key={i} className="r9f-q" role="listitem" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                      <blockquote>“{txt(q.text)}”</blockquote>
                      <figcaption className="r9f-q-foot">
                        {stars > 0 && <StarRow rating={stars} size={16} color={GOOGLE_STAR_GOLD} />}
                        <span className="r9f-q-who">
                          <span className="r9f-q-av" aria-hidden="true">{initials(who) || '•'}</span>
                          <span>
                            <span className="r9f-q-name">{who}</span>
                            {(q.source === 'google' || txt(q.service)) && (
                              <span className="r9f-q-src">{[txt(q.service), q.source === 'google' && 'Google review'].filter(Boolean).join(' · ')}</span>
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
          ns="r9f-faq"
          faq={copy.faq}
          editor={editor}
          order={order('faq')}
          className="r9f-sec r9f-light r9f-faq-band"
          wrapClassName="r9f-wrap"
          labelledBy="r9f-faq-h"
          heading={<Heading h={faqHead} id="r9f-faq-h" />}
          hints={editor && faq.items.length === 0 ? <EditorHint>{FAQ_HINTS.empty}</EditorHint> : null}
        />
      )}

      {show('cta') && (
        <section data-section="cta" id="contact" className="r9f-cta r9f-photo" aria-labelledby="r9f-cta-h" style={{ order: order('cta') }}>
          {ctaPhoto && (
            <div className="r9f-cta-media">
              <PhotoSlot src={ctaPhoto} slot="cta" alt="" loading="lazy" />
            </div>
          )}
          <div className="r9f-cta-copy">
            <p className="r9f-eyebrow">{ctaHead.eyebrow}</p>
            <h2 id="r9f-cta-h" className="r9f-h2"><Accented title={ctaHead.title} accent={ctaHead.accent} className="r9f-em" /></h2>
            {ctaHead.intro && <p className="r9f-intro">{ctaHead.intro}</p>}
            {(tel || email || area) && (
              <>
                {tagline && <p className="r9f-cta-tag">{tagline}</p>}
                <ul className="r9f-cta-list" style={tagline ? undefined : { marginTop: 40 }}>
                  {tel && <li><span className="r9f-cta-label">Call us</span><a className="r9f-cta-value" href={tel}>{phoneText}</a></li>}
                  {email && <li><span className="r9f-cta-label">Email</span><a className="r9f-cta-value" href={`mailto:${email}`}>{email}</a></li>}
                  {(area || place) && <li><span className="r9f-cta-label">{area ? 'Service area' : 'Based in'}</span><span className="r9f-cta-value">{area || place}</span></li>}
                </ul>
              </>
            )}
          </div>
          <EditorOnly>
            <div className="r9f-cta-card" data-acg-editor-only="">
              <p>Your contact form appears in this card on the published site: messages go to your inbox in the dashboard.</p>
            </div>
          </EditorOnly>
        </section>
      )}

      <footer className="r9f-foot" style={{ order: 9999 }}>
        <div className="r9f-wrap r9f-foot-grid">
          <div className="r9f-foot-ph">
            {footPhoto && <PhotoSlot src={footPhoto} slot="gallery" alt="" loading="lazy" />}
            {name && <p className="r9f-eyebrow">{name}</p>}
          </div>
          <div className="r9f-foot-card r9f-foot-mid">
            <div className="r9f-foot-cols">
              <div>
                <p className="r9f-foot-h">Explore</p>
                <ul className="r9f-foot-links">
                  {menuLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
              <div>
                <p className="r9f-foot-h">Contact</p>
                <ul className="r9f-foot-links">
                  {tel && <li><a href={tel}>{phoneText}</a></li>}
                  {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                  {place && <li><span>{place}</span></li>}
                  {hours.map((h) => <li key={h.days}><span>{h.time ? `${h.days} ${h.time}` : h.days}</span></li>)}
                </ul>
              </div>
            </div>
            <div>
              <SocialRow biz={biz} images={images} size={18} gap={14} color={tokens['--r9f-card-text']} style={{ marginBottom: 18 }} />
              <p className="r9f-foot-copy">© <span data-acg-year="">{new Date().getFullYear()}</span> {name}. All rights reserved.</p>
            </div>
          </div>
          <div className="r9f-foot-side">
            {(area || place) && (
              <div className="r9f-foot-card r9f-foot-area">
                <span className="r9f-foot-pin"><LucideIcon name="pin" size={40} stroke={1.5} /></span>
                <h3>{area ? 'Where we work' : 'Where we are'}</h3>
                <p>{area || place}</p>
                <a className="r9f-foot-book" href={bookHref} {...bookingAttrs(true)}>Book a detail <LucideIcon name="arrowUpRight" size={18} /></a>
              </div>
            )}
            <div className="r9f-foot-card r9f-foot-brand">
              {images.logo ? <PhotoSlot src={images.logo} slot="logo" alt={name ? `${name} logo` : 'Logo'} style={{ width: 'auto', height: 64, maxWidth: 220, objectFit: 'contain', borderRadius: 3 }} /> : <span className="r9f-logo-name">{name}</span>}
              {tagline && <p>{tagline}</p>}
            </div>
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref={bookHref} colors={{ ...t, bg: tokens['--r9f-dark-bg'], text: tokens['--r9f-dark-text'] }} font={body} />
    </div>
  );
}
