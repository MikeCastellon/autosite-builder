// The service tabs (copy.serviceTabs + each service's category,
// kit/serviceTabs.js): the template's own service cards grouped by kind,
// under a row of tabs that shows one group at a time.
//
// CSS only, so the published page (renderToStaticMarkup, no script) works
// exactly like the editor: one visually hidden radio per tab (name
// `${ns}-tab`, ids `${ns}-t<i>`, `${ns}-all`), then the tab bar of
// <label for>s, then the panels, siblings in that order, so
// `#<radio>:checked ~ .<ns>-panels > .<ns>-p<i>` shows the picked group and
// `#<radio>:checked ~ .<ns>-bar > .<ns>-tab-<i>` marks its tab. The radios
// are the keyboard model: Tab reaches the group's checked radio, the arrow
// keys move between them (and pick), and a focused radio rings its tab. The
// first group (or "All") is checked in the markup, so the page opens on it.
//
// The template keeps its own cards: <ServiceTabs> renders the radios, the
// bar and one panel per group, and calls its children (a function) with
// each group to fill that panel. A template that needs its own wrapper
// renders <ServiceTabsBar> and <ServiceTabsPanels> itself, in that order
// inside one parent (the radios come with the bar; the parent carries
// `${ns}-tabs` for the no-radio-checked fallback). Every class and id is
// `${ns}-<name>` (themes pass "<prefix>-st"); the theme appends
// serviceTabsCss(ns) while the tabs render. No hooks, no browser globals.
import { SERVICE_TABS_MAX_GROUPS } from './serviceTabs.js';

export const SERVICE_TABS_LABELS = {
  all: 'All',
  other: 'Other',
  group: 'Services by category',
};

const labelsOf = (labels) => ({ ...SERVICE_TABS_LABELS, ...(labels && typeof labels === 'object' ? labels : {}) });
// The tab's text: the owner's category, or the "Other" label for the
// services without one.
export const serviceTabLabel = (group, labels) => (group.other ? labelsOf(labels).other : group.label);
const keyOf = (g) => (g.other ? '+other' : g.key);

// tabs: serviceTabsOf() output (nothing renders for null).
export function ServiceTabsBar({ ns, tabs, labels }) {
  if (!tabs) return null;
  const L = labelsOf(labels);
  const name = `${ns}-tab`;
  return (
    <>
      {tabs.all && (
        <input type="radio" name={name} id={`${ns}-all`} className={`${ns}-sr ${ns}-radio`} defaultChecked aria-controls={tabs.groups.map((g) => `${ns}-p${g.index}`).join(' ')} />
      )}
      {tabs.groups.map((g) => (
        <input key={keyOf(g)} type="radio" name={name} id={`${ns}-t${g.index}`} className={`${ns}-sr ${ns}-radio`} defaultChecked={!tabs.all && g.index === 0} aria-controls={`${ns}-p${g.index}`} />
      ))}
      <div className={`${ns}-bar`}>
        {tabs.all && <label htmlFor={`${ns}-all`} className={`${ns}-tab ${ns}-tab-all`}>{L.all}</label>}
        {tabs.groups.map((g) => (
          <label key={keyOf(g)} htmlFor={`${ns}-t${g.index}`} id={`${ns}-l${g.index}`} className={`${ns}-tab ${ns}-tab-${g.index}`}>{serviceTabLabel(g, L)}</label>
        ))}
      </div>
    </>
  );
}

// One panel per group, labelled by its tab. children(group) fills it (the
// template's cards for group.items, each { service, index }); the group's
// name heads the panel only while "All" shows every panel (aria-hidden: the
// panel's label already says it).
export function ServiceTabsPanels({ ns, tabs, labels, children }) {
  if (!tabs) return null;
  const L = labelsOf(labels);
  return (
    <div className={`${ns}-panels`}>
      {tabs.groups.map((g) => (
        <div key={keyOf(g)} id={`${ns}-p${g.index}`} className={`${ns}-panel ${ns}-p${g.index}`} role="group" aria-labelledby={`${ns}-l${g.index}`}>
          <p className={`${ns}-panel-h`} aria-hidden="true">{serviceTabLabel(g, L)}</p>
          {typeof children === 'function' ? children(g) : null}
        </div>
      ))}
    </div>
  );
}

// The whole block. Keyed by the tabs' signature: when the owner changes the
// categories in the editor the radios mount afresh and the first tab is
// picked again (a radio kept from before could point at a group that is
// gone). labels: { all, other, group } over SERVICE_TABS_LABELS (group
// names the block for screen readers; '' leaves it unnamed).
export function ServiceTabs({ ns, tabs, className, labels, children }) {
  if (!tabs) return null;
  const L = labelsOf(labels);
  return (
    <div key={tabs.signature} className={className ? `${ns}-tabs ${className}` : `${ns}-tabs`} role="group" aria-label={L.group || undefined}>
      <ServiceTabsBar ns={ns} tabs={tabs} labels={L} />
      <ServiceTabsPanels ns={ns} tabs={tabs} labels={L}>{children}</ServiceTabsPanels>
    </div>
  );
}

// CSS for the tabs (classes and ids `${ns}-<name>`; the theme styles the
// cards inside the panels). One rule per possible tab, so it stays the same
// for every site (SERVICE_TABS_MAX_GROUPS tabs plus "All"). Block variables
// (fallbacks in parentheses):
//   --ns-text / -muted / -line          tab ink / panel heading / tab border
//   --ns-pick-bg / -pick-text           the picked tab's fill and ink (required)
//   --ns-pick-line (pick-bg) / -pick-shadow (none)   its border and shadow
//   --ns-tab-bg (transparent)           an unpicked tab's fill
//   --ns-focus                          the ring of a keyboard-focused tab
//   --ns-font (inherit) / -head (inherit) / -case (none)   tab font, panel
//   heading font, tab letter case
//   --ns-tab-r (999px) tab radius   --ns-gap (clamp(28px,4cqi,44px)) bar to panel
// The radios stay focusable (clipped, never display:none). Panels without a
// picked radio are hidden; where :has() works, a block with no radio checked
// at all (a browser that restored none) shows every panel instead.
export function serviceTabsCss(ns) {
  const p = `.${ns}`;
  const v = (name, fb) => (fb === undefined ? `var(--${ns}-${name})` : `var(--${ns}-${name},${fb})`);
  const idx = Array.from({ length: SERVICE_TABS_MAX_GROUPS }, (_, i) => i);
  const each = (f) => idx.map(f).join(',');
  const all = `#${ns}-all`;
  return `
${p}-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
${p}-tabs{position:relative}
${p}-bar{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 ${v('gap', 'clamp(28px,4cqi,44px)')}}
${p}-tab{display:inline-flex;align-items:center;justify-content:center;min-height:44px;max-width:100%;padding:10px 18px;border:1px solid ${v('line')};border-radius:${v('tab-r', '999px')};background:${v('tab-bg', 'transparent')};color:${v('text')};font-family:${v('font', 'inherit')};font-size:13.5px;font-weight:700;line-height:1.2;letter-spacing:.04em;text-align:center;text-transform:${v('case', 'none')};overflow-wrap:anywhere;cursor:pointer;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
${each((i) => `#${ns}-t${i}:checked~${p}-bar>${p}-tab-${i}`)},${all}:checked~${p}-bar>${p}-tab-all{border-color:${v('pick-line', v('pick-bg'))};background:${v('pick-bg')};color:${v('pick-text')};box-shadow:${v('pick-shadow', 'none')}}
${each((i) => `#${ns}-t${i}:focus-visible~${p}-bar>${p}-tab-${i}`)},${all}:focus-visible~${p}-bar>${p}-tab-all{outline:2px solid ${v('focus')};outline-offset:3px;clip-path:none}
${p}-panel{display:none}
${each((i) => `#${ns}-t${i}:checked~${p}-panels>${p}-p${i}`)},${all}:checked~${p}-panels>${p}-panel{display:block}
${p}-panel-h{display:none;margin:0 0 18px;font-family:${v('head', 'inherit')};font-size:13px;font-weight:700;line-height:1.4;letter-spacing:.18em;text-transform:uppercase;color:${v('muted')}}
${all}:checked~${p}-panels ${p}-panel-h{display:block}
${all}:checked~${p}-panels>${p}-panel+${p}-panel{margin-top:clamp(40px,5cqi,64px)}
@supports selector(:has(*)){
${p}-tabs:not(:has(>${p}-radio:checked))>${p}-panels>${p}-panel{display:block}
${p}-tabs:not(:has(>${p}-radio:checked))>${p}-panels ${p}-panel-h{display:block}
${p}-tabs:not(:has(>${p}-radio:checked))>${p}-panels>${p}-panel+${p}-panel{margin-top:clamp(40px,5cqi,64px)}
}
@container (min-width:601px){
${p}-bar{gap:12px}
${p}-tab{padding:12px 24px;font-size:14px}
}
@media (hover:hover){
${p}-tab:hover{border-color:${v('text')}}
}
@media (prefers-reduced-motion:no-preference){
${p}-tab{transition:background-color .2s,border-color .2s,color .2s,box-shadow .2s}
${p}-panel{animation:${ns}-in .35s cubic-bezier(.2,.7,.2,1) both}
@keyframes ${ns}-in{from{opacity:0;translate:0 10px}}
}
`;
}
