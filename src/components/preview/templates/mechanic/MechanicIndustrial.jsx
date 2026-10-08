// Industrial (mechanic_industrial): dark steel & safety yellow, built tough.
// Theme-ready (see CLAUDE.md, "Template contract"; MobileChrome.jsx is the
// reference). What keeps it static-export safe and honest:
//   - every color is a deriveTheme() token exposed as a --mi-* variable, so
//     an owner's palette repaints the steel, the yellow and the hazard tape;
//   - the heading font slot drives every heading (weight picked from what
//     the font actually ships, so a single-weight face is never faux-bold);
//   - all CSS lives in the one prefixed <style> below: @container layout,
//     hover inside (hover:hover), motion inside prefers-reduced-motion;
//   - no useState/useEffect: the nav is opaque and only gains its yellow
//     rule + shadow from html[data-acg-scrolled] (siteRuntime.js);
//   - facts (stats, hours, warranty, awards, certifications) render only
//     when the owner entered them; editor hints go through PhotoSlot /
//     EditorOnly. Hours and the warranty now live inside ordered sections
//     (contact and services; the warranty moves to About when Services is
//     hidden) instead of floating under the hero, and awards get their own
//     hideable "awards" section.
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import { ServiceCardCss, ServiceDescription, BookNowLink } from '../ServiceCardParts.jsx';
import { buildSectionOrderAdded } from '../../../../lib/sectionOrder.js';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS } from '../../../../lib/businessHours.js';
import { FONT_CATALOG, familiesFromStack, catalogFamily } from '../../../../lib/fontCatalog.js';
import { deriveTheme, mix, alpha, ensureContrast, readableOn } from '../kit/theme.js';
import { PhotoSlot, PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';
import { BeforeAfterBand, beforeAfterCss } from '../kit/BeforeAfter.jsx';
import { beforeAfterPairs, BA_DEFAULTS } from '../kit/beforeAfter.js';

export const themeReady = true;

// ContentEditor has no TOGGLEABLE entry for this template, so it lists
// _default: same ids, same order. Never rename an id (saved sites store
// them in copy.sectionOrder / copy.hiddenSections). 'beforeAfter' (the
// Before & After band) came later: see addedSections.
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'statsBar', label: 'Stats Bar' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'beforeAfter', label: 'Before & After' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'cta', label: 'Contact / CTA' },
  { id: 'awards', label: 'Awards' },
];

// Ids added after sites were saved with this design. Saved sites store
// copy.sectionOrder without them, so the page orders them itself
// (buildSectionOrderAdded): every older section keeps exactly its saved
// order value, and an added band without a saved slot shares the value of
// the section before it, rendering right after it in the DOM.
export const addedSections = ['beforeAfter'];

export const extraFonts = [];

const CSS = `
.mi-wrap{width:100%;max-width:1240px;margin:0 auto;padding-left:var(--mi-gutter);padding-right:var(--mi-gutter)}
.mi-root :where(h1,h2,h3,p,ul,ol,dl,dd,figure,blockquote){margin:0}
.mi-root :where(ul,ol){list-style:none;padding:0}
.mi-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.mi-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 18px;border-radius:3px;background:var(--mi-accent);color:var(--mi-on-accent);font-weight:700;text-decoration:none}
.mi-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.mi-root a:focus-visible,.mi-root summary:focus-visible,.mi-root label:focus-visible,.mi-track:focus-visible{outline:2px solid var(--mi-focus);outline-offset:3px}
.mi-kicker{display:inline-flex;align-items:center;gap:14px;font-size:12px;font-weight:800;line-height:1.4;letter-spacing:.24em;text-transform:uppercase;color:var(--mi-accent-text)}
.mi-kicker::before{content:'';flex:none;width:36px;height:4px;border-radius:1px;background:var(--mi-accent)}
.mi-kicker svg{flex:none}
.mi-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin-top:20px;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:4px;font-size:13px;font-weight:500;line-height:1.45;color:inherit;opacity:.85;text-transform:none;letter-spacing:0}

.mi-nav{position:sticky;top:0;z-index:100;background:var(--mi-bg);border-bottom:1px solid var(--mi-border)}
.mi-nav::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:3px;background:var(--mi-accent);transform:scaleX(0);transform-origin:left center}
html[data-acg-scrolled] .mi-nav{box-shadow:0 16px 36px -20px var(--mi-shadow)}
html[data-acg-scrolled] .mi-nav::after{transform:scaleX(1)}
.mi-nav-in{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:76px}
.mi-brand{flex:1 1 auto;display:inline-flex;align-items:center;gap:14px;min-width:0;color:var(--mi-text);text-decoration:none}
.mi-mark{flex:none;display:grid;place-items:center;width:42px;height:42px;border-radius:3px;background:var(--mi-accent);color:var(--mi-on-accent)}
.mi-brand-text{display:flex;flex-direction:column;min-width:0}
.mi-wordmark{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mi-head);font-size:18px;font-weight:var(--mi-head-w);line-height:1.1;letter-spacing:.02em;text-transform:uppercase}
.mi-brand-sub{margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--mi-accent-text)}
.mi-links{flex:none;display:flex;align-items:center;gap:clamp(20px,2.6cqi,34px)}
.mi-link{position:relative;padding:12px 0;color:var(--mi-muted);font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-decoration:none}
.mi-link::after{content:'';position:absolute;left:0;right:0;bottom:6px;height:2px;background:var(--mi-accent);transform:scaleX(0);transform-origin:left center}

.mi-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 30px;border:2px solid transparent;border-radius:3px;font-family:var(--mi-body);font-size:14px;font-weight:800;line-height:1.2;letter-spacing:.1em;text-transform:uppercase;text-align:center;text-decoration:none;cursor:pointer}
.mi-btn:active{transform:translateY(1px)}
.mi-btn-accent{background:var(--mi-accent);color:var(--mi-on-accent);box-shadow:0 14px 32px -16px var(--mi-glow)}
.mi-btn-line{background:transparent;color:var(--mi-accent-text);border-color:var(--mi-accent-text)}
.mi-btn-dark{background:var(--mi-cta-btn-bg);color:var(--mi-cta-btn-text)}
.mi-btn-ghost-dark{background:transparent;color:var(--mi-cta-text);border-color:var(--mi-cta-line)}
.mi-btn-sm{min-height:46px;padding:0 20px;font-size:13px}
.mi-btn svg{flex:none}

.mi-hero{position:relative;isolation:isolate;overflow:clip;display:flex;align-items:center;min-height:clamp(600px,calc(100vh - 76px),900px);padding:clamp(96px,11cqi,150px) 0 clamp(88px,10cqi,140px);background:var(--mi-hero-grad);color:var(--mi-text)}
.mi-hero-media{position:absolute;inset:0;z-index:-3}
.mi-hero-scrim{position:absolute;inset:0;z-index:-2;background:var(--mi-scrim-left)}
.mi-has-media{color:var(--mi-on-hero)}
.mi-has-media .mi-lead{color:var(--mi-on-hero-muted)}
.mi-has-media .mi-kicker{color:var(--mi-on-hero)}
.mi-has-media .mi-hl{color:var(--mi-hero-hl)}
.mi-has-media .mi-btn-line{color:var(--mi-on-hero);border-color:var(--mi-on-hero-line)}
.mi-has-media .mi-badge{color:var(--mi-on-hero);border-color:var(--mi-on-hero-line);background:rgba(0,0,0,.28)}
.mi-has-media .mi-badge svg{color:var(--mi-hero-hl)}
.mi-grid-bg{position:absolute;inset:0;z-index:-2;pointer-events:none;background-image:linear-gradient(var(--mi-grid) 1px,transparent 1px),linear-gradient(90deg,var(--mi-grid) 1px,transparent 1px);background-size:56px 56px;background-position:-1px -1px;-webkit-mask-image:linear-gradient(90deg,black 0%,black 55%,transparent 100%);mask-image:linear-gradient(90deg,black 0%,black 55%,transparent 100%)}
.mi-bar{position:absolute;top:0;left:0;bottom:0;width:8px;z-index:-1;background:linear-gradient(180deg,var(--mi-accent),transparent);opacity:.75}
.mi-hair{position:absolute;top:0;bottom:0;right:30%;width:1px;z-index:-1;background:linear-gradient(180deg,transparent,var(--mi-accent-line),transparent)}
.mi-gear{position:absolute;top:50%;right:max(-12cqi,-170px);z-index:-1;width:min(58cqi,720px);aspect-ratio:1;translate:0 -50%;color:var(--mi-accent-text);opacity:.16;pointer-events:none}
.mi-gear svg{display:block;width:100%;height:100%}
.mi-hazard{position:absolute;left:0;right:0;bottom:0;height:10px;background:var(--mi-hazard)}
.mi-hero-body{position:relative;max-width:920px}
.mi-h1{margin-top:26px;font-family:var(--mi-head);font-size:clamp(44px,7.2cqi,104px);font-weight:var(--mi-head-w);line-height:.96;letter-spacing:-.025em;text-transform:uppercase;text-wrap:balance}
.mi-hl{color:var(--mi-accent-text)}
.mi-lead{margin-top:26px;max-width:580px;font-size:clamp(17px,1.6cqi,20px);line-height:1.7;color:var(--mi-muted);text-wrap:pretty}
.mi-actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:40px}
.mi-badges{display:flex;flex-wrap:wrap;gap:10px;margin-top:clamp(40px,5cqi,56px)}
.mi-badge{display:inline-flex;align-items:center;gap:9px;padding:9px 14px;border:1px solid var(--mi-accent-line);border-radius:2px;background:var(--mi-accent-soft);color:var(--mi-text);font-size:12px;font-weight:800;line-height:1.3;letter-spacing:.14em;text-transform:uppercase}
.mi-badge svg{flex:none;color:var(--mi-accent-text)}
.mi-split{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);min-height:clamp(560px,calc(100vh - 76px),860px);background:var(--mi-hero-grad);color:var(--mi-text)}
.mi-split-text{position:relative;isolation:isolate;overflow:clip;display:flex;flex-direction:column;justify-content:center;padding:clamp(72px,8cqi,120px) clamp(24px,5cqi,72px) clamp(72px,8cqi,120px) max(calc(var(--mi-gutter) + 8px),calc((100cqi - 1240px) / 2 + var(--mi-gutter)))}
.mi-split .mi-h1{font-size:clamp(40px,5.4cqi,80px)}
.mi-split-photo{position:relative;min-height:440px;background:var(--mi-surface);border-left:6px solid var(--mi-accent)}

.mi-facts{position:relative;background:var(--mi-surface);border-bottom:1px solid var(--mi-border)}
.mi-facts-grid{display:grid}
.mi-n1{grid-template-columns:minmax(0,1fr)}
.mi-n2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mi-n3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mi-n4{grid-template-columns:repeat(4,minmax(0,1fr))}
.mi-fact{padding:clamp(28px,3.2cqi,44px) clamp(18px,2.4cqi,32px);border-left:1px solid var(--mi-border)}
.mi-fact:first-child{border-left:0;padding-left:0}
.mi-fact:last-child{padding-right:0}
.mi-label{display:block;font-size:11px;font-weight:800;line-height:1.4;letter-spacing:.22em;text-transform:uppercase;color:var(--mi-muted)}
.mi-fact .mi-label{color:var(--mi-accent-text)}
.mi-fact-value{display:block;margin-top:10px;font-size:clamp(16px,1.5cqi,19px);font-weight:600;line-height:1.45;color:var(--mi-text);white-space:pre-line}
.mi-stat{display:flex;flex-direction:column-reverse;justify-content:flex-end}
.mi-stat .mi-label{margin-top:12px;color:var(--mi-muted)}
.mi-stat-value{display:block;font-family:var(--mi-head);font-size:clamp(40px,4.6cqi,64px);font-weight:var(--mi-head-w);line-height:1;letter-spacing:-.03em;color:var(--mi-accent-text)}

.mi-section{position:relative;padding:clamp(76px,9cqi,128px) 0;scroll-margin-top:76px}
.mi-alt{background:var(--mi-surface);border-top:1px solid var(--mi-border);border-bottom:1px solid var(--mi-border)}
.mi-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:end;gap:20px clamp(32px,6cqi,96px);margin-bottom:clamp(40px,5cqi,64px)}
.mi-head-solo{grid-template-columns:minmax(0,1fr)}
.mi-h2{margin-top:20px;font-family:var(--mi-head);font-size:clamp(34px,4.8cqi,64px);font-weight:var(--mi-head-w);line-height:.98;letter-spacing:-.02em;text-transform:uppercase;color:var(--mi-text);text-wrap:balance}
.mi-intro{font-size:17px;line-height:1.75;color:var(--mi-muted);text-wrap:pretty}
.mi-grid{display:grid;gap:2px}
.mi-c1{grid-template-columns:minmax(0,680px)}
.mi-c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mi-c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mi-cell{display:flex;min-width:0}
.mi-card{flex:1;position:relative;padding:clamp(28px,2.8cqi,40px);background:var(--mi-surface);border:1px solid var(--mi-border)}
.mi-card::before{content:'';position:absolute;top:-1px;left:-1px;right:-1px;height:3px;background:var(--mi-accent);transform:scaleX(.16);transform-origin:left center}
.mi-card-top{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:34px}
.mi-idx{display:inline-flex;align-items:center;gap:10px;font-size:13px;font-weight:800;letter-spacing:.16em;color:var(--mi-accent-text);font-variant-numeric:tabular-nums}
.mi-idx svg{opacity:.9}
.mi-price{font-family:var(--mi-head);font-size:clamp(24px,2.2cqi,30px);font-weight:var(--mi-head-w);line-height:1.1;letter-spacing:-.01em;color:var(--mi-text);white-space:nowrap}
.mi-card-title{margin-top:26px;font-family:var(--mi-head);font-size:clamp(19px,1.7cqi,22px);font-weight:var(--mi-head-w2);line-height:1.2;letter-spacing:.01em;text-transform:uppercase;color:var(--mi-text)}
.mi-card .acg-svc-foot{padding-top:26px}
.mi-card .acg-svc-more{min-height:32px;padding-top:6px}
.mi-foot-line{padding-top:14px;border-top:1px solid var(--mi-border)}
.mi-card .acg-svc-book{display:inline-flex;align-items:center;gap:10px;min-height:44px;color:var(--mi-accent-text);font-size:12.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;text-decoration:none}
.mi-warranty{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:clamp(18px,2.6cqi,32px);margin-top:clamp(28px,3.4cqi,44px);padding:clamp(24px,3cqi,36px);border:2px solid var(--mi-accent);border-radius:3px;background:var(--mi-accent-soft)}
.mi-warranty-icon{display:grid;place-items:center;width:clamp(56px,6cqi,72px);aspect-ratio:1;border-radius:3px;background:var(--mi-accent);color:var(--mi-on-accent)}
.mi-warranty .mi-label{color:var(--mi-accent-text)}
.mi-warranty-text{margin-top:8px;font-family:var(--mi-head);font-size:clamp(20px,2.3cqi,30px);font-weight:var(--mi-head-w2);line-height:1.2;letter-spacing:-.005em;text-transform:uppercase;color:var(--mi-text);text-wrap:balance}
.mi-warranty-more{margin-top:8px;font-size:15px;line-height:1.6;color:var(--mi-muted)}

.mi-about{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:center;gap:clamp(40px,7cqi,104px)}
.mi-about-long{align-items:start}
.mi-about-long .mi-about-side{position:sticky;top:112px}
.mi-about-solo{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:start;gap:28px clamp(32px,5cqi,72px)}
.mi-about-solo .mi-about-copy{margin-top:40px;padding-left:clamp(24px,3cqi,40px);border-left:1px solid var(--mi-border-strong)}
.mi-frame{position:relative;padding:14px}
.mi-frame::before,.mi-frame::after{content:'';position:absolute;width:64px;height:64px;border:0 solid var(--mi-accent);pointer-events:none}
.mi-frame::before{top:0;left:0;border-top-width:4px;border-left-width:4px}
.mi-frame::after{right:0;bottom:0;border-right-width:4px;border-bottom-width:4px}
.mi-media{position:relative;aspect-ratio:4/5;overflow:hidden;border-radius:2px;background:var(--mi-surface);border:1px solid var(--mi-border)}
.mi-prose p{font-size:17px;line-height:1.8;color:var(--mi-muted);white-space:pre-line;text-wrap:pretty}
.mi-prose p+p{margin-top:18px}
.mi-prose p:first-child{font-size:clamp(18px,1.7cqi,21px);line-height:1.65;color:var(--mi-text)}
.mi-specs{margin-top:36px;border-top:1px solid var(--mi-border)}
.mi-spec{display:grid;grid-template-columns:minmax(120px,190px) minmax(0,1fr);gap:8px 24px;padding:16px 0;border-bottom:1px solid var(--mi-border)}
.mi-spec dt{padding-top:3px;font-size:11px;font-weight:800;line-height:1.5;letter-spacing:.2em;text-transform:uppercase;color:var(--mi-accent-text)}
.mi-spec dd{font-size:16px;line-height:1.55;color:var(--mi-text)}
.mi-statpanel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;border-top:4px solid var(--mi-accent)}
.mi-statpanel>div{display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:clamp(24px,3cqi,40px);background:var(--mi-bg)}
.mi-statpanel>div:last-child:nth-child(odd){grid-column:1 / -1}
.mi-mono{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:var(--mi-hero-grad)}
.mi-mono .mi-grid-bg{z-index:0;-webkit-mask-image:none;mask-image:none}
.mi-mono .mi-gear{top:50%;left:50%;right:auto;width:120%;translate:-50% -50%;opacity:.2;z-index:0}
.mi-mono-letter{position:relative;font-family:var(--mi-head);font-size:clamp(96px,14cqi,200px);font-weight:var(--mi-head-w);line-height:1;letter-spacing:-.04em;color:var(--mi-accent-text)}

.mi-gal{display:grid;gap:clamp(8px,1cqi,14px)}
.mi-g1{grid-template-columns:minmax(0,1fr)}
.mi-g1 .mi-shot{aspect-ratio:21/9}
.mi-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.mi-g2 .mi-shot{aspect-ratio:4/3}
.mi-g3{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));height:clamp(420px,52cqi,640px)}
.mi-g3 .mi-shot:first-child{grid-row:1 / span 2}
.mi-shot{position:relative;min-height:0;overflow:hidden;border-radius:2px;background:var(--mi-surface)}
.mi-shot::after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--mi-accent);transform:scaleX(0);transform-origin:left center}
.mi-track{display:flex;gap:clamp(10px,1.2cqi,16px);overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc(-1 * var(--mi-gutter));padding:0 var(--mi-gutter) 4px;scroll-padding:0 var(--mi-gutter)}
.mi-track::-webkit-scrollbar{display:none}
.mi-track .mi-shot{flex:0 0 auto;width:clamp(240px,30cqi,380px);aspect-ratio:4/5;scroll-snap-align:start}
.mi-swipe{margin-top:20px;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--mi-muted)}

.mi-quote{flex:1;position:relative;display:flex;flex-direction:column;padding:clamp(28px,3cqi,40px);background:var(--mi-bg);border:1px solid var(--mi-border);border-left:4px solid var(--mi-accent)}
.mi-quote-mark{display:block;color:var(--mi-accent-text)}
.mi-quote blockquote{flex:1;margin-top:20px}
.mi-quote blockquote p{font-size:17px;line-height:1.75;color:var(--mi-text);text-wrap:pretty}
.mi-quote figcaption{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:26px;padding-top:18px;border-top:1px solid var(--mi-border);font-size:12.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--mi-accent-text)}
.mi-quote figcaption span{font-weight:500;letter-spacing:.04em;text-transform:none;color:var(--mi-muted)}

.mi-section.mi-contact{padding-top:0;overflow:clip}
.mi-section.mi-contact-solo{padding-bottom:0}
.mi-cta-band{position:relative;isolation:isolate;overflow:clip;padding:clamp(72px,8.5cqi,112px) 0 clamp(64px,8cqi,104px);background:var(--mi-cta-bg);color:var(--mi-cta-text)}
.mi-cta-band::before{content:'';position:absolute;top:0;left:0;right:0;height:10px;background:var(--mi-hazard)}
.mi-cta-band .mi-gear{right:max(-16cqi,-220px);width:min(52cqi,640px);color:var(--mi-cta-text);opacity:.07}
.mi-cta-in{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);align-items:end;gap:28px clamp(32px,6cqi,96px)}
.mi-cta-kicker{display:inline-flex;align-items:center;gap:12px;font-size:12px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:var(--mi-cta-text)}
.mi-cta-kicker::before{content:'';width:36px;height:4px;border-radius:1px;background:var(--mi-cta-text)}
.mi-cta-h{margin-top:20px;font-family:var(--mi-head);font-size:clamp(38px,5.8cqi,80px);font-weight:var(--mi-head-w);line-height:.95;letter-spacing:-.025em;text-transform:uppercase;color:var(--mi-cta-text);text-wrap:balance}
.mi-cta-sub{margin-top:20px;max-width:560px;font-size:clamp(16px,1.5cqi,18px);line-height:1.65;color:var(--mi-cta-muted)}
.mi-cta-actions{display:flex;flex-direction:column;align-items:stretch;gap:12px}
.mi-cta-note{font-size:14px;line-height:1.5;color:var(--mi-cta-muted);text-align:center}
.mi-cta-note a{color:var(--mi-cta-text);font-weight:800;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:3px}
.mi-visit{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:2px;margin-top:clamp(40px,5cqi,64px)}
.mi-panel{position:relative;padding:clamp(28px,3cqi,40px);background:var(--mi-surface);border:1px solid var(--mi-border);scroll-margin-top:96px}
.mi-panel-h{display:flex;align-items:center;gap:12px;font-family:var(--mi-head);font-size:clamp(20px,1.9cqi,24px);font-weight:var(--mi-head-w);line-height:1.1;letter-spacing:.01em;text-transform:uppercase;color:var(--mi-text)}
.mi-panel-h svg{flex:none;color:var(--mi-accent-text)}
.mi-hours{display:grid;margin-top:20px}
.mi-hrow{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:13px 0;border-bottom:1px dashed var(--mi-border-strong)}
.mi-hrow:last-child{border-bottom:0}
.mi-hrow dt{font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--mi-text)}
.mi-hrow dd{font-size:15px;font-weight:700;color:var(--mi-accent-text);text-align:right;font-variant-numeric:tabular-nums}
.mi-hrow.mi-closed dd{color:var(--mi-muted);font-weight:600}
.mi-hours-flat{margin-top:20px;font-size:17px;font-weight:600;line-height:1.6;color:var(--mi-text)}
.mi-rows{display:grid;margin-top:12px}
.mi-row{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--mi-border)}
.mi-row:last-child{border-bottom:0;padding-bottom:0}
.mi-row-icon{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:3px;background:var(--mi-accent-soft);color:var(--mi-accent-text)}
.mi-row-body{min-width:0;flex:1}
.mi-row-value{display:block;margin-top:4px;font-size:16px;line-height:1.5;color:var(--mi-text);overflow-wrap:anywhere}
.mi-row-value a{color:inherit;text-decoration:none;border-bottom:1px solid var(--mi-border-strong)}
.mi-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.mi-chip{padding:7px 12px;border:1px solid var(--mi-border-strong);border-radius:2px;background:var(--mi-bg);font-size:12px;font-weight:800;line-height:1.3;letter-spacing:.1em;text-transform:uppercase;color:var(--mi-text)}
.mi-visit-solo .mi-panel{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2.2fr);align-items:start;gap:22px clamp(32px,5cqi,72px)}
.mi-visit-solo :is(.mi-rows,.mi-hours,.mi-chips,.mi-hours-flat){margin-top:0}
.mi-visit-solo .mi-rows{grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:18px 28px}
.mi-visit-solo .mi-row{padding:0;border-bottom:0}

.mi-awards{position:relative;padding:clamp(40px,5cqi,60px) 0;background:var(--mi-surface);border-top:1px solid var(--mi-border);border-bottom:1px solid var(--mi-border)}
.mi-awards-in{display:flex;flex-wrap:wrap;align-items:center;gap:20px clamp(28px,4cqi,56px)}
.mi-award-list{display:flex;flex-wrap:wrap;gap:14px clamp(24px,3.6cqi,48px)}
.mi-award{display:inline-flex;align-items:center;gap:12px;font-family:var(--mi-head);font-size:clamp(16px,1.5cqi,19px);font-weight:var(--mi-head-w2);line-height:1.3;text-transform:uppercase;letter-spacing:.02em;color:var(--mi-text)}
.mi-award svg{flex:none;color:var(--mi-accent-text)}

.mi-foot{padding:clamp(64px,8cqi,96px) 0 36px;background:var(--mi-footer-bg);color:var(--mi-footer-muted);border-top:3px solid var(--mi-accent);font-size:15px;line-height:1.6}
.mi-foot-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:40px clamp(28px,4cqi,64px)}
.mi-fc3{grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)}
.mi-fc2{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}
.mi-fc1{grid-template-columns:minmax(0,1fr)}
.mi-foot .mi-brand{color:var(--mi-footer-text)}
.mi-foot .mi-brand-sub{color:var(--mi-footer-muted)}
.mi-foot-tag{margin-top:18px;max-width:360px}
.mi-foot-h{font-size:11px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:var(--mi-footer-text)}
.mi-foot-list{display:grid;gap:10px;margin-top:18px}
.mi-foot-list li{min-width:0;overflow-wrap:anywhere}
.mi-foot a{color:var(--mi-footer-muted);text-decoration:none}
.mi-foot .mi-chip{background:transparent;border-color:var(--mi-footer-line);color:var(--mi-footer-text)}
.mi-social{margin-top:24px}
.mi-social a{width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--mi-footer-line);border-radius:3px}
.mi-foot-bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;margin-top:clamp(48px,6cqi,72px);padding-top:24px;border-top:1px solid var(--mi-footer-line);font-size:13px}

@media (hover:hover){
.mi-link:hover{color:var(--mi-text)}
.mi-link:hover::after{transform:scaleX(1)}
.mi-btn-accent:hover{transform:translateY(-2px);box-shadow:0 20px 40px -16px var(--mi-glow);background:var(--mi-accent-hover)}
.mi-btn-line:hover{background:var(--mi-accent-soft)}
.mi-has-media .mi-btn-line:hover{background:rgba(255,255,255,.1);border-color:var(--mi-on-hero)}
.mi-btn-dark:hover{transform:translateY(-2px);box-shadow:0 18px 36px -18px rgba(0,0,0,.6)}
.mi-btn-ghost-dark:hover{border-color:var(--mi-cta-text)}
.mi-card:hover{border-color:var(--mi-border-strong);transform:translateY(-3px);box-shadow:0 28px 56px -34px var(--mi-shadow)}
.mi-card:hover::before{transform:scaleX(1)}
.mi-card .acg-svc-book:hover svg{transform:translateX(5px)}
.mi-shot:hover img{transform:scale(1.04)}
.mi-shot:hover::after{transform:scaleX(1)}
.mi-row-value a:hover{color:var(--mi-accent-text);border-bottom-color:var(--mi-accent-text)}
.mi-foot a:hover{color:var(--mi-footer-text)}
.mi-social a:hover{border-color:var(--mi-accent)}
}
@media (prefers-reduced-motion:no-preference){
.mi-nav{transition:box-shadow .3s ease}
.mi-nav::after{transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.mi-link,.mi-row-value a,.mi-foot a{transition:color .2s ease,border-color .2s ease}
.mi-link::after{transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.mi-btn{transition:transform .2s ease,box-shadow .3s ease,background-color .2s ease,border-color .2s ease}
.mi-card{transition:transform .35s cubic-bezier(.2,.7,.2,1),border-color .25s ease,box-shadow .35s ease}
.mi-card::before{transition:transform .45s cubic-bezier(.2,.7,.2,1)}
.mi-card .acg-svc-book svg{transition:transform .25s ease}
.mi-shot img{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.mi-shot::after{transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.mi-social a{transition:border-color .25s ease}
.mi-hero .mi-gear{animation:mi-gear-in 1.8s cubic-bezier(.2,.7,.2,1) both}
.mi-hero .mi-hazard{animation:mi-tape-in 1.1s .2s cubic-bezier(.2,.7,.2,1) both;transform-origin:left center}
@keyframes mi-gear-in{from{opacity:0;rotate:-24deg}to{opacity:.16;rotate:0deg}}
@keyframes mi-tape-in{from{transform:scaleX(0)}to{transform:scaleX(1)}}
}

@container (max-width:1100px){.mi-link-x{display:none}}
@container (max-width:900px){
.mi-nav-cta{display:none}
.mi-c3{grid-template-columns:repeat(2,minmax(0,1fr))}
.mi-n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.mi-n4 .mi-fact:nth-child(odd){border-left:0;padding-left:0}
.mi-n4 .mi-fact:nth-child(even){padding-right:0}
.mi-n4 .mi-fact:nth-child(n+3){border-top:1px solid var(--mi-border)}
.mi-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.mi-foot-brand{grid-column:1 / -1}
}
@container (max-width:760px){
.mi-head,.mi-about,.mi-cta-in{grid-template-columns:minmax(0,1fr)}
.mi-about-long .mi-about-side{position:static}
.mi-about-solo .mi-about-copy{margin-top:0;padding-left:0;border-left:0}
.mi-media{aspect-ratio:4/3}
.mi-cta-actions{flex-direction:row;flex-wrap:wrap}
.mi-cta-note{width:100%;text-align:left}
.mi-split{grid-template-columns:minmax(0,1fr);min-height:0}
.mi-split-text{padding:64px var(--mi-gutter) 56px}
.mi-split-photo{min-height:0;aspect-ratio:4/3;border-left:0;border-top:6px solid var(--mi-accent)}
.mi-split-bare .mi-split-photo{display:none}
.mi-split-bare .mi-split-text::after{content:'';position:absolute;left:0;right:0;bottom:0;height:10px;background:var(--mi-hazard)}
.mi-visit-solo .mi-panel{grid-template-columns:minmax(0,1fr)}
}
@container (max-width:600px){
.mi-links,.mi-nav-cta{display:none}
.mi-nav-in{min-height:66px;gap:12px}
.mi-mark{width:36px;height:36px}
.mi-wordmark{font-size:16px}
.mi-brand-sub{display:none}
.mi-hero{min-height:0;padding:64px 0 60px}
.mi-hero.mi-has-media{min-height:clamp(540px,84vh,760px);align-items:flex-end}
.mi-hero-scrim{background:var(--mi-scrim)}
.mi-bar{width:5px}
.mi-hair{display:none}
.mi-hero .mi-gear{top:auto;bottom:-18cqi;right:-34cqi;width:96cqi;translate:none}
.mi-h1,.mi-split .mi-h1{font-size:clamp(38px,11.4cqi,56px);line-height:.98}
.mi-lead{font-size:17px}
.mi-actions{flex-direction:column;align-items:stretch;margin-top:32px}
.mi-badges{margin-top:32px}
.mi-facts-grid{grid-template-columns:minmax(0,1fr)}
.mi-fact,.mi-n4 .mi-fact:nth-child(n){display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding:18px 0;border-left:0;border-top:1px solid var(--mi-border)}
.mi-fact:first-child,.mi-n4 .mi-fact:first-child{border-top:0}
.mi-fact-value{margin-top:0;text-align:right;font-size:15.5px}
.mi-stats-kind.mi-facts-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.mi-stats-kind .mi-fact,.mi-stats-kind.mi-n4 .mi-fact:nth-child(n){display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:22px 0;border-top:1px solid var(--mi-border)}
.mi-stats-kind .mi-fact:nth-child(-n+2){border-top:0}
.mi-stats-kind .mi-fact:last-child:nth-child(odd){grid-column:1 / -1}
.mi-section{padding:72px 0}
.mi-h2{font-size:clamp(30px,9.4cqi,42px)}
.mi-c1,.mi-c2,.mi-c3{grid-template-columns:minmax(0,1fr)}
.mi-warranty{grid-template-columns:minmax(0,1fr)}
.mi-spec{grid-template-columns:minmax(0,1fr);gap:4px}
.mi-g2,.mi-g3{grid-template-columns:minmax(0,1fr);grid-template-rows:none;height:auto}
.mi-g3 .mi-shot:first-child{grid-row:auto}
.mi-g1 .mi-shot,.mi-g2 .mi-shot,.mi-g3 .mi-shot{aspect-ratio:4/3}
.mi-track .mi-shot{width:78%}
.mi-cta-band{padding:64px 0 56px}
.mi-cta-h{font-size:clamp(34px,10.4cqi,48px)}
.mi-cta-actions{flex-direction:column}
.mi-foot{padding-top:56px}
.mi-foot-grid{gap:36px 20px}
.mi-foot-pay{grid-column:1 / -1}
}
`;

// The Before & After band (kit BeforeAfter.jsx) in this design's look: the
// hero's steel gradient and blueprint grid behind it, near-square corners,
// the handle as the square yellow plate of the nav mark, tags set like the
// hero badges, the counter like the service-card numbers next to square
// arrow buttons. Appended after the kit's beforeAfterCss('mi-ba') only while
// the band renders, so a site without copy.beforeAfter gets none of it. The
// --mi-ba-* block variables alias tokens deriveTheme / industrialTokens
// already contrast-repair: the Before tag is the page's text on its
// background, the After tag and the handle the safety-yellow fill with its
// ink; the counter is accent text, readable on the steel like the kickers.
const BA_CSS = `
.mi-ba-band{--mi-ba-text:var(--mi-text);--mi-ba-muted:var(--mi-muted);--mi-ba-line:var(--mi-border-strong);--mi-ba-focus:var(--mi-focus);--mi-ba-tag-bg:var(--mi-bg);--mi-ba-tag-text:var(--mi-text);--mi-ba-tag2-bg:var(--mi-accent);--mi-ba-tag2-text:var(--mi-on-accent);--mi-ba-knob-bg:var(--mi-accent);--mi-ba-knob-text:var(--mi-on-accent);--mi-ba-r:2px;--mi-ba-tag-r:2px;--mi-ba-btn-r:3px;isolation:isolate;background:var(--mi-hero-grad);border-top:1px solid var(--mi-border)}
.mi-ba-band::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:linear-gradient(var(--mi-grid) 1px,transparent 1px),linear-gradient(90deg,var(--mi-grid) 1px,transparent 1px);background-size:56px 56px;background-position:-1px -1px;-webkit-mask-image:linear-gradient(90deg,black 0%,black 40%,transparent 90%);mask-image:linear-gradient(90deg,black 0%,black 40%,transparent 90%)}
.mi-ba-frame{border:1px solid var(--mi-border);box-shadow:0 28px 56px -34px var(--mi-shadow)}
.mi-ba-frame::after{content:'';position:absolute;left:0;right:0;bottom:0;z-index:4;height:4px;background:var(--mi-accent);pointer-events:none}
.mi-ba-todo .mi-ba-frame{border:0;box-shadow:none}
.mi-ba-todo .mi-ba-frame::after{display:none}
.mi-ba-tag{padding:6px 12px;font-size:11.5px;font-weight:800;letter-spacing:.16em}
.mi-ba-knob{border-radius:3px}
.mi-ba-cap{display:flex;align-items:baseline;gap:12px;margin-top:18px;font-size:16px;line-height:1.55}
.mi-ba-cap::before{content:'';flex:none;width:22px;height:3px;border-radius:1px;background:var(--mi-accent);translate:0 -4px}
.mi-ba-nav{justify-content:flex-start;gap:10px;margin-top:28px}
.mi-ba-count{order:-1;margin-right:auto;font-size:13px;font-weight:800;letter-spacing:.16em;text-align:left;color:var(--mi-accent-text)}
.mi-ba-btn{width:48px;height:48px;border-width:2px}
@media (hover:hover){
.mi-ba-btn:hover{border-color:var(--mi-accent);background:var(--mi-accent-soft)}
}
`;

const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);
const strList = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[·,;|]+/) : [])
  .map((x) => (x && typeof x === 'object' ? txt(x.name) : txt(x)))
  .filter(Boolean);

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// Heaviest weight the heading font actually ships, up to `want`, so a
// single-weight face (Bebas Neue, Righteous) is never faux-bolded and a
// variable family gets its real 900.
function headWeight(stack, want) {
  const fam = catalogFamily(familiesFromStack(stack)[0]);
  if (!fam) return want;
  const weights = FONT_CATALOG[fam].weights;
  if (weights.length === 0) return 400;
  return weights.filter((w) => w <= want).pop() || weights[0];
}

// Hours as display rows { days, time, closed }. Only the per-day editor's
// shape (exactly the seven HOURS_DAYS keys, '' = closed) may say a day is
// "Closed"; it is grouped into runs ("Mon–Fri  8am – 6pm"). Older free-text
// hours never gain facts: normalizeBusinessInfo splits "Mon-Fri 8am-6pm ·
// Sat 9am-4pm" into { 'Mon-Fri': '8am-6pm', ... }, shown one row per pair
// when every key is a plain day or day range; anything else ("Mon-Fri:
// 8am-6pm", "By appointment") as the single line formatHours() produces.
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
      return runs.map((r) => ({ days: r.start === r.end ? r.start : `${r.start}–${r.end}`, time: r.time || 'Closed', closed: !r.time }));
    }
    if (keys.length > 0 && keys.every((k) => DAY_SPAN_RE.test(k.trim()) && cleanTime(hours[k]))) {
      return keys.map((k) => ({ days: k.trim(), time: cleanTime(hours[k]), closed: false }));
    }
  }
  const flat = formatHours(hours).trim();
  return flat ? [{ days: flat, time: '', closed: false }] : [];
}

// The stats-bar "Hours" fact must be the whole truth in a few words.
function hoursFact(rows) {
  if (rows.length === 1 && !rows[0].time) return rows[0].days.length <= 40 ? rows[0].days : null;
  const open = rows.filter((r) => r.time && !r.closed);
  return open.length > 0 && open.length <= 2 ? open.map((r) => `${r.days} ${r.time}`).join('\n') : null;
}

// Services: the owner's Services tab (businessInfo.services, mirrored to
// packages by normalizeBusinessInfo) wins, so name / price / delete edits
// show. A service the owner left without a description borrows the AI
// description written for the same name. Without owner edits the AI list
// renders as before, then the plain wizard list.
const svcKey = (s) => txt(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isObj = (s) => Boolean(s) && typeof s === 'object';
function resolveServices(biz, copy) {
  const ai = list(copy.servicesSection?.items)
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }));
  const aiDesc = new Map(ai.filter((s) => s.name && s.description).map((s) => [svcKey(s.name), s.description]));
  // The Services tab shows (and writes) businessInfo.services first, so
  // that list wins over an older packages copy when both hold objects.
  const owner = (list(biz.services).some(isObj) ? list(biz.services) : list(biz.packages)).filter(isObj);
  const raw = owner.length > 0
    ? owner.map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) || aiDesc.get(svcKey(s.name)) || '' }))
    : ai.length > 0
      ? ai
      : list(biz.services).map((s) => ({ name: txt(typeof s === 'string' ? s : s?.name), price: '', description: aiDesc.get(svcKey(typeof s === 'string' ? s : s?.name)) || '' }));
  return { items: raw.filter((s) => s.name || s.description || s.price), fromOwner: owner.length > 0 };
}

// Last word(s) of the headline get the safety-yellow highlight: the final
// word, or the final two when the last one is short ("Done Right").
function splitHeadline(text) {
  const words = txt(text).split(/\s+/).filter(Boolean);
  if (words.length < 3) return [words.join(' '), ''];
  const n = words[words.length - 1].length <= 3 && words.length > 3 ? 2 : 1;
  return [words.slice(0, -n).join(' '), words.slice(-n).join(' ')];
}

// Steel / hazard tokens, all derived from the owner's five colors.
function industrialTokens(t) {
  const ink = t.isDark ? t.bg : t.text;
  const heroInk = t.isDark ? mix(t.bg, '#000000', 0.35) : mix('#000000', '#ffffff', 0.05);
  const footerBg = t.isDark ? mix(t.bg, '#000000', 0.38) : mix(t.surface, t.text, 0.04);
  const ctaText = ensureContrast(t.onAccent, t.accent, 4.5);
  const btnBg = readableOn(t.accent, { light: '#ffffff', dark: mix(t.bg, '#000000', t.isDark ? 0.3 : 0.85) });
  return {
    '--mi-hero-grad': `linear-gradient(160deg, ${t.surface} 0%, ${t.bg} 68%)`,
    '--mi-grid': alpha(t.accent, t.isDark ? 0.06 : 0.09),
    '--mi-hazard': `repeating-linear-gradient(-45deg, ${t.accent} 0 14px, ${ink} 14px 28px)`,
    '--mi-accent-line': alpha(t.accentText, 0.34),
    '--mi-accent-hover': mix(t.accent, t.isDark ? '#ffffff' : '#000000', 0.12),
    '--mi-glow': alpha(t.accent, 0.45),
    '--mi-shadow': alpha('#000000', t.isDark ? 0.7 : 0.22),
    '--mi-hero-hl': ensureContrast(t.accent, heroInk, 4.5),
    '--mi-on-hero-muted': alpha(t.onHero, 0.88),
    '--mi-on-hero-line': alpha(t.onHero, 0.45),
    '--mi-cta-bg': t.accent,
    '--mi-cta-text': ctaText,
    '--mi-cta-muted': ensureContrast(mix(ctaText, t.accent, 0.28), t.accent, 4.5),
    '--mi-cta-line': alpha(ctaText, 0.45),
    '--mi-cta-btn-bg': btnBg,
    '--mi-cta-btn-text': ensureContrast(t.accent, btnBg, 4.5),
    '--mi-footer-bg': footerBg,
    '--mi-footer-text': ensureContrast(t.text, footerBg, 4.5),
    '--mi-footer-muted': ensureContrast(t.textMuted, footerBg, 4.5),
    '--mi-footer-line': alpha(t.text, 0.14),
  };
}

const Icon = ({ d, size = 18, width = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12.2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6.5 12 13l8.5-6.5',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6zM9 12l2 2 4-4',
  badge: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.8 7 21l5-2.5 5 2.5-1.5-7.2',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.3 5.3L3.5 17.5a2.1 2.1 0 0 0 3 3l5.9-5.9a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.4-.6-.6-2.4z',
};

// A 12-tooth gear outline, computed once (pure math, no DOM): the hero,
// contact band and photo fallback all share this motif.
const GEAR_D = (() => {
  const teeth = 12;
  const step = (Math.PI * 2) / teeth;
  const pt = (r, a) => `${(100 + r * Math.cos(a)).toFixed(1)} ${(100 + r * Math.sin(a)).toFixed(1)}`;
  const d = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    d.push(pt(78, a), pt(96, a + step * 0.14), pt(96, a + step * 0.4), pt(78, a + step * 0.54));
  }
  return `M${d.join('L')}Z`;
})();

function Gear() {
  return (
    <div className="mi-gear" aria-hidden="true">
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d={GEAR_D} />
        <circle cx="100" cy="100" r="58" />
        <circle cx="100" cy="100" r="22" />
        <circle cx="100" cy="100" r="68" strokeDasharray="2 6" />
      </svg>
    </div>
  );
}

// Published stand-in for a missing photo: the shop's initials (two, so a
// lone "I" never reads as a stray bar) on the steel blueprint with the gear
// (never an "upload a photo" box).
const SMALL_WORDS = /^(the|and|of|llc|inc|co)$/i;
function initials(name) {
  const words = txt(name).split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
  const main = words.filter((w) => !SMALL_WORDS.test(w));
  const pick = (main.length > 0 ? main : words).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return pick || '•';
}
function Monogram({ name }) {
  const letter = initials(name);
  return (
    <div className="mi-mono" aria-hidden="true">
      <div className="mi-grid-bg" />
      <Gear />
      <span className="mi-mono-letter">{letter}</span>
    </div>
  );
}

function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="mi-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

const fill = { position: 'absolute', inset: 0, height: '100%' };

export default function MechanicIndustrial({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const font = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const fb = getFallbacks(biz.businessType);

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrderAdded(copy, sections.map((s) => s.id), addedSections);

  // Before & After band (Edit > Before & After): only once copy.beforeAfter
  // exists, and on the published page only with a pair that has both
  // photos (the editor shows every pair, and says what each still needs).
  // Heading and intro: the owner's (copy.beforeAfter), else the design's.
  const ba = beforeAfterPairs(copy.beforeAfter, images, { editor });
  const baOn = show('beforeAfter') && Boolean(ba) && (ba.pairs.length > 0 || editor);
  const baTitle = ba?.title || BA_DEFAULTS.title;
  const baIntro = ba?.intro || BA_DEFAULTS.intro;

  const name = txt(biz.businessName);
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const place = [txt(biz.city), txt(biz.state)].filter(Boolean).join(', ');
  const hours = hoursRows(biz.hours);
  const hoursSummary = hoursFact(hours);
  const payments = strList(biz.paymentMethods);
  const awards = strList(biz.awards);
  const certs = strList(biz.certifications);
  const makes = strList(biz.brands);
  const specialties = Array.isArray(biz.specialties) ? strList(biz.specialties).join(', ') : txt(biz.specialties);
  const warrantyOffered = txt(biz.warrantyOffered);
  // warrantyOffered is the mechanic wizard's "Parts & Labor Warranty" field;
  // warranty the generic one. Both entered: the first leads, the second
  // follows as a note (never invented when neither is set).
  const warrantyText = warrantyOffered || txt(biz.warranty);
  const warrantyTitle = warrantyOffered ? 'Parts & labor warranty' : 'Warranty';
  const warrantyMore = warrantyOffered && txt(biz.warranty) !== warrantyOffered ? txt(biz.warranty) : '';
  const email = txt(biz.email);
  const address = txt(biz.address);
  const area = txt(biz.serviceArea);
  // A typo like "-105" or "0" is not a fact worth printing.
  const years = /^\s*(-|0+\s*\+?\s*$)/.test(txt(biz.yearsInBusiness)) ? '' : txt(biz.yearsInBusiness);

  const { items: services, fromOwner } = resolveServices(biz, copy);
  const svcCols = services.length === 1 ? 'mi-c1' : services.length === 2 || services.length === 4 ? 'mi-c2' : 'mi-c3';

  // Stats only from what the owner entered: About > Stats Box values, else
  // business facts. No invented numbers (the old 5K+ / 5★ / 100% are gone).
  const ownerStats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label);
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

  const testimonials = list(copy.testimonialPlaceholders).filter((q) => txt(q?.text));
  const reviews = copy.googleWidgetKey ? 'google' : testimonials.length > 0 ? 'quotes' : null;

  const visitHasInfo = hours.length > 0 || phone || email || address || place || payments.length > 0;
  // One panel alone (often just phone + town) lays out as a wide strip
  // instead of a lonely card stretched across the page.
  const visitPanels = [hours.length > 0 || editor, phone || email || address || place, payments.length > 0].filter(Boolean).length;
  const navLinks = [
    show('services') && services.length > 0 && { href: '#services', label: 'Services' },
    show('cta') && hours.length > 0 && { href: '#hours', label: 'Hours' },
    show('about') && { href: '#about', label: 'About' },
    show('gallery') && galleryImages.length > 0 && { href: '#gallery', label: 'Our Work', extra: true },
    show('testimonials') && reviews && { href: '#reviews', label: 'Reviews', extra: true },
    show('cta') && { href: '#contact', label: 'Contact' },
  ].filter(Boolean);

  const hasServices = show('services') && services.length > 0;
  const heroPrimaryHref = txt(copy.ctaPrimaryUrl) || tel || '#contact';
  const heroPrimaryLabel = txt(copy.ctaPrimary) || 'Schedule Service';
  // Button 2 goes to the owner's URL. Without one, its link follows its
  // label: the AI's usual "Call Us Today" dials (as the editor promises:
  // "default: calls phone"; with no phone it is dropped), "See Our Work",
  // "Read Reviews", "Get a Quote" or "Our Story" jump to that section when
  // it is on the page, and anything else goes to Services as before. With
  // no Services to land on it becomes a call button, labeled as one (a
  // "View Our Services" label would promise a section that isn't there).
  const secondaryUrl = txt(copy.ctaSecondaryUrl);
  const secondaryText = txt(copy.ctaSecondary);
  const digitsOf = (s) => s.replace(/\D/g, '');
  const secondaryCalls = /\b(call|phone|dial)\b/i.test(secondaryText)
    || (digitsOf(phone).length >= 7 && digitsOf(secondaryText) === digitsOf(phone));
  const secondaryAnchor = [
    [/\b(work|gallery|photos?|portfolio|results)\b/i, show('gallery') && galleryImages.length > 0, '#gallery'],
    [/\b(reviews?|testimonials?)\b/i, show('testimonials') && Boolean(reviews), '#reviews'],
    [/\b(contact|quotes?|estimates?|directions|visit|hours)\b/i, show('cta'), '#contact'],
    [/\b(about|story|team)\b/i, show('about'), '#about'],
  ].find(([re, onPage]) => onPage && re.test(secondaryText));
  const heroSecondary = secondaryUrl
    ? { href: secondaryUrl, label: secondaryText || (/^tel:/i.test(secondaryUrl) ? 'Call now' : 'Learn more') }
    : secondaryCalls ? { href: tel, label: secondaryText }
    : secondaryAnchor ? { href: secondaryAnchor[2], label: secondaryText }
    : hasServices ? { href: '#services', label: secondaryText || 'Our Services' }
    : { href: tel, label: phone ? `Call ${phone}` : '' };
  const splitHero = copy.heroLayout === 'split';
  const [headLead, headHl] = splitHeadline(txt(copy.headline) || fb.headline);
  const kicker = [fb.heroBadge, place].filter(Boolean).join(' · ');

  const vars = {
    '--mi-bg': t.bg,
    '--mi-surface': t.surface,
    '--mi-text': t.text,
    '--mi-muted': t.textMuted,
    '--mi-accent': t.accent,
    '--mi-accent-text': t.accentText,
    '--mi-accent-soft': t.accentSoft,
    '--mi-on-accent': ensureContrast(t.onAccent, t.accent, 4.5),
    '--mi-border': t.border,
    '--mi-border-strong': t.borderStrong,
    '--mi-focus': t.focus,
    '--mi-scrim': t.heroScrim,
    '--mi-scrim-left': t.heroScrimLeft,
    '--mi-on-hero': t.onHero,
    '--mi-head': font,
    '--mi-body': body,
    '--mi-head-w': headWeight(font, 900),
    '--mi-head-w2': headWeight(font, 800),
    '--mi-gutter': 'clamp(20px, 5cqi, 48px)',
    ...industrialTokens(t),
  };

  // Logo if uploaded, else the yellow wrench plate + wordmark.
  const brand = (logoStyle, loading, sub) => (images.logo ? (
    <PhotoSlot src={images.logo} alt={name ? `${name} logo` : 'Logo'} loading={loading} style={logoStyle} imgStyle={{ objectFit: 'contain' }} />
  ) : (
    <>
      <span className="mi-mark" aria-hidden="true"><Icon d={ICONS.wrench} size={20} width={2} /></span>
      <span className="mi-brand-text">
        <span className="mi-wordmark">{name || fb.shopName}</span>
        {sub && <span className="mi-brand-sub">{sub}</span>}
      </span>
    </>
  ));
  const navSub = [fb.navSubtitle, place].filter(Boolean).join(' · ');

  const heroText = (
    <>
      <p className="mi-kicker">{kicker}</p>
      <h1 className="mi-h1">
        {headLead}
        {headHl && <>{' '}<span className="mi-hl">{headHl}</span></>}
      </h1>
      {(txt(copy.subheadline) || txt(biz.tagline) || fb.subheadline) && (
        <p className="mi-lead">{txt(copy.subheadline) || txt(biz.tagline) || fb.subheadline}</p>
      )}
      <div className="mi-actions">
        {/* "Schedule Service" opens the booking widget when booking is on
            (else it calls, as before); an owner URL is left alone. */}
        <a className="mi-btn mi-btn-accent" href={heroPrimaryHref} {...(txt(copy.ctaPrimaryUrl) ? {} : { 'data-scheduler-trigger': '' })}>{heroPrimaryLabel}</a>
        {heroSecondary.href && heroSecondary.label && (
          <a className="mi-btn mi-btn-line" href={heroSecondary.href}>
            {/^tel:/i.test(heroSecondary.href) && <Icon d={ICONS.phone} size={17} width={2} />}
            {heroSecondary.label}
          </a>
        )}
      </div>
      {certs.length > 0 && (
        <ul className="mi-badges" aria-label="Certifications">
          {certs.map((c, i) => <li key={`${c}-${i}`} className="mi-badge"><Icon d={ICONS.badge} size={15} width={2} />{c}</li>)}
        </ul>
      )}
    </>
  );

  // The AI writes "paragraphs separated by newlines", often single ones, so
  // every line break starts a paragraph (the first one is set as a lead).
  // Without AI copy the section still says what the shop is (the business
  // type, never a claim), like the old "Serving <city> with ..." line.
  const aboutFallback = name
    ? `${name} offers ${fb.aboutFallback}${place ? ` in ${place}` : ''}.`
    : txt(biz.city) ? `Serving ${txt(biz.city)} with ${fb.aboutFallback}.` : '';
  const aboutParas = (txt(copy.aboutText) || aboutFallback)
    .split(/\n+/).map((p) => p.trim()).filter(Boolean);
  // Facts already on screen elsewhere (hero badges, the stats bar) are not
  // repeated. The warranty box lives in Services; when that section is
  // hidden or empty the owner's warranty still shows here instead.
  const heroShowsCerts = show('hero') && certs.length > 0;
  const barShowsArea = show('statsBar') && Boolean(barFacts) && Boolean(area);
  const aboutSpecs = [
    specialties && { label: 'Specialties', value: specialties },
    makes.length > 0 && { label: 'Brands we service', value: makes.join(', ') },
    certs.length > 0 && !heroShowsCerts && { label: 'Certifications', value: certs.join(' · ') },
    area && !barShowsArea && { label: 'Service area', value: area },
    warrantyText && !hasServices && { label: warrantyTitle, value: [warrantyText, warrantyMore].filter(Boolean).join(' · ') },
  ].filter(Boolean);
  // A long story top-aligns next to a sticky photo (instead of the photo
  // floating mid-column); a short one stays vertically centered.
  const aboutLong = aboutParas.join(' ').length + aboutSpecs.length * 90 > 640;
  // The About side shows the owner's photo or stats box, never a monogram
  // stand-in (the split hero already uses it; twice reads as placeholder).
  const aboutMedia = aboutShowsStats || Boolean(images.about);
  const aboutHead = (
    <>
      <p className="mi-kicker">Our Shop</p>
      <h2 id="mi-about-h" className="mi-h2">{name ? `About ${name}` : 'About Us'}</h2>
    </>
  );
  const aboutBody = (
    <>
      {aboutParas.length > 0 && (
        <div className="mi-prose">
          {aboutParas.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
      {aboutSpecs.length > 0 && (
        <dl className="mi-specs">
          {aboutSpecs.map((f) => (
            <div key={f.label} className="mi-spec">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );

  // Contact band: the Contact editor's primary button (ctaButtonText /
  // ctaUrl, else the booking trigger on the phone link) and its "Phone /
  // Secondary Button" (ctaSecondaryText / ctaSecondaryUrl, default tel:).
  const contactPrimaryLabel = txt(copy.ctaButtonText) || txt(copy.ctaPrimary) || phone || 'Call now';
  const contactPrimaryHref = txt(copy.ctaUrl) || tel;
  const contactSecondaryHref = txt(copy.ctaSecondaryUrl) || tel;
  const contactSecondaryLabel = txt(copy.ctaSecondaryText)
    || (contactSecondaryHref === tel ? `Call ${phone}` : txt(copy.ctaSecondary) || 'Learn more');
  const showContactSecondary = Boolean(contactSecondaryHref)
    && (contactSecondaryHref !== contactPrimaryHref || Boolean(txt(copy.ctaSecondaryText)));
  // Without a second button, a plain "or call" line keeps the number one
  // tap away when the main button opens booking or carries other text.
  const showCallNote = !showContactSecondary && tel && contactPrimaryHref && contactPrimaryLabel !== phone;
  const ctaSub = txt(copy.ctaSubtext) || (place ? `Serving ${place} and surrounding areas.` : area ? `Service area: ${area}.` : '');
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, place].filter(Boolean).join(', '))}`
    : null;

  // Footer columns: the payment chips only when the Contact section (which
  // already lists them just above) is hidden; no empty "Contact" heading.
  const footContact = Boolean(phone || email || address || place);
  const footPayments = payments.length > 0 && !show('cta');
  const footCols = 1 + (navLinks.length > 0 ? 1 : 0) + (footContact ? 1 : 0) + (footPayments ? 1 : 0);

  return (
    <div
      id="top"
      className="mi-root"
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.6 }}
    >
      <style>{CSS + (baOn ? beforeAfterCss('mi-ba') + BA_CSS : '')}</style>
      <a className="mi-skip" href="#main">Skip to content</a>

      <nav className="mi-nav" aria-label="Main" style={{ order: -1 }}>
        <div className="mi-wrap mi-nav-in">
          <a className="mi-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
            {brand({ height: 42, width: 'auto', maxWidth: 190 }, 'eager', navSub)}
          </a>
          {(navLinks.length > 0 || tel) && (
            <div className="mi-links">
              {navLinks.map((l) => (
                <a key={l.href} className={`mi-link${l.extra ? ' mi-link-x' : ''}`} href={l.href}>{l.label}</a>
              ))}
              {tel && (
                <a className="mi-btn mi-btn-accent mi-btn-sm mi-nav-cta" href={tel}>
                  <Icon d={ICONS.phone} size={16} width={2} />{phone}
                </a>
              )}
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
        {!show('hero') && <h1 className="mi-sr">{name}</h1>}

        {show('hero') && !splitHero && (
          <header data-section="hero" className={`mi-hero${images.hero ? ' mi-has-media' : ''}`} style={{ order: order('hero') }}>
            {images.hero ? (
              <>
                <div className="mi-hero-media">
                  <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
                </div>
                <div className="mi-hero-scrim" />
              </>
            ) : (
              <>
                <div className="mi-grid-bg" />
                <div className="mi-hair" />
                <Gear />
              </>
            )}
            <div className="mi-bar" />
            <div className="mi-wrap">
              <div className="mi-hero-body">
                {heroText}
                {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
              </div>
            </div>
            <div className="mi-hazard" aria-hidden="true" />
          </header>
        )}

        {show('hero') && splitHero && (
          // Published without a hero photo, the monogram stand-in is dropped
          // on phones (it would push the facts a full screen down).
          <header data-section="hero" className={`mi-split${!images.hero && !editor ? ' mi-split-bare' : ''}`} style={{ order: order('hero') }}>
            <div className="mi-split-text">
              <div className="mi-grid-bg" />
              <div className="mi-bar" />
              {heroText}
            </div>
            <div className="mi-split-photo">
              <PhotoSlot src={images.hero} slot="hero" alt="" loading="eager" fetchPriority="high" style={fill} fallback={<Monogram name={name} />} />
            </div>
          </header>
        )}

        {show('statsBar') && (barItems.length > 0 || editor) && (
          <section data-section="statsBar" className="mi-facts" aria-label="At a glance" style={{ order: order('statsBar') }}>
            <div className="mi-wrap">
              {barItems.length > 0 ? (
                <dl className={`mi-facts-grid mi-n${barItems.length}${barStats ? ' mi-stats-kind' : ''}`}>
                  {barItems.map((f, i) => (
                    <div key={`${f.label}-${i}`} className={`mi-fact${barStats ? ' mi-stat' : ''}`} data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <dt className="mi-label">{f.label}</dt>
                      <dd className={barStats ? 'mi-stat-value' : 'mi-fact-value'}>{f.value}</dd>
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

        {show('services') && services.length > 0 && (
          <section data-section="services" id="services" className="mi-section" aria-labelledby="mi-services-h" style={{ order: order('services') }}>
            <ServiceCardCss />
            <div className="mi-wrap">
              <div className={`mi-head${txt(copy.servicesSection?.intro) ? '' : ' mi-head-solo'}`} data-acg-reveal="">
                <div>
                  <p className="mi-kicker">Services</p>
                  <h2 id="mi-services-h" className="mi-h2">{txt(copy.servicesSection?.title) || 'Our Services'}</h2>
                </div>
                {txt(copy.servicesSection?.intro) && <p className="mi-intro">{copy.servicesSection.intro}</p>}
              </div>
              <div className={`mi-grid ${svcCols}`}>
                {services.map((s, i) => (
                  <div key={`${s.name}-${i}`} className="mi-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <article className="acg-svc-card mi-card">
                      <div className="mi-card-top">
                        <span className="mi-idx"><Icon d={ICONS.wrench} size={15} width={2} />{String(i + 1).padStart(2, '0')}</span>
                        {s.price && <span className="mi-price">{s.price}</span>}
                      </div>
                      {s.name && <h3 className="mi-card-title">{s.name}</h3>}
                      <ServiceDescription
                        id={`svc-more-${fromOwner ? 'pkg' : 'ai'}-${i}`}
                        text={s.description}
                        style={{ marginTop: 12, color: t.textMuted, fontSize: 15.5, lineHeight: 1.7 }}
                        accentColor={t.accentText}
                      />
                      <div className="acg-svc-foot">
                        <div className="mi-foot-line">
                          <BookNowLink serviceName={s.name} phone={phone} label={<>Book service <Icon d={ICONS.arrow} size={16} width={2} /></>} />
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
              {warrantyText && (
                <div className="mi-warranty" data-acg-reveal="">
                  <span className="mi-warranty-icon" aria-hidden="true"><Icon d={ICONS.shield} size={30} width={1.8} /></span>
                  <div>
                    <p className="mi-label">{warrantyTitle}</p>
                    <p className="mi-warranty-text">{warrantyText}</p>
                    {warrantyMore && <p className="mi-warranty-more">{warrantyMore}</p>}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {show('about') && (
          <section data-section="about" id="about" className="mi-section mi-alt" aria-labelledby="mi-about-h" style={{ order: order('about') }}>
            {aboutMedia ? (
              <div className={`mi-wrap mi-about${aboutLong ? ' mi-about-long' : ''}`}>
                <div className="mi-about-side" data-acg-reveal="">
                  {aboutShowsStats ? (
                    <dl className="mi-statpanel">
                      {ownerStats.slice(0, 4).map((s, i) => (
                        <div key={`${s.label}-${i}`}>
                          <dt className="mi-label" style={{ marginTop: 12 }}>{s.label}</dt>
                          <dd className="mi-stat-value">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <div className="mi-frame">
                      <div className="mi-media">
                        <PhotoSlot src={images.about} alt={name ? `${name} shop` : 'Our shop'} style={fill} />
                      </div>
                    </div>
                  )}
                  {aboutStatsMode && ownerStats.length === 0 && (
                    <EditorHint>Add your stats in Edit &gt; About &gt; Stats Box (the photo shows until then).</EditorHint>
                  )}
                </div>
                <div data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                  {aboutHead}
                  <div style={{ marginTop: 28 }}>{aboutBody}</div>
                </div>
              </div>
            ) : (
              // No photo (or stats) to show: heading left, story right, like
              // the section heads, instead of a big monogram stand-in that
              // would repeat the split hero's or pad out a two-line story.
              <div className={`mi-wrap mi-about mi-about-solo${aboutLong ? ' mi-about-long' : ''}`}>
                <div className="mi-about-side" data-acg-reveal="">
                  {aboutHead}
                </div>
                <div className="mi-about-copy" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                  {aboutBody}
                  <EditorHint>
                    {aboutStatsMode ? 'Add your stats in Edit > About > Stats Box, or a photo in Edit > About > About Photo.' : PHOTO_HINTS.about}
                  </EditorHint>
                </div>
              </div>
            )}
          </section>
        )}

        {show('gallery') && (galleryImages.length > 0 || editor) && (
          <section data-section="gallery" id="gallery" className="mi-section" aria-labelledby="mi-gallery-h" style={{ order: order('gallery') }}>
            <div className="mi-wrap">
              <div className="mi-head mi-head-solo" data-acg-reveal="">
                <div>
                  <p className="mi-kicker">Gallery</p>
                  <h2 id="mi-gallery-h" className="mi-h2">Our Work</h2>
                </div>
              </div>
              {galleryImages.length === 0 ? (
                <PhotoSlot slot="gallery" style={{ minHeight: 220, borderRadius: 3 }} />
              ) : galleryImages.length > 3 ? (
                <>
                  <div className="mi-track" role="region" aria-label="Photo gallery, scroll sideways for more" tabIndex={0}>
                    {galleryImages.map((src, i) => (
                      <figure key={i} className="mi-shot">
                        <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      </figure>
                    ))}
                  </div>
                  <p className="mi-swipe" aria-hidden="true">Swipe or scroll for more →</p>
                </>
              ) : (
                <div className={`mi-gal mi-g${galleryImages.length}`}>
                  {galleryImages.map((src, i) => (
                    <figure key={i} className="mi-shot" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {baOn && (
          <BeforeAfterBand
            ns="mi-ba"
            beforeAfter={copy.beforeAfter}
            images={images}
            editor={editor}
            order={order('beforeAfter')}
            className="mi-section"
            wrapClassName="mi-wrap"
            labelledBy="mi-ba-h"
            heading={(
              <div className={`mi-head${baIntro ? '' : ' mi-head-solo'}`} data-acg-reveal="">
                <div>
                  <p className="mi-kicker">{BA_DEFAULTS.eyebrow}</p>
                  <h2 id="mi-ba-h" className="mi-h2">{baTitle}</h2>
                </div>
                {baIntro && <p className="mi-intro">{baIntro}</p>}
              </div>
            )}
            hints={ba.pairs.length === 0 && <EditorHint>{'Add a before and an after photo in Edit > Before & After.'}</EditorHint>}
          />
        )}

        {show('testimonials') && reviews === 'google' && (
          <section data-section="testimonials" id="reviews" className="mi-section mi-alt" aria-label={txt(copy.googleReviewsTitle) || 'Reviews'} style={{ order: order('testimonials') }}>
            <div className="mi-wrap">
              {txt(copy.googleReviewsTitle) && (
                <div className="mi-head mi-head-solo">
                  <div>
                    <p className="mi-kicker">Reviews</p>
                    <h2 className="mi-h2">{copy.googleReviewsTitle}</h2>
                  </div>
                </div>
              )}
              <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'quotes' && (
          <section data-section="testimonials" id="reviews" className="mi-section mi-alt" aria-labelledby="mi-reviews-h" style={{ order: order('testimonials') }}>
            <div className="mi-wrap">
              <div className="mi-head mi-head-solo" data-acg-reveal="">
                <div>
                  <p className="mi-kicker">Reviews</p>
                  <h2 id="mi-reviews-h" className="mi-h2">What Customers Say</h2>
                </div>
              </div>
              <div className={`mi-grid ${testimonials.length === 1 ? 'mi-c1' : testimonials.length === 2 || testimonials.length === 4 ? 'mi-c2' : 'mi-c3'}`} style={{ gap: 'clamp(14px, 1.6cqi, 22px)' }}>
                {testimonials.map((q, i) => (
                  <div key={i} className="mi-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <figure className="mi-quote">
                      <svg className="mi-quote-mark" width="30" height="23" viewBox="0 0 34 26" fill="currentColor" aria-hidden="true">
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
          <section data-section="cta" id="contact" className={`mi-section mi-contact${visitHasInfo || editor ? '' : ' mi-contact-solo'}`} aria-labelledby="mi-contact-h" style={{ order: order('cta') }}>
            <div className="mi-cta-band">
              <Gear />
              <div className="mi-wrap mi-cta-in">
                <div data-acg-reveal="">
                  <p className="mi-cta-kicker">Contact</p>
                  <h2 id="mi-contact-h" className="mi-cta-h">{txt(copy.ctaHeadline) || fb.ctaHeadline}</h2>
                  {ctaSub && <p className="mi-cta-sub">{ctaSub}</p>}
                </div>
                <div className="mi-cta-actions" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                  {contactPrimaryHref && (
                    <a
                      className="mi-btn mi-btn-dark"
                      href={contactPrimaryHref}
                      {...(txt(copy.ctaUrl) ? {} : { 'data-scheduler-trigger': '' })}
                    >
                      {contactPrimaryLabel === phone && <Icon d={ICONS.phone} size={18} width={2} />}
                      {contactPrimaryLabel}
                    </a>
                  )}
                  {showContactSecondary && (
                    <a className="mi-btn mi-btn-ghost-dark" href={contactSecondaryHref}>{contactSecondaryLabel}</a>
                  )}
                  {showCallNote && (
                    <p className="mi-cta-note">Or call <a href={tel}>{phone}</a></p>
                  )}
                </div>
              </div>
            </div>

            {(visitHasInfo || editor) && (
              <div className="mi-wrap">
                <div className={`mi-visit${visitPanels === 1 ? ' mi-visit-solo' : ''}`}>
                  {hours.length > 0 ? (
                    <div id="hours" className="mi-panel" data-acg-reveal="">
                      <h3 className="mi-panel-h"><Icon d={ICONS.clock} size={22} />Shop Hours</h3>
                      {hours.length === 1 && !hours[0].time ? (
                        <p className="mi-hours-flat">{hours[0].days}</p>
                      ) : (
                        <dl className="mi-hours">
                          {hours.map((h) => (
                            <div key={h.days} className={`mi-hrow${h.closed ? ' mi-closed' : ''}`}>
                              <dt>{h.days}</dt>
                              <dd>{h.time}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  ) : editor ? (
                    <div className="mi-panel">
                      <h3 className="mi-panel-h"><Icon d={ICONS.clock} size={22} />Shop Hours</h3>
                      <EditorHint>Your shop hours show here once you add them in Edit &gt; Business Info &gt; Business Hours.</EditorHint>
                    </div>
                  ) : null}

                  {(phone || email || address || place) && (
                    <div className="mi-panel" data-acg-reveal="" style={{ '--acg-delay': '90ms' }}>
                      <h3 className="mi-panel-h"><Icon d={ICONS.pin} size={22} />Visit the Shop</h3>
                      <ul className="mi-rows">
                        {phone && (
                          <li className="mi-row">
                            <span className="mi-row-icon"><Icon d={ICONS.phone} /></span>
                            <span className="mi-row-body">
                              <span className="mi-label">Phone</span>
                              <span className="mi-row-value">{tel ? <a href={tel}>{phone}</a> : phone}</span>
                            </span>
                          </li>
                        )}
                        {email && (
                          <li className="mi-row">
                            <span className="mi-row-icon"><Icon d={ICONS.mail} /></span>
                            <span className="mi-row-body">
                              <span className="mi-label">Email</span>
                              <span className="mi-row-value"><a href={`mailto:${email}`}>{email}</a></span>
                            </span>
                          </li>
                        )}
                        {(address || place) && (
                          <li className="mi-row">
                            <span className="mi-row-icon"><Icon d={ICONS.pin} /></span>
                            <span className="mi-row-body">
                              <span className="mi-label">{address ? 'Address' : 'Based in'}</span>
                              <span className="mi-row-value">
                                {address ? <a href={mapsHref} target="_blank" rel="noopener noreferrer">{[address, place].filter(Boolean).join(', ')}</a> : place}
                              </span>
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {payments.length > 0 && (
                    <div className="mi-panel" data-acg-reveal="" style={{ '--acg-delay': '180ms' }}>
                      <h3 className="mi-panel-h"><Icon d={ICONS.card} size={22} />We Accept</h3>
                      <div className="mi-chips">
                        {payments.map((p) => <span key={p} className="mi-chip">{p}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {show('awards') && (awards.length > 0 || editor) && (
          <section data-section="awards" className="mi-awards" aria-label="Awards and recognition" style={{ order: order('awards') }}>
            <div className="mi-wrap">
              {awards.length > 0 ? (
                <div className="mi-awards-in" data-acg-awards="" data-acg-reveal="fade">
                  <p className="mi-kicker">Recognition</p>
                  <ul className="mi-award-list">
                    {awards.map((a, i) => (
                      <li key={`${a}-${i}`} className="mi-award"><Icon d={ICONS.award} size={22} />{a}</li>
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

      <footer className="mi-foot" style={{ order: 9999 }}>
        <div className="mi-wrap">
          <div className={`mi-foot-grid mi-fc${footCols}`}>
            <div className="mi-foot-brand">
              <a className="mi-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
                {brand({ height: 48, width: 'auto', maxWidth: 200 }, undefined, fb.navSubtitle)}
              </a>
              {(txt(copy.footerTagline) || txt(biz.tagline)) && <p className="mi-foot-tag">{txt(copy.footerTagline) || txt(biz.tagline)}</p>}
              <div className="mi-social">
                <SocialRow biz={biz} color={t.accentText} size={18} gap={10} images={images} />
              </div>
            </div>
            {navLinks.length > 0 && (
              <div>
                <p className="mi-foot-h">Explore</p>
                <ul className="mi-foot-list">
                  {navLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
            )}
            {footContact && (
              <div>
                <p className="mi-foot-h">Contact</p>
                <ul className="mi-foot-list">
                  {phone && <li>{tel ? <a href={tel}>{phone}</a> : phone}</li>}
                  {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                  {address && <li>{address}</li>}
                  {place && <li>{place}</li>}
                </ul>
              </div>
            )}
            {footPayments && (
              <div className="mi-foot-pay">
                <p className="mi-foot-h">We Accept</p>
                <div className="mi-chips">
                  {payments.map((p) => <span key={p} className="mi-chip">{p}</span>)}
                </div>
              </div>
            )}
          </div>
          <div className="mi-foot-bottom">
            <p>© <span data-acg-year="">{new Date().getFullYear()}</span> {name}{place ? ` · ${place}` : ''}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref="#contact" colors={t} font={body} />
    </div>
  );
}
