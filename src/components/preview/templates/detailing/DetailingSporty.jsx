// Bold & Sporty (detailing_sporty): race-livery red on black, heavy
// uppercase type, skewed "slash" motifs. Theme-ready (see CLAUDE.md,
// "Template contract"; MobileChrome.jsx is the reference implementation):
//   - every color is a deriveTheme() token exposed as a --ds-* variable, so
//     an owner's palette repaints the whole page (nav, footer and the red
//     panels included); text on the accent is contrast-checked;
//   - all CSS lives in the one prefixed <style> below: @container layout,
//     hover inside (hover:hover), motion inside prefers-reduced-motion;
//   - no hooks or browser globals: the nav is opaque by default and only
//     gets glass + shadow from html[data-acg-scrolled] (siteRuntime.js);
//   - facts (stats, awards, hours, warranty) render only when the owner
//     entered them, and editor hints go through PhotoSlot / EditorOnly.
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import { ServiceCardCss, ServiceDescription, BookNowLink } from '../ServiceCardParts.jsx';
import { buildSectionOrderAdded } from '../../../../lib/sectionOrder.js';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS } from '../../../../lib/businessHours.js';
import { FONT_CATALOG, familiesFromStack, catalogFamily } from '../../../../lib/fontCatalog.js';
import { deriveTheme, mix, alpha, ensureContrast, contrastRatio, isDark, fillOverPhoto } from '../kit/theme.js';
import { PhotoSlot, PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';
import { Accented } from '../kit/Accented.jsx';
import { sectionTitle, serviceIncludes, serviceAreasOf, businessKindOf, splitAccent, hasSocialLinks } from '../kit/content.js';
import {
  heroCardModeOf, heroOfferOf, featuredServiceOf, featuredHasBody, featuredTitleDefaults, makesEyebrowDefault,
  reviewStars, footerPlan, bookingAttrs,
} from '../kit/features.js';
import { HeroOffer, heroOfferCss } from '../kit/HeroOffer.jsx';
import { PackageBadge, PackagePhoto, PackageIncludes, packageDetailsCss } from '../kit/PackageDetails.jsx';
import { FeaturedBand, featuredBandCss } from '../kit/FeaturedBand.jsx';
import { MakesBand, makesBandCss } from '../kit/MakesBand.jsx';
import { vehicleMakesFor } from '../kit/vehicleMakes.js';
import {
  GoogleRatingBadge, StarRow, GOOGLE_STAR_GOLD, googleRatingOf, googlePlaceUrl, googleBadgePlacements,
} from '../kit/GoogleRatingBadge.jsx';

export const themeReady = true;

// The ids of ContentEditor's TOGGLEABLE._default (and the template's old
// buildSectionOrder call), so saved orders keep working and the editor's
// Sections list matches what renders. Never rename an id. 'brands' (the
// vehicle-makes band) and 'featured' (the featured-service band) came later:
// see addedSections.
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'statsBar', label: 'Stats Bar' },
  { id: 'brands', label: 'Vehicle Makes' },
  { id: 'services', label: 'Services' },
  { id: 'featured', label: 'Featured Service' },
  { id: 'about', label: 'About' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'cta', label: 'Contact / CTA' },
  { id: 'awards', label: 'Awards' },
];

// Ids added after sites were saved with this design. Live sites store
// copy.sectionOrder without them, so the page orders them itself
// (buildSectionOrderAdded): every older section keeps exactly its saved
// order value, and an added band without a saved slot shares the value of
// the section before it, rendering right after it in the DOM.
export const addedSections = ['brands', 'featured'];

export const extraFonts = [];

// Edit > Headings: the copy.sectionTitles fields each section uses. The hero
// headline, the services heading / intro and the contact headline / subtext
// keep their own copy keys (titleFrom / introFrom); headingDefaults() below
// gives the design's own text. Stats bar and awards have no heading.
export const headingFields = {
  hero: { fields: ['eyebrow', 'title', 'accent'], titleFrom: 'headline' },
  brands: { fields: ['eyebrow'] },
  services: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'servicesSection.title', introFrom: 'servicesSection.intro' },
  featured: { fields: ['eyebrow', 'title', 'accent', 'intro'] },
  about: { fields: ['eyebrow', 'title', 'accent'] },
  gallery: { fields: ['eyebrow', 'title', 'accent'] },
  testimonials: { fields: ['eyebrow', 'title', 'accent'] },
  cta: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'ctaHeadline', introFrom: 'ctaSubtext' },
};

// Edit > Footer (kit/features.js footerPlan): this design's own footer is
// the brand block, Explore, Contact and Hours; Service Areas is a column the
// owner can switch on, and the footer button is off until they ask for it.
// With copy.footer unset the footer renders exactly as it always has.
export const footerSpec = {
  columns: [
    { type: 'brand', show: true },
    { type: 'links', show: true },
    { type: 'areas', show: false },
    { type: 'contact', show: true },
    { type: 'hours', show: true },
  ],
  titles: { links: 'Explore', areas: 'Service Areas', contact: 'Contact', hours: 'Hours' },
  mergeHours: false,
  cta: false,
  ctaLabel: 'Book Now',
  notes: {
    brand: 'Your logo or name, Footer Tagline, social icons and Google rating. Switched off, the rating moves to the bottom line.',
    contact: 'Phone, email and address from Business Info, and your social icons while the logo column is off.',
  },
  // What fills the contact column (the Footer panel's "nothing to list"
  // check); the social icons move there while the logo column is off.
  contactFields: ['phone', 'email', 'address', 'city', 'state'],
  socialWhenBrandOff: true,
};

const CSS = `
.ds-wrap{width:100%;max-width:1280px;margin:0 auto;padding-left:var(--ds-gutter);padding-right:var(--ds-gutter)}
.ds-root :where(h1,h2,h3,p,ul,ol,dl,dd,figure,blockquote){margin:0}
.ds-root :where(ul,ol){list-style:none;padding:0}
.ds-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.ds-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 18px;background:var(--ds-accent);color:var(--ds-on-accent);font-weight:700;text-decoration:none}
.ds-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.ds-root a:focus-visible,.ds-root summary:focus-visible,.ds-root label:focus-visible,.ds-track:focus-visible{outline:2px solid var(--ds-focus);outline-offset:3px}
/* The ring sits on whatever is behind the link, so each colored surface
   hands it its own ink: the accent-red ring vanishes on the red panel, and
   a light palette's accent is too dark for the (always dark) footer. */
.ds-has-media{--ds-focus:var(--ds-on-hero)}
.ds-band{--ds-focus:var(--ds-band-text)}
.ds-foot{--ds-focus:var(--ds-footer-text)}
.ds-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin-top:20px;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-size:13px;font-weight:500;line-height:1.45;color:inherit;opacity:.85}
.ds-eyebrow{display:inline-flex;align-items:center;gap:12px;font-size:12px;font-weight:700;line-height:1.35;letter-spacing:.22em;text-transform:uppercase;color:var(--ds-accent-text)}
.ds-eyebrow::before{content:'';flex:none;width:26px;height:6px;background:var(--ds-brand);transform:skewX(-24deg)}
/* Owner words in heavy caps never break mid-word ("About primeluxe_detail",
   "Decontamination"): a .ds-fit box is a size container whose font-size is
   the design size, and the heading inside takes min(1em, box width /
   --ds-lw), --ds-lw being its longest word's width in em (fitLw). A .ds-fit
   box holds the heading alone: an inline sibling (the eyebrow) would get a
   line box as tall as the design size, and an @container-styled one would
   query the box instead of the root. */
.ds-fit{container-type:inline-size}
.ds-fit-h2{font-size:clamp(34px,5cqi,66px)}
.ds-h2{margin-top:18px;font-family:var(--ds-head);font-size:min(1em,calc(100cqi / var(--ds-lw,1)));font-weight:var(--ds-head-w);line-height:.96;letter-spacing:-.015em;text-transform:uppercase;color:var(--ds-text);text-wrap:balance;overflow-wrap:break-word}
.ds-intro{max-width:560px;font-size:17px;line-height:1.75;color:var(--ds-muted);text-wrap:pretty}
/* Text tokens follow the surface they sit on: an owner's card color can be
   far lighter or darker than the page (olive page, navy cards), and no one
   text color reads on both. --ds-sf-* are repaired for the surface, --ds-pg-*
   restore the page set for page-colored boxes inside a surface section. */
.ds-alt,.ds-card,.ds-tile,.ds-details,.ds-mono{--ds-text:var(--ds-sf-text);--ds-muted:var(--ds-sf-muted);--ds-accent-text:var(--ds-sf-accent);--ds-focus:var(--ds-sf-accent);--ds-border:var(--ds-sf-border);--ds-border-strong:var(--ds-sf-border-strong);color:var(--ds-text)}
.ds-alt .ds-card,.ds-quote,.ds-statpanel .ds-tile,.ds-alt .ds-mono{--ds-text:var(--ds-pg-text);--ds-muted:var(--ds-pg-muted);--ds-accent-text:var(--ds-pg-accent);--ds-focus:var(--ds-pg-accent);--ds-border:var(--ds-pg-border);--ds-border-strong:var(--ds-pg-border-strong)}
.ds-label{display:block;font-size:11.5px;font-weight:700;line-height:1.4;letter-spacing:.2em;text-transform:uppercase;color:var(--ds-muted)}

.ds-nav{position:sticky;top:0;z-index:100;background:var(--ds-bg);border-bottom:3px solid var(--ds-brand)}
html[data-acg-scrolled] .ds-nav{box-shadow:0 14px 34px -18px var(--ds-shadow)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){html[data-acg-scrolled] .ds-nav{background:var(--ds-glass);-webkit-backdrop-filter:blur(16px) saturate(140%);backdrop-filter:blur(16px) saturate(140%)}}
.ds-nav-in{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:72px}
.ds-brand{flex:1 1 auto;display:inline-flex;align-items:center;min-width:0;color:var(--ds-text);text-decoration:none}
.ds-wordmark{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ds-head);font-size:20px;font-weight:var(--ds-head-w);line-height:1.2;letter-spacing:.05em;text-transform:uppercase}
.ds-wordmark span{color:var(--ds-accent-text)}
.ds-links{flex:none;display:flex;align-items:center;gap:clamp(18px,2.4cqi,32px)}
.ds-link{position:relative;padding:12px 0;color:var(--ds-muted);font-size:12.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;text-decoration:none}
.ds-link::after{content:'';position:absolute;left:0;right:0;bottom:6px;height:2px;background:var(--ds-brand);transform:scaleX(0);transform-origin:left center}

.ds-btn{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 34px;font-family:var(--ds-body);font-size:13.5px;font-weight:700;line-height:1.2;letter-spacing:.12em;text-transform:uppercase;text-align:center;text-decoration:none;cursor:pointer}
.ds-btn::before,.ds-btn::after{content:'';position:absolute;inset:0;z-index:-1;transform:skewX(-12deg)}
.ds-btn:active{translate:0 1px}
.ds-btn-primary{color:var(--ds-on-accent)}
.ds-btn-primary::before{background:var(--ds-accent);box-shadow:0 16px 32px -16px var(--ds-glow)}
.ds-btn-primary::after{background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.26) 50%,transparent 65%) no-repeat;background-size:260% 100%;background-position:130% 0}
.ds-btn-ghost{color:var(--ds-text)}
.ds-btn-ghost::before{border:2px solid var(--ds-border-strong)}
.ds-btn-inv{color:var(--ds-band-ink)}
.ds-btn-inv::before{background:var(--ds-band-text)}
.ds-btn-inv-ghost{color:var(--ds-band-text)}
.ds-btn-inv-ghost::before{border:2px solid var(--ds-band-line)}
.ds-btn-sm{min-height:44px;padding:0 22px;font-size:12.5px}

.ds-hero{position:relative;isolation:isolate;display:flex;align-items:center;min-height:clamp(600px,calc(100vh - 75px),940px);padding:clamp(88px,10cqi,140px) 0 clamp(64px,8cqi,112px);background:var(--ds-bg);color:var(--ds-text);overflow:clip}
.ds-hero-media{position:absolute;inset:0;z-index:-3}
.ds-hero-scrim{position:absolute;inset:0;z-index:-2;background:var(--ds-scrim-left)}
.ds-hero-fade{position:absolute;left:0;right:0;bottom:0;height:22%;z-index:-2;background:var(--ds-hero-fade)}
.ds-slashes{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.ds-slash{position:absolute;top:-15%;height:130%;transform:skewX(-18deg)}
.ds-slash:nth-child(1){right:15%;width:clamp(96px,14cqi,200px);background:linear-gradient(180deg,var(--ds-slash-a),var(--ds-slash-b))}
.ds-slash:nth-child(2){right:calc(15% + clamp(120px,18cqi,250px));width:clamp(26px,4cqi,58px);background:linear-gradient(180deg,var(--ds-slash-b),transparent 85%)}
.ds-slash:nth-child(3){right:7%;width:3px;background:linear-gradient(180deg,transparent,var(--ds-brand) 30%,var(--ds-brand) 70%,transparent);opacity:.55}
.ds-speed{position:absolute;inset:0;background:repeating-linear-gradient(180deg,transparent 0 95px,var(--ds-hairline) 95px 96px);-webkit-mask-image:linear-gradient(90deg,transparent 35%,black 75%);mask-image:linear-gradient(90deg,transparent 35%,black 75%)}
.ds-has-media{color:var(--ds-on-hero);text-shadow:0 1px 24px rgba(0,0,0,.3)}
.ds-has-media .ds-lead,.ds-has-media .ds-meta{color:var(--ds-on-hero-muted)}
.ds-has-media .ds-btn-ghost{color:var(--ds-on-hero)}
.ds-has-media .ds-btn-ghost::before{border-color:var(--ds-on-hero-line)}
.ds-has-media .ds-slash:nth-child(1){opacity:.7}
.ds-hero-body{position:relative;max-width:940px}
.ds-tag{position:relative;isolation:isolate;display:inline-flex;align-items:center;gap:10px;max-width:100%;padding:8px 18px;font-size:12px;font-weight:700;line-height:1.35;letter-spacing:.18em;text-transform:uppercase;color:var(--ds-on-accent);text-shadow:none}
.ds-tag::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--ds-accent);transform:skewX(-12deg)}
.ds-tag svg{flex:none}
.ds-h1{--ds-h1:clamp(44px,8cqi,112px);--ds-col:min(940px,min(100cqi,1280px) - 2 * var(--ds-gutter));margin-top:28px;font-family:var(--ds-head);font-size:min(calc(var(--ds-h1) / var(--ds-wd,1)),calc(var(--ds-col) / var(--ds-lw,8)));font-weight:var(--ds-head-w);line-height:.93;letter-spacing:-.025em;text-transform:uppercase;text-wrap:balance;overflow-wrap:break-word}
.ds-h1-mid{--ds-h1:clamp(42px,6.6cqi,92px)}
.ds-h1-long{--ds-h1:clamp(40px,5.6cqi,78px)}
.ds-em{color:var(--ds-accent-text)}
.ds-has-media .ds-em{color:inherit;background-image:linear-gradient(var(--ds-brand),var(--ds-brand));background-repeat:no-repeat;background-size:100% .11em;background-position:0 94%;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.ds-lead{margin-top:26px;max-width:580px;font-size:clamp(17px,1.5cqi,20px);line-height:1.65;color:var(--ds-muted);text-wrap:pretty}
.ds-actions{display:flex;flex-wrap:wrap;gap:16px 22px;margin-top:40px;padding-left:6px}
.ds-meta{display:flex;flex-wrap:wrap;gap:10px 30px;margin-top:clamp(40px,5cqi,60px);font-size:12.5px;font-weight:700;line-height:1.4;letter-spacing:.18em;text-transform:uppercase;color:var(--ds-muted)}
.ds-meta li{display:inline-flex;align-items:center;gap:10px}
.ds-meta li::before{content:'';flex:none;width:8px;height:8px;background:var(--ds-brand);transform:skewX(-18deg)}
.ds-split{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);min-height:clamp(560px,calc(100vh - 75px),880px);background:var(--ds-bg);color:var(--ds-text)}
.ds-split-text{position:relative;isolation:isolate;overflow:clip;display:flex;flex-direction:column;justify-content:center;padding:clamp(64px,8cqi,120px) clamp(28px,5cqi,80px) clamp(64px,8cqi,120px) max(var(--ds-gutter),calc((100cqi - 1280px) / 2 + var(--ds-gutter)))}
.ds-split-text .ds-tag{align-self:flex-start}
.ds-split .ds-h1{--ds-h1:clamp(40px,5.6cqi,86px);--ds-col:calc(100cqi * 1.05 / 2.05 - max(var(--ds-gutter),(100cqi - 1280px) / 2 + var(--ds-gutter)) - clamp(28px,5cqi,80px))}
.ds-split .ds-h1-mid{--ds-h1:clamp(38px,4.8cqi,74px)}
.ds-split .ds-h1-long{--ds-h1:clamp(36px,4.2cqi,64px)}
.ds-split-photo{position:relative;min-height:440px;background:var(--ds-surface);clip-path:polygon(12% 0,100% 0,100% 100%,0 100%)}

.ds-tiles{display:grid;gap:3px;background:var(--ds-bg)}
.ds-n1{grid-template-columns:minmax(0,1fr)}
.ds-n2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ds-n3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ds-n4{grid-template-columns:repeat(4,minmax(0,1fr))}
.ds-tile{position:relative;overflow:hidden;display:flex;flex-direction:column-reverse;justify-content:flex-end;min-width:0;padding:clamp(28px,3.4cqi,46px) clamp(22px,2.8cqi,40px);background:var(--ds-surface)}
.ds-tile-hot{background:var(--ds-band-bg);color:var(--ds-band-text)}
.ds-tile-hot::after{content:'';position:absolute;top:-20%;right:-8%;width:34%;height:140%;background:var(--ds-band-slash);transform:skewX(-18deg);pointer-events:none}
.ds-tile .ds-label{position:relative;margin-top:12px}
.ds-tile-hot .ds-label{color:var(--ds-band-muted)}
.ds-tile-value{position:relative;display:block;font-family:var(--ds-head);font-size:clamp(40px,4.6cqi,64px);font-weight:var(--ds-head-w);line-height:1;letter-spacing:-.02em;color:var(--ds-accent-text);overflow-wrap:break-word}
.ds-tile-hot .ds-tile-value{color:var(--ds-band-text)}
/* Business facts (words, not numbers) read like a spec sheet: label first. */
.ds-facts .ds-tile{flex-direction:column;justify-content:flex-start}
.ds-facts .ds-tile .ds-label{margin:0 0 12px}
.ds-facts .ds-tile-value{font-size:clamp(18px,1.75cqi,23px);font-weight:var(--ds-head-w2);line-height:1.22;letter-spacing:.005em;text-transform:uppercase;color:var(--ds-text);white-space:pre-line}
.ds-facts .ds-tile-hot .ds-tile-value{color:var(--ds-band-text)}

.ds-section{position:relative;padding:clamp(80px,9cqi,128px) 0;scroll-margin-top:75px}
.ds-alt{background:var(--ds-surface)}
.ds-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:end;gap:20px clamp(32px,6cqi,96px);margin-bottom:clamp(40px,5cqi,68px)}
.ds-head-solo{grid-template-columns:minmax(0,1fr)}
.ds-grid{display:grid;gap:clamp(14px,1.6cqi,20px)}
.ds-c1{grid-template-columns:minmax(0,680px)}
.ds-c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ds-c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ds-cell{display:flex;min-width:0}
.ds-card{flex:1;position:relative;padding:clamp(28px,2.8cqi,38px) clamp(24px,2.6cqi,34px) clamp(22px,2.4cqi,30px) clamp(30px,3cqi,40px);background:var(--ds-surface);border:1px solid var(--ds-border);overflow:hidden}
.ds-alt .ds-card{background:var(--ds-bg)}
.ds-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ds-brand)}
.ds-card{--ds-num:clamp(50px,4.6cqi,72px)}
.ds-card-num{position:absolute;top:10px;right:16px;font-family:var(--ds-head);font-size:var(--ds-num);font-weight:var(--ds-head-w);line-height:1;letter-spacing:-.04em;color:transparent;-webkit-text-stroke:1.5px var(--ds-border-strong);pointer-events:none;user-select:none}
.ds-card-head{position:relative;padding-right:calc(var(--ds-num) * 1.3);font-size:clamp(20px,1.9cqi,24px)}
.ds-card-title{font-family:var(--ds-head);font-size:min(1em,calc(100cqi / var(--ds-lw,1)));font-weight:var(--ds-head-w2);line-height:1.15;text-transform:uppercase;color:var(--ds-text);overflow-wrap:break-word}
.ds-price{position:relative;margin-top:14px;font-family:var(--ds-head);font-size:clamp(28px,2.6cqi,36px);font-weight:var(--ds-head-w);line-height:1.05;letter-spacing:-.02em;color:var(--ds-accent-text)}
.ds-card .acg-svc-foot{padding-top:24px}
.ds-card .acg-svc-more{min-height:32px;padding-top:6px;letter-spacing:.04em}
.ds-card-foot{padding-top:14px;border-top:1px solid var(--ds-border)}
.ds-card .acg-svc-book{display:inline-flex;align-items:center;gap:10px;min-height:44px;color:var(--ds-accent-text);font-size:12.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;text-decoration:none}

.ds-about{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:center;gap:clamp(44px,7cqi,112px)}
.ds-frame{position:relative;isolation:isolate;margin:0 20px 20px 0}
.ds-frame::before{content:'';position:absolute;z-index:-1;top:24px;left:24px;right:-20px;bottom:-20px;background:repeating-linear-gradient(-45deg,var(--ds-brand) 0 2px,transparent 2px 11px);opacity:.75}
.ds-frame::after{content:'';position:absolute;left:-1px;top:-1px;width:38%;height:6px;background:var(--ds-brand)}
.ds-media{position:relative;aspect-ratio:4/5;overflow:hidden;background:var(--ds-surface)}
.ds-mono{position:absolute;inset:0;isolation:isolate;display:grid;place-items:center;overflow:hidden;background:var(--ds-surface)}
.ds-alt .ds-media,.ds-alt .ds-mono{background:var(--ds-bg)}
.ds-mono .ds-slash:nth-child(1){right:22%}
.ds-mono .ds-slash:nth-child(2){right:calc(22% + clamp(120px,18cqi,250px))}
.ds-mono-letter{position:relative;font-family:var(--ds-head);font-size:clamp(110px,15cqi,220px);font-weight:var(--ds-head-w);line-height:1;letter-spacing:-.04em;text-transform:uppercase;color:var(--ds-accent-text);transform:skewX(-10deg);text-shadow:10px 10px 0 var(--ds-slash-a)}
.ds-statpanel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px}
.ds-statpanel .ds-tile:last-child:nth-child(odd){grid-column:1 / -1}
.ds-statpanel .ds-tile:not(.ds-tile-hot){background:var(--ds-bg)}
.ds-statpanel .ds-tile-value{font-size:clamp(34px,3.6cqi,50px)}
.ds-pull{margin:-6px 0 28px;padding-left:18px;border-left:3px solid var(--ds-brand);font-size:clamp(18px,1.7cqi,21px);font-weight:600;line-height:1.5;color:var(--ds-text);text-wrap:pretty}
.ds-prose p{font-size:17px;line-height:1.8;color:var(--ds-muted);white-space:pre-line;text-wrap:pretty}
.ds-prose p+p{margin-top:18px}
.ds-prose p:first-child{font-size:clamp(18px,1.7cqi,21px);line-height:1.65;color:var(--ds-text)}
.ds-dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:20px 32px;margin-top:36px;padding-top:28px;border-top:1px solid var(--ds-border)}
.ds-dl dd{margin-top:8px;font-size:16px;font-weight:600;line-height:1.5;color:var(--ds-text)}

.ds-gal{display:grid;gap:clamp(8px,1cqi,14px)}
.ds-g1{grid-template-columns:minmax(0,1fr)}
.ds-g1 .ds-shot{aspect-ratio:21/9}
.ds-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ds-g2 .ds-shot{aspect-ratio:4/3}
.ds-g3{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));height:clamp(420px,52cqi,640px)}
.ds-g3 .ds-shot:first-child{grid-row:1 / span 2}
.ds-shot{position:relative;min-height:0;overflow:hidden;background:var(--ds-surface)}
.ds-shot::after{content:'';position:absolute;left:0;bottom:0;width:0;height:4px;background:var(--ds-brand)}
.ds-track{display:flex;gap:clamp(10px,1.2cqi,16px);overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc(-1 * var(--ds-gutter));padding:0 var(--ds-gutter) 4px;scroll-padding:0 var(--ds-gutter)}
.ds-track::-webkit-scrollbar{display:none}
.ds-track .ds-shot{flex:0 0 auto;width:clamp(240px,30cqi,390px);aspect-ratio:4/5;scroll-snap-align:start}
.ds-swipe{margin-top:20px;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--ds-muted)}

.ds-quote{flex:1;position:relative;display:flex;flex-direction:column;padding:clamp(28px,3cqi,40px);background:var(--ds-bg);border:1px solid var(--ds-border);border-top:3px solid var(--ds-brand)}
.ds-quote-mark{display:block;color:var(--ds-accent-text)}
.ds-quote blockquote{flex:1;margin-top:22px}
.ds-quote blockquote p{font-size:17px;line-height:1.75;color:var(--ds-text);text-wrap:pretty}
.ds-quote figcaption{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:28px;padding-top:20px;border-top:1px solid var(--ds-border);font-family:var(--ds-head);font-size:14px;font-weight:var(--ds-head-w2);letter-spacing:.08em;text-transform:uppercase;color:var(--ds-text)}
.ds-quote figcaption span{font-family:var(--ds-body);font-weight:500;letter-spacing:.02em;text-transform:none;color:var(--ds-muted)}
.ds-reviews-widget{margin-top:8px}

.ds-cta{scroll-margin-top:75px;background:var(--ds-bg)}
.ds-contact{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)}
.ds-cta>[data-acg-inquiry]{margin:0 auto!important;padding:clamp(56px,6cqi,88px) 16px!important;color:var(--ds-text)}
.ds-cta>[data-acg-inquiry] h3{font-family:var(--ds-head);font-size:clamp(26px,2.6cqi,34px)!important;font-weight:var(--ds-head-w)!important;line-height:1.05;letter-spacing:-.01em;text-transform:uppercase}
.ds-band{position:relative;isolation:isolate;overflow:clip;display:flex;flex-direction:column;justify-content:center;padding:clamp(72px,8cqi,120px) clamp(28px,5cqi,80px) clamp(72px,8cqi,120px) max(var(--ds-gutter),calc((100cqi - 1280px) / 2 + var(--ds-gutter)));background:var(--ds-band-bg);color:var(--ds-band-text)}
.ds-band::before,.ds-band::after{content:'';position:absolute;top:-20%;height:140%;z-index:-1;background:var(--ds-band-slash);transform:skewX(-18deg);pointer-events:none}
.ds-band::before{right:-6%;width:28%}
.ds-band::after{right:26%;width:5%}
.ds-band .ds-eyebrow{color:var(--ds-band-text)}
.ds-band .ds-eyebrow::before{background:var(--ds-band-text)}
.ds-fit-band{font-size:clamp(36px,4.8cqi,66px)}
.ds-band-h{margin-top:18px;font-family:var(--ds-head);font-size:min(1em,calc(100cqi / var(--ds-lw,1)));font-weight:var(--ds-head-w);line-height:.95;letter-spacing:-.015em;text-transform:uppercase;text-wrap:balance;overflow-wrap:break-word}
.ds-band-lead{margin-top:22px;max-width:500px;font-size:17px;line-height:1.7;color:var(--ds-band-muted);text-wrap:pretty}
.ds-band-phone{display:inline-flex;align-items:center;gap:14px;width:fit-content;max-width:100%;margin-top:34px;font-family:var(--ds-head);font-size:clamp(28px,3.4cqi,44px);font-weight:var(--ds-head-w);line-height:1.1;letter-spacing:-.01em;color:var(--ds-band-text);text-decoration:none;overflow-wrap:anywhere}
.ds-band-phone svg{flex:none}
.ds-band .ds-actions{margin-top:30px}
.ds-details{display:flex;flex-direction:column;justify-content:center;padding:clamp(64px,7cqi,112px) max(var(--ds-gutter),calc((100cqi - 1280px) / 2 + var(--ds-gutter))) clamp(64px,7cqi,112px) clamp(28px,5cqi,72px);background:var(--ds-surface)}
.ds-details-h{font-family:var(--ds-head);font-size:clamp(22px,2.2cqi,28px);font-weight:var(--ds-head-w);line-height:1.1;text-transform:uppercase;color:var(--ds-text)}
.ds-rows{margin-top:24px}
.ds-row{display:flex;gap:18px;padding:18px 0;border-top:1px solid var(--ds-border)}
.ds-row:last-child{padding-bottom:0}
.ds-icon{flex:none;display:grid;place-items:center;width:40px;height:40px;background:var(--ds-accent-soft);color:var(--ds-accent-text)}
.ds-row-body{min-width:0;flex:1}
.ds-row-value{display:block;margin-top:6px;font-size:16px;line-height:1.55;color:var(--ds-text);overflow-wrap:anywhere}
.ds-row-value a{color:inherit;text-decoration:none;border-bottom:1px solid var(--ds-border-strong)}
.ds-hours{display:grid;grid-template-columns:auto 1fr;gap:4px 20px;margin-top:8px;font-size:15px;line-height:1.55}
.ds-hours dt{color:var(--ds-text);font-weight:600}
.ds-hours dd{color:var(--ds-muted)}
.ds-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ds-chip{padding:5px 12px;border:1px solid var(--ds-border-strong);font-size:13px;font-weight:600;line-height:1.5;color:var(--ds-text)}

.ds-awards{padding:clamp(40px,5cqi,64px) 0;background:var(--ds-bg);border-top:1px solid var(--ds-border);border-bottom:1px solid var(--ds-border)}
.ds-awards-in{display:flex;flex-wrap:wrap;align-items:center;gap:20px clamp(28px,4cqi,56px)}
.ds-award-list{display:flex;flex-wrap:wrap;gap:16px clamp(24px,3.6cqi,48px)}
.ds-award{display:inline-flex;align-items:center;gap:12px;font-family:var(--ds-head);font-size:clamp(16px,1.5cqi,19px);font-weight:var(--ds-head-w2);line-height:1.3;text-transform:uppercase;color:var(--ds-text)}
.ds-award svg{flex:none;color:var(--ds-accent-text)}

.ds-foot{padding:clamp(64px,8cqi,100px) 0 36px;background:var(--ds-footer-bg);color:var(--ds-footer-muted);border-top:3px solid var(--ds-brand);font-size:15px;line-height:1.6}
.ds-foot-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:40px clamp(28px,4cqi,64px)}
.ds-foot .ds-brand{color:var(--ds-footer-text)}
.ds-foot .ds-wordmark span{color:var(--ds-footer-em)}
.ds-foot-tag{margin-top:18px;max-width:340px}
.ds-foot-h{font-size:11.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--ds-footer-text)}
.ds-foot-list{display:grid;gap:10px;margin-top:18px}
.ds-foot a{color:var(--ds-footer-muted);text-decoration:none}
.ds-social{margin-top:24px}
.ds-social a{width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--ds-footer-line)}
.ds-foot-bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;margin-top:clamp(48px,6cqi,72px);padding-top:24px;border-top:1px solid var(--ds-footer-line);font-size:13px}

@media (hover:hover){
.ds-link:hover{color:var(--ds-text)}
.ds-link:hover::after{transform:scaleX(1)}
.ds-btn-primary:hover::after{background-position:-30% 0}
.ds-btn-primary:hover::before{box-shadow:0 20px 40px -14px var(--ds-glow)}
.ds-btn-ghost:hover::before{border-color:var(--ds-brand);background:var(--ds-accent-soft)}
.ds-has-media .ds-btn-ghost:hover::before{border-color:var(--ds-on-hero);background:var(--ds-on-hero-soft)}
.ds-btn-inv:hover::before{background:var(--ds-band-ink-hover)}
.ds-btn-inv-ghost:hover::before{border-color:var(--ds-band-text)}
.ds-card:hover{transform:translateY(-4px);border-color:var(--ds-border-strong);box-shadow:0 30px 60px -34px var(--ds-shadow)}
.ds-card:hover::before{width:7px}
.ds-card:hover .ds-card-num{-webkit-text-stroke-color:var(--ds-brand);translate:-4px 0}
.ds-card .acg-svc-book:hover svg{transform:translateX(5px)}
.ds-shot:hover img{transform:scale(1.05)}
.ds-shot:hover::after{width:100%}
.ds-quote:hover{border-color:var(--ds-border-strong);border-top-color:var(--ds-brand)}
.ds-row-value a:hover{color:var(--ds-accent-text);border-bottom-color:var(--ds-accent-text)}
.ds-band-phone:hover{text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:6px}
.ds-foot a:hover{color:var(--ds-footer-text)}
.ds-social a:hover{border-color:var(--ds-brand)}
}
@media (prefers-reduced-motion:no-preference){
.ds-nav{transition:background-color .3s ease,box-shadow .3s ease}
.ds-link,.ds-row-value a,.ds-foot a{transition:color .2s ease,border-color .2s ease}
.ds-link::after{transition:transform .3s cubic-bezier(.2,.7,.2,1)}
.ds-btn::before{transition:background-color .2s ease,border-color .2s ease,box-shadow .3s ease}
.ds-btn::after{transition:background-position .7s cubic-bezier(.2,.7,.2,1)}
.ds-card{transition:transform .35s cubic-bezier(.2,.7,.2,1),border-color .25s ease,box-shadow .35s ease}
.ds-card::before{transition:width .25s ease}
.ds-card-num{transition:-webkit-text-stroke-color .25s ease,translate .35s ease}
.ds-card .acg-svc-book svg{transition:transform .25s ease}
.ds-shot img{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.ds-shot::after{transition:width .5s cubic-bezier(.2,.7,.2,1)}
.ds-quote,.ds-social a{transition:border-color .25s ease}
.ds-hero-body>*,.ds-split-text>*:not(.ds-slashes){animation:ds-rise .8s cubic-bezier(.2,.7,.2,1) both}
.ds-hero-body>:nth-child(2),.ds-split-text>:nth-child(3){animation-delay:.08s}
.ds-hero-body>:nth-child(3),.ds-split-text>:nth-child(4){animation-delay:.16s}
.ds-hero-body>:nth-child(n+4),.ds-split-text>:nth-child(n+5){animation-delay:.24s}
.ds-hero .ds-slash,.ds-split .ds-slash{animation:ds-slash-in 1.1s cubic-bezier(.2,.7,.2,1) both}
.ds-slash:nth-child(2){animation-delay:.1s}
@keyframes ds-rise{from{opacity:0;translate:0 22px}to{opacity:1;translate:0 0}}
/* No "to" frame: each slash settles at its own opacity (.55 line, .7 over a photo). */
@keyframes ds-slash-in{from{opacity:0;translate:18% 0}}
}

/* Nav: the call button stays until the phone action bar takes over (600px);
   on tablets the text links fold into the kit's menu instead of vanishing. */
@container (max-width:1100px){.ds-link-x{display:none}}
@container (max-width:900px){
.ds-nav-in{gap:16px}
.ds-link{display:none}
.ds-nav .acg-menu{display:block}
.ds-c3{grid-template-columns:repeat(2,minmax(0,1fr))}
.ds-n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.ds-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.ds-foot-brand{grid-column:1 / -1}
}
@container (max-width:760px){
.ds-head,.ds-about,.ds-contact{grid-template-columns:minmax(0,1fr)}
.ds-media{aspect-ratio:4/3}
.ds-band,.ds-details{padding-left:var(--ds-gutter);padding-right:var(--ds-gutter)}
}
@container (max-width:600px){
.ds-links,.ds-nav-cta{display:none}
.ds-nav-in{min-height:62px;gap:12px}
.ds-wordmark{font-size:16px;letter-spacing:.04em}
.ds-hero{min-height:0;padding:64px 0 52px}
.ds-hero.ds-has-media{min-height:clamp(560px,84vh,760px);align-items:flex-end}
.ds-hero-scrim{background:var(--ds-scrim)}
.ds-h1,.ds-split .ds-h1{--ds-h1:clamp(38px,11.5cqi,56px);--ds-col:calc(100cqi - 2 * var(--ds-gutter));line-height:.95}
.ds-h1-mid,.ds-split .ds-h1-mid{--ds-h1:clamp(34px,10cqi,50px)}
.ds-h1-long,.ds-split .ds-h1-long{--ds-h1:clamp(32px,9cqi,46px)}
.ds-lead{font-size:17px}
.ds-actions{flex-direction:column;align-items:stretch;padding:0 6px}
.ds-meta{gap:10px 22px;margin-top:36px}
.ds-slash:nth-child(1){right:-4%;width:34%}
.ds-slash:nth-child(2){right:36%;width:8%}
.ds-slash:nth-child(3){display:none}
.ds-split{grid-template-columns:minmax(0,1fr);min-height:0}
.ds-split-text{padding:60px var(--ds-gutter) 52px}
.ds-split-photo{min-height:0;aspect-ratio:4/3;clip-path:polygon(0 10%,100% 0,100% 100%,0 100%)}
.ds-split-mono{display:none}
.ds-tile{padding:24px 18px}
.ds-tile-value{font-size:clamp(34px,10cqi,46px)}
.ds-n3{grid-template-columns:minmax(0,1fr)}
.ds-facts{grid-template-columns:minmax(0,1fr)}
.ds-facts .ds-tile{flex-direction:row;align-items:baseline;justify-content:space-between;gap:20px;padding:20px var(--ds-gutter)}
.ds-facts .ds-tile .ds-label{flex:none;margin:0}
.ds-facts .ds-tile-value{min-width:0;text-align:right;font-size:16px;line-height:1.35}
.ds-facts .ds-tile-hot::after{width:22%;right:-6%}
.ds-section{padding:72px 0}
.ds-fit-h2{font-size:clamp(32px,9.5cqi,44px)}
.ds-c1,.ds-c2,.ds-c3{grid-template-columns:minmax(0,1fr)}
.ds-frame{margin:0 14px 14px 0}
.ds-frame::before{top:16px;left:16px;right:-14px;bottom:-14px}
.ds-g2,.ds-g3{grid-template-columns:minmax(0,1fr);grid-template-rows:none;height:auto}
.ds-g3 .ds-shot:first-child{grid-row:auto}
.ds-g1 .ds-shot,.ds-g2 .ds-shot,.ds-g3 .ds-shot{aspect-ratio:4/3}
.ds-track .ds-shot{width:78%}
.ds-band{padding-top:64px;padding-bottom:64px}
.ds-band::before{width:44%;right:-18%}
.ds-band::after{display:none}
.ds-details{padding-top:52px;padding-bottom:56px}
.ds-foot{padding-top:56px}
.ds-foot-grid{grid-template-columns:minmax(0,1fr)}
}
`;

// The owner-editable features (hero services card, Google rating, footer
// builder, package details, headings, featured and makes bands, service
// areas, Google review labels, contact photo) in this design's look: square
// corners, skewed slashes, heavy caps, the red band. Appended to the one
// <style> string only while a feature renders, after the kit blocks' own
// CSS (heroOfferCss & co.), so these rules win over it. The --ds-hq-*,
// --ds-pk-*, --ds-ft-* and --ds-mk-* block variables alias tokens that
// sportyTokens already contrast-repairs. A site with none of the feature
// keys gets exactly CSS above, byte for byte.
const FEATURE_CSS = `
.ds-hq-grid{display:grid;gap:clamp(32px,4cqi,56px);align-items:center}
.ds-hq-slot{position:relative;width:100%;max-width:560px;text-shadow:none;color:var(--ds-sf-text);--ds-focus:var(--ds-sf-accent);--ds-hq-card-bg:var(--ds-sf-bg);--ds-hq-card-text:var(--ds-sf-text);--ds-hq-card-muted:var(--ds-sf-muted);--ds-hq-card-accent:var(--ds-sf-accent);--ds-hq-opt-bg:var(--ds-pg-bg);--ds-hq-opt-text:var(--ds-pg-text);--ds-hq-opt-muted:var(--ds-pg-muted);--ds-hq-opt-accent:var(--ds-pg-accent);--ds-hq-row-bg:var(--ds-pg-bg);--ds-hq-row-text:var(--ds-pg-text);--ds-hq-row-muted:var(--ds-pg-muted);--ds-hq-row-accent:var(--ds-pg-accent);--ds-hq-btn-bg:var(--ds-accent);--ds-hq-btn-text:var(--ds-on-accent);--ds-hq-btn-shadow:0 16px 32px -16px var(--ds-glow);--ds-hq-line:var(--ds-sf-border);--ds-hq-line-strong:var(--ds-sf-border-strong);--ds-hq-pick:var(--ds-brand);--ds-hq-pick-shadow:inset 4px 0 0 var(--ds-brand);--ds-hq-hover:var(--ds-brand);--ds-hq-head:var(--ds-head);--ds-hq-head-w:var(--ds-head-w);--ds-hq-r:0px;--ds-hq-r-ctl:0px;--ds-hq-r-lg:0px;--ds-hq-shadow:0 30px 60px -34px var(--ds-shadow);--ds-hq-focus:var(--ds-sf-accent)}
.ds-split-offer{grid-template-rows:1fr auto}
.ds-split-offer>.ds-hq-slot{grid-column:1 / -1;width:auto;max-width:560px;margin:0 var(--ds-gutter) clamp(56px,7cqi,96px) max(var(--ds-gutter),calc((100cqi - 1280px) / 2 + var(--ds-gutter)))}
.ds-has-media .ds-h1-own .ds-em{background:none;text-decoration-line:underline;text-decoration-color:var(--ds-brand);text-decoration-thickness:.08em;text-underline-offset:.03em;text-decoration-skip-ink:none}
.ds-hq-quote::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ds-brand)}
.ds-hq-dot{border-radius:0;transform:skewX(-12deg)}
.ds-hq-q-cta,.ds-hq-hl-cta,.ds-hq-q-book{clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);letter-spacing:.12em}
.ds-hq-q-book:focus-visible,.ds-hq-hl-cta:focus-visible,.ds-hq-quote:has(.ds-hq-go:focus-visible) .ds-hq-q-cta{clip-path:none}
.ds-hq-step-l{letter-spacing:.22em}
.ds-hq-steps i{height:2px;background:var(--ds-hq-line)}
.ds-hq-q-call{font-size:13.5px;letter-spacing:.12em;text-transform:uppercase}
@container (min-width:1024px){
.ds-hq-grid{grid-template-columns:minmax(0,1fr) minmax(340px,420px)}
.ds-hq-slot{max-width:none}
.ds-split-offer>.ds-split-photo{grid-column:2;grid-row:1}
.ds-split-offer>.ds-hq-slot{grid-column:2;grid-row:1;align-self:center;justify-self:center;z-index:1;width:min(420px,84%);margin:clamp(32px,4cqi,64px) 0 clamp(32px,4cqi,64px) 8%}
.ds-hero-offer .ds-h1{--ds-h1:clamp(40px,5.2cqi,80px);--ds-col:calc(min(100cqi,1280px) - 2 * var(--ds-gutter) - 420px - clamp(32px,4cqi,56px))}
}

.ds-gpill{padding:8px 16px;border:1px solid var(--ds-border-strong);box-shadow:inset 3px 0 0 var(--ds-brand);font-size:12.5px;font-weight:700;line-height:1.4;letter-spacing:.06em;text-transform:uppercase;color:var(--ds-text);text-decoration:none}
.ds-gpill .acg-gbadge-count{color:var(--ds-muted)}
.ds-has-media .ds-gpill{border-color:var(--ds-on-hero-line);color:var(--ds-on-hero)}
.ds-has-media .ds-gpill .acg-gbadge-count{color:var(--ds-on-hero-muted)}
.ds-hero-g{margin-top:28px}
/* The menu-bar rating gives way to the business name: its slot takes only
   the room the name and the links leave (the name no longer grows into
   it), and the badge shows only while that room fits it (navBadgeCss: a
   size query on the slot, its nearest container). The slot's negative
   margin cancels its extra flex gap, so with the badge hidden the name
   has exactly the room it has without one; the badge's own margin keeps
   it 24px clear of the name. */
.ds-nav-gslot{flex:1 1 0;min-width:0;margin-left:-24px;display:flex;justify-content:flex-end;container-type:inline-size}
.ds-brand:has(+.ds-nav-gslot){flex-grow:0}
.ds-nav-g{display:none;margin-left:24px;font-size:12.5px;font-weight:600;color:var(--ds-muted)}
.ds-nav-g a{color:inherit;text-decoration:none}
.ds-about-g{margin:-8px 0 24px}
.ds-rev-g{margin-top:22px}
.ds-foot-g{margin-top:16px;font-size:14px}
.ds-foot-bottom .ds-foot-g{margin-top:0;font-size:13px}

.ds-fb .ds-foot-list{overflow-wrap:anywhere}
.ds-foot .ds-foot-cta{margin-top:22px;color:var(--ds-on-accent)}
.ds-foot-note{max-width:100%}

.ds-card{--ds-pk-text:var(--ds-text);--ds-pk-muted:var(--ds-muted);--ds-pk-accent:var(--ds-accent-text);--ds-pk-line:var(--ds-border);--ds-pk-badge-bg:var(--ds-accent);--ds-pk-badge-text:var(--ds-on-accent);--ds-pk-well-bg:var(--ds-pg-bg);--ds-pk-well-ink:var(--ds-border-strong);--ds-pk-r:0px;--ds-pk-head:var(--ds-head)}
.ds-pk-badge{position:relative;align-self:flex-start;margin-bottom:16px;clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);padding:6px 18px;letter-spacing:.16em}
.ds-card-feat{border-color:var(--ds-brand)}
.ds-card-ph .ds-card-num{display:none}
.ds-card-ph .ds-card-head{padding-right:0}
.ds-pk-card-photo{margin-bottom:24px}
.ds-pk-inc>summary{font-size:12.5px;letter-spacing:.18em}
.ds-pk-inc-h{font-family:var(--ds-head);font-weight:var(--ds-head-w2)}
@container (min-width:601px){
.ds-grid:not(.ds-c1) .ds-pk-card-well{display:flex}
.ds-pk-row .ds-card{padding-top:calc(clamp(28px,2.8cqi,38px) + 26px)}
.ds-pk-row .ds-pk-badge{position:absolute;top:clamp(14px,1.4cqi,18px);left:clamp(30px,3cqi,40px);max-width:calc(100% - clamp(30px,3cqi,40px) - var(--ds-num) * 1.3);margin:0}
}

.ds-band .ds-em,.ds-ft-band .ds-em{color:inherit;background-image:linear-gradient(var(--ds-band-text),var(--ds-band-text));background-repeat:no-repeat;background-size:100% .1em;background-position:0 94%;-webkit-box-decoration-break:clone;box-decoration-break:clone}

.ds-ft-band{isolation:isolate;overflow:clip;background:var(--ds-band-bg);color:var(--ds-band-text);--ds-focus:var(--ds-band-text);--ds-ft-text:var(--ds-band-text);--ds-ft-muted:var(--ds-band-muted);--ds-ft-accent:var(--ds-band-text);--ds-ft-r:0px;--ds-ft-photo-max:440px}
.ds-ft-band::before,.ds-ft-band::after{content:'';position:absolute;top:-20%;height:140%;z-index:-1;background:var(--ds-band-slash);transform:skewX(-18deg);pointer-events:none}
.ds-ft-band::before{right:-6%;width:28%}
.ds-ft-band::after{right:26%;width:5%}
.ds-ft-band .ds-eyebrow{color:var(--ds-band-text)}
.ds-ft-band .ds-eyebrow::before{background:var(--ds-band-text)}
.ds-ft-band .ds-actions{margin-top:32px}
.ds-ft-feat-solo{margin:0}
.ds-ft-feat-price strong{font-family:var(--ds-head);font-weight:var(--ds-head-w);color:var(--ds-band-text)}
.ds-ft-feat-photo{box-shadow:14px 14px 0 var(--ds-band-slash)}

.ds-mk-makes{--ds-mk-bg:var(--ds-bg);--ds-mk-text:var(--ds-text);--ds-mk-muted:var(--ds-muted);--ds-mk-line:var(--ds-border);--ds-mk-focus:var(--ds-focus);border-top:3px solid var(--ds-brand)}
.ds-mk-makes-eye{font-weight:700;letter-spacing:.22em}

.ds-rev-stars{margin-top:18px;color:var(--ds-accent-text)}
.ds-quote .ds-rev-src{margin-left:auto;font-family:var(--ds-body);font-size:11.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ds-accent-text);text-decoration:none}
.ds-rev-more{display:inline-flex;align-items:center;min-height:44px;margin-top:32px;color:var(--ds-accent-text);font-size:12.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;text-decoration:none}

.ds-band-photo{position:absolute;inset:0;z-index:-3}
.ds-band-scrim{position:absolute;inset:0;z-index:-2;background:var(--ds-ctaph-scrim)}
.ds-band-has-photo{--ds-band-text:var(--ds-ctaph-text);--ds-band-muted:var(--ds-ctaph-muted);--ds-focus:var(--ds-ctaph-text)}

@media (hover:hover){
.ds-foot .ds-foot-cta:hover{color:var(--ds-on-accent)}
.ds-rev-more:hover,.ds-quote a.ds-rev-src:hover,.ds-gpill:hover .acg-gbadge-count{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}
}
@media (prefers-reduced-motion:no-preference){
.ds-hero-offer .ds-hq-slot,.ds-split-offer>.ds-hq-slot{animation:ds-rise .8s cubic-bezier(.2,.7,.2,1) .2s both}
}
@container (min-width:901px){.ds-foot-grid.ds-fb{grid-template-columns:var(--ds-fcols)}}
@container (max-width:1100px){.ds-nav-gslot{display:none}}
/* Without container queries (the page's old-browser fallback turns them into
   viewport queries) nothing can tell whether the badge fits: leave it out. */
@supports not (container-type:inline-size){.ds-nav-gslot{display:none}}
@container (max-width:600px){
.ds-split-offer .ds-split-photo{order:1}
.ds-split-offer>.ds-hq-slot{margin-bottom:44px}
.ds-ft-band::before{width:44%;right:-18%}
.ds-ft-band::after{display:none}
.ds-quote .ds-rev-src{margin-left:0}
}
`;

const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// Hours as display rows { days, time } (same rules as MobileChrome). Only
// the per-day editor's shape (exactly the seven HOURS_DAYS keys, '' =
// closed) may say a day is "Closed"; older free-text hours are shown as the
// owner wrote them and never gain facts.
const DAY = '(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?';
const DAY_SPAN_RE = new RegExp(`^${DAY}(?:\\s*[-–]\\s*${DAY})?$`, 'i');
const cleanTime = (v) => txt(v).replace(/\s*[-–]\s*$/, '').replace(/\s*[-–]\s*/, ' – ');
function hoursRows(hours) {
  if (!hours) return [];
  if (typeof hours === 'object' && !Array.isArray(hours)) {
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

// The stats-bar "Hours" fact must be the whole truth in a few words.
function hoursFact(rows) {
  if (rows.length === 1 && !rows[0].time) return rows[0].days.length <= 40 ? rows[0].days : null;
  const open = rows.filter((r) => r.time && !/^closed$/i.test(r.time));
  return open.length > 0 && open.length <= 2 ? open.map((r) => `${r.days} ${r.time}`).join('\n') : null;
}

// Syne's 800 is a far wider cut than its 700 (1.09em vs 0.74em per
// capital): set heavy and uppercase it broke words on phones and ran the
// hero headline to six lines on desktop. 700 keeps Syne's character.
const HEAD_WEIGHT_CAP = { Syne: 700 };

// The heaviest weight the published page actually loads for a font stack,
// at most `want` (a single-weight face like Bebas Neue gets 400, so the
// browser never fakes a bold). System stacks keep `want`.
function loadedWeight(stack, want) {
  const fam = catalogFamily(familiesFromStack(stack)[0]);
  if (!fam) return want;
  const ws = FONT_CATALOG[fam].weights;
  if (ws.length === 0) return 400;
  const top = Math.min(want, HEAD_WEIGHT_CAP[fam] ?? want);
  const below = ws.filter((w) => w <= top);
  return below.length ? Math.max(...below) : Math.min(...ws);
}

// Width of a capital in em for each heading font the editor offers, at the
// weight this template sets it, with ~17% headroom for wide letters (M, W).
// Measured in Chrome from the Google Fonts files (2026-09): Inter 900
// averages 0.63em, hence the 0.74 default for Inter and system stacks.
const CAPS_EM = {
  Inter: 0.74, Montserrat: 0.79, Poppins: 0.74, 'Playfair Display': 0.76,
  'DM Serif Display': 0.64, 'Cormorant Garamond': 0.69, 'Bebas Neue': 0.4,
  Oswald: 0.56, Syne: 0.86, Righteous: 0.68, Boogaloo: 0.51,
};
const capsEm = (stack) => CAPS_EM[catalogFamily(familiesFromStack(stack)[0])] || 0.74;

// --ds-lw for a .ds-fit heading: its longest unbreakable run in em (the
// browser may still break after a hyphen or slash), at least 6 characters.
function fitLw(text, em) {
  const runs = txt(text).replace(/([-–—/])/g, '$1 ').split(/\s+/);
  return (Math.max(6, ...runs.map((w) => w.length)) * em).toFixed(2);
}

// Headline emphasis: the second half of a two-part headline ("Clean Cars,
// Done Right", "Flawless Detail. Every Time.", "... Detailing — We Come To
// You") or else its closing words ("Miami's Most Trusted Auto Detailing
// Studio" -> "Detailing Studio"). Replaces the old every-third-word coloring.
// A break after a sentence mark or dash wins over one after a comma, and
// abbreviations ("St. Cloud's ...") never count as a break.
const ABBR_RE = /(?:^|\s)(?:st|dr|mt|ft|mr|mrs|ms|jr|sr|co|inc|ave|blvd|no)\.$/i;
const CONNECTOR_RE = /^(?:&|and|or|of|for|to|the|a|an|in|on|at|by|with)$/i;
function splitHeadline(text) {
  const h = txt(text).replace(/\s+/g, ' ');
  const words = h.split(' ').filter(Boolean);
  if (words.length < 2) return [h, ''];
  // Candidate breaks: `at` = number of words in the plain lead.
  const breaks = [];
  for (let i = 0; i < words.length - 1; i++) {
    const tail = words.length - i - 1;
    if (/^[—–-]$/.test(words[i + 1])) {
      // "Lead — Tail": the dash stays with the lead.
      if (tail - 1 >= 1 && tail - 1 <= 5) breaks.push({ rank: 0, at: i + 2 });
    } else if (tail <= 5 && /[.!?:;]$/.test(words[i]) && !ABBR_RE.test(words.slice(0, i + 1).join(' '))) {
      breaks.push({ rank: 0, at: i + 1 });
    } else if (tail <= 5 && /,$/.test(words[i])) {
      breaks.push({ rank: 1, at: i + 1 });
    }
  }
  const best = breaks.sort((a, b) => a.rank - b.rank || a.at - b.at)[0];
  if (best) return [words.slice(0, best.at).join(' '), words.slice(best.at).join(' ')];
  let k = words.length <= 3 ? 1 : Math.min(3, Math.ceil(words.length / 3));
  // Never open the emphasis on a connector ("& Exotic Vehicles").
  while (k > 1 && CONNECTOR_RE.test(words[words.length - k])) k -= 1;
  return [words.slice(0, -k).join(' '), words.slice(-k).join(' ')];
}

// Accent surfaces that carry text (buttons, the red panels). White on the
// owner's accent is the sporty look; when a slightly deeper shade of the
// same color gets white to 4.5:1 (the default red does), that shade is the
// fill. Otherwise the accent stays exact and deriveTheme's readable ink
// (usually near-black) goes on it.
function accentFill(t) {
  const deep = ensureContrast(t.accent, '#ffffff', 4.5);
  if (contrastRatio(deep, t.accent) <= 1.3) return { fill: deep, on: '#ffffff' };
  return { fill: t.accent, on: t.onAccent };
}

function sportyTokens(t) {
  const { fill, on } = accentFill(t);
  // Secondary text on the red panels: a softened ink when that still reads
  // at 4.5:1, else the full ink (white on the default red is right at the
  // limit, and ensureContrast would flip a softened white to black).
  const softInk = mix(on, fill, 0.18);
  const bandMuted = contrastRatio(softInk, fill) >= 4.5 ? softInk : on;
  // Dark footer on every palette (the sporty base); on a light page it is
  // the owner's text color deepened, so it still belongs to the palette.
  let footerBg = t.isDark ? mix(t.bg, '#000000', 0.45) : mix(t.text, '#000000', 0.3);
  if (!isDark(footerBg)) footerBg = mix(footerBg, '#000000', 0.6);
  const footerText = ensureContrast(t.isDark ? t.text : t.bg, footerBg, 4.5);
  // Text repaired for the owner's card/section color (see the CSS note).
  const sfText = ensureContrast(t.text, t.surface, 4.5);
  const sfDark = isDark(t.surface);
  return {
    '--ds-pg-bg': t.bg,
    '--ds-pg-text': t.text,
    '--ds-pg-muted': t.textMuted,
    '--ds-pg-accent': t.accentText,
    '--ds-pg-border': t.border,
    '--ds-pg-border-strong': t.borderStrong,
    '--ds-sf-bg': t.surface,
    '--ds-sf-text': sfText,
    '--ds-sf-muted': ensureContrast(t.textMuted, t.surface, 4.5),
    '--ds-sf-accent': ensureContrast(t.accentText, t.surface, 4.5),
    '--ds-sf-border': alpha(sfText, sfDark ? 0.16 : 0.12),
    '--ds-sf-border-strong': alpha(sfText, sfDark ? 0.32 : 0.26),
    '--ds-accent': fill,
    '--ds-on-accent': on,
    '--ds-brand': t.accent,
    '--ds-band-bg': fill,
    '--ds-band-text': on,
    '--ds-band-muted': bandMuted,
    '--ds-band-ink': ensureContrast(fill, on, 4.5),
    '--ds-band-ink-hover': mix(on, fill, 0.1),
    '--ds-band-line': alpha(on, 0.55),
    '--ds-band-slash': alpha(on === '#ffffff' ? '#000000' : '#ffffff', 0.1),
    '--ds-slash-a': alpha(t.accent, t.isDark ? 0.2 : 0.14),
    '--ds-slash-b': alpha(t.accent, t.isDark ? 0.07 : 0.05),
    '--ds-hairline': alpha(t.text, t.isDark ? 0.05 : 0.06),
    '--ds-glow': alpha(t.accent, 0.55),
    '--ds-glass': alpha(t.bg, 0.86),
    '--ds-shadow': alpha('#000000', t.isDark ? 0.75 : 0.25),
    '--ds-hero-fade': t.isDark ? `linear-gradient(180deg, transparent, ${t.bg})` : 'none',
    '--ds-on-hero-muted': alpha(t.onHero, 0.88),
    '--ds-on-hero-line': alpha(t.onHero, 0.5),
    '--ds-on-hero-soft': alpha(t.onHero, 0.1),
    '--ds-footer-bg': footerBg,
    '--ds-footer-text': footerText,
    '--ds-footer-muted': ensureContrast(mix(footerText, footerBg, 0.32), footerBg, 4.5),
    '--ds-footer-em': ensureContrast(t.accent, footerBg, 4.5),
    '--ds-footer-line': alpha(footerText, 0.16),
  };
}

// The contact band over the owner's CTA Background photo (images.cta): the
// photo shows through a scrim of the band's own fill, at least 84% where the
// text sits. kit fillOverPhoto deepens that fill just enough for the band's
// text to read over a white or a black photo pixel alike; --ds-ctaph-bg is
// the scrim over the worse of the two. Root variables only while that
// photo shows.
function ctaPhotoTokens(tokens) {
  const { scrim, worst, text, muted } = fillOverPhoto({
    fill: tokens['--ds-band-bg'], text: tokens['--ds-band-text'], muted: tokens['--ds-band-muted'], minScrim: 0.84,
  });
  return {
    '--ds-ctaph-bg': worst,
    '--ds-ctaph-text': text,
    '--ds-ctaph-muted': muted,
    '--ds-ctaph-scrim': `linear-gradient(90deg, ${alpha(scrim, 0.94)}, ${alpha(scrim, 0.84)})`,
  };
}

const Icon = ({ d, size = 18, stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12.2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6.5 12 13l8.5-6.5',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.8 7 21l5-2.5 5 2.5-1.5-7.2',
};

function Slashes({ speed = false }) {
  return (
    <div className="ds-slashes" aria-hidden="true">
      <span className="ds-slash" />
      <span className="ds-slash" />
      <span className="ds-slash" />
      {speed && <span className="ds-speed" />}
    </div>
  );
}

// What a published page shows where a photo is missing: the business
// initial as a slanted race number over the slash motif.
function Monogram({ name }) {
  const letter = (txt(name).match(/[A-Za-z0-9]/) || ['•'])[0].toUpperCase();
  return (
    <div className="ds-mono" aria-hidden="true">
      <Slashes />
      <span className="ds-mono-letter">{letter}</span>
    </div>
  );
}

// Owner-facing hint for an empty slot; never reaches the published page.
function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="ds-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

const fill = { position: 'absolute', inset: 0, height: '100%' };
const nameKey = (s) => txt(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const awardNames = (biz) => list(biz.awards).map((a) => txt(a && typeof a === 'object' ? a.name : a)).filter(Boolean);
const aboutTitleOf = (biz) => {
  const tagline = txt(biz.tagline).replace(/\s+/g, ' ');
  const name = txt(biz.businessName);
  return tagline && tagline.length <= 60 ? tagline : name ? `About ${name}` : 'About Us';
};

// The design's own heading text per section, shown while the owner typed
// none in Edit > Headings (copy.sectionTitles): { [sectionId]: { eyebrow?,
// title?, accent? } }. accent is what the page highlights while the
// Highlighted words field is empty ('' = nothing): only the hero headline
// has a highlight of its own (its second half, splitHeadline). The template
// renders from the same values, so the Headings tab and the page never
// disagree. businessInfo as the template receives it (normalizeBusinessInfo).
// Never throws, whatever a saved row holds.
export function headingDefaults(businessInfo, generatedCopy) {
  const biz = isObj(businessInfo) ? businessInfo : {};
  const copy = isObj(generatedCopy) ? generatedCopy : {};
  const fb = getFallbacks(biz.businessType);
  const awards = awardNames(biz);
  const shownAwards = awards.length > 0 && !list(copy.hiddenSections).includes('awards');
  const heroTitle = txt(copy.headline) || sectionTitle(copy.sectionTitles, 'hero').title || txt(biz.businessName);
  const fs = isObj(copy.featuredService) ? copy.featuredService : {};
  return {
    hero: { eyebrow: shownAwards ? awards[0] : fb.heroBadge, title: heroTitle, accent: splitHeadline(heroTitle)[1] },
    brands: { eyebrow: makesEyebrowDefault(businessKindOf(biz.businessType)) },
    services: { eyebrow: 'What We Do', title: 'Our Services', accent: '' },
    featured: featuredTitleDefaults(txt(fs.serviceName), Boolean(sectionTitle(copy.sectionTitles, 'featured').title)),
    about: { eyebrow: 'About Us', title: aboutTitleOf(biz), accent: '' },
    gallery: { eyebrow: 'Gallery', title: 'Our Work', accent: '' },
    testimonials: { eyebrow: 'Testimonials', title: 'What Clients Say', accent: '' },
    cta: { eyebrow: 'Contact', title: fb.ctaHeadline, accent: '' },
  };
}

export default function DetailingSporty({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const font = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const fb = getFallbacks(biz.businessType);
  const tokens = sportyTokens(t);

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrderAdded(copy, sections.map((s) => s.id), addedSections);
  const hd = headingDefaults(biz, copy);
  // Edit > Headings: each section's own eyebrow / title / highlight / intro,
  // '' where the owner typed none (the design's text then shows).
  const st = (id) => sectionTitle(copy.sectionTitles, id);

  const name = txt(biz.businessName);
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const place = [txt(biz.city), txt(biz.state)].filter(Boolean).join(', ');
  const hours = hoursRows(biz.hours);
  const hoursSummary = hoursFact(hours);
  const payments = list(biz.paymentMethods).map(txt).filter(Boolean);
  const awards = list(biz.awards).map((a) => txt(a && typeof a === 'object' ? a.name : a)).filter(Boolean);
  const showAwards = awards.length > 0 && show('awards');
  const warranty = txt(biz.warranty);
  const email = txt(biz.email);
  const address = txt(biz.address);
  const area = txt(biz.serviceArea);
  const years = txt(biz.yearsInBusiness);
  const yearsLabel = years && (/^\d+\+?$/.test(years) ? `${years} ${years === '1' ? 'year' : 'years'}` : years);

  // Services: the owner's Services tab (businessInfo.services, mirrored to
  // packages by normalizeBusinessInfo) wins over the AI list; an owner
  // service with no description borrows the AI description of the same
  // service, so the generated copy is not thrown away.
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
      // Package details (Edit > Services): only what the owner set; a card
      // without them looks as it always has.
      summary: txt(s.summary),
      badge: txt(s.badge),
      image: txt(s.image),
      includes: serviceIncludes(s.includes),
    }))
    .filter((s) => s.name || s.description || s.price);
  const svcT = st('services');
  const servicesTitle = txt(copy.servicesSection?.title) || svcT.title || 'Our Services';
  // The owner's intro prints as typed (raw), like it always has.
  const servicesIntro = txt(copy.servicesSection?.intro) ? copy.servicesSection.intro : svcT.intro;
  const svcCols = services.length === 1 ? 'ds-c1' : services.length === 2 || services.length === 4 ? 'ds-c2' : 'ds-c3';
  const anyServicePhoto = services.some((s) => s.image);
  // Where cards share a row, a package badge sits in a strip every card
  // keeps free, so photos and titles stay level across the row.
  const badgeRow = svcCols !== 'ds-c1' && services.some((s) => s.badge);
  const pkgOn = show('services') && services.some((s) => s.badge || s.image || s.includes.length > 0);

  // Services in the hero (Edit > Hero): copy.heroCard 'quote' (price card) or
  // 'list'; unset is 'off', so a site that never chose keeps today's hero.
  const heroCard = heroCardModeOf(copy.heroCard, 'off');
  const offer = heroOfferOf({ services, heroServices: copy.heroServices, mode: heroCard });
  const heroOn = show('hero') && offer.hasCard;

  // Google rating (Edit > Google Rating): only from the owner's connected
  // place, and only in the spots they switch on (none by default).
  const rating = googleRatingOf(biz.googlePlace);
  const badgeAt = googleBadgePlacements(copy.googleBadge, []);
  const badgeIn = (spot) => Boolean(rating) && badgeAt.includes(spot);
  const badgeOn = badgeAt.some(badgeIn);
  // The menu-bar rating's room (FEATURE_CSS .ds-nav-gslot): a typical
  // badge plus its gap, and 6px more per review-count character past two
  // ("1,234"), so a longer count waits for the room it needs.
  const navBadgeCss = badgeIn('nav')
    ? `@container (min-width:${196 + 6 * Math.max(0, rating.countText.length - 2)}px){.ds-nav-g{display:inline-flex}}`
    : '';

  // Featured-service band (Edit > Featured Service): only once the owner
  // picked a service, and on the published page only with something to say.
  const featured = featuredServiceOf({ featuredService: copy.featuredService, services, sectionTitles: copy.sectionTitles, defaults: hd.featured, automatic: false });
  const featuredBody = featuredHasBody(featured, images.featured);
  const featuredOn = show('featured') && Boolean(featured) && (featuredBody || editor);

  // Vehicle-makes band (Edit > Vehicle Makes): only the makes the owner ticked.
  const makes = vehicleMakesFor(copy.vehicleMakes, []);
  const makesOn = show('brands') && makes.length > 0;

  // Business Info > Areas served (the list only, never split from the
  // free-text service area) and the Fully insured switch (only when on).
  const ownAreas = serviceAreasOf({ serviceAreas: biz.serviceAreas });
  const insured = biz.insured === true;

  // Stats only from what the owner entered: About > Stats Box values, else
  // business facts (years, area, hours, payment). No invented numbers.
  const ownerStats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label);
  const specFacts = [
    years && { label: 'Experience', value: yearsLabel },
    area ? { label: 'Service area', value: area } : place && { label: 'Based in', value: place },
    hoursSummary && { label: 'Hours', value: hoursSummary },
    payments.length > 0 && { label: 'Payment', value: payments.join(', ') },
  ].filter(Boolean);
  const aboutStatsMode = (copy.aboutLayout || 'image') === 'stats';
  const panelStats = ownerStats.length > 0
    ? ownerStats.slice(0, 4)
    : years ? [{ value: years, label: /^\d+\+?$/.test(years) ? (years === '1' ? 'Year in business' : 'Years in business') : 'In business' }] : [];
  const aboutShowsStats = aboutStatsMode && panelStats.length > 0 && show('about');
  const barStats = !aboutShowsStats && ownerStats.length > 0 ? ownerStats.slice(0, 4) : null;
  // When the About panel is just the years tile, the bar skips that fact.
  const barFactList = aboutShowsStats && ownerStats.length === 0 ? specFacts.filter((f) => f.label !== 'Experience') : specFacts;
  const barFacts = !barStats && barFactList.length >= 2 ? barFactList : null;
  const barItems = barStats || barFacts || [];

  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);

  const testimonials = list(copy.testimonialPlaceholders).filter((q) => txt(q?.text));
  const reviews = copy.googleWidgetKey ? 'google' : testimonials.length > 0 ? 'quotes' : null;
  // Quotes the owner marked as Google reviews (Edit > Reviews) get the
  // "Google review" label and their stars; AI quotes never do.
  const isGoogleQuote = (q) => q?.source === 'google';
  const placeUrl = googlePlaceUrl(biz.googlePlace);
  const reviewsOn = show('testimonials') && reviews === 'quotes' && testimonials.some(isGoogleQuote);
  const allGoogle = testimonials.length > 0 && testimonials.every(isGoogleQuote);

  const navLinks = [
    show('services') && services.length > 0 && { href: '#services', label: 'Services' },
    show('about') && { href: '#about', label: 'About' },
    show('gallery') && galleryImages.length > 0 && { href: '#gallery', label: 'Work', extra: true },
    show('testimonials') && reviews && { href: '#reviews', label: 'Reviews' },
    // Folds away at 1100px only when the nav's call button takes its place.
    show('cta') && { href: '#contact', label: 'Contact', extra: Boolean(tel) },
  ].filter(Boolean);

  const heroPrimaryHref = txt(copy.ctaPrimaryUrl) || (show('services') && services.length > 0 ? '#services' : '#contact');
  const heroPrimaryLabel = txt(copy.ctaPrimary) || (heroPrimaryHref === '#services' ? 'View Services' : 'Get in Touch');
  const heroSecondaryHref = txt(copy.ctaSecondaryUrl) || tel;
  const heroSecondaryLabel = txt(copy.ctaSecondary) || (phone ? `Call ${phone}` : '');
  const splitHero = copy.heroLayout === 'split';
  // Where the hero card's and the featured band's booking links go while
  // the booking widget is off (they carry data-scheduler-trigger, so with it
  // on they open the widget): the phone, else the contact section while it
  // shows, else an email, else the top of the page.
  const bookHref = tel || (show('cta') ? '#contact' : email ? `mailto:${email}` : '#top');
  const heroMeta = [years && (/^\d+\+?$/.test(years) ? `${yearsLabel} in business` : years), insured && 'Fully insured', place].filter(Boolean);
  const heroT = st('hero');
  const headline = txt(copy.headline) || heroT.title || name;
  const [headLead, headEm] = splitHeadline(headline);
  // The owner's highlighted words (Edit > Headings) when they are whole
  // words of the headline; a stale one keeps the design's own highlight.
  const ownHero = heroT.accent ? splitAccent(headline, heroT.accent) : null;
  // AI headlines run 20-65 characters: step the size down for long ones,
  // and cap it so the longest word (uppercase, heavy) fits the column
  // instead of breaking mid-word (--ds-lw ~ its width in em). A face wider
  // than Inter also gets a proportionally smaller design size (--ds-wd), so
  // it keeps Inter's line count and the buttons stay on the first screen.
  const capEm = capsEm(font);
  const h1Size = headline.length > 60 ? ' ds-h1-long' : headline.length > 44 ? ' ds-h1-mid' : '';
  const h1Fit = fitLw(headline, capEm);
  // The same fit for every other heading that can print owner words;
  // card titles are untracked, so a capital runs ~0.03em wider there.
  const fit = (text, extra = 0) => ({ '--ds-lw': fitLw(text, capEm + extra) });

  const vars = {
    '--ds-bg': t.bg,
    '--ds-surface': t.surface,
    '--ds-text': t.text,
    '--ds-muted': t.textMuted,
    '--ds-accent-text': t.accentText,
    '--ds-accent-soft': t.accentSoft,
    '--ds-border': t.border,
    '--ds-border-strong': t.borderStrong,
    '--ds-focus': t.focus,
    '--ds-scrim': t.heroScrim,
    '--ds-scrim-left': t.heroScrimLeft,
    '--ds-on-hero': t.onHero,
    '--ds-head': font,
    '--ds-body': body,
    '--ds-head-w': loadedWeight(font, 900),
    '--ds-head-w2': loadedWeight(font, 800),
    '--ds-wd': Math.max(1, capEm / 0.74).toFixed(3),
    '--ds-gutter': 'clamp(20px, 5cqi, 48px)',
    ...tokens,
  };
  // The kit's phone menu + action bar get the same white-on-red fill.
  const kitColors = { bg: t.bg, text: t.text, accent: tokens['--ds-accent'], onAccent: tokens['--ds-on-accent'] };

  // Logo if uploaded, else the two-tone wordmark (first word, rest in red).
  const words = name.split(/\s+/).filter(Boolean);
  const brand = (logoStyle, loading) => (images.logo ? (
    <PhotoSlot src={images.logo} alt={name ? `${name} logo` : 'Logo'} loading={loading} style={logoStyle} imgStyle={{ objectFit: 'contain', objectPosition: 'left center' }} />
  ) : (
    <span className="ds-wordmark">
      {words[0]}
      {words.length > 1 && <> <span>{words.slice(1).join(' ')}</span></>}
    </span>
  ));

  const heroText = (
    <>
      {heroT.eyebrow ? (
        // The owner's own tag line (Edit > Headings) replaces the award /
        // business-type tag; it is their words, not an award.
        <p className="ds-tag">{heroT.eyebrow}</p>
      ) : showAwards ? (
        <p className="ds-tag" data-acg-awards=""><Icon d={ICONS.award} size={16} stroke={2} />{awards[0]}</p>
      ) : (
        <p className="ds-tag">{fb.heroBadge}</p>
      )}
      <h1 className={`ds-h1${h1Size}${ownHero ? ' ds-h1-own' : ''}`} style={{ '--ds-lw': h1Fit }}>
        {ownHero ? (
          // The owner's words can sit mid-headline, so their bar is drawn
          // as an underline that the next line cannot cover (.ds-h1-own).
          <>{ownHero.before}<span className="ds-em">{ownHero.match}</span>{ownHero.after}</>
        ) : (
          <>
            {headLead}
            {headEm && <>{' '}<span className="ds-em">{headEm}</span></>}
          </>
        )}
      </h1>
      {txt(copy.subheadline) && <p className="ds-lead">{copy.subheadline}</p>}
      <div className="ds-actions">
        <a className="ds-btn ds-btn-primary" href={heroPrimaryHref}>{heroPrimaryLabel}</a>
        {heroSecondaryHref && heroSecondaryLabel && (
          <a className="ds-btn ds-btn-ghost" href={heroSecondaryHref}>{heroSecondaryLabel}</a>
        )}
      </div>
      {badgeIn('hero') && (
        <div className="ds-hero-g">
          <GoogleRatingBadge
            place={biz.googlePlace}
            className="ds-gpill"
            starSize=".95em"
            starColor={images.hero && !splitHero ? GOOGLE_STAR_GOLD : ensureContrast(GOOGLE_STAR_GOLD, t.bg, 3)}
          />
        </div>
      )}
      {heroMeta.length > 0 && (
        <ul className="ds-meta">
          {heroMeta.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
    </>
  );

  // The hero's services card (kit HeroOffer, styled by FEATURE_CSS). Its
  // Book links open the booking widget, else call or go to the contact band.
  const heroOffer = heroOn && (
    <div className="ds-hq-slot">
      <HeroOffer
        ns="ds-hq"
        mode={offer.picks.length ? 'quote' : 'list'}
        picks={offer.picks.length ? offer.picks : offer.listPicks}
        bookHref={bookHref}
        tel={tel}
        phoneLabel={phone}
        listCta={show('services') && services.length ? { href: '#services', label: 'See All Services' } : { href: bookHref, label: 'Book Now', books: true }}
        labels={{ sub1: 'Choose the package that fits your ride.' }}
      />
    </div>
  );
  // The price card offers only priced packages: say why it is missing.
  const heroCardHint = show('hero') && heroCard === 'quote' && offer.picks.length === 0 && services.some((s) => s.name) && (
    <EditorHint>Your price card needs services with a price (Edit &gt; Services).</EditorHint>
  );

  const aboutParas = txt(copy.aboutText).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // Facts under the About text, minus any the stats bar already shows.
  const barShown = show('statsBar') ? barItems.map((f) => f.value) : [];
  const aboutFacts = [
    years && { label: 'In business', value: yearsLabel },
    place && { label: 'Based in', value: place },
    area && { label: 'Service area', value: area },
  ].filter((f) => f && !barShown.includes(f.value));
  // The owner's tagline heads the About section when it fits a heading;
  // a long one becomes a pull line under a plain heading instead.
  const tagline = txt(biz.tagline).replace(/\s+/g, ' ');
  const taglineFits = tagline.length > 0 && tagline.length <= 60;
  const aboutT = st('about');
  const aboutTitle = aboutT.title || (taglineFits ? tagline : name ? `About ${name}` : 'About Us');
  const aboutTagLine = tagline && !taglineFits ? tagline : '';
  const galleryT = st('gallery');
  const galleryTitle = galleryT.title || 'Our Work';
  const reviewsT = st('testimonials');
  const reviewsTitle = reviewsT.title || 'What Clients Say';
  // The Google widget's heading: the owner's widget title (raw, as always)
  // or their Headings title; none = no heading.
  const widgetTitle = txt(copy.googleReviewsTitle) ? copy.googleReviewsTitle : reviewsT.title;

  const ctaT = st('cta');
  const ctaTitle = txt(copy.ctaHeadline) || ctaT.title || fb.ctaHeadline;
  const contactPrimaryLabel = txt(copy.ctaButtonText) || txt(copy.ctaPrimary) || 'Get a Quote';
  const contactPrimaryHref = txt(copy.ctaUrl) || tel;
  // The editor's Contact > "Phone / Secondary Button" (text + URL, default
  // the phone). It shows once the primary goes somewhere else, or when the
  // owner named it; never as a second copy of the primary link.
  const contactSecondaryText = txt(copy.ctaSecondaryText);
  const contactSecondaryHref = (contactSecondaryText && txt(copy.ctaSecondaryUrl)) || tel;
  const contactSecondaryLabel = contactSecondaryText || (phone ? `Call ${phone}` : '');
  const showContactSecondary = Boolean(contactSecondaryHref && contactSecondaryLabel && contactSecondaryHref !== contactPrimaryHref
    && (txt(copy.ctaUrl) || contactSecondaryText));
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, place].filter(Boolean).join(', '))}`
    : null;
  // With the owner's Areas served list, the free-text service area joins
  // that row instead of a second pin row right above it.
  const foldArea = ownAreas.length > 0 && Boolean(area);

  // Footer (Edit > Footer, footerSpec): without copy.footer the cells are
  // today's brand / Explore / Contact / Hours, in that order, untitled by the
  // owner and with no button. The owner's columns may add Service Areas
  // (their list, else the service area / city) and the footer button.
  const footAreas = serviceAreasOf(biz);
  // The social icons live in the logo column; with that column off (the
  // owner's footer only) they move to the contact column.
  const social = hasSocialLinks(biz, images);
  const footPlan = footerPlan({
    footer: copy.footer,
    spec: footerSpec,
    ctaFallback: show('cta') ? '#contact' : null,
    has: (type, { builder, cta, shown }) => ({
      brand: true,
      links: navLinks.length > 0,
      areas: footAreas.length > 0,
      contact: builder ? Boolean(tel || email || address || place || cta || (social && !shown.includes('brand'))) : true,
      hours: hours.length > 0,
    })[type],
  });
  const footSocialMoved = footPlan.builder && social && !footPlan.cells.some((c) => c.type === 'brand');
  const footN = footPlan.cells.length;
  const footCols = footPlan.cells[0]?.type === 'brand' && footN > 1
    ? `minmax(0,1.4fr) repeat(${footN - 1},minmax(0,1fr))`
    : `repeat(${Math.max(1, footN)},minmax(0,1fr))`;
  // The footer's Google line sits under the brand block, or in the bottom
  // bar when the owner switched the brand column off.
  const footBadge = badgeIn('footer') && footPlan.cells.some((c) => c.type === 'brand');
  const footBarBadge = badgeIn('footer') && !footBadge;
  const footBottomText = footPlan.builder ? footPlan.bottomText : '';
  // An owner's footer can have five narrow columns: let a long email
  // wrap before its @ rather than mid-word.
  const emailBreak = (e) => (e.indexOf('@') > 0 ? <>{e.slice(0, e.indexOf('@'))}<wbr />{e.slice(e.indexOf('@'))}</> : e);

  // Contact band over the owner's CTA Background photo.
  const ctaPhoto = Boolean(images.cta) && show('cta');
  const titlesOn = isObj(copy.sectionTitles) && Object.keys(copy.sectionTitles).length > 0;
  // Any feature on the page: only then does FEATURE_CSS join the <style>.
  const featureOn = heroOn || badgeOn || footPlan.builder || pkgOn || titlesOn || featuredOn || makesOn
    || ownAreas.length > 0 || insured || reviewsOn || ctaPhoto;

  const tile = (f, i, hot) => (
    <div key={`${f.label}-${i}`} className={`ds-tile${hot ? ' ds-tile-hot' : ''}`} data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
      <dt className="ds-label">{f.label}</dt>
      <dd className="ds-tile-value">{f.value}</dd>
    </div>
  );

  return (
    <div
      id="top"
      className="ds-root"
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.6, ...(ctaPhoto ? ctaPhotoTokens(tokens) : {}) }}
    >
      <style>{CSS + (heroOn ? heroOfferCss('ds-hq', { stackFrom: 1024 }) : '') + (pkgOn ? packageDetailsCss('ds-pk') : '') + (featuredOn ? featuredBandCss('ds-ft') : '') + (makesOn ? makesBandCss('ds-mk') : '') + (featureOn ? FEATURE_CSS : '') + navBadgeCss}</style>
      <a className="ds-skip" href="#main">Skip to content</a>

      <nav className="ds-nav" aria-label="Main" style={{ order: -1 }}>
        <div className="ds-wrap ds-nav-in">
          <a className="ds-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
            {brand({ height: 40, width: 'auto', maxWidth: 190 }, 'eager')}
          </a>
          {badgeIn('nav') && (
            <div className="ds-nav-gslot">
              <span className="ds-nav-g">
                <GoogleRatingBadge place={biz.googlePlace} variant="inline" starColor={ensureContrast(t.accent, t.bg, 3)} starSize={14} />
              </span>
            </div>
          )}
          {(navLinks.length > 0 || tel) && (
            <div className="ds-links">
              {navLinks.map((l) => (
                <a key={l.href} className={`ds-link${l.extra ? ' ds-link-x' : ''}`} href={l.href}>{l.label}</a>
              ))}
              {tel && <a className="ds-btn ds-btn-primary ds-btn-sm ds-nav-cta" href={tel}>{phone}</a>}
            </div>
          )}
          <MobileMenu
            links={navLinks}
            cta={tel ? { href: tel, label: `Call ${phone}` } : { href: '#contact', label: 'Contact us' }}
            colors={kitColors}
            font={body}
          />
        </div>
      </nav>

      <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
        {!show('hero') && <h1 className="ds-sr">{name}</h1>}

        {show('hero') && !splitHero && (
          <header data-section="hero" className={`ds-hero${images.hero ? ' ds-has-media' : ''}${heroOn ? ' ds-hero-offer' : ''}`} style={{ order: order('hero') }}>
            {images.hero && (
              <>
                <div className="ds-hero-media">
                  <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
                </div>
                <div className="ds-hero-scrim" />
                <div className="ds-hero-fade" />
              </>
            )}
            <Slashes speed={!images.hero} />
            {heroOn ? (
              // With the services card: copy left, card right (stacked below
              // 1024px).
              <div className="ds-wrap ds-hq-grid">
                <div className="ds-hero-body">
                  {heroText}
                  {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
                </div>
                {heroOffer}
              </div>
            ) : (
              <div className="ds-wrap">
                <div className="ds-hero-body">
                  {heroText}
                  {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
                  {heroCardHint}
                </div>
              </div>
            )}
          </header>
        )}

        {show('hero') && splitHero && (
          <header data-section="hero" className={`ds-split${heroOn ? ' ds-split-offer' : ''}`} style={{ order: order('hero') }}>
            <div className="ds-split-text">
              <Slashes speed />
              {heroText}
              {heroCardHint}
            </div>
            {/* Without a photo the published page shows the monogram, which
                earns its place beside the text but not as a block under it. */}
            <div className={`ds-split-photo${images.hero || editor ? '' : ' ds-split-mono'}`}>
              <PhotoSlot src={images.hero} slot="hero" alt="" loading="eager" fetchPriority="high" style={fill} fallback={<Monogram name={name} />} />
            </div>
            {/* The services card: over the photo column from 1024px, a row
                under the hero below that, right after the copy on phones. */}
            {heroOffer}
          </header>
        )}

        {show('statsBar') && (barItems.length > 0 || editor) && (
          <section data-section="statsBar" aria-label="At a glance" style={{ order: order('statsBar'), background: t.bg }}>
            {barItems.length > 0 ? (
              <dl className={`ds-tiles ds-n${barItems.length}${barStats ? '' : ' ds-facts'}`}>
                {barItems.map((f, i) => tile(f, i, i % 4 === 0 || i % 4 === 3))}
              </dl>
            ) : (
              <div className="ds-wrap" style={{ paddingTop: 8, paddingBottom: 28 }}>
                <EditorHint>This bar shows your real facts. Add Years in Business in Edit &gt; Business Info, or stats in Edit &gt; About &gt; Stats Box.</EditorHint>
              </div>
            )}
          </section>
        )}

        {makesOn && (
          // Focusable so a keyboard user can pause the scrolling logos.
          <section data-section="brands" id="makes" className="ds-mk-makes" aria-label="Vehicle makes" tabIndex={0} style={{ order: order('brands') }}>
            <MakesBand ns="ds-mk" eyebrow={st('brands').eyebrow || hd.brands.eyebrow} makes={makes} />
          </section>
        )}

        {show('services') && services.length > 0 && (
          <section data-section="services" id="services" className="ds-section" aria-labelledby="ds-services-h" style={{ order: order('services') }}>
            <ServiceCardCss />
            <div className="ds-wrap">
              <div className={`ds-head${servicesIntro ? '' : ' ds-head-solo'}`} data-acg-reveal="">
                <div>
                  <p className="ds-eyebrow">{svcT.eyebrow || 'What We Do'}</p>
                  <div className="ds-fit ds-fit-h2">
                    <h2 id="ds-services-h" className="ds-h2" style={fit(servicesTitle)}>
                      <Accented title={servicesTitle} accent={svcT.accent || hd.services.accent} className="ds-em" />
                    </h2>
                  </div>
                </div>
                {servicesIntro && <p className="ds-intro">{servicesIntro}</p>}
              </div>
              <div className={`ds-grid ${svcCols}${badgeRow ? ' ds-pk-row' : ''}`}>
                {services.map((s, i) => (
                  <div key={`${s.name}-${i}`} className="ds-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <article className={`acg-svc-card ds-card${s.badge ? ' ds-card-feat' : ''}${anyServicePhoto ? ' ds-card-ph' : ''}`}>
                      <span className="ds-card-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                      {s.badge && <PackageBadge ns="ds-pk" text={s.badge} />}
                      <PackagePhoto ns="ds-pk" src={s.image} alt={s.name} anyPhoto={anyServicePhoto} editor={editor} />
                      {s.name && (
                        <div className="ds-fit ds-card-head">
                          <h3 className="ds-card-title" style={fit(s.name, 0.03)}>{s.name}</h3>
                        </div>
                      )}
                      {s.price && <p className="ds-price">{s.price}</p>}
                      <ServiceDescription
                        id={`svc-more-${fromPackages ? 'pkg' : 'ai'}-${i}`}
                        text={s.description}
                        style={{ position: 'relative', marginTop: 14, color: 'var(--ds-muted)', fontSize: 15.5, lineHeight: 1.7 }}
                        accentColor="var(--ds-accent-text)"
                      />
                      {s.includes.length > 0 && <PackageIncludes ns="ds-pk" items={s.includes} label="What's Included" checkStroke={2.5} />}
                      <div className="acg-svc-foot">
                        <div className="ds-card-foot">
                          <BookNowLink serviceName={s.name} phone={phone} label={<>Book now <Icon d={ICONS.arrow} size={16} stroke={2} /></>} />
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {featuredOn && (
          <section data-section="featured" id="featured" className="ds-section ds-ft-band" aria-labelledby="ds-featured-h" style={{ order: order('featured') }}>
            <div className="ds-wrap" data-acg-reveal="">
              <FeaturedBand
                ns="ds-ft"
                image={images.featured}
                alt={`${featured.name}${name ? ` by ${name}` : ''}`}
                heading={(
                  <>
                    {featured.eyebrow && <p className="ds-eyebrow">{featured.eyebrow}</p>}
                    <div className="ds-fit ds-fit-band">
                      <h2 id="ds-featured-h" className="ds-band-h" style={fit(featured.title || featured.name)}>
                        <Accented title={featured.title || featured.name} accent={featured.accent} className="ds-em" />
                      </h2>
                    </div>
                  </>
                )}
                intro={featured.intro}
                priceFrom={featured.priceFrom}
                price={featured.price}
                bullets={featured.bullets}
                button={(
                  <div className="ds-actions">
                    <a
                      className="ds-btn ds-btn-inv"
                      href={featured.buttonUrl || bookHref}
                      {...bookingAttrs(!featured.buttonUrl, featured.name)}
                    >
                      {featured.buttonText}
                    </a>
                  </div>
                )}
                hints={(
                  <>
                    {!featuredBody && <EditorHint>This band shows on your site once it has a photo, a price or a list of benefits (Edit &gt; Featured Service).</EditorHint>}
                    {featuredBody && !images.featured && <EditorHint>{PHOTO_HINTS.featured}</EditorHint>}
                  </>
                )}
              />
            </div>
          </section>
        )}

        {show('about') && (
          <section data-section="about" id="about" className="ds-section ds-alt" aria-labelledby="ds-about-h" style={{ order: order('about') }}>
            <div className="ds-wrap ds-about">
              <div data-acg-reveal="">
                {aboutShowsStats ? (
                  <dl className="ds-statpanel">
                    {panelStats.map((s, i) => tile(s, i, i % 4 === 0 || i % 4 === 3))}
                  </dl>
                ) : (
                  <div className="ds-frame">
                    <div className="ds-media">
                      <PhotoSlot
                        src={images.about}
                        slot="about"
                        alt={name ? `${name} at work` : 'Our work'}
                        style={fill}
                        fallback={<Monogram name={name} />}
                      />
                    </div>
                  </div>
                )}
                {aboutStatsMode && panelStats.length === 0 && (
                  <EditorHint>Add your stats in Edit &gt; About &gt; Stats Box (the photo shows until then).</EditorHint>
                )}
              </div>
              <div data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                <p className="ds-eyebrow">{aboutT.eyebrow || 'About Us'}</p>
                <div className="ds-fit ds-fit-h2" style={{ marginBottom: 28 }}>
                  <h2 id="ds-about-h" className="ds-h2" style={fit(aboutTitle)}>
                    <Accented title={aboutTitle} accent={aboutT.accent || hd.about.accent} className="ds-em" />
                  </h2>
                </div>
                {badgeIn('about') && (
                  <div className="ds-about-g">
                    <GoogleRatingBadge place={biz.googlePlace} className="ds-gpill" starSize=".95em" starColor={ensureContrast(GOOGLE_STAR_GOLD, t.surface, 3)} />
                  </div>
                )}
                {aboutTagLine && <p className="ds-pull">{aboutTagLine}</p>}
                {aboutParas.length > 0 && (
                  <div className="ds-prose">
                    {aboutParas.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                )}
                {aboutFacts.length > 0 && (
                  <dl className="ds-dl">
                    {aboutFacts.map((f) => (
                      <div key={f.label}>
                        <dt className="ds-label">{f.label}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </section>
        )}

        {show('gallery') && (galleryImages.length > 0 || editor) && (
          <section data-section="gallery" id="gallery" className="ds-section" aria-labelledby="ds-gallery-h" style={{ order: order('gallery') }}>
            <div className="ds-wrap">
              <div className="ds-head ds-head-solo" data-acg-reveal="">
                <div>
                  <p className="ds-eyebrow">{galleryT.eyebrow || 'Gallery'}</p>
                  <div className="ds-fit ds-fit-h2">
                    <h2 id="ds-gallery-h" className="ds-h2" style={galleryT.title ? fit(galleryTitle) : undefined}>
                      <Accented title={galleryTitle} accent={galleryT.accent || hd.gallery.accent} className="ds-em" />
                    </h2>
                  </div>
                </div>
              </div>
              {galleryImages.length === 0 ? (
                <PhotoSlot slot="gallery" style={{ minHeight: 220 }} />
              ) : galleryImages.length > 3 ? (
                <>
                  <div className="ds-track" role="region" aria-label="Photo gallery, scroll sideways for more" tabIndex={0}>
                    {galleryImages.map((src, i) => (
                      <figure key={i} className="ds-shot">
                        <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      </figure>
                    ))}
                  </div>
                  <p className="ds-swipe" aria-hidden="true">Swipe or scroll for more →</p>
                </>
              ) : (
                <div className={`ds-gal ds-g${galleryImages.length}`}>
                  {galleryImages.map((src, i) => (
                    <figure key={i} className="ds-shot" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'google' && (
          <section data-section="testimonials" id="reviews" className="ds-section" aria-label={txt(copy.googleReviewsTitle) || reviewsT.title || 'Reviews'} style={{ order: order('testimonials') }}>
            <div className="ds-wrap">
              {(widgetTitle || badgeIn('reviews')) && (
                <div className="ds-head ds-head-solo">
                  <div>
                    {widgetTitle && (
                      <>
                        <p className="ds-eyebrow">{reviewsT.eyebrow || 'Reviews'}</p>
                        <div className="ds-fit ds-fit-h2">
                          <h2 className="ds-h2" style={fit(widgetTitle)}>
                            <Accented title={widgetTitle} accent={reviewsT.accent} className="ds-em" />
                          </h2>
                        </div>
                      </>
                    )}
                    {badgeIn('reviews') && (
                      <div className="ds-rev-g">
                        <GoogleRatingBadge place={biz.googlePlace} className="ds-gpill" starSize=".95em" starColor={ensureContrast(GOOGLE_STAR_GOLD, t.bg, 3)} />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="ds-reviews-widget">
                <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
              </div>
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'quotes' && (
          <section data-section="testimonials" id="reviews" className="ds-section ds-alt" aria-labelledby="ds-reviews-h" style={{ order: order('testimonials') }}>
            <div className="ds-wrap">
              <div className="ds-head ds-head-solo" data-acg-reveal="">
                <div>
                  <p className="ds-eyebrow">{reviewsT.eyebrow || 'Testimonials'}</p>
                  <div className="ds-fit ds-fit-h2">
                    <h2 id="ds-reviews-h" className="ds-h2" style={reviewsT.title ? fit(reviewsTitle) : undefined}>
                      <Accented title={reviewsTitle} accent={reviewsT.accent || hd.testimonials.accent} className="ds-em" />
                    </h2>
                  </div>
                  {badgeIn('reviews') && (
                    <div className="ds-rev-g">
                      <GoogleRatingBadge place={biz.googlePlace} className="ds-gpill" starSize=".95em" starColor={ensureContrast(GOOGLE_STAR_GOLD, t.surface, 3)} />
                    </div>
                  )}
                </div>
              </div>
              <div className={`ds-grid ${testimonials.length === 1 ? 'ds-c1' : testimonials.length === 2 || testimonials.length === 4 ? 'ds-c2' : 'ds-c3'}`}>
                {testimonials.map((q, i) => {
                  // Only a quote the owner marked as a Google review (Edit >
                  // Reviews) gets the label and its stars.
                  const google = q?.source === 'google';
                  const stars = reviewStars(q);
                  const Src = placeUrl ? 'a' : 'span';
                  const srcLink = placeUrl ? { href: placeUrl, target: '_blank', rel: 'noopener noreferrer' } : {};
                  return (
                    <div key={i} className="ds-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                      <figure className="ds-quote">
                        <svg className="ds-quote-mark" width="38" height="29" viewBox="0 0 34 26" fill="currentColor" aria-hidden="true">
                          <path d="M0 26V15.6C0 6.9 4.6 1.7 13.2 0l1.5 3.4C9.8 5 7.4 8 7.1 12.2H14V26H0zm19.3 0V15.6C19.3 6.9 23.9 1.7 32.5 0L34 3.4c-4.9 1.6-7.3 4.6-7.6 8.8h6.9V26H19.3z" />
                        </svg>
                        {stars > 0 && <StarRow rating={stars} size={18} gap={3} color="currentColor" className="ds-rev-stars" />}
                        <blockquote><p>{q.text}</p></blockquote>
                        {(txt(q.name) || txt(q.vehicle) || txt(q.role) || google) && (
                          <figcaption>
                            {txt(q.name)}
                            {(txt(q.vehicle) || txt(q.role)) && <span>{txt(q.vehicle) || txt(q.role)}</span>}
                            {google && <Src className="ds-rev-src" {...srcLink}>Google review{placeUrl && <span className="ds-sr"> (opens Google Maps)</span>}</Src>}
                          </figcaption>
                        )}
                      </figure>
                    </div>
                  );
                })}
              </div>
              {placeUrl && reviewsOn && (
                <a className="ds-rev-more" href={placeUrl} target="_blank" rel="noopener noreferrer">
                  {allGoogle ? 'Read more reviews' : 'See our Google reviews'}
                  <span className="ds-sr"> (opens Google Maps)</span>
                </a>
              )}
            </div>
          </section>
        )}

        {show('cta') && (
          <section data-section="cta" id="contact" className="ds-cta" aria-labelledby="ds-contact-h" style={{ order: order('cta') }}>
            {/* The grid is an inner box: contact-form.js appends its inquiry
                form to #contact, and it must land below both panels. */}
            <div className="ds-contact">
              <div className={`ds-band${ctaPhoto ? ' ds-band-has-photo' : ''}`}>
                {ctaPhoto && (
                  <>
                    <div className="ds-band-photo" aria-hidden="true"><PhotoSlot src={images.cta} alt="" /></div>
                    <div className="ds-band-scrim" aria-hidden="true" />
                  </>
                )}
                <div data-acg-reveal="">
                  <p className="ds-eyebrow">{ctaT.eyebrow || 'Contact'}</p>
                  <div className="ds-fit ds-fit-band">
                    <h2 id="ds-contact-h" className="ds-band-h" style={fit(ctaTitle)}>
                      <Accented title={ctaTitle} accent={ctaT.accent || hd.cta.accent} className="ds-em" />
                    </h2>
                  </div>
                  <p className="ds-band-lead">{txt(copy.ctaSubtext) || ctaT.intro || 'Get in touch to schedule a service or ask a question.'}</p>
                  {tel && (
                    <a className="ds-band-phone" href={tel}><Icon d={ICONS.phone} size={30} stroke={2} />{phone}</a>
                  )}
                  {(contactPrimaryHref || showContactSecondary) && (
                    <div className="ds-actions">
                      {contactPrimaryHref && (
                        <a
                          className="ds-btn ds-btn-inv"
                          href={contactPrimaryHref}
                          {...(txt(copy.ctaUrl) ? {} : { 'data-scheduler-trigger': '' })}
                        >
                          {contactPrimaryLabel}
                        </a>
                      )}
                      {showContactSecondary && (
                        <a className="ds-btn ds-btn-inv-ghost" href={contactSecondaryHref}>{contactSecondaryLabel}</a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="ds-details">
                <div data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                  <h3 className="ds-details-h">{address ? 'Find Us' : 'Reach Us'}</h3>
                  <ul className="ds-rows">
                    {phone && (
                      <li className="ds-row">
                        <span className="ds-icon"><Icon d={ICONS.phone} /></span>
                        <span className="ds-row-body">
                          <span className="ds-label">Phone</span>
                          <span className="ds-row-value">{tel ? <a href={tel}>{phone}</a> : phone}</span>
                        </span>
                      </li>
                    )}
                    {email && (
                      <li className="ds-row">
                        <span className="ds-icon"><Icon d={ICONS.mail} /></span>
                        <span className="ds-row-body">
                          <span className="ds-label">Email</span>
                          <span className="ds-row-value"><a href={`mailto:${email}`}>{email}</a></span>
                        </span>
                      </li>
                    )}
                    {(address || place || (area && !foldArea)) && (
                      <li className="ds-row">
                        <span className="ds-icon"><Icon d={ICONS.pin} /></span>
                        <span className="ds-row-body">
                          <span className="ds-label">{address ? 'Location' : area && !foldArea ? 'Service area' : 'Based in'}</span>
                          <span className="ds-row-value">
                            {address ? <a href={mapsHref} target="_blank" rel="noopener noreferrer">{[address, place].filter(Boolean).join(', ')}</a> : (foldArea ? place : (area || place))}
                          </span>
                          {address && area && !foldArea && <span className="ds-row-value" style={{ color: 'var(--ds-muted)' }}>Serving {area}</span>}
                        </span>
                      </li>
                    )}
                    {ownAreas.length > 0 && (
                      <li className="ds-row">
                        <span className="ds-icon"><Icon d={ICONS.map} /></span>
                        <span className="ds-row-body">
                          <span className="ds-label">Areas we serve</span>
                          {foldArea && <span className="ds-row-value">{area}</span>}
                          <span className="ds-chips">
                            {ownAreas.map((a) => <span key={a} className="ds-chip">{a}</span>)}
                          </span>
                        </span>
                      </li>
                    )}
                    {hours.length > 0 && (
                      <li className="ds-row">
                        <span className="ds-icon"><Icon d={ICONS.clock} /></span>
                        <span className="ds-row-body">
                          <span className="ds-label">Hours</span>
                          {hours.length === 1 && !hours[0].time ? (
                            <span className="ds-row-value">{hours[0].days}</span>
                          ) : (
                            <dl className="ds-hours">
                              {hours.map((h) => (
                                <div key={h.days} style={{ display: 'contents' }}>
                                  <dt>{h.days}</dt>
                                  <dd>{h.time}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </span>
                      </li>
                    )}
                    {insured && (
                      <li className="ds-row">
                        <span className="ds-icon"><Icon d={ICONS.shield} /></span>
                        <span className="ds-row-body">
                          <span className="ds-label">Insurance</span>
                          <span className="ds-row-value">Fully insured</span>
                        </span>
                      </li>
                    )}
                    {payments.length > 0 && (
                      <li className="ds-row">
                        <span className="ds-icon"><Icon d={ICONS.card} /></span>
                        <span className="ds-row-body">
                          <span className="ds-label">We accept</span>
                          <span className="ds-chips">
                            {payments.map((p) => <span key={p} className="ds-chip">{p}</span>)}
                          </span>
                        </span>
                      </li>
                    )}
                    {warranty && (
                      <li className="ds-row">
                        <span className="ds-icon"><Icon d={ICONS.shield} /></span>
                        <span className="ds-row-body">
                          <span className="ds-label">Warranty</span>
                          <span className="ds-row-value">{warranty}</span>
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {show('awards') && (awards.length > 0 || editor) && (
          <section data-section="awards" className="ds-awards" aria-label="Awards and recognition" style={{ order: order('awards') }}>
            <div className="ds-wrap">
              {awards.length > 0 ? (
                <div className="ds-awards-in" data-acg-awards="" data-acg-reveal="fade">
                  <p className="ds-eyebrow">Recognition</p>
                  <ul className="ds-award-list">
                    {awards.map((a, i) => (
                      <li key={`${a}-${i}`} className="ds-award"><Icon d={ICONS.award} size={22} />{a}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EditorHint>Awards show here once you add them in Edit &gt; Business Info &gt; Awards.</EditorHint>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="ds-foot" style={{ order: 9999 }}>
        <div className="ds-wrap">
          <div
            className={`ds-foot-grid${footPlan.builder ? ' ds-fb' : ''}`}
            style={footPlan.builder ? { '--ds-fcols': footCols } : undefined}
          >
            {footPlan.cells.map((c) => (c.type === 'brand' ? (
              <div key="brand" className="ds-foot-brand">
                <a className="ds-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
                  {brand({ height: 48, width: 'auto', maxWidth: 200 })}
                </a>
                {txt(copy.footerTagline) && <p className="ds-foot-tag">{copy.footerTagline}</p>}
                {footBadge && (
                  <div className="ds-foot-g">
                    <GoogleRatingBadge place={biz.googlePlace} variant="inline" starColor={tokens['--ds-footer-em']} starSize={16} />
                  </div>
                )}
                <div className="ds-social">
                  <SocialRow biz={biz} color={tokens['--ds-footer-em']} size={18} gap={10} images={images} />
                </div>
              </div>
            ) : c.type === 'links' ? (
              <div key="links">
                <p className="ds-foot-h">{c.title}</p>
                <ul className="ds-foot-list">
                  {navLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
            ) : c.type === 'areas' ? (
              <div key="areas">
                <p className="ds-foot-h">{c.title}</p>
                <ul className="ds-foot-list">
                  {footAreas.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            ) : c.type === 'contact' ? (
              <div key="contact">
                <p className="ds-foot-h">{c.title}</p>
                <ul className="ds-foot-list">
                  {tel && <li><a href={tel}>{phone}</a></li>}
                  {email && <li><a href={`mailto:${email}`}>{footPlan.builder ? emailBreak(email) : email}</a></li>}
                  {address && <li>{address}</li>}
                  {place && <li>{place}</li>}
                </ul>
                {footSocialMoved && (
                  <div className="ds-social">
                    <SocialRow biz={biz} color={tokens['--ds-footer-em']} size={18} gap={10} images={images} />
                  </div>
                )}
                {footPlan.cta && (
                  <a
                    className="ds-btn ds-btn-primary ds-btn-sm ds-foot-cta"
                    href={footPlan.cta.href}
                    {...bookingAttrs(footPlan.cta.books)}
                  >
                    {footPlan.cta.label}
                  </a>
                )}
              </div>
            ) : (
              <div key="hours">
                <p className="ds-foot-h">{c.title}</p>
                <ul className="ds-foot-list">
                  {hours.map((h) => <li key={h.days}>{h.time ? `${h.days} ${h.time}` : h.days}</li>)}
                </ul>
              </div>
            )))}
          </div>
          <div className="ds-foot-bottom">
            {/* The copyright (or "Serving") line stays the footer's last <p>:
                the published page appends its "Site owner" link there. */}
            <p>© <span data-acg-year="">{new Date().getFullYear()}</span> {name}. All rights reserved.</p>
            {footBarBadge && (
              <div className="ds-foot-g">
                <GoogleRatingBadge place={biz.googlePlace} variant="inline" starColor={tokens['--ds-footer-em']} starSize={14} />
              </div>
            )}
            {footBottomText ? <div className="ds-foot-note">{footBottomText}</div> : area && <p>Serving {area}</p>}
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref="#contact" colors={kitColors} font={body} />
    </div>
  );
}
