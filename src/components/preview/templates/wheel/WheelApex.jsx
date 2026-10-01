// Forge Studio (wheel_apex): alloy & bronze, editorial e-commerce.
// Theme-ready port of the apexwheel.html mockup (repo root) on the shared
// kit; mobile/MobileChrome.jsx is the reference. What keeps it honest and
// static-export safe:
//   - every color is a deriveTheme() token exposed as a --wa-* variable. The
//     default palette (alloy #F0F1F3, bronze #A8813A, ink #1C1E24) gives the
//     mockup's look; an owner palette repaints all of it, including the
//     rendered alloy rim that stands in for missing photos;
//   - one prefixed <style>: @container layout, hover inside (hover:hover),
//     motion inside prefers-reduced-motion; no hooks, no window; the nav is
//     opaque and only gains a shadow from html[data-acg-scrolled];
//   - facts render only when the owner entered them: no stock stats, star
//     ratings, finance offers, guarantees or brand names (the old template
//     invented "2,400+ SKUs", "4.9", "0% for 12 months" and ENKEI/VOSSEN).
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import IconOrEmoji from '../IconOrEmoji.jsx';
import { ServiceCardCss, ServiceDescription, BookNowLink } from '../ServiceCardParts.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS } from '../../../../lib/businessHours.js';
import { FONT_CATALOG, catalogFamily, familiesFromStack } from '../../../../lib/fontCatalog.js';
import { TEMPLATES } from '../../../../data/templates.js';
import { deriveTheme, mix, alpha, ensureContrast, readableOn, hexToRgb, rgbToHex, luminance } from '../kit/theme.js';
import { PhotoSlot, PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';

export const themeReady = true;

// Same ids and order as ContentEditor's TOGGLEABLE.wheel_apex, so the
// editor's Sections list matches what renders (the old template rendered
// ticker before trustBar and about before brands, so the first drag in the
// editor moved sections the owner never touched). Never rename an id.
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'trustBar', label: 'Trust Bar' },
  { id: 'ticker', label: 'Scrolling Ticker' },
  { id: 'products', label: 'Products' },
  { id: 'brands', label: 'Brands' },
  { id: 'about', label: 'About' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'cta', label: 'Contact / CTA' },
];

export const extraFonts = [];

const CSS = `
.wa-wrap{width:100%;max-width:1200px;margin:0 auto;padding-left:var(--wa-gutter);padding-right:var(--wa-gutter)}
.wa-root :where(h1,h2,h3,p,ul,ol,dl,dd,figure,blockquote){margin:0}
.wa-root :where(ul,ol){list-style:none;padding:0}
.wa-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.wa-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 18px;background:var(--wa-ink);color:var(--wa-on-ink);font-weight:600;text-decoration:none}
.wa-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.wa-root a:focus-visible,.wa-root summary:focus-visible,.wa-root label:focus-visible,.wa-track:focus-visible{outline:2px solid var(--wa-focus);outline-offset:3px}
.wa-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin-top:20px;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-size:13px;font-weight:500;line-height:1.45;color:inherit;opacity:.85;letter-spacing:0;text-transform:none}

.wa-display{font-family:var(--wa-head);font-weight:var(--wa-h-weight);line-height:var(--wa-h-lh);letter-spacing:var(--wa-h-ls);text-transform:var(--wa-h-case)}
.wa-eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:11.5px;font-weight:600;line-height:1.4;letter-spacing:.24em;text-transform:uppercase;color:var(--wa-accent-text)}
.wa-eyebrow::before{content:'\\25C6';font-size:9px;letter-spacing:0}
.wa-h2{margin-top:14px;font-size:calc(clamp(40px,5.2cqi,60px) * var(--wa-h-scale));color:var(--wa-text);text-wrap:balance}
.wa-h2-xl{font-size:calc(clamp(44px,6.2cqi,76px) * var(--wa-h-scale))}
.wa-h2-long{font-size:calc(clamp(34px,3.8cqi,48px) * var(--wa-h-scale))}
.wa-lead{font-size:clamp(16px,1.45cqi,18px);font-weight:var(--wa-body-light);line-height:1.75;color:var(--wa-muted);text-wrap:pretty;white-space:pre-line}
.wa-label{display:block;font-size:11px;font-weight:600;line-height:1.4;letter-spacing:.2em;text-transform:uppercase;color:var(--wa-muted)}

.wa-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:50px;padding:0 30px;border:1px solid var(--wa-ink);background:var(--wa-ink);color:var(--wa-on-ink);font-family:var(--wa-body);font-size:12px;font-weight:600;line-height:1.2;letter-spacing:.16em;text-transform:uppercase;text-align:center;text-decoration:none;cursor:pointer}
.wa-btn:active{transform:translateY(1px)}
.wa-btn-sm{min-height:42px;padding:0 20px;font-size:11px}
.wa-btn-line{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 0 2px;border-bottom:1px solid var(--wa-alloy);color:var(--wa-ink2);font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;text-decoration:none}
.wa-btn-line svg{flex:none}

.wa-nav{position:sticky;top:0;z-index:100;background:var(--wa-surface);border-bottom:1px solid var(--wa-border)}
html[data-acg-scrolled] .wa-nav{box-shadow:0 12px 32px -20px var(--wa-shadow)}
.wa-nav-in{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:72px}
.wa-brand{flex:1 1 auto;display:inline-flex;align-items:center;min-width:0;color:var(--wa-text);text-decoration:none}
.wa-word{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--wa-head);font-size:calc(28px * var(--wa-word-scale));font-weight:var(--wa-h-weight);line-height:1.1;letter-spacing:.1em;text-transform:uppercase}
.wa-word span{color:var(--wa-accent-lg)}
.wa-nav .wa-word{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;overflow-wrap:break-word}
.wa-nav .wa-word-long{font-size:calc(24px * var(--wa-word-scale));line-height:1.15}
.wa-links{flex:none;display:flex;align-items:center;gap:clamp(18px,2.4cqi,32px)}
.wa-link{position:relative;padding:12px 0;color:var(--wa-ink2);font-size:12px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;text-decoration:none}
.wa-link::after{content:'';position:absolute;left:0;right:0;bottom:6px;height:1px;background:var(--wa-accent-text);transform:scaleX(0);transform-origin:left center}
.wa-nav-cta{margin-left:clamp(4px,1cqi,12px)}

.wa-hero{position:relative;background:var(--wa-surface);color:var(--wa-text);border-bottom:1px solid var(--wa-border)}
.wa-hero-split{display:grid;grid-template-columns:minmax(0,1.04fr) minmax(0,1fr);min-height:clamp(560px,calc(100vh - 72px),860px)}
.wa-hero-text{display:flex;flex-direction:column;justify-content:center;padding:clamp(64px,8cqi,112px) clamp(28px,4.6cqi,72px) clamp(64px,8cqi,112px) max(var(--wa-gutter),calc((100cqi - 1200px) / 2 + var(--wa-gutter)))}
.wa-h1{margin-top:22px;font-size:calc(clamp(52px,7.2cqi,108px) * var(--wa-h-scale));color:var(--wa-text);text-wrap:balance}
.wa-h1-long{font-size:calc(clamp(44px,5.6cqi,84px) * var(--wa-h-scale))}
.wa-tone{display:block;color:var(--wa-alloy)}
.wa-hero .wa-lead{margin-top:26px;max-width:470px}
.wa-actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px 30px;margin-top:40px}
.wa-stage{position:relative;display:flex;flex-direction:column;min-width:0;background:var(--wa-bg);border-left:1px solid var(--wa-border)}
.wa-stage-media{position:relative;flex:1;min-height:420px;overflow:hidden}
.wa-stats{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);background:var(--wa-surface);border-top:1px solid var(--wa-border)}
.wa-stat{display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:18px clamp(16px,2cqi,26px);border-left:1px solid var(--wa-border)}
.wa-stat:first-child{border-left:0}
.wa-stat dd{font-family:var(--wa-head);font-size:calc(34px * var(--wa-h-scale-sm));font-weight:var(--wa-h-weight);line-height:1;letter-spacing:.01em;color:var(--wa-accent-lg)}
.wa-stat dt{margin-top:8px;font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--wa-muted)}
.wa-hero-photo{isolation:isolate;display:flex;flex-direction:column;justify-content:flex-end;min-height:clamp(560px,calc(100vh - 72px),900px);overflow:clip;background:var(--wa-ink);color:var(--wa-on-hero);border-bottom:0}
.wa-hero-bg{position:absolute;inset:0;z-index:-2}
.wa-hero-scrim{position:absolute;inset:0;z-index:-1;background:var(--wa-scrim-left)}
.wa-hero-body{padding-top:clamp(96px,12cqi,160px);padding-bottom:clamp(56px,7cqi,96px)}
.wa-hero-body>div{max-width:720px}
.wa-hero-photo .wa-h1,.wa-hero-photo .wa-eyebrow{color:var(--wa-on-hero)}
.wa-hero-photo .wa-tone,.wa-hero-photo .wa-lead{color:var(--wa-on-hero-muted)}
.wa-hero-photo .wa-h1,.wa-hero-photo .wa-lead{text-shadow:0 1px 24px rgba(0,0,0,.3)}
.wa-hero-photo .wa-btn{background:var(--wa-accent);border-color:var(--wa-accent);color:var(--wa-on-accent)}
.wa-hero-photo .wa-btn-line{color:var(--wa-on-hero);border-bottom-color:var(--wa-on-hero-line)}
.wa-hero-photo .wa-stats{background:rgba(0,0,0,.34);border-top:1px solid var(--wa-on-hero-line)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){.wa-hero-photo .wa-stats{-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}}
.wa-hero-photo .wa-stat{border-left-color:var(--wa-on-hero-line)}
.wa-hero-photo .wa-stat dd{color:var(--wa-on-hero)}
.wa-hero-photo .wa-stat dt{color:var(--wa-on-hero-muted)}

.wa-rimstage{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(58% 58% at 50% 46%,var(--wa-stage-glow),transparent 72%),var(--wa-bg)}
.wa-rimstage::before{content:'';position:absolute;top:50%;left:50%;width:min(94%,600px);aspect-ratio:1;border:1px dashed var(--wa-border-strong);border-radius:50%;translate:-50% -50%}
.wa-rimstage::after{content:'';position:absolute;inset:0;background:linear-gradient(var(--wa-border),var(--wa-border)) center / 100% 1px no-repeat,linear-gradient(var(--wa-border),var(--wa-border)) center / 1px 100% no-repeat}
.wa-rim{position:relative;z-index:1;width:min(74%,470px);height:auto;filter:drop-shadow(0 30px 34px var(--wa-rim-shadow))}
.wa-rimstage-sm .wa-rim{width:min(62%,220px);filter:drop-shadow(0 16px 18px var(--wa-rim-shadow))}
.wa-rimstage-sm::before{width:min(80%,280px)}
.wa-rim-tire{fill:var(--wa-tire)}
.wa-rim-wall{fill:none;stroke:var(--wa-tire-line);stroke-width:1.2}
.wa-rim-barrel{fill:var(--wa-barrel)}
.wa-rim-ring{fill:none;stroke:rgba(0,0,0,.2);stroke-width:1}
.wa-rim-lug{fill:var(--wa-tire)}
.wa-rim-cap{fill:var(--wa-accent)}
.wa-rim-sheen{fill:none;stroke:rgba(255,255,255,.55);stroke-width:2.4;stroke-linecap:round}

.wa-trust{background:var(--wa-surface);border-bottom:1px solid var(--wa-border)}
.wa-trust-grid{display:flex;flex-wrap:wrap;gap:1px;background:var(--wa-border)}
.wa-trust-item{flex:1 1 230px;display:flex;align-items:center;gap:14px;min-width:0;padding:22px clamp(16px,2cqi,26px);background:var(--wa-surface)}
.wa-ticon{flex:none;display:grid;place-items:center;width:40px;height:40px;background:var(--wa-soft-bg);border:1px solid var(--wa-soft-line);color:var(--wa-soft-accent);line-height:1}
.wa-tlabel{display:block;font-size:14px;font-weight:500;line-height:1.4;color:var(--wa-text);white-space:pre-line;overflow-wrap:anywhere}
.wa-tsub{display:block;margin-top:2px;font-size:12px;line-height:1.45;color:var(--wa-muted)}

.wa-ticker{overflow:hidden;background:var(--wa-ticker-bg);color:var(--wa-ticker-text)}
.wa-tick-track{display:flex;flex-wrap:wrap;justify-content:center;padding:15px var(--wa-gutter)}
.wa-tick-group{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 0}
.wa-tick-dup,.wa-tick-rep{display:none}
.wa-tick-item{display:inline-flex;align-items:center;font-size:12px;font-weight:500;line-height:1.5;letter-spacing:.2em;text-transform:uppercase;white-space:nowrap}
.wa-tick-item::after{content:'\\25C6';margin:0 26px;font-size:9px;color:var(--wa-ticker-dot)}
.wa-tick-last::after{display:none}

.wa-sec{position:relative;padding:clamp(76px,9cqi,124px) 0;border-top:1px solid var(--wa-border);scroll-margin-top:72px}
.wa-sec-bg{background:var(--wa-bg)}
.wa-sec-surface{background:var(--wa-surface)}
.wa-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:end;gap:20px clamp(32px,6cqi,96px);margin-bottom:clamp(40px,4.8cqi,64px)}
.wa-head-solo{grid-template-columns:minmax(0,1fr)}
.wa-intro{max-width:540px;font-size:16.5px;font-weight:var(--wa-body-light);line-height:1.75;color:var(--wa-muted);text-wrap:pretty}
.wa-subhead{display:flex;align-items:center;gap:18px;margin:clamp(48px,6cqi,72px) 0 26px}
.wa-subhead::after{content:'';flex:1;height:1px;background:var(--wa-border)}
.wa-grid{display:grid;gap:clamp(14px,1.6cqi,20px)}
.wa-c1{grid-template-columns:minmax(0,620px)}
.wa-c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.wa-c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.wa-cell{display:flex;min-width:0}
.wa-card{flex:1;position:relative;display:flex;flex-direction:column;min-width:0;background:var(--wa-surface);border:1px solid var(--wa-border);overflow:hidden}
.wa-card::before{content:'';position:absolute;z-index:2;top:0;left:0;right:0;height:2px;background:var(--wa-accent);transform:scaleX(0);transform-origin:left center}
.wa-card-media{position:relative;aspect-ratio:4/3;background:var(--wa-bg);border-bottom:1px solid var(--wa-border);overflow:hidden}
.wa-card-media>img{transform-origin:center}
.wa-badge{position:absolute;z-index:1;top:14px;left:14px;padding:5px 10px;background:var(--wa-soft-bg);color:var(--wa-soft-accent);font-size:10.5px;font-weight:600;line-height:1.4;letter-spacing:.16em;text-transform:uppercase}
.wa-badge-inline{position:static;align-self:flex-start;margin-bottom:14px}
.wa-card-body{flex:1;display:flex;flex-direction:column;padding:clamp(22px,2.4cqi,30px)}
.wa-idx{display:block;font-size:12px;font-weight:600;line-height:1.4;letter-spacing:.2em;color:var(--wa-accent-text)}
.wa-card-title{font-size:calc(clamp(26px,2.4cqi,30px) * var(--wa-h-scale-sm));color:var(--wa-text);overflow-wrap:break-word}
.wa-svc .wa-card-title{margin-top:18px}
.wa-price{font-family:var(--wa-head);font-size:calc(clamp(26px,2.4cqi,32px) * var(--wa-h-scale-sm));font-weight:var(--wa-h-weight);line-height:1.05;letter-spacing:.01em;color:var(--wa-accent-lg);overflow-wrap:break-word}
.wa-price-long{font-size:calc(clamp(20px,1.8cqi,23px) * var(--wa-h-scale-sm));line-height:1.2;color:var(--wa-accent-text)}
.wa-card .acg-svc-foot{padding-top:24px}
.wa-card .acg-svc-more{min-height:32px;padding-top:6px;letter-spacing:.04em}
.wa-foot-row{padding-top:14px;border-top:1px solid var(--wa-border)}
.wa-price-foot{margin-bottom:16px}
.wa-card .acg-svc-book,.wa-more{display:inline-flex;align-items:center;gap:14px;min-height:44px;color:var(--wa-text);font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;text-decoration:none}
.wa-arrow{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--wa-border-strong);background:var(--wa-bg);color:var(--wa-ink2)}
.wa-card-foot{margin-top:auto;padding-top:22px}

.wa-brands-head{display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:clamp(28px,3.4cqi,40px);text-align:center}
.wa-brands-title{font-size:calc(clamp(30px,3.4cqi,40px) * var(--wa-h-scale));color:var(--wa-text)}
.wa-brand-group+.wa-brand-group{margin-top:28px}
.wa-brand-group>.wa-label{margin-bottom:12px}
.wa-brand-grid{display:flex;flex-wrap:wrap;gap:1px;background:var(--wa-border);border:1px solid var(--wa-border)}
.wa-brand-cell{flex:1 1 170px;display:grid;place-items:center;min-height:96px;padding:18px 16px;background:var(--wa-cell-bg);font-family:var(--wa-head);font-size:calc(22px * var(--wa-h-scale-sm));font-weight:var(--wa-h-weight);line-height:1.15;letter-spacing:.12em;text-transform:uppercase;text-align:center;color:var(--wa-muted);overflow-wrap:anywhere}
.wa-sec-bg .wa-brand-cell{--wa-cell-bg:var(--wa-bg)}
.wa-sec-surface .wa-brand-cell{--wa-cell-bg:var(--wa-surface)}

.wa-about{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:center;gap:clamp(40px,7cqi,104px)}
.wa-frame{position:relative;padding:0 22px 22px 0}
.wa-frame::before{content:'';position:absolute;top:22px;left:22px;right:0;bottom:0;background:var(--wa-soft-bg);border:1px solid var(--wa-soft-line)}
.wa-media{position:relative;aspect-ratio:4/5;overflow:hidden;background:var(--wa-surface);border:1px solid var(--wa-border)}
.wa-prose{margin-top:26px}
.wa-prose p{font-size:16.5px;font-weight:var(--wa-body-light);line-height:1.8;color:var(--wa-muted);white-space:pre-line;text-wrap:pretty}
.wa-prose p+p{margin-top:18px}
.wa-prose p:first-child{font-size:clamp(18px,1.6cqi,20px);font-weight:400;line-height:1.65;color:var(--wa-text)}
.wa-dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:20px 32px;margin-top:34px;padding-top:26px;border-top:1px solid var(--wa-border)}
.wa-dl dd{margin-top:6px;font-size:16px;line-height:1.5;color:var(--wa-text)}
.wa-awards{margin-top:28px;padding:18px 20px;background:var(--wa-soft-bg);border:1px solid var(--wa-soft-line)}
.wa-awards .wa-label{color:var(--wa-soft-accent)}
.wa-award{display:flex;align-items:flex-start;gap:10px;margin-top:10px;font-size:15px;line-height:1.5;color:var(--wa-soft-text)}
.wa-award svg{flex:none;margin-top:2px;color:var(--wa-soft-accent)}
.wa-pay{margin-top:26px}
.wa-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.wa-chip{padding:5px 12px;border:1px solid var(--wa-border-strong);background:var(--wa-surface);font-size:12.5px;line-height:1.5;letter-spacing:.02em;color:var(--wa-ink2)}
.wa-statpanel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--wa-border);border:1px solid var(--wa-border)}
.wa-statpanel>div{display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:clamp(26px,3.2cqi,42px);background:var(--wa-surface)}
.wa-statpanel>div:last-child:nth-child(odd){grid-column:1 / -1}
.wa-statpanel dd{font-family:var(--wa-head);font-size:calc(clamp(44px,5cqi,64px) * var(--wa-h-scale));font-weight:var(--wa-h-weight);line-height:1;color:var(--wa-accent-lg)}
.wa-statpanel dt{margin-top:12px}
.wa-mono{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(70% 60% at 30% 25%,var(--wa-stage-glow),transparent 70%),var(--wa-bg)}
.wa-mono::before,.wa-mono::after{content:'';position:absolute;top:50%;left:50%;aspect-ratio:1;border-radius:50%;translate:-50% -50%}
.wa-mono::before{width:76%;border:1px solid var(--wa-border-strong)}
.wa-mono::after{width:58%;border:1px dashed var(--wa-soft-line)}
.wa-mono-letter{position:relative;font-family:var(--wa-head);font-size:calc(clamp(110px,15cqi,200px) * var(--wa-h-scale));font-weight:var(--wa-h-weight);line-height:1;color:var(--wa-alloy)}

.wa-gal{display:grid;gap:clamp(10px,1.2cqi,16px)}
.wa-g1{grid-template-columns:minmax(0,1fr)}
.wa-g1 .wa-shot{aspect-ratio:21/9}
.wa-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.wa-g2 .wa-shot{aspect-ratio:4/3}
.wa-g3{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));height:clamp(420px,52cqi,640px)}
.wa-g3 .wa-shot:first-child{grid-row:1 / span 2}
.wa-shot{position:relative;min-height:0;overflow:hidden;background:var(--wa-surface);border:1px solid var(--wa-border)}
.wa-track{--wa-bleed:calc(var(--wa-gutter) + max(0px, (100cqi - 1200px) / 2));display:flex;gap:clamp(12px,1.4cqi,18px);overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc(-1 * var(--wa-bleed));padding:0 var(--wa-bleed) 4px;scroll-padding:0 var(--wa-bleed)}
.wa-track::-webkit-scrollbar{display:none}
.wa-track .wa-shot{flex:0 0 auto;width:clamp(240px,30cqi,380px);aspect-ratio:4/5;scroll-snap-align:start}
.wa-swipe{margin-top:20px;font-size:12px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--wa-muted)}

.wa-quote{flex:1;display:flex;flex-direction:column;padding:clamp(28px,3cqi,40px);background:var(--wa-quote-bg);border:1px solid var(--wa-border)}
.wa-sec-bg .wa-quote{--wa-quote-bg:var(--wa-surface)}
.wa-sec-surface .wa-quote{--wa-quote-bg:var(--wa-bg)}
.wa-quote-mark{display:block;color:var(--wa-accent-text)}
.wa-quote blockquote{flex:1;margin-top:22px}
.wa-quote blockquote p{font-size:16.5px;line-height:1.75;color:var(--wa-text);text-wrap:pretty}
.wa-quote figcaption{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:26px;padding-top:18px;border-top:1px solid var(--wa-border);font-size:12.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--wa-text)}
.wa-quote figcaption span{font-weight:500;letter-spacing:.04em;text-transform:none;color:var(--wa-muted)}

.wa-contact{background:var(--wa-soft-bg);border-top-color:var(--wa-soft-line);border-bottom:1px solid var(--wa-soft-line)}
.wa-contact .wa-eyebrow{color:var(--wa-soft-accent)}
.wa-contact .wa-h2{color:var(--wa-soft-text)}
.wa-contact .wa-lead{margin-top:22px;max-width:540px;color:var(--wa-soft-muted)}
.wa-contact .wa-btn-line{color:var(--wa-soft-text);border-bottom-color:var(--wa-soft-muted)}
.wa-contact-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:clamp(40px,6cqi,96px);align-items:center}
.wa-contact-solo{grid-template-columns:minmax(0,1fr)}
.wa-panel{background:var(--wa-surface);border:1px solid var(--wa-border);padding:clamp(24px,3cqi,40px)}
.wa-row{display:flex;gap:18px;padding:18px 0;border-top:1px solid var(--wa-border)}
.wa-row:first-child{padding-top:0;border-top:0}
.wa-row:last-child{padding-bottom:0}
.wa-icon{flex:none;display:grid;place-items:center;width:40px;height:40px;background:var(--wa-soft-bg);border:1px solid var(--wa-soft-line);color:var(--wa-soft-accent)}
.wa-row-body{flex:1;min-width:0}
.wa-row-value{display:block;margin-top:5px;font-size:16px;line-height:1.55;color:var(--wa-text);overflow-wrap:anywhere}
.wa-row-value a{color:inherit;text-decoration:none;border-bottom:1px solid var(--wa-border-strong)}
.wa-hours{display:grid;grid-template-columns:auto 1fr;gap:4px 20px;margin-top:6px;font-size:15px;line-height:1.55}
.wa-hours dt{color:var(--wa-text);font-weight:500}
.wa-hours dd{color:var(--wa-muted)}

.wa-foot{padding:clamp(64px,8cqi,100px) 0 36px;background:var(--wa-footer-bg);color:var(--wa-footer-muted);font-size:15px;line-height:1.6}
.wa-foot-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);gap:40px clamp(32px,5cqi,80px)}
.wa-foot .wa-brand{color:var(--wa-footer-text)}
.wa-foot .wa-word{white-space:normal;overflow:visible}
.wa-foot .wa-word span{color:var(--wa-footer-accent)}
.wa-foot-logo{display:inline-flex;padding:10px 14px;background:var(--wa-surface)}
.wa-foot-tag{margin-top:16px;max-width:360px}
.wa-foot-h{font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--wa-footer-text)}
.wa-foot-list{display:grid;gap:10px;margin-top:18px}
.wa-foot a{color:var(--wa-footer-muted);text-decoration:none}
.wa-social{margin-top:24px}
.wa-social a{width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--wa-footer-line)}
.wa-foot-bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;margin-top:clamp(48px,6cqi,72px);padding-top:24px;border-top:1px solid var(--wa-footer-line);font-size:13px}

@media (hover:hover){
.wa-link:hover{color:var(--wa-text)}
.wa-link:hover::after{transform:scaleX(1)}
.wa-btn:hover{background:var(--wa-accent);border-color:var(--wa-accent);color:var(--wa-on-accent)}
.wa-hero-photo .wa-btn:hover{background:var(--wa-on-hero);border-color:var(--wa-on-hero);color:var(--wa-on-white)}
.wa-btn-line:hover{color:var(--wa-accent-text);border-bottom-color:var(--wa-accent-text)}
.wa-hero-photo .wa-btn-line:hover{color:var(--wa-on-hero);border-bottom-color:var(--wa-on-hero)}
.wa-contact .wa-btn-line:hover{color:var(--wa-soft-accent);border-bottom-color:var(--wa-soft-accent)}
.wa-card:hover{border-color:var(--wa-border-strong);transform:translateY(-3px);box-shadow:0 26px 50px -30px var(--wa-shadow)}
.wa-card:hover::before{transform:scaleX(1)}
.wa-card:hover .wa-card-media>img{transform:scale(1.04)}
.wa-card:hover .wa-rim{rotate:24deg}
.wa-card .acg-svc-book:hover .wa-arrow,.wa-more:hover .wa-arrow{background:var(--wa-ink);border-color:var(--wa-ink);color:var(--wa-on-ink)}
.wa-brand-cell:hover{color:var(--wa-text)}
.wa-shot:hover img{transform:scale(1.04)}
.wa-quote:hover{border-color:var(--wa-border-strong)}
.wa-row-value a:hover{color:var(--wa-accent-text);border-bottom-color:var(--wa-accent-text)}
.wa-foot a:hover{color:var(--wa-footer-text)}
.wa-social a:hover{border-color:var(--wa-footer-text)}
.wa-ticker:hover .wa-tick-track{animation-play-state:paused}
}
@media (prefers-reduced-motion:no-preference){
.wa-nav{transition:box-shadow .3s ease}
.wa-link,.wa-row-value a,.wa-foot a,.wa-brand-cell{transition:color .2s ease,border-color .2s ease}
.wa-link::after{transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.wa-btn,.wa-btn-line{transition:background-color .2s ease,border-color .2s ease,color .2s ease,transform .15s ease}
.wa-card{transition:transform .35s cubic-bezier(.2,.7,.2,1),border-color .25s ease,box-shadow .35s ease}
.wa-card::before{transition:transform .45s cubic-bezier(.2,.7,.2,1)}
.wa-card-media>img,.wa-shot img{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.wa-card .wa-rim{transition:rotate 1.2s cubic-bezier(.2,.7,.2,1)}
.wa-arrow,.wa-quote,.wa-social a{transition:background-color .2s ease,border-color .2s ease,color .2s ease}
.wa-hero .wa-rim{animation:wa-rim-in 1.6s cubic-bezier(.2,.7,.2,1) both}
@keyframes wa-rim-in{from{opacity:0;rotate:-50deg;scale:.94}to{opacity:1;rotate:0deg;scale:1}}
.wa-tick-track{flex-wrap:nowrap;justify-content:flex-start;width:max-content;padding:15px 0;animation:wa-tick var(--wa-tick-dur,40s) linear infinite}
.wa-tick-group{flex-wrap:nowrap}
.wa-tick-dup,.wa-tick-rep{display:flex}
.wa-tick-last::after{display:inline}
@keyframes wa-tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}
}

@container (max-width:1100px){.wa-link-x{display:none}}
@container (max-width:900px){
.wa-nav-cta{display:none}
.wa-c3{grid-template-columns:repeat(2,minmax(0,1fr))}
.wa-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.wa-foot-brand{grid-column:1 / -1}
}
@container (max-width:800px){
.wa-hero-split{grid-template-columns:minmax(0,1fr);min-height:0}
.wa-hero-text{padding:64px var(--wa-gutter) 56px}
.wa-stage{border-left:0;border-top:1px solid var(--wa-border)}
.wa-stage-media{flex:none;min-height:0;aspect-ratio:4/3}
.wa-head,.wa-about,.wa-contact-grid{grid-template-columns:minmax(0,1fr)}
.wa-media{aspect-ratio:4/3}
}
@container (max-width:600px){
.wa-links,.wa-nav-cta{display:none}
.wa-nav-in{min-height:64px;gap:12px}
.wa-word,.wa-nav .wa-word-long{font-size:calc(22px * var(--wa-word-scale));letter-spacing:.08em}
.wa-hero-text{padding:52px var(--wa-gutter) 48px}
.wa-h1{font-size:calc(clamp(46px,14cqi,64px) * var(--wa-h-scale))}
.wa-h1-long{font-size:calc(clamp(38px,11cqi,52px) * var(--wa-h-scale))}
.wa-hero .wa-lead{margin-top:20px}
.wa-actions{flex-direction:column;align-items:stretch;gap:12px;margin-top:32px}
.wa-actions .wa-btn-line{justify-content:center;min-height:50px;padding:0 20px;border:1px solid var(--wa-border-strong)}
.wa-hero-photo .wa-actions .wa-btn-line{border-color:var(--wa-on-hero-line)}
.wa-contact .wa-actions .wa-btn-line{border-color:var(--wa-soft-muted)}
.wa-stage-media{aspect-ratio:5/4}
.wa-hero .wa-rim{width:min(66%,300px)}
.wa-hero .wa-rimstage::before{width:min(86%,380px)}
.wa-hero-photo{min-height:clamp(540px,86vh,760px)}
.wa-hero-scrim{background:var(--wa-scrim)}
.wa-hero-body{padding-top:88px;padding-bottom:48px}
.wa-stat{padding:14px 12px}
.wa-stat dd{font-size:calc(26px * var(--wa-h-scale-sm))}
.wa-stat dt{font-size:10px;letter-spacing:.1em}
.wa-trust-item{padding:16px 4px;flex-basis:100%}
.wa-trust .wa-wrap{padding-left:var(--wa-gutter);padding-right:var(--wa-gutter)}
.wa-sec{padding:72px 0}
.wa-h2{font-size:calc(clamp(38px,11cqi,48px) * var(--wa-h-scale))}
.wa-h2-xl{font-size:calc(clamp(42px,12cqi,54px) * var(--wa-h-scale))}
.wa-c1,.wa-c2,.wa-c3{grid-template-columns:minmax(0,1fr)}
.wa-brand-cell{flex-basis:130px;min-height:76px;font-size:calc(18px * var(--wa-h-scale-sm))}
.wa-frame{padding:0 14px 14px 0}
.wa-frame::before{top:14px;left:14px}
.wa-g2,.wa-g3{grid-template-columns:minmax(0,1fr);grid-template-rows:none;height:auto}
.wa-g3 .wa-shot:first-child{grid-row:auto}
.wa-g1 .wa-shot,.wa-g2 .wa-shot,.wa-g3 .wa-shot{aspect-ratio:4/3}
.wa-track .wa-shot{width:78%}
.wa-foot{padding-top:56px}
.wa-foot-grid{grid-template-columns:minmax(0,1fr)}
}
`;

const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);
const nameOf = (v) => txt(v && typeof v === 'object' ? v.name : v);

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// Button URLs owners type into the editor. A live Forge site saved a bare
// phone number ("262-646-0587") as a button URL, which the old template
// output as a broken relative link: bare numbers become tel:, bare domains
// get https://, bare emails mailto:. Anchors and full URLs pass through;
// script URLs never do.
function linkHref(value) {
  const s = txt(value);
  if (!s || /^(javascript|data|vbscript):/i.test(s)) return null;
  if (/^(https?:|mailto:|tel:|sms:|#|\/)/i.test(s)) return s;
  if (/^\+?[\d\s().-]+$/.test(s) && s.replace(/\D/g, '').length >= 7) return `tel:${s.replace(/[^\d+]/g, '')}`;
  if (/^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(s)) return `mailto:${s}`;
  if (/^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(s)) return `https://${s}`;
  return s;
}

// Owners may type the editor's section ids as anchors; they map to the
// element ids this template renders.
const ANCHOR_ALIAS = { '#hero': '#top', '#products': '#services', '#testimonials': '#reviews', '#cta': '#contact' };

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

// A trust-bar "Hours" fact must be the whole truth in a few words: all
// open rows (one per line) when there are at most two, or a short
// free-text line.
function hoursFact(rows) {
  if (rows.length === 1 && !rows[0].time) return rows[0].days.length <= 40 ? rows[0].days : null;
  const open = rows.filter((r) => r.time && !/^closed$/i.test(r.time));
  return open.length > 0 && open.length <= 2 ? open.map((r) => `${r.days} ${r.time}`).join('\n') : null;
}

// Two-tone headline (ink lead, alloy tail), as the mockup's "FORGE / YOUR
// RIDE". Breaks after a sentence mark, colon or dash nearest the middle
// ("Custom Wheels. / Perfect Fitment."), else a comma, else at the middle
// word as the old template did. Abbreviations ("St. Cloud") never break.
const ABBR_RE = /^(?:st|dr|mt|ft|mr|mrs|ms|jr|sr|co|inc|ave|blvd|no)\.$/i;
function splitHeadline(text) {
  const words = txt(text).replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (words.length < 3) return [words.join(' '), ''];
  const mid = words.length / 2;
  let best = null;
  words.forEach((w, i) => {
    const at = i + 1;
    if (at >= words.length) return;
    let penalty = null;
    if ((/[.!?:;]$/.test(w) && !ABBR_RE.test(w)) || /^[—–-]$/.test(words[at]) || /[—–]$/.test(w)) penalty = 0;
    else if (/,$/.test(w)) penalty = 0.75;
    if (penalty === null) return;
    const score = Math.abs(at - mid) + penalty;
    if (!best || score < best.score) best = { at, score };
  });
  let at = best ? best.at : Math.ceil(mid);
  // A lone dash starts the tail: keep it with the lead instead.
  if (/^[—–-]$/.test(words[at]) && at + 1 < words.length) at += 1;
  return [words.slice(0, at).join(' '), words.slice(at).join(' ')];
}

// Heading-font profile. The mockup's Bebas Neue is a condensed caps face;
// another heading font (Syne on a live custom-domain site) gets a size,
// weight and case that suit it, from the weights the page actually loads.
const CONDENSED = {
  'Bebas Neue': { scale: 1, weight: 400, lh: 0.92, ls: '.012em' },
  Anton: { scale: 0.86, weight: 400, lh: 0.98, ls: '.01em' },
  Oswald: { scale: 0.8, weight: 600, lh: 1.02, ls: '0em' },
  'Barlow Condensed': { scale: 0.9, weight: 700, lh: 0.96, ls: '.01em' },
  Teko: { scale: 1, weight: 600, lh: 0.9, ls: '.01em' },
  'Big Shoulders Display': { scale: 0.92, weight: 800, lh: 0.95, ls: '.01em' },
};
function headProfile(stack) {
  const family = catalogFamily(familiesFromStack(stack)[0] || '');
  if (family && CONDENSED[family]) return { upper: true, word: 1, sm: 1, ...CONDENSED[family] };
  const entry = family ? FONT_CATALOG[family] : null;
  const ws = entry ? entry.weights : [700];
  const weight = ws.length === 0 ? 400 : ws.includes(700) ? 700 : Math.max(...ws);
  const upper = !entry || entry.category === 'sans' || entry.category === 'mono';
  return upper
    ? { upper, scale: 0.62, sm: 0.78, word: 0.72, weight, lh: 1.04, ls: '-.01em' }
    : { upper, scale: 0.74, sm: 0.86, word: 0.82, weight, lh: 1.06, ls: '-.015em' };
}

// The mockup sets body copy in DM Sans Light; other body fonts only get a
// light weight when the published page loads one.
function bodyLightWeight(stack) {
  const family = catalogFamily(familiesFromStack(stack)[0] || '');
  return family && FONT_CATALOG[family].weights.includes(300) ? 300 : 400;
}

// A role saved identical to the page background carries no information
// (text or accent the color of the page is invisible, so it was never a
// real choice): the live custom-domain Forge site saved all five roles as
// white while this template still ignored colors. Such a role falls back
// to the template's own default; every other owner pick is honored.
function ownerPalette(colors) {
  const src = colors && typeof colors === 'object' ? colors : {};
  const base = TEMPLATES.wheel_apex?.colors || {};
  const norm = (c) => {
    const rgb = hexToRgb(c);
    return rgb ? rgbToHex(rgb) : null;
  };
  const bg = norm(src.bg);
  if (!bg) return src;
  const out = { ...src };
  for (const role of ['text', 'muted', 'accent']) {
    if (norm(src[role]) === bg && base[role]) out[role] = base[role];
  }
  return out;
}

const onBoth = (fg, a, b, min) => ensureContrast(ensureContrast(fg, a, min), b, min);

// Everything the alloy & bronze look needs, derived from the owner's
// palette. Default: ink buttons and ticker, white cards on an alloy-gray
// page, a bronze-tinted contact band; a dark palette gets a deeper band
// and a light metal rim.
//
// The soft tint (contact band, awards box, icon tiles) mixes the accent
// into a light surface only. On a dark surface an RGB mix with the accent
// turns muddy (amber into navy gives warm gray, red into green gives
// brown), so a dark palette lifts the surface in its own hue and keeps the
// accent to the lines and icons.
function forgeTokens(t) {
  const band = t.isDark ? mix(t.bg, '#000000', 0.45) : t.text;
  const bandFg = readableOn(band);
  const soft = t.isDark ? mix(t.surface, t.text, 0.07) : mix(t.accent, t.surface, 0.9);
  const [lite, deep] = luminance(t.surface) >= luminance(t.text) ? [t.surface, t.text] : [t.text, t.surface];
  const alloyLo = mix(lite, deep, 0.5);
  const tire = t.isDark ? mix(t.bg, '#000000', 0.55) : mix(t.text, '#000000', 0.2);
  return {
    '--wa-ink': t.text,
    '--wa-on-ink': readableOn(t.text),
    '--wa-on-white': readableOn('#ffffff'),
    '--wa-ink2': onBoth(mix(t.text, t.textMuted, 0.42), t.surface, t.bg, 4.5),
    // Large display text only (3:1 is AA for text this size).
    '--wa-alloy': onBoth(mix(t.text, t.surface, 0.5), t.surface, t.bg, 3),
    '--wa-accent-lg': onBoth(t.accent, t.surface, t.bg, 3),
    '--wa-alloy-hi': mix(lite, deep, 0.05),
    '--wa-alloy-mid': mix(lite, deep, 0.24),
    '--wa-alloy-lo': alloyLo,
    '--wa-tire': tire,
    '--wa-tire-line': alpha(readableOn(tire), 0.1),
    '--wa-barrel': mix(tire, alloyLo, 0.28),
    '--wa-rim-shadow': alpha('#000000', t.isDark ? 0.5 : 0.22),
    '--wa-stage-glow': alpha(t.surface, t.isDark ? 0.35 : 0.95),
    '--wa-soft-bg': soft,
    '--wa-soft-line': t.isDark ? alpha(t.accent, 0.45) : mix(t.accent, t.surface, 0.7),
    '--wa-soft-text': ensureContrast(t.text, soft, 4.5),
    '--wa-soft-muted': ensureContrast(t.textMuted, soft, 4.5),
    '--wa-soft-accent': ensureContrast(t.accentText, soft, 4.5),
    '--wa-ticker-bg': band,
    '--wa-ticker-text': ensureContrast(mix(bandFg, band, 0.24), band, 4.5),
    '--wa-ticker-dot': ensureContrast(t.accent, band, 3),
    '--wa-footer-bg': band,
    '--wa-footer-text': ensureContrast(mix(bandFg, band, 0.06), band, 4.5),
    '--wa-footer-muted': ensureContrast(mix(bandFg, band, 0.4), band, 4.5),
    '--wa-footer-accent': ensureContrast(t.accent, band, 3),
    '--wa-footer-line': alpha(bandFg, 0.14),
    '--wa-shadow': alpha('#000000', t.isDark ? 0.6 : 0.2),
    '--wa-on-hero-muted': alpha(t.onHero, 0.86),
    '--wa-on-hero-line': alpha(t.onHero, 0.42),
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
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6.5 12 13l8.5-6.5',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.8 7 21l5-2.5 5 2.5-1.5-7.2',
  calendar: 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4',
  rim: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 9V3.5M14.9 11.1l5.2-1.9M13.8 14.4l3.4 4.4M10.2 14.4l-3.4 4.4M9.1 11.1 3.9 9.2',
};

// The signature graphic: a five-twin-spoke alloy rim drawn in the owner's
// palette (alloy lip, dark tire, accent center cap). It stands in for a
// missing hero or product photo, so a published page never shows an empty
// "Image" box. `id` keeps the gradient ids unique on the page.
const SPOKES = [0, 72, 144, 216, 288];
const LUGS = [36, 108, 180, 252, 324].map((a) => {
  const r = (a * Math.PI) / 180;
  return [Math.round(15 * Math.sin(r) * 100) / 100, Math.round(-15 * Math.cos(r) * 100) / 100];
});
function Rim({ id }) {
  return (
    <svg className="wa-rim" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-lip`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--wa-alloy-hi)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--wa-alloy-mid)' }} />
          <stop offset="1" style={{ stopColor: 'var(--wa-alloy-lo)' }} />
        </linearGradient>
        <linearGradient id={`${id}-spoke`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--wa-alloy-mid)' }} />
          <stop offset="1" style={{ stopColor: 'var(--wa-alloy-hi)' }} />
        </linearGradient>
      </defs>
      <circle r="99" className="wa-rim-tire" />
      <circle r="90" className="wa-rim-wall" />
      <circle r="81" fill={`url(#${id}-lip)`} />
      <circle r="74" className="wa-rim-barrel" />
      {SPOKES.map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M-8.5-22L-14.5-73.5L-4.2-75L-1.8-22Z" fill={`url(#${id}-spoke)`} />
          <path d="M1.8-22L4.2-75L14.5-73.5L8.5-22Z" fill={`url(#${id}-spoke)`} />
        </g>
      ))}
      <circle r="25" fill={`url(#${id}-lip)`} />
      <circle r="25" className="wa-rim-ring" />
      {LUGS.map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r="3.2" className="wa-rim-lug" />)}
      <circle r="8.5" className="wa-rim-cap" />
      <path d="M-55.2-55.2A78 78 0 0 1-20.2-75.3" className="wa-rim-sheen" />
    </svg>
  );
}

function RimStage({ id, small = false }) {
  return (
    <div className={`wa-rimstage${small ? ' wa-rimstage-sm' : ''}`} aria-hidden="true">
      <Rim id={id} />
    </div>
  );
}

// About photo stand-in on the published page: the business initial as a
// forged stamp (never an "upload a photo" box).
function Monogram({ name }) {
  const letter = (txt(name).match(/[A-Za-z0-9]/) || ['•'])[0].toUpperCase();
  return (
    <div className="wa-mono" aria-hidden="true">
      <span className="wa-mono-letter">{letter}</span>
    </div>
  );
}

// Owner-facing hint for an empty slot; never reaches the published page.
function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="wa-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

// Brand lists: owner-typed arrays, objects or comma strings.
function parseBrands(val) {
  if (Array.isArray(val)) return val.map(nameOf).filter(Boolean);
  if (typeof val === 'string') return val.split(/[,·;|]/).map((b) => b.trim()).filter(Boolean);
  return [];
}

// Trust-bar items the editor used to seed and this template used to fill
// in by default ("4.9 star rating", "Finance available / 0% for 12
// months", a fitment guarantee). An item saved exactly as seeded was never
// written by the owner, so it is dropped; seeded claim sub-lines are
// cleared. Anything the owner actually typed is shown as written.
const SEEDED_TRUST = new Set([
  'fitment guaranteed|or free return',
  'finance available|0% for 12 months',
  '4.9 star rating|customer reviews',
]);
const SEEDED_SUBS = new Set(['0% for 12 months', 'or free return', 'or we make it right']);

const fill = { position: 'absolute', inset: 0, height: '100%' };
const pad2 = (n) => String(n).padStart(2, '0');
const colsFor = (n) => (n === 1 ? 'wa-c1' : n === 2 || n === 4 ? 'wa-c2' : 'wa-c3');

export default function WheelApex({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(ownerPalette(templateMeta?.colors));
  const font = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const head = headProfile(font);
  const fb = getFallbacks(biz.businessType);

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrder(copy, sections.map((s) => s.id));

  const name = txt(biz.businessName);
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const email = txt(biz.email);
  const address = txt(biz.address);
  const city = txt(biz.city);
  const place = [city, txt(biz.state)].filter(Boolean).join(', ');
  // The wizard asks for "Service Area / Radius"; a bare number ("30") says
  // nothing without a unit, so it is not shown as the area.
  const rawArea = txt(biz.serviceArea);
  const area = /^\d+(\.\d+)?$/.test(rawArea) ? '' : rawArea;
  const years = txt(biz.yearsInBusiness);
  const yearsLabel = years && (/^\d+\+?$/.test(years) ? `${years} ${years === '1' ? 'year' : 'years'}` : years);
  const hours = hoursRows(biz.hours);
  const hoursSummary = hoursFact(hours);
  const payments = list(biz.paymentMethods).map(txt).filter(Boolean);
  const awards = list(biz.awards).map(txt).filter(Boolean);
  const certs = list(biz.certifications).map(txt).filter(Boolean);
  const warranty = txt(biz.warranty);

  // Services: the owner's Services tab (businessInfo.services, mirrored to
  // packages by normalizeBusinessInfo) wins over the AI list; an owner
  // service without a description borrows the AI description of the same
  // name. No stock products or prices.
  const asItem = (s) => (typeof s === 'string' ? { name: s } : s || {});
  const aiItems = list(copy.servicesSection?.items).map(asItem)
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }));
  const aiDesc = new Map(aiItems.filter((s) => s.name && s.description).map((s) => [s.name.toLowerCase(), s.description]));
  const fromPackages = list(biz.packages).length > 0;
  const services = (fromPackages ? biz.packages : aiItems).map(asItem)
    .map((s) => ({
      name: txt(s.name),
      price: txt(s.price),
      description: txt(s.description) || (fromPackages ? aiDesc.get(txt(s.name).toLowerCase()) || '' : ''),
    }))
    .filter((s) => s.name || s.description || s.price);

  // Products (Edit > Products) show first, then the services; the
  // "Show Products Section" switch there hides the products only.
  const products = copy.showProducts === false ? [] : list(copy.products).map(asItem)
    .map((p) => ({ name: txt(p.name), price: txt(p.price), description: txt(p.description), badge: txt(p.badge), image: txt(p.image) }))
    .filter((p) => p.name || p.price || p.description || p.image);
  const productMedia = products.some((p) => p.image);
  // A sentence-like price ("$150 - $300 depending on vehicle size") is set
  // smaller, for the whole grid so prices in a row still match.
  const longPrice = (items) => items.some((x) => x.price.length > 16);
  const productPriceLong = longPrice(products);
  const servicePriceLong = longPrice(services);
  const offerCount = products.length + services.length;
  // Owners type package details as lines ("- Foam hand wash\n- Vacuum");
  // keep their line breaks.
  const descStyle = { marginTop: 10, color: t.textMuted, fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-line' };

  // Ticker: the owner's items, else short specialties, else the names of
  // what the shop actually offers. Never stock slogans ("Fitment
  // Guaranteed").
  const ownTicker = (Array.isArray(copy.tickerItems) ? copy.tickerItems : txt(copy.tickerItems).split(','))
    .map(nameOf).filter(Boolean);
  const specialties = (Array.isArray(biz.specialties) ? biz.specialties : txt(biz.specialties).split(/\s*[,·•|\n]\s*/))
    .map(nameOf).filter(Boolean);
  // A derived list needs two or more entries: one name looping on its own
  // reads as a glitch, so the band then stays off.
  const offerNames = [...new Set([...products, ...services].map((x) => x.name).filter(Boolean))];
  const tickerItems = ownTicker.length > 0
    ? ownTicker
    : specialties.length >= 2 && specialties.every((s) => s.length <= 40) ? specialties
      : offerNames.length >= 2 ? offerNames : [];
  // The marquee loops two identical halves; each half repeats the items
  // until it is wider than a wide screen, so the band never runs dry.
  const tickerWidth = tickerItems.reduce((w, s) => w + s.length * 9 + 62, 0) || 1;
  const tickerReps = Math.min(8, Math.max(1, Math.ceil(2200 / tickerWidth)));
  const tickerDur = Math.round(Math.max(24, (tickerWidth * tickerReps) / 55));

  // Trust bar: what the owner typed there, else their real business facts.
  const ownTrust = list(copy.trustBar)
    .map((it) => ({ emoji: it && typeof it === 'object' ? it.emoji : null, label: txt(it?.label), sub: txt(it?.sub) }))
    .filter((it) => it.label && !SEEDED_TRUST.has(`${it.label.toLowerCase()}|${it.sub.toLowerCase()}`))
    .map((it) => ({ ...it, sub: SEEDED_SUBS.has(it.sub.toLowerCase()) ? '' : it.sub }));
  const factTrust = [
    yearsLabel && { icon: ICONS.clock, label: /^\d+\+?$/.test(years) ? `${yearsLabel} in business` : years, sub: 'Experience' },
    area ? { icon: ICONS.pin, label: area, sub: 'Service area' } : place && { icon: ICONS.pin, label: place, sub: 'Locally based' },
    hoursSummary && { icon: ICONS.calendar, label: hoursSummary, sub: 'Opening hours' },
    payments.length > 0 && { icon: ICONS.card, label: payments.slice(0, 3).join(' · ') + (payments.length > 3 ? ` +${payments.length - 3}` : ''), sub: 'Payment accepted' },
    warranty && { icon: ICONS.shield, label: warranty, sub: 'Warranty' },
    certs.length > 0 && { icon: ICONS.award, label: certs.join(' · '), sub: 'Certified' },
  ].filter(Boolean).slice(0, 4);
  const trustItems = ownTrust.length > 0 ? ownTrust : factTrust.length >= 2 ? factTrust : [];

  // Stats only from what the owner entered (About > Stats Box): in the
  // about panel when that layout is on, else under the hero. The old
  // template made up "2,400+ SKUs / 4.9 rating / 5K+".
  const ownerStats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label);
  const aboutStatsMode = (copy.aboutLayout || 'image') === 'stats';
  const aboutShowsStats = aboutStatsMode && ownerStats.length > 0 && show('about');
  const heroStats = aboutShowsStats ? [] : ownerStats.slice(0, 3);

  const wheelBrands = parseBrands(copy.wheelBrands ?? biz.brands);
  const tireBrands = parseBrands(copy.tireBrandsList ?? biz.tireBrands);
  const hasBrands = wheelBrands.length > 0 || tireBrands.length > 0;

  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);

  const testimonials = list(copy.testimonialPlaceholders).filter((q) => txt(q?.text));
  const reviews = copy.googleWidgetKey ? 'google' : testimonials.length > 0 ? 'quotes' : null;

  // What each section actually renders on the published page, so nav
  // links only point at real sections and neighbors alternate backgrounds.
  const rendered = {
    products: show('products') && offerCount > 0,
    brands: show('brands') && hasBrands,
    about: show('about'),
    gallery: show('gallery') && galleryImages.length > 0,
    testimonials: show('testimonials') && !!reviews,
    cta: show('cta'),
  };
  const defaultIdx = (id) => sections.findIndex((s) => s.id === id);
  const toneOrder = ['products', 'brands', 'about', 'gallery', 'testimonials']
    .filter((id) => rendered[id] || (editor && show(id)))
    .sort((a, b) => order(a) - order(b) || defaultIdx(a) - defaultIdx(b));
  const tone = (id) => (toneOrder.indexOf(id) % 2 === 1 ? 'wa-sec-surface' : 'wa-sec-bg');

  const navLinks = [
    rendered.products && { href: '#services', label: products.length > 0 ? 'Products' : 'Services' },
    rendered.brands && { href: '#brands', label: 'Brands' },
    rendered.about && { href: '#about', label: 'About' },
    rendered.gallery && { href: '#gallery', label: 'Gallery', extra: true },
    rendered.testimonials && { href: '#reviews', label: 'Reviews', extra: true },
    rendered.cta && { href: '#contact', label: 'Contact' },
  ].filter(Boolean);

  // A button URL that is an anchor must land on a section the published
  // page renders ("#gallery" with no gallery photos would go nowhere);
  // otherwise it counts as empty and the button's default applies.
  const liveAnchors = new Set(['#top', '#main', ...navLinks.map((l) => l.href)]);
  const ownerHref = (value) => {
    const href = linkHref(value);
    if (!href || href[0] !== '#') return href;
    const anchor = ANCHOR_ALIAS[href.toLowerCase()] || href;
    return liveAnchors.has(anchor) ? anchor : null;
  };

  const heroPrimaryHref = ownerHref(copy.ctaPrimaryUrl) || tel || (rendered.cta ? '#contact' : null);
  const heroPrimaryLabel = txt(copy.ctaPrimary) || fb.ctaHeadline || 'Get a Quote';
  const heroSecondaryHref = ownerHref(copy.ctaSecondaryUrl) || (rendered.products ? '#services' : rendered.cta ? '#contact' : null);
  const heroSecondaryLabel = txt(copy.ctaSecondary)
    || (!rendered.products ? 'Get in Touch' : services.length > 0 ? 'View Services' : 'View Products');
  const splitHero = copy.heroLayout === 'split';
  const photoHero = !splitHero && !!images.hero;
  const [lead, tail] = splitHeadline(txt(copy.headline) || name || fb.headline);
  const subheadline = txt(copy.subheadline) || txt(biz.tagline) || fb.subheadline;

  const vars = {
    '--wa-bg': t.bg,
    '--wa-surface': t.surface,
    '--wa-text': t.text,
    '--wa-muted': t.textMuted,
    '--wa-accent': t.accent,
    '--wa-accent-text': t.accentText,
    '--wa-on-accent': t.onAccent,
    '--wa-border': t.border,
    '--wa-border-strong': t.borderStrong,
    '--wa-focus': t.focus,
    '--wa-scrim': t.heroScrim,
    '--wa-scrim-left': t.heroScrimLeft,
    '--wa-on-hero': t.onHero,
    '--wa-head': font,
    '--wa-body': body,
    '--wa-h-weight': head.weight,
    '--wa-h-lh': head.lh,
    '--wa-h-ls': head.ls,
    '--wa-h-case': head.upper ? 'uppercase' : 'none',
    '--wa-h-scale': head.scale,
    '--wa-h-scale-sm': head.sm,
    '--wa-word-scale': head.word,
    '--wa-body-light': bodyLightWeight(body),
    '--wa-gutter': 'clamp(20px, 5cqi, 48px)',
    ...forgeTokens(t),
  };

  // Logo if uploaded, else the two-tone wordmark: first word in ink, the
  // rest in bronze (a one-word name stays one tone; the old template
  // borrowed words from a stock shop name to fill the second half).
  // A long name ("Estrella HandWash & Detailing") is set smaller and may
  // wrap to two lines in the nav, at every width, instead of losing its
  // end to an ellipsis beside the links.
  const words = name.split(/\s+/).filter(Boolean);
  const wordmark = (
    <span className={`wa-word${name.length > 20 ? ' wa-word-long' : ''}`}>
      {words[0] || ''}
      {words.length > 1 && <span>{` ${words.slice(1).join(' ')}`}</span>}
    </span>
  );
  const logo = (style, loading) => (
    <PhotoSlot src={images.logo} alt={name ? `${name} logo` : 'Logo'} loading={loading} style={style} imgStyle={{ objectFit: 'contain' }} />
  );

  const heroText = (
    <>
      <p className="wa-eyebrow">{[fb.heroBadge, city].filter(Boolean).join(' · ')}</p>
      <h1 className={`wa-h1 wa-display${`${lead} ${tail}`.length > 44 ? ' wa-h1-long' : ''}`}>
        {lead}
        {tail && <span className="wa-tone">{tail}</span>}
      </h1>
      {subheadline && <p className="wa-lead">{subheadline}</p>}
      {(heroPrimaryHref || heroSecondaryHref) && (
        <div className="wa-actions">
          {heroPrimaryHref && <a className="wa-btn" href={heroPrimaryHref}>{heroPrimaryLabel}</a>}
          {heroSecondaryHref && (
            <a className="wa-btn-line" href={heroSecondaryHref}>{heroSecondaryLabel}<Icon d={ICONS.arrow} size={16} /></a>
          )}
        </div>
      )}
      {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
    </>
  );
  const statsBand = heroStats.length > 0 && (
    <dl className="wa-stats">
      {heroStats.map((s, i) => (
        <div key={`${s.label}-${i}`} className="wa-stat">
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );

  const aboutParas = txt(copy.aboutText).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (aboutParas.length === 0 && city) aboutParas.push(`Located in ${city}, we specialize in ${fb.aboutFallback}.`);
  const aboutFacts = [
    yearsLabel && { label: 'Experience', value: /^\d+\+?$/.test(years) ? `${yearsLabel} in business` : years },
    place && { label: 'Based in', value: place },
    area && { label: 'Service area', value: area },
  ].filter(Boolean);

  const contactHeadline = txt(copy.ctaHeadline) || 'Ready to upgrade?';
  const contactOwnHref = ownerHref(copy.ctaUrl);
  const contactPrimaryHref = contactOwnHref || tel || (email ? `mailto:${email}` : null);
  const contactPrimaryLabel = txt(copy.ctaButtonText) || txt(copy.ctaPrimary) || phone || 'Contact Us';
  // The phone button's URL key (ctaSecondaryUrl) is also hero Button 2's,
  // so it only leaves tel: when the owner gave this button its own text;
  // the default "Call (555) ..." label always dials the number it shows.
  // A label that is itself a phone number dials that number.
  const callText = txt(copy.ctaSecondaryText);
  const contactSecondaryHref = (callText && (ownerHref(copy.ctaSecondaryUrl)
    || (/^\+?[\d\s().-]{7,}$/.test(callText) ? linkHref(callText) : null))) || tel;
  const contactSecondaryLabel = callText || (phone ? `Call ${phone}` : '');
  const showContactSecondary = contactSecondaryHref && contactSecondaryLabel && contactSecondaryHref !== contactPrimaryHref;
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, place].filter(Boolean).join(', '))}`
    : null;
  const contactRows = !!(phone || email || address || place || area || hours.length > 0 || warranty);
  const enquireHref = rendered.cta ? '#contact' : tel;

  return (
    <div
      id="top"
      className="wa-root"
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.6 }}
    >
      <style>{CSS}</style>
      <a className="wa-skip" href="#main">Skip to content</a>

      <nav className="wa-nav" aria-label="Main" style={{ order: -1 }}>
        <div className="wa-wrap wa-nav-in">
          <a className="wa-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
            {images.logo ? logo({ height: 40, width: 'auto', maxWidth: 180 }, 'eager') : wordmark}
          </a>
          {(navLinks.length > 0 || heroPrimaryHref) && (
            <div className="wa-links">
              {navLinks.map((l) => (
                <a key={l.href} className={`wa-link${l.extra ? ' wa-link-x' : ''}`} href={l.href}>{l.label}</a>
              ))}
              {heroPrimaryHref && (
                <a className="wa-btn wa-btn-sm wa-nav-cta" href={heroPrimaryHref}>{txt(copy.ctaPrimary) || 'Get a Quote'}</a>
              )}
            </div>
          )}
          <MobileMenu
            links={navLinks}
            cta={tel ? { href: tel, label: `Call ${phone}` } : { href: '#contact', label: 'Contact us' }}
            colors={{ bg: t.surface, text: t.text, accent: t.text, onAccent: readableOn(t.text) }}
            font={body}
          />
        </div>
      </nav>

      <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
        {!show('hero') && <h1 className="wa-sr">{name}</h1>}

        {show('hero') && photoHero && (
          <header data-section="hero" className="wa-hero wa-hero-photo" style={{ order: order('hero') }}>
            <div className="wa-hero-bg">
              <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
            </div>
            <div className="wa-hero-scrim" />
            <div className="wa-wrap wa-hero-body">
              <div>{heroText}</div>
            </div>
            {statsBand}
          </header>
        )}

        {show('hero') && !photoHero && (
          <header data-section="hero" className="wa-hero wa-hero-split" style={{ order: order('hero') }}>
            <div className="wa-hero-text">{heroText}</div>
            <div className="wa-stage">
              <div className="wa-stage-media">
                {images.hero
                  ? <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" style={fill} />
                  : <RimStage id="wa-hero-rim" />}
              </div>
              {statsBand}
            </div>
          </header>
        )}

        {show('trustBar') && (trustItems.length > 0 || editor) && (
          <section data-section="trustBar" className="wa-trust" aria-label="At a glance" style={{ order: order('trustBar') }}>
            <div className="wa-wrap">
              {trustItems.length > 0 ? (
                <ul className="wa-trust-grid">
                  {trustItems.map((it, i) => (
                    <li key={`${it.label}-${i}`} className="wa-trust-item" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 80}ms` }}>
                      {(it.icon || it.emoji || it.emoji === undefined || it.emoji === null) && (
                        <span className="wa-ticon" aria-hidden="true">
                          {it.icon ? <Icon d={it.icon} size={18} /> : txt(it.emoji) ? <IconOrEmoji value={txt(it.emoji)} size={16} /> : <Icon d={ICONS.rim} size={18} />}
                        </span>
                      )}
                      <span>
                        <span className="wa-tlabel">{it.label}</span>
                        {it.sub && <span className="wa-tsub">{it.sub}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ padding: '4px 0 24px' }}>
                  <EditorHint>This bar shows your real facts. Add items in Edit &gt; Trust Bar, or Years in Business, hours and payment methods in Edit &gt; Business Info.</EditorHint>
                </div>
              )}
            </div>
          </section>
        )}

        {show('ticker') && (tickerItems.length > 0 || editor) && (
          <section data-section="ticker" className="wa-ticker" aria-label="What we do" style={{ order: order('ticker'), '--wa-tick-dur': `${tickerDur}s` }}>
            {tickerItems.length > 0 ? (
              <div className="wa-tick-track">
                <ul className="wa-tick-group">
                  {tickerItems.map((item, i) => (
                    <li key={`a${i}`} className={`wa-tick-item${i === tickerItems.length - 1 ? ' wa-tick-last' : ''}`}>{item}</li>
                  ))}
                  {Array.from({ length: tickerReps - 1 }, (_, r) => tickerItems.map((item, i) => (
                    <li key={`r${r}-${i}`} className="wa-tick-item wa-tick-rep" aria-hidden="true">{item}</li>
                  )))}
                </ul>
                <ul className="wa-tick-group wa-tick-dup" aria-hidden="true">
                  {Array.from({ length: tickerReps }, (_, r) => tickerItems.map((item, i) => (
                    <li key={`d${r}-${i}`} className="wa-tick-item">{item}</li>
                  )))}
                </ul>
              </div>
            ) : (
              <div className="wa-wrap" style={{ paddingBottom: 12 }}>
                <EditorHint>Add ticker items in Edit &gt; Ticker, or services in Edit &gt; Services.</EditorHint>
              </div>
            )}
          </section>
        )}

        {show('products') && (offerCount > 0 || editor) && (
          <section data-section="products" id="services" className={`wa-sec ${tone('products')}`} aria-labelledby="wa-offer-h" style={{ order: order('products') }}>
            <ServiceCardCss />
            <div className="wa-wrap">
              <div className={`wa-head${txt(copy.servicesSection?.intro) ? '' : ' wa-head-solo'}`} data-acg-reveal="">
                <div>
                  <p className="wa-eyebrow">{products.length > 0 ? 'Our Products' : 'Our Services'}</p>
                  <h2 id="wa-offer-h" className="wa-h2 wa-display">{txt(copy.servicesSection?.title) || 'What We Offer'}</h2>
                </div>
                {txt(copy.servicesSection?.intro) && <p className="wa-intro">{copy.servicesSection.intro}</p>}
              </div>

              {products.length > 0 && (
                <div className={`wa-grid ${colsFor(products.length)}`}>
                  {products.map((p, i) => (
                    <div key={`p${i}`} className="wa-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                      <article className="acg-svc-card wa-card">
                        {productMedia && (
                          <div className="wa-card-media">
                            {p.badge && <span className="wa-badge">{p.badge}</span>}
                            <PhotoSlot
                              src={p.image}
                              slot="product"
                              alt={p.name || `${name || 'Our'} product photo`}
                              style={fill}
                              fallback={<RimStage id={`wa-prod-rim-${i}`} small />}
                            />
                          </div>
                        )}
                        {(p.name || p.price || p.description || (!productMedia && p.badge)) && (
                          <div className="wa-card-body">
                            {!productMedia && p.badge && <span className="wa-badge wa-badge-inline">{p.badge}</span>}
                            {p.name && <h3 className="wa-card-title wa-display">{p.name}</h3>}
                            <ServiceDescription
                              id={`svc-more-apex-prod-${i}`}
                              text={p.description}
                              style={descStyle}
                              accentColor={t.accentText}
                            />
                            {/* The price sits in the card foot (bottom-aligned
                                across the row, as in the mockup), never beside
                                the name, so a long name is not squeezed. */}
                            {(p.price || (p.name && enquireHref)) && (
                              <div className="wa-card-foot">
                                {p.price && <p className={`wa-price wa-price-foot${productPriceLong ? ' wa-price-long' : ''}`}>{p.price}</p>}
                                {p.name && enquireHref && (
                                  <div className="wa-foot-row">
                                    <a className="wa-more" href={enquireHref} aria-label={`Ask about ${p.name}`}>
                                      Ask about it <span className="wa-arrow"><Icon d={ICONS.arrow} size={16} /></span>
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    </div>
                  ))}
                </div>
              )}
              {products.length > 0 && !productMedia && <EditorHint>{PHOTO_HINTS.product}</EditorHint>}

              {services.length > 0 && products.length > 0 && (
                <div className="wa-subhead" data-acg-reveal=""><p className="wa-eyebrow">Services</p></div>
              )}
              {services.length > 0 && (
                <div className={`wa-grid ${colsFor(services.length)}`}>
                  {services.map((s, i) => (
                    <div key={`s${i}`} className="wa-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                      <article className="acg-svc-card wa-card wa-svc">
                        <div className="wa-card-body">
                          <span className="wa-idx">{pad2(i + 1)}</span>
                          {s.name && <h3 className="wa-card-title wa-display">{s.name}</h3>}
                          <ServiceDescription
                            id={`svc-more-apex-${fromPackages ? 'pkg' : 'ai'}-${i}`}
                            text={s.description}
                            style={{ ...descStyle, marginTop: 12 }}
                            accentColor={t.accentText}
                          />
                          {/* Price in the foot, as on the product cards: owners
                              type prices like "$150 - $300 depending on
                              vehicle size", which never fit beside the index. */}
                          <div className="acg-svc-foot">
                            {s.price && <p className={`wa-price wa-price-foot${servicePriceLong ? ' wa-price-long' : ''}`}>{s.price}</p>}
                            <div className="wa-foot-row">
                              <BookNowLink
                                serviceName={s.name}
                                phone={phone}
                                label={<>Book now <span className="wa-arrow"><Icon d={ICONS.arrow} size={16} /></span></>}
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              )}
              {offerCount === 0 && <EditorHint>Add your services in Edit &gt; Services, or products in Edit &gt; Products.</EditorHint>}
            </div>
          </section>
        )}

        {show('brands') && (hasBrands || editor) && (
          <section data-section="brands" id="brands" className={`wa-sec ${tone('brands')}`} aria-labelledby="wa-brands-h" style={{ order: order('brands') }}>
            <div className="wa-wrap">
              <div className="wa-brands-head" data-acg-reveal="">
                <p className="wa-eyebrow">Brands</p>
                <h2 id="wa-brands-h" className="wa-brands-title wa-display">Brands we carry</h2>
              </div>
              {[
                { key: 'wheels', label: 'Wheels', items: wheelBrands },
                { key: 'tires', label: 'Tires', items: tireBrands },
              ].filter((g) => g.items.length > 0).map((g, _, groups) => (
                <div key={g.key} className="wa-brand-group" data-acg-reveal="fade">
                  {groups.length > 1 && <p className="wa-label">{g.label}</p>}
                  <ul className="wa-brand-grid">
                    {g.items.map((b, i) => <li key={`${b}-${i}`} className="wa-brand-cell">{b}</li>)}
                  </ul>
                </div>
              ))}
              {!hasBrands && <EditorHint>List the brands you carry in Edit &gt; Brands.</EditorHint>}
            </div>
          </section>
        )}

        {show('about') && (
          <section data-section="about" id="about" className={`wa-sec ${tone('about')}`} aria-labelledby="wa-about-h" style={{ order: order('about') }}>
            <div className="wa-wrap wa-about">
              <div data-acg-reveal="">
                {aboutShowsStats ? (
                  <dl className="wa-statpanel">
                    {ownerStats.slice(0, 4).map((s, i) => (
                      <div key={`${s.label}-${i}`}>
                        <dt className="wa-label">{s.label}</dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="wa-frame">
                    <div className="wa-media">
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
                <p className="wa-eyebrow">About Us</p>
                <h2 id="wa-about-h" className="wa-h2 wa-display">{name ? `About ${name}` : 'About Us'}</h2>
                {aboutParas.length > 0 && (
                  <div className="wa-prose">
                    {aboutParas.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                )}
                {aboutFacts.length > 0 && (
                  <dl className="wa-dl">
                    {aboutFacts.map((f) => (
                      <div key={f.label}>
                        <dt className="wa-label">{f.label}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {awards.length > 0 && (
                  <div className="wa-awards" data-acg-awards="">
                    <p className="wa-label">Awards &amp; recognition</p>
                    <ul>
                      {awards.map((a, i) => (
                        <li key={`${a}-${i}`} className="wa-award"><Icon d={ICONS.award} size={18} />{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {payments.length > 0 && (
                  <div className="wa-pay">
                    <p className="wa-label">Payment accepted</p>
                    <ul className="wa-chips">
                      {payments.map((p) => <li key={p} className="wa-chip">{p}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {show('gallery') && (galleryImages.length > 0 || editor) && (
          <section data-section="gallery" id="gallery" className={`wa-sec ${tone('gallery')}`} aria-labelledby="wa-gallery-h" style={{ order: order('gallery') }}>
            <div className="wa-wrap">
              <div className="wa-head wa-head-solo" data-acg-reveal="">
                <div>
                  <p className="wa-eyebrow">Our Work</p>
                  <h2 id="wa-gallery-h" className="wa-h2 wa-display">Gallery</h2>
                </div>
              </div>
              {galleryImages.length === 0 ? (
                <PhotoSlot slot="gallery" style={{ minHeight: 220 }} />
              ) : galleryImages.length > 3 ? (
                <>
                  <div className="wa-track" role="region" aria-label="Photo gallery, scroll sideways for more" tabIndex={0}>
                    {galleryImages.map((src, i) => (
                      <figure key={i} className="wa-shot">
                        <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      </figure>
                    ))}
                  </div>
                  <p className="wa-swipe" aria-hidden="true">Swipe or scroll for more →</p>
                </>
              ) : (
                <div className={`wa-gal wa-g${galleryImages.length}`}>
                  {galleryImages.map((src, i) => (
                    <figure key={i} className="wa-shot" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'google' && (
          <section data-section="testimonials" id="reviews" className={`wa-sec ${tone('testimonials')}`} aria-label={txt(copy.googleReviewsTitle) || 'Reviews'} style={{ order: order('testimonials') }}>
            <div className="wa-wrap">
              {txt(copy.googleReviewsTitle) && (
                <div className="wa-head wa-head-solo">
                  <div>
                    <p className="wa-eyebrow">Reviews</p>
                    <h2 className="wa-h2 wa-display">{copy.googleReviewsTitle}</h2>
                  </div>
                </div>
              )}
              <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'quotes' && (
          <section data-section="testimonials" id="reviews" className={`wa-sec ${tone('testimonials')}`} aria-labelledby="wa-reviews-h" style={{ order: order('testimonials') }}>
            <div className="wa-wrap">
              <div className="wa-head wa-head-solo" data-acg-reveal="">
                <div>
                  <p className="wa-eyebrow">Reviews</p>
                  <h2 id="wa-reviews-h" className="wa-h2 wa-display">Customer Reviews</h2>
                </div>
              </div>
              <div className={`wa-grid ${colsFor(testimonials.length)}`}>
                {testimonials.map((q, i) => (
                  <div key={i} className="wa-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <figure className="wa-quote">
                      <svg className="wa-quote-mark" width="30" height="23" viewBox="0 0 34 26" fill="currentColor" aria-hidden="true">
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
          <section data-section="cta" id="contact" className="wa-sec wa-contact" aria-labelledby="wa-contact-h" style={{ order: order('cta') }}>
            <div className={`wa-wrap wa-contact-grid${contactRows ? '' : ' wa-contact-solo'}`}>
              <div data-acg-reveal="">
                <p className="wa-eyebrow">Get in touch</p>
                <h2 id="wa-contact-h" className={`wa-h2 wa-display ${contactHeadline.length > 36 ? 'wa-h2-long' : 'wa-h2-xl'}`}>{contactHeadline}</h2>
                {txt(copy.ctaSubtext) && <p className="wa-lead">{txt(copy.ctaSubtext)}</p>}
                {(contactPrimaryHref || showContactSecondary) && (
                  <div className="wa-actions">
                    {contactPrimaryHref && (
                      <a className="wa-btn" href={contactPrimaryHref} {...(contactOwnHref ? {} : { 'data-scheduler-trigger': '' })}>
                        {contactPrimaryLabel}
                      </a>
                    )}
                    {showContactSecondary && (
                      <a className="wa-btn-line" href={contactSecondaryHref}>{contactSecondaryLabel}<Icon d={ICONS.arrow} size={16} /></a>
                    )}
                  </div>
                )}
              </div>

              {contactRows && (
                <div className="wa-panel" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                  <ul>
                    {phone && (
                      <li className="wa-row">
                        <span className="wa-icon"><Icon d={ICONS.phone} /></span>
                        <span className="wa-row-body">
                          <span className="wa-label">Phone</span>
                          <span className="wa-row-value">{tel ? <a href={tel}>{phone}</a> : phone}</span>
                        </span>
                      </li>
                    )}
                    {email && (
                      <li className="wa-row">
                        <span className="wa-icon"><Icon d={ICONS.mail} /></span>
                        <span className="wa-row-body">
                          <span className="wa-label">Email</span>
                          <span className="wa-row-value"><a href={`mailto:${email}`}>{email}</a></span>
                        </span>
                      </li>
                    )}
                    {(address || place || area) && (
                      <li className="wa-row">
                        <span className="wa-icon"><Icon d={ICONS.pin} /></span>
                        <span className="wa-row-body">
                          <span className="wa-label">{address ? 'Location' : area ? 'Service area' : 'Based in'}</span>
                          <span className="wa-row-value">
                            {address ? <a href={mapsHref} target="_blank" rel="noopener noreferrer">{[address, place].filter(Boolean).join(', ')}</a> : (area || place)}
                          </span>
                          {address && area && <span className="wa-row-value" style={{ color: 'var(--wa-muted)' }}>{area}</span>}
                        </span>
                      </li>
                    )}
                    {hours.length > 0 && (
                      <li className="wa-row">
                        <span className="wa-icon"><Icon d={ICONS.clock} /></span>
                        <span className="wa-row-body">
                          <span className="wa-label">Hours</span>
                          {hours.length === 1 && !hours[0].time ? (
                            <span className="wa-row-value">{hours[0].days}</span>
                          ) : (
                            <dl className="wa-hours">
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
                    {warranty && (
                      <li className="wa-row">
                        <span className="wa-icon"><Icon d={ICONS.shield} /></span>
                        <span className="wa-row-body">
                          <span className="wa-label">Warranty</span>
                          <span className="wa-row-value">{warranty}</span>
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="wa-foot" style={{ order: 9999 }}>
        <div className="wa-wrap">
          <div className="wa-foot-grid">
            <div className="wa-foot-brand">
              <a className="wa-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
                {images.logo ? <span className="wa-foot-logo">{logo({ height: 40, width: 'auto', maxWidth: 180 })}</span> : wordmark}
              </a>
              {(txt(copy.footerTagline) || txt(biz.tagline)) && <p className="wa-foot-tag">{txt(copy.footerTagline) || txt(biz.tagline)}</p>}
              <div className="wa-social">
                <SocialRow biz={biz} size={18} gap={10} images={images} />
              </div>
            </div>
            {navLinks.length > 0 && (
              <div>
                <p className="wa-foot-h">Explore</p>
                <ul className="wa-foot-list">
                  {navLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
            )}
            {(tel || email || place) && (
              <div>
                <p className="wa-foot-h">Contact</p>
                <ul className="wa-foot-list">
                  {tel && <li><a href={tel}>{phone}</a></li>}
                  {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                  {place && <li>{place}</li>}
                </ul>
              </div>
            )}
          </div>
          <div className="wa-foot-bottom">
            <p>© <span data-acg-year="">{new Date().getFullYear()}</span> {name}{place ? ` · ${place}` : ''}</p>
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref="#contact" colors={t} font={body} />
    </div>
  );
}
