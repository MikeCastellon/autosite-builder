// Redline (mobile_redline): near-black and signal red for mobile detailers,
// with an instant-price card in the hero, a scrolling vehicle-makes band,
// package cards with "what's included" lists, a featured-service spotlight,
// a review carousel, a service-area map and a photo CTA band.
// Theme-ready (CLAUDE.md "Template contract"):
//   - every color is a deriveTheme() token (or a mix / alpha / hue shift of
//     one) exposed as a --rl-* variable on the root; text on another surface
//     is --rl-<scope>-text|muted next to --rl-<scope>-bg, contrast-repaired;
//   - all CSS lives in the one prefixed <style> below, mobile first, with
//     @container (min-width) breakpoints on the root; hover styles inside
//     (hover:hover), transitions and the marquee inside
//     prefers-reduced-motion: no-preference;
//   - no hooks or browser globals (the published page has no React): the
//     price card is radio / checkbox inputs + :has(), the menu is the kit's
//     <details>, the include lists are <details open>, the review carousel
//     is a scroll-snap track with native CSS scroll buttons and markers as
//     progressive enhancement;
//   - facts render only when the owner entered them (Google rating, review
//     sources, insurance, stats, hours, areas, prices); editor hints go
//     through PhotoSlot / EditorOnly and never reach the published page.
// Optional data this template reads beyond the common fields (all may be
// absent): businessInfo.serviceAreas, .insured, .googlePlace, services[i]
// .summary / .includes / .badge / .image; copy.sectionTitles,
// .featuredService, .vehicleMakes, .googleBadge, .heroCard, .heroServices,
// .footer, .reviewMode, testimonial .source / .rating; images.featured,
// images.cta.
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import { ServiceCardCss, ServiceDescription } from '../ServiceCardParts.jsx';
import { socialUrl } from '../SocialIcons.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS, isByAppointment } from '../../../../lib/businessHours.js';
import { FONT_CATALOG, familiesFromStack, catalogFamily } from '../../../../lib/fontCatalog.js';
import { deriveTheme, mix, alpha, ensureContrast, contrastRatio, hexToRgb, rgbToHex } from '../kit/theme.js';
import { PhotoSlot, PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';
import { GoogleRatingBadge, StarRow, GOOGLE_STAR_GOLD, googleRatingOf, googlePlaceUrl, googleBadgePlacements } from '../kit/GoogleRatingBadge.jsx';
import { vehicleMakesFor } from '../kit/vehicleMakes.js';
import {
  splitAccent, trailingWords, sectionTitle, serviceIncludes, bulletItems,
  serviceAreasOf, phoneDisplay, telHref, formatTimeRange, trustItems,
  intentHref, bookingWorded, businessKindOf, footerColumnsOf,
} from '../kit/content.js';

export const themeReady = true;

// Default top-to-bottom order. Saved sites store these ids in
// copy.sectionOrder / copy.hiddenSections: never rename one (the allowed ids
// are frozen in templates.render.test.jsx SAVED_SECTION_IDS).
export const sections = [
  { id: 'hero', label: 'Hero & Quote' },
  { id: 'about', label: 'About' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'brands', label: 'Vehicle Makes' },
  { id: 'services', label: 'Packages' },
  { id: 'featured', label: 'Featured Service' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'awards', label: 'Awards' },
  { id: 'locations', label: 'Service Area & Hours' },
  { id: 'cta', label: 'Contact / CTA' },
];

// The wordmark, the price card's step titles and the footer column titles
// are set in Oswald whatever heading font the owner picks.
export const extraFonts = ["'Oswald', sans-serif"];

// Edit > Headings: the copy.sectionTitles fields each section uses (any other
// field is ignored by this design). titleFrom / introFrom name the copy key
// that owns that text; the Headings tab edits it there. placeholder: this
// design's fixed default for a field (others are derived from the business).
// Awards has a fixed "Recognition" label and no entry. headingDefaults()
// below gives the derived defaults.
export const headingFields = {
  hero: { fields: ['eyebrow', 'title', 'accent'], titleFrom: 'headline' },
  about: { fields: ['title', 'accent'] },
  gallery: { fields: ['title', 'accent'], placeholder: { title: 'Real Results, Every Detail Matters' } },
  brands: { fields: ['eyebrow'] },
  services: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'servicesSection.title', introFrom: 'servicesSection.intro', placeholder: { eyebrow: 'Service Menu' } },
  featured: { fields: ['eyebrow', 'title', 'accent', 'intro'] },
  testimonials: { fields: ['eyebrow', 'title', 'accent', 'intro'], placeholder: { eyebrow: 'Testimonials' } },
  locations: { fields: ['eyebrow', 'title', 'accent'], placeholder: { eyebrow: 'Service Area' } },
  cta: { fields: ['title', 'accent', 'intro'], titleFrom: 'ctaHeadline', introFrom: 'ctaSubtext' },
};

// Lucide menu / x as CSS mask images: a mask only reads the strokes' alpha
// (so their literal black never shows); the visible color is currentColor.
const iconMask = (d) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='${d}'/></svg>`)}")`;
const MASK_MENU = iconMask('M4 6h16M4 12h16M4 18h16');
const MASK_CLOSE = iconMask('M18 6 6 18M6 6l12 12');

const CSS = `
.rl-root{-webkit-font-smoothing:antialiased}
.rl-root :where(h1,h2,h3,p,ul,ol,dl,dd,figure,blockquote,fieldset){margin:0}
.rl-root :where(ul,ol){list-style:none;padding:0}
.rl-root fieldset{border:0;padding:0;min-width:0}
:where(.rl-root) a{color:inherit;text-decoration:none}
.rl-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.rl-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 18px;border-radius:6px;background:var(--rl-accent);color:var(--rl-on-accent);font-weight:700}
.rl-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.rl-root a:focus-visible,.rl-root summary:focus-visible,.rl-track:focus-visible,.rl-radio:focus-visible+.rl-opt,.rl-quote:has(.rl-go:focus-visible) .rl-go-l{outline:2px solid var(--rl-focus);outline-offset:3px}
.rl-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin:16px auto 0;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-size:13px;font-weight:500;line-height:1.45;color:inherit;opacity:.85;text-align:left}
.rl-wrap{width:100%;max-width:1280px;margin:0 auto;padding-left:20px;padding-right:20px}
.rl-sec{padding:80px 20px;scroll-margin-top:80px}
.rl-in{max-width:1280px;margin:0 auto}
.rl-c{text-align:center}
.rl-eyebrow{font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;color:var(--rl-accent-text)}
.rl-h2{font-family:var(--rl-head);font-weight:var(--rl-head-w);text-transform:uppercase;letter-spacing:0;color:var(--rl-text);overflow-wrap:break-word}
.rl-em{color:var(--rl-accent-text)}
.rl-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:6px;background:var(--rl-grad);box-shadow:var(--rl-ring);color:var(--rl-on-accent);font-size:14px;line-height:20px;font-weight:700;cursor:pointer}
.rl-btn svg{flex:none}

.rl-nav{position:sticky;top:0;z-index:50;background:var(--rl-bg);border-bottom:1px solid var(--rl-line)}
.rl-nav-in{display:flex;align-items:center;justify-content:space-between;gap:16px;height:64px}
.rl-brand{display:flex;align-items:center;gap:12px;min-width:0}
.rl-logo{display:flex;flex:none}
.rl-logo img{max-width:140px}
.rl-word{display:block;min-width:0;line-height:1}
.rl-word-1{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Oswald',sans-serif;font-size:18px;line-height:28px;font-weight:400;text-transform:uppercase;color:var(--rl-text)}
.rl-word-1.rl-word-l{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;overflow-wrap:break-word;font-size:15px;line-height:17px}
.rl-word-2{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;line-height:1;text-transform:uppercase;color:var(--rl-muted)}
.rl-word-l+.rl-word-2{margin-top:2px}
.rl-nav-act{display:flex;align-items:center;gap:8px;flex:0 10000 auto}
.rl-call{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:6px;background:var(--rl-grad);box-shadow:var(--rl-ring),var(--rl-glow);color:var(--rl-on-accent);font-size:12px;line-height:16px;font-weight:700;white-space:nowrap}
.rl-call>svg{flex-shrink:0}
.rl-call-short{white-space:normal;text-transform:uppercase}
.rl-call-long{display:none}
.rl-nav .acg-menu{display:block;position:static}
.rl-nav .acg-menu>summary{width:36px;height:36px;border-radius:6px;border:1px solid var(--rl-line);background:var(--rl-surface);color:var(--rl-text)}
/* The reference's lucide menu / x icons (20px, 2px round strokes on the
   24px grid) as masks over currentColor, so they anti-alias like the
   reference's SVG and keep the hover color. */
.rl-nav .acg-menu-bars{width:20px;height:20px;background:currentColor;-webkit-mask:${MASK_MENU} center/20px 20px no-repeat;mask:${MASK_MENU} center/20px 20px no-repeat}
.rl-nav .acg-menu[open] .acg-menu-bars{-webkit-mask-image:${MASK_CLOSE};mask-image:${MASK_CLOSE}}
.rl-nav .acg-menu-bars>span{display:none}
.rl-nav .acg-menu-panel{left:0;right:0;top:100%;width:auto;padding:16px max(20px,calc((100% - 1240px) / 2));border:0;border-top:1px solid var(--rl-line);border-bottom:1px solid var(--rl-line);border-radius:0;background:var(--rl-surface);box-shadow:none}
.rl-nav .acg-menu-panel a{min-height:48px;padding:12px 0;border-radius:0;font-size:16px;line-height:24px;font-weight:500;letter-spacing:0;color:var(--rl-muted)}
.rl-nav .acg-menu-panel a:first-child{font-weight:600}
.rl-nav .acg-menu-panel a+a:not(.acg-menu-cta){margin-top:1px}
.rl-nav .acg-menu-panel a+a:not(.acg-menu-cta)::before{top:-1px;left:0;right:0;background:var(--rl-line)}
.rl-nav-g{display:none;font-size:13px;line-height:18px;color:var(--rl-muted)}

.rl-hero{position:relative;isolation:isolate;overflow:clip;scroll-margin-top:64px;background:var(--rl-bg);color:var(--rl-hero-text)}
.rl-hero-copy{position:relative;padding:80px 0}
.rl-hero-media{position:absolute;inset:0 -20px;z-index:-1;overflow:hidden}
.rl-hero-media img{position:absolute;inset:0;object-position:center}
.rl-scrim{position:absolute;inset:0;background:var(--rl-scrim-v)}
.rl-hero-body{max-width:576px}
/* Hero pill, chips divider and outline button take the hero's own glass and
   hairline (--rl-hero-glass / -line): on a light palette with a hero photo
   the hero is dark while the page is light. The same pill elsewhere on the
   page (reviews / about placements) uses the page tokens (.rl-pill-page). */
.rl-pill{border-radius:9999px;border:1px solid var(--rl-hero-line);background:var(--rl-hero-glass);padding:8px 16px;font-size:12px;line-height:16px;white-space:nowrap;color:var(--rl-hero-text)}
.rl-pill .acg-gbadge-count{color:var(--rl-hero-muted)}
.rl-pill .acg-gbadge-rating{margin-left:1px}
.rl-pill.rl-pill-page{border-color:var(--rl-line);background:var(--rl-glass);color:var(--rl-text)}
.rl-pill.rl-pill-page .acg-gbadge-count{color:var(--rl-muted)}
.rl-hero-eyebrow{font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;color:var(--rl-hero-eyebrow)}
.rl-pill+.rl-hero-eyebrow{margin-top:36px}
/* overflow-wrap only rescues a single word longer than the column; the
   type steps down for long headlines (rl-h1-l > 60, rl-h1-xl > 100 chars). */
.rl-h1{margin-top:16px;font-family:var(--rl-head);font-size:36px;line-height:1.07;font-weight:var(--rl-head-w);text-transform:uppercase;color:var(--rl-hero-text);overflow-wrap:break-word}
.rl-h1.rl-h1-l{font-size:30px}
.rl-h1.rl-h1-xl{font-size:26px;line-height:1.12}
.rl-h1:first-child{margin-top:0}
.rl-h1 .rl-em{color:var(--rl-hero-accent)}
.rl-hero-sub{margin-top:24px;max-width:448px;font-size:16px;line-height:26px;color:var(--rl-hero-muted)}
.rl-chips{display:flex;flex-wrap:wrap;gap:24px;margin-top:32px;padding-top:20px;border-top:1px solid var(--rl-hero-line);font-size:14px;line-height:20px;color:var(--rl-hero-muted)}
.rl-chips li{display:inline-flex;align-items:center;gap:8px}
.rl-chips svg{color:var(--rl-hero-accent)}
.rl-chip-emoji{font-size:14px;line-height:1}
.rl-hero-btns{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}
.rl-hero-btns .rl-btn{padding:12px 20px}
.rl-btn-line{background:transparent;box-shadow:none;border:1px solid var(--rl-hero-line);color:var(--rl-hero-text)}
.rl-hero .rl-hint{margin-left:0}
.rl-quote-slot{padding-bottom:64px}
.rl-quote-slot .rl-quote{max-width:576px}

.rl-quote{position:relative;scroll-margin-top:80px;padding:20px;border-radius:8px;border:1px solid var(--rl-line);background:var(--rl-card-bg);box-shadow:0 24px 60px -24px rgba(0,0,0,.22);color:var(--rl-card-text);text-align:left}
.rl-steps{display:flex;align-items:center;gap:12px}
.rl-steps i{flex:1}
.rl-dot{display:flex;flex:none;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;border:1px solid var(--rl-line);background:var(--rl-bg);color:var(--rl-card-muted);font-size:14px;line-height:20px;font-weight:700}
.rl-dot b{font-weight:inherit}
.rl-dot svg{display:none}
.rl-d1,.rl-quote:has(.rl-go:checked) .rl-d2{border-color:transparent;background:var(--rl-grad);color:var(--rl-on-accent);box-shadow:var(--rl-glow)}
.rl-quote:has(.rl-go:checked) .rl-d1{border-color:var(--rl-line-strong);background:transparent;box-shadow:none;color:var(--rl-card-accent)}
.rl-quote:has(.rl-go:checked) .rl-d1 b{display:none}
.rl-quote:has(.rl-go:checked) .rl-d1 svg{display:block}
.rl-s1{margin-top:20px}
.rl-s2{display:none;margin-top:32px}
.rl-go:checked~.rl-s2{display:block}
/* Each step takes its own height (as the reference's card does) where the
   card sits under the hero copy. "Get My Price" stays out of the tab order
   until a package is picked, like the reference's disabled button. Without
   :has() step 2 simply follows step 1. */
@supports selector(:has(*)){
.rl-quote:has(.rl-go:checked) .rl-s1{display:none}
.rl-quote:not(:has(.rl-radio:checked)) .rl-go{visibility:hidden}
}
.rl-step-l{font-size:12px;line-height:16px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:var(--rl-card-accent)}
.rl-q-h{margin-top:8px;font-family:var(--rl-head);font-size:24px;line-height:1.25;font-weight:var(--rl-head-w);text-transform:uppercase;color:var(--rl-card-text)}
.rl-q-p{margin-top:12px;font-size:16px;line-height:24px;color:var(--rl-card-muted)}
.rl-opts{display:flex;flex-direction:column;gap:10px;margin-top:20px}
.rl-opt{display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;border-radius:6px;border:1px solid var(--rl-line);background:var(--rl-bg);cursor:pointer}
.rl-opt-ico{display:flex;flex:none;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;border:1px solid var(--rl-line);color:var(--rl-card-accent)}
.rl-opt-txt{flex:1;min-width:0}
.rl-opt-name{display:block;font-size:14px;line-height:17.5px;font-weight:700;color:var(--rl-card-text);overflow-wrap:break-word}
.rl-opt-sum{display:block;font-size:12px;line-height:16px;color:var(--rl-card-muted);overflow-wrap:break-word}
.rl-opt-price{flex:none;font-size:16px;line-height:24px;font-weight:700;color:var(--rl-card-accent)}
/* A text or long price ("Starting at $1,299") takes its own line under the
   name instead of squeezing it into a one-word column. */
.rl-opt-l{flex-wrap:wrap;row-gap:4px}
.rl-opt-price.rl-opt-price-t{flex:1 1 100%;min-width:0;padding-left:48px;font-size:14px;line-height:20px;overflow-wrap:break-word}
.rl-radio:checked+.rl-opt{border-color:var(--rl-accent);box-shadow:var(--rl-glow)}
.rl-radio:checked+.rl-opt .rl-opt-ico{border-color:var(--rl-accent)}
.rl-q-cta,.rl-hl-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:20px;padding:14px 32px;border-radius:6px;background:var(--rl-grad);box-shadow:var(--rl-ring),var(--rl-glow);color:var(--rl-on-accent);font-size:14px;line-height:20px;font-weight:800;text-transform:uppercase;cursor:pointer}
@supports selector(:has(*)){.rl-quote:not(:has(.rl-radio:checked)) .rl-q-cta{opacity:.4;cursor:not-allowed;pointer-events:none}}
.rl-q-title{margin-top:12px;font-family:'Oswald',sans-serif;font-size:36px;line-height:.95;font-weight:400;text-transform:uppercase;color:var(--rl-card-text)}
.rl-q-title span{display:block;color:var(--rl-card-accent)}
.rl-res{display:none;margin-top:28px}
.rl-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-radius:16px;border:1px solid var(--rl-line);background:var(--rl-row-bg)}
.rl-row-l{flex:none;font-size:14px;line-height:20px;letter-spacing:.1em;text-transform:uppercase;color:var(--rl-row-muted)}
.rl-row-v{min-width:0;text-align:right;font-family:'Oswald',sans-serif;font-size:20px;line-height:28px;font-weight:400;text-transform:uppercase;color:var(--rl-row-text);overflow-wrap:break-word}
.rl-row-v span{color:var(--rl-row-accent)}
.rl-q-acts{display:flex;gap:12px;margin-top:32px}
.rl-back{display:inline-flex;flex:none;align-items:center;gap:8px;padding:16px 18px;border-radius:16px;border:1px solid var(--rl-line);color:var(--rl-card-text);font-size:16px;line-height:24px;font-weight:600;cursor:pointer}
.rl-q-book{display:none;flex:1;align-items:center;justify-content:center;gap:8px;min-width:0;padding:16px 20px;border-radius:16px;background:var(--rl-grad);box-shadow:var(--rl-ring),var(--rl-glow);color:var(--rl-on-accent);font-size:16px;line-height:28px;font-weight:800;letter-spacing:.025em;text-transform:uppercase;white-space:nowrap}
.rl-q-call{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;padding:14px 24px;border-radius:16px;border:1px solid var(--rl-line);color:var(--rl-card-text);font-size:16px;line-height:24px;font-weight:700}
.rl-res.rl-any{display:block}
.rl-q-book.rl-any{display:inline-flex}
.rl-res-set{display:grid;grid-template-columns:minmax(0,1fr)}
@supports selector(:has(*)){
.rl-quote:has(.rl-radio:checked) .rl-any.rl-any{display:none}
.rl-quote:has(#rl-pkg-0:checked) .rl-res.rl-pk-0,.rl-quote:has(#rl-pkg-1:checked) .rl-res.rl-pk-1,.rl-quote:has(#rl-pkg-2:checked) .rl-res.rl-pk-2,.rl-quote:has(#rl-pkg-3:checked) .rl-res.rl-pk-3{display:block}
.rl-quote:has(#rl-pkg-0:checked) .rl-q-book.rl-pk-0,.rl-quote:has(#rl-pkg-1:checked) .rl-q-book.rl-pk-1,.rl-quote:has(#rl-pkg-2:checked) .rl-q-book.rl-pk-2,.rl-quote:has(#rl-pkg-3:checked) .rl-q-book.rl-pk-3{display:inline-flex}
}
/* The list card (copy.heroCard 'list'): the owner's packages as plain rows
   in the price card's look, with no picking; its button goes to the
   package cards (or books). */
.rl-hlist .rl-q-h{margin-top:0}
.rl-hl{display:flex;flex-direction:column;gap:10px;margin-top:20px}
.rl-hl>li{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:6px;border:1px solid var(--rl-line);background:var(--rl-bg)}

.rl-about{border-top:1px solid var(--rl-line)}
.rl-about-grid{display:grid;align-items:center;gap:48px}
.rl-about-grid:not(.rl-duo){max-width:760px}
.rl-about-photo{position:relative;width:100%;max-width:384px;aspect-ratio:3/4;overflow:hidden;border-radius:6px}
.rl-about-h{font-size:30px;line-height:1.25}
.rl-about-badge{display:flex;margin-top:20px}
.rl-about-p{margin-top:24px;font-size:16px;line-height:28px;color:var(--rl-muted)}
.rl-about-p+.rl-about-p{margin-top:16px}
.rl-stats{display:grid;grid-template-columns:repeat(var(--rl-n),minmax(0,1fr));gap:16px;margin-top:40px;text-align:center}
/* Values wrap only at spaces (never '1,000' / '+'). The row's values shrink
   with their column (cqi = the root container; --rl-n = the stat count), so
   three "1,000+" fit a 320px phone and the About text column at 680px. */
.rl-stat-v{display:block;font-family:var(--rl-head);font-size:30px;line-height:36px;font-weight:var(--rl-head-w);color:var(--rl-accent-text)}
.rl-stats .rl-stat-v{font-size:clamp(18px,calc((100cqi - 40px) / var(--rl-n) / 4),30px)}
.rl-stat-l{display:block;margin-top:8px;font-size:10px;line-height:15px;text-transform:uppercase;color:var(--rl-muted)}
.rl-statbox{display:grid;gap:28px;padding:36px 28px;border-radius:6px;border:1px solid var(--rl-line);background:var(--rl-card-bg);text-align:center}
.rl-statbox .rl-stat-v{color:var(--rl-card-accent)}
.rl-statbox .rl-stat-l{color:var(--rl-card-muted)}

.rl-gal-sec{padding-bottom:80px}
.rl-flush{padding-top:0}
.rl-gal-h{font-size:30px;line-height:36px}
/* Wrapping flex rather than a grid, so a short last row is centered. */
.rl-gal{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:36px}
.rl-shot{position:relative;isolation:isolate;width:calc((100% - 12px) / 2);overflow:hidden;border-radius:6px;border:1px solid var(--rl-line);background:var(--rl-surface)}
.rl-shot img{aspect-ratio:4/5}
.rl-shot img.rl-shot-bg{position:absolute;top:-16px;left:-16px;z-index:-2;width:calc(100% + 32px);height:calc(100% + 32px);aspect-ratio:auto;object-fit:cover;filter:blur(16px) brightness(.6)}
/* A veil of the tile surface over the blurred copy (solid toward the side
   edges): a thin strip beside a portrait photo reads as the plain tile, as
   in the reference, while a landscape photo's letterbox above and below it
   still shows a hint of the photo. */
.rl-shot::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--rl-shot-veil)}

.rl-makes{padding:28px 20px;border-top:1px solid var(--rl-line);border-bottom:1px solid var(--rl-line);background:var(--rl-soft-bg);text-align:center}
.rl-makes-eye{font-size:12px;line-height:16px;font-weight:500;text-transform:uppercase;color:var(--rl-soft-muted)}
.rl-sprite{position:absolute;width:0;height:0;overflow:hidden}
.rl-mq{margin-top:20px}
/* Without motion (reduced-motion users, or no animation support) the band is
   one copy of the list: a one-row swipe strip on phones, a centered wrap
   from 640px. .rl-mq-rep items only pad a short owner list out to a full
   marquee row, so they show only while it scrolls. */
.rl-mq-track{display:flex;justify-content:center}
.rl-mq-set{display:flex;flex:1;min-width:0;flex-wrap:nowrap;justify-content:flex-start;gap:32px;overflow-x:auto;padding:0 8px 6px;scroll-snap-type:x proximity;scrollbar-width:thin}
.rl-mq-set+.rl-mq-set{display:none}
.rl-mq-item{display:flex;flex:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:55px;scroll-snap-align:start;color:var(--rl-soft-muted)}
.rl-mq-rep{display:none}
.rl-mq-item svg{width:32px;height:32px;fill:currentColor}
.rl-mq-l{font-size:10px;line-height:15px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
.rl-mq-t{font-size:14px;line-height:20px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
@keyframes rl-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
/* The band is focusable: focusing it (Tab, or a tap on touch screens)
   pauses the scrolling row until focus moves on (WCAG 2.2.2), as hovering
   does for a mouse. */
.rl-makes:focus-within .rl-mq-track{animation-play-state:paused}
.rl-makes:focus-visible{outline:2px solid var(--rl-focus);outline-offset:-4px}

.rl-svc-h{margin-top:12px;font-size:36px;line-height:40px}
.rl-svc-intro{margin-top:16px;font-size:16px;line-height:24px;color:var(--rl-muted)}
.rl-cards{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;margin-top:48px}
.rl-card{position:relative;display:flex;flex-direction:column;min-width:0;padding:20px;border-radius:6px;border:1px solid var(--rl-line);background:var(--rl-soft-bg);color:var(--rl-soft-text)}
.rl-card-feat{border-color:var(--rl-accent)}
.rl-badge{position:absolute;top:-12px;left:24px;max-width:calc(100% - 48px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:6px 16px;border-radius:4px;background:var(--rl-accent);box-shadow:var(--rl-ring);color:var(--rl-on-accent);font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase}
.rl-card-photo{overflow:hidden;margin-bottom:28px;border-radius:6px;background:var(--rl-bg)}
.rl-card-photo img{aspect-ratio:4/3}
/* A package without a photo next to ones with photos: an empty 4:3 well
   keeps its name, price and Book button level with its neighbours where
   cards share a row (shown from 768px, below that cards stack). */
.rl-card-well{display:none;align-items:center;justify-content:center;aspect-ratio:4/3;color:var(--rl-line-strong)}
.rl-card-feat:not(:has(.rl-card-photo:not(.rl-card-well))){padding-top:36px}
.rl-card-name{text-align:center;font-family:var(--rl-head);font-size:24px;line-height:32px;font-weight:var(--rl-head-w2);text-transform:uppercase;color:var(--rl-soft-text);overflow-wrap:anywhere}
.rl-card-desc{margin-top:12px;text-align:center;font-size:14px;line-height:22.75px;color:var(--rl-soft-muted)}
.rl-card-desc .acg-svc-more{color:var(--rl-soft-accent)}
.rl-card-price{margin-top:24px;text-align:center;font-family:var(--rl-head);font-size:36px;line-height:40px;font-weight:var(--rl-head-w2);color:var(--rl-soft-text);overflow-wrap:anywhere}
.rl-card-price.rl-price-t{font-size:22px;line-height:30px}
.rl-card .rl-btn{margin-top:24px;width:100%;padding:14px 20px;text-transform:uppercase}
.rl-inc{margin-top:24px;padding-top:16px;border-top:1px solid var(--rl-line);text-align:left}
.rl-inc>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;cursor:pointer;text-align:center;font-size:14px;line-height:20px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--rl-soft-accent)}
.rl-inc>summary::-webkit-details-marker{display:none}
.rl-inc>summary::marker{content:''}
.rl-inc:not([open]) .rl-chev{transform:rotate(180deg)}
.rl-inc ul{display:flex;flex-direction:column;gap:14px;margin-top:20px}
.rl-inc-h{padding-top:4px;font-size:16px;line-height:24px;font-weight:700;letter-spacing:.025em;text-transform:uppercase;color:var(--rl-soft-text)}
.rl-inc-h:first-child{padding-top:0}
.rl-inc-i{display:flex;align-items:flex-start;gap:12px;font-size:15px;line-height:20.625px;font-weight:500;color:var(--rl-soft-text)}
.rl-inc-i svg{flex:none;margin-top:2px;color:var(--rl-soft-accent)}
.rl-inc-hl{font-weight:600;color:var(--rl-soft-accent)}

.rl-feat{border-top:1px solid var(--rl-line);border-bottom:1px solid var(--rl-line);background:var(--rl-soft-bg);color:var(--rl-soft-text)}
.rl-feat-grid{display:grid;align-items:center;gap:40px}
.rl-feat-solo{max-width:760px}
.rl-feat-photo{width:100%;max-width:320px;overflow:hidden;border-radius:6px}
.rl-feat .rl-eyebrow,.rl-feat .rl-em{color:var(--rl-soft-accent)}
.rl-feat-h{margin-top:16px;font-size:30px;line-height:1.25;color:var(--rl-soft-text)}
.rl-feat-h:first-child{margin-top:0}
.rl-feat-price{margin-top:20px;font-size:18px;line-height:28px;color:var(--rl-soft-muted)}
.rl-feat-price strong{font-weight:700;color:var(--rl-soft-text)}
.rl-feat-list{display:flex;flex-direction:column;gap:12px;margin-top:28px;font-size:14px;line-height:20px;color:var(--rl-soft-text)}
.rl-feat-list li{display:flex;align-items:flex-start;gap:12px}
.rl-feat-list svg{flex:none;margin-top:2px;color:var(--rl-soft-accent)}
.rl-feat .rl-btn{margin-top:36px;padding:16px 28px;text-transform:uppercase}

.rl-rev-h{margin-top:12px;font-size:30px;line-height:36px}
.rl-rev-intro{margin-top:16px;font-size:14px;line-height:20px;color:var(--rl-muted)}
.rl-rev-badge{display:flex;justify-content:center;margin-top:20px}
.rl-car{position:relative;margin-top:40px}
/* The track clips the peeking card with a straight edge (no radius). Cards
   stop one at a time (scroll-snap-stop), so the native arrows step one card
   like the reference. Quotes are clamped at 8 lines (the reference's
   longest), so one long review can't stretch the row. Phones show one card
   at a time, so each card takes its own quote's height there; from 640px
   the visible cards share the tallest height, as in the reference. A
   single quote is centered (full width on phones). */
.rl-track{display:flex;align-items:flex-start;gap:24px;overflow-x:auto;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;padding-bottom:8px}
.rl-track.rl-one{justify-content:center}
.rl-track.rl-one .rl-rev{width:100%;max-width:720px}
.rl-rev{display:flex;flex:none;flex-direction:column;width:85%;padding:28px;border-radius:20px;border:1px solid var(--rl-line);background:var(--rl-rev-bg);color:var(--rl-rev-text);text-align:left;scroll-snap-align:start;scroll-snap-stop:always}
.rl-rev-stars{color:var(--rl-mark)}
.rl-rev-q{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:8;overflow:hidden;font-size:16px;line-height:26px;color:var(--rl-rev-text)}
.rl-rev-stars+.rl-rev-q{margin-top:20px}
.rl-rev-by{display:flex;align-items:center;gap:12px;min-width:0;margin-top:auto;padding-top:24px}
.rl-ava{display:flex;flex:none;align-items:center;justify-content:center;width:44px;height:44px;border-radius:9999px;background:var(--rl-grad);color:var(--rl-on-accent);font-size:16px;line-height:24px;font-weight:700}
.rl-rev-who{flex:1;min-width:0}
.rl-rev-id{display:block;min-width:0}
.rl-rev-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.rl-rev-meta{display:block;font-size:13px;line-height:18px;color:var(--rl-rev-muted)}
.rl-rev-src{display:block;width:fit-content;white-space:nowrap;font-size:14px;line-height:20px;color:var(--rl-rev-muted)}
.rl-rev-more{display:inline-flex;align-items:center;gap:8px;margin-top:32px;font-size:14px;line-height:20px;font-weight:600;color:var(--rl-accent-text)}
.rl-rev-widget{margin-top:40px}
/* Native CSS carousel controls where supported; elsewhere the track keeps
   its scrollbar and swipes. Each dot is named "Review n". */
@supports (scroll-marker-group:after){
.rl-track{scroll-marker-group:after;counter-reset:rl-rev;scrollbar-width:none}
.rl-track::-webkit-scrollbar{display:none}
.rl-track::scroll-marker-group{display:flex;align-items:center;gap:8px;height:44px;margin-top:24px}
.rl-rev{counter-increment:rl-rev}
.rl-rev::scroll-marker{content:'' / 'Review';content:'' / 'Review ' counter(rl-rev);width:10px;height:10px;border-radius:9999px;background:var(--rl-dot-off);cursor:pointer}
.rl-rev::scroll-marker:target-current{width:28px;background:var(--rl-mark)}
.rl-rev::scroll-marker:focus-visible{outline:2px solid var(--rl-focus);outline-offset:3px}
.rl-track::scroll-button(*){position:absolute;bottom:0;z-index:2;width:44px;height:44px;border-radius:9999px;border:1px solid var(--rl-line);background:var(--rl-rev-bg) center/20px 20px no-repeat;cursor:pointer}
.rl-track::scroll-button(left){content:'' / 'Previous review';right:56px;background-image:var(--rl-chev-l)}
.rl-track::scroll-button(right){content:'' / 'Next review';right:0;background-image:var(--rl-chev-r)}
.rl-track::scroll-button(*):disabled{opacity:.55;cursor:default}
.rl-track::scroll-button(*):focus-visible{outline:2px solid var(--rl-focus);outline-offset:3px}
.rl-track.rl-one{scroll-marker-group:none}
.rl-track.rl-one::scroll-button(*){content:none}
}
/* Two or three quotes fit one desktop row: no scrolling, no controls. */
@container (min-width:1024px){
.rl-track.rl-n3 .rl-rev{width:calc((100% - 48px) / 3)}
.rl-track.rl-n2{justify-content:center}
@supports (scroll-marker-group:after){
.rl-track:is(.rl-n2,.rl-n3){scroll-marker-group:none}
.rl-track:is(.rl-n2,.rl-n3)::scroll-button(*){content:none}
}
}

.rl-awards{border-top:1px solid var(--rl-line);text-align:center}
.rl-sec.rl-awards{padding-top:48px;padding-bottom:48px}
.rl-award-list{display:flex;flex-wrap:wrap;justify-content:center;gap:16px 40px;margin-top:20px}
.rl-award{display:inline-flex;align-items:center;gap:10px;font-size:15px;line-height:22px;font-weight:700;text-transform:uppercase;color:var(--rl-text)}
.rl-award svg{flex:none;color:var(--rl-accent-text)}

.rl-loc{border-top:1px solid var(--rl-line);background:var(--rl-soft-bg);color:var(--rl-soft-text)}
.rl-loc .rl-eyebrow,.rl-loc .rl-em{color:var(--rl-soft-accent)}
.rl-loc-h{margin-top:12px;font-size:24px;line-height:32px;color:var(--rl-soft-text)}
.rl-loc-grid{display:grid;gap:40px;margin-top:40px}
.rl-map{display:flex;flex-direction:column;overflow:hidden;border-radius:6px;border:1px solid var(--rl-line)}
.rl-map iframe{display:block;width:100%;height:460px;border:0;background:var(--rl-map-bg)}
.rl-legend{display:flex;flex:1;flex-wrap:wrap;align-content:flex-start;align-items:center;gap:8px 24px;padding:12px 16px;background:var(--rl-soft-bg)}
.rl-legend li{display:inline-flex;align-items:center;gap:8px;font-size:14px;line-height:20px;font-weight:600;color:var(--rl-soft-text)}
.rl-legend i{flex:none;width:12px;height:12px;border-radius:9999px}
.rl-loc-col>:first-child{margin-top:0}
.rl-loc-h3{display:flex;align-items:center;gap:8px;font-size:20px;line-height:28px;font-weight:700;text-transform:uppercase;color:var(--rl-soft-text)}
.rl-loc-h3 svg{flex:none;color:var(--rl-soft-accent)}
.rl-areas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:20px}
.rl-area{display:flex;align-items:center;gap:8px;min-width:0;padding-bottom:8px;border-bottom:1px solid var(--rl-line);font-size:14px;line-height:20px;color:var(--rl-soft-muted)}
.rl-area svg{flex:none;color:var(--rl-soft-accent)}
.rl-area-one{margin-top:16px;font-size:16px;line-height:24px;color:var(--rl-soft-muted)}
.rl-hours-h{margin-top:32px}
.rl-hours{display:flex;flex-direction:column;gap:8px;margin-top:16px}
.rl-hrow{display:flex;justify-content:space-between;gap:12px;padding-bottom:8px;border-bottom:1px solid var(--rl-line);font-size:14px;line-height:20px}
.rl-hrow dt{color:var(--rl-soft-text)}
.rl-hrow dd{text-align:right;color:var(--rl-soft-muted)}
.rl-hfree{margin-top:16px;font-size:16px;line-height:24px;color:var(--rl-soft-muted)}

.rl-cta{position:relative;isolation:isolate;overflow:hidden;padding:96px 20px;scroll-margin-top:64px;background:var(--rl-surface);color:var(--rl-cta-text);text-align:center}
.rl-cta-img{position:absolute;inset:0;z-index:-2}
.rl-cta-scrim{position:absolute;inset:0;z-index:-1;background:var(--rl-cta-scrim-v)}
.rl-cta-in{max-width:768px;margin:0 auto}
.rl-cta-h{font-size:24px;line-height:32px;color:var(--rl-cta-text)}
.rl-cta .rl-em{color:var(--rl-cta-accent)}
.rl-cta-p{margin-top:20px;font-size:16px;line-height:24px;color:var(--rl-cta-muted)}
.rl-cta-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:32px}
.rl-cta-btns .rl-btn{padding:14px 24px}
.rl-btn-light{background:transparent;box-shadow:none;border:1px solid var(--rl-cta-text);color:var(--rl-cta-text)}
.rl-cta>[data-acg-inquiry]{position:relative;max-width:560px!important;margin:48px auto 0!important;padding:28px!important;border-radius:8px;border:1px solid var(--rl-line);background:var(--rl-card-bg);color:var(--rl-card-text);text-align:left}
.rl-cta>[data-acg-inquiry] h3{margin-bottom:20px!important;font-family:var(--rl-head);font-size:22px!important;line-height:1.25;font-weight:var(--rl-head-w)!important;text-transform:uppercase;color:var(--rl-card-text)!important}
.rl-cta>[data-acg-inquiry] :is(input,textarea){border:1px solid var(--rl-line)!important;border-radius:6px!important;background:var(--rl-bg)!important;color:var(--rl-text)!important;font-size:16px!important}
.rl-cta>[data-acg-inquiry] :is(input,textarea)::placeholder{color:var(--rl-muted);opacity:1}
.rl-cta>[data-acg-inquiry] :is(input,textarea):focus-visible{outline:2px solid var(--rl-focus);outline-offset:1px;border-color:var(--rl-accent)!important}
.rl-cta>[data-acg-inquiry] button{border-radius:6px!important;background:var(--rl-grad)!important;color:var(--rl-on-accent)!important;font-size:14px!important;font-weight:800!important;text-transform:uppercase;letter-spacing:.025em}
.rl-cta>[data-acg-inquiry] [data-acg-status]{color:var(--rl-card-accent)!important}
.rl-cta>[data-acg-inquiry] [data-acg-status]:empty{min-height:0!important;margin:0!important}
.rl-cta>[data-acg-inquiry]>div{border-color:var(--rl-line)!important;background:transparent!important}
.rl-cta>[data-acg-inquiry]>div :is(h3,p){color:var(--rl-card-text)!important}

.rl-foot{background:var(--rl-footer-bg);color:var(--rl-footer-text)}
.rl-foot-grid{display:grid;gap:48px;padding-top:64px;padding-bottom:64px}
.rl-foot-brand{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.rl-foot-word{font-family:'Oswald',sans-serif;font-size:24px;line-height:32px;font-weight:400;letter-spacing:.05em;text-transform:uppercase;color:var(--rl-footer-text);overflow-wrap:anywhere}
.rl-foot-blurb{font-size:14px;line-height:22.75px;color:var(--rl-footer-muted)}
.rl-foot-g{margin-top:16px;font-size:14px;line-height:20px;color:var(--rl-footer-muted)}
.rl-foot-t{margin-bottom:16px;font-family:'Oswald',sans-serif;font-size:20px;line-height:28px;font-weight:400;letter-spacing:.025em;color:var(--rl-footer-text)}
.rl-foot-list{display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:20px;color:var(--rl-footer-muted)}
.rl-foot-list.rl-touch{gap:12px}
.rl-foot-list.rl-touch li{display:block}
.rl-foot-list li{display:flex;align-items:center;gap:8px;min-width:0}
.rl-foot-list a{display:inline-flex;align-items:center;gap:8px;min-width:0}
.rl-foot-list svg{flex:none;color:var(--rl-accent-text)}
/* An address too long for its column breaks after the @ (a <wbr>), and
   only if that is not enough anywhere else. */
.rl-mail{overflow-wrap:anywhere}
.rl-foot-hours{margin-top:20px;font-size:14px;line-height:20px;color:var(--rl-footer-muted)}
.rl-foot-hours b{display:block;margin-bottom:4px;font-weight:600;color:var(--rl-footer-text)}
.rl-pillbtn{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:20px;padding:10px 20px;border-radius:9999px;background:var(--rl-grad);box-shadow:var(--rl-ring);color:var(--rl-on-accent);font-size:14px;line-height:20px;font-weight:600}
.rl-foot-bar{border-top:1px solid var(--rl-line)}
.rl-foot-bar-in{display:flex;flex-direction:column;gap:8px;padding-top:20px;padding-bottom:20px;font-size:12px;line-height:16px;color:var(--rl-footer-muted)}
/* The footer rating, when the owner hid the logo column it normally sits in. */
.rl-foot-bar-g{font-size:13px;line-height:18px}

/* Phones: the nav's actions shrink 10000x faster than the brand, so a tight
   row first stacks "Call Now" on two lines (as the reference does at
   320px) and only then shortens the business name. A wide (wordmark-
   shaped) logo is capped (96px, 64px below 380px so a short name next to
   it still fits at 320-375px), and next to a logo a long name (two-line
   wordmark) gets an icon-only call button below 420px (its aria-label
   still says "Call now"). */
@container (max-width:639.98px){
.rl-nav .rl-logo img{max-width:96px}
}
@container (max-width:419.98px){
.rl-nav-tight .rl-call{justify-content:center;width:36px;padding:0}
.rl-nav-tight .rl-call-short{display:none}
}
@container (max-width:379.98px){
.rl-nav .rl-logo img{max-width:64px}
}
@container (max-width:349.98px){
.rl-nav-in{gap:10px}
.rl-brand{gap:8px}
.rl-call{gap:6px;padding:0 8px;line-height:14px;text-align:left}
}
@container (min-width:640px){
.rl-word-1{font-size:20px}
.rl-word-1.rl-word-l{font-size:18px;line-height:20px}
.rl-word-2{font-size:10px}
.rl-call{padding:0 20px;font-size:14px;line-height:20px}
.rl-call-short{display:none}
.rl-call-long{display:inline}
.rl-pill{font-size:14px;line-height:20px}
.rl-hero-eyebrow{font-size:14px;line-height:20px}
.rl-h1{font-size:48px}
.rl-h1.rl-h1-l{font-size:40px}
.rl-h1.rl-h1-xl{font-size:34px}
.rl-hero-sub{font-size:18px;line-height:29.25px}
.rl-quote{padding:28px}
.rl-q-h{font-size:30px}
.rl-opt-name{font-size:16px;line-height:20px}
.rl-q-title{font-size:48px}
.rl-back{padding:16px 24px}
.rl-q-book{padding:16px 32px;font-size:18px}
.rl-about-h{font-size:36px}
.rl-stat-v{font-size:36px;line-height:40px}
.rl-stats .rl-stat-v{font-size:clamp(24px,calc((100cqi - 40px) / var(--rl-n) / 4),36px)}
.rl-stat-l{font-size:12px;line-height:16px}
.rl-gal-h{font-size:36px;line-height:40px}
.rl-gal{gap:16px}
.rl-mq-set{flex-wrap:wrap;justify-content:center;gap:20px 40px;overflow:visible;padding:0}
.rl-shot{width:calc((100% - 48px) / 4)}
.rl-svc-h{font-size:48px;line-height:48px}
.rl-card{padding:28px}
.rl-feat-h{font-size:36px}
.rl-feat-list{font-size:16px;line-height:24px}
.rl-rev{width:55%}
.rl-track{align-items:stretch}
.rl-rev-who{display:flex;align-items:center;gap:12px}
.rl-rev-id{flex:1}
.rl-rev-src{flex:none;margin-left:auto}
.rl-rev-h{font-size:36px;line-height:40px}
.rl-loc-h{font-size:30px;line-height:36px}
.rl-cta-h{font-size:36px;line-height:40px}
.rl-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.rl-foot-bar-in{flex-direction:row;justify-content:space-between}
}
@container (min-width:680px){
.rl-about-grid.rl-duo{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr)}
.rl-duo .rl-stats .rl-stat-v{font-size:clamp(20px,calc((100cqi - 88px) * .6 / var(--rl-n) / 4),36px)}
}
/* Cards wrap as flex rows of --rl-cn, so a short last row is centered, and
   one or two packages don't stretch into full-width banners. Where cards
   share a row, a minimum description height lines their prices up (a lone
   card, a one-column phone list or a card without a price has nothing to
   line up with, so its price follows its text). */
@container (min-width:768px){
.rl-cards{display:flex;flex-wrap:wrap;justify-content:center;max-width:calc(var(--rl-cn) * 440px);margin-left:auto;margin-right:auto}
.rl-card{width:calc((100% - (var(--rl-cn) - 1) * 20px) / var(--rl-cn))}
.rl-cards:not(.rl-cards-1) .rl-card:not(.rl-card-np) .rl-card-desc{min-height:112px}
.rl-cards:not(.rl-cards-1) .rl-card-well{display:flex}
.rl-cards:not(.rl-cards-1) .rl-card-feat:has(.rl-card-well){padding-top:28px}
.rl-feat-grid.rl-duo{grid-template-columns:repeat(2,minmax(0,1fr));gap:56px}
}
/* The price card moves beside the copy only from 900px (the reference does
   it at 680, where its copy column is too narrow for the 48px headline);
   below that it sits under the copy, as on phones. A light palette's dark
   photo hero fades into the light page in its empty bottom padding, so the
   card's top overlaps the page color, not a hard dark edge. */
@container (max-width:899.98px){
.rl-lite .rl-hero-copy{padding-bottom:128px}
.rl-lite .rl-quote-slot{position:relative;margin-top:-48px}
.rl-lite .rl-scrim{background:var(--rl-scrim-v-lite)}
}
@container (min-width:900px){
.rl-hero-grid{display:grid;gap:24px;align-items:center;padding:80px 0}
.rl-has-card .rl-hero-grid{grid-template-columns:minmax(0,1fr) minmax(340px,420px)}
.rl-card-off .rl-hero-body{max-width:768px}
.rl-hero-copy{position:static;padding:0}
.rl-hero-media{inset:0}
.rl-quote-slot{padding:0}
.rl-quote-slot .rl-quote{max-width:none}
}
/* Beside the copy the card is vertically centered: both steps, and every
   package's step-2 row, share one grid cell and swap visibility, so the
   card keeps one height and position whatever it shows. The picked row
   inherits step 2's visibility (visible would show through step 1). */
@container (min-width:900px){
@supports selector(:has(*)){
.rl-quote{display:grid;grid-template-columns:minmax(0,1fr)}
.rl-s1,.rl-s2{grid-row:2;grid-column:1}
.rl-quote .rl-s2{display:block;visibility:hidden}
.rl-quote .rl-go:checked~.rl-s2{visibility:visible}
.rl-quote:has(.rl-go:checked) .rl-s1{display:block;visibility:hidden}
.rl-quote .rl-res-set>.rl-res{display:block;grid-area:1/1;visibility:hidden}
.rl-quote:not(:has(.rl-radio:checked)) .rl-res-set>.rl-any,.rl-quote:has(#rl-pkg-0:checked) .rl-res-set>.rl-pk-0,.rl-quote:has(#rl-pkg-1:checked) .rl-res-set>.rl-pk-1,.rl-quote:has(#rl-pkg-2:checked) .rl-res-set>.rl-pk-2,.rl-quote:has(#rl-pkg-3:checked) .rl-res-set>.rl-pk-3{visibility:inherit}
}
}
@container (min-width:1024px){
.rl-sec{padding-top:112px;padding-bottom:112px}
.rl-sec.rl-flush{padding-top:0}
.rl-gal-sec{padding-bottom:96px}
.rl-hero-grid{gap:48px;padding:112px 0}
.rl-has-card .rl-hero-grid,.rl-has-photo .rl-hero-grid{min-height:690px;padding:64px 0}
.rl-scrim{background:var(--rl-scrim-h)}
.rl-hero-eyebrow{color:var(--rl-hero-eyebrow-lg)}
.rl-has-card .rl-hero-btns:not(.rl-btns-keep){display:none}
.rl-h1{font-size:59.2px}
.rl-h1.rl-h1-l{font-size:48px}
.rl-h1.rl-h1-xl{font-size:40px}
.rl-nav-g{display:inline-flex}
.rl-about-grid{gap:80px}
.rl-about-h{font-size:48px}
.rl-duo .rl-stats .rl-stat-v{font-size:clamp(20px,calc((min(100cqi - 40px, 1280px) - 80px) * .6 / var(--rl-n) / 4),36px)}
.rl-rev{width:38%}
.rl-loc-grid.rl-duo{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)}
.rl-cta-scrim{background:var(--rl-cta-scrim-h)}
.rl-foot-grid{grid-template-columns:repeat(var(--rl-fn),minmax(0,1fr))}
/* Five columns (Hours moved away from Get In Touch) are too narrow for the
   wordmark, the email and the button below 1280px: three per row there. */
.rl-foot-grid.rl-foot-5{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@container (min-width:1280px){
.rl-foot-grid.rl-foot-5{grid-template-columns:repeat(5,minmax(0,1fr))}
}

@media (hover:hover){
.rl-btn:hover,.rl-call:hover,.rl-q-book:hover,.rl-hl-cta:hover,.rl-pillbtn:hover{filter:brightness(1.1)}
.rl-btn-line:hover{border-color:var(--rl-hero-text)}
.rl-nav .acg-menu>summary:hover{color:var(--rl-accent-text)}
.rl-nav .acg-menu-panel a:not(.acg-menu-cta):hover{background:transparent;color:var(--rl-text)}
.rl-opt:hover{border-color:var(--rl-accent-soft)}
.rl-back:hover,.rl-q-call:hover{border-color:var(--rl-accent-soft)}
.rl-mq:hover .rl-mq-track{animation-play-state:paused}
.rl-mq-item:hover{color:var(--rl-soft-text)}
a.rl-rev-src:hover{color:var(--rl-rev-text)}
.rl-foot-list a:hover,.rl-foot-g a:hover{color:var(--rl-footer-text)}
.rl-nav-g a:hover{color:var(--rl-text)}
.rl-rev-more:hover{color:var(--rl-text)}
.rl-track::scroll-button(*):hover{border-color:var(--rl-accent)}
}
@media (prefers-reduced-motion:no-preference){
.rl-btn,.rl-call,.rl-opt,.rl-q-cta,.rl-hl-cta,.rl-q-book,.rl-back,.rl-q-call,.rl-rev-src,.rl-pillbtn,.rl-foot-list a,.rl-rev-more,.rl-nav .acg-menu>summary,.rl-nav .acg-menu-panel a{transition:color .15s cubic-bezier(.4,0,.2,1),background-color .15s cubic-bezier(.4,0,.2,1),border-color .15s cubic-bezier(.4,0,.2,1),box-shadow .15s cubic-bezier(.4,0,.2,1),filter .15s cubic-bezier(.4,0,.2,1)}
.rl-chev{transition:transform .2s cubic-bezier(.4,0,.2,1)}
.rl-mq{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)}
.rl-mq-track{justify-content:flex-start;width:max-content;animation:rl-scroll 55s linear infinite}
.rl-mq-set,.rl-mq-set+.rl-mq-set{display:flex;flex:none;flex-wrap:nowrap;gap:0;overflow:visible;padding:0}
.rl-mq-set .rl-mq-rep{display:flex}
.rl-mq-item{margin-right:56px}
.rl-mq-item{transition:color .2s}
.rl-track{scroll-behavior:smooth}
.rl-rev::scroll-marker{transition:width .3s cubic-bezier(.4,0,.2,1),background-color .3s cubic-bezier(.4,0,.2,1)}
}
`.replace(/\/\*[\s\S]*?\*\//g, '');

const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);
const nameKey = (s) => txt(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const num = (v) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : NaN;
};
// Prices that are text or long ("Call for quote", "$150/$200/$250",
// "Starting at $1,299"): the package card sets them smaller, the price
// card gives them their own line under the package name.
const cardPriceLong = (p) => !/\d/.test(p) || p.length > 9 || p.includes('/');
const optPriceLong = (p) => cardPriceLong(p) || p.length > 7 || /\s/.test(p);
// A quote's text without the quote marks the AI sometimes wraps it in.
const quoteText = (q) => txt(q?.text).replace(/^["“”]+|["“”]+$/g, '').trim();

// Wordmark: "Northside Mobile Detailing" -> NORTHSIDE / MOBILE DETAILING
// (a trailing business-type descriptor moves to the small second line).
function shortNameOf(name, tagline) {
  return tagline && name.toLowerCase().endsWith(` ${tagline.toLowerCase()}`)
    ? name.slice(0, name.length - tagline.length).trim()
    : name;
}

// The design's own heading text for each section, used while the owner has
// typed none: { [sectionId]: { eyebrow?, title?, accent? } }. accent is what
// the page highlights while the owner's Highlighted words field is empty,
// given the heading the owner has now ('' = nothing). The template renders
// from these values and Edit > Headings shows them (placeholders, and the
// highlighted-words check runs against them), so the two never disagree.
// businessInfo as the template receives it (normalizeBusinessInfo).
export function headingDefaults(businessInfo, generatedCopy) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const titles = copy.sectionTitles;
  const kind = businessKindOf(biz.businessType);
  const fb = getFallbacks(kind);
  const isDetail = /detail/.test(kind);
  const name = txt(biz.businessName);
  const tagline = txt(fb.navSubtitle);
  const city = txt(biz.city);

  // About: the business name goes into the heading only while it is short
  // enough to read as one.
  const short = shortNameOf(name, tagline);
  const aboutName = short.length <= 24 ? short : '';
  const aboutT = sectionTitle(titles, 'about');
  const galT = sectionTitle(titles, 'gallery');

  // Packages: the last two words of whatever heading shows.
  const svcT = sectionTitle(titles, 'services');
  const svcTitle = isDetail ? 'Choose Your Detail Package' : 'Choose Your Package';
  const svcShown = txt(copy.servicesSection?.title) || svcT.title || svcTitle;

  // Featured: the chosen name, else the first ceramic / coating package.
  const fs = copy.featuredService && typeof copy.featuredService === 'object' ? copy.featuredService : {};
  const aiItems = list(copy.servicesSection?.items).map((s) => (typeof s === 'string' ? { name: s } : s || {}));
  const names = (list(biz.packages).length > 0 ? biz.packages : aiItems)
    .map((s) => (typeof s === 'string' ? s : txt(s?.name)))
    .map(txt);
  const fName = txt(fs.serviceName) || names.find((n) => /ceramic|coating/i.test(n)) || '';
  const ft = sectionTitle(titles, 'featured');
  const protective = /ceramic|coating|protect|film|ppf|sealant|graphene|wax/i.test(fName);

  // Reviews: "N Google Reviews" only over quotes that are all marked as
  // Google reviews, with a rating to count from.
  const rating = googleRatingOf(biz.googlePlace);
  const quotes = list(copy.testimonialPlaceholders).filter((q) => quoteText(q));
  const allGoogle = quotes.length > 0 && quotes.every((q) => q?.source === 'google');
  const googleHeading = Boolean(rating) && allGoogle;
  const revT = sectionTitle(titles, 'testimonials');

  const areas = serviceAreasOf(biz);
  const beyond = areas.some((a) => a.toLowerCase() !== city.toLowerCase());
  const locT = sectionTitle(titles, 'locations');

  // The shared fallbacks for tint shops and unknown types read "Get a Free
  // Quote": an offer the owner never made, so this template says less.
  const ctaT = sectionTitle(titles, 'cta');
  const ctaTitle = /\bfree\b/i.test(fb.ctaHeadline) ? 'Book Your Appointment' : fb.ctaHeadline;
  const ctaOwn = txt(copy.ctaHeadline) || ctaT.title;

  return {
    hero: { eyebrow: city ? `${city} ${tagline}` : fb.heroBadge, title: name, accent: '' },
    about: {
      title: aboutName ? `Why ${aboutName} Is The Right Choice For Your Car` : 'Why Choose Us',
      accent: aboutT.title ? '' : aboutName ? 'Right Choice For Your Car' : 'Choose Us',
    },
    gallery: { title: 'Real Results, Every Detail Matters', accent: galT.title ? '' : 'Every Detail Matters' },
    brands: { eyebrow: isDetail || kind === 'car_wash' ? 'We Detail All Vehicle Makes & Models' : 'All Makes & Models Welcome' },
    services: { eyebrow: 'Service Menu', title: svcTitle, accent: trailingWords(svcShown, 2) },
    featured: fName
      ? { title: protective ? `Protect Your Vehicle With ${fName}` : `Ask About Our ${fName}`, accent: ft.title ? '' : fName }
      : {},
    testimonials: {
      eyebrow: 'Testimonials',
      title: googleHeading ? `${rating.countText} Google Reviews` : 'What Our Customers Say',
      accent: revT.title ? '' : googleHeading ? 'Google Reviews' : 'Customers Say',
    },
    locations: {
      eyebrow: 'Service Area',
      title: city ? `Proudly Serving ${city}${beyond ? ' & Beyond' : ''}` : 'Where We Work',
      accent: locT.title ? '' : city ? `${city}${beyond ? ' & Beyond' : ''}` : 'We Work',
    },
    cta: { title: ctaTitle, accent: ctaOwn ? '' : trailingWords(ctaTitle, 2) },
  };
}

// Lucide icons (24px grid, stroke = currentColor).
const ICONS = {
  phone: <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />,
  pin: <><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
  shield: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  arrowUpRight: <><path d="M7 7h10v10" /><path d="M7 17 17 7" /></>,
  arrowLeft: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  chevronUp: <path d="m18 15-6-6-6 6" />,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  mail: <><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></>,
  instagram: <><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></>,
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  tiktok: <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />,
  car: <><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></>,
  sparkles: <><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /><path d="M20 2v4" /><path d="M22 4h-4" /><circle cx="4" cy="20" r="2" /></>,
  crown: <><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></>,
  award: <><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" /><circle cx="12" cy="8" r="6" /></>,
  gem: <><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" /></>,
};
// Trust Bar icon names (Edit > Trust Bar's picker) -> the lucide icons above.
const TRUST_ICONS = {
  'icon:location': 'pin', 'icon:shield': 'shield', 'icon:check': 'check', 'icon:clock': 'clock',
  'icon:phone': 'phone', 'icon:mail': 'mail', 'icon:car': 'car', 'icon:award': 'award',
};
const CHEVRON_LEFT = 'm15 18-6-6 6-6';
const CHEVRON_RIGHT = 'm9 18 6-6-6-6';
// One icon per hero card row, in order (the owner may pick up to four).
const PICK_ICONS = ['car', 'sparkles', 'crown', 'gem'];

function Icon({ name, size = 16, stroke = 2, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}

// The heaviest weight the page loads for a stack (Oswald tops out at 700,
// single-weight faces get 400), so the browser never fakes a bold.
function loadedWeight(stack, want) {
  const fam = catalogFamily(familiesFromStack(stack)[0]);
  if (!fam) return want;
  const ws = FONT_CATALOG[fam].weights;
  if (ws.length === 0) return 400;
  const below = ws.filter((w) => w <= want);
  return below.length ? Math.max(...below) : Math.min(...ws);
}

// HSL shift of a palette color (hue in degrees, saturation / lightness in
// points): the deeper, more saturated end of the red gradient and the map
// legend tints are derived from the owner's accent this way, so a custom
// accent recolors them too.
function shiftHsl(color, dh = 0, ds = 0, dl = 0) {
  const c = hexToRgb(color);
  if (!c) return color;
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l0 = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s0 = 0;
  if (d > 0) {
    s0 = d / (1 - Math.abs(2 * l0 - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  // A near-gray accent keeps its grayness (no invented hue).
  const s = Math.max(0, Math.min(1, s0 + (s0 < 0.15 ? 0 : ds / 100)));
  const l = Math.max(0, Math.min(1, l0 + dl / 100));
  const hue = (((h + dh) % 360) + 360) % 360;
  const k = (1 - Math.abs(2 * l - 1)) * s;
  const x = k * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - k / 2;
  const [r1, g1, b1] = hue < 60 ? [k, x, 0] : hue < 120 ? [x, k, 0] : hue < 180 ? [0, k, x] : hue < 240 ? [0, x, k] : hue < 300 ? [x, 0, k] : [k, 0, x];
  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

// A chevron as a data-URI image in the given (palette) color, for the CSS
// carousel's scroll buttons (pseudo-elements can't hold inline SVG).
function chevronUri(d, color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='${d}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Map legend dots: hue shifts of the accent, each at least 3:1 against the
// panel. A near-gray accent has no hue to shift (shiftHsl keeps it gray),
// so its dots step in lightness between the panel and the text instead.
function legendColors(t, panel) {
  const c = hexToRgb(t.accent);
  const spread = c ? (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / 255 : 0;
  const base = spread < 0.15
    ? [1, 0.8, 0.62, 0.46].map((k) => mix(panel, t.text, k))
    : [shiftHsl(t.accent, 0, -13, -6), shiftHsl(t.accent, 37, 7, -7), shiftHsl(t.accent, 220, -2, -4), shiftHsl(t.accent, 141, -9, -21)];
  return base.map((col) => ensureContrast(col, panel, 3));
}

// Every color the template paints with, derived from the owner's palette.
// photoHero / photoCta: whether those bands sit on a photo (white-ish text
// over a dark scrim) or on the page.
function redlineTokens(t, { photoHero, photoCta }) {
  const soft = mix(t.bg, t.surface, 0.5);
  const scrim = t.isDark ? mix(t.bg, '#000000', 0.35) : mix(t.text, '#000000', 0.6);
  const glowEnd = shiftHsl(t.accent, -6, 10, -17);
  const glowShadow = shiftHsl(t.accent, -5, 5, -13);
  // Text on the dark accent reads like the reference (page ink on red) when
  // that passes 4.5:1; otherwise the kit's readable pick.
  const onAccent = contrastRatio(t.bg, t.accent) >= 4.5 ? t.bg : t.onAccent;
  const onPhoto = t.isDark ? t.text : '#ffffff';
  const onPhotoMuted = t.isDark ? t.textMuted : mix('#ffffff', scrim, 0.3);
  // The phone scrim fades into the page so the price card below reads as
  // part of the hero; on a light page it stays dark (white text above it).
  const fadeEnd = t.isDark ? t.bg : alpha(scrim, 0.9);
  const heroBg = photoHero ? scrim : t.bg;
  // Over a photo the real background is the translucent scrim with the
  // photo showing through, lighter than the solid scrim the tokens are
  // named after. Small text is repaired against the scrim over a mid-tone
  // photo pixel at the alpha behind the copy: about 25% photo on phones
  // (the vertical scrim's top), 10% at >= 1024px (the horizontal scrim's
  // dark left side). Large display text (the h1 accent) keeps the plain
  // scrim pairing. heroLit / ctaLit = the solid colors when there is no photo.
  const midPhoto = mix('#ffffff', '#000000', 0.5);
  const heroLit = photoHero ? mix(scrim, midPhoto, 0.25) : heroBg;
  const heroLitLg = photoHero ? mix(scrim, midPhoto, 0.1) : heroBg;
  const ctaLit = photoCta ? mix(scrim, midPhoto, 0.25) : scrim;
  const heroText = ensureContrast(ensureContrast(photoHero ? onPhoto : t.text, heroLit, 4.5), heroBg, 4.5);
  // A light palette's photo hero is dark: its pill glass and hairlines come
  // from the scrim and the hero ink, not from the (light) page tokens.
  const darkHeroOnLight = photoHero && !t.isDark;
  const card = t.surface;
  // Review cards sit on a 4% text tint over the page: stars and the active
  // dot keep the raw accent unless it fades into that (3:1 for marks).
  const revBg = mix(t.bg, t.text, 0.04);
  const mark = ensureContrast(t.accent, revBg, 3);
  // The price card's "Package" row: a 3% text tint over the card.
  const rowBg = mix(card, t.text, 0.03);
  // The h1 and CTA accent words are large text: 3:1 against the photo-lit
  // scrim, and 4.5:1 against the solid one (the token pairing).
  const heroAccent = ensureContrast(ensureContrast(photoHero ? t.accent : t.accentText, heroLit, 3), heroBg, 4.5);
  // Buttons whose accent fill nearly matches the page get a 1px ring in the
  // readable accent, so they still read as buttons (non-text 3:1).
  const ring = contrastRatio(t.accent, t.bg) < 3 ? `inset 0 0 0 1px ${t.accentText}` : '0 0 0 0 transparent';
  const legend = legendColors(t, soft);
  // Without a CTA photo the scrim lies over the plain surface: on a light
  // palette the translucent gradient turns muddy gray, so it goes near-solid.
  const ctaFlat = !photoCta && !t.isDark;
  const ctaV = ctaFlat
    ? `linear-gradient(180deg, ${alpha(scrim, 0.96)}, ${alpha(scrim, 0.92)})`
    : `linear-gradient(180deg, ${alpha(scrim, 0.72)}, ${alpha(scrim, 0.85)} 55%, ${fadeEnd})`;
  const ctaH = ctaFlat
    ? `linear-gradient(90deg, ${alpha(scrim, 0.96)}, ${alpha(scrim, 0.9)})`
    : `linear-gradient(90deg, ${alpha(scrim, 0.96)}, ${alpha(scrim, 0.76)} 53%, ${alpha(scrim, 0.45)})`;
  return {
    '--rl-bg': t.bg,
    '--rl-surface': t.surface,
    '--rl-text': t.text,
    '--rl-muted': t.textMuted,
    '--rl-accent': t.accent,
    '--rl-on-accent': onAccent,
    '--rl-accent-text': t.accentText,
    '--rl-accent-soft': alpha(t.accent, 0.5),
    '--rl-focus': t.accentText,
    '--rl-line': alpha(t.text, 0.12),
    '--rl-line-strong': mix(t.bg, t.text, 0.17),
    '--rl-dot-off': alpha(t.text, 0.25),
    '--rl-glass': alpha(t.surface, 0.7),
    '--rl-hero-glass': darkHeroOnLight ? alpha(scrim, 0.55) : alpha(t.surface, 0.7),
    '--rl-hero-line': alpha(heroText, darkHeroOnLight ? 0.22 : 0.12),
    '--rl-mark': mark,
    '--rl-ring': ring,
    '--rl-map-bg': mix(t.bg, t.text, 0.06),
    '--rl-grad': `linear-gradient(135deg, ${t.accent} 0%, ${glowEnd} 100%)`,
    '--rl-glow': `0 18px 45px -18px ${alpha(glowShadow, 0.45)}`,
    '--rl-scrim-v': `linear-gradient(180deg, ${alpha(scrim, 0.72)}, ${alpha(scrim, 0.85)} 55%, ${fadeEnd})`,
    '--rl-scrim-h': `linear-gradient(90deg, ${alpha(scrim, 0.96)}, ${alpha(scrim, 0.76)} 53%, ${alpha(scrim, 0.45)})`,
    // Light palette, photo hero, phones: the scrim fades into the page in
    // the hero's empty bottom padding (the copy ends 128px above the edge).
    ...(darkHeroOnLight ? { '--rl-scrim-v-lite': `linear-gradient(180deg, ${alpha(scrim, 0.72)}, ${alpha(scrim, 0.85)} 55%, ${alpha(scrim, 0.9)} calc(100% - 112px), ${t.bg})` } : {}),
    // Gallery tiles: the surface veil is solid at the side edges (where a
    // portrait photo leaves thin strips) and lets a little of the blurred
    // photo through across the middle (a landscape photo's letterbox).
    '--rl-shot-veil': `linear-gradient(90deg, ${t.surface}, ${alpha(t.surface, 0.72)} 14%, ${alpha(t.surface, 0.72)} 86%, ${t.surface})`,
    '--rl-cta-scrim-v': ctaV,
    '--rl-cta-scrim-h': ctaH,
    '--rl-chev-l': chevronUri(CHEVRON_LEFT, t.text),
    '--rl-chev-r': chevronUri(CHEVRON_RIGHT, t.text),
    '--rl-legend-1': legend[0],
    '--rl-legend-2': legend[1],
    '--rl-legend-3': legend[2],
    '--rl-legend-4': legend[3],
    // Scoped text pairs (theme:check contrast-checks each against its bg).
    '--rl-card-bg': card,
    '--rl-card-text': ensureContrast(t.text, card, 4.5),
    '--rl-card-muted': ensureContrast(t.textMuted, card, 4.5),
    '--rl-card-accent': ensureContrast(t.accentText, card, 4.5),
    '--rl-soft-bg': soft,
    '--rl-soft-text': ensureContrast(t.text, soft, 4.5),
    '--rl-soft-muted': ensureContrast(t.textMuted, soft, 4.5),
    '--rl-soft-accent': ensureContrast(t.accentText, soft, 4.5),
    '--rl-rev-bg': revBg,
    '--rl-rev-text': ensureContrast(t.text, revBg, 4.5),
    '--rl-rev-muted': ensureContrast(t.textMuted, revBg, 4.5),
    '--rl-row-bg': rowBg,
    '--rl-row-text': ensureContrast(t.text, rowBg, 4.5),
    '--rl-row-muted': ensureContrast(t.textMuted, rowBg, 4.5),
    '--rl-row-accent': ensureContrast(t.accentText, rowBg, 4.5),
    '--rl-hero-bg': heroBg,
    '--rl-hero-text': heroText,
    '--rl-hero-muted': ensureContrast(ensureContrast(photoHero ? onPhotoMuted : t.textMuted, heroLit, 4.5), heroBg, 4.5),
    '--rl-hero-accent': heroAccent,
    '--rl-hero-eyebrow': ensureContrast(heroAccent, heroLit, 4.5),
    '--rl-hero-eyebrow-lg': ensureContrast(heroAccent, heroLitLg, 4.5),
    '--rl-cta-bg': scrim,
    '--rl-cta-text': ensureContrast(ensureContrast(onPhoto, ctaLit, 4.5), scrim, 4.5),
    '--rl-cta-muted': ensureContrast(ensureContrast(onPhotoMuted, ctaLit, 4.5), scrim, 4.5),
    '--rl-cta-accent': ensureContrast(ensureContrast(t.accent, ctaLit, 3), scrim, 4.5),
    '--rl-footer-bg': t.bg,
    '--rl-footer-text': t.text,
    '--rl-footer-muted': t.textMuted,
  };
}

// Hours. Only the per-day editor's shape (exactly the keys Mon..Sun, ''
// meaning closed) may name a closed day; a per-day value that is not a time
// range prints as written ("By appointment" in the design's title case).
// Older free-text hours
// ("Mon-Fri 8am-6pm, Sat" or { 'Mon-Fri': '8am-6pm' }) are shown exactly as
// the owner wrote them, never expanded into days.
const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const DAY = '(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?';
const DAY_SPAN_RE = new RegExp(`^${DAY}(?:\\s*[-–]\\s*${DAY})?$`, 'i');
const isPerDay = (h) => h && typeof h === 'object' && !Array.isArray(h)
  && Object.keys(h).length === HOURS_DAYS.length && HOURS_DAYS.every((d) => d in h);

// -> { rows: [{ day, time }], summary: [line], text: '' } (text = free text)
function hoursOf(hours) {
  const empty = { rows: [], summary: [], text: '' };
  if (!hours) return empty;
  if (isPerDay(hours)) {
    const vals = HOURS_DAYS.map((d) => txt(hours[d]));
    if (!vals.some(Boolean)) return empty;
    // A by-appointment day reads like the design's other labels.
    const show = (v) => (!v ? 'Closed' : isByAppointment(v) ? 'By Appointment' : formatTimeRange(v));
    const rows = HOURS_DAYS.map((d, i) => ({ day: DAY_NAMES[d], time: show(vals[i]) }));
    const summary = [];
    for (let i = 0; i < HOURS_DAYS.length;) {
      let j = i;
      while (j + 1 < HOURS_DAYS.length && vals[j + 1] === vals[i]) j++;
      summary.push(`${i === j ? HOURS_DAYS[i] : `${HOURS_DAYS[i]}–${HOURS_DAYS[j]}`}: ${show(vals[i])}`);
      i = j + 1;
    }
    return { rows, summary, text: '' };
  }
  if (typeof hours === 'object' && !Array.isArray(hours)) {
    const keys = Object.keys(hours);
    if (keys.length > 0 && keys.every((k) => DAY_SPAN_RE.test(k.trim()) && txt(hours[k]))) {
      const rows = keys.map((k) => ({ day: k.trim(), time: txt(hours[k]) }));
      return { rows, summary: rows.map((r) => `${r.day}: ${r.time}`), text: '' };
    }
  }
  const flat = formatHours(hours).trim();
  return flat ? { rows: [], summary: [flat], text: flat } : empty;
}

// Heading text with its accent phrase wrapped in <span class="rl-em">.
function Accented({ title, accent }) {
  const parts = splitAccent(title, accent);
  if (!parts) return title;
  return (
    <>
      {parts.before}
      <span className="rl-em">{parts.match}</span>
      {parts.after}
    </>
  );
}

function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="rl-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

export default function MobileRedline({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const font = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const kind = businessKindOf(biz.businessType);
  const fb = getFallbacks(kind);
  const isMobile = kind === 'mobile_detailing';
  const isDetail = /detail/.test(kind);
  const titles = copy.sectionTitles;

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrder(copy, sections.map((s) => s.id));

  // ── Business facts ────────────────────────────────────────────────
  const name = txt(biz.businessName);
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const phoneLabel = phoneDisplay(phone);
  const city = txt(biz.city);
  const state = txt(biz.state);
  const place = [city, state].filter(Boolean).join(', ');
  const email = txt(biz.email);
  const insured = biz.insured === true;
  const areas = serviceAreasOf(biz);
  const hours = hoursOf(biz.hours);
  const awards = list(biz.awards).map((a) => txt(a && typeof a === 'object' ? a.name : a)).filter(Boolean);
  const rating = googleRatingOf(biz.googlePlace);
  const placeUrl = googlePlaceUrl(biz.googlePlace);
  const badgeAt = googleBadgePlacements(copy.googleBadge, ['hero', 'footer']);
  const badgeIn = (spot) => Boolean(rating) && badgeAt.includes(spot);

  // Wordmark: the business name, with a trailing business-type descriptor
  // on the small second line (shortNameOf).
  const tagline = txt(fb.navSubtitle);
  const shortName = shortNameOf(name, tagline);
  // The design's heading defaults (shared with Edit > Headings).
  const hd = headingDefaults(biz, copy);

  // ── Services: the owner's packages win over the AI list ───────────
  const aiItems = list(copy.servicesSection?.items).map((s) => (typeof s === 'string' ? { name: s } : s || {}));
  const aiDesc = new Map(aiItems.filter((s) => txt(s.name) && txt(s.description)).map((s) => [nameKey(s.name), txt(s.description)]));
  const fromPackages = list(biz.packages).length > 0;
  const services = (fromPackages ? biz.packages : aiItems)
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => {
      const description = txt(s.description) || (fromPackages ? aiDesc.get(nameKey(s.name)) || '' : '');
      const own = serviceIncludes(s.includes);
      const bullets = own.length ? null : bulletItems(description);
      return {
        name: txt(s.name),
        price: txt(s.price),
        description: bullets ? '' : description,
        summary: txt(s.summary),
        includes: own.length ? own : (bullets || []).map((text) => ({ text, heading: false, highlight: false })),
        badge: txt(s.badge),
        image: txt(s.image),
      };
    })
    .filter((s) => s.name || s.description || s.price);
  // The hero card (Edit > Hero > Services in the hero): 'quote' is the
  // price card (the default), 'list' a plain list of packages, 'off' none.
  const heroCard = ['quote', 'list', 'off'].includes(copy.heroCard) ? copy.heroCard : 'quote';
  // Its packages: the owner's picks (copy.heroServices, up to four, matched
  // by name to the package list, so a renamed or deleted package simply
  // drops out), else the first three named packages whose price holds a
  // number.
  const ownPicks = [];
  for (const n of list(copy.heroServices)) {
    const key = nameKey(n);
    const s = key ? services.find((x) => nameKey(x.name) === key) : null;
    if (s && !ownPicks.includes(s)) ownPicks.push(s);
    if (ownPicks.length === 4) break;
  }
  const priced = (s) => /\d/.test(s.price);
  // The list card can show unpriced packages, so without a priced one it
  // lists the first three named ones (heroServices.js defaultHeroPicks).
  const autoPicks = services.filter((s) => s.name && priced(s)).slice(0, 3);
  const heroPicks = ownPicks.length ? ownPicks
    : autoPicks.length || heroCard !== 'list' ? autoPicks : services.filter((s) => s.name).slice(0, 3);
  // The price card is about prices: it offers only picks whose price holds
  // a number ("Call for quote" stays on its package card). None priced -> no
  // card (the hero keeps its buttons at every width), so "Your Price" never
  // shows without a price. The list card shows any named pick, its price
  // only when set.
  const picks = heroCard === 'quote' ? heroPicks.filter(priced).slice(0, 4) : [];
  const listPicks = heroCard === 'list' ? heroPicks.filter((s) => s.name).slice(0, 4) : [];
  const hasCard = picks.length > 0 || listPicks.length > 0;
  const anyServicePhoto = services.some((s) => s.image);
  const svcTitles = sectionTitle(titles, 'services');
  const servicesTitle = txt(copy.servicesSection?.title) || svcTitles.title || hd.services.title;
  const servicesAccent = svcTitles.accent || hd.services.accent;
  const servicesIntro = txt(copy.servicesSection?.intro) || svcTitles.intro;

  // ── Featured service (a ceramic-coating style spotlight) ──────────
  const fs = copy.featuredService && typeof copy.featuredService === 'object' ? copy.featuredService : {};
  const fsName = txt(fs.serviceName);
  const fsMatch = fsName
    ? services.find((s) => nameKey(s.name) === nameKey(fsName))
    : services.find((s) => /ceramic|coating/i.test(s.name));
  const featured = fsName || fsMatch ? (() => {
    const fName = fsName || fsMatch.name;
    const ownBullets = list(fs.bullets).map(txt).filter(Boolean);
    const bullets = ownBullets.length
      ? ownBullets
      : (fsMatch?.includes || []).filter((i) => !i.heading).map((i) => i.text);
    const ft = sectionTitle(titles, 'featured');
    // Without bullets the matched service's own summary / description
    // says what it is (an AI service item often has nothing else).
    const intro = ft.intro || (bullets.length ? '' : fsMatch?.summary || fsMatch?.description || '');
    const title = ft.title || hd.featured.title;
    return {
      name: fName,
      priceFrom: txt(fs.priceFrom),
      price: fsMatch?.price || '',
      bullets,
      eyebrow: ft.eyebrow,
      title,
      accent: ft.accent || hd.featured.accent,
      intro,
      buttonText: txt(fs.buttonText) || `Book ${fName}`,
      buttonUrl: txt(fs.buttonUrl),
    };
  })() : null;
  // A band with only a heading and a button repeats the package grid: the
  // published page skips it (the editor keeps it, with a hint).
  const featuredBody = Boolean(featured) && Boolean(images.featured || featured.priceFrom || featured.price || featured.bullets.length || featured.intro);

  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);

  const quotes = list(copy.testimonialPlaceholders)
    .map((q) => ({
      text: quoteText(q),
      name: txt(q?.name),
      meta: txt(q?.vehicle) || txt(q?.role),
      google: q?.source === 'google',
      stars: q?.source === 'google' && num(q?.rating) >= 1 && num(q?.rating) <= 5 ? num(q?.rating) : 0,
    }))
    .filter((q) => q.text);
  // A connected review widget shows only when the owner picks it (Edit >
  // Reviews > Review Source): App adds the owner's widget key to every site,
  // and this design's own quote cards are the default.
  const reviews = copy.googleWidgetKey && copy.reviewMode === 'google' ? 'google' : quotes.length > 0 ? 'quotes' : null;
  // "Google Reviews" wording and the Google link belong to quotes the owner
  // marked as Google reviews; AI-written quotes stay plain testimonials even
  // when the site has a connected Google place.
  const googleQuotes = quotes.some((q) => q.google);
  const allGoogle = googleQuotes && quotes.every((q) => q.google);

  const aboutParas = txt(copy.aboutText).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const aboutStats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label)
    .slice(0, 3);
  const statsLayout = copy.aboutLayout === 'stats' && aboutStats.length > 0;
  const hasAbout = aboutParas.length > 0 || Boolean(images.about) || aboutStats.length > 0;
  const hasLocations = areas.length > 0 || hours.rows.length > 0 || Boolean(hours.text) || Boolean(place);

  // What renders, for the menu, the footer links and section spacing.
  const rendered = {
    hero: show('hero'),
    about: show('about') && (hasAbout || editor),
    gallery: show('gallery') && (galleryImages.length > 0 || editor),
    brands: show('brands'),
    services: show('services') && (services.length > 0 || editor),
    featured: show('featured') && (featuredBody || editor),
    testimonials: show('testimonials') && (Boolean(reviews) || editor),
    awards: show('awards') && (awards.length > 0 || editor),
    locations: show('locations') && (hasLocations || editor),
    cta: show('cta'),
  };
  const visible = sections.map((s) => s.id).filter((id) => rendered[id]).sort((a, b) => order(a) - order(b));
  // Where booking links go when the booking widget is off: the phone, else
  // the contact band, else an email, else the top of the page (never a
  // hidden #contact). They keep data-scheduler-trigger, so with booking on
  // they open the widget wherever their href points.
  const mailHref = email ? `mailto:${email}` : null;
  const contactHref = rendered.cta ? '#contact' : tel || mailHref || '#top';
  const bookHref = tel || contactHref;
  // The gallery's heading sits right under the About block (whose bottom
  // padding already spaces it) only when About directly precedes it.
  const galleryFlush = visible[visible.indexOf('gallery') - 1] === 'about';

  const navLinks = [
    { href: '#top', label: 'Home' },
    rendered.services && services.length > 0 && { href: '#services', label: isDetail ? 'Detailing Packages' : 'Our Packages' },
    rendered.featured && featuredBody && { href: '#featured', label: featured.name },
    rendered.testimonials && reviews && { href: '#reviews', label: 'Reviews' },
    rendered.locations && hasLocations && { href: '#locations', label: 'Service Area' },
  ].filter(Boolean);
  // A sparse site's menu would hold little more than "Home": give it the
  // contact band too (the full menu keeps the reference's five links).
  if (navLinks.length < 3 && rendered.cta) navLinks.push({ href: '#contact', label: 'Contact' });
  const exploreLinks = [
    rendered.services && services.length > 0 && { href: '#services', label: 'Our Services' },
    rendered.testimonials && reviews && { href: '#reviews', label: 'Reviews Section' },
    rendered.gallery && galleryImages.length > 0 && { href: '#gallery', label: 'Image Gallery' },
    rendered.cta && { href: '#contact', label: 'Request Appointment', book: true },
    rendered.locations && hasLocations && { href: '#locations', label: 'Locations & Hours' },
  ].filter(Boolean);

  const vars = {
    ...redlineTokens(t, { photoHero: Boolean(images.hero), photoCta: Boolean(images.cta) }),
    '--rl-head': font,
    '--rl-head-w': loadedWeight(font, 800),
    '--rl-head-w2': loadedWeight(font, 600),
  };
  const kitColors = { bg: t.bg, text: t.text, accent: t.accent, onAccent: vars['--rl-on-accent'] };
  // Google's star gold on the page-colored pills (and the hero pill without
  // a photo), darkened on a light page so the stars stay visible (3:1 for
  // marks). The pill's .9em stars .1em apart match the reference's star
  // glyphs (about 10px of ink, 2px apart at 12px, the same 58px row).
  const pageStar = ensureContrast(GOOGLE_STAR_GOLD, t.bg, 3);

  // The logo's max width lives in CSS (.rl-logo img), so phones can cap a
  // wide wordmark-shaped logo.
  const logo = (h) => images.logo && (
    <span className="rl-logo">
      <PhotoSlot src={images.logo} alt={name ? `${name} logo` : 'Logo'} loading="eager" style={{ height: h, width: 'auto' }} imgStyle={{ objectFit: 'contain' }} />
    </span>
  );

  // ── Hero parts ─────────────────────────────────────────────────────
  const heroTitles = sectionTitle(titles, 'hero');
  const headline = txt(copy.headline) || name;
  const heroEyebrow = heroTitles.eyebrow || hd.hero.eyebrow;
  // Hero chips: the owner's Trust Bar items (Edit > Trust Bar) when there
  // are any, else only facts: "We Come to You" for a mobile business,
  // "Fully Insured" when Business Info says insured.
  const ownChips = trustItems(copy.trustBar).slice(0, 4).map((it) => ({
    icon: TRUST_ICONS[it.emoji] || (it.emoji && !it.emoji.startsWith('icon:') ? null : 'check'),
    emoji: it.emoji && !it.emoji.startsWith('icon:') ? it.emoji : '',
    label: it.sub ? `${it.label} · ${it.sub}` : it.label,
  }));
  const chips = ownChips.length > 0 ? ownChips : [
    isMobile && { icon: 'pin', label: 'We Come to You' },
    insured && { icon: 'shield', label: 'Fully Insured' },
  ].filter(Boolean);
  // Hero buttons. The editor's Button URLs win; otherwise the label's
  // wording decides (every generated site has labels: normalizeCopy's
  // "Contact Us" / "View Services" or the AI's own), pointing only at blocks
  // that render; a label that names nothing keeps the template default
  // (Button 1: the packages; Button 2: the phone, per the editor's "default:
  // calls phone", or the price card).
  const svcLink = rendered.services && services.length > 0;
  const anchors = {
    tel,
    quote: hasCard ? '#quote' : null,
    contact: rendered.cta ? '#contact' : tel || mailHref,
    services: svcLink ? '#services' : null,
    gallery: rendered.gallery && galleryImages.length > 0 ? '#gallery' : null,
    reviews: rendered.testimonials && reviews ? '#reviews' : null,
    areas: rendered.locations && hasLocations ? '#locations' : null,
  };
  // An owner URL to a block of this page ("#quote" copied from an old
  // site) counts only while that block renders; otherwise the button's
  // wording decides, as without a URL (no dead in-page link).
  const pageIds = new Set(['top', 'main', 'home', ...Object.keys(anchors).map((k) => anchors[k]).filter((h) => h && h.startsWith('#')).map((h) => h.slice(1)),
    rendered.about && 'about', rendered.brands && 'makes', rendered.featured && featuredBody && 'featured', rendered.awards && awards.length > 0 && 'awards'].filter(Boolean));
  const ownUrl = (v) => {
    const u = txt(v);
    return u.startsWith('#') && u.length > 1 && !pageIds.has(u.slice(1)) ? '' : u;
  };
  const heroPrimaryUrl = ownUrl(copy.ctaPrimaryUrl);
  const heroSecondaryUrl = ownUrl(copy.ctaSecondaryUrl);
  const heroPrimaryLabel = txt(copy.ctaPrimary) || (svcLink ? 'View Packages' : 'Contact Us');
  const heroPrimaryHref = heroPrimaryUrl || intentHref(heroPrimaryLabel, anchors, anchors.services || anchors.contact);
  // "Get a Quote" only offers the price card; next to the price list (or no
  // card) Button 2 calls.
  const heroSecondaryLabel = txt(copy.ctaSecondary) || (picks.length > 0 ? 'Get a Quote' : phone ? `Call ${phoneLabel}` : '');
  const heroSecondaryHref = heroSecondaryUrl || intentHref(heroSecondaryLabel, anchors, tel || anchors.quote || anchors.contact);
  // A booking-worded button without its own URL also opens the booking
  // widget when the owner has it on.
  const heroPrimaryBooks = !heroPrimaryUrl && bookingWorded(heroPrimaryLabel);
  const heroSecondaryBooks = !heroSecondaryUrl && bookingWorded(heroSecondaryLabel);
  // Next to the price card the desktop hero drops its buttons (as the
  // reference does), unless the owner pointed one at another page.
  const offPage = (u) => Boolean(u) && !u.startsWith('#');
  const keepHeroBtns = offPage(heroPrimaryUrl) || offPage(heroSecondaryUrl);
  // Long AI headlines (60-100+ characters) step the type down a size or two.
  const h1Size = headline.length > 100 ? ' rl-h1-xl' : headline.length > 60 ? ' rl-h1-l' : '';

  // ── Section headings ───────────────────────────────────────────────
  // Defaults (headingDefaults): the business name in About while it is
  // short, "N Google Reviews" only over quotes that are all Google reviews
  // (a mix keeps the neutral heading; each Google card is labeled), and no
  // "Free Quote" offer in the contact band.
  const aboutT = sectionTitle(titles, 'about');
  const aboutTitle = aboutT.title || hd.about.title;
  const aboutAccent = aboutT.accent || hd.about.accent;
  const galT = sectionTitle(titles, 'gallery');
  const galTitle = galT.title || hd.gallery.title;
  const galAccent = galT.accent || hd.gallery.accent;
  const makesEyebrow = sectionTitle(titles, 'brands').eyebrow || hd.brands.eyebrow;
  const revT = sectionTitle(titles, 'testimonials');
  const revTitle = revT.title || hd.testimonials.title;
  const revAccent = revT.accent || hd.testimonials.accent;
  const locT = sectionTitle(titles, 'locations');
  const locTitle = locT.title || hd.locations.title;
  const locAccent = locT.accent || hd.locations.accent;
  const ctaT = sectionTitle(titles, 'cta');
  const ctaTitle = txt(copy.ctaHeadline) || ctaT.title || hd.cta.title;
  const ctaAccent = ctaT.accent || hd.cta.accent;
  const ctaSub = txt(copy.ctaSubtext) || ctaT.intro;
  const ctaCallLabel = txt(copy.ctaSecondaryText) || (phone ? `Call ${phoneLabel}` : '');
  // Hero Button 2's URL doubles as this button's link only when the owner
  // also named this button (as DetailingSporty's contact buttons do).
  const ctaCallHref = (txt(copy.ctaSecondaryText) && txt(copy.ctaSecondaryUrl)) || tel;
  const ctaBookLabel = txt(copy.ctaButtonText) || 'Book Now';
  const ctaBookHref = txt(copy.ctaUrl) || '#contact';

  const mapQuery = place || txt(biz.serviceArea);
  const bottomLine = [place, isMobile && 'Fully Mobile', insured && 'Insured'].filter(Boolean).join(' · ');
  const socials = [
    !images.hideInstagram && txt(biz.instagram) && { icon: 'instagram', href: socialUrl('instagram', txt(biz.instagram)), label: txt(biz.instagram).startsWith('http') ? 'Instagram' : `@${txt(biz.instagram).replace(/^@/, '')}` },
    !images.hideFacebook && txt(biz.facebook) && { icon: 'facebook', href: socialUrl('facebook', txt(biz.facebook)), label: 'Facebook' },
    !images.hideTiktok && txt(biz.tiktok) && { icon: 'tiktok', href: socialUrl('tiktok', txt(biz.tiktok)), label: 'TikTok' },
  ].filter((s) => s && s.href);
  // Footer (Edit > Footer): the owner's columns in the owner's order, or the
  // design's own brand / Explore / Service Areas / Get In Touch + Hours.
  // A column with nothing to list is left out.
  const footer = copy.footer && typeof copy.footer === 'object' && !Array.isArray(copy.footer) ? copy.footer : null;
  const footShown = footerColumnsOf(copy.footer).filter((c) => c.show);
  // Hours right after the contact column (hidden columns don't count) print
  // under the contact list, as the design's footer does; anywhere else they
  // are a column of their own.
  const hoursMerged = footShown.some((c, i) => c.type === 'contact' && footShown[i + 1]?.type === 'hours');
  const footHoursTitle = footShown.find((c) => c.type === 'hours')?.title || 'Hours';
  // The contact column's button: the owner's own link (no booking widget),
  // else the contact band with the widget, only while the band renders.
  const footCtaUrl = txt(footer?.ctaUrl);
  const footCta = footer?.showCta !== false && (footCtaUrl || rendered.cta)
    ? { href: footCtaUrl || '#contact', label: txt(footer?.ctaText) || 'Request Appointment', books: !footCtaUrl }
    : null;
  const contactItems = Boolean(tel || email || socials.length || place);
  const footHasHours = hours.summary.length > 0;
  const footCells = footShown.filter((c) => {
    if (c.type === 'brand') return Boolean(images.logo || shortName || txt(copy.footerTagline) || badgeIn('footer'));
    if (c.type === 'links') return exploreLinks.length > 0;
    if (c.type === 'areas') return areas.length > 0;
    if (c.type === 'contact') return contactItems || footCta || (hoursMerged && footHasHours);
    return !hoursMerged && footHasHours;
  });
  const bottomText = txt(footer?.bottomText) || bottomLine;
  // The footer rating sits in the logo column; with that column hidden it
  // moves to the bottom line, so Edit > Google Rating > Footer still works.
  const footBarBadge = badgeIn('footer') && !footCells.some((c) => c.type === 'brand');
  const makes = vehicleMakesFor(copy.vehicleMakes);
  // A short owner list is repeated inside each marquee copy so the moving
  // row always spans the band (repeats are .rl-mq-rep: hidden without motion).
  const makesReps = Math.max(1, Math.ceil(16 / Math.max(1, makes.length)));

  return (
    <div
      id="top"
      className="rl-root"
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.5 }}
    >
      <style>{CSS}</style>
      <a className="rl-skip" href="#main">Skip to content</a>

      <nav className={`rl-nav${images.logo && shortName.length > 12 ? ' rl-nav-tight' : ''}`} aria-label="Main" style={{ order: -1 }}>
        <div className="rl-wrap rl-nav-in">
          <a className="rl-brand" href="#top" aria-label={name ? `${name}, home` : 'Home'}>
            {logo(40)}
            {(shortName || tagline) && (
              <span className="rl-word">
                {shortName && <span className={`rl-word-1${shortName.length > 12 ? ' rl-word-l' : ''}`}>{shortName}</span>}
                {tagline && <span className="rl-word-2">{tagline}</span>}
              </span>
            )}
          </a>
          <div className="rl-nav-act">
            {badgeIn('nav') && <span className="rl-nav-g"><GoogleRatingBadge place={biz.googlePlace} variant="inline" starColor={t.accent} starSize={14} /></span>}
            {tel && (
              <a className="rl-call" href={tel} aria-label={`Call now, ${phoneLabel}`}>
                <Icon name="phone" />
                <span className="rl-call-short">Call Now</span>
                <span className="rl-call-long">{phoneLabel}</span>
              </a>
            )}
            <MobileMenu links={navLinks} colors={kitColors} font={body} />
          </div>
        </div>
      </nav>

      <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
        {!show('hero') && <h1 className="rl-sr">{headline}</h1>}

        {show('hero') && (
          <header id="home" data-section="hero" className={`rl-hero${hasCard ? ' rl-has-card' : ''}${heroCard === 'off' ? ' rl-card-off' : ''}${images.hero ? ' rl-has-photo' : ''}${images.hero && !t.isDark ? ' rl-lite' : ''}`} style={{ order: order('hero') }}>
            <div className="rl-wrap">
              <div className="rl-hero-grid">
                <div className="rl-hero-copy">
                  {images.hero && (
                    <div className="rl-hero-media" aria-hidden="true">
                      <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
                      <div className="rl-scrim" />
                    </div>
                  )}
                  <div className="rl-hero-body">
                    {badgeIn('hero') && <GoogleRatingBadge place={biz.googlePlace} className="rl-pill" style={{ gap: 8 }} starSize=".9em" starGap=".1em" starColor={images.hero ? GOOGLE_STAR_GOLD : pageStar} />}
                    {heroEyebrow && <p className="rl-hero-eyebrow">{heroEyebrow}</p>}
                    <h1 className={`rl-h1${h1Size}`}><Accented title={headline} accent={heroTitles.accent} /></h1>
                    {txt(copy.subheadline) && <p className="rl-hero-sub">{txt(copy.subheadline)}</p>}
                    {chips.length > 0 && (
                      <ul className="rl-chips">
                        {chips.map((c, i) => (
                          <li key={`${c.label}-${i}`}>
                            {c.icon ? <Icon name={c.icon} /> : <span className="rl-chip-emoji" aria-hidden="true">{c.emoji}</span>}
                            {c.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className={`rl-hero-btns${keepHeroBtns ? ' rl-btns-keep' : ''}`}>
                      {heroPrimaryHref && (
                        <a className="rl-btn" href={heroPrimaryHref} {...(heroPrimaryBooks ? { 'data-scheduler-trigger': '' } : {})}>
                          {heroPrimaryHref.startsWith('tel:') && <Icon name="phone" />}{heroPrimaryLabel}{!heroPrimaryHref.startsWith('tel:') && <Icon name="arrowRight" />}
                        </a>
                      )}
                      {heroSecondaryHref && heroSecondaryLabel && (
                        <a className="rl-btn rl-btn-line" href={heroSecondaryHref} {...(heroSecondaryBooks ? { 'data-scheduler-trigger': '' } : {})}>
                          {heroSecondaryHref.startsWith('tel:') && <Icon name="phone" />}{heroSecondaryLabel}{!heroSecondaryHref.startsWith('tel:') && <Icon name="arrowUpRight" />}
                        </a>
                      )}
                    </div>
                    {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
                    {/* Picked or not, no package has a price: say why there is no card. */}
                    {heroCard === 'quote' && picks.length === 0 && services.some((s) => s.name) && (
                      <EditorHint>Your price card needs services with a price (Edit &gt; Services).</EditorHint>
                    )}
                  </div>
                </div>

                {picks.length > 0 && (
                  <div className="rl-quote-slot">
                    {/* CSS-only steps. Package radios (name rl-pkg) sit right
                        before their labels for the selected look; the
                        "Get My Price" checkbox (.rl-go) sits between the two
                        steps so its ~ rule can show step 2, and :has() hides
                        step 1 and swaps in the picked package's price and
                        Book link. defaultChecked is never set: nothing is
                        picked until the visitor picks. Step 3 is the booking
                        widget the Book link opens (data-scheduler-trigger). */}
                    <div className="rl-quote" id="quote">
                      <div className="rl-steps" aria-hidden="true">
                        <span className="rl-dot rl-d1"><b>1</b><Icon name="check" /></span><i />
                        <span className="rl-dot rl-d2"><b>2</b></span><i />
                        <span className="rl-dot rl-d3"><b>3</b></span>
                      </div>
                      <fieldset className="rl-s1">
                        <legend className="rl-sr">Choose a package</legend>
                        <p className="rl-step-l" aria-hidden="true">Step 1 of 3</p>
                        <h2 className="rl-q-h">What Package Do You Need?</h2>
                        <p className="rl-q-p">{isDetail ? 'Choose the detail package that fits your ride.' : 'Choose the package that fits your ride.'}</p>
                        <div className="rl-opts">
                          {picks.map((s, i) => (
                            <div key={`${s.name}-${i}`}>
                              <input type="radio" name="rl-pkg" id={`rl-pkg-${i}`} className="rl-sr rl-radio" value={s.name} />
                              <label htmlFor={`rl-pkg-${i}`} className={`rl-opt${optPriceLong(s.price) ? ' rl-opt-l' : ''}`}>
                                <span className="rl-opt-ico" aria-hidden="true"><Icon name={PICK_ICONS[i]} size={20} /></span>
                                <span className="rl-opt-txt">
                                  <span className="rl-opt-name">{s.name}</span>
                                  {s.summary && <span className="rl-opt-sum">{s.summary}</span>}
                                </span>
                                {s.price && <span className={`rl-opt-price${optPriceLong(s.price) ? ' rl-opt-price-t' : ''}`}>{s.price}</span>}
                              </label>
                            </div>
                          ))}
                        </div>
                        <label htmlFor="rl-go" className="rl-q-cta rl-go-l">Get My Price<Icon name="arrowRight" size={20} /></label>
                      </fieldset>
                      <input type="checkbox" id="rl-go" className="rl-sr rl-go" aria-label="Get my price" />
                      <div className="rl-s2" aria-live="polite">
                        <p className="rl-step-l" aria-hidden="true">Step 2 of 3</p>
                        <h2 className="rl-q-title">Your <span>Price</span></h2>
                        <div className="rl-res-set">
                          <div className="rl-res rl-any">
                            <p className="rl-q-p">Pick a package to see its price.</p>
                          </div>
                          {picks.map((s, i) => (
                            <div key={`${s.name}-${i}`} className={`rl-res rl-pk-${i}`}>
                              <div className="rl-row">
                                <span className="rl-row-l">Package</span>
                                <span className="rl-row-v">{s.name}{s.price && <> <span>{s.price}</span></>}</span>
                              </div>
                              {s.summary && <p className="rl-q-p">{s.summary}</p>}
                            </div>
                          ))}
                        </div>
                        <div className="rl-q-acts">
                          <label htmlFor="rl-go" className="rl-back rl-go-l"><Icon name="arrowLeft" size={20} />Back</label>
                          <a className="rl-q-book rl-any" href={bookHref} data-scheduler-trigger="">Book Now<Icon name="arrowRight" size={20} /></a>
                          {picks.map((s, i) => (
                            <a key={`${s.name}-${i}`} className={`rl-q-book rl-pk-${i}`} href={bookHref} data-scheduler-trigger="" data-scheduler-service={s.name}>
                              Book Now<Icon name="arrowRight" size={20} />
                            </a>
                          ))}
                        </div>
                        {tel && <a className="rl-q-call" href={tel}><Icon name="phone" />Call {phoneLabel}</a>}
                      </div>
                    </div>
                  </div>
                )}

                {listPicks.length > 0 && (
                  <div className="rl-quote-slot">
                    {/* The list card sits where the price card would (#quote,
                        so "Get a Quote" wording still lands on it). Rows are
                        not choices: no inputs, no steps. */}
                    <div className="rl-quote rl-hlist" id="quote">
                      <h2 className="rl-q-h">{isDetail ? 'Our Detail Packages' : 'Our Packages'}</h2>
                      <ul className="rl-hl">
                        {listPicks.map((s, i) => (
                          <li key={`${s.name}-${i}`} className={s.price && optPriceLong(s.price) ? 'rl-opt-l' : undefined}>
                            <span className="rl-opt-ico" aria-hidden="true"><Icon name={PICK_ICONS[i]} size={20} /></span>
                            <span className="rl-opt-txt">
                              <span className="rl-opt-name">{s.name}</span>
                              {s.summary && <span className="rl-opt-sum">{s.summary}</span>}
                            </span>
                            {s.price && <span className={`rl-opt-price${optPriceLong(s.price) ? ' rl-opt-price-t' : ''}`}>{s.price}</span>}
                          </li>
                        ))}
                      </ul>
                      {svcLink ? (
                        <a className="rl-hl-cta" href="#services">See All Packages<Icon name="arrowRight" size={20} /></a>
                      ) : (
                        <a className="rl-hl-cta" href={bookHref} data-scheduler-trigger="">Book Now<Icon name="arrowRight" size={20} /></a>
                      )}
                      {tel && <a className="rl-q-call" href={tel}><Icon name="phone" />Call {phoneLabel}</a>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {rendered.about && (
          <section data-section="about" id="about" className="rl-sec rl-about" style={{ order: order('about') }}>
            <div className={`rl-in rl-about-grid${images.about || statsLayout || editor ? ' rl-duo' : ''}`}>
              {statsLayout ? (
                <dl className="rl-statbox">
                  {aboutStats.map((s) => (
                    <div key={s.label}><dt className="rl-sr">{s.label}</dt><dd className="rl-stat-v">{s.value}</dd><dd className="rl-stat-l" aria-hidden="true">{s.label}</dd></div>
                  ))}
                </dl>
              ) : (images.about || editor) && (
                <div className="rl-about-photo">
                  <PhotoSlot src={images.about} slot="about" alt={name ? `${name} at work` : 'Our work'} style={{ position: 'absolute', inset: 0 }} />
                </div>
              )}
              <div>
                <h2 className="rl-h2 rl-about-h"><Accented title={aboutTitle} accent={aboutAccent} /></h2>
                {badgeIn('about') && <div className="rl-about-badge"><GoogleRatingBadge place={biz.googlePlace} className="rl-pill rl-pill-page" style={{ gap: 8 }} starSize=".9em" starGap=".1em" starColor={pageStar} /></div>}
                {aboutParas.map((p, i) => <p key={i} className="rl-about-p">{p}</p>)}
                {!statsLayout && aboutStats.length > 0 && (
                  <dl className="rl-stats" style={{ '--rl-n': aboutStats.length }}>
                    {aboutStats.map((s) => (
                      <div key={s.label}><dt className="rl-sr">{s.label}</dt><dd className="rl-stat-v">{s.value}</dd><dd className="rl-stat-l" aria-hidden="true">{s.label}</dd></div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </section>
        )}

        {rendered.gallery && (
          <section data-section="gallery" id="gallery" className={`rl-sec rl-gal-sec${galleryFlush ? ' rl-flush' : ''}`} style={{ order: order('gallery') }}>
            <div className="rl-in">
              <h2 className="rl-h2 rl-gal-h rl-c"><Accented title={galTitle} accent={galAccent} /></h2>
              {galleryImages.length === 0 ? (
                <div style={{ marginTop: 36 }}><PhotoSlot slot="gallery" style={{ minHeight: 220 }} /></div>
              ) : (
                <div className="rl-gal">
                  {/* Each tile shows the whole photo (contain, as the
                      reference does); a blurred, dimmed copy of the same
                      file (one download, also lazy) fills any letterbox a
                      landscape photo leaves in the 4:5 tile. */}
                  {galleryImages.map((src, i) => (
                    <figure key={i} className="rl-shot">
                      <img className="rl-shot-bg" src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                      <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={{ height: 'auto' }} imgStyle={{ objectFit: 'contain' }} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {rendered.brands && (
          <section data-section="brands" id="makes" className="rl-makes" aria-label="Vehicle makes" tabIndex={0} style={{ order: order('brands') }}>
            <p className="rl-makes-eye">{makesEyebrow}</p>
            {/* Each logo's path is written once, as a <symbol>; both copies of
                the scrolling row point at it with <use>. */}
            <svg className="rl-sprite" aria-hidden="true" focusable="false">
              <defs>
                {makes.filter((m) => m.d).map((m) => (
                  <symbol key={m.id} id={`rl-mk-${m.id}`} viewBox="0 0 24 24"><path d={m.d} /></symbol>
                ))}
              </defs>
            </svg>
            <div className="rl-mq">
              <div className="rl-mq-track">
                {[0, 1].map((copyIdx) => (
                  <ul key={copyIdx} className="rl-mq-set" {...(copyIdx ? { 'aria-hidden': 'true' } : {})}>
                    {Array.from({ length: makesReps }, (_, rep) => makes.map((m) => (
                      <li key={`${m.id}-${rep}`} className={`rl-mq-item${rep ? ' rl-mq-rep' : ''}`} {...(rep && !copyIdx ? { 'aria-hidden': 'true' } : {})}>
                        {m.d ? (
                          <>
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href={`#rl-mk-${m.id}`} /></svg>
                            <span className="rl-mq-l">{m.name}</span>
                          </>
                        ) : (
                          <span className="rl-mq-t">{m.name}</span>
                        )}
                      </li>
                    )))}
                  </ul>
                ))}
              </div>
            </div>
          </section>
        )}

        {rendered.services && (
          <section data-section="services" id="services" className="rl-sec" style={{ order: order('services') }}>
            <ServiceCardCss />
            <div className="rl-in">
              <div className="rl-c">
                <p className="rl-eyebrow">{svcTitles.eyebrow || 'Service Menu'}</p>
                <h2 className="rl-h2 rl-svc-h"><Accented title={servicesTitle} accent={servicesAccent} /></h2>
                {servicesIntro && <p className="rl-svc-intro">{servicesIntro}</p>}
                {services.length === 0 && <EditorHint>Add your packages in Edit &gt; Services.</EditorHint>}
              </div>
              {services.length > 0 && (
                <div className={`rl-cards${services.length === 1 ? ' rl-cards-1' : ''}`} style={{ '--rl-cn': Math.min(3, services.length) }}>
                  {services.map((s, i) => (
                    <article key={`${s.name}-${i}`} className={`rl-card${s.badge ? ' rl-card-feat' : ''}${s.price ? '' : ' rl-card-np'}`}>
                      {s.badge && <span className="rl-badge">{s.badge}</span>}
                      {s.image ? (
                        <div className="rl-card-photo">
                          <PhotoSlot src={s.image} alt={s.name} style={{ height: 'auto' }} />
                        </div>
                      ) : anyServicePhoto && (editor ? (
                        // Once one package has a photo, the editor marks the
                        // others' empty photo wells.
                        <div className="rl-card-photo">
                          <PhotoSlot slot="service" style={{ aspectRatio: '4 / 3' }} />
                        </div>
                      ) : (
                        // The site keeps the same space (rows stay level),
                        // with a quiet car mark instead of a photo.
                        <div className="rl-card-photo rl-card-well" aria-hidden="true"><Icon name="car" size={40} stroke={1.5} /></div>
                      ))}
                      {s.name && <h3 className="rl-card-name">{s.name}</h3>}
                      {s.description && (
                        <div className="rl-card-desc">
                          <ServiceDescription id={`rl-svc-${i}`} text={s.description} accentColor="var(--rl-soft-accent)" />
                        </div>
                      )}
                      {s.price && <p className={`rl-card-price${cardPriceLong(s.price) ? ' rl-price-t' : ''}`}>{s.price}</p>}
                      <a className="rl-btn" href={bookHref} data-scheduler-trigger="" data-scheduler-service={s.name}>Book Now<Icon name="arrowRight" /></a>
                      {s.includes.length > 0 && (
                        <details className="rl-inc" open>
                          <summary>{"See What's Included"}<Icon name="chevronUp" className="rl-chev" /></summary>
                          <ul>
                            {s.includes.map((it, k) => (it.heading ? (
                              <li key={k} className="rl-inc-h">{it.text}</li>
                            ) : (
                              <li key={k} className="rl-inc-i">
                                <Icon name="check" stroke={3} />
                                <span className={it.highlight ? 'rl-inc-hl' : undefined}>{it.text}</span>
                              </li>
                            )))}
                          </ul>
                        </details>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {rendered.featured && (
          <section data-section="featured" id="featured" className="rl-sec rl-feat" style={{ order: order('featured') }}>
            {featured ? (
              <div className={`rl-in rl-feat-grid${images.featured ? ' rl-duo' : ' rl-feat-solo'}`}>
                {/* Without a photo the editor shows the site's one-column
                    band too, with a line naming where the photo is added. */}
                {images.featured && (
                  <div className="rl-feat-photo">
                    <PhotoSlot src={images.featured} alt={`${featured.name}${name ? ` by ${name}` : ''}`} style={{ height: 'auto', aspectRatio: '3 / 4' }} />
                  </div>
                )}
                <div>
                  {featured.eyebrow && <p className="rl-eyebrow">{featured.eyebrow}</p>}
                  <h2 className="rl-h2 rl-feat-h"><Accented title={featured.title} accent={featured.accent} /></h2>
                  {featured.intro && <p className="rl-feat-price">{featured.intro}</p>}
                  {/* "Starting at" only before a number ("Call for quote" reads as written). */}
                  {featured.priceFrom ? (
                    <p className="rl-feat-price">{/\d/.test(featured.priceFrom) && 'Starting at '}<strong>{featured.priceFrom}</strong></p>
                  ) : featured.price && <p className="rl-feat-price"><strong>{featured.price}</strong></p>}
                  {featured.bullets.length > 0 && (
                    <ul className="rl-feat-list">
                      {featured.bullets.map((b, i) => <li key={i}><Icon name="check" size={20} />{b}</li>)}
                    </ul>
                  )}
                  <a
                    className="rl-btn"
                    href={featured.buttonUrl || bookHref}
                    {...(featured.buttonUrl ? {} : { 'data-scheduler-trigger': '', 'data-scheduler-service': featured.name })}
                  >
                    {featured.buttonText}<Icon name="arrowRight" />
                  </a>
                  {!featuredBody && <EditorHint>This band shows on your site once it has a photo, a price or a list of benefits (Edit &gt; Featured Service).</EditorHint>}
                  {featuredBody && !images.featured && <EditorHint>{PHOTO_HINTS.featured}</EditorHint>}
                </div>
              </div>
            ) : (
              <div className="rl-in rl-c">
                <EditorHint>Pick a service to feature in Edit &gt; Featured Service.</EditorHint>
              </div>
            )}
          </section>
        )}

        {rendered.testimonials && reviews === 'google' && (
          <section data-section="testimonials" id="reviews" className="rl-sec" style={{ order: order('testimonials') }}>
            <div className="rl-in rl-c">
              {revT.eyebrow && <p className="rl-eyebrow">{revT.eyebrow}</p>}
              <h2 className="rl-h2 rl-rev-h"><Accented title={txt(copy.googleReviewsTitle) || revTitle} accent={txt(copy.googleReviewsTitle) ? revT.accent : revAccent} /></h2>
              {revT.intro && <p className="rl-rev-intro">{revT.intro}</p>}
              <div className="rl-rev-widget"><GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} /></div>
            </div>
          </section>
        )}

        {rendered.testimonials && reviews !== 'google' && (
          <section data-section="testimonials" id="reviews" className="rl-sec" style={{ order: order('testimonials') }}>
            <div className="rl-in rl-c">
              <p className="rl-eyebrow">{revT.eyebrow || 'Testimonials'}</p>
              <h2 className="rl-h2 rl-rev-h"><Accented title={revTitle} accent={revAccent} /></h2>
              {revT.intro && <p className="rl-rev-intro">{revT.intro}</p>}
              {badgeIn('reviews') && <div className="rl-rev-badge"><GoogleRatingBadge place={biz.googlePlace} className="rl-pill rl-pill-page" style={{ gap: 8 }} starSize=".9em" starGap=".1em" starColor={pageStar} /></div>}
              {quotes.length === 0 ? (
                <EditorHint>Add customer quotes in Edit &gt; Reviews.</EditorHint>
              ) : (
                <div className="rl-car">
                  <div className={`rl-track${quotes.length <= 3 ? ` ${['', 'rl-one', 'rl-n2', 'rl-n3'][quotes.length]}` : ''}`} role="region" aria-label="Customer reviews, scroll sideways for more" tabIndex={0}>
                    {/* Only the "Google Review" label links to Google: a whole-card
                        link whose quote says "book" would be taken over by the
                        booking widget's auto-binding. */}
                    {quotes.map((q, i) => {
                      const Src = placeUrl ? 'a' : 'span';
                      const srcLink = placeUrl ? { href: placeUrl, target: '_blank', rel: 'noopener noreferrer' } : {};
                      return (
                        <figure key={i} className="rl-rev">
                          {q.stars > 0 && <StarRow rating={q.stars} size={20} gap={4} color="currentColor" className="rl-rev-stars" />}
                          <blockquote className="rl-rev-q">“{q.text}”</blockquote>
                          <div className="rl-rev-by">
                            {q.name && <span className="rl-ava" aria-hidden="true">{q.name.charAt(0).toUpperCase()}</span>}
                            <span className="rl-rev-who">
                              <span className="rl-rev-id">
                                {q.name && <span className="rl-rev-name">{q.name}</span>}
                                {q.meta && <span className="rl-rev-meta">{q.meta}</span>}
                              </span>
                              {q.google && <Src className="rl-rev-src" {...srcLink}>Google Review</Src>}
                            </span>
                          </div>
                        </figure>
                      );
                    })}
                  </div>
                </div>
              )}
              {placeUrl && googleQuotes && (
                <a className="rl-rev-more" href={placeUrl} target="_blank" rel="noopener noreferrer">{allGoogle ? 'Read More Reviews' : 'See Our Google Reviews'}<Icon name="arrowUpRight" /></a>
              )}
            </div>
          </section>
        )}

        {rendered.awards && (
          <section data-section="awards" id="awards" className="rl-sec rl-awards" aria-label="Awards and recognition" style={{ order: order('awards') }}>
            <div className="rl-in">
              {awards.length > 0 ? (
                <div data-acg-awards="">
                  <p className="rl-eyebrow">Recognition</p>
                  <ul className="rl-award-list">
                    {awards.map((a, i) => <li key={`${a}-${i}`} className="rl-award"><Icon name="award" size={20} />{a}</li>)}
                  </ul>
                </div>
              ) : (
                <EditorHint>Awards show here once you add them in Edit &gt; Business Info &gt; Awards.</EditorHint>
              )}
            </div>
          </section>
        )}

        {rendered.locations && (
          <section data-section="locations" id="locations" className="rl-sec rl-loc" style={{ order: order('locations') }}>
            <div className="rl-in">
              <p className="rl-eyebrow rl-c">{locT.eyebrow || 'Service Area'}</p>
              <h2 className="rl-h2 rl-loc-h rl-c"><Accented title={locTitle} accent={locAccent} /></h2>
              {!hasLocations && <div className="rl-c"><EditorHint>Your city, service areas and hours show here: Edit &gt; Business Info.</EditorHint></div>}
              {hasLocations && (
                <div className={`rl-loc-grid${mapQuery ? ' rl-duo' : ''}`}>
                  {mapQuery && (
                    <div className="rl-map">
                      <iframe
                        title={`Map of ${mapQuery}`}
                        src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=10&output=embed`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                      {areas.length > 1 && (
                        <ul className="rl-legend" aria-label="Areas we serve">
                          {areas.slice(0, 4).map((a, i) => <li key={a}><i style={{ background: `var(--rl-legend-${i + 1})` }} />{a}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                  <div className="rl-loc-col">
                    {areas.length > 0 && (
                      <>
                        <h3 className="rl-loc-h3">{isMobile ? 'We Come To You' : 'Areas We Serve'}</h3>
                        {areas.length > 1 ? (
                          <ul className="rl-areas">
                            {areas.map((a) => <li key={a} className="rl-area"><Icon name="pin" />{a}</li>)}
                          </ul>
                        ) : (
                          <p className="rl-area-one">{areas[0]}</p>
                        )}
                      </>
                    )}
                    {(hours.rows.length > 0 || hours.text) && (
                      <>
                        <h3 className="rl-loc-h3 rl-hours-h"><Icon name="clock" size={20} />Business Hours</h3>
                        {hours.rows.length > 0 ? (
                          <dl className="rl-hours">
                            {hours.rows.map((r) => <div key={r.day} className="rl-hrow"><dt>{r.day}</dt><dd>{r.time}</dd></div>)}
                          </dl>
                        ) : (
                          <p className="rl-hfree">{hours.text}</p>
                        )}
                      </>
                    )}
                    {areas.length === 0 && hours.rows.length === 0 && !hours.text && place && (
                      <>
                        <h3 className="rl-loc-h3">{isMobile ? 'We Come To You' : 'Where To Find Us'}</h3>
                        <p className="rl-area-one">{place}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {rendered.cta && (
          <section data-section="cta" id="contact" className="rl-cta" style={{ order: order('cta') }}>
            {images.cta && <div className="rl-cta-img" aria-hidden="true"><PhotoSlot src={images.cta} alt="" /></div>}
            <div className="rl-cta-scrim" aria-hidden="true" />
            {/* contact-form.js appends its "Send us a message" form as the last
                child of #contact; .rl-cta>[data-acg-inquiry] restyles it. */}
            <div className="rl-cta-in">
              <h2 className="rl-h2 rl-cta-h"><Accented title={ctaTitle} accent={ctaAccent} /></h2>
              {ctaSub && <p className="rl-cta-p">{ctaSub}</p>}
              <div className="rl-cta-btns">
                {ctaCallHref && ctaCallLabel && (
                  <a className="rl-btn rl-btn-light" href={ctaCallHref}><Icon name="phone" />{ctaCallLabel}</a>
                )}
                <a className="rl-btn" href={ctaBookHref} {...(txt(copy.ctaUrl) ? {} : { 'data-scheduler-trigger': '' })}>{ctaBookLabel}<Icon name="arrowRight" /></a>
              </div>
              {!images.cta && <EditorHint>{PHOTO_HINTS.cta}</EditorHint>}
            </div>
          </section>
        )}
      </main>

      <footer className="rl-foot" style={{ order: 9999 }}>
        {footCells.length > 0 && (
          <div className={`rl-wrap rl-foot-grid${footCells.length >= 5 ? ' rl-foot-5' : ''}`} style={{ '--rl-fn': footCells.length }}>
            {footCells.map((c) => {
              if (c.type === 'brand') {
                return (
                  <div key="brand">
                    <div className="rl-foot-brand">
                      {logo(44)}
                      {shortName && <span className="rl-foot-word">{shortName}</span>}
                    </div>
                    {txt(copy.footerTagline) && <p className="rl-foot-blurb">{txt(copy.footerTagline)}</p>}
                    {badgeIn('footer') && (
                      <div className="rl-foot-g">
                        <GoogleRatingBadge place={biz.googlePlace} variant="inline" starColor={t.accent} starSize={16} />
                      </div>
                    )}
                  </div>
                );
              }
              if (c.type === 'links') {
                return (
                  <div key="links">
                    <h3 className="rl-foot-t">{c.title || 'Explore'}</h3>
                    <ul className="rl-foot-list">
                      {exploreLinks.map((l) => (
                        <li key={l.label}><a href={l.href} {...(l.book ? { 'data-scheduler-trigger': '' } : {})}>{l.label}</a></li>
                      ))}
                    </ul>
                  </div>
                );
              }
              if (c.type === 'areas') {
                return (
                  <div key="areas">
                    <h3 className="rl-foot-t">{c.title || 'Service Areas'}</h3>
                    <ul className="rl-foot-list">
                      {areas.map((a) => <li key={a}><Icon name="pin" size={14} />{a}</li>)}
                    </ul>
                  </div>
                );
              }
              if (c.type === 'contact') {
                return (
                  <div key="contact">
                    <h3 className="rl-foot-t">{c.title || 'Get In Touch'}</h3>
                    <ul className="rl-foot-list rl-touch">
                      {tel && <li><a href={tel}><Icon name="phone" />{phoneLabel}</a></li>}
                      {email && (
                        <li>
                          <a href={`mailto:${email}`} className="rl-mail">
                            <Icon name="mail" />
                            <span>{email.includes('@') ? <>{email.slice(0, email.indexOf('@') + 1)}<wbr />{email.slice(email.indexOf('@') + 1)}</> : email}</span>
                          </a>
                        </li>
                      )}
                      {socials.map((s) => (
                        <li key={s.icon}><a href={s.href} target="_blank" rel="noopener noreferrer"><Icon name={s.icon} />{s.label}</a></li>
                      ))}
                      {!tel && !email && place && <li><Icon name="pin" />{place}</li>}
                    </ul>
                    {hoursMerged && footHasHours && (
                      <div className="rl-foot-hours">
                        <b>{footHoursTitle}</b>
                        {hours.summary.map((line) => <div key={line}>{line}</div>)}
                      </div>
                    )}
                    {footCta && (
                      <a className="rl-pillbtn" href={footCta.href} {...(footCta.books ? { 'data-scheduler-trigger': '' } : {})}>{footCta.label}</a>
                    )}
                  </div>
                );
              }
              return (
                <div key="hours">
                  <h3 className="rl-foot-t">{c.title || 'Hours'}</h3>
                  <div className="rl-foot-list">
                    {hours.summary.map((line) => <div key={line}>{line}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="rl-foot-bar">
          <div className="rl-wrap rl-foot-bar-in">
            {/* exportHtml's owner-link script appends " · Site owner" to the
                LAST <p> of the last <footer>: the copyright stays that <p>
                (the bottom line is a <div>). */}
            <p>© <span data-acg-year="">{new Date().getFullYear()}</span> {name}. All rights reserved.</p>
            {footBarBadge && (
              <div className="rl-foot-bar-g">
                <GoogleRatingBadge place={biz.googlePlace} variant="inline" starColor={t.accent} starSize={14} />
              </div>
            )}
            {bottomText && <div>{bottomText}</div>}
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref={contactHref} colors={kitColors} font={body} />
    </div>
  );
}
