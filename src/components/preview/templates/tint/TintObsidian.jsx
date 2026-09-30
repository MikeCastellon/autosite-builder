// Obsidian Studio (tint_obsidian): ultra-dark "void" tint studio with an
// electric violet + cyan glow. Theme-ready (see CLAUDE.md, "Template
// contract"); built like mobile/MobileChrome.jsx:
//   - every color is a deriveTheme() token exposed as a --ob-* variable. The
//     studio's second glow (cyan in the default palette) is the owner's
//     accent turned round the color wheel, so a custom accent brings its own
//     partner color instead of a fixed cyan;
//   - all CSS lives in the one prefixed <style> below: @container layout,
//     hover inside (hover:hover), motion inside prefers-reduced-motion;
//   - no useState/useEffect: the nav is opaque by default and only turns to
//     glass from html[data-acg-scrolled] (siteRuntime.js);
//   - facts (spec strip, stats, awards, hours, shade legal notes) render only
//     when the owner entered them; editor hints go through PhotoSlot /
//     EditorOnly.
// Restored from WebsiteMockups/obsidian-tint-studio.html: Syne 800 display
// scale, Syne Mono accents, the VLT shade guide (a static row of "windows"
// darkened to each shade's VLT), film-tier service cards, the hex field and
// light leaks, the // spec strip and the contact detail rows.
import { SocialRow } from '../SocialIcons.jsx';
import GoogleReviewsWidget from '../GoogleReviewsWidget.jsx';
import IconOrEmoji from '../IconOrEmoji.jsx';
import { ServiceCardCss, ServiceDescription, BookNowLink } from '../ServiceCardParts.jsx';
import { buildSectionOrder } from '../../../../lib/sectionOrder.js';
import { getFallbacks } from '../../../../lib/templateFallbacks.js';
import { formatHours } from '../../../../lib/formatHours.js';
import { HOURS_DAYS } from '../../../../lib/businessHours.js';
import { deriveTheme, mix, alpha, ensureContrast, contrastRatio, hexToRgb, rgbToHex } from '../kit/theme.js';
import { PhotoSlot, PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { MobileMenu, MobileActionBar } from '../kit/MobileMenu.jsx';
import { EditorOnly, useEditorMode } from '../kit/EditorMode.jsx';

export const themeReady = true;

// Same ids and order as ContentEditor's TOGGLEABLE.tint_obsidian, so the
// editor's Sections list matches what renders. Never rename an id.
export const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'shadeGuide', label: 'Shade Guide' },
  { id: 'services', label: 'Services' },
  { id: 'brands', label: 'Film Brands' },
  { id: 'process', label: 'Process Steps' },
  { id: 'about', label: 'About' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'testimonials', label: 'Reviews' },
  { id: 'cta', label: 'Contact / CTA' },
];

// Syne Mono sets the small "// code" accents (labels, spec keys, step
// numbers); headings and body text always use the owner's two font slots.
export const extraFonts = ["'Syne Mono', monospace"];

const CSS = `
.ob-root :where(h1,h2,h3,h4,p,ul,ol,dl,dd,figure,blockquote){margin:0}
.ob-root :where(ul,ol){list-style:none;padding:0}
.ob-wrap{position:relative;width:100%;max-width:1280px;margin:0 auto;padding-left:var(--ob-gutter);padding-right:var(--ob-gutter)}
.ob-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.ob-skip{position:absolute;left:12px;top:12px;z-index:300;padding:12px 18px;background:var(--ob-accent);color:var(--ob-on-accent);font-weight:600;text-decoration:none}
.ob-skip:not(:focus){width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.ob-root a:focus-visible,.ob-root summary:focus-visible,.ob-root label:focus-visible,.ob-track:focus-visible{outline:2px solid var(--ob-focus);outline-offset:3px}
.ob-hint{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin-top:20px;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-family:var(--ob-body);font-size:13px;font-weight:500;line-height:1.45;letter-spacing:0;text-transform:none;color:inherit;opacity:.85}
.ob-tag{display:flex;align-items:center;gap:14px;font-family:var(--ob-mono);font-size:11px;line-height:1.4;letter-spacing:.3em;text-transform:uppercase;color:var(--ob-accent-text)}
.ob-tag::before{content:'';flex:none;width:28px;height:1px;background:var(--ob-grad)}
.ob-h2{--ob-size:clamp(36px,5cqi,64px);--ob-avail:min(780px,100cqi - 2 * var(--ob-gutter));margin-top:20px;font-family:var(--ob-head);font-size:min(var(--ob-size),calc(var(--ob-avail) / var(--ob-fit,1)));font-weight:800;line-height:1.02;letter-spacing:-.035em;color:var(--ob-text);text-wrap:balance}
.ob-v{color:var(--ob-hl)}
.ob-body{font-size:17px;line-height:1.75;color:var(--ob-muted);text-wrap:pretty}
.ob-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:end;gap:24px clamp(32px,6cqi,96px);margin-bottom:clamp(48px,6cqi,80px)}
.ob-head .ob-h2{--ob-avail:calc((min(100cqi,1280px) - 2 * var(--ob-gutter) - clamp(32px,6cqi,96px)) * 1.1 / 2.1)}
.ob-head-solo{grid-template-columns:minmax(0,1fr);max-width:780px}
.ob-head-solo .ob-h2{--ob-avail:min(780px,100cqi - 2 * var(--ob-gutter))}
.ob-center{margin-left:auto;margin-right:auto;text-align:center}
.ob-center .ob-tag{justify-content:center}
.ob-center .ob-tag::after{content:'';flex:none;width:28px;height:1px;background:var(--ob-grad)}
.ob-section{position:relative;isolation:isolate;overflow:clip;padding:clamp(88px,10cqi,132px) 0;background:var(--ob-bg);border-top:1px solid var(--ob-border2);scroll-margin-top:72px}
.ob-deep{background:var(--ob-deep)}
.ob-panel{background:var(--ob-surface)}
.ob-orb{position:absolute;z-index:-1;width:min(680px,90cqi);aspect-ratio:1;border-radius:50%;pointer-events:none;background:radial-gradient(circle,var(--ob-glow-soft),transparent 68%)}
.ob-orb-tr{top:-240px;right:-220px}
.ob-orb-bl{bottom:-260px;left:-220px;background:radial-gradient(circle,var(--ob-glow2-soft),transparent 68%)}
.ob-orb-c{top:50%;left:50%;translate:-50% -50%;width:min(900px,110cqi)}

.ob-nav{position:sticky;top:0;z-index:100;background:var(--ob-bg);border-bottom:1px solid var(--ob-border)}
html[data-acg-scrolled] .ob-nav{box-shadow:0 18px 40px -24px var(--ob-shadow)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){html[data-acg-scrolled] .ob-nav{background:var(--ob-glass);-webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%)}}
.ob-nav-in{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:72px}
.ob-brand{flex:0 1 auto;display:inline-flex;align-items:center;gap:14px;min-width:0;color:var(--ob-text);text-decoration:none}
.ob-mark-wrap{flex:none;display:block;filter:drop-shadow(0 0 12px var(--ob-glow))}
.ob-mark{display:block;width:32px;height:32px;background:var(--ob-grad);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
.ob-brand-txt{display:block;min-width:0}
.ob-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;max-width:340px;font-family:var(--ob-head);font-size:16px;font-weight:800;line-height:1.15;letter-spacing:.14em;text-transform:uppercase}
.ob-sub{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ob-mono);font-size:9.5px;line-height:1.2;letter-spacing:.3em;text-transform:uppercase;color:var(--ob-accent-text)}
.ob-links{flex:none;display:flex;align-items:center;gap:clamp(18px,2.4cqi,34px)}
.ob-link{position:relative;padding:12px 0;font-family:var(--ob-head);font-size:11.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--ob-muted);text-decoration:none}
.ob-link::after{content:'';position:absolute;left:0;right:0;bottom:6px;height:1px;background:var(--ob-grad);transform:scaleX(0);transform-origin:left center}
.ob-nav-cta{position:relative;isolation:isolate;overflow:hidden;display:inline-flex;align-items:center;min-height:44px;padding:0 22px;border:1px solid var(--ob-border);background:var(--ob-accent-soft);color:var(--ob-text);font-family:var(--ob-head);font-size:11.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;text-decoration:none;white-space:nowrap}
.ob-nav-cta::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--ob-btn);opacity:0}

.ob-btn{position:relative;isolation:isolate;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:56px;padding:0 34px;border:1px solid transparent;font-family:var(--ob-head);font-size:12.5px;font-weight:700;line-height:1.2;letter-spacing:.2em;text-transform:uppercase;text-align:center;text-decoration:none;cursor:pointer}
.ob-btn:active{transform:translateY(1px)}
.ob-btn-primary{color:var(--ob-on-accent);background-color:var(--ob-accent);background-image:var(--ob-btn);box-shadow:0 14px 44px -16px var(--ob-glow)}
.ob-btn-primary::before{content:'';position:absolute;z-index:-1;top:0;left:-110px;width:80px;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);transform:skewX(-18deg)}
.ob-btn-line{min-height:56px;padding:0 4px;color:var(--ob-text);background:transparent}
.ob-btn-line span{padding-bottom:5px;border-bottom:1px solid var(--ob-border-strong)}
.ob-btn-ghost{color:var(--ob-text);border-color:var(--ob-border-strong);background:transparent}
.ob-arrow{flex:none}

.ob-hero{position:relative;isolation:isolate;display:flex;flex-direction:column;justify-content:center;min-height:clamp(640px,calc(100vh - 72px),980px);padding:clamp(88px,10cqi,136px) 0 clamp(48px,6cqi,80px);overflow:clip;background:var(--ob-bg);color:var(--ob-text)}
.ob-hero-tint{position:absolute;inset:0;z-index:-4;background:var(--ob-hero-tint)}
.ob-leak{position:absolute;inset:0;z-index:-3;pointer-events:none}
.ob-leak-1{background:var(--ob-leak1);transform:rotate(-12deg) scaleX(2);transform-origin:top right}
.ob-leak-2{background:var(--ob-leak2)}
.ob-gridlines{position:absolute;inset:0;z-index:-3;pointer-events:none;background-image:linear-gradient(var(--ob-gridline) 1px,transparent 1px),linear-gradient(90deg,var(--ob-gridline) 1px,transparent 1px);background-size:80px 80px;-webkit-mask-image:radial-gradient(ellipse 70% 70% at 68% 50%,black,transparent);mask-image:radial-gradient(ellipse 70% 70% at 68% 50%,black,transparent)}
.ob-hex{position:absolute;z-index:-2;top:50%;right:5%;translate:0 -50%;display:grid;grid-template-columns:repeat(6,38px);gap:5px 4px;opacity:.09;pointer-events:none}
.ob-hex i{display:block;width:38px;height:42px;background:var(--ob-hl);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);opacity:.45}
.ob-hex i:nth-child(12n+7),.ob-hex i:nth-child(12n+8),.ob-hex i:nth-child(12n+9),.ob-hex i:nth-child(12n+10),.ob-hex i:nth-child(12n+11),.ob-hex i:nth-child(12n+12){translate:21px 0}
.ob-hex i:nth-child(5n+2),.ob-hex i:nth-child(7n+3){opacity:1}
.ob-ghost{position:absolute;z-index:-2;right:-1cqi;bottom:-.1em;max-width:none;font-family:var(--ob-head);font-size:clamp(110px,17cqi,260px);font-weight:800;line-height:.8;letter-spacing:-.04em;text-transform:uppercase;white-space:nowrap;color:transparent;-webkit-text-stroke:1px var(--ob-ghost);pointer-events:none;user-select:none}
.ob-hero-media{position:absolute;inset:0;z-index:-4}
.ob-hero-scrim{position:absolute;inset:0;z-index:-3;background:var(--ob-scrim-left)}
.ob-hero-fade{position:absolute;left:0;right:0;bottom:0;height:22%;z-index:-2;background:var(--ob-hero-fade)}
.ob-hero-body{position:relative;max-width:900px}
.ob-chip{display:inline-flex;align-items:center;gap:10px;max-width:100%;padding:8px 16px;border:1px solid var(--ob-border);background:var(--ob-accent-soft);font-family:var(--ob-mono);font-size:10.5px;line-height:1.5;letter-spacing:.28em;text-transform:uppercase;color:var(--ob-accent-text)}
.ob-led{flex:none;width:6px;height:6px;border-radius:50%;background:var(--ob-accent2-text);box-shadow:0 0 10px var(--ob-accent2-text)}
.ob-h1{--ob-size:clamp(50px,8.2cqi,108px);--ob-avail:min(900px,100cqi - 2 * var(--ob-gutter));margin-top:32px;font-family:var(--ob-head);font-size:min(var(--ob-size),calc(var(--ob-avail) / var(--ob-fit,1)));font-weight:800;line-height:.94;letter-spacing:-.045em;color:inherit;text-wrap:balance}
.ob-h1-long{--ob-size:clamp(42px,6cqi,80px);line-height:.98;letter-spacing:-.04em}
.ob-h1-xl{--ob-size:clamp(36px,4.6cqi,62px);--ob-avail:min(1080px,100cqi - 2 * var(--ob-gutter));line-height:1.02;letter-spacing:-.035em}
.ob-hero-body.ob-wide-body{max-width:1080px}
.ob-electric{color:var(--ob-hl)}
@supports ((-webkit-background-clip:text) or (background-clip:text)){
.ob-electric,.ob-grad-text{-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.ob-electric{background-image:var(--ob-grad-text);background-size:200% 100%}
.ob-has-media .ob-electric{background-image:var(--ob-grad-hero)}
.ob-grad-text{background-image:var(--ob-grad-text)}
}
.ob-lead{margin-top:30px;max-width:580px;font-size:clamp(17px,1.5cqi,19px);line-height:1.75;color:var(--ob-muted);text-wrap:pretty}
.ob-actions{display:flex;flex-wrap:wrap;align-items:center;gap:16px 30px;margin-top:46px}
.ob-spec{--ob-strip-w:calc(min(100cqi,1280px) - 2 * var(--ob-gutter));position:relative;display:grid;margin-top:clamp(56px,7cqi,92px);border:1px solid var(--ob-border2);background:var(--ob-spec-bg)}
.ob-n1{grid-template-columns:minmax(0,1fr);--ob-n:1}
.ob-n2{grid-template-columns:repeat(2,minmax(0,1fr));--ob-n:2}
.ob-n3{grid-template-columns:repeat(3,minmax(0,1fr));--ob-n:3}
.ob-n4{grid-template-columns:repeat(4,minmax(0,1fr));--ob-n:4}
.ob-spec-block{position:relative;display:flex;flex-direction:column;padding:22px 26px;border-left:1px solid var(--ob-border2)}
.ob-spec-block:first-child{border-left:0}
.ob-spec-block::before{content:'';position:absolute;top:-1px;left:0;right:0;height:1px;background:var(--ob-grad);opacity:0}
.ob-spec-key{display:block;font-family:var(--ob-mono);font-size:10px;line-height:1.4;letter-spacing:.24em;text-transform:uppercase;color:var(--ob-accent-text)}
.ob-spec-val{display:block;margin-top:8px;font-family:var(--ob-head);font-size:clamp(18px,1.7cqi,22px);font-weight:700;line-height:1.3;letter-spacing:-.01em;color:var(--ob-text);white-space:pre-line;overflow-wrap:break-word}
.ob-stat-val{--ob-size:clamp(28px,3cqi,40px);--ob-avail:calc(var(--ob-strip-w) / var(--ob-n,4) - 52px);font-size:min(var(--ob-size),calc(var(--ob-avail) / var(--ob-fit,1)));font-weight:800;line-height:1.05;letter-spacing:-.03em}
.ob-has-media{color:var(--ob-on-hero);text-shadow:0 1px 30px rgba(0,0,0,.3)}
.ob-has-media .ob-lead{color:var(--ob-on-hero-muted)}
.ob-has-media .ob-chip{color:var(--ob-on-hero);border-color:var(--ob-on-hero-line);background:rgba(0,0,0,.28)}
.ob-has-media .ob-btn-line{color:var(--ob-on-hero)}
.ob-has-media .ob-btn-line span{border-bottom-color:var(--ob-on-hero-line)}
.ob-has-media .ob-spec{background:rgba(0,0,0,.4);border-color:var(--ob-on-hero-line)}
.ob-has-media .ob-spec-block{border-left-color:var(--ob-on-hero-line)}
.ob-has-media .ob-spec-block:first-child{border-left:0}
.ob-has-media .ob-spec-key{color:var(--ob-on-hero-muted)}
.ob-has-media .ob-spec-val{color:var(--ob-on-hero)}
.ob-split{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);min-height:clamp(600px,calc(100vh - 72px),900px);background:var(--ob-bg);color:var(--ob-text)}
.ob-split-text{position:relative;isolation:isolate;overflow:clip;display:flex;flex-direction:column;justify-content:center;padding:clamp(72px,8cqi,120px) clamp(24px,5cqi,72px) clamp(64px,7cqi,104px) max(var(--ob-gutter),calc((100cqi - 1280px) / 2 + var(--ob-gutter)))}
.ob-split-text{--ob-col:calc(100cqi * 1.1 / 2.1 - max(var(--ob-gutter),(100cqi - 1280px) / 2 + var(--ob-gutter)) - clamp(24px,5cqi,72px))}
.ob-split .ob-spec{--ob-strip-w:var(--ob-col)}
.ob-split .ob-h1{--ob-size:clamp(42px,5.6cqi,84px);--ob-avail:var(--ob-col)}
.ob-split .ob-h1-long{--ob-size:clamp(38px,4.6cqi,68px)}
.ob-split .ob-h1-xl{--ob-size:clamp(34px,3.6cqi,52px)}
.ob-split .ob-n3,.ob-split .ob-n4{grid-template-columns:repeat(2,minmax(0,1fr));--ob-n:2}
.ob-split .ob-spec-block:nth-child(odd){border-left:0}
.ob-split .ob-spec-block:nth-child(n+3){border-top:1px solid var(--ob-border2)}
.ob-split .ob-spec-block:last-child:nth-child(odd){grid-column:1 / -1}
.ob-split .ob-spec-val:not(.ob-stat-val){font-family:var(--ob-body);font-size:17px;font-weight:600;line-height:1.4;letter-spacing:0}
.ob-split-photo{position:relative;min-height:440px;background:var(--ob-surface);border-left:1px solid var(--ob-border)}

.ob-glass{position:absolute;inset:0;overflow:hidden;display:grid;place-items:center;background:var(--ob-glass-bg)}
.ob-glass::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(-55deg,transparent 0 18px,var(--ob-stripe) 18px 20px)}
.ob-glass::after{content:'';position:absolute;top:0;left:18%;width:16%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);transform:skewX(-10deg)}
.ob-glass-mark{position:relative;z-index:1;width:26%;aspect-ratio:1;background:var(--ob-grad);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);opacity:.9}
.ob-glass-letter{position:absolute;z-index:2;font-family:var(--ob-head);font-size:clamp(40px,6cqi,84px);font-weight:800;line-height:1;color:var(--ob-on-grad)}

.ob-shades{display:grid;gap:4px}
.ob-shade-cell{display:flex;min-width:0}
.ob-shades-3 .ob-shade{aspect-ratio:5/4}
.ob-shades-few .ob-shade{aspect-ratio:16/10}
.ob-shades-1{max-width:640px}
.ob-shade{flex:1;position:relative;isolation:isolate;display:flex;flex-direction:column;justify-content:flex-end;aspect-ratio:3/4;overflow:hidden;color:var(--ob-on-hero)}
.ob-shade-glass{position:absolute;inset:0;z-index:-1;overflow:hidden;clip-path:polygon(24% 0,100% 0,100% 100%,0 100%,0 30%)}
.ob-shade-scene{position:absolute;inset:0;background:var(--ob-scene)}
.ob-shade-scene::before{content:'';position:absolute;left:0;right:0;bottom:0;height:46%;background:var(--ob-skyline);-webkit-mask-image:linear-gradient(transparent,black 30%);mask-image:linear-gradient(transparent,black 30%)}
.ob-shade-film{position:absolute;inset:0;background:var(--ob-film-ink);opacity:var(--ob-film,.5)}
.ob-shade-film::before{content:'';position:absolute;inset:0;background:var(--ob-film-sheen)}
.ob-shade-film::after{content:'';position:absolute;top:0;left:22%;width:14%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);transform:skewX(-9deg)}
.ob-shade-glass::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--ob-grad);opacity:0}
.ob-shade-info{position:relative;padding:clamp(18px,2cqi,26px) clamp(16px,1.8cqi,22px);background:linear-gradient(to top,rgba(0,0,0,.82) 0%,rgba(0,0,0,.55) 60%,transparent 100%)}
.ob-shade-vlt{display:flex;align-items:baseline;gap:6px;font-family:var(--ob-head);font-size:clamp(32px,3.2cqi,44px);font-weight:800;line-height:1;letter-spacing:-.04em;color:var(--ob-on-hero)}
.ob-shade-vlt small{font-family:var(--ob-mono);font-size:11px;font-weight:400;letter-spacing:.16em;color:var(--ob-on-hero-muted)}
.ob-shade-name{display:block;margin-top:10px;font-family:var(--ob-mono);font-size:10px;line-height:1.4;letter-spacing:.26em;text-transform:uppercase;color:var(--ob-on-hero)}
.ob-shade-legal{display:block;margin-top:6px;font-size:13px;line-height:1.45;color:var(--ob-on-hero-muted)}
.ob-note{display:block;margin-top:28px;font-family:var(--ob-mono);font-size:11px;line-height:1.6;letter-spacing:.14em;text-transform:uppercase;color:var(--ob-muted)}
.ob-note b{margin-right:8px;font-weight:400;color:var(--ob-accent2-text)}

.ob-films{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(14px,1.6cqi,20px)}
.ob-film-cell{display:flex;min-width:0}
.ob-film-cell.ob-wide{grid-column:1 / -1}
.ob-film{flex:1;position:relative;isolation:isolate;display:flex;flex-direction:column;min-width:0;padding:clamp(28px,3.4cqi,46px);background:var(--ob-card-bg);border:1px solid var(--ob-border2);overflow:hidden}
.ob-film::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--ob-grad);transform:scaleX(0);transform-origin:left center}
.ob-film-glow{position:absolute;z-index:-1;top:-90px;right:-90px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,var(--ob-glow-soft),transparent 70%);pointer-events:none}
.ob-wide .ob-film{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:clamp(32px,5cqi,64px);align-items:stretch}
.ob-film-main{display:flex;flex-direction:column;min-width:0}
.ob-badge{display:inline-flex;align-items:center;gap:10px;width:fit-content;padding:7px 14px;border:1px solid var(--ob-border);background:var(--ob-badge-bg);font-family:var(--ob-mono);font-size:10px;line-height:1.3;letter-spacing:.26em;text-transform:uppercase;color:var(--ob-card-accent)}
.ob-film-title{margin-top:24px;font-family:var(--ob-head);font-size:clamp(22px,2.2cqi,28px);font-weight:700;line-height:1.2;letter-spacing:-.02em;color:var(--ob-card-text)}
.ob-film .acg-svc-foot{margin-top:auto;padding-top:28px}
.ob-film .acg-svc-more{color:var(--ob-card-accent);letter-spacing:.04em}
.ob-film-foot{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px 24px;padding-top:22px;border-top:1px solid var(--ob-border2)}
.ob-from{display:block;font-family:var(--ob-mono);font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--ob-card-muted)}
.ob-price{display:block;margin-top:6px;font-family:var(--ob-head);font-size:clamp(26px,2.6cqi,34px);font-weight:700;line-height:1.05;letter-spacing:-.02em;color:var(--ob-hl)}
.ob-film .acg-svc-book{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-family:var(--ob-head);font-size:11.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;text-decoration:none;color:var(--ob-card-text)}
.ob-film .acg-svc-book svg{color:var(--ob-card-accent)}
.ob-wave{position:relative;min-height:240px;overflow:hidden;border:1px solid var(--ob-border2);background:var(--ob-wave-bg)}
.ob-wave::before{content:'';position:absolute;inset:0 -60px 0 -60px;background:repeating-linear-gradient(-55deg,transparent 0 18px,var(--ob-stripe) 18px 20px)}
.ob-wave::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 35%,var(--ob-card-bg) 100%)}
.ob-wave-num{position:absolute;z-index:1;right:24px;bottom:6px;font-family:var(--ob-head);font-size:clamp(96px,11cqi,150px);font-weight:800;line-height:1;letter-spacing:-.05em;color:transparent;-webkit-text-stroke:1px var(--ob-ghost-strong)}
.ob-wave-mark{position:absolute;z-index:1;top:28px;left:28px;width:34px;height:34px;background:var(--ob-grad);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
.ob-wave-cap{position:absolute;z-index:1;top:38px;left:78px;font-family:var(--ob-mono);font-size:10px;line-height:1.4;letter-spacing:.26em;text-transform:uppercase;color:var(--ob-card-muted)}

.ob-brands{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1px;background:var(--ob-border2);border:1px solid var(--ob-border2)}
.ob-brand-cell{display:flex;min-width:0;background:var(--ob-card-bg)}
.ob-brand-tile{flex:1;position:relative;isolation:isolate;display:flex;flex-direction:column;justify-content:space-between;gap:36px;min-height:180px;padding:clamp(24px,2.6cqi,32px);overflow:hidden}
.ob-brand-tile::before{content:'';position:absolute;z-index:-1;inset:0 -60px;background:repeating-linear-gradient(-55deg,transparent 0 22px,var(--ob-stripe) 22px 23px);opacity:.7}
.ob-brand-tile::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--ob-grad);transform:scaleX(0);transform-origin:left center}
.ob-brand-top{display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:var(--ob-mono);font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:var(--ob-card-muted)}
.ob-glyph{font-size:16px;letter-spacing:0;color:var(--ob-card-accent)}
.ob-brand-name{font-family:var(--ob-head);font-size:clamp(22px,2.3cqi,30px);font-weight:700;line-height:1.15;letter-spacing:-.02em;color:var(--ob-card-text);overflow-wrap:anywhere}

.ob-steps{display:grid;grid-template-columns:repeat(var(--ob-cols,4),minmax(0,1fr));border-top:1px solid var(--ob-border2);border-left:1px solid var(--ob-border2)}
.ob-step-cell{display:flex;min-width:0;background:var(--ob-bg);border-right:1px solid var(--ob-border2);border-bottom:1px solid var(--ob-border2)}
.ob-step{flex:1;position:relative;padding:clamp(32px,3.6cqi,52px) clamp(24px,2.8cqi,40px)}
.ob-step-num{display:flex;align-items:center;gap:14px;font-family:var(--ob-mono);font-size:11px;letter-spacing:.3em;color:var(--ob-accent-text)}
.ob-step-num::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--ob-accent-text),transparent)}
.ob-step-icon{display:grid;place-items:center;width:52px;height:52px;margin-top:34px;border:1px solid var(--ob-border);background:var(--ob-accent-soft);color:var(--ob-accent2-text);font-size:22px;line-height:1}
.ob-step h3{margin-top:24px;font-family:var(--ob-head);font-size:19px;font-weight:700;line-height:1.3;letter-spacing:-.01em;color:var(--ob-text)}
.ob-step p{margin-top:12px;font-size:15px;line-height:1.7;color:var(--ob-muted)}

.ob-about{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:center;gap:clamp(40px,7cqi,104px)}
.ob-about .ob-h2{--ob-size:clamp(34px,4cqi,52px);--ob-avail:calc((min(100cqi,1280px) - 2 * var(--ob-gutter) - clamp(40px,7cqi,104px)) * 6 / 11);margin-bottom:28px}
.ob-about .ob-h2-long{--ob-size:clamp(30px,3.2cqi,42px)}
.ob-frame{position:relative;padding:14px}
.ob-frame::before,.ob-frame::after{content:'';position:absolute;width:64px;height:64px;border:0 solid var(--ob-accent-text);pointer-events:none}
.ob-frame::before{top:0;left:0;border-top-width:1px;border-left-width:1px}
.ob-frame::after{right:0;bottom:0;border-right-width:1px;border-bottom-width:1px;border-color:var(--ob-accent2-text)}
.ob-media{position:relative;aspect-ratio:4/5;overflow:hidden;background:var(--ob-surface);border:1px solid var(--ob-border2)}
.ob-media-tint{position:absolute;inset:0;pointer-events:none;background:var(--ob-media-tint)}
.ob-prose p{font-size:17px;line-height:1.85;color:var(--ob-muted);white-space:pre-line;text-wrap:pretty}
.ob-prose p+p{margin-top:18px}
.ob-prose p:first-child{font-size:clamp(18px,1.7cqi,21px);line-height:1.7;color:var(--ob-text)}
.ob-dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 32px;margin-top:36px;padding-top:28px;border-top:1px solid var(--ob-border2)}
.ob-dl dd{margin-top:8px;font-size:16px;line-height:1.5;color:var(--ob-text)}
.ob-label{display:block;font-family:var(--ob-mono);font-size:10px;line-height:1.4;letter-spacing:.24em;text-transform:uppercase;color:var(--ob-accent-text)}
.ob-awards{margin-top:28px;padding:18px 22px;border:1px solid var(--ob-border2);border-left:2px solid var(--ob-accent2-text);background:var(--ob-card-bg)}
.ob-awards .ob-label{color:var(--ob-card-accent2)}
.ob-awards ul{display:grid;gap:8px;margin-top:10px}
.ob-awards li{display:flex;align-items:flex-start;gap:10px;font-size:15.5px;line-height:1.5;color:var(--ob-card-text)}
.ob-awards svg{flex:none;margin-top:3px;color:var(--ob-card-accent2)}
.ob-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.ob-chip-sm{padding:6px 14px;border:1px solid var(--ob-border);font-size:13px;line-height:1.4;color:var(--ob-text)}
.ob-spec-line{margin-top:10px;font-size:15.5px;line-height:1.6;color:var(--ob-text)}
.ob-statpanel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--ob-border2);border:1px solid var(--ob-border2)}
.ob-statpanel>div{display:flex;flex-direction:column-reverse;justify-content:flex-end;padding:clamp(26px,3cqi,40px);background:var(--ob-card-bg)}
.ob-statpanel>div:last-child:nth-child(odd){grid-column:1 / -1}
.ob-statpanel dt{margin-top:12px;color:var(--ob-card-accent)}
.ob-statpanel dd{--ob-size:clamp(36px,4.2cqi,56px);--ob-avail:calc((min(100cqi,1280px) - 2 * var(--ob-gutter) - clamp(40px,7cqi,104px)) * 5 / 22 - 2 * clamp(26px,3cqi,40px));font-family:var(--ob-head);font-size:min(var(--ob-size),calc(var(--ob-avail) / var(--ob-fit,1)));font-weight:800;line-height:1;letter-spacing:-.04em;color:var(--ob-card-text)}

.ob-gal{display:grid;gap:clamp(8px,1cqi,14px)}
.ob-g1{grid-template-columns:minmax(0,1fr)}
.ob-g1 .ob-shot{aspect-ratio:21/9}
.ob-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ob-g2 .ob-shot{aspect-ratio:4/3}
.ob-g3{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));height:clamp(420px,52cqi,660px)}
.ob-g3 .ob-shot:first-child{grid-row:1 / span 2}
.ob-g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.ob-g4 .ob-shot{aspect-ratio:3/4}
.ob-shot{position:relative;min-height:0;overflow:hidden;background:var(--ob-surface);border:1px solid var(--ob-border2)}
.ob-shot-cap{position:absolute;left:14px;bottom:12px;z-index:1;font-family:var(--ob-mono);font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--ob-on-hero);text-shadow:0 1px 8px rgba(0,0,0,.6)}
.ob-track{display:flex;gap:clamp(10px,1.2cqi,16px);overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc(-1 * var(--ob-gutter));padding:0 var(--ob-gutter) 4px;scroll-padding:0 var(--ob-gutter)}
.ob-track::-webkit-scrollbar{display:none}
.ob-track .ob-shot{flex:0 0 auto;width:clamp(240px,30cqi,380px);aspect-ratio:4/5;scroll-snap-align:start}
.ob-swipe{margin-top:20px;font-family:var(--ob-mono);font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--ob-muted)}

.ob-quotes{display:grid;gap:clamp(14px,1.6cqi,18px)}
.ob-c1{grid-template-columns:minmax(0,680px);justify-content:center}
.ob-c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ob-c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ob-quote-cell{display:flex;min-width:0}
.ob-quote{flex:1;position:relative;isolation:isolate;display:flex;flex-direction:column;padding:clamp(28px,3cqi,40px);background:var(--ob-card-bg);border:1px solid var(--ob-border2);overflow:hidden}
.ob-quote-mark{font-family:var(--ob-head);font-size:64px;font-weight:800;line-height:.6;height:30px;color:var(--ob-card-accent)}
.ob-quote blockquote{flex:1;margin-top:18px}
.ob-quote blockquote p{font-size:16px;font-weight:300;font-style:italic;line-height:1.8;color:var(--ob-card-text);text-wrap:pretty}
.ob-quote figcaption{display:flex;align-items:center;gap:14px;margin-top:28px}
.ob-av{flex:none;display:grid;place-items:center;width:44px;height:48px;background:var(--ob-btn);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);font-family:var(--ob-head);font-size:13px;font-weight:700;color:var(--ob-on-accent)}
.ob-q-name{display:block;font-family:var(--ob-head);font-size:14px;font-weight:700;letter-spacing:.02em;color:var(--ob-card-text)}
.ob-q-role{display:block;margin-top:4px;font-family:var(--ob-mono);font-size:10.5px;letter-spacing:.14em;color:var(--ob-card-accent)}
.ob-reviews-widget{margin-top:8px}

.ob-contact-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(40px,6cqi,96px);align-items:start}
.ob-contact .ob-body{margin-top:24px;max-width:500px}
.ob-contact .ob-h2{--ob-size:clamp(38px,4.8cqi,62px);--ob-avail:calc((min(100cqi,1280px) - 2 * var(--ob-gutter) - clamp(40px,6cqi,96px)) / 2)}
.ob-dets{display:grid;gap:2px}
.ob-det{position:relative;display:flex;gap:18px;padding:20px 24px;background:var(--ob-card-bg);border-left:2px solid transparent}
.ob-det-icon{flex:none;display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--ob-border);background:var(--ob-accent-soft);color:var(--ob-card-accent)}
.ob-det-body{min-width:0;flex:1}
.ob-det .ob-label{color:var(--ob-card-accent)}
.ob-det-val{display:block;margin-top:6px;font-size:16px;font-weight:500;line-height:1.55;color:var(--ob-card-text);overflow-wrap:anywhere}
.ob-det-val a{color:inherit;text-decoration:none;border-bottom:1px solid var(--ob-border-strong)}
.ob-det-sub{display:block;margin-top:4px;font-size:14.5px;line-height:1.5;color:var(--ob-card-muted)}
.ob-hours{display:grid;grid-template-columns:auto 1fr;gap:4px 20px;margin-top:8px;font-size:15px;line-height:1.55}
.ob-hours dt{color:var(--ob-card-text);font-weight:500}
.ob-hours dd{color:var(--ob-card-muted)}
.ob-det .ob-chips{margin-top:10px}
.ob-det .ob-chip-sm{color:var(--ob-card-text)}
/* The inquiry form public/contact-form.js appends to #contact on the live
   site. Its inline styles are light-theme defaults (white fields, dark
   text), so they are overridden here to sit in the studio's own card. */
.ob-contact>[data-acg-inquiry]{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:24px clamp(32px,6cqi,96px);align-items:start;box-sizing:border-box;width:calc(100% - 2 * var(--ob-gutter));max-width:calc(1280px - 2 * var(--ob-gutter))!important;margin:clamp(48px,6cqi,72px) auto 0!important;padding:clamp(24px,3.4cqi,48px)!important;background:var(--ob-card-bg);border:1px solid var(--ob-border2);color:var(--ob-card-text)}
.ob-contact>[data-acg-inquiry]::before{content:'';position:absolute;top:-1px;left:-1px;right:-1px;height:2px;background:var(--ob-grad)}
.ob-contact [data-acg-inquiry]>h3{margin:0!important;font-family:var(--ob-head);font-size:clamp(24px,2.4cqi,30px)!important;font-weight:700!important;line-height:1.2;letter-spacing:-.02em;color:var(--ob-card-text)!important}
.ob-contact [data-acg-inquiry]>h3::before{content:'// Inquiry';display:block;margin-bottom:14px;font-family:var(--ob-mono);font-size:10px;font-weight:400;line-height:1.4;letter-spacing:.26em;text-transform:uppercase;color:var(--ob-card-accent)}
.ob-contact [data-acg-inquiry] form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ob-contact [data-acg-inquiry] :is(input:not([name=website]),textarea){margin:0!important;padding:14px 16px!important;border:1px solid var(--ob-border)!important;border-radius:0!important;background:var(--ob-bg)!important;color:var(--ob-text)!important;font-size:16px!important}
.ob-contact [data-acg-inquiry] :is(input,textarea)::placeholder{color:var(--ob-muted);opacity:1}
.ob-contact [data-acg-inquiry] :is(input,textarea):focus{outline:2px solid var(--ob-focus);outline-offset:1px}
.ob-contact [data-acg-inquiry] :is(input[name=phone],textarea,button,[data-acg-status]){grid-column:1 / -1}
.ob-contact [data-acg-inquiry] button{min-height:56px;margin-top:4px;border-radius:0!important;background-color:var(--ob-accent)!important;background-image:var(--ob-btn)!important;color:var(--ob-on-accent)!important;font-size:12.5px!important;font-weight:700!important;letter-spacing:.2em;text-transform:uppercase}
.ob-contact [data-acg-inquiry] [data-acg-status]{margin:0!important;color:var(--ob-card-text)!important}
.ob-contact [data-acg-inquiry]>div{grid-column:1 / -1;border-radius:0!important;border-color:var(--ob-border)!important;background:var(--ob-bg)!important}
.ob-contact [data-acg-inquiry]>div h3{color:var(--ob-text)!important}
.ob-contact [data-acg-inquiry]>div p{color:var(--ob-muted)!important}

.ob-foot{position:relative;padding:clamp(64px,8cqi,100px) 0 36px;background:var(--ob-footer-bg);color:var(--ob-footer-muted);border-top:1px solid var(--ob-border);font-size:15px;line-height:1.7}
.ob-foot::before{content:'';position:absolute;top:-1px;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--ob-accent),transparent)}
.ob-foot-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:40px clamp(32px,5cqi,64px)}
.ob-foot .ob-brand{color:var(--ob-footer-text)}
.ob-foot .ob-sub{color:var(--ob-footer-accent)}
.ob-foot-tag{margin-top:20px;max-width:320px}
.ob-foot-h{font-family:var(--ob-mono);font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--ob-footer-accent)}
.ob-foot-list{display:grid;gap:10px;margin-top:20px}
.ob-foot a{color:var(--ob-footer-muted);text-decoration:none}
.ob-social{margin-top:24px}
.ob-social a{width:44px;height:44px;align-items:center;justify-content:center;border:1px solid var(--ob-footer-line)}
.ob-foot-bottom{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;margin-top:clamp(48px,6cqi,64px);padding-top:26px;border-top:1px solid var(--ob-footer-line);font-family:var(--ob-mono);font-size:11px;letter-spacing:.06em}
.ob-foot-slogan{letter-spacing:.2em;text-transform:uppercase;color:var(--ob-footer-accent)}

@media (hover:hover){
.ob-link:hover{color:var(--ob-text)}
.ob-link:hover::after{transform:scaleX(1)}
.ob-nav-cta:hover{color:var(--ob-on-accent);border-color:transparent;box-shadow:0 0 30px -4px var(--ob-glow)}
.ob-nav-cta:hover::before{opacity:1}
.ob-btn-primary:hover{transform:translateY(-2px);box-shadow:0 18px 60px -14px var(--ob-glow)}
.ob-btn-primary:hover::before{left:calc(100% + 40px)}
.ob-btn-line:hover{color:var(--ob-hl)}
.ob-btn-line:hover span{border-bottom-color:var(--ob-hl)}
.ob-has-media .ob-btn-line:hover{color:var(--ob-on-hero)}
.ob-has-media .ob-btn-line:hover span{border-bottom-color:var(--ob-on-hero)}
.ob-btn-ghost:hover{border-color:var(--ob-accent-text);background:var(--ob-accent-soft)}
.ob-spec-block:hover::before{opacity:1}
.ob-shade:hover{transform:translateY(-6px)}
.ob-shade:hover .ob-shade-glass::after{opacity:1}
.ob-film:hover{border-color:var(--ob-border);box-shadow:0 0 60px -10px var(--ob-glow-soft),inset 0 0 60px var(--ob-inset-glow)}
.ob-film:hover::before{transform:scaleX(1)}
.ob-film .acg-svc-book:hover svg{transform:translateX(4px)}
.ob-brand-tile:hover::before{transform:translateX(30px)}
.ob-brand-tile:hover::after{transform:scaleX(1)}
.ob-step-cell:hover{background:var(--ob-surface)}
.ob-shot:hover img{transform:scale(1.04)}
.ob-quote:hover{border-color:var(--ob-border);transform:translateY(-4px);box-shadow:0 24px 60px -30px var(--ob-shadow)}
.ob-det:hover{border-left-color:var(--ob-accent);background:var(--ob-card-hover)}
.ob-det-val a:hover{color:var(--ob-card-accent);border-bottom-color:var(--ob-card-accent)}
.ob-foot a:hover{color:var(--ob-footer-text)}
.ob-social a:hover{border-color:var(--ob-footer-accent)}
}
@media (prefers-reduced-motion:no-preference){
.ob-nav{transition:background-color .3s ease,box-shadow .3s ease}
.ob-link,.ob-foot a,.ob-det-val a,.ob-btn-line,.ob-btn-line span{transition:color .25s ease,border-color .25s ease}
.ob-link::after{transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.ob-nav-cta,.ob-nav-cta::before{transition:opacity .25s ease,color .25s ease,border-color .25s ease,box-shadow .25s ease}
.ob-btn{transition:transform .2s ease,box-shadow .3s ease,border-color .25s ease,background-color .25s ease}
.ob-btn-primary::before{transition:left .6s cubic-bezier(.2,.7,.2,1)}
.ob-spec-block::before{transition:opacity .3s ease}
.ob-shade{transition:transform .45s cubic-bezier(.2,.7,.2,1)}
.ob-shade-glass::after{transition:opacity .3s ease}
.ob-film,.ob-quote{transition:border-color .3s ease,box-shadow .4s ease,transform .35s cubic-bezier(.2,.7,.2,1)}
.ob-film::before,.ob-brand-tile::after{transition:transform .45s cubic-bezier(.2,.7,.2,1)}
.ob-film .acg-svc-book svg{transition:transform .25s ease}
.ob-brand-tile::before{transition:transform 1.2s cubic-bezier(.2,.7,.2,1)}
.ob-step-cell,.ob-det{transition:background-color .3s ease,border-color .25s ease}
.ob-shot img{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.ob-social a{transition:border-color .25s ease}
.ob-mark-wrap{animation:ob-pulse 3.2s ease-in-out infinite}
.ob-led{animation:ob-blink 2s ease-in-out infinite}
.ob-hex i{animation:ob-hex 4.5s ease-in-out infinite}
.ob-hex i:nth-child(3n){animation-delay:-1.4s;animation-duration:5.5s}
.ob-hex i:nth-child(3n+1){animation-delay:-2.9s;animation-duration:3.8s}
.ob-hex i:nth-child(4n){animation-delay:-.7s}
.ob-electric{animation:ob-grad 6s linear infinite}
.ob-hero-body{animation:ob-in 1.1s cubic-bezier(.16,1,.3,1) both}
.ob-wave::before{animation:ob-wave 7s linear infinite}
@keyframes ob-pulse{0%,100%{filter:drop-shadow(0 0 10px var(--ob-glow))}50%{filter:drop-shadow(0 0 22px var(--ob-glow))}}
@keyframes ob-blink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes ob-hex{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes ob-grad{from{background-position:0% 0}to{background-position:200% 0}}
@keyframes ob-in{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:none}}
@keyframes ob-wave{from{transform:translateX(0)}to{transform:translateX(40px)}}
}

@container (max-width:1400px){
.ob-link-x{display:none}
}
@container (max-width:1100px){
.ob-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
.ob-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.ob-foot-brand{grid-column:1 / -1}
}
@container (max-width:900px){
.ob-nav-cta{display:none}
.ob-c3{grid-template-columns:repeat(2,minmax(0,1fr))}
.ob-n4{grid-template-columns:repeat(2,minmax(0,1fr));--ob-n:2}
.ob-n4 .ob-spec-block:nth-child(3){border-left:0}
.ob-n4 .ob-spec-block:nth-child(n+3){border-top:1px solid var(--ob-border2)}
.ob-hex{display:none}
.ob-wide .ob-film{grid-template-columns:minmax(0,1fr)}
.ob-wave{min-height:180px}
}
@container (max-width:760px){
.ob-head,.ob-about,.ob-contact-grid,.ob-contact>[data-acg-inquiry]{grid-template-columns:minmax(0,1fr)}
.ob-g4{grid-template-columns:repeat(2,minmax(0,1fr))}
.ob-films{grid-template-columns:minmax(0,1fr)}
.ob-media{aspect-ratio:4/3}
.ob-h2,.ob-head .ob-h2,.ob-head-solo .ob-h2,.ob-about .ob-h2,.ob-contact .ob-h2{--ob-avail:calc(100cqi - 2 * var(--ob-gutter))}
.ob-statpanel dd{--ob-avail:calc((100cqi - 2 * var(--ob-gutter)) / 2 - 2 * clamp(26px,3cqi,40px))}
}
@container (max-width:600px){
.ob-links,.ob-nav-cta{display:none}
.ob-nav-in{min-height:64px;gap:12px}
.ob-name{font-size:14px;letter-spacing:.08em}
.ob-sub{font-size:8.5px;letter-spacing:.24em}
.ob-mark{width:26px;height:26px}
.ob-hero{min-height:0;padding:60px 0 44px}
.ob-hero.ob-has-media{min-height:clamp(560px,86vh,780px);justify-content:flex-end}
.ob-hero-scrim{background:var(--ob-scrim)}
.ob-h1,.ob-split .ob-h1{--ob-size:clamp(40px,12cqi,58px);--ob-avail:calc(100cqi - 2 * var(--ob-gutter));margin-top:26px;line-height:.98;letter-spacing:-.035em}
.ob-h1-long,.ob-split .ob-h1-long{--ob-size:clamp(30px,8.4cqi,40px);line-height:1.04;letter-spacing:-.03em}
.ob-h1-xl,.ob-split .ob-h1-xl{--ob-size:clamp(26px,7.2cqi,34px);line-height:1.08;letter-spacing:-.025em}
.ob-lead{margin-top:22px;font-size:17px}
.ob-actions{flex-direction:column;align-items:stretch;gap:10px;margin-top:34px}
.ob-btn-line{justify-content:center}
.ob-ghost{font-size:34cqi;bottom:auto;top:20px;right:-8cqi}
.ob-spec,.ob-n3,.ob-n4{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:44px}
.ob-n1{grid-template-columns:minmax(0,1fr)}
.ob-spec-block{padding:16px 18px}
.ob-spec-val{font-family:var(--ob-body);font-size:16px;font-weight:600;line-height:1.4;letter-spacing:0}
.ob-stat-val{--ob-size:28px;--ob-n:2;font-family:var(--ob-head);font-weight:800;line-height:1.05;letter-spacing:-.03em}
.ob-n1 .ob-stat-val{--ob-n:1}
.ob-spec-block:nth-child(odd){border-left:0}
.ob-spec-block:nth-child(n+3){border-top:1px solid var(--ob-border2)}
.ob-spec-block:last-child:nth-child(odd){grid-column:1 / -1}
.ob-has-media .ob-spec-block:nth-child(n+3){border-top-color:var(--ob-on-hero-line)}
.ob-split{grid-template-columns:minmax(0,1fr);min-height:0}
.ob-split-text{--ob-col:calc(100cqi - 2 * var(--ob-gutter))}
.ob-split-text{padding:56px var(--ob-gutter) 48px}
.ob-split-photo{min-height:0;aspect-ratio:4/3;border-left:0;border-top:1px solid var(--ob-border)}
.ob-section{padding:76px 0}
.ob-h2{--ob-size:clamp(32px,9.4cqi,42px)}
.ob-about .ob-h2{--ob-size:clamp(30px,8.6cqi,38px)}
.ob-about .ob-h2-long{--ob-size:clamp(26px,7.4cqi,32px)}
.ob-contact .ob-h2{--ob-size:clamp(34px,10cqi,46px)}
.ob-body{font-size:16px}
.ob-shades{display:flex;gap:6px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;margin:0 calc(-1 * var(--ob-gutter));padding:0 var(--ob-gutter) 4px;scroll-padding:0 var(--ob-gutter)}
.ob-shades::-webkit-scrollbar{display:none}
.ob-shade-cell{flex:0 0 auto;width:44%;scroll-snap-align:start}
.ob-shades-few .ob-shade-cell{width:calc(50% - 3px)}
.ob-shades-1 .ob-shade-cell{width:72%}
.ob-shades-3 .ob-shade,.ob-shades-few .ob-shade{aspect-ratio:3/4}
.ob-film{padding:24px 22px}
.ob-film-title{margin-top:18px}
.ob-film .acg-svc-foot{padding-top:20px}
.ob-film-foot{padding-top:16px}
.ob-wave{display:none}
.ob-brands{grid-template-columns:repeat(2,minmax(0,1fr))}
.ob-brand-tile{min-height:132px;gap:22px;padding:20px 18px}
.ob-brand-name{font-size:20px}
.ob-steps{grid-template-columns:minmax(0,1fr)}
.ob-step{display:grid;grid-template-columns:46px minmax(0,1fr);column-gap:18px;align-items:start;padding:24px 20px 26px}
.ob-step>*{grid-column:2}
.ob-step>.ob-step-num{grid-column:1 / -1}
.ob-step>.ob-step-icon{grid-column:1;grid-row:2 / span 2;width:46px;height:46px;margin-top:18px}
.ob-step h3{margin-top:18px}
.ob-step p{margin-top:6px}
.ob-step-noicon{grid-template-columns:minmax(0,1fr)}
.ob-step-noicon>*{grid-column:1}
.ob-c1,.ob-c2,.ob-c3{grid-template-columns:minmax(0,1fr)}
.ob-dl{gap:18px 20px}
.ob-statpanel dd{--ob-size:34px}
.ob-g2,.ob-g3{grid-template-columns:minmax(0,1fr);grid-template-rows:none;height:auto}
.ob-g3 .ob-shot:first-child{grid-row:auto}
.ob-g1 .ob-shot,.ob-g2 .ob-shot,.ob-g3 .ob-shot{aspect-ratio:4/3}
.ob-g4{grid-template-columns:repeat(2,minmax(0,1fr))}
.ob-g4 .ob-shot{aspect-ratio:1}
.ob-contact>[data-acg-inquiry]{padding:24px 20px!important}
.ob-contact [data-acg-inquiry] form{grid-template-columns:minmax(0,1fr)}
.ob-track .ob-shot{width:78%}
.ob-det{padding:18px 16px;gap:14px}
.ob-foot{padding-top:56px}
.ob-foot-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:36px 20px}
.ob-foot-connect{grid-column:1 / -1}
.ob-foot-bottom{flex-direction:column;align-items:flex-start}
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
// No-break spaces round the dash (plus a word joiner, since browsers may
// break after an en dash) keep "8am – 6pm" on one line when a narrow spec
// cell wraps: the days move to their own line instead.
const cleanTime = (v) => txt(v).replace(/\s*[-–]\s*$/, '').replace(/\s*[-–]\s*/, '\u00a0–\u2060\u00a0');
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

// The spec-strip "Hours" fact must be the whole truth in a few words: all
// open rows when there are at most two, or a short free-text line.
function hoursFact(rows) {
  if (rows.length === 1 && !rows[0].time) return rows[0].days.length <= 40 ? rows[0].days : null;
  const open = rows.filter((r) => r.time && !/^closed$/i.test(r.time));
  return open.length > 0 && open.length <= 2 ? open.map((r) => `${r.days} ${r.time}`).join('\n') : null;
}

// Color-wheel helpers for the second glow.
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
// The second glow: the accent turned 72deg back round the wheel (violet
// #7c3aed lands on the studio cyan). A turn that lands in the greens (a blue
// accent would get a lime partner) is pulled to teal-cyan, which suits any
// cool accent and still reads as "glass".
function partner(color) {
  const { h, s, l } = toHsl(color);
  let h2 = (((h - 72) % 360) + 360) % 360;
  // Yellows and greens: teal-cyan, unless the accent is itself teal-cyan
  // (the glow would vanish into it), which gets a violet partner instead.
  if (h2 > 50 && h2 < 172) h2 = Math.abs(h - 176) < 30 ? h + 76 : 176;
  return fromHsl(h2, s, l);
}

// Width of a word in em at the display weight, for --ob-fit. Syne 800 is
// unusually wide (about 1em a letter, "m" 1.65em), so it gets a per-glyph
// estimate (measured in Chrome); the other heading fonts owners can pick
// get a per-family average that errs on the wide side.
const SYNE_GLYPHS = [
  [/[iljI.,'’!|:;]/, 0.42],
  [/[frt1()-]/, 0.64],
  [/[sz]/, 0.9],
  [/[mw]/, 1.66],
  [/[MW]/, 1.9],
  [/[A-Z&]/, 1.34],
  [/[0-9]/, 1.16],
];
function wordEm(word, font) {
  const f = String(font || '').toLowerCase();
  if (!f || /syne/.test(f)) {
    return [...word].reduce((sum, ch) => sum + ((SYNE_GLYPHS.find(([re]) => re.test(ch)) || [null, 1.1])[1]), 0);
  }
  const perChar = /bebas|oswald|boogaloo|anton|teko|condensed|big shoulders/.test(f) ? 0.54
    : /playfair|dm serif|cormorant|fraunces|instrument serif/.test(f) ? 0.64
      : /unbounded/.test(f) ? 1.0 : 0.74;
  return word.length * perChar;
}

// Every --ob-* token the page paints with, derived from the owner's five
// roles. Text-bearing colors are contrast-checked against the surfaces they
// sit on (4.5:1); decorative glows are translucent tints of accent/accent2.
function studioTokens(t) {
  const dark = t.isDark;
  const toward = dark ? '#ffffff' : '#000000';
  const both = (fg) => {
    const onBg = ensureContrast(fg, t.bg, 4.5);
    if (contrastRatio(onBg, t.surface) >= 4.5) return onBg;
    const fixed = ensureContrast(onBg, t.surface, 4.5);
    return contrastRatio(fixed, t.bg) >= 4.5 ? fixed : onBg;
  };
  const accent2 = partner(t.accent);
  const hl = both(mix(t.accent, toward, 0.3));
  const accent2Text = both(dark ? mix(accent2, '#ffffff', 0.12) : mix(accent2, '#000000', 0.3));
  const midText = both(mix(hl, accent2Text, 0.5));
  const btnStart = ensureContrast(t.accent, t.onAccent, 4.5);
  const btnEnd = ensureContrast(mix(t.accent, accent2, 0.32), t.onAccent, 4.5);
  const deep = mix(t.bg, t.surface, 0.5);
  const cardBg = dark ? mix(mix(t.surface, t.accent, 0.05), '#ffffff', 0.02) : mix(t.bg, '#ffffff', 0.75);
  const cardText = ensureContrast(t.text, cardBg, 4.5);
  const footerBg = dark ? mix(t.bg, '#000000', 0.45) : mix(t.text, '#000000', 0.55);
  const footerText = ensureContrast(dark ? t.text : t.bg, footerBg, 4.5);
  const footerAccent = ensureContrast(mix(t.accent, '#ffffff', 0.35), footerBg, 4.5);
  const filmInk = mix('#000000', t.bg, dark ? 0.35 : 0.06);
  const scrimBase = dark ? mix(t.bg, '#000000', 0.35) : mix(t.text, '#000000', 0.6);
  return {
    '--ob-deep': deep,
    '--ob-hl': hl,
    '--ob-accent2-text': accent2Text,
    '--ob-grad': `linear-gradient(135deg, ${t.accent}, ${accent2})`,
    '--ob-grad-text': `linear-gradient(90deg, ${hl} 0%, ${midText} 25%, ${accent2Text} 50%, ${midText} 75%, ${hl} 100%)`,
    '--ob-grad-hero': `linear-gradient(90deg, #ffffff 0%, ${mix('#ffffff', accent2, 0.3)} 25%, ${mix('#ffffff', t.accent, 0.3)} 50%, ${mix('#ffffff', accent2, 0.3)} 75%, #ffffff 100%)`,
    '--ob-btn': `linear-gradient(135deg, ${btnStart}, ${btnEnd})`,
    '--ob-on-grad': ensureContrast('#ffffff', mix(t.accent, accent2, 0.5), 3),
    '--ob-border': alpha(hl, dark ? 0.22 : 0.26),
    '--ob-border2': alpha(hl, dark ? 0.11 : 0.14),
    '--ob-border-strong': alpha(t.text, dark ? 0.34 : 0.3),
    '--ob-glow': alpha(t.accent, dark ? 0.5 : 0.35),
    '--ob-glow-soft': alpha(t.accent, dark ? 0.13 : 0.08),
    '--ob-glow2-soft': alpha(accent2, dark ? 0.08 : 0.08),
    '--ob-inset-glow': alpha(t.accent, 0.035),
    '--ob-gridline': alpha(t.accent, dark ? 0.07 : 0.08),
    '--ob-ghost': alpha(hl, dark ? 0.11 : 0.16),
    '--ob-ghost-strong': alpha(hl, 0.32),
    '--ob-stripe': alpha(t.accent, dark ? 0.07 : 0.06),
    '--ob-glass': alpha(t.bg, 0.86),
    '--ob-shadow': alpha('#000000', dark ? 0.65 : 0.2),
    '--ob-spec-bg': alpha(t.surface, 0.72),
    '--ob-badge-bg': `linear-gradient(135deg, ${alpha(t.accent, 0.16)}, ${alpha(accent2, 0.1)})`,
    '--ob-hero-tint': `radial-gradient(ellipse 80% 80% at 100% 45%, ${alpha(t.accent, dark ? 0.16 : 0.1)} 0%, transparent 60%), radial-gradient(ellipse 60% 60% at 0% 100%, ${alpha(accent2, dark ? 0.09 : 0.08)} 0%, transparent 55%), linear-gradient(160deg, ${t.bg} 0%, ${deep} 50%, ${t.bg} 100%)`,
    '--ob-leak1': `linear-gradient(120deg, transparent 0%, ${alpha(t.accent, 0.05)} 40%, ${alpha(t.accent, dark ? 0.11 : 0.07)} 50%, ${alpha(t.accent, 0.05)} 60%, transparent 100%)`,
    '--ob-leak2': `linear-gradient(80deg, transparent 0%, ${alpha(accent2, 0.04)} 60%, ${alpha(accent2, dark ? 0.08 : 0.06)} 70%, transparent 100%)`,
    '--ob-hero-fade': dark ? `linear-gradient(180deg, transparent, ${t.bg})` : 'none',
    '--ob-scrim': `linear-gradient(180deg, ${alpha(scrimBase, 0.45)} 0%, ${alpha(scrimBase, 0.66)} 45%, ${alpha(scrimBase, 0.9)} 100%)`,
    '--ob-scrim-left': `linear-gradient(90deg, ${alpha(scrimBase, 0.92)} 0%, ${alpha(scrimBase, 0.72)} 48%, ${alpha(scrimBase, 0.34)} 100%), linear-gradient(0deg, ${alpha(scrimBase, 0.55)}, transparent 45%)`,
    '--ob-on-hero-muted': alpha('#ffffff', 0.86),
    '--ob-on-hero-line': alpha('#ffffff', 0.32),
    // Shade guide: a sky seen through the glass, darkened by each film.
    '--ob-film-ink': filmInk,
    '--ob-scene': `radial-gradient(circle at 72% 30%, ${alpha('#ffffff', 0.9)} 0 5%, ${alpha('#ffffff', 0.25)} 9%, transparent 26%), linear-gradient(180deg, ${mix(accent2, '#ffffff', 0.45)} 0%, ${mix(t.accent, '#ffffff', 0.55)} 58%, ${mix(t.accent, '#000000', 0.25)} 58%, ${mix(t.accent, '#000000', 0.6)} 100%)`,
    '--ob-skyline': `linear-gradient(90deg, ${mix(t.accent, '#000000', 0.55)} 0 12%, transparent 12% 15%, ${mix(t.accent, '#000000', 0.45)} 15% 31%, transparent 31% 36%, ${mix(t.accent, '#000000', 0.6)} 36% 44%, transparent 44% 52%, ${mix(t.accent, '#000000', 0.5)} 52% 71%, transparent 71% 76%, ${mix(t.accent, '#000000', 0.58)} 76% 100%)`,
    '--ob-film-sheen': `linear-gradient(135deg, ${alpha(t.accent, 0.12)} 0%, transparent 50%, ${alpha(accent2, 0.08)} 100%)`,
    '--ob-wave-bg': `linear-gradient(135deg, ${alpha(t.accent, 0.12)} 0%, ${alpha(accent2, 0.09)} 50%, ${alpha(t.accent, 0.06)} 100%)`,
    '--ob-glass-bg': `radial-gradient(80% 70% at 30% 20%, ${alpha(t.accent, 0.22)}, transparent 70%), radial-gradient(70% 60% at 90% 100%, ${alpha(accent2, 0.16)}, transparent 70%), ${cardBg}`,
    '--ob-media-tint': `linear-gradient(180deg, ${alpha(t.accent, 0.08)} 0%, transparent 40%, ${alpha(accent2, 0.1)} 100%)`,
    '--ob-card-bg': cardBg,
    '--ob-card-text': cardText,
    '--ob-card-muted': ensureContrast(t.textMuted, cardBg, 4.5),
    '--ob-card-accent': ensureContrast(hl, cardBg, 4.5),
    '--ob-card-accent2': ensureContrast(accent2Text, cardBg, 4.5),
    '--ob-card-hover': mix(cardBg, t.text, dark ? 0.03 : 0.02),
    '--ob-footer-bg': footerBg,
    '--ob-footer-text': footerText,
    '--ob-footer-muted': ensureContrast(mix(footerText, footerBg, 0.35), footerBg, 4.5),
    '--ob-footer-accent': footerAccent,
    '--ob-footer-line': alpha(footerText, 0.14),
  };
}

// Shades shown until the owner saves their own in Edit > Shades (the same
// VLT names the editor starts from). Legal notes are only shown when the
// owner wrote them: tint law differs by state.
const DEFAULT_SHADES = [
  { vlt: '5', name: 'Limo Black' },
  { vlt: '15', name: 'Midnight' },
  { vlt: '25', name: 'Dark Smoke' },
  { vlt: '35', name: 'Medium' },
  { vlt: '50', name: 'Light Smoke' },
];

// Neutral steps (no equipment, speed or guarantee claims), shown unless the
// copy has its own steps in copy.howSteps ({ emoji, title, desc }, the
// Edit > How It Works shape; that tab is not offered for this template
// yet, but steps saved under another template carry over).
const PROCESS = [
  { icon: 'chat', title: 'Consultation', body: 'We talk through what you want, look over your vehicle and recommend the right option for your needs and budget.' },
  { icon: 'drop', title: 'Surface Prep', body: 'Every surface we work on is cleaned and prepped first, so the finish starts from a clean base.' },
  { icon: 'layers', title: 'Precision Work', body: 'The work itself, done carefully and patiently, one section at a time.' },
  { icon: 'search', title: 'Final Inspection', body: 'We go over the finished job with you before we hand back the keys.' },
];

const Icon = ({ d, size = 20 }) => (
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
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12zM8.5 11h.01M12 11h.01M15.5 11h.01',
  drop: 'M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11zM9.5 14.5a2.5 2.5 0 0 0 2.5 2.5',
  layers: 'M12 3 2.5 8 12 13l9.5-5L12 3zM2.5 12.5 12 17.5l9.5-5M2.5 16.5 12 21.5l9.5-5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5 16 16M8.5 11l1.8 1.8 3.4-3.6',
};

const GLYPHS = ['⬡', '◈', '◇'];

// Owner-facing hint for an empty slot; never reaches the published page.
function EditorHint({ children }) {
  return (
    <EditorOnly>
      <p className="ob-hint" data-acg-editor-only="">{children}</p>
    </EditorOnly>
  );
}

// What a published page shows where a photo is missing: a pane of tinted
// glass with the studio diamond (never an "upload a photo" box).
function Glass({ name }) {
  const letter = (txt(name).match(/[A-Za-z0-9]/) || [''])[0].toUpperCase();
  return (
    <div className="ob-glass" aria-hidden="true">
      <span className="ob-glass-mark" />
      {letter && <span className="ob-glass-letter">{letter}</span>}
    </div>
  );
}

// Headline with its last word(s) in the electric gradient (the mockup's
// two-tone H1), for whatever headline the owner wrote.
function Electric({ text }) {
  const words = txt(text).split(/\s+/).filter(Boolean);
  if (words.length < 2) return <span className="ob-electric">{txt(text)}</span>;
  const k = words.length >= 6 ? 2 : 1;
  return <>{words.slice(0, -k).join(' ')} <span className="ob-electric">{words.slice(-k).join(' ')}</span></>;
}

// Where a button goes when the owner entered no URL: its wording decides
// (their text or the AI draft's), else the template's own default.
function intentHref(label, map, fallback) {
  const s = txt(label).toLowerCase();
  if (!s) return fallback;
  if (/\b(call|phone|ring)\b/.test(s) && map.tel) return map.tel;
  if (/\b(book|booking|schedule|appointment|quote|estimate|contact|touch|reserve|visit)\b/.test(s)) return map.contact || fallback;
  if (/\b(services?|packages?|pricing|prices?|menu|films?|tints?)\b/.test(s)) return map.services || fallback;
  if (/\bshades?\b/.test(s)) return map.shades || map.services || fallback;
  if (/\b(how|process|steps?)\b/.test(s)) return map.process || fallback;
  if (/\b(work|gallery|photos?|portfolio)\b/.test(s)) return map.gallery || fallback;
  if (/\b(reviews?|testimonials?)\b/.test(s)) return map.reviews || fallback;
  return fallback;
}

const vltNumber = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
};

const fill = { position: 'absolute', inset: 0, height: '100%' };

export default function TintObsidian({ businessInfo, generatedCopy, templateMeta, images = {} }) {
  const biz = businessInfo || {};
  const copy = generatedCopy || {};
  const editor = useEditorMode();
  const t = deriveTheme(templateMeta?.colors);
  const font = templateMeta?.font;
  const body = templateMeta?.bodyFont;
  const fb = getFallbacks(biz.businessType);

  // Big display text is owner text: cap its size so the longest word still
  // fits its column (Syne is very wide, and "Compromise." used to run off
  // the edge). --ob-fit is that word's width in ems; the CSS divides the
  // column width by it.
  const fit = (...texts) => {
    const widest = Math.max(3.5, ...texts.flatMap((v) => txt(v).split(/\s+/)).map((w) => wordEm(w, font)));
    return { '--ob-fit': widest.toFixed(2) };
  };

  const hiddenIds = list(copy.hiddenSections);
  const show = (id) => !hiddenIds.includes(id);
  const order = buildSectionOrder(copy, sections.map((s) => s.id));

  const name = txt(biz.businessName) || fb.shopName;
  const phone = txt(biz.phone);
  const tel = telHref(phone);
  const city = txt(biz.city);
  const place = [city, txt(biz.state)].filter(Boolean).join(', ');
  const hours = hoursRows(biz.hours);
  const hoursSummary = hoursFact(hours);
  const payments = list(biz.paymentMethods).map(txt).filter(Boolean);
  const awards = list(biz.awards).map(txt).filter(Boolean);
  const warranty = txt(biz.warranty);
  const email = txt(biz.email);
  const address = txt(biz.address);
  const years = txt(biz.yearsInBusiness);
  // Business Info > "Service Area / Radius": a bare number is the radius.
  const areaRaw = txt(biz.serviceArea);
  const area = /^\d+(\.\d+)?$/.test(areaRaw) ? `${areaRaw}-mile radius` : areaRaw;

  // Services: the owner's Services tab (businessInfo.services, mirrored to
  // packages by normalizeBusinessInfo) wins over the AI list; a service the
  // owner left without a description borrows the AI one of the same name.
  const aiItems = list(copy.servicesSection?.items)
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }));
  const aiDesc = new Map(aiItems.filter((s) => s.name && s.description).map((s) => [s.name.toLowerCase(), s.description]));
  const fromPackages = list(biz.packages).length > 0;
  const services = (fromPackages ? biz.packages : aiItems.length > 0 ? aiItems : list(biz.services))
    .map((s) => (typeof s === 'string' ? { name: s } : s || {}))
    .map((s) => ({ name: txt(s.name), price: txt(s.price), description: txt(s.description) }))
    .map((s) => ({ ...s, description: s.description || aiDesc.get(s.name.toLowerCase()) || '' }))
    .filter((s) => s.name || s.description || s.price);
  const wideFirst = services.length === 1 || services.length >= 3;
  const spanLast = wideFirst && services.length > 1 && (services.length - 1) % 2 === 1;

  // Shade guide: the owner's shades (Edit > Shades), else the starting set
  // the editor's Shades tab shows as on by default. The owner turns it off
  // there (Show Shade Guide) or in Sections; the editor hint below says so
  // plainly when the business is not a tint shop.
  const tintShop = /tint/i.test(txt(biz.businessType));
  const ownShades = list(copy.shadeGuide).filter((s) => s && (txt(s.vlt) || txt(s.name)));
  const shades = (ownShades.length > 0 ? ownShades : DEFAULT_SHADES).map((s, i) => ({
    vlt: vltNumber(s.vlt),
    name: txt(s.name),
    legal: ownShades.length > 0 ? txt(s.legal) : '',
    photo: images[`shade${i}`] || null,
  }));
  const showShades = show('shadeGuide') && copy.showShadeGuide !== false;

  const steps = Array.isArray(copy.howSteps)
    ? copy.howSteps.map((s) => ({ emoji: txt(s?.emoji), title: txt(s?.title), body: txt(s?.desc) })).filter((s) => s.title || s.body)
    : PROCESS;

  // Brands: Edit > Film Brands, else (as that tab says) the wizard's "Film
  // Brands Used" from Business Info.
  const brandList = (list(copy.filmBrandsList).length > 0 ? copy.filmBrandsList : list(biz.filmBrands))
    .map(txt).filter(Boolean);

  // Stats and spec-strip facts only from what the owner entered: About >
  // Stats Box values, else business facts. No invented numbers.
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
  const specStats = !aboutShowsStats && ownerStats.length > 0 ? ownerStats.slice(0, 4) : null;
  const specItems = specStats || (specFacts.length >= 2 ? specFacts : []);

  const galleryImages = Object.keys(images || {})
    .filter((k) => /^gallery\d+$/.test(k) && images[k])
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => images[k]);

  const testimonials = list(copy.testimonialPlaceholders).filter((q) => txt(q?.text));
  const reviews = copy.googleWidgetKey ? 'google' : testimonials.length > 0 ? 'quotes' : null;

  const has = {
    shades: showShades,
    services: show('services') && services.length > 0,
    brands: show('brands') && brandList.length > 0,
    process: show('process') && steps.length > 0,
    about: show('about'),
    gallery: show('gallery') && galleryImages.length > 0,
    reviews: show('testimonials') && !!reviews,
    contact: show('cta'),
  };
  const navLinks = [
    has.shades && { href: '#shades', label: 'Shades' },
    has.services && { href: '#services', label: 'Services' },
    has.brands && { href: '#films', label: tintShop ? 'Films' : 'Brands', extra: true },
    has.process && { href: '#process', label: 'Process', extra: true },
    has.about && { href: '#about', label: 'About' },
    has.reviews && { href: '#reviews', label: 'Reviews', extra: true },
    has.contact && { href: '#contact', label: 'Contact' },
  ].filter(Boolean);
  const anchors = {
    tel,
    contact: has.contact ? '#contact' : tel,
    services: has.services ? '#services' : null,
    shades: has.shades ? '#shades' : null,
    process: has.process ? '#process' : null,
    gallery: has.gallery ? '#gallery' : null,
    reviews: has.reviews ? '#reviews' : null,
  };

  // Hero buttons: Button 1 books (it called the phone before), Button 2
  // explores; the editor's Button URLs win, then the label's wording.
  const heroPrimaryLabel = txt(copy.ctaPrimary) || fb.ctaHeadline || 'Get a Quote';
  const heroPrimaryHref = txt(copy.ctaPrimaryUrl) || intentHref(heroPrimaryLabel, anchors, tel || anchors.contact || '#top');
  const heroSecondaryLabel = txt(copy.ctaSecondary) || (has.services ? 'Explore Services' : '');
  const heroSecondaryHref = txt(copy.ctaSecondaryUrl) || intentHref(heroSecondaryLabel, anchors, anchors.services || anchors.contact);
  const splitHero = copy.heroLayout === 'split';
  const headline = txt(copy.headline) || fb.headline || name;
  const lead = txt(copy.subheadline) || txt(biz.tagline) || fb.subheadline;
  const ghostWord = (name.split(/\s+/)[0] || '').slice(0, 14);

  const aboutParas = (txt(copy.aboutText) || `Serving ${city || 'the area'} with ${fb.aboutFallback}.`)
    .split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const aboutFacts = [
    years && { label: 'Experience', value: /^\d+\+?$/.test(years) ? `${years} ${years === '1' ? 'year' : 'years'}` : years },
    place && { label: 'Based in', value: place },
    area && { label: 'Service area', value: area },
  ].filter(Boolean).slice(0, 4);
  const specialtyParts = (Array.isArray(biz.specialties) ? biz.specialties : txt(biz.specialties).split(/,|·/))
    .map(txt).filter(Boolean);
  const specialtyChips = specialtyParts.length > 1 && specialtyParts.every((s) => s.length <= 36);

  const contactHeadline = txt(copy.ctaHeadline) || fb.ctaHeadline || 'Get in Touch';
  const contactPrimaryLabel = txt(copy.ctaButtonText) || txt(copy.ctaPrimary) || 'Book an Appointment';
  const contactPrimaryHref = txt(copy.ctaUrl) || tel || (email ? `mailto:${email}` : null);
  // The editor writes ctaSecondaryUrl from both Hero > Button 2 URL and
  // Contact > Button URL. A "Call (555) ..." button only follows it when it
  // is itself a phone/text link, or the owner also named the button.
  const secondaryUrl = txt(copy.ctaSecondaryUrl);
  const contactSecondaryLabel = txt(copy.ctaSecondaryText) || (phone ? `Call ${phone}` : '');
  const contactSecondaryHref = (secondaryUrl && (txt(copy.ctaSecondaryText) || /^(tel|sms):/i.test(secondaryUrl))) ? secondaryUrl : tel;
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, place].filter(Boolean).join(', '))}`
    : null;

  const vars = {
    '--ob-bg': t.bg,
    '--ob-surface': t.surface,
    '--ob-text': t.text,
    '--ob-muted': t.textMuted,
    '--ob-accent': ensureContrast(t.accent, t.onAccent, 4.5),
    '--ob-accent-text': t.accentText,
    '--ob-accent-soft': t.accentSoft,
    '--ob-on-accent': t.onAccent,
    '--ob-focus': t.focus,
    '--ob-on-hero': t.onHero,
    '--ob-head': font,
    '--ob-body': body,
    '--ob-mono': "'Syne Mono', ui-monospace, monospace",
    '--ob-gutter': 'clamp(20px, 5cqi, 56px)',
    ...studioTokens(t),
  };

  const brand = (logoStyle, loading) => (images.logo ? (
    <PhotoSlot src={images.logo} alt={`${name} logo`} loading={loading} style={logoStyle} imgStyle={{ objectFit: 'contain' }} />
  ) : (
    <>
      <span className="ob-mark-wrap" aria-hidden="true"><span className="ob-mark" /></span>
      <span className="ob-brand-txt">
        <span className="ob-name">{name}</span>
        <span className="ob-sub">{[fb.navSubtitle, city].filter(Boolean).join(' · ')}</span>
      </span>
    </>
  ));

  const heroText = (
    <>
      <p className="ob-chip"><span className="ob-led" aria-hidden="true" />{place || fb.heroBadge}</p>
      <h1 className={`ob-h1${headline.length > 52 ? ' ob-h1-xl' : headline.length > 38 ? ' ob-h1-long' : ''}`} style={fit(headline)}><Electric text={headline} /></h1>
      {lead && <p className="ob-lead">{lead}</p>}
      <div className="ob-actions">
        {heroPrimaryHref && (
          <a className="ob-btn ob-btn-primary" href={heroPrimaryHref}>
            {heroPrimaryLabel}
            <svg className="ob-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        )}
        {heroSecondaryLabel && heroSecondaryHref && (
          <a className="ob-btn ob-btn-line" href={heroSecondaryHref}><span>{heroSecondaryLabel} →</span></a>
        )}
      </div>
    </>
  );

  const specStrip = specItems.length > 0 && (
    <dl className={`ob-spec ob-n${specItems.length}`} style={specStats ? fit(...specStats.map((f) => f.value)) : undefined}>
      {specItems.map((f, i) => (
        <div key={`${f.label}-${i}`} className="ob-spec-block">
          <dt className="ob-spec-key">{`// ${f.label}`}</dt>
          <dd className={`ob-spec-val${specStats ? ' ob-stat-val' : ''}`}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div
      id="top"
      className="ob-root"
      style={{ ...vars, containerType: 'inline-size', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip', background: t.bg, color: t.text, fontFamily: body, lineHeight: 1.6, WebkitFontSmoothing: 'antialiased' }}
    >
      <style>{CSS}</style>
      <a className="ob-skip" href="#main">Skip to content</a>

      <nav className="ob-nav" aria-label="Main" style={{ order: -1 }}>
        <div className="ob-wrap ob-nav-in">
          <a className="ob-brand" href="#top" aria-label={`${name}, back to top`}>
            {brand({ height: 40, width: 'auto', maxWidth: 180 }, 'eager')}
          </a>
          {(navLinks.length > 0 || tel) && (
            <div className="ob-links">
              {navLinks.map((l) => (
                <a key={l.href} className={`ob-link${l.extra ? ' ob-link-x' : ''}`} href={l.href}>{l.label}</a>
              ))}
              {(tel || has.contact) && (
                <a className="ob-nav-cta" href={has.contact ? '#contact' : tel} {...(has.contact ? { 'data-scheduler-trigger': '' } : {})}>{has.contact ? 'Book Appointment' : `Call ${phone}`}</a>
              )}
            </div>
          )}
          <MobileMenu
            links={navLinks}
            cta={tel ? { href: tel, label: `Call ${phone}` } : has.contact ? { href: '#contact', label: 'Contact us' } : null}
            colors={t}
            font={body}
          />
        </div>
      </nav>

      <main id="main" style={{ display: 'flex', flexDirection: 'column' }}>
        {!show('hero') && <h1 className="ob-sr">{name}</h1>}

        {show('hero') && !splitHero && (
          <header data-section="hero" className={`ob-hero${images.hero ? ' ob-has-media' : ''}`} style={{ order: order('hero') }}>
            {images.hero ? (
              <>
                <div className="ob-hero-media">
                  <PhotoSlot src={images.hero} alt="" loading="eager" fetchPriority="high" />
                </div>
                <div className="ob-hero-scrim" />
                <div className="ob-hero-fade" />
              </>
            ) : (
              <>
                <div className="ob-hero-tint" />
                <div className="ob-leak ob-leak-1" />
                <div className="ob-leak ob-leak-2" />
                <div className="ob-gridlines" />
                <div className="ob-hex" aria-hidden="true">
                  {Array.from({ length: 36 }, (_, i) => <i key={i} />)}
                </div>
                {ghostWord && <span className="ob-ghost" aria-hidden="true">{ghostWord}</span>}
              </>
            )}
            <div className="ob-wrap">
              <div className={`ob-hero-body${headline.length > 52 ? ' ob-wide-body' : ''}`}>
                {heroText}
                {!images.hero && <EditorHint>{PHOTO_HINTS.hero}</EditorHint>}
              </div>
              {specStrip}
            </div>
          </header>
        )}

        {show('hero') && splitHero && (
          <header data-section="hero" className="ob-split" style={{ order: order('hero') }}>
            <div className="ob-split-text">
              <div className="ob-hero-tint" />
              <div className="ob-gridlines" />
              <div className="ob-hero-body">{heroText}</div>
              {specStrip}
            </div>
            <div className="ob-split-photo">
              <PhotoSlot src={images.hero} slot="hero" alt="" loading="eager" fetchPriority="high" style={fill} fallback={<Glass name={name} />} />
            </div>
          </header>
        )}

        {showShades && (
          <section data-section="shadeGuide" id="shades" className="ob-section ob-deep" aria-labelledby="ob-shades-h" style={{ order: order('shadeGuide') }}>
            <div className="ob-orb ob-orb-tr" />
            <div className="ob-wrap">
              <div className="ob-head" data-acg-reveal="">
                <div>
                  <p className="ob-tag">Visual Light Transmission</p>
                  <h2 id="ob-shades-h" className="ob-h2">Choose your <span className="ob-v">shade.</span></h2>
                </div>
                <p className="ob-body">
                  VLT is the share of visible light a film lets through. The lower the number, the darker the glass.
                  {shades.some((s) => s.photo) ? '' : ' Each window below is darkened to its shade.'}
                </p>
              </div>
              <ul className={`ob-shades${shades.length === 1 ? ' ob-shades-few ob-shades-1' : shades.length === 2 ? ' ob-shades-few' : shades.length === 3 ? ' ob-shades-3' : ''}`} style={{ gridTemplateColumns: `repeat(${Math.min(shades.length, 6)}, minmax(0, 1fr))` }} aria-label="Tint shades">
                {shades.map((s, i) => (
                  <li key={`${s.vlt}-${s.name}-${i}`} className="ob-shade-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 6) * 70}ms` }}>
                    <div className="ob-shade">
                      <div className="ob-shade-glass" aria-hidden="true">
                        {s.photo ? (
                          <PhotoSlot src={s.photo} alt="" style={fill} />
                        ) : (
                          <>
                            <div className="ob-shade-scene" />
                            <div className="ob-shade-film" style={{ '--ob-film': s.vlt === null ? 0.55 : Math.max(0.12, Math.min(0.96, 1 - s.vlt / 100)).toFixed(2) }} />
                          </>
                        )}
                      </div>
                      <div className="ob-shade-info">
                        {s.vlt !== null && <p className="ob-shade-vlt">{s.vlt}<small>% VLT</small></p>}
                        {s.name && <span className="ob-shade-name">{s.name}</span>}
                        {s.legal && <span className="ob-shade-legal">{s.legal}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="ob-note"><b>{'// '}</b>Tint laws vary by state. Ask us which shades are legal on your vehicle.</p>
              {ownShades.length === 0 && (
                <EditorHint>
                  {tintShop
                    ? 'These are starter shades. Set your own shades, legal notes and photos in Edit > Shades.'
                    : "These are starter window-tint shades and they will be published. If you don't offer tint, turn off Show Shade Guide in Edit > Shades or hide this section in Sections."}
                </EditorHint>
              )}
            </div>
          </section>
        )}

        {show('services') && (services.length > 0 || editor) && (
          <section data-section="services" id="services" className="ob-section ob-panel" aria-labelledby="ob-services-h" style={{ order: order('services') }}>
            <ServiceCardCss />
            <div className="ob-orb ob-orb-bl" />
            <div className="ob-wrap">
              <div className={`ob-head${txt(copy.servicesSection?.intro) ? '' : ' ob-head-solo'}`} data-acg-reveal="">
                <div>
                  <p className="ob-tag">What We Do</p>
                  <h2 id="ob-services-h" className="ob-h2" style={fit(txt(copy.servicesSection?.title) || 'Our services.')}>{txt(copy.servicesSection?.title) || <>Our <span className="ob-v">services.</span></>}</h2>
                </div>
                {txt(copy.servicesSection?.intro) && <p className="ob-body">{copy.servicesSection.intro}</p>}
              </div>
              {services.length === 0 ? (
                <EditorHint>Add your services and prices in Edit &gt; Services.</EditorHint>
              ) : (
                <div className="ob-films">
                  {services.map((s, i) => {
                    const wide = (wideFirst && i === 0) || (spanLast && i === services.length - 1);
                    const hero = wideFirst && i === 0;
                    const main = (
                      <div className="ob-film-main">
                        <p className="ob-badge"><span aria-hidden="true">{GLYPHS[i % GLYPHS.length]}</span>{`Service ${String(i + 1).padStart(2, '0')}`}</p>
                        {s.name && <h3 className="ob-film-title">{s.name}</h3>}
                        <ServiceDescription
                          id={`svc-more-${fromPackages ? 'pkg' : 'ai'}-${i}`}
                          text={s.description}
                          style={{ marginTop: 14, color: 'var(--ob-card-muted)', fontSize: 15.5, lineHeight: 1.75 }}
                        />
                        <div className="acg-svc-foot">
                          <div className="ob-film-foot">
                            {s.price ? (
                              <div>
                                <span className="ob-from">Price</span>
                                <span className="ob-price ob-grad-text">{s.price}</span>
                              </div>
                            ) : <span />}
                            <BookNowLink serviceName={s.name} phone={phone} label={<>Book now <Icon d={ICONS.arrow} size={16} /></>} />
                          </div>
                        </div>
                      </div>
                    );
                    return (
                      <div key={`${s.name}-${i}`} className={`ob-film-cell${wide ? ' ob-wide' : ''}`} data-acg-reveal="" style={{ '--acg-delay': `${(i % 2) * 90}ms` }}>
                        <article className="acg-svc-card ob-film">
                          <span className="ob-film-glow" aria-hidden="true" />
                          {main}
                          {hero && services.length > 1 && (
                            <div className="ob-wave" aria-hidden="true">
                              <span className="ob-wave-mark" />
                              <span className="ob-wave-cap">{'// Services offered'}</span>
                              <span className="ob-wave-num">{String(services.length).padStart(2, '0')}</span>
                            </div>
                          )}
                        </article>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {show('brands') && (brandList.length > 0 || editor) && (
          <section data-section="brands" id="films" className="ob-section ob-deep" aria-labelledby="ob-brands-h" style={{ order: order('brands') }}>
            <div className="ob-wrap">
              <div className="ob-head ob-head-solo" data-acg-reveal="">
                <div>
                  <p className="ob-tag">{tintShop ? 'Film Brands' : 'Brands'}</p>
                  {tintShop
                    ? <h2 id="ob-brands-h" className="ob-h2">The films <span className="ob-v">we install.</span></h2>
                    : <h2 id="ob-brands-h" className="ob-h2">The brands <span className="ob-v">we use.</span></h2>}
                </div>
              </div>
              {brandList.length > 0 ? (
                <ul className="ob-brands">
                  {brandList.map((b, i) => (
                    <li key={`${b}-${i}`} className="ob-brand-cell" data-acg-reveal="fade" style={{ '--acg-delay': `${(i % 4) * 80}ms` }}>
                      <div className="ob-brand-tile">
                        <span className="ob-brand-top"><span className="ob-glyph" aria-hidden="true">{GLYPHS[i % GLYPHS.length]}</span>{`// ${String(i + 1).padStart(2, '0')}`}</span>
                        <span className="ob-brand-name">{b}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EditorHint>List the brands you use in Edit &gt; Film Brands, or hide this section in Sections.</EditorHint>
              )}
            </div>
          </section>
        )}

        {show('process') && (steps.length > 0 || editor) && (
          <section data-section="process" id="process" className="ob-section" aria-labelledby="ob-process-h" style={{ order: order('process') }}>
            <div className="ob-orb ob-orb-c" />
            <div className="ob-wrap">
              <div className="ob-head ob-head-solo" data-acg-reveal="">
                <div>
                  <p className="ob-tag">Our Process</p>
                  <h2 id="ob-process-h" className="ob-h2">Precision is <span className="ob-v">the standard.</span></h2>
                </div>
              </div>
              {steps.length > 0 ? (
                <ol className="ob-steps" style={{ '--ob-cols': steps.length <= 4 ? steps.length : steps.length % 4 === 0 ? 4 : 3 }}>
                  {steps.map((step, i) => (
                    <li key={`${step.title}-${i}`} className="ob-step-cell" data-acg-reveal="fade" style={{ '--acg-delay': `${(i % 4) * 90}ms` }}>
                      <div className={`ob-step${step.icon || step.emoji ? '' : ' ob-step-noicon'}`}>
                        <span className="ob-step-num">{`// ${String(i + 1).padStart(2, '0')}`}</span>
                        {(step.icon || step.emoji) && (
                          <span className="ob-step-icon" aria-hidden="true">
                            {step.icon ? <Icon d={ICONS[step.icon]} size={22} /> : <IconOrEmoji value={step.emoji} size={22} />}
                          </span>
                        )}
                        {step.title && <h3>{step.title}</h3>}
                        {step.body && <p>{step.body}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EditorHint>These steps are empty. Hide this section in Sections if you don't need it.</EditorHint>
              )}
            </div>
          </section>
        )}

        {show('about') && (
          <section data-section="about" id="about" className="ob-section ob-deep" aria-labelledby="ob-about-h" style={{ order: order('about') }}>
            <div className="ob-wrap ob-about">
              <div data-acg-reveal="">
                {aboutShowsStats ? (
                  <dl className="ob-statpanel" style={fit(...ownerStats.slice(0, 4).map((s) => s.value))}>
                    {ownerStats.slice(0, 4).map((s, i) => (
                      <div key={`${s.label}-${i}`}>
                        <dt className="ob-label">{s.label}</dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="ob-frame">
                    <div className="ob-media">
                      <PhotoSlot src={images.about} slot="about" alt={`${name} at work`} style={fill} fallback={<Glass name={name} />} />
                      {images.about && <span className="ob-media-tint" />}
                    </div>
                  </div>
                )}
                {aboutStatsMode && ownerStats.length === 0 && (
                  <EditorHint>Add your stats in Edit &gt; About &gt; Stats Box (the photo shows until then).</EditorHint>
                )}
              </div>
              <div data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                <p className="ob-tag">About the Studio</p>
                <h2 id="ob-about-h" className={`ob-h2${name.length > 20 ? ' ob-h2-long' : ''}`} style={fit(name)}>About {name}</h2>
                <div className="ob-prose">
                  {aboutParas.map((p, i) => <p key={i}>{p}</p>)}
                </div>
                {aboutFacts.length > 0 && (
                  <dl className="ob-dl">
                    {aboutFacts.map((f) => (
                      <div key={f.label}>
                        <dt className="ob-label">{f.label}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {specialtyParts.length > 0 && (
                  <div style={{ marginTop: 28 }}>
                    <p className="ob-label">Specialties</p>
                    {specialtyChips ? (
                      <ul className="ob-chips">
                        {specialtyParts.map((s) => <li key={s} className="ob-chip-sm">{s}</li>)}
                      </ul>
                    ) : (
                      <p className="ob-spec-line">{specialtyParts.join(', ')}</p>
                    )}
                  </div>
                )}
                {awards.length > 0 && (
                  <div className="ob-awards" data-acg-awards="">
                    <p className="ob-label">{'// Recognition'}</p>
                    <ul>
                      {awards.map((a, i) => <li key={`${a}-${i}`}><Icon d={ICONS.award} size={18} />{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {show('gallery') && (galleryImages.length > 0 || editor) && (
          <section data-section="gallery" id="gallery" className="ob-section" aria-labelledby="ob-gallery-h" style={{ order: order('gallery') }}>
            <div className="ob-wrap">
              <div className="ob-head ob-head-solo" data-acg-reveal="">
                <div>
                  <p className="ob-tag">Portfolio</p>
                  <h2 id="ob-gallery-h" className="ob-h2">Recent <span className="ob-v">work.</span></h2>
                </div>
              </div>
              {galleryImages.length === 0 ? (
                <PhotoSlot slot="gallery" style={{ minHeight: 220 }} />
              ) : galleryImages.length > 4 ? (
                <>
                  <div className="ob-track" role="region" aria-label="Photo gallery, scroll sideways for more" tabIndex={0}>
                    {galleryImages.map((src, i) => (
                      <figure key={i} className="ob-shot">
                        <PhotoSlot src={src} alt={`${name} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                        <figcaption className="ob-shot-cap" aria-hidden="true">{`// ${String(i + 1).padStart(2, '0')}`}</figcaption>
                      </figure>
                    ))}
                  </div>
                  <p className="ob-swipe" aria-hidden="true">Swipe or scroll for more →</p>
                </>
              ) : (
                <div className={`ob-gal ob-g${galleryImages.length}`}>
                  {galleryImages.map((src, i) => (
                    <figure key={i} className="ob-shot" data-acg-reveal="fade" style={{ '--acg-delay': `${i * 90}ms` }}>
                      <PhotoSlot src={src} alt={`${name} work, photo ${i + 1} of ${galleryImages.length}`} style={fill} />
                      <figcaption className="ob-shot-cap" aria-hidden="true">{`// ${String(i + 1).padStart(2, '0')}`}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'google' && (
          <section data-section="testimonials" id="reviews" className="ob-section ob-panel" aria-label={txt(copy.googleReviewsTitle) || 'Reviews'} style={{ order: order('testimonials') }}>
            <div className="ob-wrap">
              {txt(copy.googleReviewsTitle) && (
                <div className="ob-head ob-head-solo">
                  <div>
                    <p className="ob-tag">Reviews</p>
                    <h2 className="ob-h2" style={fit(copy.googleReviewsTitle)}>{copy.googleReviewsTitle}</h2>
                  </div>
                </div>
              )}
              <div className="ob-reviews-widget">
                <GoogleReviewsWidget widgetKey={copy.googleWidgetKey} theme={copy.googleReviewsTheme} />
              </div>
            </div>
          </section>
        )}

        {show('testimonials') && reviews === 'quotes' && (
          <section data-section="testimonials" id="reviews" className="ob-section ob-panel" aria-labelledby="ob-reviews-h" style={{ order: order('testimonials') }}>
            <div className="ob-wrap">
              <div className="ob-head ob-head-solo ob-center" data-acg-reveal="">
                <div>
                  <p className="ob-tag">Client Feedback</p>
                  <h2 id="ob-reviews-h" className="ob-h2">They see <span className="ob-v">clearly.</span></h2>
                </div>
              </div>
              <div className={`ob-quotes ${testimonials.length === 1 ? 'ob-c1' : testimonials.length === 2 || testimonials.length === 4 ? 'ob-c2' : 'ob-c3'}`}>
                {testimonials.map((q, i) => {
                  const who = txt(q.name);
                  const initials = who ? who.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '';
                  const role = txt(q.vehicle) || txt(q.role);
                  return (
                    <div key={i} className="ob-quote-cell" data-acg-reveal="" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                      <figure className="ob-quote">
                        <span className="ob-film-glow" aria-hidden="true" />
                        <span className="ob-quote-mark" aria-hidden="true">“</span>
                        <blockquote><p>{q.text}</p></blockquote>
                        {(who || role) && (
                          <figcaption>
                            {initials && <span className="ob-av" aria-hidden="true">{initials}</span>}
                            <span>
                              {who && <span className="ob-q-name">{who}</span>}
                              {role && <span className="ob-q-role">{role}</span>}
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
          <section data-section="cta" id="contact" className="ob-section ob-deep ob-contact" aria-labelledby="ob-contact-h" style={{ order: order('cta') }}>
            <div className="ob-orb ob-orb-tr" />
            <div className="ob-wrap ob-contact-grid">
              <div data-acg-reveal="">
                <p className="ob-tag">Ready When You Are</p>
                <h2 id="ob-contact-h" className="ob-h2" style={fit(contactHeadline)}><Electric text={contactHeadline} /></h2>
                <p className="ob-body">{txt(copy.ctaSubtext) || `${place ? `Serving ${place}. ` : ''}Get in touch to book an appointment or ask a question.`}</p>
                <div className="ob-actions">
                  {contactPrimaryHref && (
                    <a className="ob-btn ob-btn-primary" href={contactPrimaryHref} {...(txt(copy.ctaUrl) ? {} : { 'data-scheduler-trigger': '' })}>
                      {contactPrimaryLabel}
                      <svg className="ob-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </a>
                  )}
                  {contactSecondaryHref && contactSecondaryLabel && (contactSecondaryHref !== contactPrimaryHref || txt(copy.ctaSecondaryText)) && (
                    <a className="ob-btn ob-btn-ghost" href={contactSecondaryHref}>{contactSecondaryLabel}</a>
                  )}
                </div>
              </div>

              <ul className="ob-dets" data-acg-reveal="" style={{ '--acg-delay': '120ms' }}>
                {phone && (
                  <li className="ob-det">
                    <span className="ob-det-icon"><Icon d={ICONS.phone} size={18} /></span>
                    <span className="ob-det-body">
                      <span className="ob-label">Phone</span>
                      <span className="ob-det-val">{tel ? <a href={tel}>{phone}</a> : phone}</span>
                    </span>
                  </li>
                )}
                {email && (
                  <li className="ob-det">
                    <span className="ob-det-icon"><Icon d={ICONS.mail} size={18} /></span>
                    <span className="ob-det-body">
                      <span className="ob-label">Email</span>
                      <span className="ob-det-val"><a href={`mailto:${email}`}>{email}</a></span>
                    </span>
                  </li>
                )}
                {(address || place || area) && (
                  <li className="ob-det">
                    <span className="ob-det-icon"><Icon d={ICONS.pin} size={18} /></span>
                    <span className="ob-det-body">
                      <span className="ob-label">{address ? (tintShop ? 'Studio' : 'Location') : area ? 'Service area' : 'Based in'}</span>
                      <span className="ob-det-val">
                        {address ? <a href={mapsHref} target="_blank" rel="noopener noreferrer">{[address, place].filter(Boolean).join(', ')}</a> : (area || place)}
                      </span>
                      {address && area && <span className="ob-det-sub">{area}</span>}
                    </span>
                  </li>
                )}
                {hours.length > 0 && (
                  <li className="ob-det">
                    <span className="ob-det-icon"><Icon d={ICONS.clock} size={18} /></span>
                    <span className="ob-det-body">
                      <span className="ob-label">Hours</span>
                      {hours.length === 1 && !hours[0].time ? (
                        <span className="ob-det-val">{hours[0].days}</span>
                      ) : (
                        <dl className="ob-hours">
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
                  <li className="ob-det">
                    <span className="ob-det-icon"><Icon d={ICONS.card} size={18} /></span>
                    <span className="ob-det-body">
                      <span className="ob-label">We accept</span>
                      <span className="ob-chips">
                        {payments.map((p) => <span key={p} className="ob-chip-sm">{p}</span>)}
                      </span>
                    </span>
                  </li>
                )}
                {warranty && (
                  <li className="ob-det">
                    <span className="ob-det-icon"><Icon d={ICONS.shield} size={18} /></span>
                    <span className="ob-det-body">
                      <span className="ob-label">Warranty</span>
                      <span className="ob-det-val">{warranty}</span>
                    </span>
                  </li>
                )}
              </ul>
            </div>
          </section>
        )}
      </main>

      <footer className="ob-foot" style={{ order: 9999 }}>
        <div className="ob-wrap">
          <div className="ob-foot-grid">
            <div className="ob-foot-brand">
              <a className="ob-brand" href="#top" aria-label={`${name}, back to top`}>
                {brand({ height: 48, width: 'auto', maxWidth: 200 })}
              </a>
              <p className="ob-foot-tag">{txt(copy.footerTagline) || txt(biz.tagline) || fb.footerDesc}</p>
              <div className="ob-social">
                <SocialRow biz={biz} color={vars['--ob-footer-accent']} size={18} gap={10} images={images} />
              </div>
            </div>
            {services.length > 0 && (
              <div>
                <p className="ob-foot-h">{'// Services'}</p>
                <ul className="ob-foot-list">
                  {services.slice(0, 5).map((s, i) => s.name && <li key={`${s.name}-${i}`}><a href={has.services ? '#services' : '#top'}>{s.name}</a></li>)}
                </ul>
              </div>
            )}
            {navLinks.length > 0 && (
              <div>
                <p className="ob-foot-h">{'// Studio'}</p>
                <ul className="ob-foot-list">
                  {navLinks.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
                </ul>
              </div>
            )}
            {(tel || email || address || place) && (
              <div className="ob-foot-connect">
                <p className="ob-foot-h">{'// Connect'}</p>
                <ul className="ob-foot-list">
                  {tel && <li><a href={tel}>{phone}</a></li>}
                  {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                  {address && <li>{address}</li>}
                  {place && <li>{place}</li>}
                </ul>
              </div>
            )}
          </div>
          <div className="ob-foot-bottom">
            <p>© <span data-acg-year="">{new Date().getFullYear()}</span> {name}{place ? ` · ${place}` : ''} · All rights reserved</p>
            <span className="ob-foot-slogan">{'// see less. look more.'}</span>
          </div>
        </div>
      </footer>

      <MobileActionBar phone={phone} bookHref={has.contact ? '#contact' : '#top'} colors={t} font={body} />
    </div>
  );
}
