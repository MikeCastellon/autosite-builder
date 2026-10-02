import { alpha, readableOn } from './theme.js';

// CSS-only phone navigation. Published pages have no React on the client,
// so the menu is a native <details>: the <summary> is the hamburger and
// opening it shows the panel. siteRuntime.js closes it after a link tap,
// an outside tap or Escape. Shown only when the template root (which sets
// containerType: 'inline-size') is 600px or narrower, the same breakpoint
// the templates' own @container rules use to hide their desktop links.
// Class names are all acg-menu* / acg-actionbar* so template CSS can't clash.

const MENU_CSS = `
.acg-menu{display:none;position:relative;flex:none}
@container (max-width: 600px){.acg-menu{display:block}}
@supports not (container-type: inline-size){@media (max-width: 600px){.acg-menu{display:block}}}
.acg-menu>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;color:var(--acg-menu-text);border:1px solid var(--acg-menu-border);background:var(--acg-menu-btn);-webkit-tap-highlight-color:transparent}
.acg-menu>summary::-webkit-details-marker{display:none}
.acg-menu>summary::marker{content:''}
.acg-menu>summary:focus-visible{outline:2px solid var(--acg-menu-accent);outline-offset:2px}
.acg-menu-bars{position:relative;display:block;width:20px;height:14px}
.acg-menu-bars>span{position:absolute;left:0;width:100%;height:2px;border-radius:2px;background:currentColor}
.acg-menu-bars>span:nth-child(1){top:0}
.acg-menu-bars>span:nth-child(2){top:6px}
.acg-menu-bars>span:nth-child(3){top:12px}
.acg-menu[open] .acg-menu-bars>span:nth-child(1){top:6px;transform:rotate(45deg)}
.acg-menu[open] .acg-menu-bars>span:nth-child(2){opacity:0}
.acg-menu[open] .acg-menu-bars>span:nth-child(3){top:6px;transform:rotate(-45deg)}
.acg-menu-panel{position:absolute;right:0;top:calc(100% + 10px);z-index:1000;box-sizing:border-box;width:min(300px,calc(100vw - 32px));display:flex;flex-direction:column;padding:8px;border-radius:16px;background:var(--acg-menu-bg);color:var(--acg-menu-text);border:1px solid var(--acg-menu-border);box-shadow:0 18px 44px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.12);text-align:left}
.acg-menu-panel a{position:relative;display:flex;align-items:center;min-height:48px;padding:0 14px;border-radius:10px;color:inherit;text-decoration:none;font-size:16px;font-weight:600;letter-spacing:.01em}
.acg-menu-panel a+a:not(.acg-menu-cta)::before{content:'';position:absolute;top:0;left:14px;right:14px;height:1px;background:var(--acg-menu-border)}
.acg-menu-panel a:focus-visible{outline:2px solid var(--acg-menu-accent);outline-offset:-2px}
.acg-menu-panel a.acg-menu-cta{justify-content:center;margin-top:8px;background:var(--acg-menu-accent);color:var(--acg-menu-on-accent);font-weight:700}
@media (hover:hover){.acg-menu-panel a:not(.acg-menu-cta):hover{background:var(--acg-menu-hover)}.acg-menu-panel a.acg-menu-cta:hover{filter:brightness(1.08)}}
@media (prefers-reduced-motion: no-preference){.acg-menu-bars>span{transition:transform .2s ease,top .2s ease,opacity .15s ease}.acg-menu[open] .acg-menu-panel{animation:acg-menu-in .18s ease-out}}
@keyframes acg-menu-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
`;

const ACTIONBAR_CSS = `
.acg-actionbar{display:none;position:sticky;bottom:0;z-index:90;order:10000;box-sizing:border-box;width:100%;gap:10px;padding:10px 12px calc(10px + env(safe-area-inset-bottom, 0px));background:var(--acg-ab-bg);border-top:1px solid var(--acg-ab-border);box-shadow:0 -8px 24px rgba(0,0,0,.16)}
@container (max-width: 600px){.acg-actionbar{display:flex}}
@supports not (container-type: inline-size){@media (max-width: 600px){.acg-actionbar{display:flex}}}
body.acg-has-bar .acg-actionbar{bottom:48px;padding-bottom:10px}
body.acg-has-bar .acg-actionbar::after{content:'';position:absolute;left:0;right:0;top:100%;height:10px;background:var(--acg-ab-bg)}
.acg-actionbar a{flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 12px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:.01em;text-decoration:none;-webkit-tap-highlight-color:transparent}
.acg-actionbar a:focus-visible{outline:2px solid var(--acg-ab-accent);outline-offset:2px}
.acg-actionbar-call{color:var(--acg-ab-text);border:1.5px solid var(--acg-ab-border-strong);background:transparent}
.acg-actionbar-book{color:var(--acg-ab-on-accent);background:var(--acg-ab-accent);border:1.5px solid var(--acg-ab-accent)}
@media (max-width: 600px){body:has(.acg-actionbar)>button[aria-label="Open booking form"]{display:none!important}}
`;

function menuVars(colors = {}) {
  const bg = colors.bg || '#ffffff';
  const text = colors.text || readableOn(bg);
  const accent = colors.accent || text;
  return { bg, text, accent, onAccent: colors.onAccent || readableOn(accent) };
}

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// links: [{ href, label }]; cta: { href, label } (optional, rendered as a
// full-width accent button; add data-scheduler-trigger via cta.bookingTrigger
// so the booking widget can open from it). colors: { bg, text, accent,
// onAccent } (pass deriveTheme() tokens). Render it inside the template's
// nav, next to the desktop links the template hides below 600px.
export function MobileMenu({ links = [], cta, colors, font, className = '' }) {
  const v = menuVars(colors);
  const style = {
    '--acg-menu-bg': v.bg,
    '--acg-menu-text': v.text,
    '--acg-menu-accent': v.accent,
    '--acg-menu-on-accent': v.onAccent,
    '--acg-menu-border': alpha(v.text, 0.14),
    '--acg-menu-hover': alpha(v.text, 0.07),
    '--acg-menu-btn': alpha(v.text, 0.04),
    ...(font ? { fontFamily: font } : {}),
  };
  const items = (links || []).filter((l) => l && l.href && l.label);
  return (
    <>
      <style>{MENU_CSS}</style>
      <details className={`acg-menu${className ? ` ${className}` : ''}`} style={style}>
        <summary aria-label="Open menu">
          <span className="acg-menu-bars" aria-hidden="true"><span /><span /><span /></span>
        </summary>
        <div className="acg-menu-panel">
          {items.map((l) => (
            <a key={`${l.href}|${l.label}`} href={l.href}>{l.label}</a>
          ))}
          {cta && cta.href && cta.label && (
            <a
              className="acg-menu-cta"
              href={cta.href}
              {...(cta.bookingTrigger ? { 'data-scheduler-trigger': '' } : {})}
            >
              {cta.label}
            </a>
          )}
        </div>
      </details>
    </>
  );
}

// Sticky phone action bar (Call + Book), shown only at 600px and below.
// Render it as a DIRECT child of the template's flex-column root: it is
// position: sticky (bottom) with order 10000, so it rides the bottom of the
// screen and comes to rest after the footer. (position: fixed would not
// work: container-type on the root makes the root the containing block for
// fixed descendants.) It sits above the free-tier "Powered by" bar
// (body.acg-has-bar) and hides the booking widget's floating button on
// phones, since Book here opens the same modal via data-scheduler-trigger.
export function MobileActionBar({ phone, bookHref = '#book', colors, font, callLabel = 'Call', bookLabel = 'Book' }) {
  const v = menuVars(colors);
  const tel = telHref(phone);
  const style = {
    '--acg-ab-bg': v.bg,
    '--acg-ab-text': v.text,
    '--acg-ab-accent': v.accent,
    '--acg-ab-on-accent': v.onAccent,
    '--acg-ab-border': alpha(v.text, 0.12),
    '--acg-ab-border-strong': alpha(v.text, 0.3),
    ...(font ? { fontFamily: font } : {}),
  };
  return (
    <>
      <style>{ACTIONBAR_CSS}</style>
      <div className="acg-actionbar" style={style}>
        {tel && (
          <a className="acg-actionbar-call" href={tel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
            </svg>
            {callLabel}
          </a>
        )}
        <a className="acg-actionbar-book" href={bookHref} data-scheduler-trigger="">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {bookLabel}
        </a>
      </div>
    </>
  );
}

export default MobileMenu;
