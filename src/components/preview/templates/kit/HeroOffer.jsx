// The hero's services card (Edit > Hero > Services in the hero): Redline's
// price card, shared by every theme that offers it. Two modes:
//   'quote': a CSS-only price picker. Package radios (name <ns>-pkg) sit right
//     before their labels for the selected look; the "Get My Price" checkbox
//     (<ns>-go) sits between the two steps so its ~ rule can show step 2, and
//     :has() hides step 1 and swaps in the picked package's price and Book
//     link. Nothing is pre-picked (no defaultChecked). Step 3 is the booking
//     widget the Book link opens (data-scheduler-trigger).
//   'list': the packages as plain rows in the card's look, no picking; its
//     button goes to the package cards (listCta) or books.
// The card is id="quote", so "Get a Quote" buttons land on it in both modes.
//
// Every class and id is `${ns}-<name>`: Redline passes ns="rl" (its own
// hand-tuned CSS styles it); other themes pass "<prefix>-hq" and append
// heroOfferCss(ns) to their one <style> string while the card renders. The
// template renders the slot around the card and decides when to show it
// (features.js heroOfferOf). No hooks, no browser globals.
import { LucideIcon as Icon, HERO_PICK_ICONS } from './icons.jsx';
import { optPriceLong } from './features.js';

export const HERO_OFFER_LABELS = {
  step1: 'Step 1 of 3',
  legend: 'Choose a package',
  q1: 'What Package Do You Need?',
  sub1: 'Choose the package that fits your ride.',
  go: 'Get My Price',
  goAria: 'Get my price',
  step2: 'Step 2 of 3',
  your: 'Your',
  price: 'Price',
  pick: 'Pick a package to see its price.',
  row: 'Package',
  back: 'Back',
  book: 'Book Now',
  listTitle: 'Our Packages',
};

// picks: [{ name, price, summary }] (trimmed strings), at most 4.
// listCta: { href, label, books } for the list card's button (books = it also
// opens the booking widget). tel / phoneLabel: the call link under the card
// (none without tel).
export function HeroOffer({ ns, mode, picks, bookHref, tel, phoneLabel, listCta, labels, icons = HERO_PICK_ICONS }) {
  const items = Array.isArray(picks) ? picks : [];
  if ((mode !== 'quote' && mode !== 'list') || items.length === 0) return null;
  const L = { ...HERO_OFFER_LABELS, ...(labels && typeof labels === 'object' ? labels : {}) };

  if (mode === 'list') {
    return (
      <div className={`${ns}-quote ${ns}-hlist`} id="quote">
        <h2 className={`${ns}-q-h`}>{L.listTitle}</h2>
        <ul className={`${ns}-hl`}>
          {items.map((s, i) => (
            <li key={`${s.name}-${i}`} className={s.price && optPriceLong(s.price) ? `${ns}-opt-l` : undefined}>
              <span className={`${ns}-opt-ico`} aria-hidden="true"><Icon name={icons[i]} size={20} /></span>
              <span className={`${ns}-opt-txt`}>
                <span className={`${ns}-opt-name`}>{s.name}</span>
                {s.summary && <span className={`${ns}-opt-sum`}>{s.summary}</span>}
              </span>
              {s.price && <span className={`${ns}-opt-price${optPriceLong(s.price) ? ` ${ns}-opt-price-t` : ''}`}>{s.price}</span>}
            </li>
          ))}
        </ul>
        {listCta && listCta.href && (
          <a className={`${ns}-hl-cta`} href={listCta.href} {...(listCta.books ? { 'data-scheduler-trigger': '' } : {})}>{listCta.label}<Icon name="arrowRight" size={20} /></a>
        )}
        {tel && <a className={`${ns}-q-call`} href={tel}><Icon name="phone" />Call {phoneLabel}</a>}
      </div>
    );
  }

  return (
    <div className={`${ns}-quote`} id="quote">
      <div className={`${ns}-steps`} aria-hidden="true">
        <span className={`${ns}-dot ${ns}-d1`}><b>1</b><Icon name="check" /></span><i />
        <span className={`${ns}-dot ${ns}-d2`}><b>2</b></span><i />
        <span className={`${ns}-dot ${ns}-d3`}><b>3</b></span>
      </div>
      <fieldset className={`${ns}-s1`}>
        <legend className={`${ns}-sr`}>{L.legend}</legend>
        <p className={`${ns}-step-l`} aria-hidden="true">{L.step1}</p>
        <h2 className={`${ns}-q-h`}>{L.q1}</h2>
        <p className={`${ns}-q-p`}>{L.sub1}</p>
        <div className={`${ns}-opts`}>
          {items.map((s, i) => (
            <div key={`${s.name}-${i}`}>
              <input type="radio" name={`${ns}-pkg`} id={`${ns}-pkg-${i}`} className={`${ns}-sr ${ns}-radio`} value={s.name} />
              <label htmlFor={`${ns}-pkg-${i}`} className={`${ns}-opt${optPriceLong(s.price) ? ` ${ns}-opt-l` : ''}`}>
                <span className={`${ns}-opt-ico`} aria-hidden="true"><Icon name={icons[i]} size={20} /></span>
                <span className={`${ns}-opt-txt`}>
                  <span className={`${ns}-opt-name`}>{s.name}</span>
                  {s.summary && <span className={`${ns}-opt-sum`}>{s.summary}</span>}
                </span>
                {s.price && <span className={`${ns}-opt-price${optPriceLong(s.price) ? ` ${ns}-opt-price-t` : ''}`}>{s.price}</span>}
              </label>
            </div>
          ))}
        </div>
        <label htmlFor={`${ns}-go`} className={`${ns}-q-cta ${ns}-go-l`}>{L.go}<Icon name="arrowRight" size={20} /></label>
      </fieldset>
      <input type="checkbox" id={`${ns}-go`} className={`${ns}-sr ${ns}-go`} aria-label={L.goAria} />
      <div className={`${ns}-s2`} aria-live="polite">
        <p className={`${ns}-step-l`} aria-hidden="true">{L.step2}</p>
        <h2 className={`${ns}-q-title`}>{`${L.your} `}<span>{L.price}</span></h2>
        <div className={`${ns}-res-set`}>
          <div className={`${ns}-res ${ns}-any`}>
            <p className={`${ns}-q-p`}>{L.pick}</p>
          </div>
          {items.map((s, i) => (
            <div key={`${s.name}-${i}`} className={`${ns}-res ${ns}-pk-${i}`}>
              <div className={`${ns}-row`}>
                <span className={`${ns}-row-l`}>{L.row}</span>
                <span className={`${ns}-row-v`}>{s.name}{s.price && <> <span>{s.price}</span></>}</span>
              </div>
              {s.summary && <p className={`${ns}-q-p`}>{s.summary}</p>}
            </div>
          ))}
        </div>
        <div className={`${ns}-q-acts`}>
          <label htmlFor={`${ns}-go`} className={`${ns}-back ${ns}-go-l`}><Icon name="arrowLeft" size={20} />{L.back}</label>
          <a className={`${ns}-q-book ${ns}-any`} href={bookHref} data-scheduler-trigger="">{L.book}<Icon name="arrowRight" size={20} /></a>
          {items.map((s, i) => (
            <a key={`${s.name}-${i}`} className={`${ns}-q-book ${ns}-pk-${i}`} href={bookHref} data-scheduler-trigger="" data-scheduler-service={s.name}>
              {L.book}<Icon name="arrowRight" size={20} />
            </a>
          ))}
        </div>
        {tel && <a className={`${ns}-q-call`} href={tel}><Icon name="phone" />Call {phoneLabel}</a>}
      </div>
    </div>
  );
}

// The card's CSS for a theme other than Redline: Redline's own rules with
// `rl-` replaced by `${ns}-` and its tokens replaced by block variables the
// theme sets on the card or the root (each aliased to a contrast-repaired
// theme token; fallbacks in parentheses):
//   --ns-card-bg / -card-text / -card-muted / -card-accent   the card (required)
//   --ns-opt-bg / -opt-text / -opt-muted / -opt-accent        option rows, step dots,
//                                                            list rows (card-*)
//   --ns-btn-bg (card-accent) / --ns-btn-text (required)     Get My Price, Book, list button
//   --ns-btn-shadow (none)  --ns-pick-shadow (none)          button / picked-row glow
//   --ns-pick (card-accent)  --ns-hover (line-strong)        picked-row border, hover border
//   --ns-line / -line-strong (required)                      hairlines
//   --ns-row-bg / -row-text / -row-muted / -row-accent (card-*)  the step-2 "Package" row
//   --ns-head (inherit) / -head-w (700)                      step titles
//   --ns-display / -display-w (head values)                  "Your Price", the row value
//   --ns-case (uppercase)  --ns-bw (1px)  --ns-focus (card-accent)
//   --ns-r (8px) / -r-ctl (6px) / -r-lg (16px)               card / rows+buttons / step-2 parts
//   --ns-shadow (0 24px 60px -24px rgba(0,0,0,.22))          the card's shadow
// stackFrom: the container width from which the card keeps one height while
// it swaps steps (it sits beside the hero copy there; 0 = never). scope: a
// selector (or a comma list) that card must sit inside for that, when only
// some of the theme's hero layouts put it beside the copy from stackFrom;
// heroOfferLockCss adds the lock for another layout at another width.
export function heroOfferCss(ns, { stackFrom = 900, scope = '' } = {}) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  const cardBg = v('card-bg');
  const cardText = v('card-text');
  const cardMuted = v('card-muted');
  const cardAccent = v('card-accent');
  const optBg = v('opt-bg', cardBg);
  const optText = v('opt-text', cardText);
  const optMuted = v('opt-muted', cardMuted);
  const optAccent = v('opt-accent', cardAccent);
  const btnBg = v('btn-bg', cardAccent);
  const btnText = v('btn-text');
  const btnShadow = v('btn-shadow', 'none');
  const pickShadow = v('pick-shadow', 'none');
  const pick = v('pick', cardAccent);
  const line = v('line');
  const lineStrong = v('line-strong');
  const hover = v('hover', lineStrong);
  const rowBg = v('row-bg', cardBg);
  const rowText = v('row-text', cardText);
  const rowMuted = v('row-muted', cardMuted);
  const rowAccent = v('row-accent', cardAccent);
  const head = v('head', 'inherit');
  const headW = v('head-w', '700');
  const display = v('display', head);
  const displayW = v('display-w', headW);
  const tcase = v('case', 'uppercase');
  const r = v('r', '8px');
  const rCtl = v('r-ctl', '6px');
  const rLg = v('r-lg', '16px');
  const bw = v('bw', '1px');
  const shadow = v('shadow', '0 24px 60px -24px rgba(0,0,0,.22)');
  const focus = v('focus', cardAccent);
  const pk = (f) => [0, 1, 2, 3].map(f).join(',');
  return `
${p}-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
${p}-quote :where(h2,p,ul,fieldset,legend){margin:0}
${p}-quote :where(fieldset){border:0;padding:0;min-width:0}
${p}-quote :where(ul){list-style:none;padding:0}
${p}-quote :where(a){color:inherit;text-decoration:none}
${p}-radio:focus-visible+${p}-opt,${p}-quote:has(${p}-go:focus-visible) ${p}-go-l,${p}-quote a:focus-visible{outline:2px solid ${focus};outline-offset:3px}
${p}-quote{position:relative;scroll-margin-top:80px;padding:20px;border-radius:${r};border:${bw} solid ${line};background:${cardBg};box-shadow:${shadow};color:${cardText};text-align:left}
${p}-steps{display:flex;align-items:center;gap:12px}
${p}-steps i{flex:1}
${p}-dot{display:flex;flex:none;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;border:${bw} solid ${line};background:${optBg};color:${optMuted};font-size:14px;line-height:20px;font-weight:700}
${p}-dot b{font-weight:inherit}
${p}-dot svg{display:none}
${p}-d1,${p}-quote:has(${p}-go:checked) ${p}-d2{border-color:transparent;background:${btnBg};color:${btnText};box-shadow:${pickShadow}}
${p}-quote:has(${p}-go:checked) ${p}-d1{border-color:${lineStrong};background:transparent;box-shadow:none;color:${cardAccent}}
${p}-quote:has(${p}-go:checked) ${p}-d1 b{display:none}
${p}-quote:has(${p}-go:checked) ${p}-d1 svg{display:block}
${p}-s1{margin-top:20px}
${p}-s2{display:none;margin-top:32px}
${p}-go:checked~${p}-s2{display:block}
@supports selector(:has(*)){
${p}-quote:has(${p}-go:checked) ${p}-s1{display:none}
${p}-quote:not(:has(${p}-radio:checked)) ${p}-go{visibility:hidden}
}
${p}-step-l{font-size:12px;line-height:16px;font-weight:600;letter-spacing:.3em;text-transform:${tcase};color:${cardAccent}}
${p}-q-h{margin-top:8px;font-family:${head};font-size:24px;line-height:1.25;font-weight:${headW};text-transform:${tcase};color:${cardText}}
${p}-q-p{margin-top:12px;font-size:16px;line-height:24px;color:${cardMuted}}
${p}-opts{display:flex;flex-direction:column;gap:10px;margin-top:20px}
${p}-opt{display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;border-radius:${rCtl};border:${bw} solid ${line};background:${optBg};cursor:pointer}
${p}-opt-ico{display:flex;flex:none;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;border:${bw} solid ${line};color:${optAccent}}
${p}-opt-txt{flex:1;min-width:0}
${p}-opt-name{display:block;font-size:14px;line-height:17.5px;font-weight:700;color:${optText};overflow-wrap:break-word}
${p}-opt-sum{display:block;font-size:12px;line-height:16px;color:${optMuted};overflow-wrap:break-word}
${p}-opt-price{flex:none;font-size:16px;line-height:24px;font-weight:700;color:${optAccent}}
${p}-opt-l{flex-wrap:wrap;row-gap:4px}
${p}-opt-price${p}-opt-price-t{flex:1 1 100%;min-width:0;padding-left:48px;font-size:14px;line-height:20px;overflow-wrap:break-word}
${p}-radio:checked+${p}-opt{border-color:${pick};box-shadow:${pickShadow}}
${p}-radio:checked+${p}-opt ${p}-opt-ico{border-color:${pick}}
${p}-q-cta,${p}-hl-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:20px;padding:14px 32px;border-radius:${rCtl};background:${btnBg};box-shadow:${btnShadow};color:${btnText};font-size:14px;line-height:20px;font-weight:800;text-transform:${tcase};cursor:pointer}
@supports selector(:has(*)){${p}-quote:not(:has(${p}-radio:checked)) ${p}-q-cta{opacity:.4;cursor:not-allowed;pointer-events:none}}
${p}-q-title{margin-top:12px;font-family:${display};font-size:36px;line-height:.95;font-weight:${displayW};text-transform:${tcase};color:${cardText}}
${p}-q-title span{display:block;color:${cardAccent}}
${p}-res{display:none;margin-top:28px}
${p}-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-radius:${rLg};border:${bw} solid ${line};background:${rowBg}}
${p}-row-l{flex:none;font-size:14px;line-height:20px;letter-spacing:.1em;text-transform:${tcase};color:${rowMuted}}
${p}-row-v{min-width:0;text-align:right;font-family:${display};font-size:20px;line-height:28px;font-weight:${displayW};text-transform:${tcase};color:${rowText};overflow-wrap:break-word}
${p}-row-v span{color:${rowAccent}}
${p}-q-acts{display:flex;gap:12px;margin-top:32px}
${p}-back{display:inline-flex;flex:none;align-items:center;gap:8px;padding:16px 18px;border-radius:${rLg};border:${bw} solid ${line};color:${cardText};font-size:16px;line-height:24px;font-weight:600;cursor:pointer}
${p}-q-book{display:none;flex:1;align-items:center;justify-content:center;gap:8px;min-width:0;padding:16px 20px;border-radius:${rLg};background:${btnBg};box-shadow:${btnShadow};color:${btnText};font-size:16px;line-height:28px;font-weight:800;letter-spacing:.025em;text-transform:${tcase};white-space:nowrap}
${p}-q-call{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;padding:14px 24px;border-radius:${rLg};border:${bw} solid ${line};color:${cardText};font-size:16px;line-height:24px;font-weight:700}
${p}-res${p}-any{display:block}
${p}-q-book${p}-any{display:inline-flex}
${p}-res-set{display:grid;grid-template-columns:minmax(0,1fr)}
@supports selector(:has(*)){
${p}-quote:has(${p}-radio:checked) ${p}-any${p}-any{display:none}
${pk((i) => `${p}-quote:has(#${ns}-pkg-${i}:checked) ${p}-res${p}-pk-${i}`)}{display:block}
${pk((i) => `${p}-quote:has(#${ns}-pkg-${i}:checked) ${p}-q-book${p}-pk-${i}`)}{display:inline-flex}
}
${p}-hlist ${p}-q-h{margin-top:0}
${p}-hl{display:flex;flex-direction:column;gap:10px;margin-top:20px}
${p}-hl>li{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:${rCtl};border:${bw} solid ${line};background:${optBg}}
@container (min-width:640px){
${p}-quote{padding:28px}
${p}-q-h{font-size:30px}
${p}-opt-name{font-size:16px;line-height:20px}
${p}-q-title{font-size:48px}
${p}-back{padding:16px 24px}
${p}-q-book{padding:16px 32px;font-size:18px}
}
${stackFrom ? heroOfferLockCss(ns, { from: stackFrom, scope }) : ''}@media (hover:hover){
${p}-q-book:hover,${p}-hl-cta:hover{filter:brightness(1.1)}
${p}-opt:hover{border-color:${hover}}
${p}-back:hover,${p}-q-call:hover{border-color:${hover}}
}
@media (prefers-reduced-motion:no-preference){
${p}-opt,${p}-q-cta,${p}-hl-cta,${p}-q-book,${p}-back,${p}-q-call{transition:color .15s cubic-bezier(.4,0,.2,1),background-color .15s cubic-bezier(.4,0,.2,1),border-color .15s cubic-bezier(.4,0,.2,1),box-shadow .15s cubic-bezier(.4,0,.2,1),filter .15s cubic-bezier(.4,0,.2,1)}
}
`;
}

// The card's step-height lock on its own: from `from` px of container width
// the card keeps the height of its taller step while it swaps steps, so the
// hero copy beside it does not jump. Only under `scope` (a selector or a
// comma list) when given.
export function heroOfferLockCss(ns, { from, scope = '' } = {}) {
  const p = `.${ns}`;
  const scopes = String(scope || '').split(',').map((x) => x.trim()).filter(Boolean);
  const sc = (sel) => (scopes.length ? scopes.flatMap((x) => sel.split(',').map((y) => `${x} ${y}`)).join(',') : sel);
  const pk = (f) => [0, 1, 2, 3].map(f).join(',');
  return `@container (min-width:${from}px){
@supports selector(:has(*)){
${sc(`${p}-quote`)}{display:grid;grid-template-columns:minmax(0,1fr)}
${sc(`${p}-s1,${p}-s2`)}{grid-row:2;grid-column:1}
${sc(`${p}-quote ${p}-s2`)}{display:block;visibility:hidden}
${sc(`${p}-quote ${p}-go:checked~${p}-s2`)}{visibility:visible}
${sc(`${p}-quote:has(${p}-go:checked) ${p}-s1`)}{display:block;visibility:hidden}
${sc(`${p}-quote ${p}-res-set>${p}-res`)}{display:block;grid-area:1/1;visibility:hidden}
${sc(`${p}-quote:not(:has(${p}-radio:checked)) ${p}-res-set>${p}-any,${pk((i) => `${p}-quote:has(#${ns}-pkg-${i}:checked) ${p}-res-set>${p}-pk-${i}`)}`)}{visibility:inherit}
}
}
`;
}
