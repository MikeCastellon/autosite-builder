// Bubble Rush (carwash_bubble): bright, playful soap-and-sky car wash.
// Theme-ready (see CLAUDE.md, "Template contract"); built like
// mobile/MobileChrome.jsx:
//   - every color is a deriveTheme() token exposed as a --cb-* variable. The
//     soap-film "iridescence" (sky, mint, lavender, pink in the default
//     palette) is the owner's accent turned round the color wheel, so a
//     custom accent brings its own bubble colors instead of fixed teal and
//     lavender;
//   - all CSS lives in the one prefixed <style> below: @container layout,
//     hover inside (hover:hover), every animation inside
//     prefers-reduced-motion: no-preference;
//   - no useState/useEffect: the nav is opaque by default and only turns to
//     glass from html[data-acg-scrolled] (siteRuntime.js);
//   - facts (hero badges, stats, awards, hours) render only when the owner
//     entered them; editor hints go through PhotoSlot / EditorOnly.
// Restored from WebsiteMockups/bubble-rush-carwash.html: the outline +
// gradient "foam" headline, soap-gradient hero with foam blobs, bubbles and
// falling drops, the wave divider, the soap marquee (now the owner's own
// services, nested in the Packages section so it moves and hides with it),
// perk-list pricing cards with a featured middle tier, numbered step
// bubbles, the big iridescent bubble, and the contact section.
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import IconOrEmoji from '../IconOrEmoji.jsx';
import { ServiceCardCss, ServiceDescription, BookNowLink } from '../ServiceCardParts.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS } from '../../../../lib/businessHours.js';
import { FONT_CATALOG, catalogFamily, familiesFromStack } from '../../../../lib/fontCatalog.js';
import { deriveTheme, mix, alpha, ensureContrast, contrastRatio, hexToRgb, rgbToHex } from '../kit/theme.js';
import { PhotoSlot, PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';

export const themeReady = true;

// Same ids and order as ContentEditor's TOGGLEABLE.carwash_bubble, so the
// editor's Sections list matches what renders. Never rename an id.
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'services', label: 'Packages' },
  { id: 'process', label: 'How It Works' },
  { id: 'about', label: 'About & Features' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'cta', label: 'Contact / CTA' },
];

export const extraFonts = [];

const CSS = `
.cb-root :where(h1,h2,h3,h4,p,ul,ol,dl,dd,figure,blockquote){margin:0}
.cb-root :where(ul,ol){list-style:none;padding:0}
.cb-wrap{position:relative;width:100%;max-width:1180px;margin:0 auto;padding-left:var(--cb-gutter);padding-right:var(--cb-gutter)}
.cb-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.cb-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 20px;border-radius:999px;background:var(--cb-btn-bg);color:var(--cb-btn-text);font-weight:800;text-decoration:none}
.cb-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.cb-root a:focus-visible,.cb-root summary:focus-visible,.cb-root label:focus-visible,.cb-track:focus-visible{outline:3px solid var(--cb-focus);outline-offset:3px}
.cb-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin:20px auto 0;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:10px;font-family:var(--cb-body);font-size:13px;font-weight:600;line-height:1.45;letter-spacing:0;text-transform:none;text-shadow:none;color:inherit;opacity:.85}

.cb-eyebrow{display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:7px 18px;border-radius:999px;background:var(--cb-chip-bg);border:1.5px solid var(--cb-border);font-size:11.5px;font-weight:800;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;color:var(--cb-chip-text)}
.cb-eyebrow svg{flex:none}
.cb-h2{margin-top:18px;font-family:var(--cb-head);font-size:clamp(34px,4.6cqi,58px);font-weight:var(--cb-head-w);line-height:1.06;letter-spacing:-.01em;color:var(--cb-text);text-wrap:balance}
.cb-sub{margin-top:16px;max-width:560px;font-size:17px;font-weight:600;line-height:1.65;color:var(--cb-muted);text-wrap:pretty}
.cb-head{margin-bottom:clamp(44px,6cqi,72px)}
.cb-center{text-align:center}
.cb-center .cb-sub{margin-left:auto;margin-right:auto}
.cb-grad,.cb-amt,.cb-name,.cb-quote-mark,.cb-badge dd,.cb-stat dd{color:var(--cb-accent-text)}
.cb-foam{color:var(--cb-accent-text)}
@supports ((-webkit-background-clip:text) or (background-clip:text)){
.cb-grad,.cb-foam,.cb-amt,.cb-name,.cb-quote-mark,.cb-badge dd,.cb-stat dd{-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.cb-grad,.cb-amt,.cb-quote-mark,.cb-badge dd,.cb-stat dd{background-image:var(--cb-grad-text)}
.cb-name{background-image:var(--cb-grad-strong)}
.cb-foam{background-image:var(--cb-foam-text);background-size:200% 100%}
.cb-has-media .cb-foam{background-image:var(--cb-foam-hero)}
.cb-has-media .cb-badge dd{background-image:none;-webkit-text-fill-color:currentColor}
.cb-band .cb-grad,.cb-featured .cb-amt,.cb-foot .cb-name{background-image:var(--cb-ink-grad)}
}

.cb-nav{position:sticky;top:0;z-index:100;background:var(--cb-panel);border-bottom:1.5px solid var(--cb-border)}
html[data-acg-scrolled] .cb-nav{box-shadow:0 8px 30px -14px var(--cb-shadow-strong)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){html[data-acg-scrolled] .cb-nav{background:var(--cb-nav-glass);-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%)}}
.cb-nav-in{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:72px}
.cb-brand{flex:0 1 auto;display:inline-flex;align-items:center;gap:12px;min-width:0;color:var(--cb-text);text-decoration:none}
.cb-orb{position:relative;flex:none;width:40px;height:40px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 2.5px var(--cb-orb-ring),0 4px 16px -2px var(--cb-shadow)}
.cb-orb::before{content:'';position:absolute;inset:0;border-radius:50%;background:var(--cb-iri)}
.cb-orb::after{content:'';position:absolute;top:17%;left:21%;width:28%;height:19%;border-radius:50%;background:rgba(255,255,255,.75);transform:rotate(-30deg)}
.cb-brand-txt{display:block;min-width:0}
.cb-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--cb-head);font-size:20px;font-weight:var(--cb-head-w);line-height:1.2}
/* The nav name takes up to two lines (three for a very long one), a size
   smaller as it grows, instead of one line cut off with an ellipsis. */
.cb-nav .cb-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;overflow-wrap:anywhere;line-height:1.12;text-wrap:balance}
.cb-nav-long .cb-name{font-size:17px}
.cb-nav-xl .cb-name{font-size:15px;-webkit-line-clamp:3}
.cb-tag{display:block;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9.5px;font-weight:800;line-height:1.3;letter-spacing:.24em;text-transform:uppercase;color:var(--cb-muted)}
.cb-links{flex:none;display:flex;align-items:center;gap:2px}
.cb-link{padding:9px 15px;border-radius:999px;font-size:14px;font-weight:700;color:var(--cb-text);text-decoration:none}
.cb-nav-cta{margin-left:12px}

.cb-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 32px;border:2px solid transparent;border-radius:999px;font-family:var(--cb-body);font-size:16px;font-weight:800;line-height:1.2;letter-spacing:.01em;text-align:center;text-decoration:none;cursor:pointer}
.cb-btn:active{transform:translateY(1px)}
.cb-btn svg{flex:none}
.cb-btn-soap{color:var(--cb-btn-text);background-color:var(--cb-btn-bg);background-image:var(--cb-btn);box-shadow:0 10px 28px -10px var(--cb-glow),inset 0 1px 0 rgba(255,255,255,.25)}
.cb-btn-outline{color:var(--cb-glass-text);background:var(--cb-glass);border-color:var(--cb-border-strong);box-shadow:0 4px 18px -8px var(--cb-shadow)}
.cb-btn-sm{min-height:44px;padding:0 22px;font-size:14px}

.cb-hero{position:relative;isolation:isolate;display:flex;align-items:center;min-height:clamp(640px,calc(100vh - 72px),940px);padding:clamp(64px,8cqi,104px) 0 clamp(120px,12cqi,168px);overflow:clip;background:var(--cb-bg);color:var(--cb-text);text-align:center}
.cb-hero-bg{position:absolute;inset:0;z-index:-4;background:var(--cb-hero-bg)}
.cb-hero-media{position:absolute;inset:0;z-index:-4}
.cb-hero-scrim{position:absolute;inset:0;z-index:-3;background:var(--cb-scrim)}
.cb-blob{position:absolute;z-index:-3;border-radius:60% 40% 55% 45%/50% 60% 40% 55%;background:var(--cb-blob);filter:blur(40px);pointer-events:none}
.cb-blob-1{top:-100px;left:-100px;width:500px;height:400px}
.cb-blob-2{right:-80px;bottom:-80px;width:350px;height:320px}
.cb-blob-3{top:40%;right:5%;width:260px;height:240px}
.cb-drop{position:absolute;top:-40px;z-index:-2;width:9px;height:14px;border-radius:50% 50% 55% 45%/60% 60% 40% 40%;background:var(--cb-drop);border:1.5px solid rgba(255,255,255,.7);opacity:0;pointer-events:none}
.cb-bub{position:absolute;z-index:-2;border-radius:50%;background:var(--cb-bubble);border:1.5px solid var(--cb-bubble-edge);box-shadow:inset 0 0 14px rgba(255,255,255,.45);pointer-events:none}
.cb-hero-in{position:relative}
.cb-hero-body{position:relative;max-width:900px;margin:0 auto}
.cb-pill{display:inline-flex;align-items:center;gap:10px;max-width:100%;padding:8px 20px;border-radius:999px;background:var(--cb-glass);border:1.5px solid var(--cb-border);box-shadow:0 2px 14px -6px var(--cb-shadow);font-size:13px;font-weight:800;line-height:1.4;letter-spacing:.02em;color:var(--cb-glass-text)}
.cb-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--cb-btn)}
.cb-ghost{display:block;margin-top:24px;overflow:hidden;font-family:var(--cb-head);font-size:min(clamp(54px,10cqi,128px),calc(min(100cqi - 2 * var(--cb-gutter),900px) / (var(--cb-ghost-n,12) * .68)));font-weight:var(--cb-head-w);line-height:.95;letter-spacing:-.01em;text-transform:uppercase;white-space:nowrap;color:transparent;-webkit-text-stroke:2.5px var(--cb-stroke);opacity:.2;user-select:none;pointer-events:none}
.cb-h1{margin-top:22px;font-family:var(--cb-head);font-size:clamp(46px,7cqi,96px);font-weight:var(--cb-head-w);line-height:1;letter-spacing:-.015em;color:inherit;text-wrap:balance}
.cb-ghost+.cb-h1{margin-top:-.12em}
.cb-h1-long{font-size:clamp(38px,5.2cqi,72px);line-height:1.05}
.cb-h1-sub{display:block;margin-top:.14em;font-size:.46em;line-height:1.1}
.cb-lead{margin:26px auto 0;max-width:580px;font-size:clamp(17px,1.6cqi,20px);font-weight:600;line-height:1.65;color:var(--cb-muted);text-wrap:pretty}
.cb-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:40px}
.cb-badges{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:clamp(40px,5cqi,56px)}
.cb-badge{display:flex;flex-direction:column-reverse;align-items:center;justify-content:flex-end;gap:6px;min-width:128px;padding:14px 22px;border-radius:18px;background:var(--cb-glass);border:1.5px solid var(--cb-glass-edge);box-shadow:0 8px 24px -14px var(--cb-shadow)}
.cb-badge dt{font-size:11px;font-weight:800;line-height:1.3;letter-spacing:.12em;text-transform:uppercase;color:var(--cb-muted)}
.cb-badge dd{font-family:var(--cb-head);font-size:24px;font-weight:var(--cb-head-w);line-height:1.15;white-space:pre-line}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){.cb-pill,.cb-badge,.cb-btn-outline,.cb-step,.cb-quote{-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}}
.cb-has-media{color:var(--cb-on-hero);text-shadow:0 2px 24px rgba(0,0,0,.35)}
.cb-has-media .cb-lead{color:var(--cb-on-hero-muted)}
.cb-has-media .cb-pill,.cb-has-media .cb-badge{background:rgba(0,0,0,.34);border-color:var(--cb-on-hero-line);color:var(--cb-on-hero);box-shadow:none}
.cb-has-media .cb-badge dt{color:var(--cb-on-hero-muted)}
.cb-has-media .cb-badge dd{color:var(--cb-on-hero)}
.cb-has-media .cb-btn-outline{color:var(--cb-on-hero);background:rgba(0,0,0,.24);border-color:var(--cb-on-hero-line);box-shadow:none}
.cb-has-media .cb-ghost{-webkit-text-stroke-color:rgba(255,255,255,.9);opacity:.3}
.cb-has-media .cb-blob{display:none}
.cb-wave{position:absolute;left:0;right:0;bottom:-1px;z-index:1;display:block;width:100%;height:clamp(44px,6cqi,90px);pointer-events:none}
.cb-wave path{fill:var(--cb-panel)}
.cb-wave-bg path{fill:var(--cb-bg)}

.cb-split{position:relative;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);min-height:clamp(560px,calc(100vh - 72px),860px);background:var(--cb-bg);color:var(--cb-text)}
.cb-split-text{position:relative;isolation:isolate;overflow:clip;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;text-align:left;padding:clamp(64px,8cqi,112px) clamp(24px,5cqi,72px) clamp(64px,8cqi,112px) max(var(--cb-gutter),calc((100cqi - 1180px) / 2 + var(--cb-gutter)))}
.cb-split .cb-hero-body{width:100%;max-width:620px;margin:0}
.cb-split .cb-h1{font-size:clamp(40px,5cqi,76px)}
.cb-split .cb-h1-long{font-size:clamp(36px,4.2cqi,60px)}
.cb-split .cb-ghost{font-size:min(clamp(48px,7cqi,100px),calc((min(1.2cqi + 590px,51.2cqi) - var(--cb-gutter) - clamp(24px,5cqi,72px)) / (var(--cb-ghost-n,12) * .68)))}
.cb-split .cb-lead{margin-left:0}
.cb-split .cb-actions,.cb-split .cb-badges{justify-content:flex-start}
.cb-split-photo{position:relative;min-height:440px;overflow:hidden;border-bottom-left-radius:clamp(64px,10cqi,160px);background:var(--cb-surface)}

.cb-art{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:var(--cb-art-bg)}
.cb-big{position:relative;width:min(70%,380px);aspect-ratio:1;border-radius:50%;background:var(--cb-iri-strong);box-shadow:0 0 0 2px var(--cb-bubble-edge),0 30px 80px -24px var(--cb-shadow-strong),inset 0 0 60px rgba(255,255,255,.35)}
.cb-big::before{content:'';position:absolute;top:14%;left:18%;width:25%;height:18%;border-radius:50%;background:rgba(255,255,255,.55);filter:blur(4px);transform:rotate(-30deg)}
.cb-big-icon{position:absolute;inset:0;display:grid;place-items:center;color:#fff;filter:drop-shadow(0 6px 18px rgba(0,0,0,.18))}
.cb-art .cb-bub{z-index:1}

.cb-section{position:relative;isolation:isolate;overflow:clip;padding:clamp(80px,10cqi,120px) 0;scroll-margin-top:72px}
.cb-panel{background:var(--cb-panel)}
.cb-page{background:var(--cb-bg)}
.cb-svc{padding-top:0}
.cb-orbglow{position:absolute;z-index:-1;border-radius:50%;background:var(--cb-iri-soft);filter:blur(60px);pointer-events:none}
/* Parked off the left/right page edges but well inside the section's top
   and bottom: a blurred glow cut by the section edge draws a hard seam
   against the next section. */
.cb-orbglow-1{top:150px;left:-280px;width:560px;height:560px}
.cb-orbglow-2{right:-220px;bottom:150px;width:420px;height:420px}

.cb-marquee{overflow:hidden;margin-bottom:clamp(72px,9cqi,110px);padding:16px 0;background-color:var(--cb-btn-bg);background-image:var(--cb-btn);color:var(--cb-btn-text);border-top:1.5px solid rgba(255,255,255,.15);border-bottom:1.5px solid rgba(255,255,255,.15)}
.cb-mq-track{display:flex;width:max-content}
.cb-mq-set{display:flex;flex:none}
.cb-mq-item{display:inline-flex;align-items:center;gap:28px;padding:0 28px;font-family:var(--cb-head);font-size:16px;font-weight:var(--cb-head-w);line-height:1.3;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
.cb-mq-item svg{flex:none;opacity:.85}

.cb-prices{display:grid;gap:clamp(16px,2cqi,24px)}
.cb-p1{grid-template-columns:minmax(0,440px);justify-content:center}
.cb-p2{grid-template-columns:repeat(2,minmax(0,1fr));max-width:880px;margin:0 auto}
.cb-p3,.cb-pn{grid-template-columns:repeat(3,minmax(0,1fr))}
.cb-p4{grid-template-columns:repeat(2,minmax(0,1fr));max-width:900px;margin:0 auto}
.cb-price-cell{display:flex;min-width:0}
.cb-p3 .cb-feat-cell{margin:-14px 0}
.cb-price{flex:1;position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;padding:clamp(32px,3.4cqi,44px) clamp(26px,3cqi,36px);border-radius:28px;background:var(--cb-card-bg);border:2px solid var(--cb-card-border);box-shadow:0 6px 26px -14px var(--cb-shadow)}
.cb-price-glow{position:absolute;z-index:-1;top:-80px;right:-80px;width:200px;height:200px;border-radius:50%;background:var(--cb-iri-soft);filter:blur(30px);pointer-events:none}
.cb-price-ring{position:absolute;z-index:-1;top:-48px;right:-48px;width:150px;height:150px;border-radius:50%;border:2px solid var(--cb-border);pointer-events:none}
.cb-price-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:var(--cb-chip-bg);border:1.5px solid var(--cb-border);color:var(--cb-accent-text)}
.cb-price-name{margin-top:22px;font-family:var(--cb-head);font-size:clamp(22px,2.2cqi,27px);font-weight:var(--cb-head-w);line-height:1.2;color:var(--cb-card-text);overflow-wrap:anywhere}
.cb-amt{display:block;width:fit-content;max-width:100%;margin-top:14px;font-family:var(--cb-head);font-size:clamp(40px,4.4cqi,54px);font-weight:var(--cb-head-w);line-height:1.05;letter-spacing:-.02em;overflow-wrap:anywhere}
/* A worded price ("Starting at $149.99/hr") at about 60% of the display size,
   so it reads as one or two lines instead of three huge ones. */
.cb-amt-long{font-size:clamp(24px,2.64cqi,32px);line-height:1.15;letter-spacing:-.01em}
.cb-perks{display:grid;gap:11px;margin-top:24px}
.cb-perk{display:flex;align-items:flex-start;gap:11px;font-size:15px;font-weight:600;line-height:1.45;color:var(--cb-card-text)}
.cb-check{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--cb-chip-bg);border:1.5px solid var(--cb-border);color:var(--cb-accent-text)}
.cb-price .acg-svc-foot{padding-top:30px}
.cb-price .acg-svc-more{letter-spacing:.02em}
.cb-price .acg-svc-book{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 18px;border-radius:14px;background:var(--cb-chip-bg);border:1.5px solid var(--cb-border-strong);color:var(--cb-chip-text);font-size:15px;font-weight:800;text-decoration:none}
.cb-featured{background:var(--cb-ink-bg);border-color:transparent;box-shadow:0 22px 60px -22px var(--cb-shadow-strong)}
.cb-featured .cb-price-name,.cb-featured .cb-perk{color:var(--cb-ink-text)}
.cb-featured .cb-amt{color:var(--cb-ink-text)}
.cb-featured .cb-check,.cb-featured .cb-price-icon{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.22);color:var(--cb-ink-accent)}
.cb-featured .cb-price-ring{border-color:rgba(255,255,255,.1)}
.cb-featured .acg-svc-book{background-color:var(--cb-btn-bg);background-image:var(--cb-btn);border-color:transparent;color:var(--cb-btn-text)}
.cb-help{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px 32px;margin-top:clamp(32px,4cqi,48px);padding:clamp(24px,3cqi,32px) clamp(24px,3.6cqi,44px);border-radius:24px;background:var(--cb-help-bg);border:1.5px solid var(--cb-border);box-shadow:0 8px 32px -20px var(--cb-shadow)}
.cb-help-title{font-family:var(--cb-head);font-size:clamp(20px,2cqi,24px);font-weight:var(--cb-head-w);line-height:1.25;color:var(--cb-text);text-wrap:balance}
.cb-help-text{margin-top:6px;font-size:15px;font-weight:600;line-height:1.55;color:var(--cb-muted)}

.cb-how{background:var(--cb-how-bg)}
.cb-steps{position:relative;display:grid;gap:clamp(16px,2cqi,24px)}
.cb-s1{grid-template-columns:minmax(0,420px);justify-content:center}
.cb-s2{grid-template-columns:repeat(2,minmax(0,1fr));max-width:820px;margin:0 auto}
.cb-s3,.cb-sn{grid-template-columns:repeat(3,minmax(0,1fr))}
.cb-s4{grid-template-columns:repeat(4,minmax(0,1fr))}
.cb-s2::before,.cb-s3::before,.cb-s4::before{content:'';position:absolute;z-index:0;top:63px;left:calc(50% / var(--cb-n));right:calc(50% / var(--cb-n));height:2px;background:var(--cb-line);opacity:.35}
.cb-step-cell{position:relative;z-index:1;display:flex;min-width:0}
.cb-step{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:36px 26px 32px;border-radius:24px;background:var(--cb-glass);border:1.5px solid var(--cb-glass-edge);box-shadow:0 10px 32px -16px var(--cb-shadow)}
.cb-num{position:relative;flex:none;display:grid;place-items:center;width:56px;height:56px;border-radius:50%;font-family:var(--cb-head);font-size:24px;font-weight:var(--cb-head-w);line-height:1;color:#fff;background:var(--cb-num-1);box-shadow:0 8px 20px -8px var(--cb-glow),inset 0 2px 4px rgba(255,255,255,.3)}
.cb-num::after{content:'';position:absolute;top:8px;left:12px;width:10px;height:7px;border-radius:50%;background:rgba(255,255,255,.55);transform:rotate(-20deg)}
.cb-step-cell:nth-child(4n+2) .cb-num{background:var(--cb-num-2)}
.cb-step-cell:nth-child(4n+3) .cb-num{background:var(--cb-num-3)}
.cb-step-cell:nth-child(4n+4) .cb-num{background:var(--cb-num-4)}
.cb-step-body{display:flex;flex-direction:column;align-items:center}
.cb-step-icon{display:grid;place-items:center;min-height:44px;margin-top:20px;font-size:36px;line-height:1;color:var(--cb-accent-text)}
.cb-step h3{margin-top:14px;font-family:var(--cb-head);font-size:20px;font-weight:var(--cb-head-w);line-height:1.25;color:var(--cb-text)}
.cb-step p{margin-top:10px;font-size:15px;font-weight:600;line-height:1.65;color:var(--cb-muted)}

.cb-about{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:clamp(40px,6cqi,80px)}
.cb-about-media{position:relative}
.cb-about-long{align-items:start}
.cb-about-long .cb-about-media{position:sticky;top:104px}
.cb-photo{position:relative;aspect-ratio:5/4;overflow:hidden;border-radius:32px;background:var(--cb-surface);box-shadow:0 30px 70px -36px var(--cb-shadow-strong)}
.cb-about-media>.cb-bub{z-index:2}
.cb-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.cb-stat{display:flex;flex-direction:column-reverse;align-items:center;justify-content:center;gap:10px;min-height:156px;padding:24px 18px;border-radius:24px;background:var(--cb-card-bg);border:2px solid var(--cb-card-border);box-shadow:0 8px 28px -18px var(--cb-shadow);text-align:center}
.cb-stat:last-child:nth-child(odd){grid-column:1 / -1}
.cb-stat dt{font-size:11.5px;font-weight:800;line-height:1.35;letter-spacing:.14em;text-transform:uppercase;color:var(--cb-card-muted)}
.cb-stat dd{font-family:var(--cb-head);font-size:clamp(36px,4cqi,52px);font-weight:var(--cb-head-w);line-height:1.05;overflow-wrap:anywhere}
.cb-h3{margin-top:16px;font-family:var(--cb-head);font-size:clamp(28px,3cqi,38px);font-weight:var(--cb-head-w);line-height:1.12;color:var(--cb-text);overflow-wrap:anywhere}
.cb-prose{margin-top:18px}
.cb-prose p{font-size:16.5px;font-weight:500;line-height:1.8;color:var(--cb-muted);white-space:pre-line;text-wrap:pretty}
.cb-prose p+p{margin-top:14px}
.cb-prose p:first-child{font-size:18px;font-weight:600;line-height:1.7;color:var(--cb-text)}
.cb-label{display:block;font-size:11px;font-weight:800;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;color:var(--cb-muted)}
.cb-awards{margin-top:26px;padding:16px 20px;border-radius:18px;background:var(--cb-award-bg);border:1.5px solid var(--cb-award-border)}
.cb-awards .cb-label{color:var(--cb-award-text)}
.cb-awards li{display:flex;align-items:flex-start;gap:10px;margin-top:8px;font-size:15px;font-weight:700;line-height:1.5;color:var(--cb-award-text)}
.cb-awards svg{flex:none;margin-top:2px}
.cb-pay{margin-top:24px}
.cb-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.cb-chip{padding:5px 14px;border-radius:999px;background:var(--cb-card-bg);border:1.5px solid var(--cb-border);font-size:13px;font-weight:700;line-height:1.5;color:var(--cb-card-text)}
.cb-why{display:grid;gap:16px;margin-top:clamp(56px,7cqi,88px)}
.cb-w1{grid-template-columns:minmax(0,560px);justify-content:center}
.cb-w2,.cb-w4{grid-template-columns:repeat(2,minmax(0,1fr))}
.cb-w3,.cb-wn{grid-template-columns:repeat(3,minmax(0,1fr))}
.cb-why-cell{display:flex;min-width:0}
.cb-why-item{flex:1;display:flex;align-items:flex-start;gap:18px;padding:24px 26px;border-radius:20px;background:var(--cb-card-bg);border:1.5px solid var(--cb-card-border)}
.cb-why-icon{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:15px;font-size:25px;line-height:1;color:var(--cb-accent-text);background:var(--cb-why-1)}
.cb-why-cell:nth-child(4n+2) .cb-why-icon{background:var(--cb-why-2)}
.cb-why-cell:nth-child(4n+3) .cb-why-icon{background:var(--cb-why-3)}
.cb-why-cell:nth-child(4n+4) .cb-why-icon{background:var(--cb-why-4)}
.cb-why-item h3{font-size:17px;font-weight:800;line-height:1.35;color:var(--cb-card-text)}
.cb-why-item p{margin-top:5px;font-size:14.5px;font-weight:600;line-height:1.6;color:var(--cb-card-muted)}

.cb-gal{display:grid;gap:clamp(10px,1.4cqi,18px)}
.cb-g1{grid-template-columns:minmax(0,1fr)}
.cb-g1 .cb-shot{aspect-ratio:21/9}
.cb-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.cb-g2 .cb-shot{aspect-ratio:4/3}
.cb-g3{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));height:clamp(420px,52cqi,640px)}
.cb-g3 .cb-shot:first-child{grid-row:1 / span 2}
.cb-shot{position:relative;min-height:0;overflow:hidden;border-radius:24px;background:var(--cb-surface);box-shadow:0 14px 36px -22px var(--cb-shadow)}
.cb-track{display:flex;gap:clamp(12px,1.4cqi,18px);overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc((100% - 100cqi) / 2) 0 calc(-1 * var(--cb-gutter));padding:0 calc((100cqi - 100%) / 2) 16px var(--cb-gutter);scroll-padding:0 var(--cb-gutter)}
.cb-track::-webkit-scrollbar{display:none}
.cb-track .cb-shot{flex:0 0 auto;width:clamp(240px,30cqi,380px);aspect-ratio:4/5;scroll-snap-align:start}
.cb-swipe{margin-top:12px;font-size:13px;font-weight:700;color:var(--cb-muted)}

.cb-reviews{background:var(--cb-rev-bg)}
.cb-quotes{display:grid;gap:20px}
.cb-c1{grid-template-columns:minmax(0,680px);justify-content:center}
.cb-c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.cb-c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.cb-quote-cell{display:flex;min-width:0}
.cb-quote{flex:1;position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;padding:clamp(28px,3cqi,36px);border-radius:24px;background:var(--cb-glass-strong);border:1.5px solid var(--cb-glass-edge);box-shadow:0 10px 32px -16px var(--cb-shadow)}
.cb-quote::after{content:'';position:absolute;z-index:-1;top:-40px;right:-40px;width:110px;height:110px;border-radius:50%;background:var(--cb-iri-soft);filter:blur(20px);pointer-events:none}
.cb-quote-mark{display:block;width:fit-content;height:40px;font-family:var(--cb-body);font-size:76px;font-weight:700;line-height:.95}
.cb-quote blockquote{flex:1;margin-top:10px}
.cb-quote blockquote p{font-size:16px;font-weight:600;font-style:italic;line-height:1.75;color:var(--cb-text);text-wrap:pretty}
.cb-quote figcaption{display:flex;align-items:center;gap:12px;margin-top:24px}
.cb-av{position:relative;isolation:isolate;overflow:hidden;flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;box-shadow:0 4px 14px -4px var(--cb-glow),0 0 0 2px var(--cb-orb-ring);font-family:var(--cb-head);font-size:16px;font-weight:var(--cb-head-w);color:#fff}
.cb-av::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--cb-av)}
.cb-q-name{display:block;font-size:14.5px;font-weight:800;line-height:1.35;color:var(--cb-text)}
.cb-q-role{display:block;margin-top:2px;font-size:12.5px;font-weight:600;color:var(--cb-muted)}
.cb-reviews-widget{margin-top:8px}

.cb-cta{display:flex;flex-direction:column;scroll-margin-top:72px}
.cb-band{position:relative;isolation:isolate;overflow:clip;padding:clamp(88px,10cqi,124px) 0;background:var(--cb-band-bg);color:var(--cb-ink-text);text-align:center}
/* A square wider than the band's diagonal, so its corners never sweep
   through the band while it turns (a scaled copy of the band's own box
   showed hard diagonal edges). */
.cb-band-spin{position:absolute;left:50%;top:50%;z-index:-2;width:max(150cqi,1100px);aspect-ratio:1;transform:translate(-50%,-50%);background:var(--cb-band-conic);pointer-events:none}
.cb-band .cb-bub{z-index:-1;background:var(--cb-bubble-ink);border-color:rgba(255,255,255,.28)}
.cb-band-in{max-width:780px}
.cb-band-h{font-family:var(--cb-head);font-size:clamp(38px,5cqi,64px);font-weight:var(--cb-head-w);line-height:1.06;letter-spacing:-.01em;color:var(--cb-ink-text);text-wrap:balance}
.cb-band-p{margin:20px auto 0;max-width:580px;font-size:18px;font-weight:600;line-height:1.65;color:var(--cb-ink-muted);text-wrap:pretty}
.cb-band .cb-actions{margin-top:36px}
.cb-band .cb-btn-outline{color:var(--cb-ink-text);background:rgba(255,255,255,.08);border-color:var(--cb-ink-line);box-shadow:none}
.cb-contact{padding:clamp(72px,8cqi,104px) 0;background:var(--cb-panel)}
.cb-contact-grid{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:clamp(36px,6cqi,80px);align-items:center}
.cb-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.cb-cinfo{display:flex;align-items:flex-start;gap:16px;min-width:0;padding:18px 20px;border-radius:18px;background:var(--cb-card-bg);border:1.5px solid var(--cb-card-border)}
.cb-cinfo-wide{grid-column:1 / -1}
.cb-cicon{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--cb-chip-bg);border:1.5px solid var(--cb-border);color:var(--cb-accent-text)}
.cb-cbody{min-width:0;flex:1}
.cb-cinfo .cb-label{color:var(--cb-card-muted)}
.cb-cval{display:block;margin-top:4px;font-size:16px;font-weight:700;line-height:1.5;color:var(--cb-card-text);overflow-wrap:anywhere}
.cb-cval a{color:inherit;text-decoration:none;border-bottom:1.5px solid var(--cb-border-strong)}
.cb-csub{display:block;margin-top:2px;font-size:14px;font-weight:600;line-height:1.5;color:var(--cb-card-muted)}
.cb-hours{display:grid;grid-template-columns:auto 1fr;gap:4px 18px;margin-top:6px;font-size:15px;font-weight:600;line-height:1.5}
.cb-hours dt{color:var(--cb-card-text)}
.cb-hours dd{color:var(--cb-card-muted)}

.cb-foot{position:relative;isolation:isolate;overflow:clip;padding:clamp(64px,8cqi,88px) 0 32px;background:var(--cb-footer-bg);color:var(--cb-footer-muted);font-size:15px;line-height:1.7}
.cb-foot::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--cb-foot-glow);pointer-events:none}
.cb-foot-grid{display:grid;grid-template-columns:minmax(0,1.8fr) repeat(3,minmax(0,1fr));gap:40px clamp(32px,5cqi,64px)}
/* The nav's ellipsis relies on the brand being a shrinking flex item; in
   the footer column it is a plain box as wide as the name, so a long name
   ran over the next column (and off a phone screen). Here it is capped at
   the column and the name wraps instead. */
.cb-foot .cb-brand{display:flex;width:fit-content;max-width:100%;color:var(--cb-footer-text)}
.cb-foot .cb-name{white-space:normal;text-overflow:clip;overflow-wrap:anywhere;text-wrap:balance;color:var(--cb-footer-text)}
.cb-foot .cb-tag{color:var(--cb-footer-muted)}
.cb-foot .cb-orb{box-shadow:0 0 0 2px rgba(255,255,255,.25)}
.cb-foot-tag{margin-top:16px;max-width:320px;font-weight:600}
.cb-foot-h{font-family:var(--cb-head);font-size:17px;font-weight:var(--cb-head-w);line-height:1.3;color:var(--cb-footer-accent)}
.cb-foot-list{display:grid;gap:10px;margin-top:16px;font-weight:600;overflow-wrap:anywhere}
.cb-foot a{color:var(--cb-footer-muted);text-decoration:none}
.cb-social{margin-top:22px}
.cb-social a{width:44px;height:44px;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.06);border:1.5px solid var(--cb-footer-line)}
.cb-foot-bottom{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;margin-top:clamp(48px,6cqi,64px);padding-top:26px;border-top:1px solid var(--cb-footer-line);font-size:13px;font-weight:600}
.cb-foot-slogan{display:inline-flex;align-items:center;gap:8px;font-family:var(--cb-head);font-size:15px;font-weight:var(--cb-head-w);color:var(--cb-footer-accent)}

@media (hover:hover){
.cb-link:hover{background:var(--cb-chip-bg);color:var(--cb-chip-text)}
.cb-btn-soap:hover{transform:translateY(-3px);box-shadow:0 16px 40px -12px var(--cb-glow),inset 0 1px 0 rgba(255,255,255,.3)}
.cb-btn-outline:hover{transform:translateY(-2px);border-color:var(--cb-accent-text);box-shadow:0 10px 28px -12px var(--cb-shadow)}
.cb-has-media .cb-btn-outline:hover{border-color:var(--cb-on-hero);background:rgba(0,0,0,.34)}
.cb-band .cb-btn-outline:hover{border-color:var(--cb-ink-text);background:rgba(255,255,255,.14)}
.cb-price:hover{transform:translateY(-8px);border-color:var(--cb-border-strong);box-shadow:0 26px 60px -26px var(--cb-shadow-strong)}
.cb-featured:hover{border-color:transparent}
.cb-price .acg-svc-book:hover{background-color:var(--cb-btn-bg);background-image:var(--cb-btn);border-color:transparent;color:var(--cb-btn-text);box-shadow:0 10px 24px -12px var(--cb-glow)}
.cb-price .acg-svc-book:hover svg{transform:translateX(4px)}
.cb-step:hover{transform:translateY(-5px);box-shadow:0 20px 48px -20px var(--cb-shadow-strong)}
.cb-why-item:hover{transform:translateX(4px);border-color:var(--cb-border-strong);box-shadow:0 12px 32px -20px var(--cb-shadow-strong)}
.cb-shot:hover img{transform:scale(1.05)}
.cb-quote:hover{transform:translateY(-5px);box-shadow:0 22px 56px -24px var(--cb-shadow-strong)}
.cb-cinfo:hover{transform:translateX(3px);border-color:var(--cb-border-strong);box-shadow:0 10px 26px -18px var(--cb-shadow-strong)}
.cb-cval a:hover{color:var(--cb-card-accent);border-bottom-color:currentColor}
.cb-foot a:hover{color:var(--cb-footer-text)}
.cb-social a:hover{border-color:var(--cb-footer-accent);background:rgba(255,255,255,.1)}
.cb-marquee:hover .cb-mq-track{animation-play-state:paused}
}
@media (prefers-reduced-motion:no-preference){
.cb-nav{transition:background-color .3s ease,box-shadow .3s ease}
.cb-link,.cb-foot a,.cb-cval a,.cb-social a{transition:color .2s ease,background-color .2s ease,border-color .2s ease}
.cb-btn{transition:transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .3s ease,border-color .2s ease,background-color .2s ease}
.cb-price{transition:transform .4s cubic-bezier(.34,1.56,.64,1),box-shadow .35s ease,border-color .25s ease}
.cb-price .acg-svc-book{transition:background-color .2s ease,color .2s ease,border-color .2s ease,box-shadow .25s ease}
.cb-price .acg-svc-book svg{transition:transform .25s ease}
.cb-step,.cb-quote,.cb-why-item,.cb-cinfo{transition:transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .3s ease,border-color .25s ease}
.cb-shot img{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.cb-orb::before,.cb-av::before{animation:cb-spin 9s linear infinite}
.cb-blob{animation:cb-drift 9s ease-in-out infinite alternate}
.cb-blob-2{animation-duration:11s;animation-delay:-2s}
.cb-blob-3{animation-duration:8s;animation-delay:-4s}
.cb-orbglow{animation:cb-drift 10s ease-in-out infinite alternate}
.cb-orbglow-2{animation-direction:alternate-reverse;animation-duration:8s}
.cb-drop{animation:cb-fall 3.8s linear infinite}
.cb-bub{animation:cb-float 5s ease-in-out infinite alternate}
.cb-bub:nth-child(2n){animation-duration:6.5s;animation-delay:-2s}
.cb-bub:nth-child(3n){animation-duration:4.2s;animation-delay:-1s}
.cb-dot{animation:cb-pulse 2s ease-in-out infinite}
.cb-foam{animation:cb-shimmer 5s ease-in-out infinite alternate}
.cb-hero-body{animation:cb-up 1s cubic-bezier(.2,.7,.2,1) both}
.cb-mq-track{animation:cb-marquee 36s linear infinite}
.cb-price-glow{animation:cb-spin 7s linear infinite}
.cb-price-ring{animation:cb-breathe 4s ease-in-out infinite}
.cb-big{animation:cb-breathe 6s ease-in-out infinite}
.cb-big-icon{animation:cb-float 4s ease-in-out infinite alternate}
.cb-band-spin{animation:cb-spin2 24s linear infinite}
@keyframes cb-spin{to{transform:rotate(360deg)}}
@keyframes cb-spin2{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes cb-drift{from{transform:translate(0,0) scale(1) rotate(0deg)}to{transform:translate(30px,20px) scale(1.08) rotate(8deg)}}
@keyframes cb-fall{0%{transform:translateY(0) scaleY(.8);opacity:0}10%{opacity:.9}88%{opacity:.6}100%{transform:translateY(var(--cb-fall)) scaleY(1.1);opacity:0}}
@keyframes cb-float{from{transform:translateY(0)}to{transform:translateY(-16px)}}
@keyframes cb-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.7}}
@keyframes cb-shimmer{from{background-position:0% 50%}to{background-position:100% 50%}}
@keyframes cb-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes cb-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes cb-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
}

/* Links that step aside stay in the menu, which shows from then on. A long
   name gets the room sooner: the extra links step aside from 1240px for a
   very long one, and every link from 760px for any long one. */
@container (max-width:1240px){.cb-nav-xl .cb-link-x{display:none}.cb-nav-xl.cb-nav-x .acg-menu{display:block}}
@container (max-width:1100px){
.cb-link-x{display:none}
.cb-nav-x .acg-menu{display:block}
.cb-s4{grid-template-columns:repeat(2,minmax(0,1fr))}
.cb-s4::before{display:none}
.cb-foot-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.cb-foot-brand{grid-column:1 / -1}
}
@container (max-width:900px){
.cb-nav-cta{display:none}
.cb-p3,.cb-pn{grid-template-columns:repeat(2,minmax(0,1fr))}
.cb-p3 .cb-feat-cell{margin:0}
.cb-s3,.cb-sn{grid-template-columns:repeat(2,minmax(0,1fr))}
.cb-s3::before{display:none}
.cb-w3,.cb-wn,.cb-c3{grid-template-columns:repeat(2,minmax(0,1fr))}
.cb-about,.cb-contact-grid{grid-template-columns:minmax(0,1fr)}
.cb-about-media,.cb-about-long .cb-about-media{position:relative;top:auto;max-width:620px}
.cb-blob-3{display:none}
}
@container (max-width:760px){.cb-nav-long .cb-links{display:none}.cb-nav-long .acg-menu{display:block}}
/* Just above phone width the menu button beside three links left a
   19-22 character name in a wide face (Syne) ~140px, too little for two
   lines: with the menu showing anyway (cb-nav-x), it takes the links. */
@container (max-width:680px){.cb-nav-x .cb-links{display:none}}
@container (max-width:600px){
.cb-links,.cb-nav-cta{display:none}
.cb-nav-in{min-height:64px;gap:12px}
.cb-orb{width:34px;height:34px}
.cb-name{font-size:17px}
.cb-nav-long .cb-name{font-size:15px}
.cb-nav-xl .cb-name{font-size:14px}
.cb-tag{font-size:8.5px;letter-spacing:.2em}
.cb-hero{min-height:0;padding:48px 0 96px}
.cb-hero.cb-has-media{min-height:clamp(560px,86vh,760px)}
.cb-ghost,.cb-split .cb-ghost{margin-top:20px;font-size:min(15cqi,calc((100cqi - 2 * var(--cb-gutter)) / (var(--cb-ghost-n,12) * .68)));-webkit-text-stroke-width:2px}
.cb-h1,.cb-split .cb-h1{font-size:clamp(38px,11cqi,52px);line-height:1.02}
.cb-h1-long,.cb-split .cb-h1-long{font-size:clamp(32px,8.8cqi,42px);line-height:1.08}
.cb-lead{margin-top:20px;font-size:17px}
.cb-actions{flex-direction:column;align-items:stretch;margin-top:32px}
.cb-badges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:36px}
.cb-badge{min-width:0;padding:12px 10px}
.cb-badge:last-child:nth-child(odd){grid-column:1 / -1}
.cb-badge dd{font-size:21px}
.cb-bub-x{display:none}
.cb-split{grid-template-columns:minmax(0,1fr);min-height:0}
.cb-split-text{padding:52px var(--cb-gutter) 48px}
.cb-split-photo{min-height:0;aspect-ratio:4/3;border-bottom-left-radius:0;border-top-left-radius:48px;border-top-right-radius:48px}
.cb-section{padding:72px 0}
.cb-svc{padding-top:0}
.cb-marquee{margin-bottom:64px;padding:12px 0}
.cb-mq-item{gap:20px;padding:0 20px;font-size:14px}
.cb-h2{font-size:clamp(30px,9cqi,40px)}
.cb-sub{font-size:16px}
.cb-p2,.cb-p3,.cb-p4,.cb-pn{grid-template-columns:minmax(0,1fr)}
.cb-price{padding:30px 24px}
.cb-help{flex-direction:column;align-items:stretch;text-align:center}
.cb-s2,.cb-s3,.cb-s4,.cb-sn{grid-template-columns:minmax(0,1fr)}
.cb-s2::before{display:none}
.cb-step{flex-direction:row;align-items:flex-start;gap:18px;padding:22px 20px;text-align:left}
.cb-step-body{align-items:flex-start}
.cb-step-icon{min-height:0;margin-top:0;font-size:28px}
.cb-step h3{margin-top:8px;font-size:19px}
.cb-step p{margin-top:6px}
.cb-w2,.cb-w3,.cb-w4,.cb-wn,.cb-c1,.cb-c2,.cb-c3{grid-template-columns:minmax(0,1fr)}
.cb-why-item{padding:20px}
.cb-photo{border-radius:24px}
.cb-stat{min-height:124px}
.cb-g2,.cb-g3{grid-template-columns:minmax(0,1fr);grid-template-rows:none;height:auto}
.cb-g3 .cb-shot:first-child{grid-row:auto}
.cb-g1 .cb-shot,.cb-g2 .cb-shot,.cb-g3 .cb-shot{aspect-ratio:4/3}
.cb-track .cb-shot{width:78%}
.cb-band{padding:72px 0}
.cb-band-p{font-size:17px}
.cb-contact{padding:64px 0}
.cb-cards{grid-template-columns:minmax(0,1fr)}
.cb-foot{padding-top:56px}
.cb-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:36px 20px}
.cb-foot-grid>:last-child:nth-child(even){grid-column:1 / -1}
.cb-foot-bottom{flex-direction:column;align-items:flex-start}
}
`;

const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// Hours as display rows { days, time } (same rules as MobileChrome): only
// the per-day editor's shape (exactly the seven HOURS_DAYS keys, '' =
// closed) may say a day is "Closed". Older free-text hours are shown one
// row per "Mon-Fri: 8am-6pm" pair when every key is a plain day or day
// range, else as the single line formatHours() always produced.
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

// A hero badge must be the whole truth in a few words: one open row, or a
// short free-text line.
function hoursBadge(rows) {
  if (rows.length === 1 && !rows[0].time) return rows[0].days.length <= 24 ? rows[0].days : null;
  const open = rows.filter((r) => r.time && !/^closed$/i.test(r.time));
  if (open.length !== 1 || rows.length !== 1) return null;
  // A run over the whole week (only the per-day editor produces one) reads
  // "Daily 9am – 5pm".
  const line = `${open[0].days === `${HOURS_DAYS[0]}–${HOURS_DAYS[6]}` ? 'Daily' : open[0].days} ${open[0].time}`;
  return line.length <= 24 ? line : null;
}

// Color-wheel helpers for the soap-film colors.
function toHsl(color) {
  const c = hexToRgb(color) || { r: 0, g: 0, b: 0 };
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}
function fromHsl(h, s, l) {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return rgbToHex(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (k) => {
    let x = hue + k;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return rgbToHex(ch(1 / 3) * 255, ch(0) * 255, ch(-1 / 3) * 255);
}

// fg blended toward white or black (whichever needs less change) just far
// enough to reach 4.5:1 on every backdrop at once, like ensureContrast for
// one. Repairing against each backdrop in turn can undo an earlier repair
// on a mid-tone palette. If no blend reaches 4.5:1, the better extreme wins.
const worstOn = (c, backs) => Math.min(...backs.map((b) => contrastRatio(c, b)));
function readableOnAll(fg, backs) {
  if (worstOn(fg, backs) >= 4.5) return fg;
  const solve = (target) => {
    if (worstOn(target, backs) < 4.5) return null;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 18; i += 1) {
      const m = (lo + hi) / 2;
      if (worstOn(mix(fg, target, m), backs) >= 4.5) hi = m;
      else lo = m;
    }
    // 8-bit rounding can land a hair under: step on.
    let k = hi;
    let out = mix(fg, target, k);
    while (worstOn(out, backs) < 4.5 && k < 1) {
      k = Math.min(1, k + 0.01);
      out = mix(fg, target, k);
    }
    return { k, out };
  };
  const up = solve('#ffffff');
  const down = solve('#000000');
  if (up && down) return up.k <= down.k ? up.out : down.out;
  if (up || down) return (up || down).out;
  return worstOn('#ffffff', backs) >= worstOn('#000000', backs) ? '#ffffff' : '#000000';
}

// Every --cb-* token beyond deriveTheme's, from the owner's five roles.
// The default accent (#06b6d4) turned round the wheel gives the mockup's
// sky, mint, lavender and pink; a custom accent gets its own set, and a
// muted accent gets muted bubbles (saturation follows the accent's).
// Text-bearing colors are contrast-checked against what they sit on.
function bubbleTokens(t) {
  const dark = t.isDark;
  const white = '#ffffff';
  const base = toHsl(t.accent);
  const satK = Math.min(1, base.s / 0.6);
  const tone = (deg, s, l) => fromHsl(base.h + deg, s * satK, l);
  const deep = tone(10, 0.89, 0.48);
  const teal = tone(-16, 0.8, 0.42);
  const sky = tone(24, 0.94, 0.78);
  const mint = tone(-33, 0.72, 0.67);
  // Lavender and pink sit 63deg and 138deg round the wheel from the accent.
  // Turning the default aqua forward gives violet and pink; turning a warm
  // or crimson accent forward lands on yellow-green, which goes olive once
  // darkened for text contrast. So they turn whichever way keeps both clear
  // of 40-110deg (forward on a tie, so the default look is unchanged).
  const muddy = (deg) => { const h = (((base.h + deg) % 360) + 360) % 360; return h >= 40 && h <= 110 ? 1 : 0; };
  const dir = muddy(-65) + muddy(-140) < muddy(65) + muddy(140) ? -1 : 1;
  const lav = tone(dir * 63, 0.95, 0.85);
  const lavDeep = tone(dir * 66, 0.92, 0.72);
  const pink = tone(dir * 138, 0.87, 0.82);
  const pinkDeep = tone(dir * 141, 0.86, 0.66);
  const lime = tone(-60, 0.7, 0.62);
  const peach = tone(-160, 0.95, 0.64);
  // The awards box should read as gold. The default accent turned -150deg
  // lands on amber; an orange or crimson accent would land on blue, so
  // whichever of the two hues sits nearer gold (about 40deg) wins, and a
  // warm brand gets an on-brand award box.
  const fromGold = (h) => { const d = (((h - 40) % 360) + 360) % 360; return Math.min(d, 360 - d); };
  const amber = fromGold(base.h - 150) <= fromGold(base.h) ? tone(-150, 0.9, 0.5) : tone(0, 0.9, 0.5);

  const panel = dark ? mix(t.bg, t.surface, 0.55) : mix(t.bg, white, 0.72);
  const onAll = (c, min) => {
    let x = ensureContrast(c, t.bg, min);
    for (const b of [panel, t.surface]) if (contrastRatio(x, b) < min) x = ensureContrast(x, b, min);
    return x;
  };
  // Display gradients (large text: 3:1) and the small brand name (4.5:1).
  const disp = (c) => onAll(c, 3);
  const strong = (c) => onAll(c, 4.5);

  // Buttons keep the classic white-on-aqua look when the accent is a mid
  // tone (darkened just enough for 4.5:1); a light accent (amber, lime)
  // keeps its own color with dark ink instead of turning muddy.
  const btnText = contrastRatio(t.accent, white) >= 2.2 ? white : ensureContrast(t.onAccent, t.accent, 4.5);
  const btnA = ensureContrast(t.accent, btnText, 4.5);
  const btnB = ensureContrast(fromHsl(base.h - 16, base.s, base.l), btnText, 4.5);

  // Ink: the deep blue of the CTA band, featured package and footer.
  const ink = dark ? mix(t.bg, '#000000', 0.38) : mix(mix(t.text, '#000000', 0.45), t.accent, 0.08);
  const inkHi = mix(ink, t.accent, dark ? 0.1 : 0.14);
  const inkLo = mix(ink, '#000000', 0.3);
  // On a dark palette the band is the page's own navy/charcoal lit by
  // accent glows: mixing a warm accent into the base (the light-palette
  // recipe) turns it muddy brown. bandHi is its lightest point.
  const bandBase = mix(t.bg, t.surface, 0.4);
  const bandHi = dark ? mix(bandBase, t.accent, 0.16) : inkHi;
  const inkOn = (c) => ensureContrast(ensureContrast(c, inkHi, 4.5), bandHi, 4.5);
  const inkText = inkOn(mix(white, t.accent, 0.04));

  const cardBg = dark ? mix(t.surface, white, 0.035) : mix(t.bg, white, 0.8);
  const awardBg = mix(panel, amber, dark ? 0.14 : 0.1);

  // deriveTheme repairs accentText against bg and surface only. Small
  // accent text also sits on the tinted chip (eyebrows, each package's Book
  // now, the nav hover: the chip's accent or lavender end over any section
  // or card) and on the hero's frosted glass (pill, outline button) over
  // the soap gradient; a mid-tone accent on a dark palette dropped to about
  // 3:1 there. Each place gets a copy repaired against every backdrop it
  // can land on.
  const chipA = dark ? 0.16 : 0.1;
  const chipL = dark ? 0.16 : 0.12;
  const chipText = readableOnAll(
    t.accentText,
    [t.bg, panel, t.surface, cardBg, mix(t.surface, sky, dark ? 0 : 0.2)].flatMap((x) => [mix(x, t.accent, chipA), mix(x, lavDeep, chipL)]),
  );
  // The hero gradient's base stops, each also under its strongest glow.
  const heroBases = dark ? [mix(t.bg, t.accent, 0.06), t.bg, panel] : [mix(t.surface, sky, 0.25), t.bg, panel, mix(t.bg, sky, 0.2)];
  const heroGlows = dark ? [[sky, 0.16], [lav, 0.14], [mint, 0.1], [pink, 0.1]] : [[sky, 0.45], [lav, 0.4], [mint, 0.3], [pink, 0.28]];
  const glassText = readableOnAll(
    t.accentText,
    heroBases
      .flatMap((x) => [x, ...heroGlows.map(([c, a]) => mix(x, c, a))])
      .map((x) => (dark ? mix(x, t.surface, 0.62) : mix(x, panel, 0.72))),
  );
  const numStop = (c) => ensureContrast(c, white, 3);
  const avStop = (c) => ensureContrast(c, white, 4.5);
  const shadowBase = dark ? '#000000' : mix(t.accent, '#000000', 0.45);

  return {
    '--cb-panel': panel,
    '--cb-btn-bg': btnA,
    '--cb-btn-text': btnText,
    '--cb-btn': `linear-gradient(135deg, ${btnA}, ${btnB})`,
    '--cb-glow': alpha(btnA, dark ? 0.55 : 0.5),
    '--cb-grad-text': `linear-gradient(135deg, ${disp(deep)}, ${disp(teal)})`,
    '--cb-grad-strong': `linear-gradient(135deg, ${strong(deep)}, ${strong(teal)} 55%, ${strong(lavDeep)})`,
    '--cb-foam-text': `linear-gradient(120deg, ${disp(deep)} 0%, ${disp(teal)} 30%, ${disp(lavDeep)} 60%, ${disp(pinkDeep)} 80%, ${disp(deep)} 100%)`,
    '--cb-foam-hero': `linear-gradient(120deg, ${white} 0%, ${mix(white, sky, 0.45)} 30%, ${mix(white, lav, 0.6)} 60%, ${mix(white, pink, 0.5)} 80%, ${white} 100%)`,
    '--cb-stroke': dark ? sky : deep,
    '--cb-iri': `conic-gradient(from 0deg, ${sky}, ${lav}, ${pink}, ${mint}, ${sky})`,
    '--cb-iri-strong': `conic-gradient(from 0deg, ${alpha(sky, 0.62)}, ${alpha(lav, 0.56)}, ${alpha(mint, 0.52)}, ${alpha(pink, 0.52)}, ${alpha(sky, 0.62)})`,
    '--cb-iri-soft': `conic-gradient(from 0deg, ${alpha(sky, dark ? 0.1 : 0.3)}, ${alpha(lav, dark ? 0.09 : 0.28)}, ${alpha(mint, dark ? 0.08 : 0.26)}, ${alpha(sky, dark ? 0.1 : 0.3)})`,
    '--cb-orb-ring': dark ? alpha(white, 0.22) : alpha(white, 0.85),
    '--cb-chip-bg': `linear-gradient(135deg, ${alpha(t.accent, chipA)}, ${alpha(lavDeep, chipL)})`,
    '--cb-chip-text': chipText,
    '--cb-glass': dark ? alpha(t.surface, 0.62) : alpha(panel, 0.72),
    '--cb-glass-text': glassText,
    '--cb-glass-strong': dark ? alpha(t.surface, 0.78) : alpha(panel, 0.86),
    '--cb-glass-edge': dark ? alpha(t.text, 0.1) : alpha(white, 0.9),
    '--cb-nav-glass': alpha(panel, 0.82),
    '--cb-shadow': alpha(shadowBase, dark ? 0.5 : 0.2),
    '--cb-shadow-strong': alpha(shadowBase, dark ? 0.65 : 0.3),
    '--cb-hero-bg': dark
      ? `radial-gradient(ellipse 80% 70% at 20% 20%, ${alpha(sky, 0.16)} 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 10%, ${alpha(lav, 0.14)} 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 50% 90%, ${alpha(mint, 0.1)} 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 85% 70%, ${alpha(pink, 0.1)} 0%, transparent 50%), linear-gradient(170deg, ${mix(t.bg, t.accent, 0.06)} 0%, ${t.bg} 50%, ${panel} 100%)`
      : `radial-gradient(ellipse 80% 70% at 20% 20%, ${alpha(sky, 0.45)} 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 10%, ${alpha(lav, 0.4)} 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 50% 90%, ${alpha(mint, 0.3)} 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 85% 70%, ${alpha(pink, 0.28)} 0%, transparent 50%), linear-gradient(170deg, ${mix(t.surface, sky, 0.25)} 0%, ${t.bg} 45%, ${panel} 75%, ${mix(t.bg, sky, 0.2)} 100%)`,
    '--cb-blob': dark ? alpha(sky, 0.07) : alpha(white, 0.6),
    '--cb-bubble': `radial-gradient(circle at 32% 28%, ${alpha(white, dark ? 0.55 : 0.9)} 0 7%, ${alpha(white, dark ? 0.08 : 0.22)} 22%, ${alpha(sky, dark ? 0.1 : 0.2)} 58%, ${alpha(lav, dark ? 0.18 : 0.32)} 100%)`,
    '--cb-bubble-ink': `radial-gradient(circle at 32% 28%, ${alpha(white, 0.5)} 0 7%, ${alpha(white, 0.06)} 24%, ${alpha(sky, 0.1)} 60%, ${alpha(lav, 0.2)} 100%)`,
    '--cb-bubble-edge': dark ? alpha(sky, 0.3) : alpha(white, 0.75),
    '--cb-drop': `linear-gradient(145deg, ${alpha(white, 0.9)} 0%, ${alpha(t.accent, 0.35)} 100%)`,
    '--cb-art-bg': dark
      ? `radial-gradient(80% 70% at 30% 20%, ${alpha(sky, 0.14)}, transparent 70%), radial-gradient(70% 60% at 90% 100%, ${alpha(pink, 0.1)}, transparent 70%), ${t.surface}`
      : `radial-gradient(80% 70% at 30% 20%, ${alpha(sky, 0.4)}, transparent 70%), radial-gradient(70% 60% at 90% 100%, ${alpha(pink, 0.3)}, transparent 70%), ${mix(t.surface, white, 0.4)}`,
    '--cb-line': `linear-gradient(90deg, ${deep}, ${teal}, ${lavDeep}, ${pinkDeep})`,
    '--cb-num-1': `linear-gradient(135deg, ${numStop(deep)}, ${numStop(teal)})`,
    '--cb-num-2': `linear-gradient(135deg, ${numStop(teal)}, ${numStop(lime)})`,
    '--cb-num-3': `linear-gradient(135deg, ${numStop(lavDeep)}, ${numStop(pinkDeep)})`,
    '--cb-num-4': `linear-gradient(135deg, ${numStop(peach)}, ${numStop(pinkDeep)})`,
    '--cb-why-1': `linear-gradient(135deg, ${alpha(deep, 0.15)}, ${alpha(teal, 0.15)})`,
    '--cb-why-2': `linear-gradient(135deg, ${alpha(lavDeep, 0.18)}, ${alpha(pinkDeep, 0.15)})`,
    '--cb-why-3': `linear-gradient(135deg, ${alpha(lime, 0.2)}, ${alpha(teal, 0.15)})`,
    '--cb-why-4': `linear-gradient(135deg, ${alpha(peach, 0.18)}, ${alpha(pinkDeep, 0.14)})`,
    '--cb-av': `conic-gradient(from 0deg, ${avStop(deep)}, ${avStop(teal)}, ${avStop(lavDeep)}, ${avStop(deep)})`,
    '--cb-how-bg': dark
      ? `linear-gradient(175deg, ${panel} 0%, ${t.surface} 35%, ${t.bg} 100%)`
      : `linear-gradient(175deg, ${panel} 0%, ${mix(t.surface, sky, 0.2)} 30%, ${t.bg} 70%, ${panel} 100%)`,
    '--cb-rev-bg': `linear-gradient(170deg, ${t.bg} 0%, ${t.surface} 100%)`,
    '--cb-help-bg': `linear-gradient(135deg, ${t.surface}, ${panel})`,
    '--cb-card-bg': cardBg,
    '--cb-card-text': ensureContrast(t.text, cardBg, 4.5),
    '--cb-card-muted': ensureContrast(t.textMuted, cardBg, 4.5),
    '--cb-card-accent': ensureContrast(t.accentText, cardBg, 4.5),
    '--cb-card-border': dark ? alpha(t.text, 0.1) : alpha(t.accent, 0.16),
    '--cb-award-bg': awardBg,
    '--cb-award-text': ensureContrast(dark ? mix(amber, white, 0.4) : mix(amber, '#000000', 0.5), awardBg, 4.5),
    '--cb-award-border': alpha(amber, 0.4),
    '--cb-ink-bg': ink,
    '--cb-ink-text': inkText,
    '--cb-ink-muted': inkOn(mix(inkText, ink, 0.32)),
    '--cb-ink-accent': inkOn(mix(sky, white, 0.2)),
    '--cb-ink-line': alpha(white, 0.28),
    '--cb-ink-grad': `linear-gradient(135deg, ${inkOn(mix(sky, white, 0.15))}, ${inkOn(mix(mint, white, 0.2))} 50%, ${inkOn(mix(lav, white, 0.1))})`,
    '--cb-band-bg': dark
      ? `radial-gradient(70% 90% at 12% 0%, ${alpha(t.accent, 0.16)}, transparent 62%), radial-gradient(60% 80% at 92% 100%, ${alpha(lavDeep, 0.12)}, transparent 62%), linear-gradient(160deg, ${bandBase} 0%, ${ink} 70%, ${inkLo} 100%)`
      : `linear-gradient(135deg, ${inkHi} 0%, ${ink} 60%, ${inkLo} 100%)`,
    '--cb-band-conic': `conic-gradient(from 0deg at 50% 50%, ${alpha(t.accent, dark ? 0.06 : 0.12)}, ${alpha(lavDeep, dark ? 0.05 : 0.08)}, ${alpha(teal, dark ? 0.05 : 0.08)}, ${alpha(t.accent, dark ? 0.06 : 0.12)})`,
    '--cb-footer-bg': ink,
    '--cb-footer-text': ensureContrast(inkText, ink, 4.5),
    '--cb-footer-muted': ensureContrast(mix(inkText, ink, 0.38), ink, 4.5),
    '--cb-footer-accent': ensureContrast(mix(sky, white, 0.1), ink, 4.5),
    '--cb-footer-line': alpha(white, 0.1),
    // Soft light from the top-left and bottom-right corners (a conic here
    // drew a hard seam down the middle of the footer).
    '--cb-foot-glow': `radial-gradient(60% 90% at 10% 0%, ${alpha(t.accent, 0.13)}, transparent 70%), radial-gradient(50% 80% at 95% 100%, ${alpha(lavDeep, 0.1)}, transparent 70%)`,
    '--cb-on-hero-muted': alpha(white, 0.9),
    '--cb-on-hero-line': alpha(white, 0.45),
  };
}

// Heading weight: single-weight display faces (Righteous, Bebas Neue) stay
// at 400 so the browser never fakes a bold; families with weights get 700.
function headWeight(stack) {
  const fam = catalogFamily(familiesFromStack(txt(stack))[0] || '');
  const weights = (fam && FONT_CATALOG[fam]?.weights) || [];
  if (weights.length === 0) return 400;
  return weights.includes(700) ? 700 : Math.max(...weights);
}

// The old editor seed shipped U+1FAA7 PLACARD where BUBBLES (U+1FAE7) was
// meant; saved howSteps / whyCards can still carry it.
const BUBBLES = '\u{1FAE7}';
const fixEmoji = (v) => (typeof v === 'string' ? v.replace(/\u{1FAA7}/gu, BUBBLES) : v);

// Shown until the owner edits Edit > How It Works / Why Us (copy.howSteps /
// copy.whyCards). Plain descriptions: no speed promises, guarantees,
// equipment brands or eco claims the owner never made. The drive-through
// steps only suit a car wash; other business types (e.g. a detailer who
// comes to the customer) get steps that fit any service.
const WASH_STEPS = [
  { emoji: '🚗', title: 'Pull In', desc: 'Swing by and pick the wash that suits your car.' },
  { emoji: BUBBLES, title: 'Foam & Wash', desc: 'Soap, suds and a careful wash from roof to wheels.' },
  { emoji: '💧', title: 'Rinse & Dry', desc: 'A thorough rinse and dry, so no soap is left behind.' },
  { emoji: '✨', title: 'Drive Away Clean', desc: 'Roll out fresh, clean and ready for the road.' },
];
const SERVICE_STEPS = [
  { emoji: '📞', title: 'Reach Out', desc: 'Call or message us and tell us about your car.' },
  { emoji: '🚗', title: 'Pick a Package', desc: 'Choose the service that suits your car.' },
  { emoji: BUBBLES, title: 'We Get to Work', desc: 'A careful, thorough job from roof to wheels.' },
  { emoji: '✨', title: 'Drive Away Clean', desc: 'Roll out fresh, clean and ready for the road.' },
];
// Line icons (IconOrEmoji keys) rather than emoji: crisp in the tinted tiles.
const DEFAULT_WHY = [
  { icon: 'icon:check', title: 'A Thorough Clean', desc: 'Every car gets real attention, from roof to wheels.' },
  { icon: 'icon:shield', title: 'Care for Your Paint', desc: 'We treat your car the way we would treat our own.' },
  { icon: 'icon:phone', title: 'Straight Answers', desc: 'Not sure which package fits? Ask and we will help you choose.' },
  { icon: 'icon:heart', title: 'Happy to Help', desc: 'Questions or special requests? Just ask.' },
];
// No type yet (an older site) gets the car wash look, as before.
const washSite = (businessType) => !businessType || businessType === 'car_wash';

// The same starters for the editor's How It Works / Why Us panels
// (useTemplateInfo.js), given the site's raw businessType. Editing one field
// saves the whole list as the owner's own, so a panel seeded from the
// generic templateFallbacks lists (three steps, other cards) silently
// replaced everything else the site showed. Fresh copies, safe to edit.
export function defaultHowSteps(businessType) {
  return (washSite(businessType) ? WASH_STEPS : SERVICE_STEPS).map((s) => ({ ...s }));
}
export function defaultWhyCards() {
  return DEFAULT_WHY.map((c) => ({ ...c }));
}

// A description that is really a list ("Foam wash, tire shine and
// spot-free rinse") becomes the mockup's perk list; prose stays prose.
// Owners also type bullets inline ("-Wheels and Tires -Foam Bath -Vacuum"):
// a description that starts with a dash or bullet is split at every
// dash/bullet that follows a space (so "pH-balanced" stays whole), and,
// being the owner's own explicit list, may run longer.
const BULLET_START_RE = /^[-–—•*]\s*\S/;
function perksOf(desc) {
  const s = txt(desc);
  if (!s) return null;
  if (BULLET_START_RE.test(s)) {
    const items = s.split(/(?:^|\s)[-–—•*]+\s*/).map((p) => txt(p).replace(/[.;,]\s*$/, '')).filter(Boolean);
    if (items.length >= 2 && items.length <= 16 && items.every((p) => p.length <= 70)) {
      return items.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
    }
    return null;
  }
  if (s.length > 240) return null;
  let parts;
  if (/\n|•|·/.test(s)) {
    parts = s.split(/\s*(?:\n|•|·)\s*/);
  } else {
    const body = s.replace(/[.!]\s*$/, '');
    if (/[.!?;:]\s/.test(body)) return null;
    parts = body.split(/\s*,\s*(?:and\s+|&\s+)?|\s+(?:and|&|\+)\s+(?=[^,]*$)/i);
  }
  parts = parts.map((p) => txt(p).replace(/^[-–—*\s]+/, '').replace(/[.;,]\s*$/, '')).filter(Boolean);
  if (parts.length < 3 || parts.length > 8) return null;
  if (parts.some((p) => p.split(/\s+/).length > 7 || p.length > 48)) return null;
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
}

const BOOK_RE = /\b(book|booking|schedule|appointment|reserve)\b/i;
const booksBy = (label, url) => !txt(url) && BOOK_RE.test(txt(label));
const trigger = (on) => (on ? { 'data-scheduler-trigger': '' } : {});

const priceValue = (p) => {
  const m = txt(p).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// Where a button goes when the owner entered no URL: its wording decides
// (their text or the AI draft's), else the template's own default.
function intentHref(label, map, fallback) {
  const s = txt(label).toLowerCase();
  if (!s) return fallback;
  if (/\b(call|phone|ring)\b/.test(s) && map.tel) return map.tel;
  if (/\b(book|booking|schedule|appointment|quote|estimate|contact|touch|reserve|visit|message)\b/.test(s)) return map.contact || fallback;
  if (/\b(services?|packages?|pricing|prices?|menu|plans?|washes)\b/.test(s)) return map.services || fallback;
  if (/\b(how|process|steps?|works)\b/.test(s)) return map.process || fallback;
  if (/\b(work|gallery|photos?|portfolio)\b/.test(s)) return map.gallery || fallback;
  if (/\b(reviews?|testimonials?)\b/.test(s)) return map.reviews || fallback;
  return fallback;
}

const Icon = ({ d, size = 20, width = 1.8 }) => (
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
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.8 7 21l5-2.5 5 2.5-1.5-7.2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.2 4.2L19 7',
  drop: 'M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11zM9.5 14.5a2.5 2.5 0 0 0 2.5 2.5',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z',
  car: 'M5 13l1.6-4.6A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.4L19 13M4 13h16v4.5H4zM7 17.5V20M17 17.5V20M7.5 15.2h.01M16.5 15.2h.01',
  shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  gem: 'M7 4h10l4 5-9 11L3 9zM3 9h18M10 4l-2 5 4 11 4-11-2-5',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
};
const CARD_ICONS = ['drop', 'sparkle', 'car', 'shield', 'gem'];

// Soap bubbles, drawn (emoji differ per device and read as clip art). A
// cluster of three: two circles alone on a diagonal read as the male sign.
const BubbleGlyph = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <circle cx="9.5" cy="14.5" r="6.5" />
    <circle cx="17" cy="5.5" r="3" />
    <circle cx="20.2" cy="13.2" r="1.6" />
    <path d="M6.4 12.6a3.4 3.4 0 0 1 2.3-2.2" />
  </svg>
);

// Decorative bubbles: [size px, left %, top %, extra class]. They float in
// the margins, clear of the centered text column (a bubble peeking out
// from behind a button reads as a glitch); cb-bub-x ones are dropped on
// phones, where the text spans the full width.
const HERO_BUBBLES = [
  [70, 84, 12, 'cb-bub-x'], [44, 8, 56, 'cb-bub-x'], [28, 82, 80, 'cb-bub-x'], [52, 91, 34, 'cb-bub-x'],
  [34, 15, 80, 'cb-bub-x'], [22, 19, 20, 'cb-bub-x'], [96, 86, 52, 'cb-bub-x'], [24, 4, 30, 'cb-bub-x'],
  [18, 90, 8, ''], [22, 5, 5, ''], [14, 93, 86, ''],
];
// Split hero: the text column's right margin and bottom-left corner.
const SPLIT_BUBBLES = [[36, 86, 6, ''], [22, 93, 60, 'cb-bub-x'], [16, 3, 93, 'cb-bub-x']];
const BAND_BUBBLES = [
  [110, 5, 10, 'cb-bub-x'], [70, 88, 58, 'cb-bub-x'], [45, 18, 74, 'cb-bub-x'], [35, 80, 20, 'cb-bub-x'],
  [26, 88, 7, ''], [18, 6, 94, ''],
];
const ART_BUBBLES = [[60, 80, 12, ''], [40, 6, 78, ''], [28, 92, 50, ''], [50, 70, 86, 'cb-bub-x']];
const DROPS = [[10, 3.5, 0], [22, 4, 0.7], [38, 3.2, 1.4], [55, 4.5, 0.3], [71, 3.8, 2], [85, 3, 1], [93, 4.2, 0.5]];

function Bubbles({ items }) {
  return items.map(([s, x, y, cls], i) => (
    <span key={i} className={`cb-bub${cls ? ` ${cls}` : ''}`} aria-hidden="true" style={{ width: s, height: s, left: `${x}%`, top: `${y}%` }} />
  ));
}

// What a published page shows where a photo is missing: the mockup's big
// iridescent bubble (never an "upload a photo" box).
function BubbleArt() {
  return (
    <div className="cb-art" aria-hidden="true">
      <Bubbles items={ART_BUBBLES} />
      <div className="cb-big">
        <span className="cb-big-icon"><BubbleGlyph size={96} /></span>
      </div>
    </div>
  );
}

// Owner-facing hint for an empty slot; never reaches the published page.
function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="cb-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

// Headline with its last word(s) in the soap gradient (the mockup's foam
// line), for whatever headline the owner wrote.
function GradTail({ text, cls }) {
  const words = txt(text).split(/\s+/).filter(Boolean);
  if (words.length < 2) return <span className={cls}>{txt(text)}</span>;
  const k = words.length >= 4 ? 2 : 1;
  return <>{words.slice(0, -k).join(' ')} <span className={cls}>{words.slice(-k).join(' ')}</span></>;
}

const fill = { position: 'absolute', inset: 0, height: '100%' };
const grid = (n, prefix, max) => `${prefix}${n <= max ? n : 'n'}`;

export default function CarwashBubble({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const font = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const fb = getFallbacks(biz.businessType);
  const isWash = washSite(biz.businessType);

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrder(copy, sections.map((s) => s.id));

  const name = txt(biz.businessName) || fb.shopName;
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const city = txt(biz.city);
  const place = [city, txt(biz.state)].filter(Boolean).join(', ');
  const hours = hoursRows(biz.hours);
  const payments = list(biz.paymentMethods).map(txt).filter(Boolean);
  const awards = (Array.isArray(biz.awards) ? biz.awards : [biz.awards]).map(txt).filter(Boolean);
  const email = txt(biz.email);
  const address = txt(biz.address);
  const years = txt(biz.yearsInBusiness);
  const area = txt(biz.serviceArea);

  // Services: the owner's Services tab (businessInfo.services, mirrored to
  // packages by normalizeBusinessInfo) wins over the AI list; a service the
  // owner left without a description borrows the AI one of the same name.
  const aiItems = list(copy.servicesSection?.items)
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }));
  const aiDesc = new Map(aiItems.filter((s) => s.name && s.description).map((s) => [s.name.toLowerCase(), s.description]));
  const fromPackages = list(biz.packages).length > 0;
  const services = (fromPackages ? biz.packages : aiItems)
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }))
    .map((s) => ({ ...s, description: s.description || aiDesc.get(s.name.toLowerCase()) || '' }))
    .filter((s) => s.name || s.description || s.price);
  const featuredIdx = services.length === 3 ? 1 : -1;

  // The soap marquee repeats the owner's own service names (it used to list
  // washes and "Unlimited Plans" nobody entered).
  const mqNames = [...new Set(services.map((s) => s.name).filter(Boolean))];
  const mqItems = [];
  while (mqNames.length > 0 && mqItems.length < 8) mqItems.push(...mqNames);

  // Starting price: the lowest of the owner's own prices (2+ priced).
  const priced = services.filter((s) => priceValue(s.price) !== null);
  const cheapest = priced.length >= 2 ? priced.reduce((a, b) => (priceValue(b.price) < priceValue(a.price) ? b : a)) : null;

  const howSteps = (Array.isArray(copy.howSteps) ? copy.howSteps : defaultHowSteps(biz.businessType))
    .map((s) => ({ icon: fixEmoji(txt(s?.emoji)), title: txt(s?.title), desc: txt(s?.desc) }))
    .filter((s) => s.title || s.desc);
  const whyCards = (Array.isArray(copy.whyCards) ? copy.whyCards : defaultWhyCards(biz.businessType))
    .map((c) => ({ icon: fixEmoji(txt(c?.icon)), title: txt(c?.title), desc: txt(c?.desc) }))
    .filter((c) => c.title || c.desc);

  // Hero badges only from what the owner entered: About > Stats Box values,
  // else business facts. (They used to invent "4.9★ Google Rating", "7 Days
  // Always Open", "10+ Years" and "Open Now".)
  const ownerStats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label);
  const aboutStatsMode = (copy.aboutLayout || 'image') === 'stats';
  const aboutShowsStats = aboutStatsMode && ownerStats.length > 0 && show('about');
  const hoursShort = hoursBadge(hours);
  const priceRange = txt(biz.priceRange);
  const factBadges = [
    years && (/^\d+\+?$/.test(years)
      ? { value: years, label: years === '1' ? 'Year in business' : 'Years in business' }
      : { value: years, label: 'In business' }),
    cheapest ? { value: cheapest.price, label: 'Starting at' } : priceRange && { value: priceRange, label: 'Price range' },
    hoursShort && { value: hoursShort, label: 'Hours' },
  ].filter(Boolean);
  const heroBadges = !aboutShowsStats && ownerStats.length > 0 ? ownerStats.slice(0, 4) : factBadges;

  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);

  const testimonials = list(copy.testimonialPlaceholders).filter((q) => txt(q?.text));
  const reviews = copy.googleWidgetKey ? 'google' : testimonials.length > 0 ? 'quotes' : null;

  const has = {
    services: show('services') && services.length > 0,
    process: show('process') && howSteps.length > 0,
    about: show('about'),
    gallery: show('gallery') && galleryImages.length > 0,
    reviews: show('testimonials') && !!reviews,
    contact: show('cta'),
  };
  // The hero's wave is filled with the background of whatever section the
  // owner placed right after it (they can reorder); before the dark contact
  // band or the footer it is left out rather than drawn in the wrong color.
  const rendered = {
    services: show('services') && (services.length > 0 || editor),
    process: show('process') && (howSteps.length > 0 || editor),
    about: show('about'),
    gallery: show('gallery') && (galleryImages.length > 0 || editor),
    testimonials: show('testimonials') && !!reviews,
    cta: show('cta'),
  };
  const domIds = sections.map((s) => s.id);
  const flow = domIds
    .filter((id) => id === 'hero' || rendered[id])
    .sort((a, b) => order(a) - order(b) || domIds.indexOf(a) - domIds.indexOf(b));
  const afterHero = flow[flow.indexOf('hero') + 1];
  const waveFill = { services: 'panel', process: 'panel', about: 'panel', gallery: 'bg', testimonials: 'bg' }[afterHero];

  const navNameTier = images.logo ? '' : name.length > 40 ? ' cb-nav-long cb-nav-xl' : name.length > 22 ? ' cb-nav-long' : '';
  const navLinks = [
    has.services && { href: '#packages', label: 'Packages' },
    has.process && { href: '#how', label: 'How It Works', extra: true },
    has.about && { href: '#about', label: 'About', extra: true },
    has.gallery && { href: '#gallery', label: 'Gallery', extra: true },
    has.reviews && { href: '#reviews', label: 'Reviews' },
    has.contact && { href: '#contact', label: 'Contact' },
  ].filter(Boolean);
  const anchors = {
    tel,
    contact: has.contact ? '#contact' : tel,
    services: has.services ? '#packages' : null,
    process: has.process ? '#how' : null,
    gallery: has.gallery ? '#gallery' : null,
    reviews: has.reviews ? '#reviews' : null,
  };

  // Hero buttons: the editor's Button URLs win (they used to be ignored),
  // then the label's wording, then the template defaults (Packages / How It
  // Works, as before).
  const heroPrimaryLabel = txt(copy.ctaPrimary) || (has.services ? 'See Our Packages' : fb.ctaHeadline);
  const heroPrimaryHref = txt(copy.ctaPrimaryUrl) || intentHref(heroPrimaryLabel, anchors, anchors.services || anchors.contact || '#top');
  // A booking-worded button with no URL of its own also opens the booking
  // widget when the owner has it on (data-scheduler-trigger); its href is
  // where it goes without.
  const heroBooks = booksBy(heroPrimaryLabel, copy.ctaPrimaryUrl);
  const heroSecondaryLabel = txt(copy.ctaSecondary) || (has.process ? 'How It Works' : phone ? `Call ${phone}` : '');
  const heroSecondaryHref = txt(copy.ctaSecondaryUrl) || intentHref(heroSecondaryLabel, anchors, anchors.process || tel || anchors.contact);
  const splitHero = copy.heroLayout === 'split';
  const headline = txt(copy.headline);
  const lead = txt(copy.subheadline) || txt(biz.tagline) || fb.subheadline;
  const ghost = name.length <= 18 ? name : name.split(/\s+/).slice(0, 2).join(' ').slice(0, 18);

  const aboutParas = (txt(copy.aboutText) || `${name} offers ${fb.aboutFallback}${place ? ` in ${place}` : ''}.`)
    .split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // A long story top-aligns next to a sticky photo instead of leaving a
  // tall gap above and below a vertically centered one.
  const aboutLong = aboutParas.join(' ').length + (awards.length > 0 ? 120 : 0) + (payments.length > 0 ? 80 : 0) > 640;

  // Contact band: Button Text / Button URL (Edit > Contact) and the
  // Phone / Secondary Button (ctaSecondaryText only ever worked here).
  const contactPrimaryLabel = txt(copy.ctaButtonText) || (has.services ? 'See Packages' : phone ? `Call ${phone}` : 'Get in Touch');
  const contactPrimaryHref = txt(copy.ctaUrl) || intentHref(contactPrimaryLabel, { ...anchors, contact: tel || '#contact' }, anchors.services || tel || '#contact');
  const contactBooks = booksBy(contactPrimaryLabel, copy.ctaUrl);
  // The phone button's URL key (ctaSecondaryUrl) is also hero Button 2's,
  // so it only leaves tel: when the owner gave this button its own text (or
  // the URL itself dials or texts): the default "Call (555) ..." label must
  // never open the Instagram link the owner set for the hero button.
  const secondaryUrl = txt(copy.ctaSecondaryUrl);
  const contactSecondaryLabel = txt(copy.ctaSecondaryText) || (phone ? `Call ${phone}` : '');
  const contactSecondaryHref = (secondaryUrl && (txt(copy.ctaSecondaryText) || /^(tel|sms):/i.test(secondaryUrl))) ? secondaryUrl : tel;
  const showContactSecondary = contactSecondaryLabel && contactSecondaryHref
    && (contactSecondaryHref !== contactPrimaryHref || !!txt(copy.ctaSecondaryText));
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, place].filter(Boolean).join(', '))}`
    : null;
  const contactRows = [
    phone && 'phone', (address || area || place) && 'place', hours.length > 0 && 'hours', email && 'email', payments.length > 0 && 'pay',
  ].filter(Boolean);

  const vars = {
    '--cb-bg': t.bg,
    '--cb-surface': t.surface,
    '--cb-text': t.text,
    '--cb-muted': t.textMuted,
    '--cb-accent': ensureContrast(t.accent, t.onAccent, 4.5),
    '--cb-on-accent': t.onAccent,
    '--cb-accent-text': t.accentText,
    '--cb-border': alpha(t.accent, t.isDark ? 0.3 : 0.24),
    '--cb-border-strong': alpha(t.accentText, t.isDark ? 0.5 : 0.42),
    '--cb-focus': t.focus,
    '--cb-scrim': `radial-gradient(ellipse 70% 60% at 50% 48%, ${alpha('#000000', 0.28)}, transparent 72%), ${t.heroScrim}`,
    '--cb-on-hero': t.onHero,
    '--cb-head': font,
    '--cb-body': body,
    '--cb-head-w': headWeight(font),
    '--cb-gutter': 'clamp(20px, 5cqi, 48px)',
    '--cb-fall': '110vh',
    ...bubbleTokens(t),
  };

  const brand = (logoStyle, loading) => (images.logo ? (
    <PhotoSlot src={images.logo} alt={`${name} logo`} loading={loading} style={logoStyle} imgStyle={{ objectFit: 'contain' }} />
  ) : (
    <>
      <span className="cb-orb" aria-hidden="true" />
      <span className="cb-brand-txt">
        <span className="cb-name">{name}</span>
        <span className="cb-tag">{[fb.navSubtitle, city].filter(Boolean).join(' · ')}</span>
      </span>
    </>
  ));

  const heroText = (
    <>
      <p className="cb-pill"><span className="cb-dot" aria-hidden="true" />{place || fb.heroBadge}</p>
      {ghost && <span className="cb-ghost" aria-hidden="true" style={{ '--cb-ghost-n': ghost.length }}>{ghost}</span>}
      {headline ? (
        <h1 className={`cb-h1${headline.length > 40 ? ' cb-h1-long' : ''}`}><GradTail text={headline} cls="cb-foam" /></h1>
      ) : (
        <h1 className="cb-h1"><span className="cb-foam">{name}</span><span className="cb-h1-sub">{fb.navSubtitle}</span></h1>
      )}
      {lead && <p className="cb-lead">{lead}</p>}
      <div className="cb-actions">
        {heroPrimaryHref && (
          <a className="cb-btn cb-btn-soap" href={heroPrimaryHref} {...trigger(heroBooks)}><BubbleGlyph size={20} />{heroPrimaryLabel}</a>
        )}
        {heroSecondaryLabel && heroSecondaryHref && (
          <a className="cb-btn cb-btn-outline" href={heroSecondaryHref}>{heroSecondaryLabel}<Icon d={ICONS.arrow} size={18} width={2} /></a>
        )}
      </div>
      {heroBadges.length > 0 && (
        <dl className="cb-badges">
          {heroBadges.map((b, i) => (
            <div key={`${b.label}-${i}`} className="cb-badge">
              <dt>{b.label}</dt>
              <dd>{b.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );

  const decor = (
    <>
      <span className="cb-blob cb-blob-1" aria-hidden="true" />
      <span className="cb-blob cb-blob-2" aria-hidden="true" />
      <span className="cb-blob cb-blob-3" aria-hidden="true" />
      {DROPS.map(([x, dur, delay], i) => (
        <span key={`d${i}`} className="cb-drop" aria-hidden="true" style={{ left: `${x}%`, animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />
      ))}
      <Bubbles items={HERO_BUBBLES} />
    </>
  );

  return (
    <div
      id="top"
      className="cb-root"
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.6, WebkitFontSmoothing: 'antialiased' }}
    >
      <style>{CSS}</style>
      <a className="cb-skip" href="#main">Skip to content</a>

      {/* cb-nav-x: some links step aside (cb-link-x), so the menu shows
          from then on. cb-nav-long / -xl: the shop name (no logo) is long. */}
      <nav className={`cb-nav${navLinks.some((l) => l.extra) ? ' cb-nav-x' : ''}${navNameTier}`} aria-label="Main" style={{ order: -1 }}>
        <div className="cb-wrap cb-nav-in">
          <a className="cb-brand" href="#top" aria-label={`${name}, back to top`}>
            {brand({ height: 42, width: 'auto', maxWidth: 180 }, 'eager')}
          </a>
          {(navLinks.length > 0 || tel) && (
            <div className="cb-links">
              {navLinks.map((l) => (
                <a key={l.href} className={`cb-link${l.extra ? ' cb-link-x' : ''}`} href={l.href}>{l.label}</a>
              ))}
              {(has.contact || tel) && (
                <a className="cb-btn cb-btn-soap cb-btn-sm cb-nav-cta" href={has.contact ? '#contact' : tel} data-scheduler-trigger="">{fb.ctaHeadline}</a>
              )}
            </div>
          )}
          <MobileMenu
            links={navLinks}
            cta={tel ? { href: tel, label: `Call ${phone}` } : has.contact ? { href: '#contact', label: 'Contact us' } : null}
            colors={{ ...t, bg: vars['--cb-panel'] }}
            font={body}
          />
        </div>
      </nav>

      <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
        {!show('hero') && <h1 className="cb-sr">{name}</h1>}

        {show('hero') && !splitHero && (
          <header data-section="hero" className={`cb-hero${images.hero ? ' cb-has-media' : ''}`} style={{ order: order('hero') }}>
            {images.hero ? (
              <>
                <div className="cb-hero-media">
                  <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
                </div>
                <div className="cb-hero-scrim" />
              </>
            ) : (
              <div className="cb-hero-bg" />
            )}
            {decor}
            <div className="cb-wrap cb-hero-in">
              <div className="cb-hero-body">
                {heroText}
                {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
              </div>
            </div>
            {waveFill && (
              <svg className={`cb-wave${waveFill === 'bg' ? ' cb-wave-bg' : ''}`} viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0,60 C180,90 360,20 540,55 C720,90 900,25 1080,55 C1260,85 1380,40 1440,60 L1440,90 L0,90 Z" />
              </svg>
            )}
          </header>
        )}

        {show('hero') && splitHero && (
          <header data-section="hero" className="cb-split" style={{ order: order('hero') }}>
            <div className="cb-split-text">
              <div className="cb-hero-bg" />
              <span className="cb-blob cb-blob-1" aria-hidden="true" />
              <Bubbles items={SPLIT_BUBBLES} />
              <div className="cb-hero-body">{heroText}</div>
            </div>
            <div className="cb-split-photo">
              <PhotoSlot src={images.hero} slot="hero" alt="" loading="eager" fetchPriority="high" style={fill} fallback={<BubbleArt />} />
            </div>
          </header>
        )}

        {show('services') && (services.length > 0 || editor) && (
          <section data-section="services" id="packages" className="cb-section cb-panel cb-svc" aria-labelledby="cb-services-h" style={{ order: order('services') }}>
            <ServiceCardCss />
            {mqItems.length > 0 ? (
              <div className="cb-marquee" aria-hidden="true">
                <div className="cb-mq-track">
                  {[0, 1].map((set) => (
                    <div key={set} className="cb-mq-set">
                      {mqItems.map((item, i) => (
                        <span key={`${set}-${i}`} className="cb-mq-item">{item}<BubbleGlyph size={18} /></span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ height: 'clamp(72px, 9cqi, 110px)' }} />
            )}
            <div className="cb-orbglow cb-orbglow-2" aria-hidden="true" />
            <div className="cb-wrap">
              <div className="cb-head cb-center" data-acg-reveal="">
                <p className="cb-eyebrow"><BubbleGlyph size={16} />{isWash ? 'Wash Packages' : 'Packages'}</p>
                <h2 id="cb-services-h" className="cb-h2">
                  {txt(copy.servicesSection?.title)
                    ? <GradTail text={copy.servicesSection.title} cls="cb-grad" />
                    : <>Pick your <span className="cb-grad">{isWash ? 'perfect wash.' : 'perfect package.'}</span></>}
                </h2>
                {txt(copy.servicesSection?.intro) && <p className="cb-sub">{copy.servicesSection.intro}</p>}
              </div>
              {services.length === 0 ? (
                <EditorHint>Add your packages and prices in Edit &gt; Services.</EditorHint>
              ) : (
                <div className={`cb-prices ${grid(services.length, 'cb-p', 4)}`}>
                  {services.map((s, i) => {
                    const featured = i === featuredIdx;
                    const perks = perksOf(s.description);
                    return (
                      <div key={`${s.name}-${i}`} className={`cb-price-cell${featured ? ' cb-feat-cell' : ''}`} data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                        <article className={`acg-svc-card cb-price${featured ? ' cb-featured' : ''}`}>
                          <span className="cb-price-glow" aria-hidden="true" />
                          <span className="cb-price-ring" aria-hidden="true" />
                          <span className="cb-price-icon" aria-hidden="true">
                            {i % CARD_ICONS.length === 1 ? <BubbleGlyph size={28} /> : <Icon d={ICONS[CARD_ICONS[i % CARD_ICONS.length]]} size={26} />}
                          </span>
                          {s.name && <h3 className="cb-price-name">{s.name}</h3>}
                          {s.price && <p className={`cb-amt${s.price.length > 10 ? ' cb-amt-long' : ''}`}>{s.price}</p>}
                          {perks ? (
                            <ul className="cb-perks">
                              {perks.map((p, k) => (
                                <li key={k} className="cb-perk"><span className="cb-check" aria-hidden="true"><Icon d={ICONS.check} size={13} width={2.6} /></span>{p}</li>
                              ))}
                            </ul>
                          ) : (
                            <ServiceDescription
                              id={`svc-more-${fromPackages ? 'pkg' : 'ai'}-${i}`}
                              text={s.description}
                              style={{ marginTop: 16, color: featured ? 'var(--cb-ink-muted)' : 'var(--cb-card-muted)', fontSize: 15.5, fontWeight: 600, lineHeight: 1.65 }}
                              accentColor={featured ? 'var(--cb-ink-accent)' : 'var(--cb-card-accent)'}
                            />
                          )}
                          <div className="acg-svc-foot">
                            <BookNowLink serviceName={s.name} phone={phone} label={<>Book now <Icon d={ICONS.arrow} size={17} width={2} /></>} />
                          </div>
                        </article>
                      </div>
                    );
                  })}
                </div>
              )}
              {services.length > 0 && tel && (
                <div className="cb-help" data-acg-reveal="">
                  <div>
                    <p className="cb-help-title">{isWash ? 'Not sure which wash to pick?' : 'Not sure which package to pick?'}</p>
                    <p className="cb-help-text">Give us a call and we will help you choose.</p>
                  </div>
                  <a className="cb-btn cb-btn-soap" href={tel}><Icon d={ICONS.phone} size={18} />{`Call ${phone}`}</a>
                </div>
              )}
            </div>
          </section>
        )}

        {show('process') && (howSteps.length > 0 || editor) && (
          <section data-section="process" id="how" className="cb-section cb-how" aria-labelledby="cb-how-h" style={{ order: order('process') }}>
            <div className="cb-orbglow cb-orbglow-1" aria-hidden="true" />
            <div className="cb-orbglow cb-orbglow-2" aria-hidden="true" />
            <div className="cb-wrap">
              <div className="cb-head cb-center" data-acg-reveal="">
                <p className="cb-eyebrow"><Icon d={ICONS.bolt} size={15} width={2} />The Process</p>
                <h2 id="cb-how-h" className="cb-h2">{isWash ? <>Wash to <span className="cb-grad">wow.</span></> : <>Easy from <span className="cb-grad">start to shine.</span></>}</h2>
              </div>
              {howSteps.length === 0 ? (
                <EditorHint>Add your steps in Edit &gt; How It Works.</EditorHint>
              ) : (
                <ol className={`cb-steps ${grid(howSteps.length, 'cb-s', 4)}`} style={{ '--cb-n': Math.min(howSteps.length, 4) }}>
                  {howSteps.map((s, i) => (
                    <li key={`${s.title}-${i}`} className="cb-step-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 4) * 90}ms` }}>
                      <div className="cb-step">
                        <span className="cb-num" aria-hidden="true">{i + 1}</span>
                        <div className="cb-step-body">
                          {s.icon && <span className="cb-step-icon" aria-hidden="true"><IconOrEmoji value={s.icon} size={34} /></span>}
                          {s.title && <h3>{s.title}</h3>}
                          {s.desc && <p>{s.desc}</p>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )}

        {show('about') && (
          <section data-section="about" id="about" className="cb-section cb-panel" aria-labelledby="cb-about-h" style={{ order: order('about') }}>
            <div className="cb-wrap">
              <div className="cb-head cb-center" data-acg-reveal="">
                <p className="cb-eyebrow"><Icon d={ICONS.gem} size={15} width={2} />{`Why ${name}`}</p>
                <h2 id="cb-about-h" className="cb-h2">Not all shops are <span className="cb-grad">equal.</span></h2>
              </div>
              <div className={`cb-about${aboutLong ? ' cb-about-long' : ''}`}>
                <div className="cb-about-media" data-acg-reveal="">
                  {aboutShowsStats ? (
                    <dl className="cb-stats">
                      {ownerStats.slice(0, 4).map((s, i) => (
                        <div key={`${s.label}-${i}`} className="cb-stat">
                          <dt>{s.label}</dt>
                          <dd>{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <>
                      <div className="cb-photo">
                        <PhotoSlot src={images.about} slot="about" alt={`${name} at work`} style={fill} fallback={<BubbleArt />} />
                      </div>
                      <Bubbles items={[[54, 92, -4, ''], [30, -3, 84, 'cb-bub-x']]} />
                    </>
                  )}
                  {aboutStatsMode && ownerStats.length === 0 && (
                    <EditorHint>Add your stats in Edit &gt; About &gt; Stats Box (the photo shows until then).</EditorHint>
                  )}
                </div>
                <div data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                  <p className="cb-eyebrow">About Us</p>
                  <h3 className="cb-h3">{name}</h3>
                  <div className="cb-prose">
                    {aboutParas.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                  {awards.length > 0 && (
                    <div className="cb-awards" data-acg-awards="">
                      <p className="cb-label">Awards</p>
                      <ul>
                        {awards.map((a, i) => <li key={`${a}-${i}`}><Icon d={ICONS.award} size={18} />{a}</li>)}
                      </ul>
                    </div>
                  )}
                  {payments.length > 0 && (
                    <div className="cb-pay">
                      <p className="cb-label">Payment accepted</p>
                      <ul className="cb-chips">
                        {payments.map((p) => <li key={p} className="cb-chip">{p}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              {whyCards.length > 0 && (
                <ul className={`cb-why ${grid(whyCards.length, 'cb-w', 4)}`}>
                  {whyCards.map((c, i) => (
                    <li key={`${c.title}-${i}`} className="cb-why-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 4) * 80}ms` }}>
                      <div className="cb-why-item">
                        {c.icon && <span className="cb-why-icon" aria-hidden="true"><IconOrEmoji value={c.icon} size={24} /></span>}
                        <div>
                          {c.title && <h3>{c.title}</h3>}
                          {c.desc && <p>{c.desc}</p>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {show('gallery') && (galleryImages.length > 0 || editor) && (
          <section data-section="gallery" id="gallery" className="cb-section cb-page" aria-labelledby="cb-gallery-h" style={{ order: order('gallery') }}>
            <div className="cb-wrap">
              <div className="cb-head cb-center" data-acg-reveal="">
                <p className="cb-eyebrow"><Icon d={ICONS.camera} size={15} width={2} />Gallery</p>
                <h2 id="cb-gallery-h" className="cb-h2">Fresh from the <span className="cb-grad">foam.</span></h2>
              </div>
              {galleryImages.length === 0 ? (
                <PhotoSlot slot="gallery" style={{ minHeight: 220, borderRadius: 24 }} />
              ) : galleryImages.length > 3 ? (
                <>
                  <div className="cb-track" role="region" aria-label="Photo gallery, scroll sideways for more" tabIndex={0}>
                    {galleryImages.map((src, i) => (
                      <figure key={i} className="cb-shot">
                        <PhotoSlot src={src} alt={`${name} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      </figure>
                    ))}
                  </div>
                  <p className="cb-swipe" aria-hidden="true">Swipe or scroll for more →</p>
                </>
              ) : (
                <div className={`cb-gal cb-g${galleryImages.length}`}>
                  {galleryImages.map((src, i) => (
                    <figure key={i} className="cb-shot" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <PhotoSlot src={src} alt={`${name} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'google' && (
          <section data-section="testimonials" id="reviews" className="cb-section cb-reviews" aria-label={txt(copy.googleReviewsTitle) || 'Reviews'} style={{ order: order('testimonials') }}>
            <div className="cb-wrap">
              {txt(copy.googleReviewsTitle) && (
                <div className="cb-head cb-center">
                  <p className="cb-eyebrow"><Icon d={ICONS.heart} size={15} width={2} />Reviews</p>
                  <h2 className="cb-h2">{copy.googleReviewsTitle}</h2>
                </div>
              )}
              <div className="cb-reviews-widget">
                <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
              </div>
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'quotes' && (
          <section data-section="testimonials" id="reviews" className="cb-section cb-reviews" aria-labelledby="cb-reviews-h" style={{ order: order('testimonials') }}>
            <div className="cb-orbglow cb-orbglow-1" aria-hidden="true" />
            <div className="cb-wrap">
              <div className="cb-head cb-center" data-acg-reveal="">
                <p className="cb-eyebrow"><Icon d={ICONS.heart} size={15} width={2} />Customer Love</p>
                <h2 id="cb-reviews-h" className="cb-h2">{city ? `${city}'s` : 'Our'} <span className="cb-grad">cleanest fans.</span></h2>
              </div>
              <div className={`cb-quotes ${testimonials.length === 1 ? 'cb-c1' : testimonials.length === 2 || testimonials.length === 4 ? 'cb-c2' : 'cb-c3'}`}>
                {testimonials.map((q, i) => {
                  const who = txt(q.name);
                  const initials = who ? who.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '';
                  const role = txt(q.vehicle) || txt(q.role);
                  return (
                    <div key={i} className="cb-quote-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                      <figure className="cb-quote">
                        <span className="cb-quote-mark" aria-hidden="true">“</span>
                        <blockquote><p>{q.text}</p></blockquote>
                        {(who || role) && (
                          <figcaption>
                            {initials && <span className="cb-av" aria-hidden="true">{initials}</span>}
                            <span>
                              {who && <span className="cb-q-name">{who}</span>}
                              {role && <span className="cb-q-role">{role}</span>}
                            </span>
                          </figcaption>
                        )}
                      </figure>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {show('cta') && (
          <section data-section="cta" id="contact" className="cb-cta" aria-labelledby="cb-contact-h" style={{ order: order('cta') }}>
            <div className="cb-band">
              <div className="cb-band-spin" aria-hidden="true" />
              <Bubbles items={BAND_BUBBLES} />
              <div className="cb-wrap cb-band-in" data-acg-reveal="">
                <h2 id="cb-contact-h" className="cb-band-h">
                  {txt(copy.ctaHeadline)
                    ? <GradTail text={copy.ctaHeadline} cls="cb-grad" />
                    : <>Your car is <span className="cb-grad">one rinse away</span> from perfect.</>}
                </h2>
                <p className="cb-band-p">{txt(copy.ctaSubtext) || `Come see what all the foam is about${city ? ` in ${city}` : ''}.`}</p>
                {(contactPrimaryHref || showContactSecondary) && (
                  <div className="cb-actions">
                    {contactPrimaryHref && (
                      <a className="cb-btn cb-btn-soap" href={contactPrimaryHref} {...trigger(contactBooks)}>
                        <BubbleGlyph size={20} />{contactPrimaryLabel}
                      </a>
                    )}
                    {showContactSecondary && (
                      <a className="cb-btn cb-btn-outline" href={contactSecondaryHref}>{contactSecondaryLabel}</a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {contactRows.length > 0 && (
              <div className="cb-contact">
                <div className="cb-wrap cb-contact-grid">
                  <div data-acg-reveal="">
                    <p className="cb-eyebrow"><Icon d={ICONS.map} size={15} width={2} />{address ? 'Find Us' : 'Get in Touch'}</p>
                    <h3 className="cb-h2">Come get <span className="cb-grad">squeaky clean.</span></h3>
                    <p className="cb-sub">{place ? `${name} · ${place}` : name}</p>
                  </div>
                  <ul className="cb-cards" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                    {phone && (
                      <li className="cb-cinfo">
                        <span className="cb-cicon"><Icon d={ICONS.phone} size={19} /></span>
                        <span className="cb-cbody">
                          <span className="cb-label">Phone</span>
                          <span className="cb-cval">{tel ? <a href={tel}>{phone}</a> : phone}</span>
                        </span>
                      </li>
                    )}
                    {(address || area || place) && (
                      <li className="cb-cinfo">
                        <span className="cb-cicon"><Icon d={ICONS.pin} size={19} /></span>
                        <span className="cb-cbody">
                          <span className="cb-label">{address ? 'Location' : area ? 'Service area' : 'Based in'}</span>
                          <span className="cb-cval">
                            {address ? <a href={mapsHref} target="_blank" rel="noopener noreferrer">{[address, place].filter(Boolean).join(', ')}</a> : (area || place)}
                          </span>
                          {address && area && <span className="cb-csub">{area}</span>}
                        </span>
                      </li>
                    )}
                    {hours.length > 0 && (
                      <li className={`cb-cinfo${hours.length > 2 ? ' cb-cinfo-wide' : ''}`}>
                        <span className="cb-cicon"><Icon d={ICONS.clock} size={19} /></span>
                        <span className="cb-cbody">
                          <span className="cb-label">Hours</span>
                          {hours.length === 1 && !hours[0].time ? (
                            <span className="cb-cval">{hours[0].days}</span>
                          ) : (
                            <dl className="cb-hours">
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
                    {email && (
                      <li className="cb-cinfo">
                        <span className="cb-cicon"><Icon d={ICONS.mail} size={19} /></span>
                        <span className="cb-cbody">
                          <span className="cb-label">Email</span>
                          <span className="cb-cval"><a href={`mailto:${email}`}>{email}</a></span>
                        </span>
                      </li>
                    )}
                    {payments.length > 0 && (
                      <li className="cb-cinfo">
                        <span className="cb-cicon"><Icon d={ICONS.card} size={19} /></span>
                        <span className="cb-cbody">
                          <span className="cb-label">We accept</span>
                          <span className="cb-cval">{payments.join(', ')}</span>
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="cb-foot" style={{ order: 9999 }}>
        <div className="cb-wrap">
          <div className="cb-foot-grid">
            <div className="cb-foot-brand">
              <a className="cb-brand" href="#top" aria-label={`${name}, back to top`}>
                {brand({ height: 48, width: 'auto', maxWidth: 200 })}
              </a>
              <p className="cb-foot-tag">{txt(copy.footerTagline) || (place ? `Serving ${place}.` : fb.footerDesc)}</p>
              <div className="cb-social">
                <SocialRow biz={biz} color={vars['--cb-footer-accent']} size={18} gap={10} images={images} />
              </div>
            </div>
            {services.length > 0 && (
              <div>
                <p className="cb-foot-h">Packages</p>
                <ul className="cb-foot-list">
                  {services.slice(0, 5).map((s, i) => s.name && <li key={`${s.name}-${i}`}><a href={has.services ? '#packages' : '#top'}>{s.name}</a></li>)}
                </ul>
              </div>
            )}
            {navLinks.length > 0 && (
              <div>
                <p className="cb-foot-h">Explore</p>
                <ul className="cb-foot-list">
                  {navLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
            )}
            <div>
              <p className="cb-foot-h">Contact</p>
              <ul className="cb-foot-list">
                {tel && <li><a href={tel}>{phone}</a></li>}
                {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                {address && <li>{address}</li>}
                {place && <li>{place}</li>}
              </ul>
            </div>
          </div>
          <div className="cb-foot-bottom">
            <p>© <span data-acg-year="">{new Date().getFullYear()}</span> {name}{place ? ` · ${place}` : ''} · All rights reserved</p>
            <span className="cb-foot-slogan"><BubbleGlyph size={18} />Squeaky clean, every time.</span>
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref={has.contact ? '#contact' : '#top'} colors={{ ...t, bg: vars['--cb-panel'] }} font={body} />
    </div>
  );
}
