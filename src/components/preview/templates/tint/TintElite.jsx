// Elite Gold (tint_elite): black & gold, ultra-premium tint for luxury and
// exotic vehicles. Theme-ready (see CLAUDE.md, "Template contract"), built
// like mobile/MobileChrome.jsx:
//   - the gold IS the owner's accent: every sheen, rule, glow and gold
//     numeral is derived from deriveTheme() tokens (--te-* variables). The
//     default accent (#ca8a04) gives the signature gold leaf; a custom accent
//     gets the same metallic treatment in its own hue, contrast-checked;
//   - Playfair Display italic is the house voice, but headings only slant
//     when the owner's heading font ships real italics (no faux-italic
//     Oswald) and only at the italic weights the page loads (400/700);
//   - one prefixed <style>: @container layout, hover inside (hover:hover),
//     motion inside prefers-reduced-motion. No hooks: the nav is opaque and
//     only turns to glass from html[data-acg-scrolled] (siteRuntime.js);
//   - facts (stats, awards, warranty, hours, film brands) render only when
//     the owner entered them; editor hints go through PhotoSlot / EditorOnly.
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import { ServiceCardCss, ServiceDescription, BookNowLink } from '../ServiceCardParts.jsx';
import { buildSectionOrderAdded } from '../../../../lib/sectionOrder.js';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS } from '../../../../lib/businessHours.js';
import { FONT_CATALOG, catalogFamily, familyFromStack } from '../../../../lib/fontCatalog.js';
import { deriveTheme, mix, alpha, ensureContrast, contrastRatio, hexToRgb, rgbToHex } from '../kit/theme.js';
import { PhotoSlot, PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';
import { BeforeAfterBand, beforeAfterCss } from '../kit/BeforeAfter.jsx';
import { beforeAfterPairs, BA_DEFAULTS } from '../kit/beforeAfter.js';

export const themeReady = true;

// Same ids and order as ContentEditor's TOGGLEABLE.tint_elite, so the
// editor's Sections list matches what renders (the old template put Film
// Brands above Services, so the first drag in the editor moved untouched
// sections). Never rename an id. 'beforeAfter' (the Before & After band)
// came later: see addedSections.
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'statsBar', label: 'Stats Bar' },
  { id: 'services', label: 'Services' },
  { id: 'brands', label: 'Film Brands' },
  { id: 'about', label: 'About' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'beforeAfter', label: 'Before & After' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'cta', label: 'Contact / CTA' },
];

// Ids added after sites were saved with this design. Saved sites store
// copy.sectionOrder without them, so the page orders them itself
// (buildSectionOrderAdded): every older section keeps exactly its saved
// order value, and an added band without a saved slot shares the value of
// the section before it, rendering right after it in the DOM.
export const addedSections = ['beforeAfter'];

export const extraFonts = [];

const CSS = `
.te-root :where(h1,h2,h3,p,ul,ol,dl,dd,figure,blockquote){margin:0}
.te-root :where(ul,ol){list-style:none;padding:0}
.te-wrap{width:100%;max-width:1200px;margin:0 auto;padding-left:var(--te-gutter);padding-right:var(--te-gutter)}
.te-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.te-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 18px;background:var(--te-accent);color:var(--te-on-accent);font-weight:600;text-decoration:none}
.te-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.te-root a:focus-visible,.te-root summary:focus-visible,.te-root label:focus-visible,.te-track:focus-visible{outline:2px solid var(--te-focus);outline-offset:3px}
.te-display{font-family:var(--te-head);font-style:var(--te-d-style);font-weight:var(--te-d-weight);font-variant-numeric:lining-nums}
.te-title{font-family:var(--te-head);font-style:var(--te-t-style);font-weight:var(--te-t-weight);font-variant-numeric:lining-nums}
.te-gold-text{color:var(--te-accent-text)}
@supports ((-webkit-background-clip:text) or (background-clip:text)){
.te-gold-text,.te-grad span{-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:0 .12em;margin:0 -.12em}
.te-gold-text{background-image:var(--te-gold-text)}
.te-grad span{background-image:var(--te-h1-grad)}
}
.te-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin:20px auto 0;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-size:13px;font-weight:500;line-height:1.45;letter-spacing:0;text-transform:none;text-align:left;color:inherit;opacity:.85}

.te-eyebrow{display:inline-flex;align-items:center;gap:16px;font-size:11.5px;font-weight:600;line-height:1.4;letter-spacing:.3em;text-transform:uppercase;color:var(--te-accent-text);text-wrap:balance}
.te-eyebrow::before,.te-eyebrow::after{content:'';flex:none;width:34px;height:1px;background:var(--te-rule-fade)}
.te-eyebrow::after{margin-left:-.3em;transform:scaleX(-1)}
.te-eyebrow-l::after{display:none}
.te-orn{display:flex;align-items:center;justify-content:center;gap:12px}
.te-orn::before,.te-orn::after{content:'';width:clamp(40px,6cqi,72px);height:1px;background:var(--te-rule-fade)}
.te-orn::after{transform:scaleX(-1)}
.te-orn i{display:block;width:7px;height:7px;rotate:45deg;background:var(--te-gold-rule)}
.te-corners{position:absolute;inset:0;pointer-events:none;--te-cl:clamp(18px,2.4cqi,30px);background:linear-gradient(var(--te-c),var(--te-c)) left top/var(--te-cl) 1px no-repeat,linear-gradient(var(--te-c),var(--te-c)) left top/1px var(--te-cl) no-repeat,linear-gradient(var(--te-c),var(--te-c)) right top/var(--te-cl) 1px no-repeat,linear-gradient(var(--te-c),var(--te-c)) right top/1px var(--te-cl) no-repeat,linear-gradient(var(--te-c),var(--te-c)) left bottom/var(--te-cl) 1px no-repeat,linear-gradient(var(--te-c),var(--te-c)) left bottom/1px var(--te-cl) no-repeat,linear-gradient(var(--te-c),var(--te-c)) right bottom/var(--te-cl) 1px no-repeat,linear-gradient(var(--te-c),var(--te-c)) right bottom/1px var(--te-cl) no-repeat}
.te-hatch{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(-45deg,transparent 0 80px,var(--te-hatch) 80px 81px),repeating-linear-gradient(45deg,transparent 0 120px,var(--te-hatch-soft) 120px 121px);-webkit-mask-image:radial-gradient(ellipse 72% 72% at 50% 45%,black,transparent 80%);mask-image:radial-gradient(ellipse 72% 72% at 50% 45%,black,transparent 80%)}
.te-glow{position:absolute;left:50%;top:46%;width:min(980px,130cqi);aspect-ratio:7/5;translate:-50% -50%;background:radial-gradient(closest-side,var(--te-glow),transparent);pointer-events:none}

.te-nav{position:sticky;top:0;z-index:100;background:var(--te-bg);border-bottom:1px solid var(--te-border)}
.te-nav::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:1px;background:var(--te-line-h);opacity:0;pointer-events:none}
html[data-acg-scrolled] .te-nav{box-shadow:0 16px 40px -20px var(--te-shadow)}
html[data-acg-scrolled] .te-nav::after{opacity:1}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){html[data-acg-scrolled] .te-nav{background:var(--te-glass);-webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%)}}
.te-nav-in{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:78px}
.te-brand{flex:1 1 auto;display:inline-flex;align-items:center;gap:14px;min-width:0;color:var(--te-text);text-decoration:none}
.te-bar{flex:none;width:2px;height:30px;background:var(--te-gold-v)}
.te-wordmark{min-width:0;overflow:hidden;text-overflow:ellipsis;padding-right:.12em;font-size:21px;line-height:1.25;letter-spacing:.01em}
.te-nav .te-wordmark{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;text-wrap:balance}
.te-wm-long .te-wordmark,.te-wm-xl .te-wordmark{font-size:18px}
.te-wm-xl .te-wordmark{-webkit-line-clamp:3}
.te-wm-xl .te-link-x{display:none}
/* Links that step aside stay in the menu, which shows from then on
   (te-nav-x: the nav has such links). */
.te-wm-xl.te-nav-x .acg-menu{display:block}
.te-links{flex:none;display:flex;align-items:center;gap:clamp(18px,2.6cqi,36px)}
.te-link{position:relative;padding:12px 0;color:var(--te-muted);font-size:12px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;text-decoration:none}
.te-link::after{content:'';position:absolute;left:0;right:.22em;bottom:6px;height:1px;background:var(--te-accent-text);transform:scaleX(0)}

.te-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 34px;border:1px solid transparent;border-radius:1px;font-family:var(--te-body);font-size:12.5px;font-weight:600;line-height:1.2;letter-spacing:.2em;text-transform:uppercase;text-align:center;text-decoration:none;cursor:pointer}
.te-btn:active{transform:translateY(1px)}
.te-btn-gold{color:var(--te-on-accent);background-color:var(--te-accent);background-image:var(--te-gold);background-size:220% 100%;background-position:0 0;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 16px 36px -20px var(--te-glow-strong)}
.te-btn-line{color:var(--te-accent-text);background:transparent;border-color:var(--te-line)}
.te-btn-sm{min-height:44px;padding:0 20px;font-size:11.5px;letter-spacing:.16em;white-space:nowrap}

.te-hero{position:relative;isolation:isolate;display:flex;align-items:center;min-height:clamp(600px,calc(100vh - 78px),940px);padding:clamp(104px,12cqi,168px) 0 clamp(88px,10cqi,136px);background:var(--te-bg);color:var(--te-text);text-align:center;overflow:clip}
.te-hero-media{position:absolute;inset:0;z-index:-3}
.te-hero-scrim{position:absolute;inset:0;z-index:-2;background:var(--te-hero-scrim)}
.te-hero-fade{position:absolute;left:0;right:0;bottom:0;height:22%;z-index:-2;background:var(--te-hero-fade)}
.te-hero>.te-hatch,.te-hero>.te-glow{z-index:-1}
.te-frame{position:absolute;z-index:-1;inset:clamp(14px,2.4cqi,32px);border:1px solid var(--te-line-soft);pointer-events:none}
.te-frame .te-corners{inset:-1px}
.te-has-media{color:var(--te-on-hero);text-shadow:0 1px 26px rgba(0,0,0,.35);--te-c:var(--te-hero-gold);--te-rule-fade:linear-gradient(90deg,transparent,var(--te-hero-gold))}
.te-has-media .te-frame{border-color:var(--te-on-hero-line)}
.te-has-media .te-lead,.te-has-media .te-meta{color:var(--te-on-hero-muted)}
.te-has-media .te-eyebrow,.te-has-media .te-badge{color:var(--te-on-hero)}
.te-has-media .te-badge{border-color:var(--te-on-hero-line)}
.te-has-media .te-btn-line{color:var(--te-on-hero);border-color:var(--te-on-hero-line)}
.te-has-media .te-meta li+li::before{background:var(--te-hero-gold)}
.te-hero-body{position:relative;display:flex;flex-direction:column;align-items:center;max-width:980px;margin:0 auto}
.te-badge{display:inline-flex;align-items:center;gap:10px;max-width:100%;padding:9px 18px;border:1px solid var(--te-line);font-size:11.5px;font-weight:600;line-height:1.45;letter-spacing:.22em;text-transform:uppercase;color:var(--te-accent-text);text-wrap:balance}
.te-badge svg{flex:none}
.te-h1{margin-top:28px;font-size:clamp(46px,7.4cqi,108px);line-height:1.02;letter-spacing:-.015em;text-wrap:balance}
.te-hero-body .te-orn{margin-top:30px}
.te-lead{margin-top:26px;max-width:620px;font-size:clamp(17px,1.5cqi,20px);line-height:1.7;color:var(--te-muted);text-wrap:pretty}
.te-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:44px}
.te-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 26px;margin-top:clamp(40px,5cqi,60px);font-size:11.5px;font-weight:500;line-height:1.5;letter-spacing:.26em;text-transform:uppercase;color:var(--te-muted)}
.te-meta li{display:inline-flex;align-items:center;gap:26px}
.te-meta li+li::before{content:'';flex:none;width:5px;height:5px;rotate:45deg;background:var(--te-accent)}
.te-split{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);min-height:clamp(580px,calc(100vh - 78px),900px);background:var(--te-bg);color:var(--te-text)}
.te-split-text{position:relative;isolation:isolate;overflow:clip;display:flex;flex-direction:column;justify-content:center;padding:clamp(72px,8cqi,120px) clamp(28px,5cqi,80px) clamp(72px,8cqi,120px) max(var(--te-gutter),calc((100cqi - 1200px) / 2 + var(--te-gutter)))}
.te-split-text>.te-hatch{z-index:-1}
.te-split .te-hero-body{align-items:flex-start;margin:0;text-align:left}
.te-split .te-actions,.te-split .te-meta{justify-content:flex-start}
.te-split .te-orn{justify-content:flex-start}
.te-split .te-orn::before{display:none}
.te-split .te-h1{font-size:clamp(42px,5.4cqi,82px)}
.te-split .te-hint{margin-left:0}
.te-split-photo{position:relative;min-height:460px;background:var(--te-surface)}
.te-split-photo::before{content:'';position:absolute;z-index:1;top:0;bottom:0;left:0;width:1px;background:var(--te-line-v)}
.te-split-photo>.te-corners{z-index:1;inset:clamp(14px,2cqi,24px);--te-c:var(--te-hero-gold)}

.te-stats{position:relative;background:var(--te-surface)}
.te-stats::before,.te-stats::after{content:'';position:absolute;left:0;right:0;height:1px;background:var(--te-line-h)}
.te-stats::before{top:0}
.te-stats::after{bottom:0}
.te-stats-grid{display:grid;grid-template-columns:repeat(var(--te-n),minmax(0,1fr))}
.te-stat{position:relative;display:flex;flex-direction:column-reverse;align-items:center;justify-content:flex-end;gap:12px;padding:clamp(32px,3.6cqi,48px) 18px;text-align:center}
.te-stat+.te-stat::before{content:'';position:absolute;left:0;top:24%;bottom:24%;width:1px;background:var(--te-line-v)}
.te-label{display:block;font-size:11px;font-weight:600;line-height:1.45;letter-spacing:.26em;text-transform:uppercase;color:var(--te-muted)}
.te-stat-value{display:block;font-size:clamp(38px,4.2cqi,56px);line-height:1.05;letter-spacing:-.01em}
.te-fact-value{display:block;font-size:clamp(17px,1.6cqi,21px);line-height:1.4;color:var(--te-text);white-space:pre-line}

.te-section{position:relative;padding:clamp(84px,9cqi,132px) 0;scroll-margin-top:78px}
.te-section::before{content:'';position:absolute;top:0;left:50%;width:min(1104px,calc(100% - 2 * var(--te-gutter)));height:1px;translate:-50% 0;background:var(--te-line-h);opacity:.7}
.te-alt{background:var(--te-surface)}
.te-head{max-width:760px;margin:0 auto clamp(48px,5.5cqi,76px);text-align:center}
.te-h2{margin-top:20px;font-size:clamp(36px,4.8cqi,62px);line-height:1.06;letter-spacing:-.01em;color:var(--te-text);text-wrap:balance}
.te-head .te-orn{margin-top:26px}
.te-intro{margin:22px auto 0;max-width:620px;font-size:17px;line-height:1.75;color:var(--te-muted);text-wrap:pretty}

.te-grid{display:grid;gap:clamp(16px,1.8cqi,24px)}
.te-c1{grid-template-columns:minmax(0,560px);justify-content:center}
.te-c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.te-c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.te-cell{display:flex;min-width:0}
.te-card{flex:1;position:relative;padding:clamp(30px,3cqi,42px) clamp(26px,2.6cqi,36px) clamp(24px,2.4cqi,30px);background:var(--te-surface);border:1px solid var(--te-line-soft);overflow:hidden}
.te-alt .te-card{background:var(--te-bg)}
.te-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--te-gold-rule);transform:scaleX(.16);transform-origin:left center}
.te-card-top{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.te-idx{font-size:15px;line-height:1.2;letter-spacing:.08em;color:var(--te-accent-text)}
.te-price{font-size:clamp(28px,2.6cqi,34px);line-height:1.1;white-space:nowrap}
.te-card-title{margin-top:26px;font-size:clamp(21px,1.9cqi,25px);line-height:1.25;color:var(--te-text)}
.te-card .acg-svc-foot{padding-top:26px}
.te-card .acg-svc-more{min-height:32px;padding-top:6px;letter-spacing:.04em}
.te-card-foot{padding-top:12px;border-top:1px solid var(--te-border)}
.te-card .acg-svc-book{display:inline-flex;align-items:center;gap:10px;min-height:44px;color:var(--te-accent-text);font-size:12px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;text-decoration:none}

.te-warranty{position:relative;max-width:780px;margin:clamp(56px,6cqi,88px) auto 0;padding:clamp(40px,4.4cqi,56px) clamp(24px,5cqi,64px);text-align:center;background:radial-gradient(90% 80% at 50% 0%,var(--te-glow),transparent 70%),var(--te-surface);border:1px solid var(--te-line-soft)}
.te-warranty-solo{margin-top:0}
.te-warranty>.te-corners{inset:8px}
.te-seal{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 20px;border-radius:50%;border:1px solid var(--te-line);background:var(--te-bg);color:var(--te-accent-text)}
.te-warranty h3{margin-top:14px;font-size:clamp(24px,2.8cqi,34px);line-height:1.2;color:var(--te-text);text-wrap:balance}
.te-warranty-note{margin-top:14px;font-size:16px;line-height:1.7;color:var(--te-muted);text-wrap:pretty}

.te-films{position:relative;padding:clamp(72px,8cqi,112px) 0;background:var(--te-surface);text-align:center;scroll-margin-top:78px}
.te-films::before,.te-films::after{content:'';position:absolute;left:0;right:0;height:1px;background:var(--te-line-h)}
.te-films::before{top:0}
.te-films::after{bottom:0}
.te-films .te-head{margin-bottom:0}
.te-plates{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:clamp(36px,4cqi,52px)}
.te-plate{display:inline-flex;align-items:center;justify-content:center;min-width:clamp(140px,16cqi,190px);min-height:76px;padding:14px 28px;border:1px solid var(--te-line-soft);background:var(--te-bg);font-size:clamp(20px,2cqi,26px);line-height:1.2;color:var(--te-text)}

.te-about{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:start;gap:clamp(44px,7cqi,112px)}
.te-about-side{position:sticky;top:112px}
.te-photo{position:relative;padding:0 clamp(14px,1.6cqi,22px) clamp(14px,1.6cqi,22px) 0}
.te-photo::before{content:'';position:absolute;top:clamp(14px,1.6cqi,22px);left:clamp(14px,1.6cqi,22px);right:0;bottom:0;border:1px solid var(--te-line)}
.te-media{position:relative;aspect-ratio:4/5;overflow:hidden;background:var(--te-surface)}
.te-mono{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(80% 70% at 50% 38%,var(--te-glow),transparent 72%),var(--te-surface)}
.te-mono>.te-corners{inset:16px}
.te-mono-letter{position:relative;font-size:clamp(110px,15cqi,220px);line-height:1}
.te-statpanel{position:relative;background:var(--te-surface);border:1px solid var(--te-line-soft)}
.te-statpanel>.te-corners{inset:8px}
.te-statpanel dl{display:grid}
.te-statpanel dl>div{display:flex;flex-direction:column-reverse;align-items:center;gap:10px;padding:clamp(26px,3cqi,40px) 20px;text-align:center}
.te-statpanel dl>div+div{border-top:1px solid var(--te-border)}
.te-about-copy .te-h2{margin-bottom:28px}
.te-prose p{font-size:17px;line-height:1.85;color:var(--te-muted);text-wrap:pretty}
.te-prose p+p{margin-top:18px}
.te-prose p:first-child{font-size:clamp(18px,1.7cqi,21px);line-height:1.7;color:var(--te-text)}
.te-sub{margin-top:32px;padding-top:26px;border-top:1px solid var(--te-border)}
.te-sub+.te-sub{margin-top:26px}
.te-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.te-chip{padding:7px 14px;border:1px solid var(--te-line-soft);font-size:12px;font-weight:500;line-height:1.4;letter-spacing:.14em;text-transform:uppercase;color:var(--te-accent-text)}
.te-statement{margin-top:12px;font-size:clamp(19px,1.8cqi,22px);line-height:1.5;color:var(--te-text);text-wrap:pretty}
.te-award-list{margin-top:6px}
.te-award-list li{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--te-border);font-size:16px;line-height:1.5;color:var(--te-text)}
.te-award-list li::before{content:'';flex:none;width:6px;height:6px;rotate:45deg;background:var(--te-gold-rule)}

.te-gal{display:grid;gap:clamp(10px,1.2cqi,16px)}
.te-g1{grid-template-columns:minmax(0,1fr)}
.te-g1 .te-shot{aspect-ratio:21/9}
.te-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.te-g2 .te-shot{aspect-ratio:4/3}
.te-g3{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));height:clamp(420px,52cqi,640px)}
.te-g3 .te-shot:first-child{grid-row:1 / span 2}
.te-shot{position:relative;min-height:0;overflow:hidden;background:var(--te-surface)}
.te-shot::after{content:'';position:absolute;inset:10px;border:1px solid var(--te-shot-line);opacity:0;pointer-events:none}
.te-track{display:flex;gap:clamp(12px,1.4cqi,18px);overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc(-1 * var(--te-gutter));padding:0 var(--te-gutter) 4px;scroll-padding:0 var(--te-gutter)}
.te-track::-webkit-scrollbar{display:none}
.te-track .te-shot{flex:0 0 auto;width:clamp(240px,30cqi,380px);aspect-ratio:4/5;scroll-snap-align:start}
.te-swipe{margin-top:22px;text-align:center;font-size:11.5px;font-weight:500;letter-spacing:.24em;text-transform:uppercase;color:var(--te-muted)}
@media (hover:hover) and (pointer:fine){
.te-track{scrollbar-width:thin;scrollbar-color:var(--te-line) transparent;padding-bottom:16px}
.te-track::-webkit-scrollbar{display:block;height:6px}
.te-track::-webkit-scrollbar-thumb{background:var(--te-line)}
.te-track::-webkit-scrollbar-track{background:transparent}
}

.te-quote{flex:1;position:relative;display:flex;flex-direction:column;padding:clamp(32px,3.2cqi,44px);background:var(--te-bg);border:1px solid var(--te-line-soft)}
.te-quote::before{content:'';position:absolute;top:-1px;left:clamp(32px,3.2cqi,44px);width:48px;height:2px;background:var(--te-gold-rule)}
.te-quote-mark{display:block;color:var(--te-accent-text)}
.te-quote blockquote{flex:1;margin-top:22px}
.te-quote blockquote p{font-family:var(--te-q-font);font-style:var(--te-q-style);font-weight:400;font-size:clamp(17.5px,1.6cqi,20px);line-height:1.6;color:var(--te-text);text-wrap:pretty}
.te-quote figcaption{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:28px;font-size:12px;font-weight:600;line-height:1.5;letter-spacing:.2em;text-transform:uppercase;color:var(--te-text)}
.te-quote figcaption::before{content:'';flex:none;width:22px;height:1px;background:var(--te-accent-text)}
.te-quote figcaption span{font-weight:500;letter-spacing:.06em;text-transform:none;color:var(--te-muted)}
.te-reviews-widget{margin-top:8px}

.te-contact{overflow:clip;isolation:isolate;text-align:center}
.te-contact>.te-hatch,.te-contact>.te-glow{z-index:-1}
.te-contact>.te-glow{top:32%}
.te-contact-head{max-width:820px;margin:0 auto}
.te-h2-xl{font-size:clamp(40px,6.2cqi,84px);line-height:1.02}
.te-contact .te-lead{margin-left:auto;margin-right:auto}
.te-details{display:flex;flex-wrap:wrap;gap:1px;margin-top:clamp(56px,6cqi,84px);background:var(--te-line-soft);border:1px solid var(--te-line-soft);text-align:left}
.te-detail{flex:1 1 220px;display:flex;flex-direction:column;gap:18px;min-width:0;padding:clamp(26px,2.8cqi,36px) clamp(22px,2.4cqi,32px);background:var(--te-surface)}
.te-icon{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:1px solid var(--te-line);color:var(--te-accent-text)}
.te-detail-body{flex:1;min-width:0}
.te-detail-value{display:block;margin-top:8px;font-size:16px;line-height:1.55;color:var(--te-text);overflow-wrap:anywhere}
.te-detail-value a{color:inherit;text-decoration:none;border-bottom:1px solid var(--te-line)}
.te-detail-sub{display:block;margin-top:4px;font-size:14px;line-height:1.5;color:var(--te-muted)}
.te-hours{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin-top:8px;font-size:15px;line-height:1.55}
.te-hours dt{color:var(--te-text);font-weight:500;white-space:nowrap}
.te-hours dd{color:var(--te-muted);white-space:nowrap}
.te-pay{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.te-pay span{padding:4px 11px;border:1px solid var(--te-line-soft);font-size:13px;line-height:1.5;color:var(--te-text)}

.te-foot{position:relative;padding:clamp(64px,8cqi,104px) 0 36px;background:var(--te-footer-bg);color:var(--te-footer-muted);font-size:15px;line-height:1.65}
.te-foot::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:var(--te-line-h)}
.te-foot-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);gap:40px clamp(32px,5cqi,80px)}
.te-foot .te-brand{color:var(--te-footer-text)}
.te-foot .te-wordmark{font-size:24px}
.te-foot-tag{margin-top:18px;max-width:360px}
.te-foot-h{font-size:11px;font-weight:600;line-height:1.45;letter-spacing:.26em;text-transform:uppercase;color:var(--te-footer-text)}
.te-foot-list{display:grid;gap:10px;margin-top:18px}
.te-foot a{color:var(--te-footer-muted);text-decoration:none}
.te-social{margin-top:24px}
.te-social a{width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--te-line-soft);border-radius:50%}
.te-foot-bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;margin-top:clamp(48px,6cqi,72px);padding-top:24px;border-top:1px solid var(--te-footer-line);font-size:13px}

@media (hover:hover){
.te-link:hover{color:var(--te-text)}
.te-link:hover::after{transform:scaleX(1)}
.te-btn-gold:hover{background-position:100% 0;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 20px 44px -18px var(--te-glow-strong)}
.te-btn-line:hover{border-color:var(--te-accent-text);background:var(--te-accent-soft)}
.te-has-media .te-btn-line:hover{border-color:var(--te-on-hero);background:var(--te-on-hero-soft)}
.te-card:hover{border-color:var(--te-line);transform:translateY(-4px);box-shadow:0 30px 60px -34px var(--te-shadow)}
.te-card:hover::before{transform:scaleX(1)}
.te-card .acg-svc-book:hover svg{transform:translateX(4px)}
.te-plate:hover{border-color:var(--te-accent-text);color:var(--te-accent-text)}
.te-shot:hover img{transform:scale(1.04)}
.te-shot:hover::after{opacity:1}
.te-quote:hover{border-color:var(--te-line)}
.te-detail-value a:hover{color:var(--te-accent-text);border-bottom-color:var(--te-accent-text)}
.te-foot a:hover{color:var(--te-footer-text)}
.te-social a:hover{border-color:var(--te-accent-text)}
}
@media (prefers-reduced-motion:no-preference){
.te-nav{transition:background-color .3s ease,box-shadow .3s ease}
.te-nav::after{transition:opacity .4s ease}
.te-link,.te-detail-value a,.te-foot a,.te-plate{transition:color .2s ease,border-color .25s ease}
.te-link::after{transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.te-btn{transition:background-position .8s cubic-bezier(.2,.7,.2,1),background-color .2s ease,border-color .2s ease,box-shadow .3s ease,transform .15s ease}
.te-card{transition:transform .4s cubic-bezier(.2,.7,.2,1),border-color .3s ease,box-shadow .4s ease}
.te-card::before{transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.te-card .acg-svc-book svg{transition:transform .25s ease}
.te-shot img{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.te-shot::after{transition:opacity .4s ease}
.te-quote,.te-social a{transition:border-color .25s ease}
.te-frame{animation:te-frame-in 1.6s cubic-bezier(.2,.7,.2,1) both}
.te-hero-body .te-orn::before,.te-hero-body .te-orn::after{animation:te-rule-in 1.2s .25s cubic-bezier(.2,.7,.2,1) both}
@keyframes te-frame-in{from{opacity:0;scale:1.015}to{opacity:1;scale:1}}
@keyframes te-rule-in{from{scale:0 1}to{scale:1 1}}
}

@container (max-width:1200px){.te-link-x{display:none}.te-nav-x .acg-menu{display:block}}
/* With the menu next to them, the links would leave a long name ~210px just
   above phone width: the menu takes them over from 760px. */
@container (max-width:760px){.te-wm-long .te-links,.te-wm-xl .te-links{display:none}.te-wm-long .acg-menu,.te-wm-xl .acg-menu{display:block}}
@container (max-width:900px){
.te-nav-cta{display:none}
.te-c3{grid-template-columns:repeat(2,minmax(0,1fr))}
.te-stats-grid.te-n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.te-n4 .te-stat:nth-child(3)::before{display:none}
.te-n4 .te-stat:nth-child(n+3){border-top:1px solid var(--te-border)}
.te-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.te-foot-brand{grid-column:1 / -1}
}
@container (max-width:760px){
.te-link{letter-spacing:.14em}
.te-about{grid-template-columns:minmax(0,1fr)}
.te-about-side{position:static}
.te-media{aspect-ratio:4/3}
}
@container (max-width:600px){
.te-links,.te-nav-cta{display:none}
.te-nav-in{min-height:64px;gap:12px}
.te-nav .te-wordmark{font-size:clamp(15px,4.6cqi,18px);line-height:1.3}
.te-wm-long .te-wordmark{font-size:clamp(14px,4.2cqi,17px)}
.te-wm-xl .te-wordmark{font-size:clamp(13px,3.9cqi,15px)}
.te-bar{height:24px}
.te-hero{min-height:0;padding:80px 0 68px}
.te-hero.te-has-media{min-height:clamp(560px,86vh,760px)}
.te-frame{inset:10px}
.te-h1,.te-split .te-h1{margin-top:24px;font-size:clamp(38px,11.4cqi,56px);letter-spacing:-.01em}
.te-lead{font-size:17px}
.te-actions{flex-direction:column;align-items:stretch;width:100%;margin-top:34px}
.te-meta{flex-direction:column;align-items:center;gap:10px;letter-spacing:.2em}
.te-split .te-meta{align-items:flex-start}
.te-meta li+li::before{display:none}
.te-badge{letter-spacing:.16em}
.te-split{grid-template-columns:minmax(0,1fr);min-height:0}
.te-split-text{padding:64px var(--te-gutter) 52px}
.te-split-photo{min-height:0;aspect-ratio:4/3}
.te-split-photo::before{top:0;right:0;bottom:auto;width:auto;height:1px;background:var(--te-line-h)}
.te-stats-grid,.te-stats-grid.te-n4{grid-template-columns:minmax(0,1fr)}
.te-stat,.te-n4 .te-stat{flex-direction:row;align-items:baseline;justify-content:space-between;gap:20px;padding:18px 0;text-align:left}
.te-stat+.te-stat,.te-n4 .te-stat:nth-child(n+3){border-top:1px solid var(--te-border)}
.te-stat+.te-stat::before{display:none}
.te-fact-value{text-align:right;font-size:17px}
.te-stats-kind.te-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.te-stats-kind .te-stat,.te-stats-kind.te-n4 .te-stat{flex-direction:column-reverse;align-items:center;justify-content:flex-end;gap:10px;padding:24px 8px;text-align:center}
.te-stats-kind .te-stat:nth-child(2){border-top:0}
.te-stats-kind .te-stat:last-child:nth-child(odd){grid-column:1 / -1}
.te-section{padding:76px 0}
.te-films{padding:64px 0}
.te-h2{font-size:clamp(32px,9.4cqi,42px)}
.te-h2-xl{font-size:clamp(36px,10.6cqi,50px)}
.te-eyebrow::before,.te-eyebrow::after{width:22px}
.te-hero-body .te-eyebrow{gap:0;letter-spacing:.24em}
.te-hero-body .te-eyebrow::before,.te-hero-body .te-eyebrow::after{display:none}
.te-c1,.te-c2,.te-c3{grid-template-columns:minmax(0,1fr)}
.te-plate{flex:1 1 calc(50% - 6px);min-width:0;min-height:64px;padding:12px 14px;font-size:19px}
.te-g2,.te-g3{grid-template-columns:minmax(0,1fr);grid-template-rows:none;height:auto}
.te-g3 .te-shot:first-child{grid-row:auto}
.te-g1 .te-shot,.te-g2 .te-shot,.te-g3 .te-shot{aspect-ratio:4/3}
.te-track .te-shot{width:78%}
.te-warranty{padding:36px 22px}
.te-detail{flex-basis:100%;flex-direction:row;gap:16px;padding:24px 22px}
.te-foot{padding-top:56px}
.te-foot-grid{grid-template-columns:minmax(0,1fr)}
.te-foot-bottom{flex-direction:column}
}
`;

// The Before & After band (kit BeforeAfter.jsx) in this design's look: a
// gold hairline round the photos, the Before tag in gold on the page's own
// black, the After tag and the handle in the gold-leaf sheen of the
// buttons, the caption in the italic quote voice, gold italic numerals and
// square gold-hairline arrows, the whole slider centered like the headings.
// No shadow outside the photos: the kit's track clips its slides, so one
// would end in a hard edge under the caption. Appended after the kit's
// beforeAfterCss('te-ba') only while the band renders, so a site without
// copy.beforeAfter gets none of it. The --te-ba-* block variables alias
// tokens deriveTheme / goldTokens already contrast-repair: gold text on the
// page background, and the button ink (--te-on-accent) on every stop of the
// sheen.
const BA_CSS = `
.te-ba-band{--te-ba-text:var(--te-text);--te-ba-muted:var(--te-muted);--te-ba-line:var(--te-line);--te-ba-focus:var(--te-focus);--te-ba-tag-bg:var(--te-bg);--te-ba-tag-text:var(--te-accent-text);--te-ba-tag2-bg:var(--te-gold);--te-ba-tag2-text:var(--te-on-accent);--te-ba-knob-bg:var(--te-gold);--te-ba-knob-text:var(--te-on-accent);--te-ba-r:0px;--te-ba-tag-r:1px;--te-ba-btn-r:1px}
.te-ba-slider{max-width:1000px;margin:0 auto}
.te-ba-frame::after{content:'';position:absolute;inset:0;z-index:3;border:1px solid var(--te-line);pointer-events:none}
.te-ba-todo .te-ba-frame::after{display:none}
.te-ba-tag{padding:7px 14px;font-size:10.5px;font-weight:600;line-height:14px;letter-spacing:.26em}
.te-ba-tag-before{box-shadow:inset 0 0 0 1px var(--te-line)}
.te-ba-cap{margin-top:18px;font-family:var(--te-q-font);font-style:var(--te-q-style);font-size:17px;line-height:1.6;text-align:center;text-wrap:pretty}
.te-ba-nav{gap:20px;margin-top:28px}
.te-ba-count{font-family:var(--te-head);font-style:var(--te-d-style);font-weight:var(--te-d-weight);font-size:19px;letter-spacing:.08em;font-variant-numeric:lining-nums tabular-nums;color:var(--te-accent-text)}
.te-ba-btn{width:52px;height:52px;color:var(--te-accent-text)}
@container (min-width:601px){.te-ba-tag{padding:8px 16px;font-size:11px}}
@media (hover:hover){
.te-ba-btn:hover{border-color:var(--te-accent-text);background:var(--te-accent-soft)}
}
`;

const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);
// Owner lists may hold strings or { name } objects (wizard vs editor).
const named = (v) => txt(v && typeof v === 'object' ? v.name : v);

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
// single line formatHours() always produced. (Same rules as MobileChrome.)
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

// Film brands: the editor's list (copy.filmBrandsList, even when emptied)
// wins over the wizard's businessInfo.filmBrands, as before.
function parseBrands(val) {
  if (Array.isArray(val)) return val.map(named).filter(Boolean);
  if (typeof val === 'string') return val.split(/,|·/).map(txt).filter(Boolean);
  return [];
}

// Where a button goes when the owner entered no URL: its wording decides
// (their text or the AI draft's), else the template's own default. The old
// template sent "View Our Services" to the phone dialer.
function intentHref(label, map, fallback) {
  const s = txt(label).toLowerCase();
  if (!s) return fallback;
  if (/\b(call|phone|ring)\b/.test(s) && map.tel) return map.tel;
  if (/\b(book|booking|schedule|appointment|quote|estimate|contact|touch|reserve|visit)\b/.test(s)) return map.contact || fallback;
  if (/\b(films?|brands?)\b/.test(s) && map.films) return map.films;
  if (/\b(services?|packages?|pricing|prices?|menu|tints?|films?)\b/.test(s)) return map.services || fallback;
  if (/\b(work|gallery|photos?|portfolio)\b/.test(s)) return map.gallery || fallback;
  if (/\b(reviews?|testimonials?)\b/.test(s)) return map.reviews || fallback;
  if (/\b(about|story)\b/.test(s)) return map.about || fallback;
  return fallback;
}
const BOOKS_RE = /\b(book|booking|schedule|appointment|reserve)\b/i;

// HSL lightness steps keep the accent's hue and saturation: mixing gold
// with white washes it out to beige, this keeps it gold leaf.
function tone(color, dl) {
  const c = hexToRgb(color) || { r: 0, g: 0, b: 0 };
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l0 = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = Math.min(1, d / (1 - Math.abs(2 * l0 - 1)));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const l = Math.max(0.03, Math.min(0.95, l0 + dl));
  const k = (1 - Math.abs(2 * l - 1)) * s;
  const x = k * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - k / 2;
  const [r1, g1, b1] = h < 60 ? [k, x, 0] : h < 120 ? [x, k, 0] : h < 180 ? [0, k, x] : h < 240 ? [0, x, k] : h < 300 ? [x, 0, k] : [k, 0, x];
  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

// Every gold surface, derived from the owner's accent. Stops that sit under
// text are contrast-checked against that text (button label on the sheen,
// gold numerals on the page and on cards).
function goldTokens(t) {
  const up = t.isDark ? 1 : -1;
  const both = (c) => {
    const onBg = ensureContrast(c, t.bg, 4.5);
    return contrastRatio(onBg, t.surface) >= 4.5 ? onBg : ensureContrast(onBg, t.surface, 4.5);
  };
  const sheen = (dl) => ensureContrast(tone(t.accent, dl), t.onAccent, 4.5);
  const lo = sheen(-0.07);
  const mid = sheen(0);
  const hi = sheen(0.2);
  const textHi = both(tone(t.accentText, 0.18 * up));
  const textLo = both(tone(t.accentText, -0.05 * up));
  const ruleLo = tone(t.accent, -0.06);
  const ruleHi = tone(t.accent, 0.18);
  const heroGold = tone(t.accent, 0.22);
  const footerBg = t.isDark ? mix(t.bg, '#000000', 0.55) : t.surface;
  const footerText = ensureContrast(t.text, footerBg, 4.5);
  return {
    '--te-gold': `linear-gradient(115deg, ${lo} 0%, ${mid} 26%, ${hi} 48%, ${mid} 70%, ${lo} 100%)`,
    '--te-gold-text': `linear-gradient(180deg, ${textHi} 8%, ${t.accentText} 58%, ${textLo} 100%)`,
    '--te-gold-rule': `linear-gradient(90deg, ${ruleLo}, ${ruleHi} 50%, ${ruleLo})`,
    '--te-gold-v': `linear-gradient(180deg, ${ruleHi}, ${ruleLo})`,
    '--te-h1-grad': `linear-gradient(180deg, ${t.text} 38%, ${both(mix(t.text, t.accentText, 0.5))} 100%)`,
    '--te-rule-fade': `linear-gradient(90deg, transparent, ${t.accentText})`,
    '--te-line-h': `linear-gradient(90deg, transparent, ${alpha(t.accentText, 0.55)} 50%, transparent)`,
    '--te-line-v': `linear-gradient(180deg, transparent, ${alpha(t.accentText, 0.5)} 50%, transparent)`,
    '--te-line': alpha(t.accentText, 0.5),
    '--te-line-soft': alpha(t.accentText, t.isDark ? 0.2 : 0.3),
    '--te-c': t.accentText,
    '--te-hatch': alpha(t.accentText, t.isDark ? 0.05 : 0.08),
    '--te-hatch-soft': alpha(t.accentText, t.isDark ? 0.03 : 0.05),
    '--te-glow': alpha(t.accent, t.isDark ? 0.12 : 0.1),
    '--te-glow-strong': alpha(t.accent, 0.45),
    '--te-glass': alpha(t.bg, 0.84),
    '--te-shadow': alpha('#000000', t.isDark ? 0.7 : 0.2),
    '--te-hero-gold': heroGold,
    '--te-shot-line': alpha(heroGold, 0.8),
    // Centered hero text: a soft dark pool behind it on top of the kit's
    // vertical scrim, so white type reads over bright photos too.
    '--te-hero-scrim': `radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,0,0,.3), transparent 75%), ${t.heroScrim}`,
    // Photo heroes melt into a dark page; on a light page that fade would
    // put white hero text on a light band, so it is dropped.
    '--te-hero-fade': t.isDark ? `linear-gradient(180deg, transparent, ${t.bg})` : 'none',
    '--te-on-hero-muted': alpha(t.onHero, 0.86),
    '--te-on-hero-line': alpha(t.onHero, 0.4),
    '--te-on-hero-soft': alpha(t.onHero, 0.1),
    '--te-footer-bg': footerBg,
    '--te-footer-text': footerText,
    '--te-footer-muted': ensureContrast(t.textMuted, footerBg, 4.5),
    '--te-footer-line': alpha(footerText, 0.12),
  };
}

// Heading voice. Display type (H1/H2, big numerals, quotes) is italic 400
// and titles (cards, wordmark) italic 700 when the heading font ships those
// italics (Playfair: 400/700 are the ones the page loads); fonts without
// italics stay upright instead of getting a synthesized slant. Quotes are
// set in the italic display face only when it exists: a paragraph in a
// condensed or heavy upright heading font (Oswald, Bebas) reads poorly, so
// those fall back to the body font.
function faceVars(stack) {
  const fam = catalogFamily(familyFromStack(stack));
  const entry = fam ? FONT_CATALOG[fam] : null;
  const italics = entry ? entry.italics : [];
  const weights = entry ? entry.weights : [600];
  const upright = weights.length === 0 ? 400 : weights.includes(600) ? 600 : weights.includes(700) ? 700 : 400;
  const displayItalic = italics.includes(400);
  const titleItalics = italics.filter((w) => w <= 700);
  return {
    '--te-d-style': displayItalic ? 'italic' : 'normal',
    '--te-d-weight': String(displayItalic ? 400 : upright),
    '--te-t-style': titleItalics.length > 0 ? 'italic' : 'normal',
    '--te-t-weight': String(titleItalics.length > 0 ? Math.max(...titleItalics) : upright),
    '--te-q-font': displayItalic ? 'var(--te-head)' : 'var(--te-body)',
    '--te-q-style': displayItalic ? 'italic' : 'normal',
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
  shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6zM9 12l2 2 4-4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.8 7 21l5-2.5 5 2.5-1.5-7.2',
};

// What a published page shows where a photo is missing: a gold monogram of
// the business initial on the house hatching (never an "upload" box).
function Monogram({ name }) {
  const letter = (txt(name).match(/[A-Za-z0-9]/) || ['•'])[0].toUpperCase();
  return (
    <div className="te-mono" aria-hidden="true">
      <span className="te-hatch" />
      <span className="te-corners" />
      <span className="te-mono-letter te-display te-gold-text">{letter}</span>
    </div>
  );
}

// Owner-facing hint for an empty slot; never reaches the published page.
function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="te-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

// Centered section heading: tracked eyebrow between gold hairlines, italic
// display title, diamond rule.
function Head({ eyebrow, title, id, intro, reveal = true }) {
  return (
    <div className="te-head" {...(reveal ? { 'data-acg-reveal': '' } : {})}>
      {eyebrow && <p className="te-eyebrow">{eyebrow}</p>}
      <h2 id={id} className="te-h2 te-display">{title}</h2>
      <span className="te-orn" aria-hidden="true"><i /></span>
      {intro && <p className="te-intro">{intro}</p>}
    </div>
  );
}

const fill = { position: 'absolute', inset: 0, height: '100%' };

export default function TintElite({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const font = templateMeta?.font || 'Georgia, serif';
  const body = templateMeta?.bodyFont || 'system-ui, sans-serif';
  const fb = getFallbacks(biz.businessType);

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrderAdded(copy, sections.map((s) => s.id), addedSections);

  const name = txt(biz.businessName);
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const place = [txt(biz.city), txt(biz.state)].filter(Boolean).join(', ');
  const area = txt(biz.serviceArea);
  const email = txt(biz.email);
  const address = txt(biz.address);
  const years = txt(biz.yearsInBusiness);
  const hours = hoursRows(biz.hours);
  const hoursSummary = hoursFact(hours);
  const payments = list(biz.paymentMethods).map(named).filter(Boolean);
  const awards = list(biz.awards).map(named).filter(Boolean);
  const specialtyParts = (Array.isArray(biz.specialties) ? biz.specialties : txt(biz.specialties).split(/[·,;|]+/))
    .map(named).filter(Boolean);
  const specialtyChips = specialtyParts.every((s) => s.length <= 36);

  // Warranty: owner text only (the old block invented "Lifetime Warranty
  // Available" and a craftsmanship promise when a field was empty).
  // warranty is the tint wizard's field (and the coating warranty detailing
  // data carries), warrantyOffered the mechanic "Parts & Labor Warranty"; a
  // site with both (its type changed) leads with the one its type uses.
  const warrantyOffered = txt(biz.warrantyOffered);
  const warrantyText = txt(biz.warranty);
  const [warrantyTitle, warrantyOther] = /tint|detail/i.test(txt(biz.businessType))
    ? [warrantyText || warrantyOffered, warrantyText ? warrantyOffered : '']
    : [warrantyOffered || warrantyText, warrantyOffered ? warrantyText : ''];
  const warrantyNote = warrantyOther && warrantyOther !== warrantyTitle ? warrantyOther : '';

  // Services: the owner's Services tab (businessInfo.services, mirrored to
  // packages by normalizeBusinessInfo) wins over the AI list; a service the
  // owner left without a description borrows the AI one of the same name.
  const norm = (s) => (typeof s === 'string' ? { name: s } : s || {});
  const aiItems = list(copy.servicesSection?.items).map(norm)
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }));
  const aiDesc = new Map(aiItems.filter((s) => s.name && s.description).map((s) => [s.name.toLowerCase(), s.description]));
  const fromPackages = list(biz.packages).length > 0;
  const services = (fromPackages ? biz.packages : aiItems).map(norm)
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }))
    .map((s) => ({ ...s, description: s.description || aiDesc.get(s.name.toLowerCase()) || '' }))
    .filter((s) => s.name || s.description || s.price);
  const svcCols = services.length === 1 ? 'te-c1' : services.length === 2 || services.length === 4 ? 'te-c2' : 'te-c3';

  const brands = parseBrands(copy.filmBrandsList ?? biz.filmBrands);

  // Stats only from what the owner entered: About > Stats Box values, else
  // business facts (years, area, hours, payment). The old bar invented
  // "10+", "5,000+" and a five-star row.
  const ownerStats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label);
  const yearsNum = /^\d+\+?$/.test(years) ? years : '';
  const specFacts = [
    years && { label: 'Experience', value: yearsNum ? `${yearsNum} ${yearsNum === '1' ? 'year' : 'years'}` : years },
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

  // Before & After band (Edit > Before & After): only once copy.beforeAfter
  // exists, and on the published page only with a pair that has both
  // photos (the editor shows every pair, and says what each still needs).
  // Heading and intro: the owner's, else the design's own words.
  const ba = beforeAfterPairs(copy.beforeAfter, images, { editor });
  const baOn = show('beforeAfter') && Boolean(ba) && (ba.pairs.length > 0 || editor);
  const baTitle = ba?.title || BA_DEFAULTS.title;
  const baIntro = ba?.intro || BA_DEFAULTS.intro;

  // Reviews: the Google widget only when the owner picked it in Edit >
  // Reviews (reviewMode) and connected a widget; otherwise their quotes.
  const testimonials = list(copy.testimonialPlaceholders).filter((q) => txt(q?.text));
  const reviews = copy.reviewMode === 'google' && txt(copy.googleWidgetKey)
    ? 'google'
    : testimonials.length > 0 ? 'quotes' : null;

  const has = {
    services: show('services') && services.length > 0,
    warranty: show('services') && !!warrantyTitle,
    brands: show('brands') && brands.length > 0,
    about: show('about'),
    gallery: show('gallery') && galleryImages.length > 0,
    reviews: show('testimonials') && !!reviews,
    contact: show('cta'),
  };
  const navLinks = [
    has.services && { href: '#services', label: 'Services' },
    has.brands && { href: '#films', label: 'Films' },
    has.about && { href: '#about', label: 'About', extra: true },
    has.gallery && { href: '#gallery', label: 'Work', extra: true },
    has.reviews && { href: '#reviews', label: 'Reviews', extra: true },
    has.contact && { href: '#contact', label: 'Contact' },
  ].filter(Boolean);
  const anchors = {
    tel,
    contact: has.contact ? '#contact' : tel,
    services: has.services ? '#services' : null,
    films: has.brands ? '#films' : null,
    gallery: has.gallery ? '#gallery' : null,
    reviews: has.reviews ? '#reviews' : null,
    about: has.about ? '#about' : null,
  };

  // Hero buttons: the editor's Button URLs win, then the label's wording.
  // Button 1 still defaults to the services list, Button 2 to the phone.
  const heroPrimaryLabel = txt(copy.ctaPrimary) || (anchors.services ? 'View Services' : 'Get in Touch');
  const heroPrimaryHref = txt(copy.ctaPrimaryUrl) || intentHref(heroPrimaryLabel, anchors, anchors.services || anchors.contact || '#top');
  const heroPrimaryBooks = !txt(copy.ctaPrimaryUrl) && BOOKS_RE.test(heroPrimaryLabel);
  const heroSecondaryLabel = txt(copy.ctaSecondary) || (phone ? `Call ${phone}` : '');
  const heroSecondaryHref = txt(copy.ctaSecondaryUrl) || intentHref(heroSecondaryLabel, anchors, tel || anchors.contact);
  const splitHero = copy.heroLayout === 'split';
  const headline = txt(copy.headline) || fb.headline || name;
  const heroMeta = [txt(biz.tagline), place].filter(Boolean);

  const aboutTitle = yearsNum
    ? `${yearsNum} ${yearsNum === '1' ? 'Year' : 'Years'} of Precision`
    : fb.headline || (name ? `About ${name}` : 'Our Story');
  const aboutParas = txt(copy.aboutText).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  // Contact: Primary Button (ctaButtonText / ctaUrl) opens the booking
  // widget when there is no URL (it calls, or stays put, without booking);
  // Phone / Secondary Button (ctaSecondaryText / ctaSecondaryUrl) calls.
  // The editor writes ctaSecondaryUrl from both Hero > Button 2 URL and
  // Contact > Button URL, so a "Call (555) ..." button only follows it when
  // it is itself a phone/text link or the owner also named the button;
  // otherwise it keeps calling (an Instagram or #gallery link set for the
  // hero must not hide behind a "Call" label).
  const contactPrimaryLabel = txt(copy.ctaButtonText) || txt(copy.ctaPrimary) || 'Get a Free Quote';
  const contactPrimaryHref = txt(copy.ctaUrl) || tel || '#contact';
  const contactBooks = !txt(copy.ctaUrl);
  const secondaryUrl = txt(copy.ctaSecondaryUrl);
  const contactSecondaryLabel = txt(copy.ctaSecondaryText) || (phone ? `Call ${phone}` : '');
  const contactSecondaryHref = (secondaryUrl && (txt(copy.ctaSecondaryText) || /^(tel|sms):/i.test(secondaryUrl))) ? secondaryUrl : tel;
  const showContactSecondary = !!(contactSecondaryHref && contactSecondaryLabel)
    && (contactSecondaryHref !== contactPrimaryHref || contactBooks || !!txt(copy.ctaSecondaryText));
  const contactLead = txt(copy.ctaSubtext)
    || (area ? `Serving ${area}.` : place ? `Serving ${place}.` : 'Get in touch to book an appointment or ask a question.');
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, place].filter(Boolean).join(', '))}`
    : null;

  const vars = {
    '--te-bg': t.bg,
    '--te-surface': t.surface,
    '--te-text': t.text,
    '--te-muted': t.textMuted,
    '--te-accent': t.accent,
    '--te-accent-text': t.accentText,
    '--te-accent-soft': t.accentSoft,
    '--te-on-accent': t.onAccent,
    '--te-border': t.border,
    '--te-focus': t.focus,
    '--te-on-hero': t.onHero,
    '--te-head': font,
    '--te-body': body,
    '--te-gutter': 'clamp(20px, 5cqi, 48px)',
    ...faceVars(font),
    ...goldTokens(t),
  };

  // Logo if uploaded, else the gold rule + italic wordmark (nav and footer).
  const brand = (logoStyle, loading) => (images.logo ? (
    <PhotoSlot src={images.logo} alt={name ? `${name} logo` : 'Logo'} loading={loading} style={logoStyle} imgStyle={{ objectFit: 'contain' }} />
  ) : (
    <>
      <span className="te-bar" aria-hidden="true" />
      <span className="te-wordmark te-title">{name}</span>
    </>
  ));
  // The nav wordmark wraps to two lines before it ellipsizes. Longer names
  // also step down a size (a 32-character name then stays on one line beside
  // all six links), and past ~44 characters the three extra links give way,
  // so even a 70-character name fits in two lines (three on a phone).
  const wordmarkTier = images.logo ? '' : name.length > 44 ? ' te-wm-xl' : name.length > 26 ? ' te-wm-long' : '';

  const heroText = (
    <div className="te-hero-body">
      {awards.length > 0 ? (
        <p className="te-badge" data-acg-awards=""><Icon d={ICONS.award} size={15} />{awards[0]}</p>
      ) : (
        fb.heroBadge && <p className="te-eyebrow">{fb.heroBadge}</p>
      )}
      <h1 className={`te-h1 te-display${splitHero || !images.hero ? ' te-grad' : ''}`}><span>{headline}</span></h1>
      <span className="te-orn" aria-hidden="true"><i /></span>
      {txt(copy.subheadline) && <p className="te-lead">{copy.subheadline}</p>}
      <div className="te-actions">
        <a className="te-btn te-btn-gold" href={heroPrimaryHref} {...(heroPrimaryBooks ? { 'data-scheduler-trigger': '' } : {})}>
          {heroPrimaryLabel}
        </a>
        {heroSecondaryHref && heroSecondaryLabel && (
          <a className="te-btn te-btn-line" href={heroSecondaryHref}>{heroSecondaryLabel}</a>
        )}
      </div>
      {heroMeta.length > 0 && (
        <ul className="te-meta">
          {heroMeta.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
    </div>
  );

  return (
    <div
      id="top"
      className="te-root"
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.6 }}
    >
      <style>{CSS + (baOn ? beforeAfterCss('te-ba') + BA_CSS : '')}</style>
      <a className="te-skip" href="#main">Skip to content</a>

      <nav className={`te-nav${wordmarkTier}${navLinks.some((l) => l.extra) ? ' te-nav-x' : ''}`} aria-label="Main" style={{ order: -1 }}>
        <div className="te-wrap te-nav-in">
          <a className="te-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
            {brand({ height: 40, width: 'auto', maxWidth: 180 }, 'eager')}
          </a>
          {(navLinks.length > 0 || tel) && (
            <div className="te-links">
              {navLinks.map((l) => (
                <a key={l.href} className={`te-link${l.extra ? ' te-link-x' : ''}`} href={l.href}>{l.label}</a>
              ))}
              {tel && <a className="te-btn te-btn-gold te-btn-sm te-nav-cta" href={tel}>{phone}</a>}
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
        {!show('hero') && <h1 className="te-sr">{name || headline}</h1>}

        {show('hero') && !splitHero && (
          <header data-section="hero" className={`te-hero${images.hero ? ' te-has-media' : ''}`} style={{ order: order('hero') }}>
            {images.hero ? (
              <>
                <div className="te-hero-media">
                  <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
                </div>
                <div className="te-hero-scrim" />
                <div className="te-hero-fade" />
              </>
            ) : (
              <>
                <div className="te-hatch" />
                <div className="te-glow" />
              </>
            )}
            <div className="te-frame" aria-hidden="true"><span className="te-corners" /></div>
            <div className="te-wrap">
              {heroText}
              {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
            </div>
          </header>
        )}

        {show('hero') && splitHero && (
          <header data-section="hero" className="te-split" style={{ order: order('hero') }}>
            <div className="te-split-text">
              <div className="te-hatch" />
              {heroText}
            </div>
            <div className="te-split-photo">
              <PhotoSlot src={images.hero} slot="hero" alt="" loading="eager" fetchPriority="high" style={fill} fallback={<Monogram name={name} />} />
              <span className="te-corners" aria-hidden="true" />
            </div>
          </header>
        )}

        {show('statsBar') && (barItems.length > 0 || editor) && (
          <section data-section="statsBar" className="te-stats" aria-label="At a glance" style={{ order: order('statsBar') }}>
            <div className="te-wrap">
              {barItems.length > 0 ? (
                <dl className={`te-stats-grid te-n${barItems.length}${barStats ? ' te-stats-kind' : ''}`} style={{ '--te-n': String(barItems.length) }}>
                  {barItems.map((f, i) => (
                    <div key={`${f.label}-${i}`} className="te-stat" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <dt className="te-label">{f.label}</dt>
                      <dd className={barStats ? 'te-stat-value te-display te-gold-text' : 'te-fact-value te-title'}>{f.value}</dd>
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

        {(has.services || has.warranty) && (
          <section data-section="services" id="services" className="te-section" aria-labelledby={has.services ? 'te-services-h' : 'te-warranty-h'} style={{ order: order('services') }}>
            <ServiceCardCss />
            <div className="te-wrap">
              {has.services && (
                <>
                  <Head eyebrow="Services" id="te-services-h" title={txt(copy.servicesSection?.title) || 'Our Services'} intro={txt(copy.servicesSection?.intro)} />
                  <div className={`te-grid ${svcCols}`}>
                    {services.map((s, i) => (
                      <div key={`${s.name}-${i}`} className="te-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                        <article className="acg-svc-card te-card">
                          <div className="te-card-top">
                            <span className="te-idx te-title">{String(i + 1).padStart(2, '0')}</span>
                            {s.price && <span className="te-price te-display te-gold-text">{s.price}</span>}
                          </div>
                          {s.name && <h3 className="te-card-title te-title">{s.name}</h3>}
                          <ServiceDescription
                            id={`svc-more-${fromPackages ? 'pkg' : 'ai'}-${i}`}
                            text={s.description}
                            style={{ marginTop: 12, color: t.textMuted, fontSize: 15.5, lineHeight: 1.7 }}
                            accentColor={t.accentText}
                          />
                          <div className="acg-svc-foot">
                            <div className="te-card-foot">
                              <BookNowLink serviceName={s.name} phone={phone} label={<>Book now <Icon d={ICONS.arrow} size={16} /></>} />
                            </div>
                          </div>
                        </article>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {has.warranty && (
                <aside className={`te-warranty${has.services ? '' : ' te-warranty-solo'}`} aria-labelledby="te-warranty-h" data-acg-reveal="">
                  <span className="te-corners" aria-hidden="true" />
                  <span className="te-seal"><Icon d={ICONS.shield} size={24} /></span>
                  <p className="te-eyebrow">Warranty</p>
                  <h3 id="te-warranty-h" className="te-display">{warrantyTitle}</h3>
                  {warrantyNote && <p className="te-warranty-note">{warrantyNote}</p>}
                </aside>
              )}
            </div>
          </section>
        )}

        {has.brands && (
          <section data-section="brands" id="films" className="te-films" aria-labelledby="te-films-h" style={{ order: order('brands') }}>
            <div className="te-wrap">
              <Head eyebrow="Film Brands" id="te-films-h" title="Premium Film Selection" />
              <ul className="te-plates">
                {brands.map((b, i) => (
                  <li key={`${b}-${i}`} className="te-plate te-title" data-acg-reveal="fade" style={{ '--acg-delay': `${(i % 6) * 70}ms` }}>{b}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {show('about') && (
          <section data-section="about" id="about" className="te-section" aria-labelledby="te-about-h" style={{ order: order('about') }}>
            <div className="te-wrap te-about">
              <div className="te-about-side" data-acg-reveal="">
                {aboutShowsStats ? (
                  <div className="te-statpanel">
                    <span className="te-corners" aria-hidden="true" />
                    <dl>
                      {ownerStats.slice(0, 4).map((s, i) => (
                        <div key={`${s.label}-${i}`}>
                          <dt className="te-label">{s.label}</dt>
                          <dd className="te-stat-value te-display te-gold-text">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <div className="te-photo">
                    <div className="te-media">
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
              <div className="te-about-copy" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                <p className="te-eyebrow te-eyebrow-l">Our Story</p>
                <h2 id="te-about-h" className="te-h2 te-display">{aboutTitle}</h2>
                {aboutParas.length > 0 && (
                  <div className="te-prose">
                    {aboutParas.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                )}
                {specialtyParts.length > 0 && (
                  <div className="te-sub">
                    <p className="te-label">Specialties</p>
                    {specialtyChips ? (
                      <ul className="te-chips">
                        {specialtyParts.map((s, i) => <li key={`${s}-${i}`} className="te-chip">{s}</li>)}
                      </ul>
                    ) : (
                      <p className="te-statement te-display">{specialtyParts.join(' · ')}</p>
                    )}
                  </div>
                )}
                {awards.length > 0 && (
                  <div className="te-sub" data-acg-awards="">
                    <p className="te-label">Awards &amp; Recognition</p>
                    <ul className="te-award-list">
                      {awards.map((a, i) => <li key={`${a}-${i}`}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {show('gallery') && (galleryImages.length > 0 || editor) && (
          <section data-section="gallery" id="gallery" className="te-section" aria-labelledby="te-gallery-h" style={{ order: order('gallery') }}>
            <div className="te-wrap">
              <Head eyebrow="Our Work" id="te-gallery-h" title="Gallery" />
              {galleryImages.length === 0 ? (
                <PhotoSlot slot="gallery" style={{ minHeight: 220 }} />
              ) : galleryImages.length > 3 ? (
                <>
                  <div className="te-track" role="region" aria-label="Photo gallery, scroll sideways for more" tabIndex={0}>
                    {galleryImages.map((src, i) => (
                      <figure key={i} className="te-shot">
                        <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      </figure>
                    ))}
                  </div>
                  <p className="te-swipe" aria-hidden="true">Swipe or scroll for more →</p>
                </>
              ) : (
                <div className={`te-gal te-g${galleryImages.length}`}>
                  {galleryImages.map((src, i) => (
                    <figure key={i} className="te-shot" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Right after the gallery in the DOM: it shares the gallery's order
            value until the owner places it (buildSectionOrderAdded). */}
        {baOn && (
          <BeforeAfterBand
            ns="te-ba"
            beforeAfter={copy.beforeAfter}
            images={images}
            editor={editor}
            order={order('beforeAfter')}
            className="te-section"
            wrapClassName="te-wrap"
            labelledBy="te-ba-h"
            heading={<Head eyebrow={BA_DEFAULTS.eyebrow} id="te-ba-h" title={baTitle} intro={baIntro} />}
            hints={ba.pairs.length === 0 && <EditorHint>{'Add a before and an after photo in Edit > Before & After.'}</EditorHint>}
          />
        )}

        {show('testimonials') && reviews === 'google' && (
          <section data-section="testimonials" id="reviews" className="te-section" aria-label={txt(copy.googleReviewsTitle) || 'Reviews'} style={{ order: order('testimonials') }}>
            <div className="te-wrap">
              {txt(copy.googleReviewsTitle) && <Head eyebrow="Reviews" title={copy.googleReviewsTitle} reveal={false} />}
              <div className="te-reviews-widget">
                <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
              </div>
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'quotes' && (
          <section data-section="testimonials" id="reviews" className="te-section te-alt" aria-labelledby="te-reviews-h" style={{ order: order('testimonials') }}>
            <div className="te-wrap">
              <Head eyebrow="Testimonials" id="te-reviews-h" title="What Our Clients Say" />
              <div className={`te-grid ${testimonials.length === 1 ? 'te-c1' : testimonials.length === 2 || testimonials.length === 4 ? 'te-c2' : 'te-c3'}`}>
                {testimonials.map((q, i) => (
                  <div key={i} className="te-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <figure className="te-quote">
                      <svg className="te-quote-mark" width="34" height="26" viewBox="0 0 34 26" fill="currentColor" aria-hidden="true">
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
          <section data-section="cta" id="contact" className="te-section te-contact" aria-labelledby="te-contact-h" style={{ order: order('cta') }}>
            <div className="te-hatch" />
            <div className="te-glow" />
            <div className="te-wrap">
              <div className="te-contact-head" data-acg-reveal="">
                <span className="te-orn" aria-hidden="true"><i /></span>
                <h2 id="te-contact-h" className="te-h2 te-h2-xl te-display">{txt(copy.ctaHeadline) || fb.ctaHeadline || 'Get in Touch'}</h2>
                <p className="te-lead">{contactLead}</p>
                <div className="te-actions">
                  <a className="te-btn te-btn-gold" href={contactPrimaryHref} {...(contactBooks ? { 'data-scheduler-trigger': '' } : {})}>
                    {contactPrimaryLabel}
                  </a>
                  {showContactSecondary && (
                    <a className="te-btn te-btn-line" href={contactSecondaryHref}>{contactSecondaryLabel}</a>
                  )}
                </div>
              </div>

              {(phone || email || address || place || area || hours.length > 0 || payments.length > 0) && (
                <ul className="te-details" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                  {phone && (
                    <li className="te-detail">
                      <span className="te-icon"><Icon d={ICONS.phone} /></span>
                      <span className="te-detail-body">
                        <span className="te-label">Phone</span>
                        <span className="te-detail-value">{tel ? <a href={tel}>{phone}</a> : phone}</span>
                      </span>
                    </li>
                  )}
                  {email && (
                    <li className="te-detail">
                      <span className="te-icon"><Icon d={ICONS.mail} /></span>
                      <span className="te-detail-body">
                        <span className="te-label">Email</span>
                        <span className="te-detail-value"><a href={`mailto:${email}`}>{email}</a></span>
                      </span>
                    </li>
                  )}
                  {(address || place || area) && (
                    <li className="te-detail">
                      <span className="te-icon"><Icon d={ICONS.pin} /></span>
                      <span className="te-detail-body">
                        <span className="te-label">{address ? 'Location' : area ? 'Service area' : 'Based in'}</span>
                        <span className="te-detail-value">
                          {address ? <a href={mapsHref} target="_blank" rel="noopener noreferrer">{[address, place].filter(Boolean).join(', ')}</a> : (area || place)}
                        </span>
                        {address && area && <span className="te-detail-sub">Serving {area}</span>}
                      </span>
                    </li>
                  )}
                  {hours.length > 0 && (
                    <li className="te-detail">
                      <span className="te-icon"><Icon d={ICONS.clock} /></span>
                      <span className="te-detail-body">
                        <span className="te-label">Hours</span>
                        {hours.length === 1 && !hours[0].time ? (
                          <span className="te-detail-value">{hours[0].days}</span>
                        ) : (
                          <dl className="te-hours">
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
                  {payments.length > 0 && (
                    <li className="te-detail">
                      <span className="te-icon"><Icon d={ICONS.card} /></span>
                      <span className="te-detail-body">
                        <span className="te-label">We accept</span>
                        <span className="te-pay">
                          {payments.map((p) => <span key={p}>{p}</span>)}
                        </span>
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="te-foot" style={{ order: 9999 }}>
        <div className="te-wrap">
          <div className="te-foot-grid">
            <div className="te-foot-brand">
              <a className="te-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
                {brand({ height: 48, width: 'auto', maxWidth: 200 })}
              </a>
              {txt(copy.footerTagline) && <p className="te-foot-tag">{copy.footerTagline}</p>}
              <div className="te-social">
                <SocialRow biz={biz} color={t.accentText} size={18} gap={10} images={images} />
              </div>
            </div>
            {navLinks.length > 0 && (
              <div>
                <p className="te-foot-h">Explore</p>
                <ul className="te-foot-list">
                  {navLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
            )}
            <div>
              <p className="te-foot-h">Contact</p>
              <ul className="te-foot-list">
                {tel && <li><a href={tel}>{phone}</a></li>}
                {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                {address && <li>{address}</li>}
                {place && <li>{place}</li>}
                {area && <li>Serving {area}</li>}
              </ul>
            </div>
          </div>
          <div className="te-foot-bottom">
            <p>© <span data-acg-year="">{new Date().getFullYear()}</span> {name}. All rights reserved.</p>
            {place && <p>{place}</p>}
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref="#contact" colors={t} font={body} />
    </div>
  );
}
