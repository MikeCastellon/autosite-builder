// Bright & Bubbly (mobile_sudsy): playful neo-brutalist detailing site.
// Theme-ready (see CLAUDE.md, "Template contract"), built on the kit the
// same way as MobileChrome.jsx:
//   - every color comes from the owner's 5 roles via deriveTheme(). The
//     signature sky-blue / bubblegum / mint / lavender "suds" are hue-turned
//     siblings of the owner's accent (the default amber gives the mockup's
//     blue and pink), and every text pair is contrast-repaired;
//   - one prefixed <style> (.ss-*): @container layout, hover inside
//     (hover:hover), every keyframe inside prefers-reduced-motion;
//   - no hooks or browser globals: the nav is opaque by default and only
//     deepens its shadow from html[data-acg-scrolled]; bubbles are absolutely
//     positioned inside their own (clipped) sections, never position:fixed,
//     so nothing paints outside the template root;
//   - facts (trust strip, stats, awards, hours) render only when the owner
//     entered them; editor hints go through PhotoSlot / EditorOnly.
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

// Same ids and order as ContentEditor's TOGGLEABLE.mobile_sudsy (and the
// legacy buildSectionOrder call), so saved orders and hidden flags keep
// working. Never rename an id.
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'services', label: 'Services' },
  { id: 'process', label: 'How It Works' },
  { id: 'whyUs', label: 'Why Choose Us' },
  { id: 'about', label: 'About' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'cta', label: 'Contact / CTA' },
];

export const extraFonts = [];

const CSS = `
.ss-root{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.ss-root :where(h1,h2,h3,h4,p,ul,ol,dl,dd,figure,blockquote){margin:0}
.ss-root :where(ul,ol){list-style:none;padding:0}
.ss-wrap{width:100%;max-width:1240px;margin:0 auto;padding-left:var(--ss-gutter);padding-right:var(--ss-gutter)}
.ss-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.ss-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 18px;border:3px solid var(--ss-ink);border-radius:14px;background:var(--ss-accent);color:var(--ss-on-accent);font-weight:800;text-decoration:none}
.ss-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.ss-root a:focus-visible,.ss-root summary:focus-visible,.ss-root label:focus-visible,.ss-track:focus-visible{outline:3px solid var(--ss-focus);outline-offset:3px}
.ss-why a:focus-visible,.ss-foot a:focus-visible,.ss-has-media a:focus-visible{outline-color:var(--ss-focus-inv)}
.ss-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin-top:22px;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.6);border-radius:12px;font-size:13px;font-weight:600;line-height:1.45;color:inherit;opacity:.85}
.ss-emo{display:inline-block;line-height:1}

.ss-tag{display:inline-flex;align-items:center;gap:8px;padding:7px 18px;border:3px solid var(--ss-ink);border-radius:999px;background:var(--ss-accent);color:var(--ss-on-accent);box-shadow:3px 3px 0 var(--ss-ink);font-size:13px;font-weight:800;line-height:1.3;letter-spacing:.1em;text-transform:uppercase;rotate:1.5deg}
.ss-tag-l{rotate:-1.5deg}
.ss-tag-paper{background:var(--ss-card-bg);color:var(--ss-card-text)}
.ss-head{max-width:800px;margin:0 auto clamp(44px,5.5cqi,68px);text-align:center}
.ss-h2{margin-top:22px;font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:clamp(38px,5cqi,62px);line-height:1.04;letter-spacing:.005em;text-wrap:balance}
.ss-h2 em{font-style:normal;color:var(--ss-em)}
.ss-sub{margin:16px auto 0;max-width:600px;font-size:17px;font-weight:600;line-height:1.65;color:var(--ss-muted);text-wrap:pretty}

.ss-actions{display:flex;flex-wrap:wrap;align-items:center;gap:16px;margin-top:38px}
.ss-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:58px;padding:0 30px;border:3px solid var(--ss-ink);border-radius:18px;font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:21px;line-height:1.15;letter-spacing:.01em;text-align:center;text-decoration:none;box-shadow:5px 5px 0 var(--ss-ink);cursor:pointer;-webkit-tap-highlight-color:transparent}
.ss-btn:active{translate:2px 2px;box-shadow:2px 2px 0 var(--ss-ink)}
.ss-btn-primary{background:var(--ss-accent);color:var(--ss-on-accent)}
.ss-btn-paper{background:var(--ss-card-bg);color:var(--ss-card-text)}

.ss-nav{position:sticky;top:0;z-index:100;background:var(--ss-nav-bg);color:var(--ss-nav-text);border-bottom:3px solid var(--ss-ink);box-shadow:0 4px 0 var(--ss-ink)}
html[data-acg-scrolled] .ss-nav{box-shadow:0 4px 0 var(--ss-ink),0 24px 40px -24px rgba(0,0,0,.55)}
.ss-nav-in{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:74px}
.ss-brand{flex:1 1 auto;display:inline-flex;align-items:center;gap:10px;min-width:0;color:inherit;text-decoration:none}
.ss-brand-emo{flex:none;display:grid;place-items:center;width:46px;height:46px;border:2.5px solid var(--ss-ink);border-radius:50%;background:var(--ss-bubble-bg);box-shadow:2px 2px 0 var(--ss-ink);font-size:25px}
.ss-brand-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:27px;line-height:1.15}
.ss-links{flex:none;display:flex;align-items:center;gap:4px}
.ss-link{padding:8px 15px;border:2.5px solid transparent;border-radius:999px;color:inherit;font-size:14.5px;font-weight:800;line-height:1.2;text-decoration:none}
.ss-nav-cta{display:inline-flex;align-items:center;gap:8px;min-height:46px;margin-left:12px;padding:0 22px;border:2.5px solid var(--ss-ink);border-radius:999px;background:var(--ss-navcta-bg);color:var(--ss-navcta-text);font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:19px;line-height:1;text-decoration:none;white-space:nowrap;box-shadow:3px 3px 0 var(--ss-shade)}

.ss-hero-wrap{position:relative;z-index:2}
.ss-hero{position:relative;isolation:isolate;overflow:clip;padding:clamp(64px,8cqi,112px) 0 clamp(84px,9cqi,128px);background:var(--ss-hero-bg);color:var(--ss-hero-text)}
.ss-hero-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);align-items:center;gap:clamp(32px,5cqi,72px)}
.ss-badge{display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:8px 18px;border:3px solid var(--ss-ink);border-radius:999px;background:var(--ss-accent);color:var(--ss-on-accent);box-shadow:3px 3px 0 var(--ss-ink);font-size:14px;font-weight:800;line-height:1.3;rotate:-2deg}
.ss-h1{margin-top:28px;font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:clamp(48px,7cqi,94px);line-height:1;letter-spacing:.005em;text-wrap:balance}
.ss-hl{position:relative;z-index:0;display:inline-block;color:var(--ss-hero-em)}
.ss-hl::after{content:'';position:absolute;z-index:-1;left:-.06em;right:-.06em;bottom:.04em;height:.24em;border-radius:.08em;background:var(--ss-accent);transform:skewX(-8deg)}
.ss-lead{margin-top:24px;max-width:540px;font-size:clamp(17px,1.7cqi,20px);font-weight:600;line-height:1.65;color:var(--ss-hero-muted);text-wrap:pretty}
.ss-area{display:inline-flex;align-items:center;gap:10px;max-width:100%;margin-top:30px;padding:10px 16px;border:2.5px solid var(--ss-ink);border-radius:14px;background:var(--ss-card-bg);color:var(--ss-card-text);box-shadow:3px 3px 0 var(--ss-ink);font-size:14.5px;font-weight:700;line-height:1.4}
.ss-art{position:relative;display:grid;place-items:center;min-height:360px}
.ss-car{position:relative;z-index:1;width:min(100%,470px);filter:drop-shadow(0 24px 30px var(--ss-car-glow))}
.ss-car svg{display:block;width:100%;height:auto;overflow:visible}
.ss-cb{position:absolute;border-radius:50%;border:3px solid var(--ss-bubble-line);background:var(--ss-bubble-fill)}
.ss-spark{position:absolute;z-index:2;line-height:1;pointer-events:none}
.ss-bubbles{position:absolute;inset:0;z-index:-1;pointer-events:none}
.ss-bub{position:absolute;border-radius:50%;border:3px solid var(--ss-bubble-line);background:var(--ss-bubble-fill)}
.ss-bub::after,.ss-cb::after{content:'';position:absolute;top:16%;left:20%;width:26%;height:26%;border-radius:50%;background:rgba(255,255,255,.75)}
.ss-split-text .ss-wide{display:none}
.ss-hero.ss-has-media{display:flex;align-items:center;min-height:clamp(560px,84vh,860px);color:var(--ss-on-hero);border-bottom:4px solid var(--ss-ink)}
.ss-hero-media{position:absolute;inset:0;z-index:-2}
.ss-hero-scrim{position:absolute;inset:0;z-index:-1;background:var(--ss-scrim-left)}
.ss-has-media .ss-hero-body{max-width:740px}
.ss-has-media .ss-h1{text-shadow:0 2px 26px rgba(0,0,0,.35)}
.ss-has-media .ss-hl{color:var(--ss-on-hero)}
.ss-has-media .ss-lead{color:var(--ss-on-hero-muted)}
.ss-teeth{position:relative;z-index:3;height:16px;margin-bottom:-16px;background:conic-gradient(from -45deg at 50% 100%,var(--ss-hero-bg) 90deg,transparent 0) 0 0/32px 100% repeat-x;pointer-events:none}
.ss-split{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);min-height:clamp(560px,calc(100vh - 74px),880px);background:var(--ss-hero-bg);color:var(--ss-hero-text)}
.ss-split-text{position:relative;isolation:isolate;overflow:clip;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:clamp(64px,8cqi,112px) clamp(24px,5cqi,72px) clamp(80px,8cqi,120px) max(var(--ss-gutter),calc((100cqi - 1240px) / 2 + var(--ss-gutter)))}
.ss-split .ss-h1{font-size:clamp(46px,6cqi,84px)}
.ss-split-photo{position:relative;min-height:440px;overflow:clip;border-left:4px solid var(--ss-ink);background:var(--ss-tint-2)}
.ss-art-panel{position:absolute;inset:0;display:grid;place-items:center;padding:32px}

.ss-trust{position:relative;background:var(--ss-trust-bg);color:var(--ss-trust-text);border-bottom:4px solid var(--ss-ink)}
.ss-trust-in{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:14px clamp(28px,4cqi,56px);padding-top:32px;padding-bottom:24px}
.ss-trust-item{display:inline-flex;align-items:center;gap:10px;font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:clamp(17px,1.6cqi,20px);line-height:1.3;white-space:pre-line}
.ss-trust-item .ss-emo{font-size:22px}

.ss-section{position:relative;padding:clamp(84px,9cqi,124px) 0;scroll-margin-top:78px;--ss-em:var(--ss-pop-ink)}
.ss-section>.ss-wrap{position:relative;z-index:1}
.ss-deco{position:absolute;inset:0;z-index:0;overflow:clip;pointer-events:none}
.ss-grid{display:grid;gap:clamp(20px,2.2cqi,28px)}
.ss-c1{grid-template-columns:minmax(0,560px);justify-content:center}
.ss-c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ss-c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ss-c4{grid-template-columns:repeat(4,minmax(0,1fr))}
.ss-cell{display:flex;min-width:0}

.ss-card{flex:1;position:relative;padding:clamp(28px,2.8cqi,38px) clamp(24px,2.6cqi,34px);border:3px solid var(--ss-ink);border-radius:26px;background:var(--ss-tint,var(--ss-card-bg));color:var(--ss-card-text);box-shadow:6px 6px 0 var(--ss-ink)}
.ss-card-emo{display:inline-block;font-size:46px;line-height:1}
.ss-card-title{margin-top:18px;font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:clamp(25px,2.3cqi,29px);line-height:1.1}
.ss-card .acg-svc-foot{padding-top:24px}
.ss-card .acg-svc-more{min-height:32px;padding-top:6px}
.ss-price-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 14px;padding-top:18px;border-top:2.5px dashed var(--ss-dash)}
.ss-price{font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:clamp(28px,2.6cqi,34px);line-height:1;white-space:nowrap}
.ss-card .acg-svc-book{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 18px;border:2.5px solid var(--ss-ink);border-radius:999px;background:var(--ss-card-bg);color:var(--ss-card-text);font-size:14px;font-weight:800;text-decoration:none;box-shadow:2px 2px 0 var(--ss-ink)}

.ss-band{position:relative;overflow:clip;border-top:4px solid var(--ss-ink);border-bottom:4px solid var(--ss-ink)}
.ss-marquee{position:absolute;left:0;display:flex;width:max-content;white-space:nowrap;pointer-events:none}
.ss-marquee>span{padding-right:.8em}
.ss-marquee-top{top:14px;font-size:22px;letter-spacing:10px;opacity:.3}
.ss-marquee-bottom{bottom:18px;font-size:14px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--ss-why-faint)}
.ss-process{background:var(--ss-process-bg);color:var(--ss-process-text);--ss-em:var(--ss-process-em)}
.ss-process .ss-sub{color:var(--ss-process-muted)}
.ss-steps{display:grid;gap:22px;grid-template-columns:repeat(var(--ss-n),minmax(0,1fr))}
.ss-step{flex:1;position:relative;padding:34px 24px 30px;border:3px solid var(--ss-ink);border-radius:26px;background:var(--ss-card-bg);color:var(--ss-card-text);text-align:center;box-shadow:5px 5px 0 var(--ss-ink)}
.ss-num{font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:56px;line-height:1;color:var(--ss-num)}
.ss-step-emo{display:flex;justify-content:center;margin-top:12px;font-size:42px;line-height:1}
.ss-step-title{margin-top:16px;font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:25px;line-height:1.15}
.ss-step p{margin-top:8px;font-size:15px;font-weight:600;line-height:1.6;color:var(--ss-card-muted)}
.ss-arrow{position:absolute;z-index:2;top:50%;right:-24px;translate:0 -50%;font-size:26px;font-weight:900;line-height:1;color:var(--ss-process-text)}

.ss-why{background:var(--ss-why-bg);color:var(--ss-why-text);--ss-em:var(--ss-why-em);padding-bottom:clamp(108px,11cqi,144px)}
.ss-why-card{flex:1;padding:34px 28px;border:3px solid var(--ss-whycard-line);border-radius:26px;background:var(--ss-whycard-bg);color:var(--ss-whycard-text)}
.ss-why-emo{display:flex;font-size:44px;line-height:1}
.ss-why-title{margin-top:18px;font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:25px;line-height:1.15}
.ss-why-card p{margin-top:10px;font-size:15px;font-weight:600;line-height:1.65;color:var(--ss-whycard-muted)}

.ss-about{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);align-items:center;gap:clamp(44px,6cqi,96px)}
.ss-frame{position:relative;max-width:500px;padding:14px 20px 20px 8px}
.ss-photo{position:relative;aspect-ratio:4/5;overflow:hidden;border:3px solid var(--ss-ink);border-radius:30px;background:var(--ss-tint-2);box-shadow:10px 10px 0 var(--ss-ink);rotate:-2deg}
.ss-photo-mono{aspect-ratio:1}
.ss-sticker{position:absolute;z-index:2;right:0;top:-6px;display:grid;place-items:center;width:84px;height:84px;border:3px solid var(--ss-ink);border-radius:50%;background:var(--ss-bubble-bg);box-shadow:3px 3px 0 var(--ss-ink);font-size:38px;line-height:1;rotate:10deg}
.ss-mono{position:absolute;inset:0;display:grid;place-items:center;overflow:clip;isolation:isolate;background:var(--ss-tint-2)}
.ss-mono-bubble{position:relative;display:grid;place-items:center;width:60%;aspect-ratio:1;border:3px solid var(--ss-ink);border-radius:50%;background:var(--ss-card-bg);box-shadow:8px 8px 0 var(--ss-ink)}
.ss-mono-letter{font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:clamp(84px,11cqi,150px);line-height:1;color:var(--ss-num)}
.ss-statbox{display:grid;gap:16px;max-width:500px}
.ss-stat{display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:22px 26px;border:3px solid var(--ss-ink);border-radius:22px;background:var(--ss-tint,var(--ss-card-bg));color:var(--ss-card-text);box-shadow:5px 5px 0 var(--ss-ink)}
.ss-stat:nth-child(even){rotate:1deg}
.ss-stat dd{font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:clamp(40px,4.4cqi,54px);line-height:1}
.ss-stat dt{margin-top:8px;font-size:12.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ss-card-muted)}
.ss-about .ss-h2{margin-bottom:24px}
.ss-prose p{font-size:17px;font-weight:600;line-height:1.8;color:var(--ss-muted);white-space:pre-line;text-wrap:pretty}
.ss-prose p+p{margin-top:16px}
.ss-prose p:first-child{font-size:clamp(18px,1.7cqi,20px);color:var(--ss-text)}
.ss-label{display:block;font-size:12px;font-weight:800;line-height:1.4;letter-spacing:.1em;text-transform:uppercase;color:var(--ss-muted)}
.ss-chips{display:flex;flex-wrap:wrap;gap:10px}
.ss-chip{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border:2.5px solid var(--ss-ink);border-radius:999px;background:var(--ss-chip-bg);color:var(--ss-card-text);font-size:14px;font-weight:700;line-height:1.3}
.ss-facts{margin-top:28px}
.ss-pay{margin-top:24px}
.ss-pay .ss-chips{margin-top:10px}
.ss-awards{margin-top:26px;padding:18px 22px;border:3px solid var(--ss-ink);border-radius:20px;background:var(--ss-award-bg);color:var(--ss-card-text);box-shadow:4px 4px 0 var(--ss-ink)}
.ss-awards .ss-label{color:var(--ss-card-muted)}
.ss-awards ul{display:grid;gap:8px;margin-top:8px}
.ss-awards li{display:flex;gap:10px;font-size:16px;font-weight:700;line-height:1.45}

.ss-gal{display:grid;gap:clamp(18px,2cqi,26px)}
.ss-g1{grid-template-columns:minmax(0,1fr)}
.ss-g1 .ss-shot{aspect-ratio:21/9}
.ss-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ss-g2 .ss-shot{aspect-ratio:4/3}
.ss-g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ss-g3 .ss-shot{aspect-ratio:4/5}
.ss-shot{position:relative;min-width:0;overflow:hidden;border:3px solid var(--ss-ink);border-radius:26px;background:var(--ss-card-bg);box-shadow:6px 6px 0 var(--ss-ink)}
.ss-gal>div:nth-child(odd) .ss-shot{rotate:-1.2deg}
.ss-gal>div:nth-child(even) .ss-shot{rotate:1.2deg}
/* 4+ photos: a centered wall on wide screens, a swipe track on phones. */
.ss-track{--ss-gg:clamp(18px,2cqi,26px);display:flex;flex-wrap:wrap;justify-content:center;gap:var(--ss-gg)}
.ss-track::-webkit-scrollbar{display:none}
.ss-track .ss-shot{flex:0 0 calc((100% - (var(--ss-gc) - 1) * var(--ss-gg)) / var(--ss-gc));aspect-ratio:4/5}
.ss-track .ss-shot:nth-child(odd){rotate:-1.2deg}
.ss-track .ss-shot:nth-child(even){rotate:1.2deg}
.ss-swipe{display:none;margin-top:10px;text-align:center;font-size:14px;font-weight:800;color:var(--ss-muted)}

.ss-alt{background:var(--ss-alt-bg);color:var(--ss-alt-text)}
.ss-alt .ss-sub{color:var(--ss-alt-muted)}
.ss-quotes{padding-top:16px}
.ss-quote{flex:1;position:relative;display:flex;flex-direction:column;padding:38px 30px 28px;border:3px solid var(--ss-ink);border-radius:26px;background:var(--ss-tint,var(--ss-card-bg));color:var(--ss-card-text);box-shadow:5px 5px 0 var(--ss-ink)}
.ss-quotes>.ss-cell:nth-child(3n+2)>.ss-quote{rotate:1deg}
.ss-quote-deco{position:absolute;top:-26px;right:24px;font-size:38px;line-height:1}
.ss-qmark{display:block;height:30px;font-family:var(--ss-head);font-size:76px;line-height:.9;color:var(--ss-num)}
.ss-quote blockquote{flex:1;margin-top:12px}
.ss-quote blockquote p{font-size:16px;font-weight:600;font-style:italic;line-height:1.7;text-wrap:pretty}
.ss-who{display:flex;align-items:center;gap:12px;margin-top:24px}
.ss-av{flex:none;display:grid;place-items:center;width:48px;height:48px;border:3px solid var(--ss-ink);border-radius:50%;background:var(--ss-accent);color:var(--ss-on-accent);box-shadow:2px 2px 0 var(--ss-ink);font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:19px;line-height:1}
.ss-who-name{display:block;font-size:15px;font-weight:800;line-height:1.3}
.ss-who-role{display:block;font-size:13px;font-weight:600;line-height:1.4;color:var(--ss-card-muted)}

.ss-cta{background:var(--ss-cta-bg);color:var(--ss-cta-text)}
.ss-cta-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);align-items:center;gap:clamp(44px,6cqi,88px)}
.ss-cta-solo{grid-template-columns:minmax(0,760px)}
.ss-cta .ss-h2{margin-top:22px;font-size:clamp(40px,5.4cqi,68px)}
.ss-cta .ss-sub{margin:18px 0 0;color:var(--ss-cta-muted)}
.ss-info{display:grid;gap:14px;margin-top:34px}
.ss-info-card{display:flex;align-items:center;gap:16px;padding:14px 20px;border:3px solid var(--ss-ink);border-radius:18px;background:var(--ss-card-bg);color:var(--ss-card-text);box-shadow:4px 4px 0 var(--ss-ink);text-decoration:none}
.ss-info-emo{flex:none;font-size:28px;line-height:1}
.ss-info-body{min-width:0}
.ss-info-label{display:block;font-size:11.5px;font-weight:800;line-height:1.4;letter-spacing:.08em;text-transform:uppercase;color:var(--ss-card-muted)}
.ss-info-val{display:block;margin-top:2px;font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:19px;line-height:1.3;overflow-wrap:anywhere}
.ss-info-sub{display:block;font-size:14px;font-weight:700;line-height:1.45;color:var(--ss-card-muted)}
.ss-hours{display:grid;grid-template-columns:auto 1fr;gap:2px 16px;margin-top:4px;font-size:15px;font-weight:700;line-height:1.5}
.ss-hours dd{color:var(--ss-card-muted)}
.ss-book{position:relative;padding:clamp(44px,4.4cqi,56px) clamp(24px,3.4cqi,44px) clamp(32px,3.6cqi,44px);border:3px solid var(--ss-ink);border-radius:30px;background:var(--ss-card-bg);color:var(--ss-card-text);box-shadow:10px 10px 0 var(--ss-ink);text-align:center}
.ss-book-emo{position:absolute;top:-32px;left:calc(50% - 32px);display:grid;place-items:center;width:64px;height:64px;border:3px solid var(--ss-ink);border-radius:50%;background:var(--ss-bubble-bg);box-shadow:3px 3px 0 var(--ss-ink);font-size:30px;line-height:1}
.ss-book-title{font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:clamp(28px,2.8cqi,34px);line-height:1.1;text-wrap:balance}
.ss-book p{margin-top:12px;font-size:15.5px;font-weight:600;line-height:1.6;color:var(--ss-card-muted)}
.ss-book .ss-actions{flex-direction:column;align-items:stretch;gap:16px;margin-top:28px}

.ss-foot{position:relative;padding:clamp(72px,8cqi,96px) 0 34px;background:var(--ss-footer-bg);color:var(--ss-footer-muted);font-size:15px;line-height:1.6}
.ss-foot::before{content:'';position:absolute;left:0;right:0;top:-15px;height:16px;background:conic-gradient(from 135deg at 50% 0,var(--ss-footer-bg) 90deg,transparent 0) 0 0/32px 100% repeat-x;pointer-events:none}
.ss-foot-grid{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(3,minmax(0,1fr));gap:40px clamp(28px,4cqi,64px)}
.ss-foot .ss-brand{color:var(--ss-footer-accent)}
.ss-foot .ss-brand-name{font-size:30px;white-space:normal}
.ss-foot-tag{margin-top:14px;max-width:340px;font-weight:600}
.ss-foot-h{font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:21px;line-height:1.2;color:var(--ss-footer-accent)}
.ss-foot-list{display:grid;gap:10px;margin-top:16px;font-weight:600}
.ss-foot a{color:var(--ss-footer-muted);text-decoration:none}
.ss-social{margin-top:22px}
.ss-social a{width:44px;height:44px;align-items:center;justify-content:center;border:2.5px solid var(--ss-footer-line-strong);border-radius:50%}
.ss-foot-bottom{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;margin-top:clamp(44px,5cqi,64px);padding-top:24px;border-top:2px dashed var(--ss-footer-line);font-size:13px;font-weight:700}
.ss-foot a.ss-top{display:inline-flex;align-items:center;gap:8px;font-family:var(--ss-head);font-weight:var(--ss-head-w);font-size:18px;color:var(--ss-footer-accent)}

@media (hover:hover){
.ss-link:hover{background:var(--ss-navcta-bg);color:var(--ss-navcta-text);border-color:var(--ss-ink);rotate:-1deg;scale:1.04}
.ss-nav-cta:hover{translate:-2px -2px;box-shadow:5px 5px 0 var(--ss-shade)}
.ss-btn:hover{translate:-3px -3px;box-shadow:8px 8px 0 var(--ss-ink)}
.ss-btn-paper:hover{background:var(--ss-accent-pale)}
.ss-btn:active{translate:2px 2px;box-shadow:2px 2px 0 var(--ss-ink)}
.ss-card:hover{translate:-4px -4px;box-shadow:10px 10px 0 var(--ss-ink)}
.ss-card .acg-svc-book:hover{background:var(--ss-accent);color:var(--ss-on-accent)}
.ss-step:hover{translate:-3px -3px;rotate:-1deg;box-shadow:8px 8px 0 var(--ss-ink)}
.ss-why-card:hover{translate:0 -4px;rotate:1deg;background:var(--ss-whycard-hover)}
.ss-gal .ss-shot:hover,.ss-track .ss-shot:hover{rotate:0deg;translate:-3px -3px;box-shadow:9px 9px 0 var(--ss-ink)}
.ss-shot:hover img{scale:1.05}
.ss-quote:hover{translate:-3px -3px;box-shadow:8px 8px 0 var(--ss-ink)}
a.ss-info-card:hover{translate:-2px -2px;box-shadow:6px 6px 0 var(--ss-ink)}
.ss-foot a:hover{color:var(--ss-footer-accent)}
.ss-social a:hover{border-color:var(--ss-footer-accent)}
}
@media (prefers-reduced-motion:no-preference){
.ss-nav{transition:box-shadow .3s ease}
.ss-link,.ss-nav-cta,.ss-btn,.ss-card,.ss-step,.ss-why-card,.ss-shot,.ss-quote,.ss-info-card,.ss-card .acg-svc-book{transition:translate .18s ease,rotate .18s ease,scale .18s ease,box-shadow .18s ease,background-color .18s ease,color .18s ease,border-color .18s ease}
.ss-shot img{transition:scale .6s cubic-bezier(.2,.7,.2,1)}
.ss-foot a,.ss-social a{transition:color .2s ease,border-color .2s ease}
.ss-brand-emo{animation:ss-wiggle 2.4s ease-in-out infinite}
.ss-sticker{animation:ss-wiggle 3.2s ease-in-out infinite}
.ss-badge{animation:ss-bounce 3.2s ease-in-out infinite}
.ss-book-emo{animation:ss-bounce 2.8s ease-in-out infinite}
.ss-hl{animation:ss-dance 2.4s ease-in-out infinite}
.ss-car{animation:ss-bob 3.4s ease-in-out infinite}
.ss-cb{animation:ss-rise var(--d,3s) ease-in var(--dl,0s) infinite both}
.ss-spark{animation:ss-twinkle 2.2s ease-in-out var(--dl,0s) infinite}
.ss-bub{animation:ss-drift var(--d,9s) ease-in-out var(--dl,0s) infinite both}
.ss-float{animation:ss-float var(--d,7s) ease-in-out var(--dl,0s) infinite}
.ss-card-emo{animation:ss-wobble 3s ease-in-out infinite}
.ss-cell:nth-child(even) .ss-card-emo{animation-direction:reverse}
.ss-marquee{animation:ss-marquee 30s linear infinite}
.ss-marquee-bottom{animation-duration:44s}
.ss-arrow{animation:ss-nudge 1.5s ease-in-out infinite}
@keyframes ss-wiggle{0%,100%{rotate:-8deg}50%{rotate:8deg}}
@keyframes ss-bounce{0%,100%{translate:0 0}50%{translate:0 -6px}}
@keyframes ss-dance{0%,100%{rotate:-2deg}50%{rotate:2deg}}
@keyframes ss-bob{0%,100%{translate:0 0;rotate:-1deg}50%{translate:0 -14px;rotate:1deg}}
@keyframes ss-rise{0%{translate:0 0;scale:1;opacity:.9}100%{translate:0 -130px;scale:.35;opacity:0}}
@keyframes ss-twinkle{0%,100%{scale:1;rotate:0deg;opacity:1}50%{scale:1.35;rotate:20deg;opacity:.6}}
@keyframes ss-drift{0%{translate:0 40px;opacity:0}15%{opacity:1}85%{opacity:.75}100%{translate:0 -180px;opacity:0}}
@keyframes ss-float{0%,100%{translate:0 0;scale:1}50%{translate:0 -18px;scale:1.05}}
@keyframes ss-wobble{0%,100%{rotate:-5deg}50%{rotate:5deg}}
@keyframes ss-marquee{from{translate:0 0}to{translate:-50% 0}}
@keyframes ss-nudge{0%,100%{translate:0 -50%}50%{translate:5px -50%}}
}

@container (max-width:1080px){.ss-link-x{display:none}}
@container (max-width:900px){
.ss-nav-cta{display:none}
.ss-c3,.ss-c4{grid-template-columns:repeat(2,minmax(0,1fr))}
.ss-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
.ss-arrow{display:none}
.ss-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.ss-foot-about{grid-column:1 / -1}
.ss-track{--ss-gc:var(--ss-gc-md)}
}
@container (max-width:780px){
.ss-hero-grid,.ss-about,.ss-cta-grid{grid-template-columns:minmax(0,1fr)}
.ss-art{width:100%;max-width:460px;min-height:0;margin:8px auto 0;padding:36px 0 8px}
.ss-frame{margin:0 auto}
.ss-split{grid-template-columns:minmax(0,1fr);min-height:0}
.ss-split-text{padding:64px var(--ss-gutter) 80px}
.ss-split-photo{min-height:0;aspect-ratio:4/3;border-left:0;border-top:4px solid var(--ss-ink)}
.ss-statbox{max-width:none}
}
@container (max-width:600px){
.ss-links{display:none}
.ss-nav-in{min-height:64px;gap:12px}
.ss-brand-name{font-size:22px}
.ss-brand-emo{width:40px;height:40px;font-size:22px}
.ss-hero{padding:44px 0 76px}
.ss-hero.ss-has-media{min-height:clamp(540px,84vh,760px);align-items:flex-end;padding-bottom:56px}
.ss-hero-scrim{background:var(--ss-scrim)}
.ss-hero>.ss-bubbles .ss-wide,.ss-deco .ss-wide{display:none}
.ss-h1,.ss-split .ss-h1{margin-top:22px;font-size:clamp(42px,12.5cqi,58px)}
.ss-lead{margin-top:18px;font-size:17px}
.ss-actions{flex-direction:column;align-items:stretch;margin-top:30px}
.ss-btn{min-height:56px;font-size:20px}
.ss-area{margin-top:24px}
.ss-split-text{padding:44px var(--ss-gutter) 72px}
.ss-trust-in{flex-direction:column;align-items:flex-start;gap:12px}
.ss-section{padding:76px 0}
.ss-head{margin-bottom:40px}
.ss-h2{font-size:clamp(34px,10cqi,44px)}
.ss-cta .ss-h2{font-size:clamp(36px,10.5cqi,46px)}
.ss-c1,.ss-c2,.ss-c3,.ss-c4,.ss-steps{grid-template-columns:minmax(0,1fr)}
.ss-g2,.ss-g3{grid-template-columns:minmax(0,1fr)}
.ss-g1 .ss-shot,.ss-g2 .ss-shot,.ss-g3 .ss-shot{aspect-ratio:4/3}
.ss-track{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc(-1 * var(--ss-gutter));padding:8px var(--ss-gutter) 20px;scroll-padding:0 var(--ss-gutter)}
.ss-track .ss-shot{flex:0 0 78%;scroll-snap-align:start}
.ss-swipe{display:block}
.ss-why{padding-bottom:104px}
/* Phones: steps and reasons read as compact rows (badge left, text right). */
.ss-steps{gap:18px}
.ss-step{display:grid;grid-template-columns:56px minmax(0,1fr);grid-template-areas:"num title" "emo desc";column-gap:16px;align-items:start;padding:22px 22px 24px;text-align:left}
.ss-num{grid-area:num;font-size:44px;text-align:center}
.ss-step-emo{grid-area:emo;margin-top:8px;font-size:30px}
.ss-step-title{grid-area:title;align-self:center;margin-top:0;font-size:24px}
.ss-step p{grid-area:desc;margin-top:4px}
.ss-why-card{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"icon title" "icon desc";column-gap:16px;padding:24px 22px}
.ss-why-emo{grid-area:icon;font-size:36px}
.ss-why-title{grid-area:title;margin-top:0;font-size:23px}
.ss-why-card p{grid-area:desc;margin-top:6px}
.ss-sticker{width:68px;height:68px;font-size:30px}
.ss-book{box-shadow:6px 6px 0 var(--ss-ink)}
.ss-foot-grid{grid-template-columns:minmax(0,1fr)}
.ss-foot-bottom{flex-direction:column;align-items:flex-start}
}
`;

const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// The old editor seed shipped U+1FAA7 PLACARD where BUBBLES (U+1FAE7) was
// meant; saved howSteps / whyCards still carry it.
const fixEmoji = (v) => (typeof v === 'string' ? v.replace(/\u{1FAA7}/gu, '\u{1FAE7}') : v);
const BUBBLES = '\u{1FAE7}';

// "a, b and c" / "a or b".
function joinWords(items, last = 'and') {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${last} ${items[items.length - 1]}`;
}

// ---- Color: hue-turned siblings of the owner's accent -------------------
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
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
// The accent turned by `turn` degrees, saturation capped and lightness held
// in a band, so every palette gets a family of suds in its own key (a gray
// accent stays gray: the owner chose a quiet palette).
const turnHue = (h, turn) => (((h + turn) % 360) + 360) % 360;
const hueDist = (a, b) => {
  const d = turnHue(a, -b);
  return Math.min(d, 360 - d);
};
function sibling(accent, turn, sMax, lMin, lMax) {
  const { h, s, l } = toHsl(accent);
  return fromHsl(turnHue(h, turn), Math.min(s, sMax), clamp(l, lMin, lMax));
}
// The "bubble" color (hero wash, car, Why Us band) must stay a cool
// cyan-to-violet: a plain hue turn sends a blue accent to brown and a cyan
// one to maroon. The first turn landing in the cool range wins, so the
// default amber keeps its +165 sky blue.
function bubbleTurn(h) {
  return [165, 60, -60, -120, 120, 180].find((t) => {
    const x = turnHue(h, t);
    return x >= 175 && x <= 290;
  }) ?? 165;
}
// The Contact band: bubblegum pink when that stands apart from both the
// accent and the bubble color (the default amber gives the mockup's pink),
// else the nearest hue turn that does.
function gumTurn(h, bubbleHue) {
  return [340 - h, -58, 58, 180].find((t) => {
    const x = turnHue(h, t);
    return hueDist(x, h) >= 45 && hueDist(x, bubbleHue) >= 45;
  }) ?? -58;
}
// fg repaired until it reads on every background in bgs.
function readableOnAll(fg, bgs, min = 4.5) {
  let out = fg;
  for (let pass = 0; pass < 3; pass++) {
    for (const bg of bgs) out = ensureContrast(out, bg, min);
    if (bgs.every((bg) => contrastRatio(out, bg) >= min)) break;
  }
  return out;
}
// fg blended toward `to` until it reads on every bg: for type on a band
// with a fixed text direction (white on the deep blue), where flipping to
// the other extreme, as ensureContrast may, would be wrong.
function pushToward(fg, to, bgs, min = 4.5) {
  for (let i = 0; i <= 20; i++) {
    const c = mix(fg, to, i / 20);
    if (bgs.every((bg) => contrastRatio(c, bg) >= min)) return c;
  }
  return to;
}
// The better of the candidate text colors on bg, repaired to 4.5:1.
function bestText(bg, candidates) {
  const best = candidates.reduce((a, b) => (contrastRatio(b, bg) > contrastRatio(a, bg) ? b : a));
  return ensureContrast(best, bg, 4.5);
}

function sudsTokens(t) {
  const white = '#ffffff';
  const black = '#000000';
  const accentHue = toHsl(t.accent).h;
  const blueTurn = bubbleTurn(accentHue);
  const pop2 = sibling(t.accent, blueTurn, 0.78, 0.46, 0.56); // bubble blue
  const pop3 = sibling(t.accent, gumTurn(accentHue, turnHue(accentHue, blueTurn)), 0.92, 0.6, 0.68); // bubblegum
  const pop4 = sibling(t.accent, 95, 0.6, 0.42, 0.52); // mint
  const pop5 = sibling(t.accent, 225, 0.7, 0.6, 0.7); // lavender
  const peach = mix(t.accent, pop3, 0.4);
  // Outlines and hard shadows: the page ink on light palettes, a near-black
  // cut of the page on dark ones (a light outline reads as a glow there).
  const ink = t.isDark ? mix(t.bg, black, 0.62) : t.text;
  const deep = t.isDark ? mix(t.bg, black, 0.35) : t.text;
  const paper = t.isDark ? mix(t.surface, t.text, 0.05) : mix(t.bg, white, 0.82);
  // Card tints. Light palettes: a wash of each suds color over the paper.
  // Dark palettes: the hue at the paper's depth, since blending a warm
  // accent into a cool dark paper (amber into navy) turns to mud-gray;
  // the warm accent/peach cards give way to jewel tones there.
  // Deep yellows and oranges read as olive and brown, so on the card tints
  // those hues move to petrol or teal (the accent's own tints keep its hue).
  const paperL = toHsl(paper).l;
  const deepTint = (c, sMax = 0.4, keepHue = false) => {
    const { h, s } = toHsl(c);
    const hue = keepHue ? h : h >= 15 && h < 62 ? 195 : h >= 62 && h <= 100 ? 160 : h;
    return fromHsl(hue, Math.min(s, sMax), clamp(paperL + 0.05, 0.19, 0.3));
  };
  const tints = t.isDark
    ? [pop3, pop2, pop5, pop4, mix(pop3, pop5, 0.5), mix(pop2, pop4, 0.5)].map((c) => deepTint(c))
    : [pop3, pop2, t.accent, pop4, peach, pop5].map((c) => mix(paper, c, 0.15));
  const accentPale = t.isDark ? deepTint(t.accent, 0.5, true) : mix(paper, t.accent, 0.32);
  const awardBg = t.isDark ? deepTint(t.accent, 0.55, true) : mix(paper, t.accent, 0.22);
  const cardBgs = [paper, t.surface, ...tints, accentPale, awardBg];

  const onAccent = bestText(t.accent, [deep, white]);
  // The mockup's clear sky wash: the bubble hue, lightly tinted by the
  // owner's page color (a straight blend with a cream page reads gray).
  const heroBg = t.isDark
    ? mix(t.bg, pop2, 0.2)
    : mix(fromHsl(toHsl(pop2).h, Math.min(toHsl(pop2).s, 0.75), 0.935), t.bg, 0.3);

  // Deep enough for white type even on the lighter hover/card fills.
  const whyBg = ensureContrast(pop2, white, 6.4);
  const whyCard = mix(whyBg, white, 0.1);
  // Hover lightens the card, but never past 4.5:1 for its white type
  // (grays and teals lose contrast fastest).
  const whyHover = [0.16, 0.14, 0.12, 0.1].map((k) => mix(whyBg, white, k)).find((c) => contrastRatio(white, c) >= 4.6) || whyCard;

  // Bubblegum band; on dark palettes a deeper raspberry cut of it with
  // white type, so it glows instead of shouting against the dark page.
  const ctaBg = t.isDark ? fromHsl(toHsl(pop3).h, Math.min(toHsl(pop3).s, 0.62), 0.38) : pop3;
  const ctaText = bestText(ctaBg, [white, deep]);

  const footerBg = t.isDark ? mix(t.bg, black, 0.45) : mix(t.text, black, 0.25);
  const footerText = ensureContrast(t.isDark ? t.text : t.bg, footerBg, 4.5);
  const footerAccent = ensureContrast(t.accent, footerBg, 4.5);
  const navCtaBg = t.isDark ? ink : t.text;

  return {
    tints,
    pop2,
    pop3,
    ink,
    car: {
      body: pop2,
      deep: mix(pop2, black, 0.22),
      glass: mix(pop2, white, 0.78),
      tire: t.isDark ? mix(t.bg, black, 0.55) : mix(t.text, black, 0.2),
      rim: mix(t.isDark ? t.text : t.bg, pop2, 0.25),
      hub: t.accent,
      head: mix(t.accent, white, 0.35),
      tail: pop3,
      outline: ink,
    },
    vars: {
      '--ss-ink': ink,
      '--ss-on-accent': onAccent,
      '--ss-focus': t.isDark ? t.accentText : t.text,
      '--ss-focus-inv': white,
      '--ss-card-bg': paper,
      '--ss-card-text': readableOnAll(t.text, cardBgs),
      '--ss-card-muted': readableOnAll(t.textMuted, cardBgs),
      '--ss-accent-pale': accentPale,
      '--ss-award-bg': awardBg,
      // The owner's secondary color: the Reviews band and the fact chips.
      '--ss-alt-bg': t.surface,
      '--ss-alt-text': t.text,
      '--ss-alt-muted': t.textMuted,
      '--ss-chip-bg': t.isDark ? paper : t.surface,
      // Behind the 🫧 marks: pale and white bubbles vanish on white paper.
      '--ss-bubble-bg': mix(paper, pop2, 0.3),
      '--ss-tint-2': tints[1],
      '--ss-pop-ink': readableOnAll(pop2, [t.bg, t.surface], 3.2),
      '--ss-num': readableOnAll(pop2, cardBgs, 3.2),
      '--ss-dash': alpha(t.isDark ? t.text : ink, 0.24),
      '--ss-nav-bg': t.accent,
      '--ss-nav-text': onAccent,
      '--ss-navcta-bg': navCtaBg,
      '--ss-navcta-text': ensureContrast(t.accent, navCtaBg, 4.5),
      '--ss-shade': mix(t.accent, black, 0.32),
      '--ss-hero-bg': heroBg,
      '--ss-hero-text': readableOnAll(t.text, [heroBg]),
      '--ss-hero-muted': readableOnAll(t.textMuted, [heroBg]),
      '--ss-hero-em': readableOnAll(pop2, [heroBg], 3.2),
      '--ss-bubble-line': alpha(pop2, t.isDark ? 0.5 : 0.38),
      '--ss-bubble-fill': alpha(mix(pop2, white, 0.65), t.isDark ? 0.14 : 0.32),
      '--ss-car-glow': alpha(pop2, 0.3),
      '--ss-trust-bg': footerBg,
      '--ss-trust-text': footerAccent,
      '--ss-process-bg': t.accent,
      '--ss-process-text': onAccent,
      '--ss-process-muted': ensureContrast(mix(onAccent, t.accent, 0.28), t.accent, 4.5),
      '--ss-process-em': readableOnAll(pop2, [t.accent], 3.2),
      '--ss-why-bg': whyBg,
      '--ss-why-text': white,
      '--ss-why-muted': pushToward(mix(white, whyBg, 0.2), white, [whyBg, whyCard, whyHover]),
      '--ss-why-em': readableOnAll(t.accent, [whyBg], 3.2),
      '--ss-why-faint': alpha(white, 0.3),
      '--ss-whycard-bg': whyCard,
      '--ss-whycard-text': white,
      '--ss-whycard-muted': pushToward(mix(white, whyBg, 0.2), white, [whyBg, whyCard, whyHover]),
      '--ss-whycard-hover': whyHover,
      '--ss-whycard-line': alpha(white, 0.4),
      '--ss-cta-bg': ctaBg,
      '--ss-cta-text': ctaText,
      '--ss-cta-muted': ensureContrast(mix(ctaText, ctaBg, 0.24), ctaBg, 4.5),
      '--ss-footer-bg': footerBg,
      '--ss-footer-text': footerText,
      '--ss-footer-muted': ensureContrast(mix(footerText, footerBg, 0.3), footerBg, 4.5),
      '--ss-footer-accent': footerAccent,
      '--ss-footer-line': alpha(footerText, 0.18),
      '--ss-footer-line-strong': alpha(footerText, 0.32),
      '--ss-scrim': t.heroScrim,
      '--ss-scrim-left': t.heroScrimLeft,
      '--ss-on-hero': t.onHero,
      '--ss-on-hero-muted': alpha(t.onHero, 0.9),
    },
  };
}

// Heading weight: Boogaloo (the default) is a single-weight display face;
// a custom heading font gets its bold cut when the catalog loads one.
function headWeight(stack) {
  const fam = catalogFamily(familiesFromStack(stack)[0]);
  const weights = fam ? FONT_CATALOG[fam].weights : [];
  if (weights.length === 0) return 400;
  return weights.includes(700) ? 700 : Math.max(...weights);
}

// ---- Hours (same rules as MobileChrome) ----------------------------------
// Only the per-day editor's shape (exactly the seven HOURS_DAYS keys, '' =
// closed) may say a day is "Closed". Older free text keeps its wording: day
// or day-range keys become one row each, anything else one line.
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
// Short enough for the trust strip: up to two open rows, or short free text.
function hoursFact(rows) {
  if (rows.length === 1 && !rows[0].time) return rows[0].days.length <= 40 ? rows[0].days : null;
  const open = rows.filter((r) => r.time && !/^closed$/i.test(r.time));
  return open.length > 0 && open.length <= 2 ? open.map((r) => `${r.days} ${r.time}`).join('\n') : null;
}

// ---- Default How It Works / Why Us copy -----------------------------------
// Shown until the owner edits the panels (copy.howSteps / copy.whyCards).
// Plain descriptions of how booking works: no speed promises, guarantees,
// product brands or eco claims the owner never made.
const CLEANING_TYPES = ['mobile_detailing', 'detailing_shop', 'car_wash'];
const KNOWN_TYPES = [...CLEANING_TYPES, 'tint_shop', 'wheel_shop', 'mechanic_shop'];

// Older sites store free-form types ("detailing"): map them onto the
// wizard's ids so the badge, fallbacks and default copy still fit.
function businessKind(value) {
  const raw = txt(value);
  if (!raw || KNOWN_TYPES.includes(raw)) return raw;
  if (/mobile/i.test(raw)) return 'mobile_detailing';
  if (/wash/i.test(raw)) return 'car_wash';
  if (/detail/i.test(raw)) return 'detailing_shop';
  if (/tint|film/i.test(raw)) return 'tint_shop';
  if (/wheel|tire|rim/i.test(raw)) return 'wheel_shop';
  if (/mechanic|repair/i.test(raw)) return 'mechanic_shop';
  return raw;
}

function defaultSteps(type) {
  const book = { emoji: '📱', title: 'You Book', desc: 'Call, text or tap Book and pick a time that works for you.' };
  const love = { emoji: '😍', title: 'You Love It', desc: 'Drive off in a car that looks and feels its best.' };
  if (type === 'mobile_detailing') {
    return [
      book,
      { emoji: '🚐', title: 'We Show Up', desc: 'We come to your driveway, parking lot or office.' },
      { emoji: BUBBLES, title: 'We Clean', desc: 'We get to work while you get on with your day.' },
      { ...love, desc: 'Hop back into a car that looks and feels fresh.' },
    ];
  }
  if (type === 'car_wash') {
    return [
      { emoji: '🚗', title: 'Pull In', desc: 'Swing by and pick the wash that suits your car.' },
      { emoji: BUBBLES, title: 'We Wash', desc: 'Soap, rinse and a careful dry, inside and out.' },
      { emoji: '✨', title: 'You Shine', desc: 'Drive off clean and ready for the road.' },
    ];
  }
  const work = {
    tint_shop: 'We prep the glass and install your film with care.',
    wheel_shop: 'We mount, balance and fit everything properly.',
    mechanic_shop: 'We diagnose, explain what we find and get it fixed.',
  }[type] || 'We clean, correct and protect every surface with care.';
  return [
    book,
    { emoji: '🚗', title: 'Drop It Off', desc: 'Bring your car to us at your appointment time.' },
    { emoji: '✨', title: 'We Get To Work', desc: work },
    love,
  ];
}

function defaultWhy(type, fb) {
  const booking = { icon: '📅', title: 'Easy Booking', desc: 'Call or message us and pick a time that suits you.' };
  const talk = { icon: '💬', title: 'Straight Talk', desc: 'We tell you what your car needs, and what it doesn’t, before we start.' };
  const obsessed = { icon: '🧽', title: 'Detail-Obsessed', desc: 'Every panel, seat and crevice gets real attention, not a quick once-over.' };
  const lead = {
    mobile_detailing: { icon: '🏠', title: 'We Come To You', desc: 'Home, work or wherever your car is parked: we bring the detail to you.' },
    detailing_shop: { icon: '✨', title: 'Careful Work', desc: 'Hands-on detailing for paint, glass and interior, done properly.' },
    car_wash: { icon: BUBBLES, title: 'Spotless Results', desc: 'A thorough clean inside and out, with care for your paint.' },
    tint_shop: { icon: '🕶️', title: 'Precision Installs', desc: 'Clean, careful film installs cut to fit your vehicle.' },
    wheel_shop: { icon: '🛞', title: 'The Right Fit', desc: 'We help you choose wheels and tires that suit your car and your style.' },
    mechanic_shop: { icon: '🔧', title: 'Honest Diagnosis', desc: 'We explain what we find and what it costs before any work starts.' },
  }[type] || { icon: '✨', title: fb.whyUsTitle, desc: 'Careful, hands-on work on every vehicle we see.' };
  const second = CLEANING_TYPES.includes(type) || !type
    ? obsessed
    : { icon: '🧰', title: 'Done Right', desc: 'Careful work on exactly what your car needs, nothing more.' };
  return [lead, second, booking, talk];
}

// ---- Decorative pieces -----------------------------------------------------
// Resting spots clear of the headline and buttons on wide screens (they
// drift up through the copy only while animating). `w`: wide screens only,
// since on a phone the copy spans the full width.
const HERO_BUBBLES = [
  { s: 64, x: 1, y: 84, d: 10, dl: 0 },
  { s: 26, x: 43, y: 12, d: 8, dl: 1.4, w: true },
  { s: 92, x: 45, y: 72, d: 12, dl: 2.6, w: true },
  { s: 20, x: 54, y: 6, d: 7, dl: 0.6 },
  { s: 48, x: 90, y: 64, d: 9, dl: 3.2 },
  { s: 34, x: 95, y: 12, d: 8.5, dl: 1.9 },
  { s: 16, x: 66, y: 34, d: 6.5, dl: 4.1, w: true },
  { s: 40, x: 30, y: 90, d: 11, dl: 5.2 },
];
const CAR_BUBBLES = [
  { s: 22, x: 30, y: 34, d: 2.8, dl: 0 },
  { s: 14, x: 44, y: 26, d: 2.2, dl: 0.9 },
  { s: 30, x: 56, y: 36, d: 3.4, dl: 1.6 },
  { s: 12, x: 66, y: 30, d: 2.5, dl: 0.4 },
  { s: 18, x: 38, y: 42, d: 3, dl: 2.2 },
  { s: 24, x: 72, y: 40, d: 3.6, dl: 1.1 },
];
const SPARKS = [
  { e: '✨', top: '6%', right: '16%', size: 26, dl: 0 },
  { e: '💫', top: '20%', left: '10%', size: 20, dl: 0.5 },
  { e: '✨', bottom: '16%', right: '6%', size: 30, dl: 1 },
  { e: BUBBLES, top: '2%', left: '32%', size: 22, dl: 0.8 },
];
// Section-edge bubbles, kept in the side gutters; the big left one sits
// under the headings on a phone, so it is wide-screen only.
const FLOATS = [
  { s: 120, x: -5, y: 14, d: 8, dl: 0, w: true },
  { s: 56, x: 93, y: 30, d: 6.5, dl: 1.2 },
  { s: 80, x: 88, y: 78, d: 9, dl: 2 },
];
const SERVICE_EMOJI = ['🚿', '✨', '🧹', '🛡️', '🎨', '⚡'];
const QUOTE_DECO = ['🤩', '🫶', '😂'];

const bubbleStyle = (b) => ({ width: b.s, height: b.s, left: `${b.x}%`, top: `${b.y}%`, '--d': `${b.d}s`, '--dl': `${b.dl}s` });

function HeroBubbles() {
  return (
    <div className="ss-bubbles" aria-hidden="true">
      {HERO_BUBBLES.map((b, i) => <span key={i} className={`ss-bub${b.w ? ' ss-wide' : ''}`} style={bubbleStyle(b)} />)}
    </div>
  );
}

function Floats() {
  return (
    <div className="ss-deco" aria-hidden="true">
      {FLOATS.map((b, i) => <span key={i} className={`ss-bub ss-float${b.w ? ' ss-wide' : ''}`} style={{ ...bubbleStyle(b), opacity: 0.7 }} />)}
    </div>
  );
}

// The mockup's cartoon car, painted in the owner's suds colors.
function CarArt({ c }) {
  return (
    <svg viewBox="0 0 420 280" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <ellipse cx="210" cy="252" rx="164" ry="16" fill="rgba(0,0,0,.12)" />
      <path d="M110 162 C120 110 150 88 180 84 L240 84 C270 84 300 110 312 162 Z" fill={c.deep} stroke={c.outline} strokeWidth="3" strokeLinejoin="round" />
      <path d="M132 154 C139 122 158 105 178 101 L205 101 L205 154 Z" fill={c.glass} />
      <path d="M215 154 L215 101 L240 101 C262 105 279 120 288 154 Z" fill={c.glass} />
      <path d="M146 112 Q164 101 186 104" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".6" />
      <rect x="38" y="158" width="344" height="76" rx="20" fill={c.body} stroke={c.outline} strokeWidth="3" />
      <path d="M62 176 Q130 166 196 170" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity=".4" />
      <line x1="210" y1="166" x2="210" y2="226" stroke="#fff" strokeWidth="2.5" strokeDasharray="5 5" opacity=".6" />
      <rect x="150" y="190" width="30" height="8" rx="4" fill="#fff" opacity=".8" />
      <rect x="240" y="190" width="30" height="8" rx="4" fill="#fff" opacity=".8" />
      <rect x="42" y="176" width="32" height="20" rx="8" fill={c.head} stroke={c.outline} strokeWidth="2.5" />
      <rect x="346" y="176" width="32" height="20" rx="8" fill={c.tail} stroke={c.outline} strokeWidth="2.5" />
      {[108, 312].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="234" r="34" fill={c.tire} stroke={c.outline} strokeWidth="3" />
          <circle cx={cx} cy="234" r="18" fill={c.rim} />
          <circle cx={cx} cy="234" r="7" fill={c.hub} />
        </g>
      ))}
    </svg>
  );
}

function HeroArt({ car }) {
  return (
    <div className="ss-art" aria-hidden="true">
      {CAR_BUBBLES.map((b, i) => <span key={i} className="ss-cb" style={bubbleStyle(b)} />)}
      <div className="ss-car"><CarArt c={car} /></div>
      {SPARKS.map(({ e, size, dl, ...pos }, i) => (
        <span key={i} className="ss-spark" style={{ ...pos, fontSize: size, '--dl': `${dl}s` }}>{e}</span>
      ))}
    </div>
  );
}

// Published stand-in for a missing about photo: a bubble with the
// business initial (never an "upload a photo" box).
function BubbleMono({ name }) {
  const letter = (txt(name).match(/[A-Za-z0-9]/) || [BUBBLES])[0].toUpperCase();
  return (
    <div className="ss-mono" aria-hidden="true">
      <HeroBubbles />
      <div className="ss-mono-bubble"><span className="ss-mono-letter">{letter}</span></div>
    </div>
  );
}

function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="ss-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

function Tag({ emoji, children, className = '' }) {
  return (
    <p className={`ss-tag ${className}`}>
      {emoji && <span className="ss-emo" aria-hidden="true">{emoji}</span>}
      {children}
    </p>
  );
}

const fill = { position: 'absolute', inset: 0, height: '100%' };

export default function MobileSudsy({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const suds = sudsTokens(t);
  const font = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const type = businessKind(biz.businessType);
  const fb = getFallbacks(type);
  const isMobile = type === 'mobile_detailing';
  const cleaning = !type || CLEANING_TYPES.includes(type);

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrder(copy, sections.map((s) => s.id));

  const name = txt(biz.businessName);
  const brandName = name || fb.navSubtitle;
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const email = txt(biz.email);
  const address = txt(biz.address);
  const city = txt(biz.city);
  const place = [city, txt(biz.state)].filter(Boolean).join(', ');
  const area = txt(biz.serviceArea);
  const years = txt(biz.yearsInBusiness);
  const hours = hoursRows(biz.hours);
  const hoursSummary = hoursFact(hours);
  const payments = list(biz.paymentMethods).map(txt).filter(Boolean);
  const awards = list(biz.awards).map(txt).filter(Boolean);

  // Services: the owner's Services tab (businessInfo.services, mirrored to
  // packages) wins; a service the owner kept without a description borrows
  // the AI description of the same name. Then the AI list, then the
  // wizard's plain service names.
  const norm = (s) => (typeof s === 'string' ? { name: s } : s || {});
  const aiItems = list(copy.servicesSection?.items).map(norm)
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }))
    .filter((s) => s.name || s.description);
  const aiDesc = (n) => aiItems.find((s) => s.name && s.name.toLowerCase() === n.toLowerCase())?.description || '';
  const packages = list(biz.packages).map(norm)
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }))
    .filter((s) => s.name || s.description || s.price);
  const fromPackages = packages.length > 0;
  const services = fromPackages
    ? packages.map((s) => (s.description || !s.name ? s : { ...s, description: aiDesc(s.name) }))
    : aiItems.length > 0
      ? aiItems
      : list(biz.services).filter((s) => typeof s === 'string' && s.trim()).map((s) => ({ name: s.trim(), price: '', description: '' }));
  const gridFor = (n) => (n === 1 ? 'ss-c1' : n === 2 || n === 4 ? 'ss-c2' : 'ss-c3');

  const howSteps = (Array.isArray(copy.howSteps) ? copy.howSteps : defaultSteps(type))
    .map((s) => ({ emoji: fixEmoji(txt(s?.emoji)), title: txt(s?.title), desc: txt(s?.desc) }))
    .filter((s) => s.title || s.desc);
  const whyCards = (Array.isArray(copy.whyCards) ? copy.whyCards : defaultWhy(type, fb))
    .map((c) => ({ icon: fixEmoji(txt(c?.icon)), title: txt(c?.title), desc: txt(c?.desc) }))
    .filter((c) => c.title || c.desc);

  // Stats only from what the owner entered (About > Stats Box). They sit in
  // the About panel when it is in stats mode, else lead the trust strip.
  const ownerStats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label);
  const aboutStatsMode = (copy.aboutLayout || 'image') === 'stats';
  const aboutShowsStats = aboutStatsMode && ownerStats.length > 0 && show('about');

  // Trust strip (the mockup's bar under the hero), owner facts only.
  const trust = [
    ...(!aboutShowsStats ? ownerStats.slice(0, 3).map((s) => ({ emo: '✨', text: `${s.value} ${s.label}` })) : []),
    years && { emo: '🗓️', text: /^\d+\+?$/.test(years) ? `${years} ${years === '1' ? 'year' : 'years'} in business` : years },
    hoursSummary && { emo: '🕐', text: hoursSummary },
    payments.length > 0 && { emo: '💳', text: `Pay with ${joinWords(payments, 'or')}` },
  ].filter(Boolean);
  if (trust.length < 2 && place) trust.push({ emo: '📍', text: `Based in ${place}` });
  const trustItems = trust.length >= 2 ? trust.slice(0, 5) : [];

  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);

  const testimonials = list(copy.testimonialPlaceholders).filter((q) => txt(q?.text));
  const reviews = copy.googleWidgetKey ? 'google' : testimonials.length > 0 ? 'quotes' : null;

  const servicesAnchor = show('services') && services.length > 0 ? '#services' : null;
  const navLinks = [
    servicesAnchor && { href: '#services', label: 'Services' },
    show('process') && howSteps.length > 0 && { href: '#how', label: 'How It Works', extra: true },
    show('about') && { href: '#about', label: 'About', extra: true },
    show('gallery') && galleryImages.length > 0 && { href: '#gallery', label: 'Gallery', extra: true },
    show('testimonials') && reviews && { href: '#reviews', label: 'Reviews' },
    show('cta') && { href: '#contact', label: 'Contact' },
  ].filter(Boolean);

  // Hero buttons: the editor's Primary/Secondary Button text + URL fields.
  // Without a URL the primary goes to the contact section and opens the
  // booking widget when booking is on; the secondary follows its label
  // ("View Our Services" -> #services), else calls, as the editor promises.
  const primaryUrl = txt(copy.ctaPrimaryUrl);
  const heroPrimary = {
    href: primaryUrl || '#contact',
    label: txt(copy.ctaPrimary) || (cleaning ? 'Book a Detail!' : 'Book Now!'),
    book: !primaryUrl,
  };
  const secondaryUrl = txt(copy.ctaSecondaryUrl);
  const secondaryLabel = txt(copy.ctaSecondary);
  let heroSecondary = null;
  if (secondaryUrl) heroSecondary = { href: secondaryUrl, label: secondaryLabel || 'Learn More' };
  else if (secondaryLabel) {
    // Live labels include "See Our Services", "See What We Do" and "Give Us
    // a Call".
    const galleryAnchor = show('gallery') && galleryImages.length > 0 ? '#gallery' : null;
    let href = tel || servicesAnchor || '#contact';
    if (/servic|price|package|menu|what we|offer/i.test(secondaryLabel)) href = servicesAnchor || href;
    else if (/gallery|photo|our work/i.test(secondaryLabel)) href = galleryAnchor || servicesAnchor || href;
    else if (/about|story|learn/i.test(secondaryLabel) && show('about')) href = '#about';
    heroSecondary = { label: secondaryLabel, href };
  } else if (servicesAnchor) heroSecondary = { href: servicesAnchor, label: 'See Services' };
  else if (tel) heroSecondary = { href: tel, label: `Call ${phone}` };

  const splitHero = copy.heroLayout === 'split';
  const headline = txt(copy.headline) || name || 'Your Car Deserves Better.';
  const words = headline.split(/\s+/);
  const lastWord = words.pop();
  const badge = `${isMobile ? 'We Come To YOU' : fb.heroBadge}${city ? ` · ${city}` : ''}`;
  // Same fallback as before the kit rewrite: the business type's plain
  // one-line description, so a sparse hero never loses its lead line.
  const lead = txt(copy.subheadline) || txt(fb.subheadline);

  // Contact buttons: the editor's Contact panel (Button Text/URL, then the
  // phone button's text/URL); by default a plain call button.
  const ctaUrl = txt(copy.ctaUrl);
  const ctaBtnText = txt(copy.ctaButtonText);
  let contactPrimary = null;
  if (ctaUrl) contactPrimary = { href: ctaUrl, label: ctaBtnText || 'Book Now', book: false };
  else if (ctaBtnText) contactPrimary = { href: tel || '#contact', label: ctaBtnText, book: true };
  else if (tel) contactPrimary = { href: tel, label: `Call ${phone}`, book: false };
  else if (email) contactPrimary = { href: `mailto:${email}`, label: 'Email Us', book: false };
  const secText = txt(copy.ctaSecondaryText);
  const contactSecondaryHref = (secText && secondaryUrl) || tel;
  const contactSecondary = contactPrimary && contactSecondaryHref && (contactPrimary.book || contactPrimary.href !== contactSecondaryHref)
    ? { href: contactSecondaryHref, label: secText || `Call ${phone}` }
    : null;
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, place].filter(Boolean).join(', '))}`
    : null;

  const aboutParas = (txt(copy.aboutText) || (name ? `${name} offers ${fb.aboutFallback}${place ? ` in ${place}` : ''}.` : ''))
    .split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const aboutFacts = [
    place && { emo: '📍', text: `Based in ${place}` },
    area && { emo: '🗺️', text: `Serving ${area}` },
    years && { emo: '🗓️', text: /^\d+\+?$/.test(years) ? `${years} ${years === '1' ? 'year' : 'years'} in business` : years },
  ].filter(Boolean);

  const tagline = txt(copy.footerTagline) || (cleaning ? 'We make dirty cars shine.' : fb.footerDesc);
  const marquee = [brandName, fb.navSubtitle, place].filter(Boolean).join('  ✨  ');
  // Each half of the looping strip must outrun a wide screen (~2000px at
  // ~12px per uppercase character), or a gap shows before the loop.
  const marqueeRun = `✨  ${marquee}  `.repeat(Math.max(3, Math.ceil(2000 / ((marquee.length + 5) * 12))));

  const vars = {
    '--ss-bg': t.bg,
    '--ss-surface': t.surface,
    '--ss-text': t.text,
    '--ss-muted': t.textMuted,
    '--ss-accent': t.accent,
    '--ss-head': font,
    '--ss-body': body,
    '--ss-head-w': headWeight(font),
    '--ss-gutter': 'clamp(20px, 5cqi, 56px)',
    ...suds.vars,
  };

  const brand = (logoStyle, loading) => (images.logo ? (
    <PhotoSlot src={images.logo} alt={name ? `${name} logo` : 'Logo'} loading={loading} style={logoStyle} imgStyle={{ objectFit: 'contain' }} />
  ) : (
    <>
      <span className="ss-emo ss-brand-emo" aria-hidden="true">{BUBBLES}</span>
      <span className="ss-brand-name">{brandName}</span>
    </>
  ));

  const heroText = (withArea) => (
    <>
      <p className="ss-badge"><span aria-hidden="true">📍</span>{badge}</p>
      <h1 className="ss-h1">
        {words.length > 0 && <>{words.join(' ')} </>}
        <span className="ss-hl">{lastWord}</span>
      </h1>
      {lead && <p className="ss-lead">{lead}</p>}
      <div className="ss-actions">
        <a className="ss-btn ss-btn-primary" href={heroPrimary.href} {...(heroPrimary.book ? { 'data-scheduler-trigger': '' } : {})}>
          {heroPrimary.label}
        </a>
        {heroSecondary && (
          <a className="ss-btn ss-btn-paper" href={heroSecondary.href}>
            {heroSecondary.label}<span aria-hidden="true">→</span>
          </a>
        )}
      </div>
      {withArea && area && (
        <p className="ss-area"><span className="ss-emo" aria-hidden="true">🗺️</span>Serving {area}</p>
      )}
    </>
  );

  return (
    <div
      id="top"
      className="ss-root"
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.6 }}
    >
      <style>{CSS}</style>
      <a className="ss-skip" href="#main">Skip to content</a>

      <nav className="ss-nav" aria-label="Main" style={{ order: -1 }}>
        <div className="ss-wrap ss-nav-in">
          <a className="ss-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
            {brand({ height: 42, width: 'auto', maxWidth: 190 }, 'eager')}
          </a>
          <div className="ss-links">
            {navLinks.map((l) => (
              <a key={l.href} className={`ss-link${l.extra ? ' ss-link-x' : ''}`} href={l.href}>{l.label}</a>
            ))}
            <a className="ss-nav-cta" href={tel || '#contact'}>
              <span aria-hidden="true">{tel ? '📞' : BUBBLES}</span>{tel ? 'Call Us!' : 'Book Now!'}
            </a>
          </div>
          <MobileMenu
            links={navLinks}
            cta={tel ? { href: tel, label: `Call ${phone}` } : { href: '#contact', label: 'Contact us' }}
            colors={{ bg: suds.vars['--ss-card-bg'], text: suds.vars['--ss-card-text'], accent: t.accent, onAccent: suds.vars['--ss-on-accent'] }}
            font={body}
          />
        </div>
      </nav>

      <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
        {!show('hero') && <h1 className="ss-sr">{brandName}</h1>}

        {show('hero') && (
          <div data-section="hero" className="ss-hero-wrap" style={{ order: order('hero') }}>
            {splitHero ? (
              <header className="ss-split">
                <div className="ss-split-text">
                  <HeroBubbles />
                  {heroText(true)}
                </div>
                <div className="ss-split-photo">
                  <PhotoSlot
                    src={images.hero}
                    slot="hero"
                    alt=""
                    loading="eager"
                    fetchPriority="high"
                    style={fill}
                    fallback={<div className="ss-art-panel"><HeroBubbles /><HeroArt car={suds.car} /></div>}
                  />
                </div>
              </header>
            ) : images.hero ? (
              <header className="ss-hero ss-has-media">
                <div className="ss-hero-media">
                  <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
                </div>
                <div className="ss-hero-scrim" />
                <div className="ss-wrap">
                  <div className="ss-hero-body">{heroText(true)}</div>
                </div>
              </header>
            ) : (
              <>
                <header className="ss-hero">
                  <HeroBubbles />
                  <div className="ss-wrap ss-hero-grid">
                    <div className="ss-hero-body">
                      {heroText(true)}
                      <EditorHint>{PHOTO_HINTS.hero}</EditorHint>
                    </div>
                    <HeroArt car={suds.car} />
                  </div>
                </header>
                <div className="ss-teeth" aria-hidden="true" />
              </>
            )}
            {trustItems.length > 0 ? (
              <section className="ss-trust" aria-label="At a glance">
                <ul className="ss-wrap ss-trust-in">
                  {trustItems.map((f, i) => (
                    <li key={`${f.text}-${i}`} className="ss-trust-item">
                      <span className="ss-emo" aria-hidden="true">{f.emo}</span>{f.text}
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <EditorOnly>
                <div className="ss-wrap" data-acg-editor-only="" style={{ paddingTop: 20 }}>
                  <p className="ss-hint" style={{ marginTop: 0 }}>A fun facts strip shows here once you add at least two: Years in Business or Hours in Edit &gt; Business Info, or stats in Edit &gt; About &gt; Stats Box.</p>
                </div>
              </EditorOnly>
            )}
          </div>
        )}

        {show('services') && (services.length > 0 || editor) && (
          <section data-section="services" id="services" className="ss-section" aria-labelledby="ss-services-h" style={{ order: order('services') }}>
            <ServiceCardCss />
            <Floats />
            <div className="ss-wrap">
              <div className="ss-head" data-acg-reveal="">
                <Tag emoji={BUBBLES}>Our Services</Tag>
                <h2 id="ss-services-h" className="ss-h2">
                  {txt(copy.servicesSection?.title) || (cleaning ? <>We clean <em>everything.</em></> : <>What we <em>do best.</em></>)}
                </h2>
                {txt(copy.servicesSection?.intro) && <p className="ss-sub">{copy.servicesSection.intro}</p>}
              </div>
              {services.length > 0 ? (
                <div className={`ss-grid ${gridFor(services.length)}`}>
                  {services.map((s, i) => (
                    <div key={`${s.name}-${i}`} className="ss-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                      <article className="acg-svc-card ss-card" style={{ '--ss-tint': suds.tints[i % suds.tints.length] }}>
                        <span className="ss-card-emo" aria-hidden="true">{SERVICE_EMOJI[i % SERVICE_EMOJI.length]}</span>
                        {s.name && <h3 className="ss-card-title">{s.name}</h3>}
                        <ServiceDescription
                          id={`svc-more-${fromPackages ? 'pkg' : 'ai'}-${i}`}
                          text={s.description}
                          style={{ marginTop: 10, color: 'var(--ss-card-muted)', fontSize: 15.5, fontWeight: 600, lineHeight: 1.65 }}
                          accentColor="var(--ss-card-text)"
                        />
                        <div className="acg-svc-foot">
                          <div className="ss-price-row">
                            <BookNowLink serviceName={s.name} phone={phone} label={<>Book now <span aria-hidden="true">→</span></>} />
                            {s.price && <span className="ss-price">{s.price}</span>}
                          </div>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              ) : (
                <EditorHint>Add your services and prices in Edit &gt; Services.</EditorHint>
              )}
            </div>
          </section>
        )}

        {show('process') && howSteps.length > 0 && (
          <section data-section="process" id="how" className="ss-section ss-band ss-process" aria-labelledby="ss-how-h" style={{ order: order('process') }}>
            <div className="ss-marquee ss-marquee-top" aria-hidden="true">
              <span>{BUBBLES.repeat(40)}</span><span>{BUBBLES.repeat(40)}</span>
            </div>
            <div className="ss-wrap">
              <div className="ss-head" data-acg-reveal="">
                <Tag emoji="🗺️" className="ss-tag-l ss-tag-paper">Super Simple</Tag>
                <h2 id="ss-how-h" className="ss-h2">How it <em>works</em> <span aria-hidden="true">🤔</span></h2>
                <p className="ss-sub">Spoiler: it’s embarrassingly easy.</p>
              </div>
              <ol className="ss-steps" style={{ '--ss-n': howSteps.length <= 4 ? howSteps.length : 3 }}>
                {howSteps.map((s, i) => (
                  <li key={i} className="ss-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 4) * 90}ms` }}>
                    <div className="ss-step">
                      {i < howSteps.length - 1 && howSteps.length <= 4 && <span className="ss-arrow" aria-hidden="true">→</span>}
                      <span className="ss-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                      {s.emoji && <span className="ss-step-emo" aria-hidden="true"><IconOrEmoji value={s.emoji} size={42} color="currentColor" /></span>}
                      {s.title && <h3 className="ss-step-title">{s.title}</h3>}
                      {s.desc && <p>{s.desc}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {show('whyUs') && whyCards.length > 0 && (
          <section data-section="whyUs" id="why" className="ss-section ss-band ss-why" aria-labelledby="ss-why-h" style={{ order: order('whyUs') }}>
            <div className="ss-wrap">
              <div className="ss-head" data-acg-reveal="">
                <Tag emoji="💪" className="ss-tag-paper">Why Choose Us</Tag>
                <h2 id="ss-why-h" className="ss-h2">
                  {cleaning ? <>We’re kinda <em>obsessed</em> with clean cars.</> : <>Why folks <em>choose us.</em></>}
                </h2>
              </div>
              <div className={`ss-grid ${whyCards.length === 4 ? 'ss-c4' : gridFor(whyCards.length)}`}>
                {whyCards.map((c, i) => (
                  <div key={i} className="ss-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 4) * 90}ms` }}>
                    <div className="ss-why-card">
                      {c.icon && <span className="ss-why-emo" aria-hidden="true"><IconOrEmoji value={c.icon} size={44} color="currentColor" /></span>}
                      {c.title && <h3 className="ss-why-title">{c.title}</h3>}
                      {c.desc && <p>{c.desc}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ss-marquee ss-marquee-bottom" aria-hidden="true">
              <span>{marqueeRun}</span><span>{marqueeRun}</span>
            </div>
          </section>
        )}

        {show('about') && (
          <section data-section="about" id="about" className="ss-section" aria-labelledby="ss-about-h" style={{ order: order('about') }}>
            <div className="ss-wrap ss-about">
              <div data-acg-reveal="">
                {aboutShowsStats ? (
                  <dl className="ss-statbox">
                    {ownerStats.slice(0, 4).map((s, i) => (
                      <div key={`${s.label}-${i}`} className="ss-stat" style={{ '--ss-tint': suds.tints[(i + 2) % suds.tints.length] }}>
                        <dt>{s.label}</dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="ss-frame">
                    <div className={`ss-photo${images.about || editor ? '' : ' ss-photo-mono'}`}>
                      <PhotoSlot
                        src={images.about}
                        slot="about"
                        alt={name ? `${name} at work` : 'Our work'}
                        style={fill}
                        fallback={<BubbleMono name={brandName} />}
                      />
                    </div>
                    <span className="ss-sticker" aria-hidden="true">{BUBBLES}</span>
                  </div>
                )}
                {aboutStatsMode && ownerStats.length === 0 && (
                  <EditorHint>Add your stats in Edit &gt; About &gt; Stats Box (the photo shows until then).</EditorHint>
                )}
              </div>
              <div data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                <Tag emoji="👋" className="ss-tag-l">About Us</Tag>
                <h2 id="ss-about-h" className="ss-h2">{name || fb.shopName}</h2>
                {aboutParas.length > 0 && (
                  <div className="ss-prose">
                    {aboutParas.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                )}
                {aboutFacts.length > 0 && (
                  <ul className="ss-chips ss-facts">
                    {aboutFacts.map((f) => (
                      <li key={f.text} className="ss-chip"><span aria-hidden="true">{f.emo}</span>{f.text}</li>
                    ))}
                  </ul>
                )}
                {awards.length > 0 && (
                  <div className="ss-awards" data-acg-awards="">
                    <span className="ss-label">Awards &amp; recognition</span>
                    <ul>
                      {awards.map((a, i) => <li key={`${a}-${i}`}><span aria-hidden="true">🏆</span>{a}</li>)}
                    </ul>
                  </div>
                )}
                {payments.length > 0 && (
                  <div className="ss-pay">
                    <span className="ss-label">Payment accepted</span>
                    <ul className="ss-chips">
                      {payments.map((p) => <li key={p} className="ss-chip">{p}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {show('gallery') && (galleryImages.length > 0 || editor) && (
          <section data-section="gallery" id="gallery" className="ss-section" aria-labelledby="ss-gallery-h" style={{ order: order('gallery') }}>
            <div className="ss-wrap">
              <div className="ss-head" data-acg-reveal="">
                <Tag emoji="📸">Our Work</Tag>
                <h2 id="ss-gallery-h" className="ss-h2">{cleaning ? <>Fresh out of the <em>suds.</em></> : <>Our latest <em>work.</em></>}</h2>
              </div>
              {galleryImages.length === 0 ? (
                <PhotoSlot slot="gallery" style={{ minHeight: 220, borderRadius: 26 }} />
              ) : galleryImages.length > 3 ? (
                <>
                  <div
                    className="ss-track"
                    role="region"
                    aria-label="Photo gallery"
                    tabIndex={0}
                    style={{ '--ss-gc': galleryImages.length === 4 || galleryImages.length > 6 ? 4 : 3, '--ss-gc-md': galleryImages.length % 2 === 0 ? 2 : 3 }}
                  >
                    {galleryImages.map((src, i) => (
                      <figure key={i} className="ss-shot">
                        <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      </figure>
                    ))}
                  </div>
                  <p className="ss-swipe" aria-hidden="true">Swipe for more <span>→</span></p>
                </>
              ) : (
                <div className={`ss-gal ss-g${galleryImages.length}`}>
                  {galleryImages.map((src, i) => (
                    <div key={i} data-acg-reveal="" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <figure className="ss-shot">
                        <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      </figure>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'google' && (
          <section data-section="testimonials" id="reviews" className="ss-section ss-alt" aria-label={txt(copy.googleReviewsTitle) || 'Reviews'} style={{ order: order('testimonials') }}>
            <div className="ss-wrap">
              {txt(copy.googleReviewsTitle) && (
                <div className="ss-head">
                  <Tag emoji="💬">Reviews</Tag>
                  <h2 className="ss-h2">{copy.googleReviewsTitle}</h2>
                </div>
              )}
              <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'quotes' && (
          <section data-section="testimonials" id="reviews" className="ss-section ss-alt" aria-labelledby="ss-reviews-h" style={{ order: order('testimonials') }}>
            <Floats />
            <div className="ss-wrap">
              <div className="ss-head" data-acg-reveal="">
                <Tag emoji="💬" className="ss-tag-l">Reviews</Tag>
                <h2 id="ss-reviews-h" className="ss-h2">{cleaning ? <>They used to have <em>dirty cars</em> too.</> : <>Word on the <em>street.</em></>}</h2>
              </div>
              <div className={`ss-grid ss-quotes ${gridFor(testimonials.length)}`}>
                {testimonials.map((q, i) => {
                  const who = txt(q.name);
                  const role = txt(q.role) || txt(q.vehicle);
                  const initials = who ? who.split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2) : BUBBLES;
                  return (
                    <div key={i} className="ss-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                      <figure className="ss-quote" style={{ '--ss-tint': suds.tints[[0, 1, 5][i % 3]] }}>
                        <span className="ss-quote-deco" aria-hidden="true">{QUOTE_DECO[i % QUOTE_DECO.length]}</span>
                        <span className="ss-qmark" aria-hidden="true">“</span>
                        <blockquote><p>{q.text}</p></blockquote>
                        {(who || role) && (
                          <figcaption className="ss-who">
                            <span className="ss-av" aria-hidden="true">{initials}</span>
                            <span>
                              {who && <span className="ss-who-name">{who}</span>}
                              {role && <span className="ss-who-role">{role}</span>}
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
          <section data-section="cta" id="contact" className="ss-section ss-band ss-cta" aria-labelledby="ss-contact-h" style={{ order: order('cta') }}>
            <Floats />
            <div className={`ss-wrap ss-cta-grid${contactPrimary || editor ? '' : ' ss-cta-solo'}`}>
              <div data-acg-reveal="">
                <Tag emoji="📞" className="ss-tag-l ss-tag-paper">Let’s Talk</Tag>
                <h2 id="ss-contact-h" className="ss-h2">
                  {txt(copy.ctaHeadline) || (cleaning ? 'Ready for the cleanest car of your life?' : fb.ctaHeadline)}
                </h2>
                <p className="ss-sub">
                  {txt(copy.ctaSubtext) || (isMobile
                    ? 'Tell us where your car is parked and pick a time. We’ll handle the rest.'
                    : 'Tell us what your car needs and pick a time. We’ll handle the rest.')}
                </p>
                <div className="ss-info">
                  {phone && (
                    <a className="ss-info-card" href={tel || undefined}>
                      <span className="ss-info-emo" aria-hidden="true">📞</span>
                      <span className="ss-info-body">
                        <span className="ss-info-label">Give us a ring!</span>
                        <span className="ss-info-val">{phone}</span>
                      </span>
                    </a>
                  )}
                  {email && (
                    <a className="ss-info-card" href={`mailto:${email}`}>
                      <span className="ss-info-emo" aria-hidden="true">✉️</span>
                      <span className="ss-info-body">
                        <span className="ss-info-label">Drop us a line!</span>
                        <span className="ss-info-val">{email}</span>
                      </span>
                    </a>
                  )}
                  {address ? (
                    <a className="ss-info-card" href={mapsHref} target="_blank" rel="noopener noreferrer">
                      <span className="ss-info-emo" aria-hidden="true">📍</span>
                      <span className="ss-info-body">
                        <span className="ss-info-label">Find us!</span>
                        <span className="ss-info-val">{[address, place].filter(Boolean).join(', ')}</span>
                        {area && <span className="ss-info-sub">Serving {area}</span>}
                      </span>
                    </a>
                  ) : (area || place) && (
                    <div className="ss-info-card">
                      <span className="ss-info-emo" aria-hidden="true">📍</span>
                      <span className="ss-info-body">
                        <span className="ss-info-label">{area ? 'We serve!' : 'Find us in'}</span>
                        <span className="ss-info-val">{area || place}</span>
                      </span>
                    </div>
                  )}
                  {hours.length > 0 && (
                    <div className="ss-info-card">
                      <span className="ss-info-emo" aria-hidden="true">🕐</span>
                      <span className="ss-info-body">
                        <span className="ss-info-label">Hours!</span>
                        {hours.length === 1 && !hours[0].time ? (
                          <span className="ss-info-val">{hours[0].days}</span>
                        ) : (
                          <dl className="ss-hours">
                            {hours.map((h) => (
                              <div key={h.days} style={{ display: 'contents' }}>
                                <dt>{h.days}</dt>
                                <dd>{h.time}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {(contactPrimary || editor) && (
                <div data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                  <div className="ss-book">
                    <span className="ss-book-emo" aria-hidden="true">{BUBBLES}</span>
                    <h3 className="ss-book-title">{/[.!?]$/.test(fb.ctaHeadline) ? fb.ctaHeadline : `${fb.ctaHeadline}!`}</h3>
                    <p>{isMobile ? 'Call or text us to schedule. We’ll come to your door.' : 'Call or message us to book a time that suits you.'}</p>
                    {contactPrimary ? (
                      <div className="ss-actions">
                        <a className="ss-btn ss-btn-primary" href={contactPrimary.href} {...(contactPrimary.book ? { 'data-scheduler-trigger': '' } : {})}>
                          {contactPrimary.label}
                        </a>
                        {contactSecondary && (
                          <a className="ss-btn ss-btn-paper" href={contactSecondary.href}>{contactSecondary.label}</a>
                        )}
                      </div>
                    ) : (
                      <EditorHint>Add a phone number or email in Edit &gt; Business Info, or a button link in Edit &gt; Contact, to show a button here.</EditorHint>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="ss-foot" style={{ order: 9999 }}>
        <div className="ss-wrap">
          <div className="ss-foot-grid">
            <div className="ss-foot-about">
              <a className="ss-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
                {brand({ height: 52, width: 'auto', maxWidth: 210 })}
              </a>
              {tagline && <p className="ss-foot-tag">{tagline}</p>}
              <div className="ss-social">
                <SocialRow biz={biz} color={suds.vars['--ss-footer-accent']} size={18} gap={10} images={images} />
              </div>
            </div>
            {navLinks.length > 0 && (
              <div>
                <p className="ss-foot-h">Explore</p>
                <ul className="ss-foot-list">
                  {navLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
            )}
            {services.length > 0 && show('services') && (
              <div>
                <p className="ss-foot-h">Services</p>
                <ul className="ss-foot-list">
                  {services.filter((s) => s.name).slice(0, 6).map((s, i) => <li key={`${s.name}-${i}`}><a href="#services">{s.name}</a></li>)}
                </ul>
              </div>
            )}
            {(tel || email || address || place || area) && (
              <div>
                <p className="ss-foot-h">Say Hi!</p>
                <ul className="ss-foot-list">
                  {tel && <li><a href={tel}>{phone}</a></li>}
                  {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                  {address && <li>{address}</li>}
                  {place && <li>{place}</li>}
                  {area && <li>Serving {area}</li>}
                </ul>
              </div>
            )}
          </div>
          <div className="ss-foot-bottom">
            <p>© <span data-acg-year="">{new Date().getFullYear()}</span> {brandName}{place ? ` · ${place}` : ''}. All rights reserved.</p>
            <a className="ss-top" href="#top"><span aria-hidden="true">{BUBBLES}</span>Back to top</a>
          </div>
        </div>
      </footer>

      <MobileActionBar
        phone={phone}
        bookHref="#contact"
        colors={{ bg: suds.vars['--ss-card-bg'], text: suds.vars['--ss-card-text'], accent: t.accent, onAccent: suds.vars['--ss-on-accent'] }}
        font={body}
      />
    </div>
  );
}
