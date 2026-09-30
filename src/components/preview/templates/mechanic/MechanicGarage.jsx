// Raw Garage (mechanic_garage): dark concrete & orange, gritty shop culture.
// Theme-ready (see CLAUDE.md, "Template contract"; MobileChrome.jsx is the
// reference). What keeps it static-export safe and honest:
//   - every color is a deriveTheme() token exposed as a --mg-* variable, so
//     an owner's palette repaints the concrete, the orange bands and the
//     roll-up door (no orange literals left over);
//   - the heading font slot drives every heading, at the heaviest weight the
//     font actually ships (a single-weight face is never faux-bold);
//   - all CSS lives in the one prefixed <style> below: @container layout,
//     hover inside (hover:hover), motion inside prefers-reduced-motion;
//   - no useState/useEffect: the nav is opaque and only gains its darker
//     tone + orange glow from html[data-acg-scrolled] (siteRuntime.js);
//   - facts (stats, hours, warranty, awards, certifications) render only
//     when the owner entered them: the old invented opening-hours table and
//     "2,000+ / 12mo / five stars" stats are gone, and the warranty box now
//     lives inside the ordered services section instead of floating free.
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import { ServiceCardCss, ServiceDescription, BookNowLink } from '../ServiceCardParts.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS } from '../../../../lib/businessHours.js';
import { FONT_CATALOG, familiesFromStack, catalogFamily } from '../../../../lib/fontCatalog.js';
import { deriveTheme, mix, alpha, ensureContrast } from '../kit/theme.js';
import { PhotoSlot, PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';

export const themeReady = true;

// ContentEditor has no TOGGLEABLE entry for this template, so it lists
// _default: same ids, same order. Awards used to be a dead toggle here; it
// now drives the recognition strip. Never rename an id (saved sites store
// them in copy.sectionOrder / copy.hiddenSections).
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'statsBar', label: 'Stats Bar' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'cta', label: 'Contact / CTA' },
  { id: 'awards', label: 'Awards' },
];

// Work-order labels (eyebrows, numbers, hours) are set in a mono face.
export const extraFonts = ["'Space Mono', monospace"];

// Fine grain for the concrete: grayscale fractal noise at low opacity, so it
// reads on dark and light palettes alike (no color of its own).
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.06'/%3E%3C/svg%3E\")";

const CSS = `
.mg-root{--mg-grain:${GRAIN}}
.mg-wrap{width:100%;max-width:1240px;margin:0 auto;padding-left:var(--mg-gutter);padding-right:var(--mg-gutter)}
.mg-root :where(h1,h2,h3,p,ul,ol,dl,dd,figure,blockquote){margin:0}
.mg-root :where(ul,ol){list-style:none;padding:0}
.mg-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.mg-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 18px;border-radius:3px;background:var(--mg-accent);color:var(--mg-on-accent);font-weight:700;text-decoration:none}
.mg-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.mg-root a:focus-visible,.mg-root summary:focus-visible,.mg-root label:focus-visible,.mg-track:focus-visible{outline:2px solid var(--mg-focus);outline-offset:3px}
.mg-cta a:focus-visible{outline-color:var(--mg-band-text)}
.mg-tex{background-color:var(--mg-bg);background-image:var(--mg-grain),var(--mg-hatch)}
.mg-tex-alt{background-color:var(--mg-surface);background-image:var(--mg-grain),var(--mg-hatch)}
.mg-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin-top:20px;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-size:13px;font-weight:500;line-height:1.45;color:inherit;opacity:.85}

.mg-eyebrow{display:inline-flex;align-items:center;gap:12px;font-family:var(--mg-mono);font-size:12px;font-weight:700;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;color:var(--mg-accent-text)}
.mg-eyebrow::before{content:'';flex:none;width:10px;height:10px;background:var(--mg-accent)}
.mg-label{display:block;font-family:var(--mg-mono);font-size:11.5px;font-weight:700;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;color:var(--mg-muted)}
.mg-h2{margin-top:18px;font-family:var(--mg-head);font-size:clamp(34px,4.8cqi,64px);font-weight:var(--mg-hw);line-height:1;letter-spacing:-.02em;text-transform:uppercase;color:var(--mg-text);text-wrap:balance}
.mg-intro{font-size:17px;line-height:1.75;color:var(--mg-muted);text-wrap:pretty}

.mg-nav{position:sticky;top:0;z-index:100;background-color:var(--mg-bg);border-bottom:3px solid var(--mg-accent)}
html[data-acg-scrolled] .mg-nav{background-color:var(--mg-nav-scrolled);box-shadow:0 10px 30px -14px var(--mg-glow)}
.mg-nav-in{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:72px}
.mg-brand{flex:1 1 auto;display:inline-flex;align-items:center;gap:12px;min-width:0;color:var(--mg-text);text-decoration:none}
.mg-bar{flex:none;width:8px;height:32px;border-radius:1px;background:var(--mg-accent)}
.mg-wordmark{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mg-head);font-size:21px;font-weight:var(--mg-hw);line-height:1.1;letter-spacing:.01em;text-transform:uppercase}
.mg-links{flex:none;display:flex;align-items:center;gap:clamp(18px,2.4cqi,30px)}
.mg-link{position:relative;padding:12px 0;font-family:var(--mg-mono);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--mg-muted)}
.mg-link::after{content:'';position:absolute;left:0;right:0;bottom:6px;height:2px;background:var(--mg-accent);transform:scaleX(0);transform-origin:left center}

.mg-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 28px;border:2px solid transparent;border-radius:3px;font-family:var(--mg-head);font-size:15px;font-weight:var(--mg-hw2);line-height:1.15;letter-spacing:.06em;text-transform:uppercase;text-align:center;text-decoration:none;cursor:pointer}
.mg-btn:active{transform:translateY(1px)}
.mg-btn svg{flex:none}
.mg-btn-solid{color:var(--mg-on-accent);background-color:var(--mg-accent);box-shadow:0 14px 30px -16px var(--mg-glow)}
.mg-btn-line{color:var(--mg-accent-text);border-color:var(--mg-accent)}
.mg-btn-sm{min-height:44px;padding:0 18px;font-size:13.5px}

/* One screen: the viewport minus the 75px nav and the 48px "Powered by"
   bar, so the buttons are in view on a 1280x800 or 1366x768 laptop. */
.mg-hero{position:relative;isolation:isolate;display:flex;align-items:center;min-height:clamp(560px,calc(100vh - 123px),860px);min-height:clamp(560px,calc(100svh - 123px),860px);padding:clamp(64px,7cqi,112px) 0 clamp(48px,5cqi,72px);color:var(--mg-text);overflow:clip}
.mg-hero-media{position:absolute;inset:0;z-index:-3}
.mg-hero-scrim{position:absolute;inset:0;z-index:-2;background:var(--mg-scrim-left)}
.mg-hero-fade{position:absolute;left:0;right:0;bottom:0;height:28%;z-index:-1;background:var(--mg-hero-fade)}
.mg-has-media{color:var(--mg-on-hero);text-shadow:0 1px 24px rgba(0,0,0,.3)}
.mg-has-media .mg-lead,.mg-has-media .mg-hero-meta{color:var(--mg-on-hero-muted)}
.mg-has-media .mg-hero-meta{border-top-color:var(--mg-on-hero-line)}
.mg-has-media .mg-tag{color:var(--mg-on-hero);border-color:var(--mg-on-hero-line);background:rgba(0,0,0,.28)}
.mg-has-media .mg-btn-line{color:var(--mg-on-hero);border-color:var(--mg-on-hero-line)}
.mg-hero-body{position:relative;max-width:min(1000px,100%)}
.mg-hero:not(.mg-has-media){--mg-door-w:min(34cqi,440px)}
.mg-tag{display:inline-flex;align-items:center;gap:10px;width:fit-content;max-width:100%;padding:8px 14px;border:1px solid var(--mg-accent-line);border-radius:2px;background:var(--mg-soft-bg);font-family:var(--mg-mono);font-size:12px;font-weight:700;line-height:1.4;letter-spacing:.2em;text-transform:uppercase;color:var(--mg-soft-text)}
.mg-tag::before{content:'';flex:none;width:8px;height:8px;background:var(--mg-accent)}
/* Headline size follows its length: live headlines run 50-60 characters,
   and at full size those stack five or six lines deep. */
.mg-h1{margin-top:26px;font-family:var(--mg-head);font-size:clamp(44px,6cqi,84px);font-weight:var(--mg-hw);line-height:.95;letter-spacing:-.025em;text-transform:uppercase;text-wrap:balance}
.mg-h1.mg-h1-long{font-size:clamp(38px,5.6cqi,64px);line-height:.98}
/* Desktop: the copy column stops short of the door, so its accent sill
   never strikes through the headline. */
@container (min-width:901px){
.mg-hero:not(.mg-has-media) .mg-hero-body{max-width:calc(100% - var(--mg-door-w) - 48px)}
.mg-hero:not(.mg-has-media) .mg-h1{font-size:clamp(40px,5cqi,72px)}
.mg-hero:not(.mg-has-media) .mg-h1.mg-h1-long{font-size:clamp(36px,4.2cqi,60px)}
}
.mg-lead{margin-top:24px;max-width:600px;font-size:clamp(17px,1.5cqi,20px);line-height:1.65;color:var(--mg-muted);text-wrap:pretty}
.mg-actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:clamp(30px,3cqi,40px)}
.mg-hero-meta{display:flex;flex-wrap:wrap;gap:10px 30px;margin-top:clamp(36px,4cqi,56px);padding-top:20px;border-top:1px solid var(--mg-border);font-family:var(--mg-mono);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mg-muted)}
.mg-hero-meta li{display:inline-flex;align-items:center;gap:10px}
.mg-hero-meta li::before{content:'';width:6px;height:6px;background:var(--mg-accent)}

/* Fixed-size door: a tall hero (long headline) must not stretch it into a
   wall of slats. */
.mg-door{position:absolute;z-index:-1;top:0;right:max(var(--mg-gutter),calc((100cqi - 1240px) / 2 + var(--mg-gutter)));width:var(--mg-door-w);height:min(60%,420px);pointer-events:none}
.mg-door::before,.mg-door::after{content:'';position:absolute;top:0;bottom:-45%;width:12px;background:var(--mg-rail);-webkit-mask-image:linear-gradient(180deg,black 60%,transparent);mask-image:linear-gradient(180deg,black 60%,transparent)}
.mg-door::before{left:0}
.mg-door::after{right:0}
.mg-door-clip{position:absolute;inset:0 12px;overflow:hidden}
.mg-door-panel{position:absolute;inset:0;background:repeating-linear-gradient(180deg,var(--mg-slat-hi) 0 2px,var(--mg-slat) 2px 29px,var(--mg-slat-lo) 29px 32px);border-bottom:8px solid var(--mg-accent);box-shadow:0 22px 40px -10px var(--mg-glow-strong)}
.mg-door-glow{position:absolute;left:-18%;right:-18%;top:100%;height:70%;background:radial-gradient(56% 100% at 50% 0,var(--mg-glow-strong),transparent 72%)}
.mg-door-floor{position:absolute;left:-30%;right:-30%;top:145%;height:1px;background:linear-gradient(90deg,transparent,var(--mg-accent-line),transparent)}

.mg-split{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);min-height:clamp(540px,calc(100vh - 123px),840px);min-height:clamp(540px,calc(100svh - 123px),840px);color:var(--mg-text)}
.mg-split-text{position:relative;display:flex;flex-direction:column;justify-content:center;padding:clamp(56px,6cqi,96px) clamp(24px,5cqi,72px) clamp(56px,6cqi,96px) max(var(--mg-gutter),calc((100cqi - 1240px) / 2 + var(--mg-gutter)))}
.mg-split .mg-h1{font-size:clamp(40px,4.4cqi,68px)}
.mg-split .mg-h1.mg-h1-long{font-size:clamp(34px,3.8cqi,54px)}
.mg-split-photo{position:relative;min-height:440px;background:var(--mg-surface);border-left:6px solid var(--mg-accent)}

.mg-sign{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(70% 50% at 50% 100%,var(--mg-glow-strong),transparent 70%),repeating-linear-gradient(180deg,var(--mg-slat-hi) 0 2px,var(--mg-slat) 2px 29px,var(--mg-slat-lo) 29px 32px)}
.mg-sign-letter{position:relative;font-family:var(--mg-head);font-size:clamp(110px,16cqi,230px);font-weight:var(--mg-hw);line-height:1;color:var(--mg-accent-text)}
@supports ((-webkit-text-stroke:2px black) or (text-stroke:2px black)){.mg-sign-letter{color:transparent;-webkit-text-stroke:3px var(--mg-accent-text)}}

.mg-band{position:relative;background-color:var(--mg-band-bg);background-image:var(--mg-band-hatch);color:var(--mg-band-text)}
.mg-facts{display:grid}
.mg-n1{grid-template-columns:minmax(0,1fr)}
.mg-n2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mg-n3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mg-n4{grid-template-columns:repeat(4,minmax(0,1fr))}
.mg-fact{padding:clamp(26px,3cqi,40px) clamp(16px,2.4cqi,32px);border-left:1px solid var(--mg-band-line)}
.mg-fact:first-child{border-left:0;padding-left:0}
.mg-fact:last-child{padding-right:0}
.mg-fact .mg-label{color:var(--mg-band-muted)}
.mg-fact-value{display:block;margin-top:10px;font-family:var(--mg-head);font-size:clamp(18px,1.7cqi,22px);font-weight:var(--mg-hw2);line-height:1.3;white-space:pre-line}
.mg-stat{display:flex;flex-direction:column-reverse;justify-content:flex-end}
.mg-stat .mg-label{margin-top:10px}
.mg-stat-value{display:block;font-family:var(--mg-head);font-size:clamp(40px,4.6cqi,62px);font-weight:var(--mg-hw);line-height:1;letter-spacing:-.02em}

.mg-section{position:relative;padding:clamp(76px,9cqi,128px) 0;scroll-margin-top:75px}
.mg-section::before{content:'';position:absolute;top:0;left:50%;width:min(1144px,calc(100% - 2 * var(--mg-gutter)));height:1px;translate:-50% 0;background:linear-gradient(90deg,var(--mg-accent) 0 72px,var(--mg-border) 72px)}
.mg-band+.mg-section::before{display:none}
.mg-head{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);align-items:end;gap:20px clamp(32px,6cqi,96px);margin-bottom:clamp(40px,5cqi,68px)}
.mg-head-solo{grid-template-columns:minmax(0,1fr)}
.mg-grid{display:grid;gap:clamp(14px,1.6cqi,20px)}
.mg-c1{grid-template-columns:minmax(0,680px)}
.mg-c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mg-c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mg-cell{display:flex;min-width:0}
.mg-card{flex:1;position:relative;padding:clamp(24px,2.6cqi,34px);background-color:var(--mg-surface);background-image:var(--mg-hatch);border:1px solid var(--mg-border);border-left:4px solid var(--mg-accent);border-radius:3px}
.mg-card-top{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.mg-idx{font-family:var(--mg-mono);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mg-accent-text)}
.mg-price{font-family:var(--mg-head);font-size:clamp(24px,2.2cqi,30px);font-weight:var(--mg-hw);line-height:1;letter-spacing:-.01em;white-space:nowrap;color:var(--mg-text)}
.mg-card-title{margin-top:22px;font-family:var(--mg-head);font-size:clamp(20px,1.8cqi,24px);font-weight:var(--mg-hw2);line-height:1.15;text-transform:uppercase;color:var(--mg-text)}
.mg-card .acg-svc-foot{padding-top:24px}
.mg-card .acg-svc-more{min-height:32px;padding-top:6px}
.mg-card-foot{padding-top:12px;border-top:1px dashed var(--mg-border-strong)}
.mg-card .acg-svc-book{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-family:var(--mg-mono);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--mg-accent-text)}

/* Warranty: an opaque card with a hazard-tape edge. No accent wash: a
   translucent tint muddied complementary palettes (gold over navy) and
   pulled the muted text under 4.5:1. */
.mg-warranty{position:relative;overflow:hidden;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:18px clamp(20px,3cqi,40px);margin-top:clamp(32px,4cqi,48px);padding:clamp(22px,3cqi,32px) clamp(22px,3cqi,36px) clamp(22px,3cqi,32px) calc(clamp(22px,3cqi,36px) + 12px);border:1px solid var(--mg-border-strong);border-radius:3px;background-color:var(--mg-surface);background-image:var(--mg-hatch)}
.mg-warranty::before{content:'';position:absolute;left:0;top:0;bottom:0;width:12px;background:repeating-linear-gradient(135deg,var(--mg-accent) 0 8px,var(--mg-hazard) 8px 16px)}
.mg-warranty .mg-label{color:var(--mg-surface-muted)}
.mg-warranty-icon{display:grid;place-items:center;width:56px;height:56px;border-radius:2px;background:var(--mg-accent);color:var(--mg-on-accent)}
.mg-warranty-title{margin-top:6px;font-family:var(--mg-head);font-size:clamp(20px,2cqi,26px);font-weight:var(--mg-hw);line-height:1.15;text-transform:uppercase;color:var(--mg-surface-text)}
.mg-warranty-text{margin-top:6px;font-size:16px;line-height:1.6;color:var(--mg-surface-muted)}

.mg-about{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:center;gap:clamp(40px,7cqi,104px)}
.mg-frame{position:relative;padding:0 0 16px 16px}
.mg-frame::before{content:'';position:absolute;left:0;bottom:0;width:58%;height:58%;border-radius:2px;background:var(--mg-accent)}
.mg-media{position:relative;aspect-ratio:4/5;overflow:hidden;border-radius:2px;background:var(--mg-bg);border:1px solid var(--mg-border)}
.mg-prose p{font-size:17px;line-height:1.8;color:var(--mg-muted);white-space:pre-line;text-wrap:pretty}
.mg-prose p+p{margin-top:18px}
.mg-prose p:first-child{font-size:clamp(18px,1.6cqi,21px);line-height:1.65;color:var(--mg-text)}
.mg-dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 32px;margin-top:36px;padding-top:28px;border-top:1px solid var(--mg-border)}
.mg-dl .mg-wide{grid-column:1 / -1}
.mg-dl dd{margin-top:8px;font-size:16px;line-height:1.55;color:var(--mg-text)}
.mg-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.mg-chip{padding:6px 12px;border:1px solid var(--mg-border-strong);border-radius:2px;font-family:var(--mg-mono);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mg-text)}
.mg-statpanel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--mg-border);border:1px solid var(--mg-border);border-left:4px solid var(--mg-accent);border-radius:2px;overflow:hidden}
.mg-statpanel>div{display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:clamp(24px,3cqi,40px);background:var(--mg-bg)}
.mg-statpanel>div:last-child:nth-child(odd){grid-column:1 / -1}
.mg-statpanel .mg-label{margin-top:10px}
.mg-statpanel .mg-stat-value{color:var(--mg-accent-text)}

.mg-gal{display:grid;gap:clamp(10px,1.2cqi,16px)}
.mg-g1{grid-template-columns:minmax(0,1fr)}
.mg-g1 .mg-shot{aspect-ratio:21/9}
.mg-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mg-g2 .mg-shot{aspect-ratio:4/3}
.mg-g3{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));height:clamp(420px,52cqi,640px)}
.mg-g3 .mg-shot:first-child{grid-row:1 / span 2}
.mg-g4{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));height:clamp(420px,52cqi,640px)}
.mg-g4 .mg-shot:nth-child(1){grid-row:1 / span 2}
.mg-g4 .mg-shot:nth-child(2){grid-column:2 / span 2}
.mg-shot{position:relative;min-height:0;overflow:hidden;border-radius:2px;background:var(--mg-surface)}
.mg-shot::after{content:'';position:absolute;left:0;bottom:0;width:48px;height:4px;background:var(--mg-accent)}
.mg-track{display:flex;gap:clamp(12px,1.4cqi,18px);overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc(-1 * var(--mg-gutter));padding:0 var(--mg-gutter) 4px;scroll-padding:0 var(--mg-gutter)}
.mg-track::-webkit-scrollbar{display:none}
.mg-track .mg-shot{flex:0 0 auto;width:clamp(240px,30cqi,380px);aspect-ratio:4/5;scroll-snap-align:start}
.mg-swipe{margin-top:20px;font-family:var(--mg-mono);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mg-muted)}

.mg-quote{flex:1;display:flex;flex-direction:column;padding:clamp(26px,3cqi,36px);background-color:var(--mg-surface);background-image:var(--mg-hatch);border:1px solid var(--mg-border);border-top:4px solid var(--mg-accent);border-radius:3px}
.mg-quote-mark{display:block;color:var(--mg-accent-text)}
.mg-quote blockquote{flex:1;margin-top:20px}
.mg-quote blockquote p{font-size:17px;line-height:1.75;color:var(--mg-text);text-wrap:pretty}
.mg-quote figcaption{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin-top:24px;padding-top:18px;border-top:1px dashed var(--mg-border-strong);font-family:var(--mg-head);font-size:15px;font-weight:var(--mg-hw2);letter-spacing:.04em;text-transform:uppercase;color:var(--mg-text)}
.mg-quote figcaption span{font-family:var(--mg-mono);font-size:12px;font-weight:400;letter-spacing:.08em;color:var(--mg-muted)}
.mg-reviews-widget{margin-top:8px}

.mg-contact{position:relative;scroll-margin-top:75px}
.mg-cta{position:relative;overflow:clip;padding:clamp(64px,8cqi,112px) 0}
.mg-cta-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);align-items:end;gap:36px clamp(32px,6cqi,96px)}
.mg-cta .mg-eyebrow{color:var(--mg-band-muted)}
.mg-cta .mg-eyebrow::before{background:var(--mg-band-text)}
.mg-cta-h{margin-top:18px;font-family:var(--mg-head);font-size:clamp(38px,6cqi,86px);font-weight:var(--mg-hw);line-height:.95;letter-spacing:-.025em;text-transform:uppercase;text-wrap:balance}
.mg-cta-sub{margin-top:22px;max-width:540px;font-size:18px;line-height:1.6;color:var(--mg-band-muted);text-wrap:pretty}
.mg-cta-side{display:flex;flex-direction:column;gap:12px}
.mg-cta-side .mg-btn{width:100%}
.mg-btn-ink{color:var(--mg-ink-accent);background-color:var(--mg-band-text)}
.mg-btn-ink-line{color:var(--mg-band-text);border-color:var(--mg-band-line-strong)}
.mg-pay{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.mg-pay li{padding:4px 10px;border:1px solid var(--mg-band-line-strong);border-radius:2px;font-family:var(--mg-mono);font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.mg-info{padding:clamp(56px,7cqi,96px) 0}
.mg-info-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;gap:clamp(36px,5cqi,72px)}
.mg-info-solo{grid-template-columns:minmax(0,760px)}
.mg-row{display:flex;gap:18px;padding:20px 0;border-top:1px solid var(--mg-border)}
.mg-row:first-child{padding-top:0;border-top:0}
.mg-row:last-child{padding-bottom:0}
.mg-icon{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:2px;border:1px solid var(--mg-accent-line);background:var(--mg-soft-bg);color:var(--mg-soft-text)}
.mg-row-body{flex:1;min-width:0}
.mg-row-value{display:block;margin-top:6px;font-size:17px;line-height:1.55;color:var(--mg-text);overflow-wrap:anywhere}
.mg-row-value a{color:inherit;text-decoration:none;border-bottom:1px solid var(--mg-border-strong)}
.mg-timecard{scroll-margin-top:90px;overflow:hidden;border:1px solid var(--mg-border);border-radius:3px;background-color:var(--mg-surface);background-image:var(--mg-hatch)}
.mg-timecard-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 24px;background:var(--mg-accent);color:var(--mg-on-accent)}
.mg-timecard-head h3{font-family:var(--mg-head);font-size:22px;font-weight:var(--mg-hw);line-height:1.1;letter-spacing:.01em;text-transform:uppercase}
.mg-timecard dl{padding:6px 24px 18px}
.mg-time{display:flex;align-items:baseline;gap:14px;padding:13px 0;border-bottom:1px dashed var(--mg-border)}
.mg-time:last-child{border-bottom:0}
.mg-time dt{flex:1;display:flex;align-items:baseline;gap:14px;min-width:0;font-family:var(--mg-mono);font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--mg-text)}
.mg-time dt::after{content:'';flex:1;min-width:16px;border-bottom:1px dotted var(--mg-border-strong)}
.mg-time dd{font-family:var(--mg-mono);font-size:14px;font-weight:700;white-space:nowrap;color:var(--mg-accent-text)}
.mg-time.is-closed dt,.mg-time.is-closed dd{color:var(--mg-muted);font-weight:400}
.mg-time-line{padding:18px 24px 22px;font-family:var(--mg-mono);font-size:14px;line-height:1.7;color:var(--mg-text)}

.mg-awards{position:relative;padding:clamp(40px,5cqi,60px) 0;border-top:1px solid var(--mg-border);border-bottom:1px solid var(--mg-border)}
.mg-awards-in{display:flex;flex-wrap:wrap;align-items:center;gap:20px clamp(28px,4cqi,56px)}
.mg-award-list{display:flex;flex-wrap:wrap;gap:14px clamp(22px,3.4cqi,44px)}
.mg-award{display:inline-flex;align-items:center;gap:12px;font-family:var(--mg-head);font-size:clamp(16px,1.5cqi,19px);font-weight:var(--mg-hw2);line-height:1.3;text-transform:uppercase;color:var(--mg-text)}
.mg-award svg{flex:none;color:var(--mg-accent-text)}

.mg-foot{padding:clamp(64px,8cqi,96px) 0 32px;background-color:var(--mg-footer-bg);background-image:var(--mg-grain),var(--mg-footer-hatch);border-top:3px solid var(--mg-accent);color:var(--mg-footer-muted);font-size:15px;line-height:1.6}
.mg-foot-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);gap:40px clamp(32px,5cqi,80px)}
.mg-foot .mg-brand{color:var(--mg-footer-text)}
.mg-foot .mg-wordmark{font-size:24px}
.mg-foot-tag{margin-top:18px;max-width:360px}
.mg-foot-h{font-family:var(--mg-mono);font-size:11.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--mg-footer-text)}
.mg-foot-list{display:grid;gap:10px;margin-top:18px}
.mg-foot a{color:var(--mg-footer-muted);text-decoration:none}
.mg-social{margin-top:24px}
.mg-social a{width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--mg-footer-line);border-radius:2px}
.mg-foot-bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;margin-top:clamp(48px,6cqi,72px);padding-top:22px;border-top:1px solid var(--mg-footer-line);font-family:var(--mg-mono);font-size:12px;letter-spacing:.06em}

@media (hover:hover){
.mg-link:hover{color:var(--mg-text)}
.mg-link:hover::after{transform:scaleX(1)}
.mg-btn-solid:hover{background-color:var(--mg-accent-hover);box-shadow:0 18px 36px -14px var(--mg-glow);transform:translateY(-1px)}
.mg-btn-line:hover{color:var(--mg-soft-text);background:var(--mg-soft-bg)}
.mg-has-media .mg-btn-line:hover{color:var(--mg-on-hero);border-color:var(--mg-on-hero);background:var(--mg-on-hero-soft)}
.mg-btn-ink:hover{transform:translateY(-1px);box-shadow:0 16px 32px -16px var(--mg-shadow)}
.mg-btn-ink-line:hover{border-color:var(--mg-band-text);box-shadow:inset 0 0 0 1px var(--mg-band-text)}
.mg-card:hover{transform:translateY(-4px);border-top-color:var(--mg-border-strong);border-right-color:var(--mg-border-strong);border-bottom-color:var(--mg-border-strong);box-shadow:0 28px 52px -30px var(--mg-shadow)}
.mg-card .acg-svc-book:hover svg{transform:translateX(4px)}
.mg-shot:hover img{transform:scale(1.04)}
.mg-quote:hover{border-left-color:var(--mg-border-strong);border-right-color:var(--mg-border-strong);border-bottom-color:var(--mg-border-strong)}
.mg-row-value a:hover{color:var(--mg-accent-text);border-bottom-color:var(--mg-accent-text)}
.mg-foot a:hover{color:var(--mg-footer-text)}
.mg-social a:hover{border-color:var(--mg-footer-accent)}
}
@media (prefers-reduced-motion:no-preference){
.mg-nav{transition:background-color .3s ease,box-shadow .3s ease}
.mg-link,.mg-row-value a,.mg-foot a{transition:color .2s ease,border-color .2s ease}
.mg-link::after{transition:transform .3s cubic-bezier(.2,.7,.2,1)}
.mg-btn{transition:background-color .2s ease,border-color .2s ease,box-shadow .3s ease,transform .15s ease}
.mg-card{transition:transform .35s cubic-bezier(.2,.7,.2,1),border-color .25s ease,box-shadow .35s ease}
.mg-card .acg-svc-book svg{transition:transform .25s ease}
.mg-shot img{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.mg-quote,.mg-social a{transition:border-color .25s ease}
.mg-door-panel{animation:mg-door-up 1.6s cubic-bezier(.2,.7,.2,1) both}
.mg-door-glow{animation:mg-glow-in 1.9s ease both}
@keyframes mg-door-up{from{transform:translateY(24%)}to{transform:none}}
@keyframes mg-glow-in{from{opacity:0}to{opacity:1}}
}

@container (max-width:1180px){.mg-link-x{display:none}}
@container (max-width:900px){
.mg-nav-cta{display:none}
.mg-c3{grid-template-columns:repeat(2,minmax(0,1fr))}
/* Three (or five) cards in two columns: the odd one out runs full width
   instead of leaving a half-row hole. */
.mg-c3>.mg-cell:last-child:nth-child(odd){grid-column:1 / -1}
.mg-c3>.mg-cell:last-child:nth-child(odd) :where(.acg-svc-desc,blockquote){max-width:62ch}
.mg-n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.mg-n4 .mg-fact:nth-child(odd){border-left:0;padding-left:0}
.mg-n4 .mg-fact:nth-child(even){padding-right:0}
.mg-n4 .mg-fact:nth-child(n+3){border-top:1px solid var(--mg-band-line)}
.mg-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.mg-foot-brand{grid-column:1 / -1}
/* Tablet and phone: the door hangs above the copy instead of beside it,
   and the hero takes its content's height so the copy sits right under
   the door (a screen-tall hero left an empty band between them). */
.mg-hero:not(.mg-has-media){--mg-door-h:clamp(96px,16cqi,140px);--mg-door-w:min(44cqi,340px);min-height:0;align-items:flex-start;padding-top:calc(var(--mg-door-h) + 56px);padding-bottom:64px}
.mg-door{height:var(--mg-door-h)}
.mg-door-floor{display:none}
}
@container (max-width:760px){
.mg-head,.mg-about,.mg-cta-grid,.mg-info-grid{grid-template-columns:minmax(0,1fr)}
.mg-media{aspect-ratio:4/3}
.mg-cta-side{max-width:440px}
.mg-warranty{grid-template-columns:auto minmax(0,1fr)}
.mg-warranty .mg-btn{grid-column:1 / -1;justify-self:start}
}
@container (max-width:600px){
.mg-links,.mg-nav-cta{display:none}
.mg-nav-in{min-height:62px;gap:12px}
.mg-wordmark{font-size:17px}
.mg-bar{width:6px;height:26px}
.mg-hero{min-height:0;padding:72px 0 48px}
.mg-hero.mg-has-media{min-height:clamp(540px,84vh,760px)}
.mg-hero-scrim{background:var(--mg-scrim)}
.mg-h1,.mg-split .mg-h1{margin-top:22px;font-size:clamp(38px,11.5cqi,56px);line-height:.98}
.mg-h1.mg-h1-long,.mg-split .mg-h1.mg-h1-long{font-size:clamp(32px,9.4cqi,46px);line-height:1}
.mg-lead{font-size:17px}
.mg-actions{flex-direction:column;align-items:stretch;margin-top:32px}
.mg-hero-meta{gap:10px 20px;margin-top:36px}
.mg-split{grid-template-columns:minmax(0,1fr);min-height:0}
.mg-split-text{padding:60px var(--mg-gutter) 48px}
.mg-split-photo{min-height:0;aspect-ratio:4/3;border-left:0;border-top:6px solid var(--mg-accent)}
.mg-facts{grid-template-columns:minmax(0,1fr)}
.mg-fact,.mg-n4 .mg-fact:nth-child(n){display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding:18px 0;border-left:0;border-top:1px solid var(--mg-band-line)}
.mg-fact:first-child,.mg-n4 .mg-fact:first-child{border-top:0}
.mg-fact-value{margin-top:0;text-align:right;font-size:17px}
.mg-stats-kind.mg-facts{grid-template-columns:repeat(2,minmax(0,1fr))}
.mg-stats-kind .mg-fact,.mg-stats-kind.mg-n4 .mg-fact:nth-child(n){display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:22px 0;border-top:1px solid var(--mg-band-line)}
.mg-stats-kind .mg-fact:nth-child(-n+2){border-top:0}
.mg-stats-kind .mg-fact:last-child:nth-child(odd){grid-column:1 / -1}
.mg-section{padding:72px 0}
.mg-h2{font-size:clamp(32px,9.5cqi,42px)}
.mg-c1,.mg-c2,.mg-c3{grid-template-columns:minmax(0,1fr)}
.mg-warranty{grid-template-columns:minmax(0,1fr)}
.mg-warranty-icon{width:48px;height:48px}
.mg-dl{grid-template-columns:minmax(0,1fr)}
.mg-g2,.mg-g3{grid-template-columns:minmax(0,1fr);grid-template-rows:none;height:auto}
.mg-g3 .mg-shot:first-child{grid-row:auto}
.mg-g1 .mg-shot,.mg-g2 .mg-shot,.mg-g3 .mg-shot{aspect-ratio:4/3}
.mg-g4{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:none;height:auto}
.mg-g4 .mg-shot:nth-child(n){grid-row:auto;grid-column:auto;aspect-ratio:1}
.mg-g4 .mg-shot:nth-child(1),.mg-g4 .mg-shot:nth-child(4){grid-column:1 / -1;aspect-ratio:16/10}
.mg-track .mg-shot{width:78%}
.mg-cta{padding:64px 0}
.mg-cta-h{font-size:clamp(36px,10.5cqi,50px)}
.mg-cta-side{max-width:none}
.mg-info{padding:56px 0}
.mg-timecard-head,.mg-time-line{padding-left:20px;padding-right:20px}
.mg-timecard dl{padding:4px 20px 14px}
.mg-foot{padding-top:56px}
.mg-foot-grid{grid-template-columns:minmax(0,1fr)}
}
`;

const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// Heaviest weight <= `want` the heading font ships (catalog fonts only;
// system stacks keep `want`). Single-weight faces (Bebas Neue, DM Serif
// Display...) get 400, so the browser never fakes a bold.
function fontWeight(stack, want) {
  const family = catalogFamily(familiesFromStack(stack)[0]);
  if (!family) return want;
  const weights = FONT_CATALOG[family].weights;
  if (weights.length === 0) return 400;
  const fit = weights.filter((w) => w <= want);
  return fit.length > 0 ? fit[fit.length - 1] : weights[0];
}

// Hours, only as the owner entered them. The per-day editor's shape
// (exactly the seven HOURS_DAYS keys, '' = closed) is the only one allowed
// to say "Closed": it fills the time card day by day and is grouped into
// runs for the stats bar. Older free text never gains facts:
// normalizeBusinessInfo splits "Mon-Fri 8am-6pm · Sat 9am-4pm" into
// { 'Mon-Fri': '8am-6pm', Sat: ... }, shown one row per pair when every key
// is a plain day or day range; anything else ("Mon-Fri: 8am-6pm", "By
// appointment") stays the single line formatHours() always produced.
const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const DAY = '(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?';
const DAY_SPAN_RE = new RegExp(`^${DAY}(?:\\s*[-–]\\s*${DAY})?$`, 'i');
const cleanTime = (v) => txt(v).replace(/\s*[-–]\s*$/, '').replace(/\s*[-–]\s*/, ' – ');
function readHours(hours) {
  const none = { daily: [], runs: [], line: '' };
  if (!hours) return none;
  if (typeof hours === 'object' && !Array.isArray(hours)) {
    const keys = Object.keys(hours);
    if (keys.length === HOURS_DAYS.length && HOURS_DAYS.every((d) => keys.includes(d))) {
      if (!HOURS_DAYS.some((d) => cleanTime(hours[d]))) return none;
      const daily = HOURS_DAYS.map((d) => {
        const time = cleanTime(hours[d]);
        return { days: DAY_NAMES[d], time: time || 'Closed', closed: !time };
      });
      const runs = [];
      for (const d of HOURS_DAYS) {
        const time = cleanTime(hours[d]);
        const last = runs[runs.length - 1];
        if (last && last.time === time) last.end = d;
        else runs.push({ start: d, end: d, time });
      }
      return {
        daily,
        runs: runs.map((r) => ({ days: r.start === r.end ? r.start : `${r.start}–${r.end}`, time: r.time || 'Closed', closed: !r.time })),
        line: '',
      };
    }
    if (keys.length > 0 && keys.every((k) => DAY_SPAN_RE.test(k.trim()) && cleanTime(hours[k]))) {
      const rows = keys.map((k) => ({ days: k.trim(), time: cleanTime(hours[k]), closed: false }));
      return { daily: rows, runs: rows, line: '' };
    }
  }
  const line = formatHours(hours).trim();
  return line ? { ...none, line } : none;
}

// The stats-bar "Hours" fact must be the whole truth in a few words: all
// open runs (one per line) when there are at most two, or a short line.
function hoursFact({ runs, line }) {
  if (line) return line.length <= 40 ? line : null;
  const open = runs.filter((r) => !r.closed);
  return open.length > 0 && open.length <= 2 ? open.map((r) => `${r.days} ${r.time}`).join('\n') : null;
}

// Services: the owner's Services tab (businessInfo.services, mirrored to
// packages by normalizeBusinessInfo) wins, so name / price / delete edits
// show. A service the owner left without a description borrows the AI
// description written for the same name. Without owner edits the AI list
// renders as before, then the plain wizard checklist. One list only: the
// old second "Service Packages" block repeated the same services.
const svcKey = (s) => txt(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function resolveServices(biz, copy) {
  const ai = list(copy.servicesSection?.items)
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }));
  const aiDesc = new Map(ai.filter((s) => s.name && s.description).map((s) => [svcKey(s.name), s.description]));
  // Legacy sites may hold plain-string packages; the old Packages block
  // showed them as names, so they still count as the owner's list.
  const owner = list(biz.packages)
    .map((s) => (typeof s === 'string' ? { name: s } : s))
    .filter((s) => s && typeof s === 'object');
  const nameOf = (s) => txt(typeof s === 'string' ? s : s?.name);
  const raw = owner.length > 0
    ? owner.map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) || aiDesc.get(svcKey(s.name)) || '' }))
    : ai.length > 0
      ? ai
      : list(biz.services).map((s) => ({ name: nameOf(s), price: '', description: aiDesc.get(svcKey(nameOf(s))) || '' }));
  return { items: raw.filter((s) => s.name || s.description || s.price), fromOwner: owner.length > 0 };
}

// Concrete, band and roll-up-door tokens, all derived from the owner's
// five colors. The default palette (#1a1a1a / #f97316) gives the original
// charcoal-and-orange shop; any other palette gets the same materials in
// its own hues, every text pair contrast-checked.
function garageTokens(t) {
  const onAccent = ensureContrast(t.onAccent, t.accent, 4.5);
  const footerBg = t.isDark ? mix(t.bg, '#000000', 0.45) : mix(t.text, t.bg, 0.06);
  const footerText = ensureContrast(t.isDark ? t.text : mix(t.bg, '#ffffff', 0.6), footerBg, 4.5);
  const hatch = (c, k) => `repeating-linear-gradient(135deg, ${alpha(c, k)} 0 1px, transparent 1px 18px), repeating-linear-gradient(45deg, ${alpha(c, k * 0.7)} 0 1px, transparent 1px 24px)`;
  // Accent-tinted fills that carry text (hero tag, outline-button hover)
  // are opaque, so their text can be contrast-checked against the actual
  // color underneath; a translucent tint dipped under 4.5:1 on mid-tone
  // accents.
  const softBg = mix(t.bg, t.accent, t.isDark ? 0.16 : 0.1);
  return {
    '--mg-on-accent': onAccent,
    '--mg-accent-hover': mix(t.accent, onAccent === '#ffffff' ? '#000000' : '#ffffff', 0.12),
    '--mg-accent-line': alpha(t.accent, 0.45),
    '--mg-soft-bg': softBg,
    '--mg-soft-text': ensureContrast(t.accentText, softBg, 4.5),
    // Text on cards (warranty): the surface is an owner color, so re-check.
    '--mg-surface-text': ensureContrast(t.text, t.surface, 4.5),
    '--mg-surface-muted': ensureContrast(t.textMuted, t.surface, 4.5),
    '--mg-hazard': footerBg,
    '--mg-glow': alpha(t.accent, 0.35),
    '--mg-glow-strong': alpha(t.accent, t.isDark ? 0.42 : 0.3),
    '--mg-shadow': alpha('#000000', t.isDark ? 0.6 : 0.22),
    '--mg-hatch': hatch(t.text, t.isDark ? 0.018 : 0.035),
    '--mg-nav-scrolled': t.isDark ? mix(t.bg, '#000000', 0.32) : t.bg,
    // Roll-up door: slats a step off the page, rails a step lighter.
    '--mg-slat': t.isDark ? mix(t.surface, t.bg, 0.25) : mix(t.surface, t.text, 0.06),
    '--mg-slat-hi': alpha(t.text, t.isDark ? 0.09 : 0.14),
    '--mg-slat-lo': alpha('#000000', t.isDark ? 0.5 : 0.16),
    '--mg-rail': t.isDark ? mix(t.surface, t.text, 0.08) : mix(t.surface, t.text, 0.16),
    // Orange bands (stats, contact): text on the accent itself.
    '--mg-band-bg': t.accent,
    '--mg-band-text': onAccent,
    '--mg-band-muted': ensureContrast(mix(onAccent, t.accent, 0.28), t.accent, 4.5),
    '--mg-band-line': alpha(onAccent, 0.22),
    '--mg-band-line-strong': alpha(onAccent, 0.55),
    '--mg-band-hatch': `repeating-linear-gradient(135deg, ${alpha(onAccent, 0.05)} 0 1px, transparent 1px 12px)`,
    '--mg-ink-accent': ensureContrast(t.accent, onAccent, 4.5),
    // Photo heroes melt into a dark page; on a light page that fade would
    // put the white hero text on a light band, so it is dropped.
    '--mg-hero-fade': t.isDark ? `linear-gradient(180deg, transparent, ${t.bg})` : 'none',
    '--mg-on-hero-muted': alpha(t.onHero, 0.86),
    '--mg-on-hero-line': alpha(t.onHero, 0.45),
    '--mg-on-hero-soft': alpha(t.onHero, 0.12),
    // Footer: a darker slab under a dark page, a charcoal one under a light page.
    '--mg-footer-bg': footerBg,
    '--mg-footer-text': footerText,
    '--mg-footer-muted': ensureContrast(mix(footerText, footerBg, 0.36), footerBg, 4.5),
    '--mg-footer-line': alpha(footerText, 0.14),
    '--mg-footer-accent': ensureContrast(t.accent, footerBg, 4.5),
    '--mg-footer-hatch': hatch(footerText, 0.014),
  };
}

const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12.2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6.5 12 13l8.5-6.5',
  shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6zM9 12l2 2 4-4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.8 7 21l5-2.5 5 2.5-1.5-7.2',
  check: 'M4 12.5l5 5L20 6.5',
};

// Half-open roll-up door with shop light spilling out from under it: the
// no-photo hero's motif (it rolls up on load when motion is allowed).
function Door() {
  return (
    <div className="mg-door" aria-hidden="true">
      <div className="mg-door-clip"><div className="mg-door-panel" /></div>
      <div className="mg-door-glow" />
      <div className="mg-door-floor" />
    </div>
  );
}

// What a published page shows where a photo is missing: door slats with the
// business initial stencilled on (never an "upload a photo" box).
function ShopSign({ name }) {
  const letter = (txt(name).match(/[A-Za-z0-9]/) || ['•'])[0].toUpperCase();
  return (
    <div className="mg-sign" aria-hidden="true">
      <span className="mg-sign-letter">{letter}</span>
    </div>
  );
}

// Owner-facing hint for an empty slot; never reaches the published page.
function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="mg-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

const fill = { position: 'absolute', inset: 0, height: '100%' };

export default function MechanicGarage({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const font = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const fb = getFallbacks(biz.businessType);

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrder(copy, sections.map((s) => s.id));

  const name = txt(biz.businessName);
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const place = [txt(biz.city), txt(biz.state)].filter(Boolean).join(', ');
  const address = txt(biz.address);
  const email = txt(biz.email);
  const area = txt(biz.serviceArea);
  const years = txt(biz.yearsInBusiness);
  const hours = readHours(biz.hours);
  const hasHours = hours.daily.length > 0 || !!hours.line;
  const hoursSummary = hoursFact(hours);
  const payments = list(biz.paymentMethods).map(txt).filter(Boolean);
  const awards = list(biz.awards).map(txt).filter(Boolean);
  const certs = list(biz.certifications).map(txt).filter(Boolean);
  const brands = list(biz.brands).map(txt).filter(Boolean);
  const specialties = txt(biz.specialties);
  // Mechanics fill "Parts & Labor Warranty" (warrantyOffered); other shop
  // types "Warranty Offered" (warranty). Either one, as written.
  const warranties = [...new Set([txt(biz.warrantyOffered), txt(biz.warranty)].filter(Boolean))];

  const { items: services, fromOwner } = resolveServices(biz, copy);
  const hasServices = show('services') && services.length > 0;
  const svcCols = services.length === 1 ? 'mg-c1' : services.length === 2 || services.length === 4 ? 'mg-c2' : 'mg-c3';

  // Stats only from what the owner entered: About > Stats Box values, else
  // business facts. No invented counts, ratings or warranty terms.
  const ownerStats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label);
  const shortWarranty = warranties.find((w) => w.length <= 28);
  const specFacts = [
    years && { label: 'Experience', value: /^\d+\+?$/.test(years) ? `${years} ${years === '1' ? 'year' : 'years'}` : years },
    area ? { label: 'Service area', value: area } : place && { label: 'Based in', value: place },
    hoursSummary && { label: 'Hours', value: hoursSummary },
    shortWarranty && { label: 'Warranty', value: shortWarranty },
    payments.length > 0 && { label: 'Payment', value: payments.join(', ') },
  ].filter(Boolean).slice(0, 4);
  const aboutStatsMode = (copy.aboutLayout || 'image') === 'stats';
  const aboutShowsStats = aboutStatsMode && ownerStats.length > 0 && show('about');
  const barStats = !aboutShowsStats && ownerStats.length > 0 ? ownerStats.slice(0, 4) : null;
  const barFacts = !barStats && specFacts.length >= 2 ? specFacts : null;
  const barItems = barStats || barFacts || [];

  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);

  const testimonials = list(copy.testimonialPlaceholders).filter((q) => txt(q?.text));
  const reviews = copy.googleWidgetKey ? 'google' : testimonials.length > 0 ? 'quotes' : null;

  const navLinks = [
    hasServices && { href: '#services', label: 'Services' },
    show('cta') && hasHours && { href: '#hours', label: 'Hours' },
    show('about') && { href: '#about', label: 'About' },
    show('gallery') && galleryImages.length > 0 && { href: '#gallery', label: 'Work', extra: true },
    show('testimonials') && reviews && { href: '#reviews', label: 'Reviews', extra: true },
    show('cta') && { href: '#contact', label: 'Contact' },
  ].filter(Boolean);

  // Hero buttons: owner URLs win. Without one, each button goes where its
  // label points: "Book / Schedule / Quote" to the contact section (booking
  // and phone live there), "Our Services" to the services, anything else
  // to the services (primary) or a phone call (secondary), as before.
  const BOOKISH = /book|schedul|appoint|quote|estimate|contact|call/i;
  const SVCISH = /servic|price|menu/i;
  const heroPrimaryLabel = txt(copy.ctaPrimary) || (hasServices ? 'View Services' : 'Get in Touch');
  const heroPrimaryHref = txt(copy.ctaPrimaryUrl)
    || (BOOKISH.test(heroPrimaryLabel) && show('cta') ? '#contact' : hasServices ? '#services' : '#contact');
  const heroSecondaryLabel = txt(copy.ctaSecondary) || (phone ? `Call ${phone}` : '');
  const heroSecondaryHref = txt(copy.ctaSecondaryUrl) || (hasServices && SVCISH.test(heroSecondaryLabel) ? '#services' : tel);
  const splitHero = copy.heroLayout === 'split';
  const heroMeta = [txt(biz.tagline), place].filter(Boolean);

  const vars = {
    '--mg-bg': t.bg,
    '--mg-surface': t.surface,
    '--mg-text': t.text,
    '--mg-muted': t.textMuted,
    '--mg-accent': t.accent,
    '--mg-accent-text': t.accentText,
    '--mg-border': t.border,
    '--mg-border-strong': t.borderStrong,
    '--mg-focus': t.focus,
    '--mg-scrim': t.heroScrim,
    '--mg-scrim-left': t.heroScrimLeft,
    '--mg-on-hero': t.onHero,
    '--mg-head': font,
    '--mg-body': body,
    '--mg-mono': extraFonts[0],
    '--mg-hw': fontWeight(font, 900),
    '--mg-hw2': fontWeight(font, 800),
    '--mg-gutter': 'clamp(20px, 5cqi, 48px)',
    ...garageTokens(t),
  };

  // Logo if uploaded, else the orange bar + wordmark (nav and footer).
  const brand = (logoStyle, loading) => (
    <>
      <span className="mg-bar" aria-hidden="true" />
      {images.logo ? (
        <PhotoSlot src={images.logo} alt={name ? `${name} logo` : 'Logo'} loading={loading} style={logoStyle} imgStyle={{ objectFit: 'contain' }} />
      ) : (
        <span className="mg-wordmark">{name}</span>
      )}
    </>
  );

  // Headlines past ~44 characters step down a size (see .mg-h1-long), so a
  // typical 50-60 character AI headline still leaves the buttons in view.
  const headline = txt(copy.headline) || name;
  const heroText = (
    <>
      <p className="mg-tag">Raw. Real. Reliable.</p>
      <h1 className={`mg-h1${headline.length > 44 ? ' mg-h1-long' : ''}`}>{headline}</h1>
      {txt(copy.subheadline) && <p className="mg-lead">{copy.subheadline}</p>}
      <div className="mg-actions">
        <a className="mg-btn mg-btn-solid" href={heroPrimaryHref}>{heroPrimaryLabel}<Icon d={ICONS.arrow} /></a>
        {heroSecondaryHref && heroSecondaryLabel && (
          <a className="mg-btn mg-btn-line" href={heroSecondaryHref}>{heroSecondaryLabel}</a>
        )}
      </div>
      {heroMeta.length > 0 && (
        <ul className="mg-hero-meta">
          {heroMeta.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
    </>
  );

  // About: "8 Years In The Trenches" only when the owner gave a number.
  const yearsNum = /^\d+\+?$/.test(years) ? years : '';
  const aboutTitle = yearsNum ? `${yearsNum} ${yearsNum === '1' ? 'Year' : 'Years'} In The Trenches` : 'Built In The Trenches';
  const aboutParas = txt(copy.aboutText).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const aboutFacts = [
    place && { label: 'Based in', value: place },
    area && { label: 'Service area', value: area },
    specialties && specialties.length <= 120 && { label: 'Specialties', value: specialties, wide: true },
  ].filter(Boolean);

  // Contact band: primary opens booking (or the owner's URL); a phone
  // button sits next to it whenever the primary isn't the call itself.
  const ctaLabelSet = txt(copy.ctaButtonText) || txt(copy.ctaPrimary);
  const contactPrimaryLabel = ctaLabelSet || (phone ? `Call ${phone}` : 'Get in Touch');
  const contactPrimaryHref = txt(copy.ctaUrl) || (ctaLabelSet ? tel || '#contact' : tel);
  const contactBooking = !txt(copy.ctaUrl) && !!ctaLabelSet;
  const callLabel = txt(copy.ctaSecondaryText) || (phone ? `Call ${phone}` : '');
  const callHref = (txt(copy.ctaSecondaryText) && txt(copy.ctaSecondaryUrl)) || tel;
  const showCall = callLabel && callHref && (ctaLabelSet || txt(copy.ctaUrl));
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, place].filter(Boolean).join(', '))}`
    : null;
  const contactRows = [
    phone && { key: 'phone', icon: ICONS.phone, label: 'Call the shop', value: tel ? <a href={tel}>{phone}</a> : phone },
    email && { key: 'email', icon: ICONS.mail, label: 'Email', value: <a href={`mailto:${email}`}>{email}</a> },
    (address || place || area) && {
      key: 'where',
      icon: ICONS.pin,
      label: address ? 'Find us' : area ? 'Service area' : 'Based in',
      value: address ? <a href={mapsHref} target="_blank" rel="noopener noreferrer">{[address, place].filter(Boolean).join(', ')}</a> : (area || place),
      extra: address && area ? area : '',
    },
    // The warranty box lives in Services; repeat it here only when that
    // section isn't on the page.
    !hasServices && warranties.length > 0 && { key: 'warranty', icon: ICONS.shield, label: 'Warranty', value: warranties.join(' · ') },
  ].filter(Boolean);

  const timeCard = hasHours && (
    <div id="hours" className="mg-timecard" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
      <div className="mg-timecard-head">
        <h3>Shop Hours</h3>
        <Icon d={ICONS.clock} size={22} />
      </div>
      {hours.line ? (
        <p className="mg-time-line">{hours.line}</p>
      ) : (
        <dl>
          {hours.daily.map((h) => (
            <div key={h.days} className={`mg-time${h.closed ? ' is-closed' : ''}`}>
              <dt>{h.days}</dt>
              <dd>{h.time}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );

  return (
    <div
      id="top"
      className="mg-root"
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.6 }}
    >
      <style>{CSS}</style>
      <a className="mg-skip" href="#main">Skip to content</a>

      <nav className="mg-nav" aria-label="Main" style={{ order: -1 }}>
        <div className="mg-wrap mg-nav-in">
          <a className="mg-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
            {brand({ height: 38, width: 'auto', maxWidth: 170 }, 'eager')}
          </a>
          {(navLinks.length > 0 || tel) && (
            <div className="mg-links">
              {navLinks.map((l) => (
                <a key={l.href} className={`mg-link${l.extra ? ' mg-link-x' : ''}`} href={l.href}>{l.label}</a>
              ))}
              {tel && (
                <a className="mg-btn mg-btn-solid mg-btn-sm mg-nav-cta" href={tel}>
                  <Icon d={ICONS.phone} size={16} />{phone}
                </a>
              )}
            </div>
          )}
          <MobileMenu
            links={navLinks}
            cta={tel ? { href: tel, label: `Call ${phone}` } : { href: '#contact', label: 'Contact us' }}
            colors={{ bg: t.bg, text: t.text, accent: t.accent, onAccent: vars['--mg-on-accent'] }}
            font={body}
          />
        </div>
      </nav>

      <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
        {!show('hero') && <h1 className="mg-sr">{name}</h1>}

        {show('hero') && !splitHero && (
          <header data-section="hero" className={`mg-hero mg-tex${images.hero ? ' mg-has-media' : ''}`} style={{ order: order('hero') }}>
            {images.hero ? (
              <>
                <div className="mg-hero-media">
                  <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
                </div>
                <div className="mg-hero-scrim" />
                <div className="mg-hero-fade" />
              </>
            ) : (
              <Door />
            )}
            <div className="mg-wrap">
              <div className="mg-hero-body">
                {heroText}
                {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
              </div>
            </div>
          </header>
        )}

        {show('hero') && splitHero && (
          <header data-section="hero" className="mg-split mg-tex" style={{ order: order('hero') }}>
            <div className="mg-split-text">{heroText}</div>
            <div className="mg-split-photo">
              <PhotoSlot src={images.hero} slot="hero" alt="" loading="eager" fetchPriority="high" style={fill} fallback={<ShopSign name={name} />} />
            </div>
          </header>
        )}

        {show('statsBar') && (barItems.length > 0 || editor) && (
          <section data-section="statsBar" className="mg-band" aria-label="At a glance" style={{ order: order('statsBar') }}>
            <div className="mg-wrap">
              {barItems.length > 0 ? (
                <dl className={`mg-facts mg-n${barItems.length}${barStats ? ' mg-stats-kind' : ''}`}>
                  {barItems.map((f, i) => (
                    <div key={`${f.label}-${i}`} className={`mg-fact${barStats ? ' mg-stat' : ''}`} data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <dt className="mg-label">{f.label}</dt>
                      <dd className={barStats ? 'mg-stat-value' : 'mg-fact-value'}>{f.value}</dd>
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

        {hasServices && (
          <section data-section="services" id="services" className="mg-section mg-tex" aria-labelledby="mg-services-h" style={{ order: order('services') }}>
            <ServiceCardCss />
            <div className="mg-wrap">
              <div className={`mg-head${txt(copy.servicesSection?.intro) ? '' : ' mg-head-solo'}`} data-acg-reveal="">
                <div>
                  <p className="mg-eyebrow">What we do</p>
                  <h2 id="mg-services-h" className="mg-h2">{txt(copy.servicesSection?.title) || 'Our Services'}</h2>
                </div>
                {txt(copy.servicesSection?.intro) && <p className="mg-intro">{copy.servicesSection.intro}</p>}
              </div>
              <div className={`mg-grid ${svcCols}`}>
                {services.map((s, i) => (
                  <div key={`${s.name}-${i}`} className="mg-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <article className="acg-svc-card mg-card">
                      <div className="mg-card-top">
                        <span className="mg-idx">No. {String(i + 1).padStart(2, '0')}</span>
                        {s.price && <span className="mg-price">{s.price}</span>}
                      </div>
                      {s.name && <h3 className="mg-card-title">{s.name}</h3>}
                      <ServiceDescription
                        id={`svc-more-${fromOwner ? 'pkg' : 'ai'}-${i}`}
                        text={s.description}
                        style={{ marginTop: 12, color: t.textMuted, fontSize: 15.5, lineHeight: 1.7 }}
                        accentColor={t.accentText}
                      />
                      <div className="acg-svc-foot">
                        <div className="mg-card-foot">
                          <BookNowLink serviceName={s.name} phone={phone} label={<>Book now <Icon d={ICONS.arrow} size={16} /></>} />
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
              {warranties.length > 0 && (
                <div className="mg-warranty" data-acg-reveal="">
                  <span className="mg-warranty-icon"><Icon d={ICONS.shield} size={26} /></span>
                  <div>
                    {txt(biz.warrantyOffered) && <p className="mg-label">Parts &amp; labor</p>}
                    <p className="mg-warranty-title">Our Warranty</p>
                    {warranties.map((w) => <p key={w} className="mg-warranty-text">{w}</p>)}
                  </div>
                  <a className="mg-btn mg-btn-solid" href={show('cta') ? '#contact' : tel || '#top'}>Get a Quote</a>
                </div>
              )}
            </div>
          </section>
        )}

        {show('about') && (
          <section data-section="about" id="about" className="mg-section mg-tex-alt" aria-labelledby="mg-about-h" style={{ order: order('about') }}>
            <div className="mg-wrap mg-about">
              <div data-acg-reveal="">
                {aboutShowsStats ? (
                  <dl className="mg-statpanel">
                    {ownerStats.slice(0, 4).map((s, i) => (
                      <div key={`${s.label}-${i}`}>
                        <dt className="mg-label">{s.label}</dt>
                        <dd className="mg-stat-value">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="mg-frame">
                    <div className="mg-media">
                      <PhotoSlot src={images.about} slot="about" alt={name ? `${name} at work` : 'Our shop at work'} style={fill} fallback={<ShopSign name={name} />} />
                    </div>
                  </div>
                )}
                {aboutStatsMode && ownerStats.length === 0 && (
                  <EditorHint>Add your stats in Edit &gt; About &gt; Stats Box (the photo shows until then).</EditorHint>
                )}
              </div>
              <div data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                <p className="mg-eyebrow">Our story</p>
                <h2 id="mg-about-h" className="mg-h2" style={{ marginBottom: 28 }}>{aboutTitle}</h2>
                {aboutParas.length > 0 && (
                  <div className="mg-prose">
                    {aboutParas.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                )}
                {(aboutFacts.length > 0 || brands.length > 0) && (
                  <dl className="mg-dl">
                    {aboutFacts.map((f) => (
                      <div key={f.label} className={f.wide ? 'mg-wide' : undefined}>
                        <dt className="mg-label">{f.label}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                    {brands.length > 0 && (
                      <div className="mg-wide">
                        <dt className="mg-label">Brands we service</dt>
                        <dd className="mg-chips">
                          {brands.map((b) => <span key={b} className="mg-chip">{b}</span>)}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </div>
          </section>
        )}

        {show('gallery') && (galleryImages.length > 0 || editor) && (
          <section data-section="gallery" id="gallery" className="mg-section mg-tex" aria-labelledby="mg-gallery-h" style={{ order: order('gallery') }}>
            <div className="mg-wrap">
              <div className="mg-head mg-head-solo" data-acg-reveal="">
                <div>
                  <p className="mg-eyebrow">From the shop floor</p>
                  <h2 id="mg-gallery-h" className="mg-h2">Our Work</h2>
                </div>
              </div>
              {galleryImages.length === 0 ? (
                <PhotoSlot slot="gallery" style={{ minHeight: 220, borderRadius: 3 }} />
              ) : galleryImages.length > 4 ? (
                <>
                  <div className="mg-track" role="region" aria-label="Photo gallery, scroll sideways for more" tabIndex={0}>
                    {galleryImages.map((src, i) => (
                      <figure key={i} className="mg-shot">
                        <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      </figure>
                    ))}
                  </div>
                  <p className="mg-swipe" aria-hidden="true">Swipe or scroll for more →</p>
                </>
              ) : (
                <div className={`mg-gal mg-g${galleryImages.length}`}>
                  {galleryImages.map((src, i) => (
                    <figure key={i} className="mg-shot" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'google' && (
          <section data-section="testimonials" id="reviews" className="mg-section mg-tex" aria-label={txt(copy.googleReviewsTitle) || 'Reviews'} style={{ order: order('testimonials') }}>
            <div className="mg-wrap">
              {txt(copy.googleReviewsTitle) && (
                <div className="mg-head mg-head-solo">
                  <div>
                    <p className="mg-eyebrow">Reviews</p>
                    <h2 className="mg-h2">{copy.googleReviewsTitle}</h2>
                  </div>
                </div>
              )}
              <div className="mg-reviews-widget">
                <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
              </div>
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'quotes' && (
          <section data-section="testimonials" id="reviews" className="mg-section mg-tex" aria-labelledby="mg-reviews-h" style={{ order: order('testimonials') }}>
            <div className="mg-wrap">
              <div className="mg-head mg-head-solo" data-acg-reveal="">
                <div>
                  <p className="mg-eyebrow">Word from the lot</p>
                  <h2 id="mg-reviews-h" className="mg-h2">Straight From Our Customers</h2>
                </div>
              </div>
              <div className={`mg-grid ${testimonials.length === 1 ? 'mg-c1' : testimonials.length === 2 || testimonials.length === 4 ? 'mg-c2' : 'mg-c3'}`}>
                {testimonials.map((q, i) => (
                  <div key={i} className="mg-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <figure className="mg-quote">
                      <svg className="mg-quote-mark" width="34" height="26" viewBox="0 0 34 26" fill="currentColor" aria-hidden="true">
                        <path d="M0 26V15.6C0 6.9 4.6 1.7 13.2 0l1.5 3.4C9.8 5 7.4 8 7.1 12.2H14V26H0zm19.3 0V15.6C19.3 6.9 23.9 1.7 32.5 0L34 3.4c-4.9 1.6-7.3 4.6-7.6 8.8h6.9V26H19.3z" />
                      </svg>
                      <blockquote><p>{q.text}</p></blockquote>
                      {(txt(q.name) || txt(q.vehicle) || txt(q.role)) && (
                        <figcaption>
                          {txt(q.name)}
                          {(txt(q.vehicle) || txt(q.role)) && <span>{txt(q.vehicle) || txt(q.role)}</span>}
                        </figcaption>
                      )}
                    </figure>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {show('cta') && (
          <section data-section="cta" id="contact" className="mg-contact" aria-labelledby="mg-contact-h" style={{ order: order('cta') }}>
            <div className="mg-cta mg-band">
              <div className="mg-wrap mg-cta-grid">
                <div data-acg-reveal="">
                  <p className="mg-eyebrow">Pull in</p>
                  <h2 id="mg-contact-h" className="mg-cta-h">{txt(copy.ctaHeadline) || fb.ctaHeadline}</h2>
                  <p className="mg-cta-sub">{txt(copy.ctaSubtext) || [address, place].filter(Boolean).join(', ') || 'Tell us what your vehicle needs and we will get it sorted.'}</p>
                </div>
                <div className="mg-cta-side" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                  {contactPrimaryHref && (
                    <a className="mg-btn mg-btn-ink" href={contactPrimaryHref} {...(contactBooking ? { 'data-scheduler-trigger': '' } : {})}>
                      {contactPrimaryLabel}<Icon d={ICONS.arrow} />
                    </a>
                  )}
                  {showCall && (
                    <a className="mg-btn mg-btn-ink-line" href={callHref}><Icon d={ICONS.phone} size={16} />{callLabel}</a>
                  )}
                  {payments.length > 0 && (
                    <ul className="mg-pay" aria-label="Payment accepted">
                      {payments.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            {(contactRows.length > 0 || hasHours) && (
              <div className="mg-info mg-tex">
                <div className={`mg-wrap mg-info-grid${contactRows.length > 0 && hasHours ? '' : ' mg-info-solo'}`}>
                  {contactRows.length > 0 && (
                    <ul data-acg-reveal="">
                      {contactRows.map((r) => (
                        <li key={r.key} className="mg-row">
                          <span className="mg-icon"><Icon d={r.icon} /></span>
                          <span className="mg-row-body">
                            <span className="mg-label">{r.label}</span>
                            <span className="mg-row-value">{r.value}</span>
                            {r.extra && <span className="mg-row-value" style={{ color: t.textMuted }}>{r.extra}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {timeCard}
                </div>
              </div>
            )}
          </section>
        )}

        {show('awards') && (awards.length > 0 || certs.length > 0 || editor) && (
          <section data-section="awards" className="mg-awards mg-tex-alt" aria-label="Awards and certifications" style={{ order: order('awards') }}>
            <div className="mg-wrap">
              {awards.length > 0 || certs.length > 0 ? (
                <div className="mg-awards-in" data-acg-reveal="fade">
                  <p className="mg-eyebrow">{awards.length > 0 ? 'Recognition' : 'Certified'}</p>
                  {awards.length > 0 && (
                    <ul className="mg-award-list" data-acg-awards="">
                      {awards.map((a, i) => (
                        <li key={`${a}-${i}`} className="mg-award"><Icon d={ICONS.award} size={22} />{a}</li>
                      ))}
                    </ul>
                  )}
                  {certs.length > 0 && (
                    <ul className="mg-award-list">
                      {certs.map((c, i) => (
                        <li key={`${c}-${i}`} className="mg-award"><Icon d={ICONS.check} size={20} />{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <EditorHint>Awards show here once you add them in Edit &gt; Business Info &gt; Awards.</EditorHint>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="mg-foot" style={{ order: 9999 }}>
        <div className="mg-wrap">
          <div className="mg-foot-grid">
            <div className="mg-foot-brand">
              <a className="mg-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
                {brand({ height: 46, width: 'auto', maxWidth: 190 })}
              </a>
              {txt(copy.footerTagline) && <p className="mg-foot-tag">{copy.footerTagline}</p>}
              <div className="mg-social">
                <SocialRow biz={biz} color={vars['--mg-footer-accent']} size={18} gap={10} images={images} />
              </div>
            </div>
            {navLinks.length > 0 && (
              <div>
                <p className="mg-foot-h">Explore</p>
                <ul className="mg-foot-list">
                  {navLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
            )}
            <div>
              <p className="mg-foot-h">Visit</p>
              <ul className="mg-foot-list">
                {tel && <li><a href={tel}>{phone}</a></li>}
                {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                {address && <li>{address}</li>}
                {place && <li>{place}</li>}
                {/* Hours live on the contact section's time card; say them
                    here only when that section is hidden. */}
                {!show('cta') && (hours.line
                  ? <li>{hours.line}</li>
                  : hours.runs.map((r) => <li key={r.days}>{r.days} {r.time}</li>))}
              </ul>
            </div>
          </div>
          <div className="mg-foot-bottom">
            <p>© <span data-acg-year="">{new Date().getFullYear()}</span> {name}. All rights reserved.</p>
            {place && <p>{place}</p>}
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref="#contact" colors={{ bg: t.bg, text: t.text, accent: t.accent, onAccent: vars['--mg-on-accent'] }} font={body} />
    </div>
  );
}
