// Chrome Elite (mobile_chrome): black & silver, ultra-premium.
// The first real theme-ready template and the one to copy (see CLAUDE.md,
// "Template contract"). What makes it static-export safe:
//   - every color is a deriveTheme() token exposed as a --mc-* variable, so
//     an owner's palette repaints the whole page, "chrome" included;
//   - all CSS lives in the one prefixed <style> below: @container layout,
//     hover inside (hover:hover), motion inside prefers-reduced-motion;
//   - no useState/useEffect: the nav is opaque by default and only gets
//     glass + shadow from html[data-acg-scrolled] (siteRuntime.js);
//   - facts (stats, awards, hours) render only when the owner entered them,
//     and editor hints go through PhotoSlot / EditorOnly.
//
// Owner-editable features (CLAUDE.md, "Feature blocks"): the hero services
// card, the Google rating badge, the footer builder, package details, section
// headings, the featured-service band, the vehicle-makes band, service areas
// + insured, Google review labels, a contact background photo and the
// Before & After band. They are the kit's shared blocks (HeroOffer,
// PackageDetails, FeaturedBand, MakesBand, BeforeAfterBand) in this design's
// look (FEATURE_CSS, BA_CSS). Live sites use this design, so every feature
// is opt-in: it renders only from the owner's own new data, and a site that
// saved none of it gets exactly the markup, CSS and root variables it had
// before the features existed (MobileChrome.golden.test.jsx).
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import { ServiceCardCss, ServiceDescription, BookNowLink } from '../ServiceCardParts.jsx';
import { buildSectionOrderAdded } from '../../../../lib/sectionOrder.js';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS } from '../../../../lib/businessHours.js';
import { deriveTheme, mix, alpha, ensureContrast, heroScrimBase, overPhoto } from '../kit/theme.js';
import { PhotoSlot, PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';
import { Accented } from '../kit/Accented.jsx';
import { serviceIncludes, serviceAreasOf, sectionTitle, splitAccent, businessKindOf, hasSocialLinks } from '../kit/content.js';
import {
  heroCardModeOf, heroOfferOf, featuredServiceOf, featuredHasBody, featuredTitleDefaults, makesEyebrowDefault, reviewStars, footerPlan, bookingAttrs,
} from '../kit/features.js';
import { HeroOffer, heroOfferCss } from '../kit/HeroOffer.jsx';
import { PackageBadge, PackagePhoto, PackageIncludes, packageDetailsCss } from '../kit/PackageDetails.jsx';
import { FeaturedBand, featuredBandCss } from '../kit/FeaturedBand.jsx';
import { MakesBand, makesBandCss } from '../kit/MakesBand.jsx';
import { vehicleMakesFor } from '../kit/vehicleMakes.js';
import { BeforeAfterBand, beforeAfterCss } from '../kit/BeforeAfter.jsx';
import { beforeAfterPairs, BA_DEFAULTS } from '../kit/beforeAfter.js';
import { GoogleRatingBadge, StarRow, GOOGLE_STAR_GOLD, googleRatingOf, googlePlaceUrl, googleBadgePlacements } from '../kit/GoogleRatingBadge.jsx';

export const themeReady = true;

// Default top-to-bottom order. The original eight ids are ContentEditor's
// TOGGLEABLE._default, which saved sites store in copy.sectionOrder /
// copy.hiddenSections: never rename an id. 'brands' (the vehicle-makes band),
// 'featured' (the featured-service band) and 'beforeAfter' (the Before &
// After band) came later: see addedSections.
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'statsBar', label: 'Stats Bar' },
  { id: 'brands', label: 'Vehicle Makes' },
  { id: 'services', label: 'Services' },
  { id: 'featured', label: 'Featured Service' },
  { id: 'about', label: 'About' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'beforeAfter', label: 'Before & After' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'cta', label: 'Contact / CTA' },
  { id: 'awards', label: 'Awards' },
];

// Ids added after sites were saved with this design. They are ordered by
// buildSectionOrderAdded: every original id keeps exactly its old order
// value, and an added id the owner has not placed shares the value of the
// section before it (it sits right after that section in the DOM, so the
// CSS order tie keeps it there).
export const addedSections = ['brands', 'featured', 'beforeAfter'];

export const extraFonts = [];

// Edit > Headings: the copy.sectionTitles fields each section uses (any
// other field is ignored by this design). titleFrom / introFrom name the copy
// key that owns that text; the Headings tab edits it there (the Before &
// After heading and intro live in copy.beforeAfter, like Bold & Sporty's).
// Stats Bar and Awards have no heading. headingDefaults() below gives the
// design's text.
export const headingFields = {
  hero: { fields: ['eyebrow', 'title', 'accent'], titleFrom: 'headline' },
  brands: { fields: ['eyebrow'] },
  services: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'servicesSection.title', introFrom: 'servicesSection.intro' },
  featured: { fields: ['eyebrow', 'title', 'accent', 'intro'] },
  about: { fields: ['eyebrow', 'title', 'accent'] },
  gallery: { fields: ['eyebrow', 'title', 'accent'] },
  beforeAfter: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'beforeAfter.title', introFrom: 'beforeAfter.intro', placeholder: { intro: BA_DEFAULTS.intro } },
  testimonials: { fields: ['eyebrow', 'title', 'accent', 'intro'] },
  cta: { fields: ['eyebrow', 'title', 'accent', 'intro'], titleFrom: 'ctaHeadline', introFrom: 'ctaSubtext' },
};

// Edit > Footer (kit/features.js footerPlan): the design's own footer (logo
// column, Explore, Contact) while the owner saved none; Service Areas and
// Hours are columns an owner can switch on, and the footer button stays off
// until the owner turns it on.
export const footerSpec = {
  columns: [
    { type: 'brand', show: true },
    { type: 'links', show: true },
    { type: 'areas', show: false },
    { type: 'contact', show: true },
    { type: 'hours', show: false },
  ],
  titles: { links: 'Explore', areas: 'Service Areas', contact: 'Contact', hours: 'Hours' },
  mergeHours: false,
  cta: false,
  ctaLabel: 'Book Now',
  notes: {
    brand: 'Your logo or name, Footer Tagline, social icons and Google rating. Switched off, the rating moves to the bottom line.',
    contact: 'Phone, email and city from Business Info, and your social icons while the logo column is off.',
  },
  // What fills the contact column (the Footer panel's "nothing to list"
  // check); the social icons move there while the logo column is off.
  contactFields: ['phone', 'email', 'city', 'state'],
  socialWhenBrandOff: true,
};

const CSS = `
.mc-wrap{width:100%;max-width:1240px;margin:0 auto;padding-left:var(--mc-gutter);padding-right:var(--mc-gutter)}
.mc-root :where(h1,h2,h3,p,ul,ol,dl,dd,figure,blockquote){margin:0}
.mc-root :where(ul,ol){list-style:none;padding:0}
.mc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.mc-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 18px;border-radius:4px;background:var(--mc-accent);color:var(--mc-on-accent);font-weight:600;text-decoration:none}
.mc-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.mc-root a:focus-visible,.mc-root summary:focus-visible,.mc-root label:focus-visible,.mc-track:focus-visible{outline:2px solid var(--mc-focus);outline-offset:3px}
.mc-eyebrow{display:inline-flex;align-items:center;gap:14px;font-size:12px;font-weight:600;line-height:1.4;letter-spacing:.26em;text-transform:uppercase;color:var(--mc-accent-text)}
.mc-eyebrow::before{content:'';flex:none;width:32px;height:1px;background:var(--mc-line-solid)}
.mc-chrome-text{color:var(--mc-accent-text)}
@supports ((-webkit-background-clip:text) or (background-clip:text)){
.mc-chrome-text,.mc-h1 span{-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.mc-chrome-text{background-image:var(--mc-chrome-text)}
.mc-h1 span{background-image:var(--mc-h1-grad)}
.mc-has-media .mc-h1 span{background-image:var(--mc-h1-grad-hero)}
}
.mc-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin-top:20px;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-size:13px;font-weight:500;line-height:1.45;color:inherit;opacity:.85}

.mc-nav{position:sticky;top:0;z-index:100;background:var(--mc-bg);border-bottom:1px solid var(--mc-border)}
html[data-acg-scrolled] .mc-nav{box-shadow:0 14px 36px -18px var(--mc-shadow)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){html[data-acg-scrolled] .mc-nav{background:var(--mc-glass);-webkit-backdrop-filter:blur(18px) saturate(150%);backdrop-filter:blur(18px) saturate(150%)}}
.mc-nav-in{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:76px}
.mc-brand{flex:1 1 auto;display:inline-flex;align-items:center;gap:12px;min-width:0;color:var(--mc-text);text-decoration:none}
.mc-orb{flex:none;width:24px;height:24px;border-radius:50%;background:var(--mc-orb);box-shadow:0 0 0 1px var(--mc-border),0 4px 14px -4px var(--mc-glow)}
.mc-wordmark{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mc-head);font-size:15px;font-weight:600;letter-spacing:.2em;text-transform:uppercase}
.mc-links{flex:none;display:flex;align-items:center;gap:clamp(20px,2.6cqi,34px)}
.mc-link{position:relative;padding:12px 0;color:var(--mc-muted);font-size:12.5px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;text-decoration:none}
.mc-link::after{content:'';position:absolute;left:0;right:0;bottom:6px;height:1px;background:var(--mc-line-solid);transform:scaleX(0);transform-origin:left center}

.mc-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 30px;border:1px solid transparent;border-radius:2px;font-family:var(--mc-body);font-size:13px;font-weight:600;line-height:1.2;letter-spacing:.16em;text-transform:uppercase;text-align:center;text-decoration:none;cursor:pointer}
.mc-btn:active{transform:translateY(1px)}
.mc-btn-chrome{color:var(--mc-on-accent);background-image:var(--mc-chrome);background-color:var(--mc-accent);background-size:220% 100%;background-position:0 0;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 14px 34px -18px var(--mc-glow)}
.mc-btn-ghost{color:var(--mc-text);background:transparent;border-color:var(--mc-border-strong)}
.mc-btn-sm{min-height:44px;padding:0 20px;font-size:12px}

.mc-hero{position:relative;isolation:isolate;display:flex;align-items:flex-end;min-height:clamp(580px,calc(100vh - 76px),920px);padding:clamp(88px,11cqi,150px) 0 clamp(56px,7cqi,96px);background:var(--mc-bg);color:var(--mc-text);overflow:clip}
.mc-hero-media{position:absolute;inset:0;z-index:-3}
.mc-hero-scrim{position:absolute;inset:0;z-index:-2;background:var(--mc-scrim-left)}
.mc-hero-fade{position:absolute;left:0;right:0;bottom:0;height:24%;z-index:-1;background:var(--mc-hero-fade)}
.mc-has-media{color:var(--mc-on-hero);text-shadow:0 1px 28px rgba(0,0,0,.28)}
.mc-has-media .mc-lead,.mc-has-media .mc-hero-meta{color:var(--mc-on-hero-muted)}
.mc-has-media .mc-eyebrow{color:var(--mc-on-hero)}
.mc-has-media .mc-hero-meta{border-top-color:var(--mc-on-hero-line)}
.mc-has-media .mc-btn-ghost{color:var(--mc-on-hero);border-color:var(--mc-on-hero-line)}
.mc-decor{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(48% 58% at 80% 40%,var(--mc-glow-soft),transparent 72%)}
.mc-lines{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,transparent 0 119px,var(--mc-hairline) 119px 120px);-webkit-mask-image:linear-gradient(90deg,transparent,black 30%,black 70%,transparent);mask-image:linear-gradient(90deg,transparent,black 30%,black 70%,transparent)}
.mc-rings{position:absolute;top:50%;right:max(-14cqi,-200px);width:min(64cqi,780px);aspect-ratio:1;translate:0 -50%;pointer-events:none}
.mc-ring{position:absolute;top:50%;left:50%;aspect-ratio:1;border-radius:50%;translate:-50% -50%;background:conic-gradient(from 200deg,transparent 0deg,var(--mc-ring) 50deg,transparent 115deg,transparent 180deg,var(--mc-ring-soft) 245deg,transparent 305deg);-webkit-mask:radial-gradient(closest-side,transparent calc(100% - 1.5px),black calc(100% - 1px));mask:radial-gradient(closest-side,transparent calc(100% - 1.5px),black calc(100% - 1px))}
.mc-ring:nth-child(1){width:100%}
.mc-ring:nth-child(2){width:76%;rotate:140deg}
.mc-ring:nth-child(3){width:52%;rotate:260deg}
.mc-hub{position:absolute;top:50%;left:50%;width:10%;aspect-ratio:1;border-radius:50%;translate:-50% -50%;background:var(--mc-orb);opacity:.2}
.mc-hero-body{position:relative;max-width:900px}
.mc-h1{margin-top:24px;font-family:var(--mc-head);font-size:clamp(42px,7cqi,96px);font-weight:600;line-height:1.03;letter-spacing:-.03em;text-wrap:balance}
.mc-lead{margin-top:24px;max-width:600px;font-size:clamp(17px,1.6cqi,20px);line-height:1.65;color:var(--mc-muted);text-wrap:pretty}
.mc-actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:40px}
.mc-hero-meta{display:flex;flex-wrap:wrap;gap:12px 32px;margin-top:clamp(40px,5cqi,64px);padding-top:22px;border-top:1px solid var(--mc-border);font-size:12px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--mc-muted)}
.mc-hero-meta li{display:inline-flex;align-items:center;gap:10px}
.mc-hero-meta li::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--mc-orb)}
.mc-split{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);min-height:clamp(560px,calc(100vh - 76px),880px);background:var(--mc-bg);color:var(--mc-text)}
.mc-split-text{position:relative;isolation:isolate;overflow:clip;display:flex;flex-direction:column;justify-content:center;padding:clamp(64px,8cqi,120px) clamp(24px,5cqi,80px) clamp(64px,8cqi,120px) max(var(--mc-gutter),calc((100cqi - 1240px) / 2 + var(--mc-gutter)))}
.mc-split .mc-h1{font-size:clamp(40px,5.4cqi,80px)}
.mc-split-photo{position:relative;min-height:440px;background:var(--mc-surface)}
.mc-split-photo::before{content:'';position:absolute;z-index:1;top:0;bottom:0;left:0;width:1px;background:var(--mc-line-v)}

.mc-facts{position:relative;background:var(--mc-surface);border-top:1px solid var(--mc-border);border-bottom:1px solid var(--mc-border)}
.mc-facts-grid{display:grid}
.mc-n1{grid-template-columns:minmax(0,1fr)}
.mc-n2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mc-n3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mc-n4{grid-template-columns:repeat(4,minmax(0,1fr))}
.mc-fact{padding:clamp(26px,3cqi,40px) clamp(18px,2.4cqi,32px);border-left:1px solid var(--mc-border)}
.mc-fact:first-child{border-left:0;padding-left:0}
.mc-fact:last-child{padding-right:0}
.mc-label{display:block;font-size:11px;font-weight:600;line-height:1.4;letter-spacing:.24em;text-transform:uppercase;color:var(--mc-muted)}
.mc-fact-value{display:block;margin-top:10px;font-family:var(--mc-head);font-size:clamp(17px,1.6cqi,20px);font-weight:500;line-height:1.4;color:var(--mc-text);white-space:pre-line}
.mc-stat-value{display:block;font-family:var(--mc-head);font-size:clamp(38px,4.4cqi,58px);font-weight:600;line-height:1.05;letter-spacing:-.03em}
.mc-stat{display:flex;flex-direction:column-reverse;justify-content:flex-end}
.mc-stat .mc-label{margin-top:12px}

.mc-section{position:relative;padding:clamp(72px,8.5cqi,120px) 0;scroll-margin-top:76px}
.mc-section::before{content:'';position:absolute;top:0;left:50%;width:min(1144px,calc(100% - 2 * var(--mc-gutter)));height:1px;translate:-50% 0;background:var(--mc-line)}
.mc-alt{background:var(--mc-surface)}
.mc-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:end;gap:20px clamp(32px,6cqi,96px);margin-bottom:clamp(40px,5cqi,72px)}
.mc-head-solo{grid-template-columns:minmax(0,1fr)}
.mc-h2{margin-top:20px;font-family:var(--mc-head);font-size:clamp(34px,4.6cqi,60px);font-weight:600;line-height:1.06;letter-spacing:-.03em;color:var(--mc-text);text-wrap:balance}
.mc-h2-xl{font-size:clamp(38px,5.6cqi,76px)}
.mc-intro{font-size:17px;line-height:1.75;color:var(--mc-muted);text-wrap:pretty}
.mc-grid{display:grid;gap:clamp(14px,1.6cqi,22px)}
.mc-c1{grid-template-columns:minmax(0,640px)}
.mc-c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mc-c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mc-cell{display:flex;min-width:0}
.mc-card{flex:1;position:relative;padding:clamp(26px,2.6cqi,36px);background:var(--mc-surface);border:1px solid var(--mc-border);border-radius:4px;overflow:hidden}
.mc-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:var(--mc-line);opacity:.8}
.mc-card-top{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.mc-idx{font-family:var(--mc-head);font-size:13px;font-weight:600;letter-spacing:.18em;color:var(--mc-accent-text)}
.mc-price{font-family:var(--mc-head);font-size:clamp(26px,2.4cqi,32px);font-weight:600;line-height:1.1;letter-spacing:-.02em;white-space:nowrap}
.mc-card-title{margin-top:28px;font-family:var(--mc-head);font-size:clamp(20px,1.8cqi,23px);font-weight:600;line-height:1.25;letter-spacing:-.01em;color:var(--mc-text)}
.mc-card .acg-svc-foot{padding-top:26px}
.mc-card .acg-svc-more{min-height:32px;padding-top:6px;letter-spacing:.04em}
.mc-foot-line{padding-top:12px;border-top:1px solid var(--mc-border)}
.mc-card .acg-svc-book{display:inline-flex;align-items:center;gap:10px;min-height:44px;color:var(--mc-accent-text);font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;text-decoration:none}

.mc-about{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:center;gap:clamp(40px,7cqi,112px)}
.mc-frame{position:relative;padding:14px}
.mc-frame::before,.mc-frame::after{content:'';position:absolute;width:56px;height:56px;border:0 solid var(--mc-accent-text);opacity:.7;pointer-events:none}
.mc-frame::before{top:0;left:0;border-top-width:1px;border-left-width:1px}
.mc-frame::after{right:0;bottom:0;border-right-width:1px;border-bottom-width:1px}
.mc-media{position:relative;aspect-ratio:4/5;overflow:hidden;border-radius:2px;background:var(--mc-surface);border:1px solid var(--mc-border)}
.mc-prose p{font-size:17px;line-height:1.8;color:var(--mc-muted);white-space:pre-line;text-wrap:pretty}
.mc-prose p+p{margin-top:18px}
.mc-prose p:first-child{font-size:clamp(18px,1.7cqi,21px);line-height:1.65;color:var(--mc-text)}
.mc-dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 32px;margin-top:36px;padding-top:28px;border-top:1px solid var(--mc-border)}
.mc-dl dd{margin-top:8px;font-size:16px;line-height:1.5;color:var(--mc-text)}
.mc-statpanel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--mc-border);border:1px solid var(--mc-border);border-radius:2px;overflow:hidden}
.mc-statpanel>div{display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:clamp(24px,3cqi,40px);background:var(--mc-surface)}
.mc-statpanel>div:last-child:nth-child(odd){grid-column:1 / -1}
.mc-mono{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(80% 70% at 30% 20%,var(--mc-glow-soft),transparent 70%),var(--mc-surface)}
.mc-mono .mc-rings{top:50%;left:50%;right:auto;width:118%;translate:-50% -50%}
.mc-mono-letter{position:relative;font-family:var(--mc-head);font-size:clamp(96px,14cqi,200px);font-weight:600;line-height:1;letter-spacing:-.04em}

.mc-gal{display:grid;gap:clamp(10px,1.2cqi,16px)}
.mc-g1{grid-template-columns:minmax(0,1fr)}
.mc-g1 .mc-shot{aspect-ratio:21/9}
.mc-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mc-g2 .mc-shot{aspect-ratio:4/3}
.mc-g3{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));height:clamp(420px,52cqi,640px)}
.mc-g3 .mc-shot:first-child{grid-row:1 / span 2}
.mc-shot{position:relative;min-height:0;overflow:hidden;border-radius:2px;background:var(--mc-surface)}
.mc-track{display:flex;gap:clamp(12px,1.4cqi,18px);overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc(-1 * var(--mc-gutter));padding:0 var(--mc-gutter) 4px;scroll-padding:0 var(--mc-gutter)}
.mc-track::-webkit-scrollbar{display:none}
.mc-track .mc-shot{flex:0 0 auto;width:clamp(240px,30cqi,380px);aspect-ratio:4/5;scroll-snap-align:start}
.mc-swipe{margin-top:20px;font-size:12px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--mc-muted)}

.mc-quote{flex:1;position:relative;display:flex;flex-direction:column;padding:clamp(28px,3cqi,40px);background:var(--mc-bg);border:1px solid var(--mc-border);border-radius:4px}
.mc-quote-mark{display:block;color:var(--mc-accent-text)}
.mc-quote blockquote{flex:1;margin-top:22px}
.mc-quote blockquote p{font-size:17px;line-height:1.75;color:var(--mc-text);text-wrap:pretty}
.mc-quote figcaption{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:28px;padding-top:20px;border-top:1px solid var(--mc-border);font-size:12.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--mc-text)}
.mc-quote figcaption span{font-weight:500;letter-spacing:.06em;text-transform:none;color:var(--mc-muted)}
.mc-reviews-widget{margin-top:8px}

.mc-contact{overflow:clip;isolation:isolate}
.mc-contact .mc-rings{top:42%;right:max(-26cqi,-320px);width:min(62cqi,760px);z-index:-1;opacity:.75;animation:none}
.mc-contact .mc-hub{display:none}
.mc-contact-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:clamp(40px,6cqi,96px);align-items:start}
.mc-contact .mc-lead{max-width:520px}
.mc-panel{position:relative;padding:clamp(24px,3cqi,40px);background:var(--mc-surface);border:1px solid var(--mc-border);border-radius:4px}
.mc-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:var(--mc-line)}
.mc-row{display:flex;gap:18px;padding:18px 0;border-top:1px solid var(--mc-border)}
.mc-row:first-child{padding-top:0;border-top:0}
.mc-row:last-child{padding-bottom:0}
.mc-icon{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:1px solid var(--mc-border-strong);color:var(--mc-accent-text)}
.mc-row-body{min-width:0;flex:1}
.mc-row-value{display:block;margin-top:6px;font-size:16px;line-height:1.55;color:var(--mc-text);overflow-wrap:anywhere}
.mc-row-value a{color:inherit;text-decoration:none;border-bottom:1px solid var(--mc-border-strong)}
.mc-hours{display:grid;grid-template-columns:auto 1fr;gap:4px 20px;margin-top:8px;font-size:15px;line-height:1.55}
.mc-hours dt{color:var(--mc-text);font-weight:500}
.mc-hours dd{color:var(--mc-muted)}
.mc-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.mc-chip{padding:5px 12px;border:1px solid var(--mc-border-strong);border-radius:999px;font-size:13px;line-height:1.5;color:var(--mc-text)}

.mc-awards{position:relative;padding:clamp(40px,5cqi,64px) 0;background:var(--mc-surface);border-top:1px solid var(--mc-border);border-bottom:1px solid var(--mc-border)}
.mc-awards-in{display:flex;flex-wrap:wrap;align-items:center;gap:20px clamp(28px,4cqi,56px)}
.mc-award-list{display:flex;flex-wrap:wrap;gap:16px clamp(24px,3.6cqi,48px)}
.mc-award{display:inline-flex;align-items:center;gap:12px;font-family:var(--mc-head);font-size:clamp(16px,1.5cqi,19px);font-weight:500;line-height:1.35;color:var(--mc-text)}
.mc-award svg{flex:none;color:var(--mc-accent-text)}

.mc-foot{padding:clamp(64px,8cqi,104px) 0 36px;background:var(--mc-footer-bg);color:var(--mc-footer-muted);border-top:1px solid var(--mc-border);font-size:15px;line-height:1.6}
.mc-foot-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);gap:40px clamp(32px,5cqi,80px)}
.mc-foot .mc-brand{color:var(--mc-footer-text)}
.mc-foot-tag{margin-top:18px;max-width:360px}
.mc-foot-h{font-size:11px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--mc-footer-text)}
.mc-foot-list{display:grid;gap:10px;margin-top:18px}
.mc-foot a{color:var(--mc-footer-muted);text-decoration:none}
.mc-social{margin-top:24px}
.mc-social a{width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--mc-border-strong);border-radius:50%}
.mc-foot-bottom{margin-top:clamp(48px,6cqi,72px);padding-top:24px;border-top:1px solid var(--mc-border);font-size:13px}

@media (hover:hover){
.mc-link:hover{color:var(--mc-text)}
.mc-link:hover::after{transform:scaleX(1)}
.mc-btn-chrome:hover{background-position:100% 0;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 18px 40px -16px var(--mc-glow)}
.mc-btn-ghost:hover{border-color:var(--mc-accent-text);background:var(--mc-accent-soft)}
.mc-has-media .mc-btn-ghost:hover{border-color:var(--mc-on-hero);background:var(--mc-on-hero-soft)}
.mc-card:hover{border-color:var(--mc-border-strong);transform:translateY(-3px);box-shadow:0 28px 56px -32px var(--mc-shadow)}
.mc-card:hover::before{opacity:1}
.mc-card .acg-svc-book:hover svg{transform:translateX(4px)}
.mc-shot:hover img{transform:scale(1.04)}
.mc-quote:hover{border-color:var(--mc-border-strong)}
.mc-row-value a:hover{color:var(--mc-accent-text);border-bottom-color:var(--mc-accent-text)}
.mc-foot a:hover{color:var(--mc-footer-text)}
.mc-social a:hover{border-color:var(--mc-accent-text)}
}
@media (prefers-reduced-motion:no-preference){
.mc-nav{transition:background-color .3s ease,box-shadow .3s ease}
.mc-link,.mc-row-value a,.mc-foot a{transition:color .2s ease,border-color .2s ease}
.mc-link::after{transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.mc-btn{transition:background-position .7s cubic-bezier(.2,.7,.2,1),background-color .2s ease,border-color .2s ease,box-shadow .3s ease,transform .15s ease}
.mc-card{transition:transform .35s cubic-bezier(.2,.7,.2,1),border-color .25s ease,box-shadow .35s ease}
.mc-card::before{transition:opacity .25s ease}
.mc-card .acg-svc-book svg{transition:transform .25s ease}
.mc-shot img{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.mc-quote,.mc-social a{transition:border-color .25s ease}
.mc-rings{animation:mc-rings-in 1.8s cubic-bezier(.2,.7,.2,1) both}
@keyframes mc-rings-in{from{opacity:0;rotate:-28deg;scale:.94}to{opacity:1;rotate:0deg;scale:1}}
}

@container (max-width:1100px){.mc-link-x{display:none}}
@container (max-width:900px){
.mc-nav-cta{display:none}
.mc-c3{grid-template-columns:repeat(2,minmax(0,1fr))}
.mc-n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.mc-n4 .mc-fact:nth-child(odd){border-left:0;padding-left:0}
.mc-n4 .mc-fact:nth-child(even){padding-right:0}
.mc-n4 .mc-fact:nth-child(n+3){border-top:1px solid var(--mc-border)}
.mc-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.mc-foot-brand{grid-column:1 / -1}
}
@container (max-width:760px){
.mc-link{letter-spacing:.12em}
.mc-head,.mc-about,.mc-contact-grid{grid-template-columns:minmax(0,1fr)}
.mc-media{aspect-ratio:4/3}
}
@container (max-width:600px){
.mc-links,.mc-nav-cta{display:none}
.mc-nav-in{min-height:64px;gap:12px}
.mc-wordmark{font-size:13px;letter-spacing:.16em}
.mc-orb{width:20px;height:20px}
.mc-hero{min-height:0;padding:64px 0 48px}
.mc-hero.mc-has-media{min-height:clamp(540px,82vh,760px)}
.mc-hero-scrim{background:var(--mc-scrim)}
.mc-h1,.mc-split .mc-h1{font-size:clamp(38px,11cqi,54px);letter-spacing:-.025em}
.mc-lead{font-size:17px}
.mc-actions{flex-direction:column;align-items:stretch;margin-top:32px}
.mc-hero-meta{gap:10px 20px;margin-top:36px}
.mc-hero .mc-rings{top:18%;right:-58cqi;width:120cqi}
.mc-hero .mc-hub{display:none}
.mc-split{grid-template-columns:minmax(0,1fr);min-height:0}
.mc-split-text{padding:56px var(--mc-gutter) 48px}
.mc-split-photo{min-height:0;aspect-ratio:4/3}
.mc-split-photo::before{top:0;right:0;bottom:auto;width:auto;height:1px;background:var(--mc-line)}
.mc-facts-grid{grid-template-columns:minmax(0,1fr)}
.mc-fact,.mc-n4 .mc-fact:nth-child(n){display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding:18px 0;border-left:0;border-top:1px solid var(--mc-border)}
.mc-fact:first-child,.mc-n4 .mc-fact:first-child{border-top:0}
.mc-fact-value{margin-top:0;text-align:right;font-size:16px}
.mc-stats-kind.mc-facts-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.mc-stats-kind .mc-fact,.mc-stats-kind.mc-n4 .mc-fact:nth-child(n){display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:22px 0;border-top:1px solid var(--mc-border)}
.mc-stats-kind .mc-fact:nth-child(-n+2){border-top:0}
.mc-stats-kind .mc-fact:last-child:nth-child(odd){grid-column:1 / -1}
.mc-section{padding:72px 0}
.mc-h2{font-size:clamp(30px,9cqi,40px)}
.mc-c1,.mc-c2,.mc-c3{grid-template-columns:minmax(0,1fr)}
.mc-dl{grid-template-columns:minmax(0,1fr)}
.mc-g2,.mc-g3{grid-template-columns:minmax(0,1fr);grid-template-rows:none;height:auto}
.mc-g3 .mc-shot:first-child{grid-row:auto}
.mc-g1 .mc-shot,.mc-g2 .mc-shot,.mc-g3 .mc-shot{aspect-ratio:4/3}
.mc-track .mc-shot{width:78%}
.mc-contact .mc-rings{top:0;right:-60cqi;width:120cqi}
.mc-foot{padding-top:56px}
.mc-foot-grid{grid-template-columns:minmax(0,1fr)}
}
`;

// The owner-editable features' CSS, appended to CSS only while one of them
// renders (a site without them gets exactly CSS). The kit blocks' own CSS
// (heroOfferCss / packageDetailsCss / featuredBandCss / makesBandCss) comes
// first; these rules point the blocks' --mc-hq-* / -pk- / -ft- / -mk-
// variables at this design's tokens and restyle them in its look: hairlines,
// 2-4px radii, the metallic chrome buttons and orb, small tracked capitals,
// headings in the owner's case.
const FEATURE_CSS = `
.mc-hq-grid{display:grid;gap:clamp(32px,4cqi,64px);align-items:end}
.mc-hq-slot{position:relative;width:100%;max-width:560px;text-shadow:none;--mc-hq-btn-bg:var(--mc-chrome);--mc-hq-btn-text:var(--mc-on-accent);--mc-hq-btn-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 14px 34px -18px var(--mc-glow);--mc-hq-line:var(--mc-border);--mc-hq-line-strong:var(--mc-border-strong);--mc-hq-pick:var(--mc-hq-card-accent);--mc-hq-pick-shadow:0 0 0 1px var(--mc-hq-card-accent);--mc-hq-hover:var(--mc-border-strong);--mc-hq-head:var(--mc-head);--mc-hq-head-w:600;--mc-hq-case:none;--mc-hq-r:4px;--mc-hq-r-ctl:2px;--mc-hq-r-lg:2px;--mc-hq-shadow:0 28px 56px -32px var(--mc-shadow);--mc-hq-focus:var(--mc-hq-card-accent)}
.mc-split-offer{grid-template-rows:1fr auto}
.mc-split-offer>.mc-hq-slot{grid-column:1 / -1;width:auto;max-width:560px;margin:0 var(--mc-gutter) clamp(56px,7cqi,96px) max(var(--mc-gutter),calc((100cqi - 1240px) / 2 + var(--mc-gutter)))}
.mc-hq-back,.mc-hq-q-call{font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}
.mc-hq-quote::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:var(--mc-line)}
.mc-hq-q-cta,.mc-hq-hl-cta,.mc-hq-q-book{background-color:var(--mc-accent);background-size:220% 100%;background-position:0 0;font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}
.mc-hq-step-l,.mc-hq-row-l{text-transform:uppercase;letter-spacing:.26em;font-size:11px}
.mc-hq-q-h,.mc-hq-q-title,.mc-hq-row-v{letter-spacing:-.02em}
.mc-hq-d1,.mc-hq-quote:has(.mc-hq-go:checked) .mc-hq-d2{background:var(--mc-orb)}
.mc-hq-quote svg{stroke-width:1.6}
.mc-hero-g{margin-top:28px}
.mc-gpill{padding:8px 16px;border:1px solid var(--mc-border-strong);border-radius:999px;background:var(--mc-glass);font-size:12.5px;letter-spacing:.06em;color:var(--mc-text);text-decoration:none}
.mc-gpill .acg-gbadge-count{color:var(--mc-muted)}
.mc-has-media .mc-gpill{border-color:var(--mc-on-hero-line);background:rgba(0,0,0,.2);color:var(--mc-on-hero)}
.mc-has-media .mc-gpill .acg-gbadge-count{color:var(--mc-on-hero-muted)}
/* The menu-bar rating gives way to the business name: its slot takes only
   the room the name and the links leave (the name no longer grows into
   it), and the badge shows only while that room fits it (navBadgeCss: a
   size query on the slot, its nearest container). The slot's negative
   margin cancels its extra flex gap, so with the badge hidden the name
   has exactly the room it has without one; the badge's own margin keeps
   it 24px clear of the name. */
.mc-nav-gslot{flex:1 1 0;min-width:0;margin-left:-24px;display:flex;justify-content:flex-end;container-type:inline-size}
.mc-brand:has(+.mc-nav-gslot){flex-grow:0}
.mc-nav-g{display:none;margin-left:24px;font-size:12.5px;color:var(--mc-muted)}
.mc-nav-g a{color:inherit;text-decoration:none}
.mc-about-g{margin:-12px 0 24px}
.mc-rev-g{margin-top:22px}
.mc-foot-g{margin-top:16px;font-size:14px}
.mc-foot a.mc-foot-cta{margin-top:22px;color:var(--mc-on-accent)}
.mc-fb .mc-foot-list{overflow-wrap:anywhere}
.mc-foot-note{margin-top:6px}
.mc-card{--mc-pk-text:var(--mc-text);--mc-pk-muted:var(--mc-muted);--mc-pk-accent:var(--mc-accent-text);--mc-pk-line:var(--mc-border);--mc-pk-badge-bg:transparent;--mc-pk-badge-text:var(--mc-accent-text);--mc-pk-well-bg:var(--mc-bg);--mc-pk-well-ink:var(--mc-border-strong);--mc-pk-r:2px;--mc-pk-focus:var(--mc-focus)}
.mc-pk-badge{align-self:flex-start;margin-top:18px;border:1px solid var(--mc-accent-text);border-radius:999px;padding:5px 14px;font-size:10.5px;font-weight:600;letter-spacing:.2em}
.mc-card-feat{border-color:var(--mc-accent-text)}
.mc-pk-card-photo{margin-bottom:22px;border:1px solid var(--mc-border)}
.mc-pk-inc>summary{font-size:12px;font-weight:600;letter-spacing:.2em}
.mc-pk-inc-h{font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--mc-muted)}
.mc-pk-inc-i{font-size:15px;font-weight:400;line-height:1.5;color:var(--mc-text)}
.mc-ft-band{overflow:clip;isolation:isolate;--mc-ft-text:var(--mc-text);--mc-ft-muted:var(--mc-muted);--mc-ft-accent:var(--mc-accent-text);--mc-ft-r:2px;--mc-ft-photo-max:440px}
.mc-ft-band>.mc-rings{z-index:-1;right:max(-34cqi,-460px);opacity:.35}
.mc-ft-feat-solo{margin-left:0}
.mc-ft-band .mc-hub{display:none}
.mc-ft-feat-photo{border:1px solid var(--mc-border)}
.mc-ft-feat-price{font-size:17px;line-height:1.7}
.mc-ft-feat-price strong{font-family:var(--mc-head);font-size:clamp(22px,2.2cqi,28px);font-weight:600;letter-spacing:-.02em;color:var(--mc-text)}
.mc-ft-feat-list li{line-height:1.6}
.mc-mk-makes{--mc-mk-bg:var(--mc-surface);--mc-mk-text:var(--mc-text);--mc-mk-muted:var(--mc-muted);--mc-mk-line:var(--mc-border);--mc-mk-focus:var(--mc-focus)}
.mc-mk-makes-eye{font-size:11px;font-weight:600;letter-spacing:.26em}
.mc-quote .mc-rev-stars{margin-top:18px;color:var(--mc-accent-text)}
.mc-quote figcaption .mc-rev-src{margin-left:auto;font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--mc-accent-text);text-decoration:none}
.mc-rev-more{display:inline-flex;align-items:center;gap:10px;min-height:44px;margin-top:32px;font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--mc-accent-text);text-decoration:none}
.mc-ctaph{--mc-focus:var(--mc-ctaph-text)}
.mc-ctaph .mc-panel{--mc-focus:var(--mc-accent-text)}
.mc-ctaph-photo{position:absolute;inset:0;z-index:-3}
.mc-ctaph-scrim{position:absolute;inset:0;z-index:-2;background:var(--mc-ctaph-scrim)}
.mc-ctaph>.mc-rings{display:none}
.mc-ctaph .mc-eyebrow,.mc-ctaph .mc-h2{color:var(--mc-ctaph-text)}
.mc-ctaph .mc-lead{color:var(--mc-ctaph-muted)}
.mc-ctaph .mc-btn-ghost{color:var(--mc-ctaph-text);border-color:var(--mc-on-hero-line)}
@supports ((-webkit-background-clip:text) or (background-clip:text)){
.mc-h1 span.mc-h1-em{background-image:var(--mc-chrome-text)}
.mc-has-media .mc-h1 span.mc-h1-em{background-image:var(--mc-h1-grad-hero);text-decoration:underline;text-decoration-color:var(--mc-accent);text-decoration-thickness:.06em;text-underline-offset:.12em}
.mc-ctaph .mc-h2 .mc-chrome-text{background-image:var(--mc-h1-grad-hero);text-decoration:underline;text-decoration-color:var(--mc-accent);text-decoration-thickness:.06em;text-underline-offset:.12em}
}
@media (hover:hover){
.mc-hq-q-cta:hover,.mc-hq-hl-cta:hover,.mc-hq-q-book:hover{background-position:100% 0;filter:none}
.mc-gpill:hover{border-color:var(--mc-accent-text)}
.mc-has-media .mc-gpill:hover{border-color:var(--mc-on-hero)}
.mc-foot a.mc-foot-cta:hover{color:var(--mc-on-accent)}
.mc-nav-g a:hover,.mc-rev-more:hover,.mc-quote figcaption a.mc-rev-src:hover{color:var(--mc-text)}
.mc-ctaph .mc-btn-ghost:hover{border-color:var(--mc-ctaph-text);background:var(--mc-on-hero-soft)}
}
@media (prefers-reduced-motion:no-preference){
.mc-hq-q-cta,.mc-hq-hl-cta,.mc-hq-q-book{transition:background-position .7s cubic-bezier(.2,.7,.2,1),box-shadow .3s ease}
.mc-gpill,.mc-nav-g a,.mc-rev-more,.mc-rev-src{transition:color .2s ease,border-color .2s ease}
}
@container (min-width:601px){.mc-grid:not(.mc-c1) .mc-pk-card-well{display:flex}}
@container (min-width:901px){.mc-foot-grid.mc-fb{grid-template-columns:var(--mc-fcols)}}
@container (min-width:1024px){
.mc-hq-grid{grid-template-columns:minmax(0,1fr) minmax(340px,420px)}
.mc-hq-slot{max-width:none}
.mc-hero-offer .mc-h1{font-size:clamp(40px,5.2cqi,76px)}
.mc-split-offer>.mc-split-photo{grid-column:2;grid-row:1}
.mc-split-offer>.mc-hq-slot{grid-column:2;grid-row:1;align-self:center;justify-self:center;z-index:2;width:min(420px,calc(100% - 2 * clamp(24px,4cqi,56px)));margin:clamp(32px,4cqi,64px) 0}
}
@container (max-width:1100px){.mc-nav-gslot{display:none}}
/* Without container queries (the page's old-browser fallback turns them into
   viewport queries) nothing can tell whether the badge fits: leave it out. */
@supports not (container-type:inline-size){.mc-nav-gslot{display:none}}
@container (max-width:600px){
.mc-split-offer .mc-split-photo{order:1}
.mc-split-offer>.mc-hq-slot{margin-bottom:40px}
.mc-ft-band>.mc-rings{top:0;right:-60cqi;width:120cqi}
}
`;

// The Before & After band (kit BeforeAfter.jsx) in this design's look: a
// hairline frame with the chrome sheen along its top edge (like the service
// cards), 2px corners, tags in the small tracked capitals of the labels, the
// After tag and the handle in the buttons' metallic chrome, a hairline ahead
// of the caption like the eyebrows', and the counter in the cards' numbering
// style beside round hairline arrows. Appended after the kit's
// beforeAfterCss('mc-ba'), at the very end of the style string and only
// while the band renders, so a site without copy.beforeAfter gets none of it
// (and FEATURE_CSS doesn't change). The --mc-ba-* block variables alias
// tokens deriveTheme / chromeTokens already contrast-repair: the Before tag
// is the page's text on its background, the After tag and the handle the
// accent with its ink (every stop of --mc-chrome is checked against that
// ink, as on the chrome buttons).
const BA_CSS = `
.mc-ba-band{--mc-ba-text:var(--mc-text);--mc-ba-muted:var(--mc-muted);--mc-ba-line:var(--mc-border-strong);--mc-ba-focus:var(--mc-focus);--mc-ba-tag-bg:var(--mc-bg);--mc-ba-tag-text:var(--mc-text);--mc-ba-tag2-bg:var(--mc-accent);--mc-ba-tag2-text:var(--mc-on-accent);--mc-ba-knob-bg:var(--mc-accent);--mc-ba-knob-text:var(--mc-on-accent);--mc-ba-r:2px;--mc-ba-tag-r:2px}
.mc-ba-frame{border:1px solid var(--mc-border);box-shadow:0 28px 56px -32px var(--mc-shadow)}
.mc-ba-frame::after{content:'';position:absolute;top:0;left:0;right:0;z-index:4;height:1px;background:var(--mc-line);pointer-events:none}
.mc-ba-todo .mc-ba-frame{border:0;box-shadow:none}
.mc-ba-todo .mc-ba-frame::after{display:none}
.mc-ba-tag{padding:6px 12px;font-size:11px;font-weight:600;letter-spacing:.24em}
.mc-ba-tag-before{box-shadow:inset 0 0 0 1px var(--mc-border-strong)}
.mc-ba-tag-after,.mc-ba-knob{background-image:var(--mc-chrome);background-size:220% 100%}
.mc-ba-tag-after{box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
.mc-ba-cap{position:relative;margin-top:18px;padding-left:46px;font-size:15px;line-height:1.7}
.mc-ba-cap::before{content:'';position:absolute;left:0;top:.85em;width:32px;height:1px;background:var(--mc-line-solid)}
.mc-ba-nav{justify-content:flex-start;gap:12px;margin-top:28px}
.mc-ba-count{order:-1;margin-right:auto;font-family:var(--mc-head);font-size:13px;font-weight:600;letter-spacing:.18em;text-align:left;color:var(--mc-accent-text)}
.mc-ba-btn{width:48px;height:48px}
@media (hover:hover){
.mc-ba-btn:hover{border-color:var(--mc-accent-text);background:var(--mc-accent-soft)}
}
`;

// The hero services card's wording: this design calls them services.
const HQ_LABELS = {
  legend: 'Choose a service',
  q1: 'Which Service Do You Need?',
  sub1: 'Choose the one that fits your car.',
  pick: 'Pick a service to see its price.',
  row: 'Service',
  listTitle: 'Our Services',
};

const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// Hours as display rows { days, time }. Only the per-day editor's shape
// (exactly the seven HOURS_DAYS keys, '' = closed) may say a day is
// "Closed"; it is grouped into runs ("Mon–Fri  9am – 5pm", "Sun  Closed").
// Older free-text hours never gain facts: normalizeBusinessInfo splits
// "Mon-Fri 8am-6pm · Sat 9am-4pm" into { 'Mon-Fri': '8am-6pm', Sat: ... },
// shown one row per pair when every key is a plain day or day range, and
// anything else ("Mon-Fri: 8am-6pm", "By appointment", "..., Sat") as the
// single line formatHours() always produced.
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

// The stats-bar "Hours" fact must be the whole truth in a few words: all
// open rows (one per line) when there are at most two, or a short
// free-text line.
function hoursFact(rows) {
  if (rows.length === 1 && !rows[0].time) return rows[0].days.length <= 40 ? rows[0].days : null;
  const open = rows.filter((r) => r.time && !/^closed$/i.test(r.time));
  return open.length > 0 && open.length <= 2 ? open.map((r) => `${r.days} ${r.time}`).join('\n') : null;
}

// The "chrome" is derived from the owner's accent, not fixed silver: the
// default palette (accent #94a3b8) gives the classic silver sheen, and a
// custom accent gets the same metallic treatment in its own hue. Every stop
// is contrast-checked against the text it sits behind.
function chromeTokens(t) {
  const toward = t.isDark ? '#ffffff' : '#000000';
  const sheenHi = ensureContrast(mix(t.accent, '#ffffff', 0.5), t.onAccent, 4.5);
  const sheenLo = ensureContrast(mix(t.accent, '#000000', 0.14), t.onAccent, 4.5);
  const textHi = ensureContrast(mix(t.accentText, toward, 0.6), t.bg, 4.5);
  const h1Lo = ensureContrast(mix(t.text, t.accentText, 0.55), t.bg, 4.5);
  const footerBg = t.isDark ? mix(t.bg, '#000000', 0.5) : t.surface;
  return {
    '--mc-chrome': `linear-gradient(115deg, ${sheenLo} 0%, ${sheenHi} 26%, ${t.accent} 48%, ${sheenLo} 72%, ${sheenHi} 100%)`,
    '--mc-chrome-text': `linear-gradient(180deg, ${textHi} 12%, ${t.accentText} 68%, ${mix(textHi, t.accentText, 0.5)} 100%)`,
    '--mc-h1-grad': `linear-gradient(180deg, ${t.text} 30%, ${h1Lo} 100%)`,
    '--mc-h1-grad-hero': `linear-gradient(180deg, ${t.onHero} 35%, ${mix(t.onHero, t.accent, 0.28)} 100%)`,
    '--mc-orb': `radial-gradient(circle at 34% 30%, ${sheenHi} 0%, ${t.accent} 42%, ${mix(t.accent, t.bg, 0.55)} 100%)`,
    '--mc-line': `linear-gradient(90deg, transparent, ${alpha(t.accentText, 0.55)} 50%, transparent)`,
    '--mc-line-v': `linear-gradient(180deg, transparent, ${alpha(t.accentText, 0.5)} 50%, transparent)`,
    '--mc-line-solid': `linear-gradient(90deg, ${t.accentText}, ${alpha(t.accentText, 0.25)})`,
    '--mc-hairline': alpha(t.text, t.isDark ? 0.05 : 0.06),
    '--mc-ring': alpha(t.accentText, 0.55),
    '--mc-ring-soft': alpha(t.accentText, 0.22),
    '--mc-glow': alpha(t.accent, 0.4),
    '--mc-glow-soft': alpha(t.accent, t.isDark ? 0.12 : 0.1),
    '--mc-glass': alpha(t.bg, 0.82),
    // Photo heroes melt into a dark page; on a light page that fade would
    // put the white hero text on a light band, so it is dropped.
    '--mc-hero-fade': t.isDark ? `linear-gradient(180deg, transparent, ${t.bg})` : 'none',
    '--mc-shadow': alpha('#000000', t.isDark ? 0.7 : 0.22),
    '--mc-footer-bg': footerBg,
    '--mc-footer-text': ensureContrast(t.text, footerBg, 4.5),
    '--mc-footer-muted': ensureContrast(t.textMuted, footerBg, 4.5),
    '--mc-on-hero-muted': alpha(t.onHero, 0.88),
    '--mc-on-hero-line': alpha(t.onHero, 0.42),
    '--mc-on-hero-soft': alpha(t.onHero, 0.1),
  };
}

// The hero services card (only while it renders): a surface-colored card
// with page-colored option rows, every text color repaired against what it
// sits on (theme:check contrast-tests each --mc-hq-*-text|muted with its
// --mc-hq-*-bg).
function chromeOfferVars(t) {
  const rowBg = mix(t.surface, t.text, 0.04);
  return {
    '--mc-hq-card-bg': t.surface,
    '--mc-hq-card-text': ensureContrast(t.text, t.surface, 4.5),
    '--mc-hq-card-muted': ensureContrast(t.textMuted, t.surface, 4.5),
    '--mc-hq-card-accent': ensureContrast(t.accentText, t.surface, 4.5),
    '--mc-hq-opt-bg': t.bg,
    '--mc-hq-opt-text': t.text,
    '--mc-hq-opt-muted': t.textMuted,
    '--mc-hq-opt-accent': t.accentText,
    '--mc-hq-row-bg': rowBg,
    '--mc-hq-row-text': ensureContrast(t.text, rowBg, 4.5),
    '--mc-hq-row-muted': ensureContrast(t.textMuted, rowBg, 4.5),
    '--mc-hq-row-accent': ensureContrast(t.accentText, rowBg, 4.5),
  };
}

// The contact section over the owner's background photo (only while it
// renders): white-ish copy under its own scrim of deriveTheme's scrim base
// (the page darkened on a dark palette, near-black on a light one), at
// least 80% opaque at every width, so at most a fifth of the photo shows
// through where the copy sits. The copy is repaired for that (kit
// overPhoto: a mid-grey and a near-white photo pixel); --mc-ctaph-bg is the
// mid-grey mix theme:check pairs it with.
function chromeCtaPhotoVars(t) {
  const base = heroScrimBase(t.bg, t.isDark);
  const { lit, text, muted } = overPhoto({ base, text: t.onHero, muted: mix(t.onHero, base, 0.2), minScrim: 0.8 });
  return {
    '--mc-ctaph-bg': lit,
    '--mc-ctaph-text': text,
    '--mc-ctaph-muted': muted,
    '--mc-ctaph-scrim': `linear-gradient(90deg, ${alpha(base, 0.9)}, ${alpha(base, 0.8)})`,
  };
}

const list = (v) => (Array.isArray(v) ? v : []);

// The design's own heading text for each section, used while the owner has
// typed none (copy.sectionTitles): { [sectionId]: { eyebrow?, title?,
// accent? } }. The template renders from these and Edit > Headings shows
// them as placeholders, so the two never disagree. accent '' = nothing is
// highlighted. businessInfo as the template receives it.
export function headingDefaults(businessInfo, generatedCopy) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const fb = getFallbacks(biz.businessType);
  const name = txt(biz.businessName);
  const fs = copy.featuredService && typeof copy.featuredService === 'object' ? copy.featuredService : {};
  const ft = sectionTitle(copy.sectionTitles, 'featured');
  return {
    hero: { eyebrow: fb.heroBadge, title: txt(copy.headline) || name, accent: '' },
    brands: { eyebrow: makesEyebrowDefault(businessKindOf(biz.businessType)) },
    services: { eyebrow: 'Services', title: 'Our Services', accent: '' },
    // Featured: only the owner's chosen service (no automatic pick here).
    featured: { eyebrow: 'Featured', ...featuredTitleDefaults(txt(fs.serviceName), Boolean(ft.title)) },
    about: { eyebrow: 'About', title: name ? `About ${name}` : 'About Us', accent: '' },
    gallery: { eyebrow: 'Gallery', title: 'Our Work', accent: '' },
    // The kit's neutral words (no claims: the photos make the point).
    beforeAfter: { eyebrow: BA_DEFAULTS.eyebrow, title: BA_DEFAULTS.title, accent: '' },
    testimonials: { eyebrow: 'Testimonials', title: 'What Clients Say', accent: '' },
    cta: { eyebrow: 'Contact', title: fb.ctaHeadline, accent: '' },
  };
}

const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

// Decorative polished-rim rings: the no-photo hero, the contact section and
// the monogram fallback all share this motif.
function Rings() {
  return (
    <div className="mc-rings" aria-hidden="true">
      <span className="mc-ring" />
      <span className="mc-ring" />
      <span className="mc-ring" />
      <span className="mc-hub" />
    </div>
  );
}

// What a published page shows where a photo is missing: a chrome monogram
// of the business initial (never an "upload a photo" box).
function Monogram({ name }) {
  const letter = (txt(name).match(/[A-Za-z0-9]/) || ['•'])[0].toUpperCase();
  return (
    <div className="mc-mono" aria-hidden="true">
      <Rings />
      <span className="mc-mono-letter mc-chrome-text">{letter}</span>
    </div>
  );
}

// Owner-facing hint for an empty slot; never reaches the published page.
function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="mc-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

const fill = { position: 'absolute', inset: 0, height: '100%' };
// An owner's footer can have five narrow columns: let a long email wrap
// before its @ rather than mid-word.
const emailBreak = (e) => (e.indexOf('@') > 0 ? <>{e.slice(0, e.indexOf('@'))}<wbr />{e.slice(e.indexOf('@'))}</> : e);

export default function MobileChrome({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const font = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const fb = getFallbacks(biz.businessType);
  const titles = copy.sectionTitles;
  // The design's heading defaults (shared with Edit > Headings).
  const hd = headingDefaults(biz, copy);

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrderAdded(copy, sections.map((s) => s.id), addedSections);

  const name = txt(biz.businessName);
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const place = [txt(biz.city), txt(biz.state)].filter(Boolean).join(', ');
  const hours = hoursRows(biz.hours);
  const hoursSummary = hoursFact(hours);
  const payments = list(biz.paymentMethods).map(txt).filter(Boolean);
  const awards = list(biz.awards).map(txt).filter(Boolean);
  const warranty = txt(biz.warranty);
  const email = txt(biz.email);
  const address = txt(biz.address);
  // Business Info > Insured: only an explicit yes.
  const insured = biz.insured === true;
  // Business Info > Areas served, the owner's own list only (no split of the
  // older free-text serviceArea, no city): the contact panel's area chips.
  const ownAreas = serviceAreasOf({ serviceAreas: biz.serviceAreas });
  // Google rating (Edit > Google Rating): only where the owner switched it on
  // (no default spots in this design), and only with a connected place that
  // has a rating and a review count.
  const rating = googleRatingOf(biz.googlePlace);
  const placeUrl = googlePlaceUrl(biz.googlePlace);
  const badgeAt = googleBadgePlacements(copy.googleBadge, []);
  const badgeIn = (spot) => Boolean(rating) && badgeAt.includes(spot);
  // The menu-bar rating's room (FEATURE_CSS .mc-nav-gslot): a typical
  // badge plus its gap, and 6px more per review-count character past two
  // ("1,234"), so a longer count waits for the room it needs.
  const navBadgeCss = badgeIn('nav')
    ? `@container (min-width:${192 + 6 * Math.max(0, rating.countText.length - 2)}px){.mc-nav-g{display:inline-flex}}`
    : '';

  // Services: the owner's Services tab (businessInfo.services, mirrored to
  // packages by normalizeBusinessInfo) wins over the AI list, as before.
  // Package details (summary, badge, photo, included items) are the owner's
  // own only: no list is made from the description.
  const fromPackages = list(biz.packages).length > 0;
  const services = (fromPackages ? biz.packages : list(copy.servicesSection?.items))
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({
      name: txt(s.name),
      price: txt(s.price),
      description: txt(s.description),
      summary: txt(s.summary),
      badge: txt(s.badge),
      image: txt(s.image),
      includes: serviceIncludes(s.includes),
    }))
    .filter((s) => s.name || s.description || s.price);
  const svcCols = services.length === 1 ? 'mc-c1' : services.length === 2 || services.length === 4 ? 'mc-c2' : 'mc-c3';
  const anyServicePhoto = services.some((s) => s.image);
  const pkgOn = show('services') && services.some((s) => s.badge || s.image || s.includes.length > 0);

  // The hero services card (Edit > Hero > Services in the hero): only when
  // the owner picked 'quote' (price card) or 'list'; absent = today's hero.
  // Its packages: kit/features.js heroOfferOf (the owner's picks, else the
  // first priced ones; the price card never shows without a price).
  const heroCard = heroCardModeOf(copy.heroCard, 'off');
  const { picks, listPicks, hasCard } = heroOfferOf({ services, heroServices: copy.heroServices, mode: heroCard });
  const heroOn = show('hero') && hasCard;

  // The featured-service band (Edit > Featured Service): only the service the
  // owner chose (no automatic ceramic pick). A band with only a heading and a
  // button repeats the service grid: the published page skips it.
  const featured = featuredServiceOf({ featuredService: copy.featuredService, services, sectionTitles: titles, defaults: hd.featured, automatic: false });
  const featuredBody = featuredHasBody(featured, images.featured);
  const featuredOn = show('featured') && Boolean(featured) && (featuredBody || editor);

  // The vehicle-makes band (Edit > Vehicle Makes): only the makes the owner
  // ticked; no list = no band.
  const makes = vehicleMakesFor(copy.vehicleMakes, []);
  const makesOn = show('brands') && makes.length > 0;

  // The Before & After band (Edit > Before & After): only once
  // copy.beforeAfter exists, and on the published page only with a pair
  // that has both photos (the editor shows every pair, and says what each
  // still needs). Heading and intro: the owner's (copy.beforeAfter, which
  // Edit > Headings edits too), else the design's own.
  const ba = beforeAfterPairs(copy.beforeAfter, images, { editor });
  const baOn = show('beforeAfter') && Boolean(ba) && (ba.pairs.length > 0 || editor);
  const baT = sectionTitle(titles, 'beforeAfter');
  const baTitle = ba?.title || baT.title || hd.beforeAfter.title;
  const baIntro = ba?.intro || baT.intro || BA_DEFAULTS.intro;

  // Stats only from what the owner entered: About > Stats Box values, else
  // business facts (years, area, hours, payment). No invented numbers.
  const ownerStats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label);
  const years = txt(biz.yearsInBusiness);
  const area = txt(biz.serviceArea);
  const specFacts = [
    years && { label: 'Experience', value: /^\d+\+?$/.test(years) ? `${years} ${years === '1' ? 'year' : 'years'}` : years },
    area ? { label: 'Service area', value: area } : place && { label: 'Based in', value: place },
    hoursSummary && { label: 'Hours', value: hoursSummary },
    payments.length > 0 && { label: 'Payment', value: payments.join(', ') },
  ].filter(Boolean);
  const aboutStatsMode = (copy.aboutLayout || 'image') === 'stats';
  const aboutShowsStats = aboutStatsMode && ownerStats.length > 0 && show('about');
  const barStats = !aboutShowsStats && ownerStats.length > 0 ? ownerStats.slice(0, 4) : null;
  const barFacts = !barStats && specFacts.length >= 2 ? specFacts : null;
  const barItems = barStats || barFacts || [];

  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);

  const testimonials = list(copy.testimonialPlaceholders)
    .filter((q) => txt(q?.text));
  const reviews = copy.googleWidgetKey ? 'google' : testimonials.length > 0 ? 'quotes' : null;
  // "Google Review" labels, stars and the Google link belong to quotes the
  // owner marked as Google reviews; AI-written quotes stay plain.
  const googleQuotes = reviews === 'quotes' && testimonials.some((q) => q?.source === 'google');
  const allGoogle = googleQuotes && testimonials.every((q) => q?.source === 'google');

  const navLinks = [
    show('services') && services.length > 0 && { href: '#services', label: 'Services' },
    show('about') && { href: '#about', label: 'About' },
    show('gallery') && galleryImages.length > 0 && { href: '#gallery', label: 'Work', extra: true },
    show('testimonials') && reviews && { href: '#reviews', label: 'Reviews', extra: true },
    show('cta') && { href: '#contact', label: 'Contact' },
  ].filter(Boolean);

  const heroPrimaryHref = copy.ctaPrimaryUrl || (show('services') && services.length > 0 ? '#services' : '#contact');
  const heroPrimaryLabel = txt(copy.ctaPrimary) || (heroPrimaryHref === '#services' ? 'View Services' : 'Get in Touch');
  const heroSecondaryHref = copy.ctaSecondaryUrl || tel;
  const heroSecondaryLabel = txt(copy.ctaSecondary) || (phone ? `Call ${phone}` : '');
  const splitHero = copy.heroLayout === 'split';
  const heroMeta = [txt(biz.tagline), insured && 'Fully insured', place].filter(Boolean);
  // Where booking links go when the booking widget is off (they carry
  // data-scheduler-trigger, so with it on they open the widget): the phone,
  // else the contact section, else an email, else the top of the page.
  const bookHref = tel || (show('cta') ? '#contact' : email ? `mailto:${email}` : '#top');
  const ctaPhoto = show('cta') && Boolean(images.cta);

  const vars = {
    '--mc-bg': t.bg,
    '--mc-surface': t.surface,
    '--mc-text': t.text,
    '--mc-muted': t.textMuted,
    '--mc-accent': t.accent,
    '--mc-accent-text': t.accentText,
    '--mc-accent-soft': t.accentSoft,
    '--mc-on-accent': t.onAccent,
    '--mc-border': t.border,
    '--mc-border-strong': t.borderStrong,
    '--mc-focus': t.focus,
    '--mc-scrim': t.heroScrim,
    '--mc-scrim-left': t.heroScrimLeft,
    '--mc-on-hero': t.onHero,
    '--mc-head': font,
    '--mc-body': body,
    '--mc-gutter': 'clamp(20px, 5cqi, 48px)',
    ...chromeTokens(t),
    ...(heroOn ? chromeOfferVars(t) : {}),
    ...(ctaPhoto ? chromeCtaPhotoVars(t) : {}),
  };
  // Google's star gold, darkened where the page is light so the stars keep
  // 3:1 (photo hero: the gold as is; footer: the design's accent).
  const pageStar = ensureContrast(GOOGLE_STAR_GOLD, t.bg, 3);
  const surfaceStar = ensureContrast(GOOGLE_STAR_GOLD, t.surface, 3);
  const footStar = ensureContrast(t.accentText, vars['--mc-footer-bg'], 3);

  // Logo if uploaded, else the chrome orb + wordmark (nav and footer).
  const brand = (logoStyle, loading) => (images.logo ? (
    <PhotoSlot src={images.logo} alt={name ? `${name} logo` : 'Logo'} loading={loading} style={logoStyle} imgStyle={{ objectFit: 'contain' }} />
  ) : (
    <>
      <span className="mc-orb" aria-hidden="true" />
      <span className="mc-wordmark">{name}</span>
    </>
  ));

  // Hero heading (Edit > Headings > Hero): the owner's eyebrow, and the
  // highlighted words in the chrome sheen (whole words of the headline only).
  const heroT = sectionTitle(titles, 'hero');
  const heroAccent = splitAccent(txt(copy.headline) || name, heroT.accent);
  const heroText = (
    <>
      <p className="mc-eyebrow">{heroT.eyebrow || fb.heroBadge}</p>
      {heroAccent ? (
        <h1 className="mc-h1">
          {heroAccent.before && <span>{heroAccent.before}</span>}
          <span className="mc-h1-em">{heroAccent.match}</span>
          {heroAccent.after && <span>{heroAccent.after}</span>}
        </h1>
      ) : (
        <h1 className="mc-h1"><span>{txt(copy.headline) || name}</span></h1>
      )}
      {txt(copy.subheadline) && <p className="mc-lead">{copy.subheadline}</p>}
      <div className="mc-actions">
        <a className="mc-btn mc-btn-chrome" href={heroPrimaryHref}>{heroPrimaryLabel}</a>
        {heroSecondaryHref && heroSecondaryLabel && (
          <a className="mc-btn mc-btn-ghost" href={heroSecondaryHref}>{heroSecondaryLabel}</a>
        )}
      </div>
      {badgeIn('hero') && (
        <div className="mc-hero-g">
          <GoogleRatingBadge place={biz.googlePlace} className="mc-gpill" starColor={images.hero && !splitHero ? GOOGLE_STAR_GOLD : pageStar} />
        </div>
      )}
      {heroMeta.length > 0 && (
        <ul className="mc-hero-meta">
          {heroMeta.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
    </>
  );

  // Picked or not, no service has a price: say why there is no price card.
  const heroCardHint = heroCard === 'quote' && picks.length === 0 && services.some((s) => s.name) && (
    <EditorHint>Your price card needs services with a price (Edit &gt; Services).</EditorHint>
  );
  const heroSlot = heroOn && (
    <div className="mc-hq-slot">
      <HeroOffer
        ns="mc-hq"
        mode={picks.length ? 'quote' : 'list'}
        picks={picks.length ? picks : listPicks}
        bookHref={bookHref}
        tel={tel}
        phoneLabel={phone}
        listCta={show('services') && services.length > 0 ? { href: '#services', label: 'View All Services' } : { href: bookHref, label: 'Book Now', books: true }}
        labels={HQ_LABELS}
      />
    </div>
  );

  const aboutParas = txt(copy.aboutText).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const aboutFacts = [
    place && { label: 'Based in', value: place },
    area && { label: 'Service area', value: area },
  ].filter(Boolean);

  // With the owner's Areas served list, the free-text service area joins
  // that row instead of a second pin row right above it.
  const foldArea = ownAreas.length > 0 && Boolean(area);
  const contactPrimaryLabel = txt(copy.ctaButtonText) || txt(copy.ctaPrimary) || 'Get a Quote';
  const contactPrimaryHref = copy.ctaUrl || tel;
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, place].filter(Boolean).join(', '))}`
    : null;

  // Section headings (Edit > Headings): the owner's text, else the design's.
  const svcT = sectionTitle(titles, 'services');
  const svcIntro = txt(copy.servicesSection?.intro) ? copy.servicesSection.intro : svcT.intro;
  const aboutT = sectionTitle(titles, 'about');
  const galT = sectionTitle(titles, 'gallery');
  const revT = sectionTitle(titles, 'testimonials');
  const ctaT = sectionTitle(titles, 'cta');

  // Footer (Edit > Footer, kit/features.js footerPlan over footerSpec): the
  // owner's columns in the owner's order, or the design's own brand /
  // Explore / Contact. A column with nothing to list is left out. The footer
  // button (off unless the owner turns it on): the owner's link, else the
  // contact section with the booking widget, while that section shows.
  const footAreas = serviceAreasOf(biz);
  // The social icons live in the logo column; with that column off (the
  // owner's footer only) they move to the contact column.
  const social = hasSocialLinks(biz, images);
  const plan = footerPlan({
    footer: copy.footer,
    spec: footerSpec,
    ctaFallback: show('cta') ? '#contact' : null,
    has: (type, { builder, cta, shown }) => ({
      brand: true,
      links: navLinks.length > 0,
      areas: footAreas.length > 0,
      contact: builder ? Boolean(tel || email || place || cta || (social && !shown.includes('brand'))) : true,
      hours: hours.length > 0,
    })[type],
  });
  const footSocialMoved = plan.builder && social && !plan.cells.some((c) => c.type === 'brand');
  // The footer rating sits in the logo column; with that column switched off
  // it moves to the bottom line.
  const footBarBadge = badgeIn('footer') && !plan.cells.some((c) => c.type === 'brand');
  // The owner's columns side by side from 901px; the logo column keeps the
  // design's wider share.
  const footCols = plan.cells.map((c) => (c.type === 'brand' ? 'minmax(0,1.5fr)' : 'minmax(0,1fr)')).join(' ');

  // Any feature on this page: FEATURE_CSS joins the style block.
  const featureOn = heroOn || pkgOn || featuredOn || makesOn || plan.builder || ctaPhoto || insured || googleQuotes
    || ownAreas.length > 0 || Boolean(heroAccent) || ['hero', 'nav', 'about', 'reviews', 'footer'].some(badgeIn);
  const css = CSS
    + (heroOn ? heroOfferCss('mc-hq', { stackFrom: 1024 }) : '')
    + (pkgOn ? packageDetailsCss('mc-pk') : '')
    + (featuredOn ? featuredBandCss('mc-ft') : '')
    + (makesOn ? makesBandCss('mc-mk') : '')
    + (featureOn ? FEATURE_CSS : '')
    + navBadgeCss
    // Last, so a page with the band starts with exactly the style string it
    // has without it.
    + (baOn ? beforeAfterCss('mc-ba') + BA_CSS : '');

  return (
    <div
      id="top"
      className="mc-root"
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.6 }}
    >
      <style>{css}</style>
      <a className="mc-skip" href="#main">Skip to content</a>

      <nav className="mc-nav" aria-label="Main" style={{ order: -1 }}>
        <div className="mc-wrap mc-nav-in">
          <a className="mc-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
            {brand({ height: 40, width: 'auto', maxWidth: 180 }, 'eager')}
          </a>
          {badgeIn('nav') && (
            <div className="mc-nav-gslot">
              <span className="mc-nav-g">
                <GoogleRatingBadge place={biz.googlePlace} variant="inline" starColor={pageStar} starSize={14} />
              </span>
            </div>
          )}
          {(navLinks.length > 0 || tel) && (
            <div className="mc-links">
              {navLinks.map((l) => (
                <a key={l.href} className={`mc-link${l.extra ? ' mc-link-x' : ''}`} href={l.href}>{l.label}</a>
              ))}
              {tel && <a className="mc-btn mc-btn-chrome mc-btn-sm mc-nav-cta" href={tel}>{phone}</a>}
            </div>
          )}
          <MobileMenu
            links={navLinks}
            cta={tel ? { href: tel, label: `Call ${phone}` } : { href: '#contact', label: 'Contact us' }}
            colors={t}
            font={body}
          />
        </div>
      </nav>

      <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
        {!show('hero') && <h1 className="mc-sr">{name}</h1>}

        {show('hero') && !splitHero && (
          <header data-section="hero" className={`mc-hero${images.hero ? ' mc-has-media' : ''}${heroOn ? ' mc-hero-offer' : ''}`} style={{ order: order('hero') }}>
            {images.hero ? (
              <>
                <div className="mc-hero-media">
                  <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
                </div>
                <div className="mc-hero-scrim" />
                <div className="mc-hero-fade" />
              </>
            ) : (
              <div className="mc-decor">
                <div className="mc-lines" />
                <Rings />
              </div>
            )}
            <div className={`mc-wrap${heroOn ? ' mc-hq-grid' : ''}`}>
              <div className="mc-hero-body">
                {heroText}
                {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
                {heroCardHint}
              </div>
              {heroSlot}
            </div>
          </header>
        )}

        {show('hero') && splitHero && (
          <header data-section="hero" className={`mc-split${heroOn ? ' mc-split-offer' : ''}`} style={{ order: order('hero') }}>
            <div className="mc-split-text">
              <div className="mc-decor"><div className="mc-lines" /></div>
              {heroText}
              {heroCardHint}
            </div>
            <div className="mc-split-photo">
              <PhotoSlot src={images.hero} slot="hero" alt="" loading="eager" fetchPriority="high" style={fill} fallback={<Monogram name={name} />} />
            </div>
            {/* The services card: over the photo column from 1024px, a row
                under the hero below that, right after the copy on phones. */}
            {heroSlot}
          </header>
        )}

        {show('statsBar') && (barItems.length > 0 || editor) && (
          <section data-section="statsBar" className="mc-facts" aria-label="At a glance" style={{ order: order('statsBar') }}>
            <div className="mc-wrap">
              {barItems.length > 0 ? (
                <dl className={`mc-facts-grid mc-n${barItems.length}${barStats ? ' mc-stats-kind' : ''}`}>
                  {barItems.map((f, i) => (
                    <div key={`${f.label}-${i}`} className={`mc-fact${barStats ? ' mc-stat' : ''}`} data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <dt className="mc-label">{f.label}</dt>
                      <dd className={barStats ? 'mc-stat-value mc-chrome-text' : 'mc-fact-value'}>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div style={{ padding: '8px 0 28px' }}>
                  <EditorHint>This bar shows your real facts. Add Years in Business in Edit &gt; Business Info, or stats in Edit &gt; About &gt; Stats Box.</EditorHint>
                </div>
              )}
            </div>
          </section>
        )}

        {makesOn && (
          <section data-section="brands" id="makes" className="mc-mk-makes" aria-label="Vehicle makes" tabIndex={0} style={{ order: order('brands') }}>
            <MakesBand ns="mc-mk" eyebrow={sectionTitle(titles, 'brands').eyebrow || hd.brands.eyebrow} makes={makes} />
          </section>
        )}

        {show('services') && services.length > 0 && (
          <section data-section="services" id="services" className="mc-section" aria-labelledby="mc-services-h" style={{ order: order('services') }}>
            <ServiceCardCss />
            <div className="mc-wrap">
              <div className={`mc-head${svcIntro ? '' : ' mc-head-solo'}`} data-acg-reveal="">
                <div>
                  <p className="mc-eyebrow">{svcT.eyebrow || hd.services.eyebrow}</p>
                  <h2 id="mc-services-h" className="mc-h2">
                    <Accented title={txt(copy.servicesSection?.title) || svcT.title || hd.services.title} accent={svcT.accent} className="mc-chrome-text" />
                  </h2>
                </div>
                {svcIntro && <p className="mc-intro">{svcIntro}</p>}
              </div>
              <div className={`mc-grid ${svcCols}`}>
                {services.map((s, i) => (
                  <div key={`${s.name}-${i}`} className="mc-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <article className={`acg-svc-card mc-card${s.badge ? ' mc-card-feat' : ''}${anyServicePhoto ? ' mc-card-ph' : ''}`}>
                      {/* Once one service has a photo, the others keep the
                          space where cards share a row (an upload slot in the
                          editor, a quiet car mark on the site). */}
                      <PackagePhoto ns="mc-pk" src={s.image} alt={s.name} anyPhoto={anyServicePhoto} editor={editor} />
                      <div className="mc-card-top">
                        <span className="mc-idx">{String(i + 1).padStart(2, '0')}</span>
                        {s.price && <span className="mc-price mc-chrome-text">{s.price}</span>}
                      </div>
                      {s.badge && <PackageBadge ns="mc-pk" text={s.badge} />}
                      {s.name && <h3 className="mc-card-title">{s.name}</h3>}
                      <ServiceDescription
                        id={`svc-more-${fromPackages ? 'pkg' : 'ai'}-${i}`}
                        text={s.description}
                        style={{ marginTop: 12, color: t.textMuted, fontSize: 15.5, lineHeight: 1.7 }}
                        accentColor={t.accentText}
                      />
                      {s.includes.length > 0 && <PackageIncludes ns="mc-pk" items={s.includes} label="What's Included" checkStroke={1.8} />}
                      <div className="acg-svc-foot">
                        <div className="mc-foot-line">
                          <BookNowLink serviceName={s.name} phone={phone} label={<>Book now <Icon d={ICONS.arrow} size={16} /></>} />
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
          <section data-section="featured" id="featured" className="mc-section mc-alt mc-ft-band" aria-labelledby="mc-featured-h" style={{ order: order('featured') }}>
            <Rings />
            <div className="mc-wrap">
              <FeaturedBand
                ns="mc-ft"
                image={images.featured}
                alt={`${featured.name}${name ? ` by ${name}` : ''}`}
                heading={(
                  <>
                    <p className="mc-eyebrow">{featured.eyebrow || hd.featured.eyebrow}</p>
                    <h2 id="mc-featured-h" className="mc-h2">
                      <Accented title={featured.title} accent={featured.accent} className="mc-chrome-text" />
                    </h2>
                  </>
                )}
                intro={featured.intro}
                priceFrom={featured.priceFrom}
                price={featured.price}
                bullets={featured.bullets}
                button={(
                  <div className="mc-actions">
                    <a
                      className="mc-btn mc-btn-chrome"
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
          <section data-section="about" id="about" className="mc-section" aria-labelledby="mc-about-h" style={{ order: order('about') }}>
            <div className="mc-wrap mc-about">
              <div data-acg-reveal="">
                {aboutShowsStats ? (
                  <dl className="mc-statpanel">
                    {ownerStats.slice(0, 4).map((s, i) => (
                      <div key={`${s.label}-${i}`}>
                        <dt className="mc-label" style={{ marginTop: 12 }}>{s.label}</dt>
                        <dd className="mc-stat-value mc-chrome-text">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="mc-frame">
                    <div className="mc-media">
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
                {aboutStatsMode && ownerStats.length === 0 && (
                  <EditorHint>Add your stats in Edit &gt; About &gt; Stats Box (the photo shows until then).</EditorHint>
                )}
              </div>
              <div data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                <p className="mc-eyebrow">{aboutT.eyebrow || hd.about.eyebrow}</p>
                <h2 id="mc-about-h" className="mc-h2" style={{ marginBottom: 28 }}>
                  <Accented title={aboutT.title || hd.about.title} accent={aboutT.accent} className="mc-chrome-text" />
                </h2>
                {badgeIn('about') && (
                  <div className="mc-about-g">
                    <GoogleRatingBadge place={biz.googlePlace} className="mc-gpill" starColor={pageStar} />
                  </div>
                )}
                {aboutParas.length > 0 && (
                  <div className="mc-prose">
                    {aboutParas.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                )}
                {aboutFacts.length > 0 && (
                  <dl className="mc-dl">
                    {aboutFacts.map((f) => (
                      <div key={f.label}>
                        <dt className="mc-label">{f.label}</dt>
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
          <section data-section="gallery" id="gallery" className="mc-section" aria-labelledby="mc-gallery-h" style={{ order: order('gallery') }}>
            <div className="mc-wrap">
              <div className="mc-head mc-head-solo" data-acg-reveal="">
                <div>
                  <p className="mc-eyebrow">{galT.eyebrow || hd.gallery.eyebrow}</p>
                  <h2 id="mc-gallery-h" className="mc-h2">
                    <Accented title={galT.title || hd.gallery.title} accent={galT.accent} className="mc-chrome-text" />
                  </h2>
                </div>
              </div>
              {galleryImages.length === 0 ? (
                <PhotoSlot slot="gallery" style={{ minHeight: 220, borderRadius: 4 }} />
              ) : galleryImages.length > 3 ? (
                <>
                  <div className="mc-track" role="region" aria-label="Photo gallery, scroll sideways for more" tabIndex={0}>
                    {galleryImages.map((src, i) => (
                      <figure key={i} className="mc-shot">
                        <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      </figure>
                    ))}
                  </div>
                  <p className="mc-swipe" aria-hidden="true">Swipe or scroll for more →</p>
                </>
              ) : (
                <div className={`mc-gal mc-g${galleryImages.length}`}>
                  {galleryImages.map((src, i) => (
                    <figure key={i} className="mc-shot" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Right after the gallery in the DOM: without a saved slot it
            shares the gallery's order value (addedSections). */}
        {baOn && (
          <BeforeAfterBand
            ns="mc-ba"
            beforeAfter={copy.beforeAfter}
            images={images}
            editor={editor}
            order={order('beforeAfter')}
            className="mc-section"
            wrapClassName="mc-wrap"
            labelledBy="mc-ba-h"
            heading={(
              <div className={`mc-head${baIntro ? '' : ' mc-head-solo'}`} data-acg-reveal="">
                <div>
                  <p className="mc-eyebrow">{baT.eyebrow || hd.beforeAfter.eyebrow}</p>
                  <h2 id="mc-ba-h" className="mc-h2">
                    <Accented title={baTitle} accent={baT.accent || hd.beforeAfter.accent} className="mc-chrome-text" />
                  </h2>
                </div>
                {baIntro && <p className="mc-intro">{baIntro}</p>}
              </div>
            )}
            hints={ba.pairs.length === 0 && <EditorHint>{'Add a before and an after photo in Edit > Before & After.'}</EditorHint>}
          />
        )}

        {show('testimonials') && reviews === 'google' && (
          <section data-section="testimonials" id="reviews" className="mc-section" aria-label={txt(copy.googleReviewsTitle) || revT.title || 'Reviews'} style={{ order: order('testimonials') }}>
            <div className="mc-wrap">
              {(txt(copy.googleReviewsTitle) || revT.title || badgeIn('reviews')) && (
                <div className="mc-head mc-head-solo">
                  <div>
                    {(txt(copy.googleReviewsTitle) || revT.title) && (
                      <>
                        <p className="mc-eyebrow">{revT.eyebrow || 'Reviews'}</p>
                        <h2 className="mc-h2">
                          <Accented title={txt(copy.googleReviewsTitle) ? copy.googleReviewsTitle : revT.title} accent={revT.accent} className="mc-chrome-text" />
                        </h2>
                      </>
                    )}
                    {badgeIn('reviews') && (
                      <div className="mc-rev-g">
                        <GoogleRatingBadge place={biz.googlePlace} className="mc-gpill" starColor={pageStar} />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="mc-reviews-widget">
                <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
              </div>
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'quotes' && (
          <section data-section="testimonials" id="reviews" className="mc-section mc-alt" aria-labelledby="mc-reviews-h" style={{ order: order('testimonials') }}>
            <div className="mc-wrap">
              <div className={`mc-head${revT.intro ? '' : ' mc-head-solo'}`} data-acg-reveal="">
                <div>
                  <p className="mc-eyebrow">{revT.eyebrow || hd.testimonials.eyebrow}</p>
                  <h2 id="mc-reviews-h" className="mc-h2">
                    <Accented title={revT.title || hd.testimonials.title} accent={revT.accent} className="mc-chrome-text" />
                  </h2>
                  {badgeIn('reviews') && (
                    <div className="mc-rev-g">
                      <GoogleRatingBadge place={biz.googlePlace} className="mc-gpill" starColor={surfaceStar} />
                    </div>
                  )}
                </div>
                {revT.intro && <p className="mc-intro">{revT.intro}</p>}
              </div>
              <div className={`mc-grid ${testimonials.length === 1 ? 'mc-c1' : testimonials.length === 2 || testimonials.length === 4 ? 'mc-c2' : 'mc-c3'}`}>
                {testimonials.map((q, i) => {
                  // Only a quote the owner marked as a Google review gets the
                  // label (linked to the place) and its 1-5 stars.
                  const google = q?.source === 'google';
                  const stars = reviewStars(q);
                  const Src = placeUrl ? 'a' : 'span';
                  const srcLink = placeUrl ? { href: placeUrl, target: '_blank', rel: 'noopener noreferrer' } : {};
                  return (
                    <div key={i} className="mc-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                      <figure className="mc-quote">
                        <svg className="mc-quote-mark" width="34" height="26" viewBox="0 0 34 26" fill="currentColor" aria-hidden="true">
                          <path d="M0 26V15.6C0 6.9 4.6 1.7 13.2 0l1.5 3.4C9.8 5 7.4 8 7.1 12.2H14V26H0zm19.3 0V15.6C19.3 6.9 23.9 1.7 32.5 0L34 3.4c-4.9 1.6-7.3 4.6-7.6 8.8h6.9V26H19.3z" />
                        </svg>
                        {stars > 0 && <StarRow rating={stars} size={16} gap={3} color="currentColor" className="mc-rev-stars" />}
                        <blockquote><p>{q.text}</p></blockquote>
                        {(google || txt(q.name) || txt(q.vehicle) || txt(q.role)) && (
                          <figcaption>
                            {txt(q.name)}
                            {(txt(q.vehicle) || txt(q.role)) && <span>{txt(q.vehicle) || txt(q.role)}</span>}
                            {google && <Src className="mc-rev-src" {...srcLink}>Google Review{placeUrl && <span className="mc-sr"> (opens Google Maps)</span>}</Src>}
                          </figcaption>
                        )}
                      </figure>
                    </div>
                  );
                })}
              </div>
              {placeUrl && googleQuotes && (
                <a className="mc-rev-more" href={placeUrl} target="_blank" rel="noopener noreferrer">
                  {allGoogle ? 'Read More Reviews' : 'See Our Google Reviews'}<span className="mc-sr"> (opens Google Maps)</span><Icon d={ICONS.arrow} size={16} />
                </a>
              )}
            </div>
          </section>
        )}

        {show('cta') && (
          <section data-section="cta" id="contact" className={`mc-section mc-contact${ctaPhoto ? ' mc-ctaph' : ''}`} aria-labelledby="mc-contact-h" style={{ order: order('cta') }}>
            {ctaPhoto && (
              <>
                <div className="mc-ctaph-photo" aria-hidden="true"><PhotoSlot src={images.cta} alt="" /></div>
                <div className="mc-ctaph-scrim" aria-hidden="true" />
              </>
            )}
            <Rings />
            <div className="mc-wrap mc-contact-grid">
              <div data-acg-reveal="">
                <p className="mc-eyebrow">{ctaT.eyebrow || hd.cta.eyebrow}</p>
                <h2 id="mc-contact-h" className="mc-h2 mc-h2-xl">
                  <Accented title={txt(copy.ctaHeadline) || ctaT.title || fb.ctaHeadline} accent={ctaT.accent} className="mc-chrome-text" />
                </h2>
                <p className="mc-lead">{txt(copy.ctaSubtext) || ctaT.intro || 'Get in touch to schedule a service or ask a question.'}</p>
                <div className="mc-actions">
                  {contactPrimaryHref && (
                    <a
                      className="mc-btn mc-btn-chrome"
                      href={contactPrimaryHref}
                      {...(copy.ctaUrl ? {} : { 'data-scheduler-trigger': '' })}
                    >
                      {contactPrimaryLabel}
                    </a>
                  )}
                  {tel && copy.ctaUrl && (
                    <a className="mc-btn mc-btn-ghost" href={tel}>{txt(copy.ctaSecondaryText) || `Call ${phone}`}</a>
                  )}
                </div>
              </div>

              <div className="mc-panel" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                <ul>
                  {phone && (
                    <li className="mc-row">
                      <span className="mc-icon"><Icon d={ICONS.phone} /></span>
                      <span className="mc-row-body">
                        <span className="mc-label">Phone</span>
                        <span className="mc-row-value">{tel ? <a href={tel}>{phone}</a> : phone}</span>
                      </span>
                    </li>
                  )}
                  {email && (
                    <li className="mc-row">
                      <span className="mc-icon"><Icon d={ICONS.mail} /></span>
                      <span className="mc-row-body">
                        <span className="mc-label">Email</span>
                        <span className="mc-row-value"><a href={`mailto:${email}`}>{email}</a></span>
                      </span>
                    </li>
                  )}
                  {(address || place || (area && !foldArea)) && (
                    <li className="mc-row">
                      <span className="mc-icon"><Icon d={ICONS.pin} /></span>
                      <span className="mc-row-body">
                        <span className="mc-label">{address ? 'Location' : area && !foldArea ? 'Service area' : 'Based in'}</span>
                        <span className="mc-row-value">
                          {address ? <a href={mapsHref} target="_blank" rel="noopener noreferrer">{[address, place].filter(Boolean).join(', ')}</a> : (foldArea ? place : (area || place))}
                        </span>
                        {address && area && !foldArea && <span className="mc-row-value" style={{ color: t.textMuted }}>{area}</span>}
                      </span>
                    </li>
                  )}
                  {ownAreas.length > 0 && (
                    <li className="mc-row">
                      <span className="mc-icon"><Icon d={ICONS.map} /></span>
                      <span className="mc-row-body">
                        <span className="mc-label">Areas we serve</span>
                        {foldArea && <span className="mc-row-value">{area}</span>}
                        <span className="mc-chips">
                          {ownAreas.map((a) => <span key={a} className="mc-chip">{a}</span>)}
                        </span>
                      </span>
                    </li>
                  )}
                  {hours.length > 0 && (
                    <li className="mc-row">
                      <span className="mc-icon"><Icon d={ICONS.clock} /></span>
                      <span className="mc-row-body">
                        <span className="mc-label">Hours</span>
                        {hours.length === 1 && !hours[0].time ? (
                          <span className="mc-row-value">{hours[0].days}</span>
                        ) : (
                          <dl className="mc-hours">
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
                    <li className="mc-row">
                      <span className="mc-icon"><Icon d={ICONS.shield} /></span>
                      <span className="mc-row-body">
                        <span className="mc-label">Insurance</span>
                        <span className="mc-row-value">Fully insured</span>
                      </span>
                    </li>
                  )}
                  {payments.length > 0 && (
                    <li className="mc-row">
                      <span className="mc-icon"><Icon d={ICONS.card} /></span>
                      <span className="mc-row-body">
                        <span className="mc-label">We accept</span>
                        <span className="mc-chips">
                          {payments.map((p) => <span key={p} className="mc-chip">{p}</span>)}
                        </span>
                      </span>
                    </li>
                  )}
                  {warranty && (
                    <li className="mc-row">
                      <span className="mc-icon"><Icon d={ICONS.shield} /></span>
                      <span className="mc-row-body">
                        <span className="mc-label">Warranty</span>
                        <span className="mc-row-value">{warranty}</span>
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        )}

        {show('awards') && (awards.length > 0 || editor) && (
          <section data-section="awards" className="mc-awards" aria-label="Awards and recognition" style={{ order: order('awards') }}>
            <div className="mc-wrap">
              {awards.length > 0 ? (
                <div className="mc-awards-in" data-acg-awards="" data-acg-reveal="fade">
                  <p className="mc-eyebrow">Recognition</p>
                  <ul className="mc-award-list">
                    {awards.map((a, i) => (
                      <li key={`${a}-${i}`} className="mc-award"><Icon d={ICONS.award} size={22} />{a}</li>
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

      <footer className="mc-foot" style={{ order: 9999 }}>
        <div className="mc-wrap">
          {plan.cells.length > 0 && (
            <div className={`mc-foot-grid${plan.builder ? ' mc-fb' : ''}`} {...(plan.builder ? { style: { '--mc-fcols': footCols } } : {})}>
              {plan.cells.map((c) => {
                if (c.type === 'brand') {
                  return (
                    <div key="brand" className="mc-foot-brand">
                      <a className="mc-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
                        {brand({ height: 48, width: 'auto', maxWidth: 200 })}
                      </a>
                      {txt(copy.footerTagline) && <p className="mc-foot-tag">{copy.footerTagline}</p>}
                      {badgeIn('footer') && (
                        <div className="mc-foot-g">
                          <GoogleRatingBadge place={biz.googlePlace} variant="inline" starColor={footStar} starSize={16} />
                        </div>
                      )}
                      <div className="mc-social">
                        <SocialRow biz={biz} color={t.accentText} size={18} gap={10} images={images} />
                      </div>
                    </div>
                  );
                }
                if (c.type === 'links') {
                  return (
                    <div key="links">
                      <p className="mc-foot-h">{c.title}</p>
                      <ul className="mc-foot-list">
                        {navLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                      </ul>
                    </div>
                  );
                }
                if (c.type === 'areas') {
                  return (
                    <div key="areas">
                      <p className="mc-foot-h">{c.title}</p>
                      <ul className="mc-foot-list">
                        {footAreas.map((a) => <li key={a}>{a}</li>)}
                      </ul>
                    </div>
                  );
                }
                if (c.type === 'contact') {
                  return (
                    <div key="contact">
                      <p className="mc-foot-h">{c.title}</p>
                      <ul className="mc-foot-list">
                        {tel && <li><a href={tel}>{phone}</a></li>}
                        {email && <li><a href={`mailto:${email}`}>{plan.builder ? emailBreak(email) : email}</a></li>}
                        {place && <li>{place}</li>}
                      </ul>
                      {footSocialMoved && (
                        <div className="mc-social">
                          <SocialRow biz={biz} color={t.accentText} size={18} gap={10} images={images} />
                        </div>
                      )}
                      {plan.cta && (
                        <a className="mc-btn mc-btn-chrome mc-btn-sm mc-foot-cta" href={plan.cta.href} {...bookingAttrs(plan.cta.books)}>{plan.cta.label}</a>
                      )}
                    </div>
                  );
                }
                return (
                  <div key="hours">
                    <p className="mc-foot-h">{c.title}</p>
                    <ul className="mc-foot-list">
                      {hours.map((h) => <li key={h.days}>{h.time ? `${h.days} ${h.time}` : h.days}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mc-foot-bottom">
            {/* exportHtml's owner-link script appends to the LAST <p> of the
                footer: the copyright stays that <p>; the rest are <div>s. */}
            <p>© <span data-acg-year="">{new Date().getFullYear()}</span> {name}. All rights reserved.</p>
            {footBarBadge && (
              <div className="mc-foot-note">
                <GoogleRatingBadge place={biz.googlePlace} variant="inline" starColor={footStar} starSize={14} />
              </div>
            )}
            {plan.bottomText && <div className="mc-foot-note">{plan.bottomText}</div>}
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref="#contact" colors={t} font={body} />
    </div>
  );
}
