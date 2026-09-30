// Ironclad (mechanic_ironclad): dark steel & rust-red industrial, premium.
// Theme-ready (see CLAUDE.md, "Template contract"; MobileChrome.jsx is the
// reference). What keeps it honest and static-export safe:
//   - every color is a deriveTheme() token exposed as an --ic-* variable,
//     so the owner's 5 colors repaint the steel, the rust and the footer;
//   - the heading slot drives every display face (Bebas Neue by default,
//     with Barlow Condensed labels); a custom heading font gets its own
//     size/weight profile so it never overflows where Bebas would fit;
//   - all CSS lives in the one prefixed <style> below: @container layout,
//     hover inside (hover:hover), motion inside prefers-reduced-motion
//     (the old onMouseEnter hovers never ran on the published page);
//   - no useState/useEffect: the nav is opaque and only gains glass +
//     shadow from html[data-acg-scrolled] (siteRuntime.js);
//   - facts (stats, years, warranty, awards, hours) render only when the
//     owner entered them; AI testimonials carry no "verified" label or
//     stars; editor hints go through PhotoSlot / EditorOnly.
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import IconOrEmoji from '../IconOrEmoji.jsx';
import { ServiceCardCss, ServiceDescription, BookNowLink } from '../ServiceCardParts.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS } from '../../../../lib/businessHours.js';
import { FONT_CATALOG, catalogFamily, familiesFromStack } from '../../../../lib/fontCatalog.js';
import { deriveTheme, mix, alpha, ensureContrast } from '../kit/theme.js';
import { PhotoSlot, PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';

export const themeReady = true;

// Same ids and order as ContentEditor's TOGGLEABLE.mechanic_ironclad (and
// the old buildSectionOrder call), so saved orders and hidden flags keep
// working and the editor's Sections list matches what renders.
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'ticker', label: 'Service Ticker' },
  { id: 'ctaBand', label: 'CTA Banner' },
  { id: 'about', label: 'About / Shop' },
  { id: 'services', label: 'Services' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'whyUs', label: 'Why Choose Us' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'cta', label: 'Contact & Hours' },
];

// Condensed label face for eyebrows, buttons and card titles while the
// heading slot is the default Bebas Neue (the mockup's pairing).
const LABEL_FONT = "'Barlow Condensed', 'Barlow', sans-serif";
export const extraFonts = ["'Barlow Condensed', sans-serif"];

const CSS = `
.ic-root :where(h1,h2,h3,h4,p,ul,ol,dl,dd,figure,blockquote){margin:0}
.ic-root :where(ul,ol){list-style:none;padding:0}
/* Serif heading picks (Playfair, DM Serif) default to old-style figures:
   card numbers, prices and stats read as "o1" / "$8g" without this. */
.ic-root{font-variant-numeric:lining-nums}
.ic-wrap{width:100%;max-width:1240px;margin:0 auto;padding-left:var(--ic-gutter);padding-right:var(--ic-gutter)}
.ic-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.ic-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 18px;background:var(--ic-accent);color:var(--ic-on-accent);font-weight:700;text-decoration:none}
.ic-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.ic-root a:focus-visible,.ic-root summary:focus-visible,.ic-root label:focus-visible,.ic-gal-track:focus-visible{outline:2px solid var(--ic-focus);outline-offset:3px}
.ic-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin-top:20px;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);font-family:var(--ic-body);font-size:13px;font-weight:500;line-height:1.45;letter-spacing:0;text-transform:none;color:inherit;opacity:.85}

.ic-eyebrow{display:flex;align-items:center;gap:12px;font-family:var(--ic-label);font-size:12px;font-weight:800;line-height:1.3;letter-spacing:.32em;text-transform:uppercase;color:var(--ic-accent-text)}
.ic-eyebrow::before{content:'';flex:none;width:28px;height:2px;background:var(--ic-accent)}
.ic-display{font-family:var(--ic-head);font-weight:var(--ic-hw);line-height:var(--ic-hlh);letter-spacing:var(--ic-hls);text-transform:uppercase;overflow-wrap:break-word}
.ic-h2{margin-top:16px;font-size:calc(clamp(44px,5.4cqi,74px) * var(--ic-hs));color:var(--ic-text);text-wrap:balance}
.ic-a{color:var(--ic-accent-text)}
.ic-block{display:block}
@supports (-webkit-text-stroke:1px black){.ic-o{color:transparent;-webkit-text-stroke:2px var(--ic-outline)}}
.ic-lead{font-size:clamp(16.5px,1.5cqi,18px);line-height:1.75;color:var(--ic-muted);text-wrap:pretty}

.ic-btn{position:relative;isolation:isolate;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:56px;padding:0 40px;font-family:var(--ic-label);font-size:16px;font-weight:800;line-height:1.1;letter-spacing:.14em;text-transform:uppercase;text-align:center;text-decoration:none;cursor:pointer;clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)}
.ic-btn-primary{background:var(--ic-accent);color:var(--ic-on-accent)}
.ic-btn-primary::before{content:'';position:absolute;z-index:-1;top:0;bottom:0;left:-90px;width:64px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.24),transparent);transform:skewX(-20deg)}
.ic-btn:active{transform:translateY(1px)}
.ic-btn-sm{min-height:46px;padding:0 26px;font-size:14px}
.ic-textlink{display:inline-flex;align-items:center;gap:10px;min-height:48px;color:var(--ic-text);font-family:var(--ic-label);font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;text-decoration:none}
.ic-textlink>span{padding-bottom:5px;border-bottom:2px solid var(--ic-border-strong)}
.ic-textlink svg{color:var(--ic-accent-text)}

.ic-nav{position:sticky;top:0;z-index:100;background:var(--ic-nav-bg);border-bottom:2px solid var(--ic-accent)}
.ic-nav::after{content:'';position:absolute;left:0;right:0;bottom:-6px;height:1px;background:linear-gradient(90deg,transparent,var(--ic-accent),transparent);opacity:.45;pointer-events:none}
html[data-acg-scrolled] .ic-nav{box-shadow:0 14px 34px -18px var(--ic-shadow)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){html[data-acg-scrolled] .ic-nav{background:var(--ic-glass);-webkit-backdrop-filter:blur(14px) saturate(140%);backdrop-filter:blur(14px) saturate(140%)}}
.ic-nav-in{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:72px}
.ic-brand{flex:0 1 auto;display:inline-flex;align-items:center;gap:14px;min-width:0;max-width:100%;color:var(--ic-text);text-decoration:none}
.ic-hex{flex:none;display:grid;place-items:center;width:44px;height:44px;background:var(--ic-accent);color:var(--ic-on-accent);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);font-family:var(--ic-head);font-weight:var(--ic-hw);font-size:17px;line-height:1;letter-spacing:.04em}
.ic-brand-text{display:flex;flex-direction:column;min-width:0}
.ic-brand-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;font-family:var(--ic-head);font-weight:var(--ic-hw);font-size:calc(24px * var(--ic-hs2));line-height:1.02;letter-spacing:var(--ic-bls);text-transform:uppercase;text-wrap:balance}
.ic-brand-long{font-size:calc(20px * var(--ic-hs2))}
.ic-brand-sub{margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ic-label);font-size:10px;font-weight:800;line-height:1.2;letter-spacing:.3em;text-transform:uppercase;color:var(--ic-accent-text)}
.ic-links{flex:none;display:flex;align-items:center;gap:clamp(18px,2.4cqi,32px)}
.ic-link{position:relative;padding:12px 0;font-family:var(--ic-label);font-size:13px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;white-space:nowrap;color:var(--ic-muted);text-decoration:none}
.ic-wide .ic-link{letter-spacing:.12em}
.ic-wide .ic-links{gap:clamp(16px,2cqi,26px)}
.ic-nav .ic-btn-sm{white-space:nowrap}
.ic-link::after{content:'';position:absolute;left:0;right:0;bottom:5px;height:2px;background:var(--ic-accent);transform:scaleX(0);transform-origin:left center}
.ic-nav-phone{display:inline-flex;align-items:center;gap:8px;font-family:var(--ic-label);font-size:15px;font-weight:700;letter-spacing:.06em;color:var(--ic-text);text-decoration:none;white-space:nowrap}
.ic-nav-phone svg{color:var(--ic-accent-text)}
/* A long shop name in a wide heading face needs the room: the phone and
   the Work link step aside (both stay in the page and the mobile menu). */
@container (max-width:1400px){.ic-wide.ic-long .ic-nav-phone,.ic-wide.ic-long .ic-link-x{display:none}}

.ic-hero{position:relative;isolation:isolate;overflow:clip;display:flex;align-items:center;min-height:clamp(620px,calc(100vh - 72px),960px);padding:clamp(64px,7.5cqi,112px) 0;background:var(--ic-bg);color:var(--ic-text)}
.ic-hero-base{position:absolute;inset:0;z-index:-5;background:var(--ic-hero-base)}
.ic-hero-grid{position:absolute;inset:0;z-index:-4;background-image:linear-gradient(var(--ic-grid) 1px,transparent 1px),linear-gradient(90deg,var(--ic-grid) 1px,transparent 1px);background-size:60px 60px;-webkit-mask-image:linear-gradient(90deg,black 0%,black 50%,transparent 92%);mask-image:linear-gradient(90deg,black 0%,black 50%,transparent 92%)}
.ic-slash{position:absolute;top:0;right:0;bottom:0;width:54%;z-index:-3;background:var(--ic-surface);clip-path:polygon(16% 0,100% 0,100% 100%,0 100%)}
.ic-slash::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(-45deg,transparent 0 20px,var(--ic-hatch) 20px 40px)}
.ic-slash-edge{position:absolute;top:0;right:0;bottom:0;width:54%;z-index:-3;pointer-events:none;background:linear-gradient(var(--ic-accent),var(--ic-accent)) no-repeat;clip-path:polygon(16% 0,calc(16% + 3px) 0,3px 100%,0 100%);opacity:.9}
.ic-ghost{position:absolute;right:5%;top:50%;z-index:-2;translate:0 -50%;font-family:var(--ic-head);font-weight:var(--ic-hw);font-size:calc(clamp(180px,24cqi,360px) * var(--ic-hs));line-height:1;letter-spacing:-.02em;color:var(--ic-ghost);pointer-events:none;user-select:none;white-space:nowrap}
.ic-nut{position:absolute;right:9%;top:50%;z-index:-2;width:clamp(240px,30cqi,420px);translate:0 -50%;color:var(--ic-nut);pointer-events:none}
.ic-nut-core{stroke:var(--ic-accent);opacity:.45}
.ic-hero-media{position:absolute;inset:0;z-index:-5}
.ic-hero-scrim{position:absolute;inset:0;z-index:-4;background:var(--ic-scrim-left)}
.ic-hero-stripe{position:absolute;left:0;right:0;bottom:0;height:4px;z-index:-1;background:repeating-linear-gradient(90deg,var(--ic-accent) 0 30px,transparent 30px 40px)}
.ic-has-media{color:var(--ic-on-hero)}
.ic-has-media .ic-hero-grid{opacity:.5}
.ic-has-media .ic-lead,.ic-has-media .ic-stat-label{color:var(--ic-on-hero-dim)}
.ic-has-media .ic-a{color:var(--ic-hero-accent)}
.ic-has-media .ic-kicker{color:var(--ic-on-hero)}
.ic-has-media .ic-o{-webkit-text-stroke-color:var(--ic-on-hero)}
.ic-has-media .ic-textlink{color:var(--ic-on-hero)}
.ic-has-media .ic-textlink>span{border-bottom-color:var(--ic-on-hero-line)}
.ic-has-media .ic-textlink svg{color:var(--ic-hero-accent)}
.ic-has-media .ic-stats{border-top-color:var(--ic-on-hero-line)}
.ic-has-media .ic-stat-num{color:var(--ic-hero-accent)}
.ic-hero-body{position:relative;max-width:780px}
.ic-kicker{display:flex;align-items:center;gap:14px;font-family:var(--ic-label);font-size:13px;font-weight:800;line-height:1.3;letter-spacing:.3em;text-transform:uppercase;color:var(--ic-accent-text)}
.ic-kicker::before{content:'';flex:none;width:40px;height:3px;background:var(--ic-accent)}
.ic-h1{margin-top:26px;font-size:calc(clamp(64px,9.6cqi,132px) * var(--ic-hs) * var(--ic-h1f,1))}
.ic-hero-lead{margin-top:30px;max-width:500px;font-size:clamp(17px,1.5cqi,19px)}
.ic-actions{display:flex;flex-wrap:wrap;align-items:center;gap:18px 32px;margin-top:44px}
.ic-stats{display:flex;flex-wrap:wrap;gap:28px 56px;margin-top:clamp(52px,6cqi,76px);padding-top:36px;border-top:1px solid var(--ic-border)}
.ic-stat{display:flex;flex-direction:column-reverse;justify-content:flex-end}
.ic-stat-num{display:block;font-family:var(--ic-head);font-weight:var(--ic-hw);font-size:calc(clamp(40px,3.8cqi,50px) * var(--ic-hs2));line-height:1;letter-spacing:.02em;color:var(--ic-accent-text);white-space:nowrap}
.ic-stat-label{display:block;margin-top:8px;font-family:var(--ic-label);font-size:12px;font-weight:700;line-height:1.3;letter-spacing:.2em;text-transform:uppercase;color:var(--ic-muted)}
.ic-split{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);min-height:clamp(580px,calc(100vh - 72px),900px);background:var(--ic-bg);color:var(--ic-text)}
.ic-split-text{position:relative;isolation:isolate;overflow:clip;display:flex;flex-direction:column;justify-content:center;padding:clamp(72px,8cqi,120px) clamp(28px,5cqi,72px) clamp(72px,8cqi,120px) max(var(--ic-gutter),calc((100cqi - 1240px) / 2 + var(--ic-gutter)))}
.ic-split .ic-h1{font-size:calc(clamp(56px,7cqi,104px) * var(--ic-hs) * var(--ic-h1f,1))}
.ic-split-photo{position:relative;min-height:460px;background:var(--ic-plate);border-left:4px solid var(--ic-accent)}

.ic-ticker{position:relative;overflow:hidden;padding:15px 0;background:var(--ic-ticker-bg);color:var(--ic-ticker-text);border-top:2px solid var(--ic-accent-deep);border-bottom:2px solid var(--ic-accent-deep)}
.ic-track{display:flex;width:max-content}
.ic-tick{display:inline-flex;align-items:center;gap:34px;padding:0 17px;font-family:var(--ic-head);font-weight:var(--ic-hw);font-size:calc(21px * var(--ic-hs2));line-height:1.2;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
.ic-tick svg{flex:none;opacity:.6}

.ic-band{position:relative;isolation:isolate;overflow:clip;padding:clamp(60px,7cqi,92px) 0;background:var(--ic-surface);color:var(--ic-text);border-bottom:1px solid var(--ic-border)}
.ic-band::before{content:'';position:absolute;inset:0;z-index:-1;background:repeating-linear-gradient(-45deg,transparent 0 20px,var(--ic-hatch) 20px 40px)}
.ic-band::after{content:'';position:absolute;top:0;bottom:0;left:0;width:6px;background:var(--ic-accent)}
.ic-band-in{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);align-items:center;gap:32px clamp(40px,6cqi,96px)}
.ic-band-h{font-size:calc(clamp(42px,5cqi,70px) * var(--ic-hs));color:var(--ic-text);text-wrap:balance}
.ic-band .ic-lead{margin-top:16px;max-width:560px}
.ic-band-side{display:flex;flex-direction:column;align-items:flex-start;gap:16px}
.ic-band-meta{display:grid;gap:6px;font-size:14.5px;line-height:1.55;color:var(--ic-muted);white-space:pre-line}

.ic-section{position:relative;padding:clamp(84px,10cqi,128px) 0;scroll-margin-top:72px}
.ic-tone-bg{background:var(--ic-bg)}
.ic-tone-steel{background:var(--ic-steel)}
.ic-tone-iron{background:var(--ic-surface);--ic-cell:var(--ic-steel)}
.ic-dash-top::before,.ic-dash-bottom::after{content:'';position:absolute;left:0;right:0;height:4px;background:repeating-linear-gradient(90deg,var(--ic-accent) 0 30px,transparent 30px 40px)}
.ic-dash-top::before{top:0}
.ic-dash-bottom::after{bottom:0;height:3px}
.ic-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);align-items:end;gap:20px clamp(32px,6cqi,96px);margin-bottom:clamp(44px,6cqi,72px)}
.ic-head-solo{grid-template-columns:minmax(0,1fr)}
.ic-intro{font-size:16.5px;line-height:1.8;color:var(--ic-muted);max-width:520px;text-wrap:pretty}

.ic-grid{display:grid;gap:3px}
.ic-c1{grid-template-columns:minmax(0,720px)}
.ic-c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ic-c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ic-c4{grid-template-columns:repeat(4,minmax(0,1fr))}
.ic-cell{display:flex;min-width:0}
.ic-card{flex:1;position:relative;overflow:hidden;padding:clamp(30px,3.4cqi,44px) clamp(24px,2.8cqi,38px);background:var(--ic-surface);color:var(--ic-text)}
.ic-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--ic-accent);transform:scaleX(0);transform-origin:left center}
.ic-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.ic-num{display:block;font-family:var(--ic-head);font-weight:var(--ic-hw);font-size:calc(76px * var(--ic-hs2));line-height:.86;letter-spacing:.01em;color:var(--ic-ghost-strong);user-select:none}
.ic-tile{flex:none;display:grid;place-items:center;width:54px;height:54px;border:1px solid var(--ic-border-strong);background:var(--ic-bg);color:var(--ic-accent-text)}
.ic-card-title{margin-top:28px;font-family:var(--ic-label);font-size:clamp(20px,1.9cqi,23px);font-weight:800;line-height:1.15;letter-spacing:.05em;text-transform:uppercase;color:var(--ic-text)}
.ic-card .acg-svc-foot{padding-top:26px}
.ic-price-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:18px;border-top:1px solid var(--ic-border)}
.ic-price{font-family:var(--ic-head);font-weight:var(--ic-hw);font-size:calc(34px * var(--ic-hs2));line-height:1;letter-spacing:.02em;color:var(--ic-accent-text);white-space:nowrap}
.ic-card .acg-svc-book{display:inline-flex;align-items:center;gap:10px;min-height:44px;color:var(--ic-text);font-family:var(--ic-label);font-size:13px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;text-decoration:none}
.ic-card .acg-svc-book svg{color:var(--ic-accent-text)}
.ic-card .acg-svc-more{min-height:32px;padding-top:6px;letter-spacing:.04em}

.ic-about{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);background:var(--ic-bg);border-top:1px solid var(--ic-border)}
.ic-about-visual{position:relative;overflow:hidden;min-height:clamp(520px,50cqi,680px);background:var(--ic-plate)}
.ic-cap{position:absolute;left:0;right:0;bottom:0;padding:clamp(28px,4cqi,48px);background:linear-gradient(to top,rgba(0,0,0,.9),rgba(0,0,0,.55) 55%,transparent);color:var(--ic-on-hero)}
.ic-cap-badge{display:inline-flex;align-items:center;gap:8px;max-width:100%;margin-bottom:14px;padding:8px 16px;border:1px solid var(--ic-hero-accent);font-family:var(--ic-label);font-size:12px;font-weight:800;line-height:1.3;letter-spacing:.2em;text-transform:uppercase;color:var(--ic-hero-accent)}
.ic-cap-title{font-size:calc(clamp(32px,3.6cqi,48px) * var(--ic-hs));color:var(--ic-on-hero)}
.ic-cap-title span{display:block;color:var(--ic-hero-accent)}
.ic-cap-plain{background:linear-gradient(to top,var(--ic-bg) 8%,var(--ic-cap-fade) 58%,transparent);color:var(--ic-text)}
.ic-cap-plain .ic-cap-title{color:var(--ic-text)}
.ic-cap-plain .ic-cap-title span{color:var(--ic-accent-text)}
.ic-cap-plain .ic-cap-badge{border-color:var(--ic-accent);color:var(--ic-accent-text)}
.ic-about-copy{display:flex;flex-direction:column;justify-content:center;padding:clamp(72px,8cqi,120px) max(var(--ic-gutter),calc((100cqi - 1240px) / 2 + var(--ic-gutter))) clamp(72px,8cqi,120px) clamp(32px,6cqi,88px)}
.ic-about-copy .ic-h2{margin-bottom:26px}
.ic-prose p{font-size:16.5px;line-height:1.85;color:var(--ic-muted);max-width:540px;white-space:pre-line;text-wrap:pretty}
.ic-prose p+p{margin-top:16px}
.ic-prose p:first-child{font-size:clamp(17px,1.6cqi,19px);line-height:1.7;color:var(--ic-text)}
.ic-creds{display:grid;gap:14px;margin-top:34px}
.ic-cred{display:flex;align-items:flex-start;gap:16px;font-size:15px;line-height:1.55;color:var(--ic-muted)}
.ic-cred-icon{flex:none;display:grid;place-items:center;width:42px;height:42px;background:var(--ic-surface);border:1px solid var(--ic-border);color:var(--ic-accent-text)}
.ic-cred strong{display:block;margin-bottom:2px;font-family:var(--ic-label);font-size:13px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--ic-text)}
.ic-about-copy .ic-btn{align-self:flex-start;margin-top:40px}

.ic-garage{position:absolute;inset:0;background:linear-gradient(to bottom,var(--ic-g-top) 0%,var(--ic-g-mid) 60%,var(--ic-g-top) 100%)}
.ic-g-floor{position:absolute;left:0;right:0;bottom:0;height:34%;background:var(--ic-g-floor);border-top:3px solid var(--ic-g-edge)}
.ic-g-floor::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 39px,var(--ic-hatch) 39px 40px)}
.ic-g-door{position:absolute;top:13%;left:50%;width:66%;height:50%;translate:-50% 0;display:flex;flex-direction:column;gap:3px;padding:5px;background:var(--ic-g-door);border:3px solid var(--ic-g-edge)}
.ic-g-door span{position:relative;flex:1;background:var(--ic-g-panel);border:1px solid var(--ic-g-edge)}
.ic-g-door span::after{content:'';position:absolute;top:50%;left:32%;right:32%;height:2px;background:var(--ic-hatch)}
.ic-g-light{position:absolute;top:8%;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,var(--ic-accent),transparent);box-shadow:0 0 22px var(--ic-glow),0 0 64px var(--ic-glow-soft);opacity:.85}
.ic-g-tool{position:absolute;color:var(--ic-ghost-strong)}
.ic-g-wrench{top:18%;right:7%;width:15%;rotate:40deg}
.ic-g-gear{bottom:36%;left:6%;width:14%}
.ic-g-gear2{bottom:41%;left:17%;width:8%}
.ic-spark{position:absolute;width:3px;height:3px;border-radius:50%;background:var(--ic-accent);box-shadow:0 0 6px var(--ic-accent);opacity:0}
/* Stats Box layout: the owner's stats and the name caption stack in flow
   over the bare garage, so three or four stats never slide under the
   caption (they were absolutely centered before). */
.ic-about-stats{display:flex;flex-direction:column;padding-top:clamp(64px,8cqi,112px)}
.ic-about-stats .ic-cap{position:relative;margin-top:auto}
.ic-statgrid{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px;width:min(82%,460px);margin:auto auto 36px}
.ic-statgrid>div{display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:24px 22px;background:var(--ic-surface);border-top:3px solid var(--ic-accent)}
.ic-statgrid>div:last-child:nth-child(odd){grid-column:1 / -1}

.ic-gal{display:grid;gap:3px}
.ic-g1{grid-template-columns:minmax(0,1fr)}
.ic-g1 .ic-shot{aspect-ratio:21/9}
.ic-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ic-g2 .ic-shot{aspect-ratio:4/3}
.ic-g3{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));height:clamp(420px,50cqi,620px)}
.ic-g3 .ic-shot:first-child{grid-row:1 / span 2}
.ic-shot{position:relative;min-height:0;overflow:hidden;background:var(--ic-surface)}
.ic-shot::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--ic-accent);transform:scaleX(0);transform-origin:left center}
.ic-gal-track{display:flex;gap:3px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc(-1 * var(--ic-gutter));padding:0 var(--ic-gutter) 4px;scroll-padding:0 var(--ic-gutter)}
.ic-gal-track::-webkit-scrollbar{display:none}
.ic-gal-track .ic-shot{flex:0 0 auto;width:clamp(250px,31cqi,400px);aspect-ratio:4/5;scroll-snap-align:start}
/* 4-6 photos: a mosaic that shows every photo on wide screens; the swipe
   track takes over at 900px and below (and for more photos). */
@container (min-width:901px){
.ic-gal-grid{display:grid;gap:3px;overflow:visible;margin:0;padding:0}
.ic-gal-grid .ic-shot{width:auto}
.ic-gt4{grid-template-columns:repeat(4,minmax(0,1fr))}
.ic-gt4 .ic-shot{aspect-ratio:4/5}
.ic-gt5{grid-template-columns:repeat(4,minmax(0,1fr))}
.ic-gt5 .ic-shot{aspect-ratio:1/1}
.ic-gt5 .ic-shot:first-child{grid-column:span 2;grid-row:span 2;aspect-ratio:auto}
.ic-gt6{grid-template-columns:repeat(3,minmax(0,1fr))}
.ic-gt6 .ic-shot{aspect-ratio:4/3}
.ic-gal-grid+.ic-swipe{display:none}
}
.ic-swipe{margin-top:20px;font-family:var(--ic-label);font-size:13px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--ic-muted)}

.ic-why{border-top:1px solid var(--ic-border);border-bottom:1px solid var(--ic-border)}
.ic-why-cell{flex:1;position:relative;padding:clamp(34px,3.6cqi,48px) clamp(24px,2.6cqi,34px);background:var(--ic-cell,var(--ic-surface))}
.ic-why-cell::after{content:'';position:absolute;left:clamp(24px,2.6cqi,34px);right:clamp(24px,2.6cqi,34px);bottom:0;height:2px;background:linear-gradient(90deg,var(--ic-accent),transparent);transform:scaleX(0);transform-origin:left center}
.ic-why-icon{display:grid;place-items:center;width:58px;height:58px;border:1px solid var(--ic-border-strong);font-size:28px;line-height:1;color:var(--ic-accent-text)}
.ic-why-cell h3{margin-top:26px;font-family:var(--ic-label);font-size:20px;font-weight:800;line-height:1.2;letter-spacing:.06em;text-transform:uppercase;color:var(--ic-text)}
.ic-why-cell p{margin-top:10px;font-size:15px;line-height:1.7;color:var(--ic-muted);white-space:pre-line}

.ic-quotes{display:grid;gap:20px}
.ic-quote{flex:1;position:relative;display:flex;flex-direction:column;overflow:hidden;padding:clamp(32px,3.4cqi,42px) clamp(28px,3cqi,40px);background:var(--ic-surface);border:1px solid var(--ic-border)}
.ic-quote::before{content:'';position:absolute;top:0;left:0;bottom:0;width:4px;background:var(--ic-accent)}
.ic-qmark{display:block;height:34px;font-family:var(--ic-head);font-weight:var(--ic-hw);font-size:84px;line-height:.9;color:var(--ic-accent-text)}
.ic-quote blockquote{flex:1;margin-top:16px}
.ic-quote blockquote p{font-size:16.5px;line-height:1.75;color:var(--ic-text);text-wrap:pretty}
.ic-author{display:flex;align-items:center;gap:14px;margin-top:30px}
.ic-author .ic-hex{width:46px;height:46px}
.ic-author-name{display:block;font-family:var(--ic-label);font-size:15px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ic-text)}
.ic-author-meta{display:block;margin-top:2px;font-size:13.5px;color:var(--ic-muted)}

.ic-contact-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(48px,6cqi,96px);align-items:start}
.ic-contact .ic-lead{margin-top:22px;max-width:460px}
.ic-contact .ic-actions{margin-top:32px}
.ic-details{display:grid;gap:3px;margin-top:40px}
.ic-detail{display:flex;align-items:center;gap:18px;padding:20px 24px;background:var(--ic-surface);border-left:3px solid transparent;color:var(--ic-text);text-decoration:none}
a.ic-detail{border-left-color:var(--ic-accent)}
.ic-detail-icon{flex:none;display:grid;place-items:center;width:30px;color:var(--ic-accent-text)}
.ic-detail-body{min-width:0}
.ic-label{display:block;font-family:var(--ic-label);font-size:11.5px;font-weight:800;line-height:1.3;letter-spacing:.22em;text-transform:uppercase;color:var(--ic-muted)}
.ic-detail-value{display:block;margin-top:4px;font-family:var(--ic-label);font-size:19px;font-weight:700;line-height:1.35;letter-spacing:.02em;color:var(--ic-text);overflow-wrap:anywhere}
.ic-h3{margin-top:14px;font-size:calc(clamp(34px,3.6cqi,48px) * var(--ic-hs));color:var(--ic-text)}
.ic-hours{margin-top:26px;background:var(--ic-surface)}
.ic-hours-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:15px 24px;border-bottom:1px solid var(--ic-border);font-size:15px}
.ic-hours-row:last-child{border-bottom:0}
.ic-hours-row dt{color:var(--ic-muted);font-weight:600}
.ic-hours-row dd{font-family:var(--ic-label);font-size:17px;font-weight:700;letter-spacing:.03em;text-align:right;color:var(--ic-text)}
.ic-hours-row dd.ic-closed{color:var(--ic-muted);font-weight:600}
.ic-hours-note{margin-top:26px;padding:18px 24px;background:var(--ic-surface);font-size:16px;line-height:1.6;color:var(--ic-text);white-space:pre-line}
.ic-callout{display:flex;gap:16px;align-items:flex-start;margin-top:24px;padding:22px 24px;background:var(--ic-surface);border:1px solid var(--ic-border);border-left:4px solid var(--ic-accent);color:var(--ic-text)}
.ic-callout svg{flex:none;margin-top:2px;color:var(--ic-accent-text)}
.ic-callout p{margin-top:4px;font-size:15.5px;line-height:1.6}
.ic-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ic-chip{padding:6px 12px;border:1px solid var(--ic-border-strong);font-family:var(--ic-label);font-size:14px;font-weight:700;letter-spacing:.06em;color:var(--ic-text)}

.ic-foot{padding:clamp(60px,7cqi,84px) 0 32px;background:var(--ic-footer-bg);color:var(--ic-footer-muted);border-top:2px solid var(--ic-accent);font-size:14.5px;line-height:1.6}
.ic-foot-grid{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(var(--ic-fcols),minmax(0,1fr));gap:40px clamp(28px,4cqi,56px)}
.ic-foot .ic-brand{color:var(--ic-footer-text)}
.ic-foot .ic-brand-sub{color:var(--ic-footer-accent)}
.ic-foot-tag{margin-top:18px;max-width:300px}
.ic-foot-h{font-family:var(--ic-label);font-size:12px;font-weight:800;letter-spacing:.26em;text-transform:uppercase;color:var(--ic-footer-accent)}
.ic-foot-list{display:grid;gap:10px;margin-top:18px;overflow-wrap:anywhere}
.ic-foot a{color:var(--ic-footer-muted);text-decoration:none}
.ic-social{margin-top:24px}
.ic-social a{width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--ic-footer-line)}
.ic-foot-bottom{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;margin-top:clamp(44px,6cqi,64px);padding-top:24px;border-top:1px solid var(--ic-footer-line);font-size:13px}
.ic-copy{order:-1}
.ic-foot-motto{font-family:var(--ic-head);font-weight:var(--ic-hw);font-size:calc(17px * var(--ic-hs2));letter-spacing:.16em;text-transform:uppercase;color:var(--ic-footer-accent)}

@media (hover:hover){
.ic-link:hover{color:var(--ic-text)}
.ic-link:hover::after{transform:scaleX(1)}
.ic-nav-phone:hover{color:var(--ic-accent-text)}
.ic-btn-primary:hover{background:var(--ic-accent-hover)}
.ic-btn-primary:hover::before{left:calc(100% + 30px)}
.ic-textlink:hover>span{border-bottom-color:var(--ic-accent)}
.ic-textlink:hover svg{transform:translateX(4px)}
.ic-card:hover{background:var(--ic-plate)}
.ic-card:hover::before{transform:scaleX(1)}
.ic-card:hover .ic-num{color:var(--ic-ghost-hot)}
.ic-card .acg-svc-book:hover svg{transform:translateX(4px)}
.ic-why-cell:hover{background:var(--ic-plate)}
.ic-why-cell:hover::after{transform:scaleX(1)}
.ic-quote:hover{border-color:var(--ic-accent-line);transform:translateY(-3px);box-shadow:0 24px 56px -28px var(--ic-shadow)}
.ic-shot:hover img{transform:scale(1.04)}
.ic-shot:hover::after{transform:scaleX(1)}
a.ic-detail:hover{background:var(--ic-plate)}
.ic-foot a:hover{color:var(--ic-footer-text)}
.ic-social a:hover{border-color:var(--ic-footer-accent)}
.ic-ticker:hover .ic-track{animation-play-state:paused}
}
@media (prefers-reduced-motion:no-preference){
.ic-nav{transition:background-color .3s ease,box-shadow .3s ease}
.ic-link,.ic-nav-phone,.ic-foot a{transition:color .2s ease}
.ic-link::after{transition:transform .25s ease}
.ic-btn{transition:background-color .2s ease,transform .15s ease}
.ic-btn-primary::before{transition:left .55s ease}
.ic-textlink>span{transition:border-color .2s ease}
.ic-textlink svg,.ic-card .acg-svc-book svg{transition:transform .25s ease}
.ic-card,.ic-why-cell,a.ic-detail{transition:background-color .3s ease}
.ic-card::before{transition:transform .4s cubic-bezier(.2,.7,.2,1)}
.ic-num{transition:color .3s ease}
.ic-why-cell::after,.ic-shot::after{transition:transform .35s ease}
.ic-quote{transition:transform .3s ease,box-shadow .3s ease,border-color .3s ease}
.ic-shot img{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.ic-social a{transition:border-color .2s ease}
.ic-in{animation:ic-in .9s cubic-bezier(.2,.7,.2,1) both;animation-delay:var(--ic-d,0ms)}
@keyframes ic-in{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
.ic-slash,.ic-slash-edge{animation:ic-slash 1.2s cubic-bezier(.2,.7,.2,1) both}
@keyframes ic-slash{from{opacity:0;translate:12% 0}to{opacity:1;translate:0 0}}
.ic-ghost,.ic-nut{animation:ic-fade 1.6s ease .3s both}
@keyframes ic-fade{from{opacity:0}to{opacity:1}}
.ic-track{animation:ic-marquee var(--ic-mq,40s) linear infinite}
@keyframes ic-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.ic-g-gear{animation:ic-spin 9s linear infinite}
.ic-g-gear2{animation:ic-spin 6s linear infinite reverse}
@keyframes ic-spin{to{rotate:360deg}}
.ic-spark{animation:ic-spark 3s ease-in-out infinite}
@keyframes ic-spark{0%,100%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1)}}
}
@media (prefers-reduced-motion:reduce){
.ic-track{width:auto;flex-wrap:wrap;justify-content:center;row-gap:8px}
.ic-dup{display:none}
}

@container (max-width:1100px){
.ic-link-x{display:none}
.ic-c4{grid-template-columns:repeat(2,minmax(0,1fr))}
.ic-foot-grid{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.ic-foot-brand{grid-column:1 / -1}
}
@container (max-width:900px){
.ic-nav-phone{display:none}
.ic-c3{grid-template-columns:repeat(2,minmax(0,1fr))}
.ic-head,.ic-contact-grid{grid-template-columns:minmax(0,1fr)}
.ic-about{grid-template-columns:minmax(0,1fr)}
.ic-about-visual{min-height:440px}
.ic-about-copy{padding:72px var(--ic-gutter)}
.ic-band-in{grid-template-columns:minmax(0,1fr)}
.ic-slash,.ic-slash-edge{width:44%}
.ic-ghost{opacity:.7}
}
@container (max-width:760px){
.ic-split{grid-template-columns:minmax(0,1fr);min-height:0}
.ic-split-text{padding:64px var(--ic-gutter) 56px}
.ic-split-photo{min-height:0;aspect-ratio:4/3;border-left:0;border-top:4px solid var(--ic-accent)}
}
@container (max-width:600px){
.ic-links{display:none}
.ic-nav-in{min-height:64px;gap:12px}
.ic-hex{width:38px;height:38px;font-size:14px}
.ic-brand{gap:11px}
.ic-brand-name{font-size:calc(20px * var(--ic-hs2))}
.ic-brand-long{font-size:calc(17px * var(--ic-hs2))}
.ic-brand-sub{font-size:9px;letter-spacing:.24em}
.ic-hero{min-height:0;padding:72px 0 60px}
.ic-hero.ic-has-media{min-height:clamp(560px,86vh,760px)}
.ic-hero-scrim{background:var(--ic-scrim-m)}
.ic-slash{width:44%;opacity:.6}
.ic-slash-edge{display:none}
.ic-ghost,.ic-nut{display:none}
.ic-kicker{font-size:12px;letter-spacing:.24em;gap:12px}
.ic-kicker::before{width:28px}
.ic-h1,.ic-split .ic-h1{margin-top:22px;font-size:calc(clamp(50px,16cqi,76px) * var(--ic-hs) * var(--ic-h1f,1))}
.ic-hero-lead{margin-top:22px;font-size:17px}
.ic-actions{flex-direction:column;align-items:stretch;gap:12px;margin-top:34px}
.ic-actions .ic-textlink{justify-content:center}
.ic-btn{padding:0 28px}
.ic-stats{gap:24px 36px;margin-top:44px;padding-top:28px}
.ic-tick{font-size:calc(18px * var(--ic-hs2));gap:26px;padding:0 13px}
.ic-section{padding:76px 0}
.ic-h2{font-size:calc(clamp(40px,12cqi,54px) * var(--ic-hs))}
.ic-band-h{font-size:calc(clamp(38px,11cqi,50px) * var(--ic-hs))}
.ic-band .ic-btn{align-self:stretch}
.ic-c1,.ic-c2,.ic-c3,.ic-c4{grid-template-columns:minmax(0,1fr)}
.ic-num{font-size:calc(60px * var(--ic-hs2))}
.ic-about-visual{min-height:380px}
.ic-about-copy{padding:64px var(--ic-gutter)}
.ic-about-copy .ic-btn{align-self:stretch}
.ic-about-stats{padding-top:56px}
.ic-statgrid{width:auto;margin:auto var(--ic-gutter) 28px}
.ic-statgrid>div{padding:18px 16px}
.ic-g2,.ic-g3{grid-template-columns:minmax(0,1fr);grid-template-rows:none;height:auto}
.ic-g3 .ic-shot:first-child{grid-row:auto}
.ic-g1 .ic-shot,.ic-g2 .ic-shot,.ic-g3 .ic-shot{aspect-ratio:4/3}
.ic-gal-track .ic-shot{width:80%}
.ic-detail{padding:18px 18px}
.ic-hours-row{padding:14px 18px}
.ic-why-cell{display:grid;grid-template-columns:48px minmax(0,1fr);align-content:start;column-gap:18px;padding:26px 22px}
.ic-why-icon{grid-row:1 / span 2;width:48px;height:48px;font-size:22px}
.ic-why-icon svg{width:22px;height:22px}
.ic-why-cell h3{margin-top:2px;font-size:18px}
.ic-why-cell p{margin-top:6px;font-size:14.5px}
.ic-why-cell::after{left:22px;right:22px}
.ic-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:36px 24px}
.ic-foot-contact{grid-column:1 / -1}
.ic-foot{padding-top:56px}
.ic-foot-bottom{flex-direction:column;align-items:flex-start}
}
`;

const txt = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v) => (Array.isArray(v) ? v : []);

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// Hours as display rows { days, time }, same rules as MobileChrome: only
// the per-day editor's shape (exactly the seven HOURS_DAYS keys, '' =
// closed) may say "Closed"; older free text is shown as the owner wrote it.
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

// A few words of hours for the CTA band / fact cards: the open rows when
// there are at most two, or a short free-text line; else nothing.
function hoursSummary(rows) {
  if (rows.length === 1 && !rows[0].time) return rows[0].days.length <= 48 ? rows[0].days : null;
  const open = rows.filter((r) => r.time && !/^closed$/i.test(r.time));
  return open.length > 0 && open.length <= 2 ? open.map((r) => `${r.days} ${r.time}`).join('\n') : null;
}

// Display profile for the heading slot. Bebas Neue is very condensed, so
// the mockup's type scale (H1 up to 130px) is sized for it; wider faces
// scale down and get a real bold weight so a custom font still fits.
const CONDENSED = {
  'Bebas Neue': { scale: 1, weight: 400, lh: 0.92, ls: '.02em' },
  Anton: { scale: 0.9, weight: 400, lh: 0.98, ls: '.01em' },
  Oswald: { scale: 0.84, weight: 600, lh: 1, ls: '0em' },
  'Barlow Condensed': { scale: 0.92, weight: 800, lh: 0.95, ls: '.01em' },
  Teko: { scale: 1, weight: 600, lh: 0.9, ls: '.01em' },
  'Big Shoulders Display': { scale: 0.95, weight: 800, lh: 0.95, ls: '.01em' },
};
function headProfile(stack) {
  const family = catalogFamily(familiesFromStack(stack)[0] || '');
  if (family && CONDENSED[family]) return { family, condensed: true, ...CONDENSED[family] };
  const weights = (family && FONT_CATALOG[family]?.weights) || [];
  const weight = weights.includes(800) ? 800 : weights.includes(700) ? 700 : weights.length ? Math.max(...weights) : 400;
  return { family, condensed: false, scale: 0.66, weight, lh: 1.02, ls: '-.01em' };
}

// Every color the steel look needs, derived from the owner's palette:
// the default (#111111 / #C0392B) gives the mockup's black steel and rust;
// a light palette gets light plates with a dark ink footer.
function ironTokens(t) {
  const deep = t.isDark ? mix(t.bg, '#000000', 0.4) : mix(t.bg, t.text, 0.08);
  const navBg = t.isDark ? mix(t.bg, '#000000', 0.3) : t.bg;
  const footerBg = t.isDark ? mix(t.bg, '#000000', 0.45) : mix(t.text, t.bg, 0.04);
  const footerText = ensureContrast(t.isDark ? t.text : t.bg, footerBg, 4.5);
  const heroInk = t.isDark ? mix(t.bg, '#000000', 0.35) : '#000000';
  return {
    '--ic-steel': mix(t.bg, t.surface, 0.5),
    // Big decorative nut on the photo-less hero: outline only, faint.
    '--ic-nut': alpha(t.text, t.isDark ? 0.08 : 0.1),
    '--ic-plate': mix(t.surface, t.text, t.isDark ? 0.05 : 0.04),
    '--ic-nav-bg': navBg,
    '--ic-glass': alpha(navBg, 0.9),
    '--ic-hero-base': `linear-gradient(135deg, ${deep} 0%, ${mix(t.bg, t.surface, 0.6)} 42%, ${t.bg} 100%)`,
    '--ic-grid': alpha(t.accent, t.isDark ? 0.08 : 0.07),
    '--ic-hatch': alpha(t.text, t.isDark ? 0.02 : 0.03),
    '--ic-ghost': alpha(t.text, t.isDark ? 0.035 : 0.05),
    '--ic-ghost-strong': alpha(t.text, t.isDark ? 0.07 : 0.09),
    '--ic-ghost-hot': alpha(t.accent, t.isDark ? 0.3 : 0.24),
    '--ic-outline': alpha(t.text, 0.8),
    '--ic-accent-deep': mix(t.accent, '#000000', 0.35),
    '--ic-accent-hover': mix(t.accent, t.onAccent === '#ffffff' ? '#000000' : '#ffffff', 0.12),
    '--ic-accent-line': alpha(t.accent, 0.45),
    '--ic-glow': alpha(t.accent, 0.9),
    '--ic-glow-soft': alpha(t.accent, 0.3),
    '--ic-shadow': alpha('#000000', t.isDark ? 0.6 : 0.2),
    '--ic-ticker-bg': t.accent,
    '--ic-ticker-text': t.onAccent,
    // Text laid over photos (hero, about caption) sits on a near-black scrim.
    '--ic-hero-accent': ensureContrast(mix(t.accent, '#ffffff', 0.1), heroInk, 4.5),
    '--ic-on-hero-dim': alpha(t.onHero, 0.86),
    // Phones stack the hero text over the whole photo, so the scrim is
    // darker than the kit's even at the top, where the kicker sits.
    '--ic-scrim-m': `linear-gradient(180deg, ${alpha('#000000', 0.66)} 0%, ${alpha('#000000', 0.74)} 55%, ${alpha('#000000', 0.9)} 100%)`,
    '--ic-on-hero-line': alpha(t.onHero, 0.4),
    // About caption over the CSS garage (no photo): fades into the page.
    '--ic-cap-fade': alpha(t.bg, 0.82),
    // The CSS garage scene (about photo fallback).
    '--ic-g-top': t.isDark ? mix(t.bg, '#000000', 0.25) : mix(t.surface, t.text, 0.06),
    '--ic-g-mid': t.isDark ? mix(t.surface, t.bg, 0.3) : t.surface,
    '--ic-g-floor': t.isDark ? mix(t.bg, t.surface, 0.4) : mix(t.surface, t.text, 0.08),
    '--ic-g-door': mix(t.surface, t.text, t.isDark ? 0.04 : 0.05),
    '--ic-g-panel': mix(t.surface, t.text, t.isDark ? 0.09 : 0.1),
    '--ic-g-edge': mix(t.surface, t.text, t.isDark ? 0.15 : 0.18),
    '--ic-footer-bg': footerBg,
    '--ic-footer-text': footerText,
    '--ic-footer-muted': ensureContrast(mix(footerText, footerBg, 0.32), footerBg, 4.5),
    '--ic-footer-accent': ensureContrast(t.accent, footerBg, 4.5),
    '--ic-footer-line': alpha(footerText, 0.14),
  };
}

// "Honest Repairs. Expert Service." -> plain + rust (+ outlined third
// sentence); "Shop Name — Your Car, Treated Right" or "Clean Cars, Done
// Right" -> the part after the dash / single comma in rust; any other
// sentence -> its last third in rust. This is the mockup's two-tone
// headline, applied to whatever the owner wrote (the words never change).
function toneParts(text) {
  const s = txt(text);
  if (!s) return { parts: [], lines: false };
  const bits = s.split(/([.!?]+)\s+/);
  const sentences = [];
  for (let i = 0; i < bits.length; i += 2) sentences.push(`${bits[i]}${bits[i + 1] || ''}`.trim());
  if (sentences.length >= 2 && sentences.length <= 3) return { parts: sentences, lines: true };
  const dash = s.match(/^(.{6,}?)\s+[—–-]\s+(.{3,})$/) || s.match(/^(.{6,}?):\s+(.{3,})$/);
  if (sentences.length === 1 && dash) return { parts: [dash[1], dash[2]], lines: true };
  const commas = s.split(/,\s+/);
  if (sentences.length === 1 && commas.length === 2 && commas.every((c) => c.split(/\s+/).length <= 4)) {
    return { parts: [`${commas[0]},`, commas[1]], lines: true };
  }
  const words = s.split(/\s+/);
  if (words.length < 3) return { parts: [s], lines: false };
  const k = Math.max(1, Math.round(words.length / 3));
  return { parts: [words.slice(0, -k).join(' '), words.slice(-k).join(' ')], lines: false };
}

// Long AI/owner headlines ("precision care, premium coatings, and a
// showroom shine that lasts. Welcome to ...") step the H1 down so they
// never run to seven lines; short punchy ones keep the mockup's scale.
const h1Factor = (text) => {
  const n = txt(text).length;
  return n > 90 ? 0.55 : n > 72 ? 0.62 : n > 46 ? 0.8 : 1;
};

// Owner-typed button URLs (Edit > Hero / Contact) as working hrefs: a bare
// phone number becomes tel: (sms: when the button says "text"), an email
// mailto:, a bare domain https://; script URLs are dropped.
function linkHref(value, label = '') {
  const v = txt(value);
  if (!v || /^(javascript|data|vbscript):/i.test(v)) return '';
  if (/^(https?:|mailto:|tel:|sms:|#|\/)/i.test(v)) return v;
  if (/^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(v)) return `mailto:${v}`;
  const digits = v.replace(/[^\d+]/g, '');
  if (/^\+?[\d\s().-]+$/.test(v) && digits.replace(/\D/g, '').length >= 7) {
    return `${/\b(text|sms|message)\b/i.test(txt(label)) ? 'sms' : 'tel'}:${digits}`;
  }
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]\S*)?$/i.test(v)) return `https://${v}`;
  return v;
}
function Tone({ text }) {
  const { parts, lines } = toneParts(text);
  const cls = ['', 'ic-a', 'ic-o'];
  return parts.map((p, i) => (
    <span key={i} className={[cls[i], lines ? 'ic-block' : ''].filter(Boolean).join(' ') || undefined}>
      {i > 0 && !lines ? ' ' : ''}{p}
    </span>
  ));
}

const Icon = ({ d, size = 20, stroke = 1.7 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12.2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6.5 12 13l8.5-6.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6zM9 12l2 2 4-4',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.8 7 21l5-2.5 5 2.5-1.5-7.2',
  badge: 'M12 2l2.4 1.8 3 .1.9 2.8 2.4 1.8-.9 2.8.9 2.8-2.4 1.8-.9 2.8-3 .1L12 22l-2.4-1.8-3-.1-.9-2.8-2.4-1.8.9-2.8-.9-2.8 2.4-1.8.9-2.8 3-.1zM9 12l2 2 4-4',
  car: 'M5 17h14M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 17v-4l2-5h14l2 5v4M3 13h18',
  calendar: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
  area: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1-2 3.4-1.8-.7a7 7 0 0 1-1.7 1l-.3 1.8h-4l-.3-1.8a7 7 0 0 1-1.7-1l-1.8.7-2-3.4 1.6-1a7 7 0 0 1 0-2l-1.6-1 2-3.4 1.8.7a7 7 0 0 1 1.7-1l.3-1.8h4l.3 1.8a7 7 0 0 1 1.7 1l1.8-.7 2 3.4-1.6 1a7 7 0 0 1 0 2z',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.3-.5-.5-2.3z',
  disc: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM16.5 4.2a9 9 0 0 1 3.3 3.3',
  drop: 'M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3zM9.5 14a2.5 2.5 0 0 0 2.5 2.5',
  snow: 'M12 2v20M4.9 7l14.2 10M4.9 17 19.1 7M9 4l3 2 3-2M9 20l3-2 3 2',
  tire: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 3v5M12 16v5M3 12h5M16 12h5',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  gauge: 'M3.5 17a9 9 0 1 1 17 0M12 14l4.5-5M12 15.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  check: 'M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 13l2 2 4-4',
  spring: 'M6 3h12M6 21h12M7 6l10 2.5M7 10.5l10 2.5M7 15l10 2.5',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
};

// A line icon that matches the service's name (never a claim, just a
// picture); unknown services get the wrench.
const SVC_ICON_RULES = [
  [/brake|rotor|caliper/i, 'disc'],
  [/oil|lube|fluid|filter/i, 'drop'],
  [/\ba\/?c\b|air ?con|heat|cool|hvac|climate/i, 'snow'],
  [/tint|film|ppf|protect|warrant/i, 'shield'],
  [/tire|tyre|wheel|align|rotation|balanc/i, 'tire'],
  [/transmission|clutch|gear|drivetrain|differential|axle/i, 'gear'],
  [/batter|electric|alternator|starter|wiring|light/i, 'bolt'],
  [/diagnos|engine|check|scan|tune|computer/i, 'gauge'],
  [/inspect|emission|smog|state|safety/i, 'check'],
  [/suspens|steer|shock|strut|spring/i, 'spring'],
  [/detail|wash|ceramic|polish|paint|coat|interior|clean|wax/i, 'spark'],
];
const svcIcon = (name) => (SVC_ICON_RULES.find(([re]) => re.test(name)) || [null, 'wrench'])[1];

// Services: the owner's Services tab (businessInfo.services, mirrored to
// packages by normalizeBusinessInfo) wins over the AI list, so renames,
// prices and deletions show; a service the owner left without a
// description borrows the AI description of the same name.
function buildServices(biz, copy) {
  const ai = list(copy.servicesSection?.items)
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }));
  const aiByName = new Map(ai.filter((s) => s.name).map((s) => [s.name.toLowerCase(), s.description]));
  const owner = list(biz.packages).length > 0
    ? biz.packages
    : list(biz.services).some((s) => s && typeof s === 'object') ? biz.services : [];
  const fromOwner = owner.length > 0;
  const rows = fromOwner
    ? owner
      .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
      .map((s) => {
        const name = txt(s.name);
        return { name, price: txt(s.price), description: txt(s.description) || aiByName.get(name.toLowerCase()) || '' };
      })
    : ai.length > 0 ? ai : list(biz.services).map((s) => ({ name: txt(s), price: '', description: '' }));
  return { fromOwner, services: rows.filter((s) => s.name || s.description || s.price) };
}

// Backgrounds per section: fixed ones keep their look, flexible ones take
// their first choice unless it matches the block before them or a fixed
// block after them. Ties in order keep source order, as CSS order does.
const TONES = {
  hero: ['hero'],
  ticker: ['accent'],
  ctaBand: ['iron'],
  about: ['bg'],
  services: ['steel', 'bg'],
  gallery: ['bg', 'steel'],
  whyUs: ['iron', 'steel', 'bg'],
  testimonials: ['bg', 'steel'],
  cta: ['steel', 'bg'],
};
function sectionTones(ids) {
  const tone = {};
  ids.forEach((id, i) => {
    const prev = tone[ids[i - 1]];
    const next = TONES[ids[i + 1]];
    const nextFixed = next && next.length === 1 ? next[0] : null;
    tone[id] = TONES[id].find((c) => c !== prev && c !== nextFixed) || TONES[id].find((c) => c !== prev) || TONES[id][0];
  });
  return tone;
}

function initials(name) {
  const words = txt(name).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || 'IC').slice(0, 2)).toUpperCase();
}

// What the about/split photo slot shows without a photo on the published
// page: the mockup's CSS garage (door, work light, tools), in theme colors.
function Garage({ bare }) {
  return (
    <div className="ic-garage" aria-hidden="true">
      <div className="ic-g-light" />
      {!bare && (
        <div className="ic-g-door">
          <span /><span /><span /><span /><span /><span /><span />
        </div>
      )}
      <div className="ic-g-floor" />
      <span className="ic-g-tool ic-g-wrench"><svg viewBox="0 0 24 24" fill="currentColor"><path d={ICONS.wrench} /></svg></span>
      <span className="ic-g-tool ic-g-gear"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d={ICONS.gear} /></svg></span>
      <span className="ic-g-tool ic-g-gear2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d={ICONS.gear} /></svg></span>
      <span className="ic-spark" style={{ top: '46%', left: '55%' }} />
      <span className="ic-spark" style={{ top: '49%', left: '60%', animationDelay: '.8s' }} />
      <span className="ic-spark" style={{ top: '43%', left: '58%', animationDelay: '1.4s' }} />
      <span className="ic-spark" style={{ top: '52%', left: '52%', animationDelay: '2s' }} />
    </div>
  );
}

// Owner-facing hint for an empty slot; never reaches the published page.
function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="ic-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

const fill = { position: 'absolute', inset: 0, height: '100%' };
const cols = (n) => (n === 1 ? 'ic-c1' : n === 2 || n === 4 ? 'ic-c2' : 'ic-c3');

export default function MechanicIronclad({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const font = templateMeta?.font || "'Bebas Neue', sans-serif";
  const body = templateMeta?.bodyFont || "'Barlow', sans-serif";
  const head = headProfile(font);
  // Labels stay Barlow Condensed under Bebas (the signature pairing);
  // another condensed heading face labels itself; a wide one hands labels
  // to the owner's body font.
  const labelFont = head.family === 'Bebas Neue' ? LABEL_FONT : head.condensed ? font : body;
  const fb = getFallbacks(biz.businessType);

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrder(copy, sections.map((s) => s.id));

  const name = txt(biz.businessName);
  const displayName = name || fb.shopName;
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const email = txt(biz.email);
  const address = txt(biz.address);
  const place = [txt(biz.city), txt(biz.state)].filter(Boolean).join(', ');
  const area = txt(biz.serviceArea);
  const years = txt(biz.yearsInBusiness);
  const hours = hoursRows(biz.hours);
  const hoursLine = hoursSummary(hours);
  const payments = list(biz.paymentMethods).map(txt).filter(Boolean);
  const awards = list(biz.awards).map(txt).filter(Boolean);
  const certs = list(biz.certifications).map(txt).filter(Boolean);
  const specialties = typeof biz.specialties === 'string' ? txt(biz.specialties) : list(biz.specialties).map(txt).filter(Boolean).join(' · ');
  const warranty = txt(biz.warrantyOffered) || txt(biz.warranty);

  const { fromOwner, services } = buildServices(biz, copy);
  const serviceNames = services.map((s) => s.name).filter(Boolean);

  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);

  const testimonials = list(copy.testimonialPlaceholders).filter((q) => txt(q?.text));
  const reviews = copy.googleWidgetKey ? 'google' : testimonials.length > 0 ? 'quotes' : null;

  // Stats only from what the owner typed (About > Stats Box), else the
  // owner's years in business. Nothing invented, nothing padded with "+".
  const ownerStats = list(copy.aboutStats)
    .map((s) => ({ value: txt(s?.value), label: txt(s?.label) }))
    .filter((s) => s.value && s.label);
  const aboutStatsMode = (copy.aboutLayout || 'image') === 'stats';
  const aboutShowsStats = aboutStatsMode && ownerStats.length > 0 && show('about');
  const yearsStat = years && { value: years, label: /^\d+\+?$/.test(years) ? (years === '1' ? 'Year in business' : 'Years in business') : 'In business' };
  const heroStats = !aboutShowsStats && ownerStats.length > 0 ? ownerStats.slice(0, 3) : yearsStat ? [yearsStat] : [];

  // Why Us: the owner's cards (Edit > Why Us) when saved; otherwise fact
  // cards built from Business Info. The old defaults ("Family-Owned",
  // "same-day", "we do it again") were claims nobody entered.
  const ownerCards = list(copy.whyCards)
    .map((c) => ({ icon: txt(c?.icon), title: txt(c?.title), desc: txt(c?.desc) }))
    .filter((c) => c.title || c.desc);
  const factCards = [
    years && { svg: 'calendar', title: 'Experience', desc: /^\d+\+?$/.test(years) ? `${years} ${years === '1' ? 'year' : 'years'} in business.` : years },
    (area || place) && { svg: 'area', title: area ? 'Service Area' : 'Based In', desc: area || place },
    hoursLine && { svg: 'clock', title: 'Shop Hours', desc: hoursLine },
    payments.length > 0 && { svg: 'card', title: 'Payment', desc: payments.join(', ') },
  ].filter(Boolean);
  const whyCards = ownerCards.length > 0 ? ownerCards : factCards.length >= 2 ? factCards : [];

  const creds = [
    warranty && { svg: 'shield', title: 'Warranty', text: warranty },
    certs.length > 0 && { svg: 'badge', title: 'Certifications', text: certs.join(' · ') },
    specialties && { svg: 'car', title: 'Specialties', text: specialties },
  ].filter(Boolean);

  const navLinks = [
    show('services') && services.length > 0 && { href: '#services', label: 'Services' },
    show('about') && { href: '#about', label: 'Our Shop' },
    show('gallery') && galleryImages.length > 0 && { href: '#gallery', label: 'Work', extra: true },
    show('testimonials') && reviews && { href: '#testimonials', label: 'Reviews' },
    show('cta') && { href: '#contact', label: 'Contact' },
  ].filter(Boolean);

  // Hero buttons: the editor's labels and URLs (Edit > Hero) always win.
  // Button 1 books (the scheduler opens from it when booking is on, else it
  // scrolls to Contact); button 2 goes to Services unless it says "call".
  const heroPrimaryUrl = linkHref(copy.ctaPrimaryUrl, copy.ctaPrimary);
  const heroPrimaryLabel = txt(copy.ctaPrimary) || 'Schedule Service';
  const heroPrimaryHref = heroPrimaryUrl || (show('cta') ? '#contact' : tel || '#top');
  const heroSecondaryLabel = txt(copy.ctaSecondary) || (show('services') && services.length > 0 ? 'View All Services' : phone ? `Call ${phone}` : '');
  const callish = /call|phone|ring/i.test(heroSecondaryLabel) || (phone && heroSecondaryLabel.replace(/\D/g, '').includes(phone.replace(/\D/g, '')));
  const heroSecondaryHref = linkHref(copy.ctaSecondaryUrl, heroSecondaryLabel)
    || (callish ? tel : show('services') && services.length > 0 ? '#services' : tel);
  const splitHero = copy.heroLayout === 'split';
  const kicker = [fb.navSubtitle, place].filter(Boolean).join(' · ');

  // Contact / CTA band buttons (Edit > Contact).
  const ctaUrl = linkHref(copy.ctaUrl, copy.ctaButtonText);
  const ctaLabel = txt(copy.ctaButtonText) || txt(copy.ctaPrimary) || 'Schedule Service';
  const ctaHref = ctaUrl || (show('cta') ? '#contact' : tel || '#top');
  const ctaBooking = !ctaUrl;
  // The phone button's URL key is shared with hero button 2, so it only
  // leaves tel: when the owner also gave this button its own text; the
  // default "Call (555) ..." label always dials the number it shows.
  // A label that is itself a phone number ("787-905-0818") dials that
  // number rather than a different one from Business Info.
  const callText = txt(copy.ctaSecondaryText);
  const callLabel = callText || (phone ? `Call ${phone}` : '');
  const callHref = (callText && (linkHref(copy.ctaSecondaryUrl, callText) || (/^\+?[\d\s().-]{7,}$/.test(callText) ? linkHref(callText) : ''))) || tel;
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, place].filter(Boolean).join(', '))}`
    : null;
  const fullAddress = [address, place].filter(Boolean).join(', ');

  const footServices = show('services') && serviceNames.length > 0;
  const marqueeNames = serviceNames.length > 0 ? serviceNames : [];
  const reps = marqueeNames.length > 0 ? Math.max(1, Math.ceil(8 / marqueeNames.length)) : 0;
  const marqueeHalf = Array.from({ length: reps }, (_, r) => marqueeNames.map((n) => ({ n, dup: r > 0 }))).flat();

  // What actually renders, in the owner's order, so every flexible section
  // can take a background that differs from its neighbours (a sparse site
  // would otherwise run Services straight into a same-colored Contact).
  const renders = {
    hero: show('hero'),
    ticker: show('ticker') && (marqueeHalf.length > 0 || editor),
    ctaBand: show('ctaBand'),
    about: show('about'),
    services: show('services') && (services.length > 0 || editor),
    gallery: show('gallery') && (galleryImages.length > 0 || editor),
    whyUs: show('whyUs') && (whyCards.length > 0 || editor),
    testimonials: show('testimonials') && Boolean(reviews),
    cta: show('cta'),
  };
  const tone = sectionTones(sections.map((s) => s.id).filter((id) => renders[id]).sort((a, b) => order(a) - order(b)));

  const iron = ironTokens(t);
  const vars = {
    '--ic-bg': t.bg,
    '--ic-surface': t.surface,
    '--ic-text': t.text,
    '--ic-muted': t.textMuted,
    '--ic-accent': t.accent,
    '--ic-accent-text': t.accentText,
    '--ic-on-accent': t.onAccent,
    '--ic-border': t.border,
    '--ic-border-strong': t.borderStrong,
    '--ic-focus': t.focus,
    '--ic-scrim': t.heroScrim,
    '--ic-scrim-left': t.heroScrimLeft,
    '--ic-on-hero': t.onHero,
    '--ic-head': font,
    '--ic-body': body,
    '--ic-label': labelFont,
    '--ic-hw': head.weight,
    '--ic-hs': head.scale,
    '--ic-hs2': head.condensed ? 1 : 0.8,
    '--ic-bls': head.condensed ? '.1em' : '.03em',
    '--ic-hlh': head.lh,
    '--ic-hls': head.ls,
    '--ic-gutter': 'clamp(20px, 5cqi, 56px)',
    ...iron,
  };

  const brand = (logoStyle, loading) => (images.logo ? (
    <PhotoSlot src={images.logo} alt={name ? `${name} logo` : 'Logo'} loading={loading} style={logoStyle} imgStyle={{ objectFit: 'contain' }} />
  ) : (
    <>
      <span className="ic-hex" aria-hidden="true">{initials(displayName)}</span>
      <span className="ic-brand-text">
        <span className={`ic-brand-name${displayName.length > 20 ? ' ic-brand-long' : ''}`}>{displayName}</span>
        {place && <span className="ic-brand-sub">{place}</span>}
      </span>
    </>
  ));

  const heroButtons = (
    <div className="ic-actions ic-in" style={{ '--ic-d': '360ms' }}>
      <a className="ic-btn ic-btn-primary" href={heroPrimaryHref} {...(heroPrimaryUrl ? {} : { 'data-scheduler-trigger': '' })}>
        {heroPrimaryLabel} <Icon d={ICONS.arrow} size={18} stroke={2.2} />
      </a>
      {heroSecondaryHref && heroSecondaryLabel && (
        <a className="ic-textlink" href={heroSecondaryHref}>
          <span>{heroSecondaryLabel}</span> <Icon d={ICONS.arrow} size={18} stroke={2.2} />
        </a>
      )}
    </div>
  );

  const heroText = (
    <>
      {kicker && <p className="ic-kicker ic-in">{kicker}</p>}
      <h1 className="ic-display ic-h1 ic-in" style={{ '--ic-d': '120ms', '--ic-h1f': h1Factor(copy.headline) }}>
        {txt(copy.headline) ? <Tone text={copy.headline} /> : (
          <><span className="ic-block">Built</span><span className="ic-a ic-block">Tough.</span><span className="ic-o ic-block">Done Right.</span></>
        )}
      </h1>
      {(txt(copy.subheadline) || txt(biz.tagline)) && (
        <p className="ic-lead ic-hero-lead ic-in" style={{ '--ic-d': '240ms' }}>{txt(copy.subheadline) || txt(biz.tagline)}</p>
      )}
      {heroButtons}
      {heroStats.length > 0 && (
        <dl className="ic-stats ic-in" style={{ '--ic-d': '480ms' }}>
          {heroStats.map((s, i) => (
            <div key={`${s.label}-${i}`} className="ic-stat">
              <dt className="ic-stat-label">{s.label}</dt>
              <dd className="ic-stat-num">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );

  const bookBtn = (extraClass = '') => (
    <a className={`ic-btn ic-btn-primary${extraClass}`} href={ctaHref} {...(ctaBooking ? { 'data-scheduler-trigger': '' } : {})}>
      {ctaLabel} <Icon d={ICONS.arrow} size={18} stroke={2.2} />
    </a>
  );

  return (
    <div
      id="top"
      className={`ic-root${labelFont === LABEL_FONT ? '' : ' ic-wide'}${displayName.length > 24 ? ' ic-long' : ''}`}
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.6 }}
    >
      <style>{CSS}</style>
      <a className="ic-skip" href="#main">Skip to content</a>

      <nav className="ic-nav" aria-label="Main" style={{ order: -1 }}>
        <div className="ic-wrap ic-nav-in">
          <a className="ic-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
            {brand({ height: 44, width: 'auto', maxWidth: 190 }, 'eager')}
          </a>
          <div className="ic-links">
            {navLinks.map((l) => (
              <a key={l.href} className={`ic-link${l.extra ? ' ic-link-x' : ''}`} href={l.href}>{l.label}</a>
            ))}
            {tel && <a className="ic-nav-phone" href={tel}><Icon d={ICONS.phone} size={16} />{phone}</a>}
            <a className="ic-btn ic-btn-primary ic-btn-sm" href={heroPrimaryHref} {...(heroPrimaryUrl ? {} : { 'data-scheduler-trigger': '' })}>
              {txt(copy.ctaPrimary) || 'Book Service'}
            </a>
          </div>
          <MobileMenu
            links={navLinks}
            cta={tel ? { href: tel, label: `Call ${phone}` } : { href: '#contact', label: 'Contact us' }}
            colors={t}
            font={body}
          />
        </div>
      </nav>

      <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
        {!show('hero') && <h1 className="ic-sr">{displayName}</h1>}

        {show('hero') && !splitHero && (
          <header data-section="hero" className={`ic-hero${images.hero ? ' ic-has-media' : ''}`} style={{ order: order('hero') }}>
            {images.hero ? (
              <>
                <div className="ic-hero-media">
                  <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
                </div>
                <div className="ic-hero-scrim" />
                <div className="ic-hero-grid" />
              </>
            ) : (
              <>
                <div className="ic-hero-base" />
                <div className="ic-hero-grid" />
                <div className="ic-slash" />
                <div className="ic-slash-edge" />
                {/^\d{1,3}$/.test(years) ? (
                  <div className="ic-ghost" aria-hidden="true">{years}</div>
                ) : (
                  <svg className="ic-nut" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                    <path d="M50 4 90 27v46L50 96 10 73V27z" />
                    <path d="M50 13 82 31.5v37L50 87 18 68.5v-37z" strokeWidth=".5" />
                    <circle cx="50" cy="50" r="22" />
                    <circle className="ic-nut-core" cx="50" cy="50" r="14" strokeWidth="1.4" />
                  </svg>
                )}
              </>
            )}
            <div className="ic-hero-stripe" />
            <div className="ic-wrap">
              <div className="ic-hero-body">
                {heroText}
                {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
              </div>
            </div>
          </header>
        )}

        {show('hero') && splitHero && (
          <header data-section="hero" className="ic-split" style={{ order: order('hero') }}>
            <div className="ic-split-text">
              <div className="ic-hero-base" />
              <div className="ic-hero-grid" />
              {heroText}
            </div>
            <div className="ic-split-photo">
              <PhotoSlot src={images.hero} slot="hero" alt="" loading="eager" fetchPriority="high" style={fill} fallback={<Garage />} />
            </div>
          </header>
        )}

        {renders.ticker && (
          <section data-section="ticker" className="ic-ticker" aria-label="Services we offer" style={{ order: order('ticker'), '--ic-mq': `${Math.max(24, marqueeHalf.length * 4)}s` }}>
            {marqueeHalf.length > 0 ? (
              <div className="ic-track">
                {[0, 1].map((pass) => marqueeHalf.map((m, i) => (
                  <span
                    key={`${pass}-${i}`}
                    className={`ic-tick${pass || m.dup ? ' ic-dup' : ''}`}
                    {...(pass || m.dup ? { 'aria-hidden': 'true' } : {})}
                  >
                    {m.n}
                    <Icon d={ICONS.gear} size={18} stroke={1.8} />
                  </span>
                )))}
              </div>
            ) : (
              <div className="ic-wrap"><EditorHint>This ticker lists your services. Add them in Edit &gt; Services.</EditorHint></div>
            )}
          </section>
        )}

        {show('ctaBand') && (
          <section data-section="ctaBand" className="ic-band" aria-labelledby="ic-band-h" style={{ order: order('ctaBand') }}>
            <div className="ic-wrap ic-band-in">
              <div data-acg-reveal="">
                <h2 id="ic-band-h" className="ic-display ic-band-h"><Tone text={txt(copy.ctaHeadline) || fb.ctaHeadline} /></h2>
                <p className="ic-lead">{txt(copy.ctaSubtext) || 'Get in touch to schedule a service or ask a question.'}</p>
              </div>
              <div className="ic-band-side" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                {bookBtn()}
                {callHref && callLabel && (
                  <a className="ic-textlink" href={callHref}><Icon d={ICONS.phone} size={18} /><span>{callLabel}</span></a>
                )}
                {(fullAddress || hoursLine) && (
                  <div className="ic-band-meta">
                    {fullAddress && <span>{fullAddress}</span>}
                    {hoursLine && <span>{hoursLine}</span>}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {show('about') && (
          <section data-section="about" id="about" className="ic-about" aria-labelledby="ic-about-h" style={{ order: order('about'), scrollMarginTop: 72 }}>
            <div className={`ic-about-visual${aboutShowsStats ? ' ic-about-stats' : ''}`}>
              {aboutShowsStats ? (
                <>
                  <Garage bare />
                  <dl className="ic-statgrid">
                    {ownerStats.slice(0, 4).map((s, i) => (
                      <div key={`${s.label}-${i}`}>
                        <dt className="ic-stat-label">{s.label}</dt>
                        <dd className="ic-stat-num">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <PhotoSlot src={images.about} slot="about" alt={name ? `${name} shop` : 'Our shop'} style={fill} fallback={<Garage />} />
              )}
              <div className={`ic-cap${images.about && !aboutShowsStats ? '' : ' ic-cap-plain'}`}>
                {certs.length > 0 && (
                  <span className="ic-cap-badge"><Icon d={ICONS.badge} size={16} />{certs[0]}</span>
                )}
                <p className="ic-display ic-cap-title">
                  {displayName}
                  {place && <span>{place}</span>}
                </p>
              </div>
            </div>
            <div className="ic-about-copy" data-acg-reveal="">
              <p className="ic-eyebrow">About the Shop</p>
              <h2 id="ic-about-h" className="ic-display ic-h2">We Don&apos;t Cut <span className="ic-a">Corners.</span></h2>
              <div className="ic-prose">
                {(txt(copy.aboutText) ? txt(copy.aboutText).split(/\n\s*\n/) : [`${displayName} provides ${fb.aboutFallback}${place ? ` in ${place}` : ''}.`])
                  .map((p) => p.trim()).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
              </div>
              {aboutStatsMode && ownerStats.length === 0 && (
                <EditorHint>Add your stats in Edit &gt; About &gt; Stats Box (the photo shows until then).</EditorHint>
              )}
              {(creds.length > 0 || awards.length > 0) && (
                <ul className="ic-creds">
                  {creds.map((c) => (
                    <li key={c.title} className="ic-cred">
                      <span className="ic-cred-icon"><Icon d={ICONS[c.svg]} size={19} /></span>
                      <span><strong>{c.title}</strong>{c.text}</span>
                    </li>
                  ))}
                  {awards.length > 0 && (
                    <li className="ic-cred" data-acg-awards="">
                      <span className="ic-cred-icon"><Icon d={ICONS.award} size={19} /></span>
                      <span><strong>Recognition</strong>{awards.join(' · ')}</span>
                    </li>
                  )}
                </ul>
              )}
              <a className="ic-btn ic-btn-primary" href={show('cta') ? '#contact' : ctaHref} {...(show('cta') || ctaBooking ? { 'data-scheduler-trigger': '' } : {})}>
                Schedule Your Visit <Icon d={ICONS.arrow} size={18} stroke={2.2} />
              </a>
            </div>
          </section>
        )}

        {renders.services && (
          <section data-section="services" id="services" className={`ic-section ic-tone-${tone.services} ic-dash-top`} aria-labelledby="ic-services-h" style={{ order: order('services') }}>
            <ServiceCardCss />
            <div className="ic-wrap">
              <div className={`ic-head${txt(copy.servicesSection?.intro) ? '' : ' ic-head-solo'}`} data-acg-reveal="">
                <div>
                  <p className="ic-eyebrow">What We Do</p>
                  <h2 id="ic-services-h" className="ic-display ic-h2">
                    {txt(copy.servicesSection?.title) ? <Tone text={copy.servicesSection.title} /> : <>No Job Too <span className="ic-a">Heavy.</span></>}
                  </h2>
                </div>
                {txt(copy.servicesSection?.intro) && <p className="ic-intro">{copy.servicesSection.intro}</p>}
              </div>
              {services.length > 0 ? (
                <div className={`ic-grid ${cols(services.length)}`}>
                  {services.map((s, i) => (
                    <div key={`${s.name}-${i}`} className="ic-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                      <article className="acg-svc-card ic-card">
                        <div className="ic-card-top">
                          <span className="ic-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                          <span className="ic-tile" aria-hidden="true"><Icon d={ICONS[svcIcon(s.name)]} size={24} stroke={1.6} /></span>
                        </div>
                        {s.name && <h3 className="ic-card-title">{s.name}</h3>}
                        <ServiceDescription
                          id={`svc-more-${fromOwner ? 'pkg' : 'ai'}-${i}`}
                          text={s.description}
                          style={{ marginTop: 12, color: t.textMuted, fontSize: 15, lineHeight: 1.7 }}
                          accentColor={t.accentText}
                        />
                        <div className="acg-svc-foot">
                          <div className="ic-price-row">
                            <BookNowLink serviceName={s.name} phone={phone} label={<>Book now <Icon d={ICONS.arrow} size={16} stroke={2.2} /></>} />
                            {s.price && <span className="ic-price">{s.price}</span>}
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

        {renders.gallery && (
          <section data-section="gallery" id="gallery" className={`ic-section ic-tone-${tone.gallery}`} aria-labelledby="ic-gallery-h" style={{ order: order('gallery') }}>
            <div className="ic-wrap">
              <div className="ic-head ic-head-solo" data-acg-reveal="">
                <div>
                  <p className="ic-eyebrow">Gallery</p>
                  <h2 id="ic-gallery-h" className="ic-display ic-h2">Our Work, <span className="ic-a">Up Close.</span></h2>
                </div>
              </div>
              {galleryImages.length === 0 ? (
                <PhotoSlot slot="gallery" style={{ minHeight: 220 }} />
              ) : galleryImages.length > 3 ? (
                <>
                  <div className={`ic-gal-track${galleryImages.length <= 6 ? ` ic-gal-grid ic-gt${galleryImages.length}` : ''}`} role="region" aria-label="Photo gallery, scroll sideways for more" tabIndex={0}>
                    {galleryImages.map((src, i) => (
                      <figure key={i} className="ic-shot">
                        <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      </figure>
                    ))}
                  </div>
                  <p className="ic-swipe" aria-hidden="true">Swipe or scroll for more →</p>
                </>
              ) : (
                <div className={`ic-gal ic-g${galleryImages.length}`}>
                  {galleryImages.map((src, i) => (
                    <figure key={i} className="ic-shot" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <PhotoSlot src={src} alt={`${name || 'Our'} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {renders.whyUs && (
          <section data-section="whyUs" id="why" className={`ic-section ic-tone-${tone.whyUs} ic-why`} aria-labelledby="ic-why-h" style={{ order: order('whyUs') }}>
            <div className="ic-wrap">
              <div className="ic-head ic-head-solo" data-acg-reveal="">
                <div>
                  <p className="ic-eyebrow">Why Choose Us</p>
                  <h2 id="ic-why-h" className="ic-display ic-h2">Straight Talk. <span className="ic-a">Solid Work.</span></h2>
                </div>
              </div>
              {whyCards.length > 0 ? (
                <div className={`ic-grid ${whyCards.length % 4 === 0 ? 'ic-c4' : cols(whyCards.length)}`}>
                  {whyCards.map((c, i) => (
                    <div key={`${c.title}-${i}`} className="ic-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 4) * 90}ms` }}>
                      <div className="ic-why-cell">
                        <span className="ic-why-icon" aria-hidden="true">
                          {c.svg ? <Icon d={ICONS[c.svg]} size={26} stroke={1.6} /> : c.icon ? <IconOrEmoji value={c.icon} size={26} /> : <Icon d={ICONS.wrench} size={26} stroke={1.6} />}
                        </span>
                        {c.title && <h3>{c.title}</h3>}
                        {c.desc && <p>{c.desc}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EditorHint>Add your own cards in Edit &gt; Why Us, or fill in Years in Business, Service Area, Hours and Payment in Business Info.</EditorHint>
              )}
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'google' && (
          <section data-section="testimonials" id="testimonials" className={`ic-section ic-tone-${tone.testimonials}`} aria-label={txt(copy.googleReviewsTitle) || 'Reviews'} style={{ order: order('testimonials') }}>
            <div className="ic-wrap">
              {txt(copy.googleReviewsTitle) && (
                <div className="ic-head ic-head-solo">
                  <div>
                    <p className="ic-eyebrow">Reviews</p>
                    <h2 className="ic-display ic-h2">{copy.googleReviewsTitle}</h2>
                  </div>
                </div>
              )}
              <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'quotes' && (
          <section data-section="testimonials" id="testimonials" className={`ic-section ic-tone-${tone.testimonials} ic-dash-bottom`} aria-labelledby="ic-reviews-h" style={{ order: order('testimonials') }}>
            <div className="ic-wrap">
              <div className="ic-head ic-head-solo" data-acg-reveal="">
                <div>
                  <p className="ic-eyebrow">Testimonials</p>
                  <h2 id="ic-reviews-h" className="ic-display ic-h2">In Their <span className="ic-a">Own Words.</span></h2>
                </div>
              </div>
              <div className={`ic-quotes ${cols(testimonials.length)}`}>
                {testimonials.map((q, i) => (
                  <div key={i} className="ic-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                    <figure className="ic-quote">
                      <span className="ic-qmark" aria-hidden="true">&ldquo;</span>
                      <blockquote><p>{txt(q.text)}</p></blockquote>
                      {(txt(q.name) || txt(q.vehicle) || txt(q.role)) && (
                        <figcaption className="ic-author">
                          {txt(q.name) && <span className="ic-hex" aria-hidden="true">{initials(q.name)}</span>}
                          <span>
                            {txt(q.name) && <span className="ic-author-name">{txt(q.name)}</span>}
                            {(txt(q.vehicle) || txt(q.role)) && <span className="ic-author-meta">{txt(q.vehicle) || txt(q.role)}</span>}
                          </span>
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
          <section data-section="cta" id="contact" className={`ic-section ic-tone-${tone.cta} ic-contact`} aria-labelledby="ic-contact-h" style={{ order: order('cta') }}>
            <div className="ic-wrap ic-contact-grid">
              <div data-acg-reveal="">
                <p className="ic-eyebrow">Get In Touch</p>
                <h2 id="ic-contact-h" className="ic-display ic-h2">Let&apos;s Get <span className="ic-a">To Work.</span></h2>
                <p className="ic-lead">{txt(copy.footerTagline) || 'Call or stop by the shop. Everything you need to reach us is right here.'}</p>
                {!show('ctaBand') && (
                  <div className="ic-actions">
                    {bookBtn()}
                    {callHref && callLabel && (
                      <a className="ic-textlink" href={callHref}><Icon d={ICONS.phone} size={18} /><span>{callLabel}</span></a>
                    )}
                  </div>
                )}
                {(phone || email || fullAddress || area) && (
                  <div className="ic-details">
                    {phone && (
                      <a className="ic-detail" href={tel || undefined}>
                        <span className="ic-detail-icon"><Icon d={ICONS.phone} size={22} /></span>
                        <span className="ic-detail-body"><span className="ic-label">Phone</span><span className="ic-detail-value">{phone}</span></span>
                      </a>
                    )}
                    {email && (
                      <a className="ic-detail" href={`mailto:${email}`}>
                        <span className="ic-detail-icon"><Icon d={ICONS.mail} size={22} /></span>
                        <span className="ic-detail-body"><span className="ic-label">Email</span><span className="ic-detail-value">{email}</span></span>
                      </a>
                    )}
                    {address ? (
                      <a className="ic-detail" href={mapsHref} target="_blank" rel="noopener noreferrer">
                        <span className="ic-detail-icon"><Icon d={ICONS.pin} size={22} /></span>
                        <span className="ic-detail-body"><span className="ic-label">Address</span><span className="ic-detail-value">{fullAddress}</span></span>
                      </a>
                    ) : (area || place) && (
                      <div className="ic-detail">
                        <span className="ic-detail-icon"><Icon d={ICONS.pin} size={22} /></span>
                        <span className="ic-detail-body"><span className="ic-label">{area ? 'Service Area' : 'Based In'}</span><span className="ic-detail-value">{area || place}</span></span>
                      </div>
                    )}
                    {address && area && (
                      <div className="ic-detail">
                        <span className="ic-detail-icon"><Icon d={ICONS.area} size={22} /></span>
                        <span className="ic-detail-body"><span className="ic-label">Service Area</span><span className="ic-detail-value">{area}</span></span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                <p className="ic-eyebrow">Shop Hours</p>
                <h3 className="ic-display ic-h3">Hours &amp; <span className="ic-a">Details.</span></h3>
                {hours.length > 1 || (hours.length === 1 && hours[0].time) ? (
                  <dl className="ic-hours">
                    {hours.map((h) => (
                      <div key={h.days} className="ic-hours-row">
                        <dt>{h.days}</dt>
                        <dd className={/^closed$/i.test(h.time) ? 'ic-closed' : undefined}>{h.time}</dd>
                      </div>
                    ))}
                  </dl>
                ) : hours.length === 1 ? (
                  <p className="ic-hours-note">{hours[0].days}</p>
                ) : phone ? (
                  <p className="ic-hours-note">Call {phone} for current hours.</p>
                ) : (
                  <EditorHint>Add your hours in Edit &gt; Business Info.</EditorHint>
                )}
                {warranty && (
                  <div className="ic-callout">
                    <Icon d={ICONS.shield} size={26} />
                    <div><span className="ic-label" style={{ color: t.accentText }}>Warranty</span><p>{warranty}</p></div>
                  </div>
                )}
                {payments.length > 0 && (
                  <div className="ic-callout">
                    <Icon d={ICONS.card} size={26} />
                    <div>
                      <span className="ic-label" style={{ color: t.accentText }}>We Accept</span>
                      <div className="ic-chips">{payments.map((p) => <span key={p} className="ic-chip">{p}</span>)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="ic-foot" style={{ order: 9999 }}>
        <div className="ic-wrap">
          <div className="ic-foot-grid" style={{ '--ic-fcols': 1 + (footServices ? 1 : 0) + (navLinks.length > 0 ? 1 : 0) }}>
            <div className="ic-foot-brand">
              <a className="ic-brand" href="#top" aria-label={name ? `${name}, back to top` : 'Back to top'}>
                {brand({ height: 48, width: 'auto', maxWidth: 200 })}
              </a>
              {(txt(copy.footerTagline) || txt(biz.tagline) || fb.footerDesc) && (
                <p className="ic-foot-tag">{txt(copy.footerTagline) || txt(biz.tagline) || fb.footerDesc}</p>
              )}
              <div className="ic-social">
                <SocialRow biz={biz} color={iron['--ic-footer-accent']} size={18} gap={10} images={images} />
              </div>
            </div>
            {footServices && (
              <div>
                <p className="ic-foot-h">Services</p>
                <ul className="ic-foot-list">
                  {serviceNames.slice(0, 6).map((n, i) => <li key={`${n}-${i}`}><a href="#services">{n}</a></li>)}
                </ul>
              </div>
            )}
            {navLinks.length > 0 && (
              <div>
                <p className="ic-foot-h">Quick Links</p>
                <ul className="ic-foot-list">
                  {navLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
            )}
            <div className="ic-foot-contact">
              <p className="ic-foot-h">Contact</p>
              <ul className="ic-foot-list">
                {tel && <li><a href={tel}>{phone}</a></li>}
                {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                {address && <li>{address}</li>}
                {place && <li>{place}</li>}
              </ul>
            </div>
          </div>
          {/* The motto comes first in source and is a span: exportHtml
              appends its "Site owner" link to the footer's last <p>, which
              must be the copyright line, not the display-font motto. */}
          <div className="ic-foot-bottom">
            <span className="ic-foot-motto">Built Tough. Done Right.</span>
            <p className="ic-copy">© <span data-acg-year="">{new Date().getFullYear()}</span> {displayName}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref="#contact" colors={t} font={body} />
    </div>
  );
}
