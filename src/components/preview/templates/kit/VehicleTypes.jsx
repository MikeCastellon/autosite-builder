// The Vehicle Types band (copy.vehicleTypes, kit/vehicleTypes.js), shared by
// every theme that offers it: a heading, then one card per kind of vehicle
// the business works on, each with an outline icon, the owner's name for it
// and an optional line. Three cards a row on a wide page, two from 601px,
// one below (container queries against the template root); four cards make
// a 2 x 2 block rather than a row of three and a lone fourth.
//
// The band renders its own <section data-section="vehicleTypes">; the theme
// passes its section / wrapper classes and, for a look of its own, its
// heading and editor hints (without them the band prints VT_DEFAULTS'
// heading and VT_HINTS). Every class is `${ns}-<name>` (themes pass
// "<prefix>-vt") and the theme appends vehicleTypesCss(ns) while the band
// renders. Static markup: no hooks, no browser globals, the same in the
// editor preview and in exportHtml's renderToStaticMarkup.
import { LUCIDE } from './icons.jsx';
import { Accented } from './Accented.jsx';
import { vehicleTypesOf, vehicleTypesHeading, VT_HINTS } from './vehicleTypes.js';

// One icon per VT_ICONS name: side views facing right on lucide's 24px grid
// (stroke = currentColor, round caps and joins, like kit/icons.jsx), the
// road vehicles on the same two wheels, so the set reads as one family. The
// car is lucide's own; the others are drawn to match it.
export const VT_ICON_PATHS = {
  car: LUCIDE.car,
  suv: <><path d="M19 17h2a1 1 0 0 0 1-1v-3.4a2 2 0 0 0-1.6-2L17 10l-2.4-4a2 2 0 0 0-1.7-1H4a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1h2" /><path d="M2 10h15" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></>,
  truck: <><path d="M5 17H3a1 1 0 0 1-1-1v-4h10V7a1 1 0 0 1 1-1h3.5l2.8 4 1.9.4a1.2 1.2 0 0 1 .8 1.1V16a1 1 0 0 1-1 1h-2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></>,
  van: <><path d="M5 17H3a1 1 0 0 1-1-1V6.5A1.5 1.5 0 0 1 3.5 5h11.6a1.5 1.5 0 0 1 1.2.6l5.4 6.8a1.5 1.5 0 0 1 .3.9V16a1 1 0 0 1-1 1h-2" /><path d="M11 5v12" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></>,
  boat: <><path d="M2 12h20l-2.7 4.5a2 2 0 0 1-1.7 1H5.2a2 2 0 0 1-1.8-1.1z" /><path d="M6 12V9a1 1 0 0 1 1-1h5.5l3 4" /><path d="M2 21c1.2 0 1.8-.8 3.3-.8s2.1.8 3.3.8 1.8-.8 3.4-.8 2.1.8 3.3.8 1.8-.8 3.3-.8 2.1.8 3.4.8" /></>,
  rv: <><path d="M5 17H3a1 1 0 0 1-1-1V4.5A1.5 1.5 0 0 1 3.5 3h15A1.5 1.5 0 0 1 20 4.5V7a1 1 0 0 1-1 1h-1.6l2.8 3.8 1.1.3a1 1 0 0 1 .7 1V16a1 1 0 0 1-1 1h-2" /><rect x="5" y="6.5" width="5" height="3.5" rx="1" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></>,
  // Engine block between the wheels, seat and tank up to the fork.
  motorcycle: <><circle cx="5" cy="16" r="3" /><circle cx="19" cy="16" r="3" /><path d="m19 16-3.4-8.5h-2.3" /><path d="M5 16h4l1.5-3" /><path d="M3.6 13a1 1 0 0 1 .9-1.5h5l1.7-1.8a2 2 0 0 1 1.4-.6h3.7" /><path d="M10.5 13h3.5l1.8 3H10z" /></>,
  // Two cars: the car in front at 80%, the one behind it up and to the
  // right, drawn only where it shows (roof, front, a wheel).
  fleet: <><path d="M6 10.2c0-.3.1-.7.2-1l1.1-2.3c.2-.4.7-.7 1.1-.7H14c.5 0 1 .2 1.4.6.7.7 1.8 1.8 1.8 1.8s2.2.5 3.6.9c.7.2 1.2.8 1.2 1.5v2.4c0 .4-.3.8-.8.8h-1.6a1.6 1.6 0 0 0-3.1-.55" /><path d="M15.6 18.8h1.6c.48 0 .8-.32.8-.8v-2.4c0-.72-.56-1.36-1.2-1.52C15.36 13.68 13.2 13.2 13.2 13.2s-1.04-1.12-1.76-1.84c-.4-.32-.88-.56-1.44-.56H4.4c-.48 0-.88.32-1.12.72l-1.12 2.32A2.96 2.96 0 0 0 2 14.8V18c0 .48.32.8.8.8h1.6" /><circle cx="6" cy="18.8" r="1.6" /><path d="M7.6 18.8h4.8" /><circle cx="14" cy="18.8" r="1.6" /></>,
};

// A decorative icon (aria-hidden: the card's name says what it is). Unknown
// names draw the car. A theme may change the stroke from its CSS
// (`.xx-vt-icon svg{stroke-width:1.5}`): CSS beats the attribute.
export function VehicleTypeIcon({ name, size = 28, stroke = 1.75, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {VT_ICON_PATHS[name] || VT_ICON_PATHS.car}
    </svg>
  );
}

// The band's own heading (vehicleTypesHeading): eyebrow, <h2> with the
// highlighted words, intro.
function Heading({ ns, h }) {
  return (
    <div className={`${ns}-head`} data-acg-reveal="">
      {h.eyebrow && <p className={`${ns}-eyebrow`}>{h.eyebrow}</p>}
      <h2 id={`${ns}-h`} className={`${ns}-title`}><Accented title={h.title} accent={h.accent} className={`${ns}-em`} /></h2>
      {h.intro && <p className={`${ns}-intro`}>{h.intro}</p>}
    </div>
  );
}

// vehicleTypes / sectionTitles: copy.vehicleTypes and copy.sectionTitles.
// editor: true in the editor preview (useEditorMode in the template), where
// every item shows and an unnamed one is an editor-only card saying what it
// needs. Renders nothing while the band is off, or on the published page
// without a named item; in the editor with none the whole section is
// editor-only, so the Sections tab can say it is not on the page yet.
// heading: the theme's node (eyebrow + <h2>; pass labelledBy with its id);
// left out, the band prints vehicleTypesHeading(vehicleTypes, sectionTitles,
// defaults) itself. hints: the theme's <EditorOnly> hints; left out, the
// band says VT_HINTS.empty while the editor has no item at all. labels:
// replacements for VT_HINTS.
export function VehicleTypesBand({
  ns, vehicleTypes, sectionTitles, defaults, editor = false, order, heading, hints, labels: ownLabels,
  className, wrapClassName, labelledBy, id = 'vehicle-types',
}) {
  const vt = vehicleTypesOf(vehicleTypes, { editor });
  if (!vt || (!editor && vt.items.length === 0)) return null;
  const labels = { ...VT_HINTS, ...ownLabels };
  const ownHeading = heading === undefined;
  const n = vt.items.length;
  return (
    <section
      data-section="vehicleTypes"
      id={id}
      className={className ? `${ns}-band ${className}` : `${ns}-band`}
      aria-labelledby={labelledBy || (ownHeading ? `${ns}-h` : undefined)}
      style={{ order }}
      {...(editor && vt.named === 0 ? { 'data-acg-editor-only': '' } : {})}
    >
      <div className={wrapClassName}>
        {ownHeading ? <Heading ns={ns} h={vehicleTypesHeading(vehicleTypes, sectionTitles, defaults)} /> : heading}
        {n > 0 && (
          // role="list": Safari drops a list's semantics once its bullets are
          // styled away.
          <ul className={`${ns}-grid${n === 4 ? ` ${ns}-n4` : ''}`} role="list">
            {vt.items.map((it, i) => (it.named ? (
              // Cards fade in a row at a time (the stagger follows the
              // three-column position).
              <li key={it.index} className={`${ns}-card`} data-acg-reveal="fade" style={{ '--acg-delay': `${(i % 3) * 90}ms` }}>
                <span className={`${ns}-icon`}><VehicleTypeIcon name={it.icon} /></span>
                <div className={`${ns}-body`}>
                  <h3 className={`${ns}-name`}>{it.name}</h3>
                  {it.desc && <p className={`${ns}-desc`}>{it.desc}</p>}
                </div>
              </li>
            ) : (
              <li key={it.index} className={`${ns}-card ${ns}-todo`} data-acg-editor-only="">
                <span className={`${ns}-icon`}><VehicleTypeIcon name={it.icon} /></span>
                <div className={`${ns}-body`}>
                  <p className={`${ns}-name`}>{labels.noName}</p>
                  {it.desc && <p className={`${ns}-desc`}>{it.desc}</p>}
                </div>
              </li>
            )))}
          </ul>
        )}
        {hints !== undefined ? hints : editor && n === 0 && <p className={`${ns}-hint`} data-acg-editor-only="">{labels.empty}</p>}
      </div>
    </section>
  );
}

// CSS for the band (classes `${ns}-<name>`; the theme styles the section and
// wrapper it passes). Block variables (fallbacks in parentheses):
//   --ns-text / -muted / -accent   title / intro / eyebrow + highlighted
//                                  words, on the section's background
//   --ns-card-bg / -card-text / -card-muted   a card and the text on it
//                                  (-text / -muted when the card keeps the
//                                  page color)
//   --ns-line                      card border
//   --ns-icon-bg / -icon           the icon's tile and its stroke (3:1 on it)
//   --ns-head-font (inherit) / -head-w (800) / -head-case (none)   title
//   --ns-name-w (700) / -name-case (none)   card names (in --ns-head-font)
//   --ns-r (8px) card radius   --ns-icon-r (10px) icon tile radius
// Cards hold no link, so they get no hover state.
export function vehicleTypesCss(ns) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  const head = v('head-font', 'inherit');
  return `
${p}-head{max-width:760px;margin:0 0 clamp(32px,4.5cqi,56px)}
${p}-eyebrow{margin:0 0 14px;font-size:12px;font-weight:700;line-height:1.4;letter-spacing:.2em;text-transform:uppercase;color:${v('accent')}}
${p}-title{margin:0;font-family:${head};font-size:clamp(30px,4.6cqi,52px);font-weight:${v('head-w', '800')};line-height:1.05;letter-spacing:-.01em;text-transform:${v('head-case', 'none')};color:${v('text')};text-wrap:balance;overflow-wrap:break-word}
${p}-em{color:${v('accent')}}
${p}-intro{margin:18px 0 0;max-width:600px;font-size:17px;line-height:1.7;color:${v('muted')};text-wrap:pretty}
${p}-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;margin:0;padding:0;list-style:none}
${p}-card{display:flex;align-items:flex-start;gap:16px;min-width:0;padding:20px;border:1px solid ${v('line')};border-radius:${v('r', '8px')};background:${v('card-bg')};color:${v('card-text', v('text'))}}
${p}-icon{display:flex;flex:none;align-items:center;justify-content:center;width:52px;height:52px;border-radius:${v('icon-r', '10px')};background:${v('icon-bg')};color:${v('icon')}}
${p}-icon svg{width:30px;height:30px}
${p}-body{min-width:0;align-self:center}
${p}-name{margin:0;font-family:${head};font-size:19px;font-weight:${v('name-w', '700')};line-height:1.25;text-transform:${v('name-case', 'none')};overflow-wrap:break-word}
${p}-desc{margin:6px 0 0;font-size:15px;line-height:1.6;color:${v('card-muted', v('muted'))};overflow-wrap:break-word}
${p}-todo{border:1.5px dashed rgba(128,128,128,.55);background:none;color:inherit}
${p}-todo ${p}-name{font-family:inherit;font-size:13px;font-weight:500;line-height:1.45;text-transform:none;opacity:.85}
${p}-hint{display:flex;width:fit-content;max-width:100%;margin:0;padding:10px 14px;border:1.5px dashed rgba(128,128,128,.55);border-radius:6px;font-size:13px;font-weight:500;line-height:1.45;color:inherit;opacity:.85}
@container (min-width:601px){
${p}-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
${p}-card{flex-direction:column;gap:20px;padding:28px}
${p}-body{align-self:stretch}
${p}-icon{width:60px;height:60px}
${p}-icon svg{width:34px;height:34px}
${p}-name{font-size:21px}
}
@container (min-width:960px){
${p}-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
${p}-grid${p}-n4{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;
}
