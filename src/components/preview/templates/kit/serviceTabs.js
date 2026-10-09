// Pure logic behind the service tabs (kit/ServiceTabs.jsx): a template's
// services grouped by kind ("Cars", "Boats", "RVs", "Pressure Washing"),
// one tab per group. No React and no browser globals; tolerates whatever a
// saved row holds (missing keys, wrong types).
//
// The data:
//   services[i].category   optional, one line, at most 30 characters, on the
//     owner's service objects (Edit > Services: businessInfo.services, which
//     normalizeBusinessInfo also mirrors to businessInfo.packages, category
//     included). A service saved as a plain string ("Hand Wax") has none.
//   copy.serviceTabs = { enabled: true, all?: true }   the switch (opt-in);
//     all adds an "All" tab, first and picked when the page opens.
// Tabs show only while the switch is on and the services name at least two
// categories; otherwise serviceTabsOf returns null and the template renders
// its services exactly as before (themes with live sites stay
// byte-identical). Services without a category then share a last "Other"
// tab: every service the owner listed stays on the page.

// Tabs a row can hold (the CSS has a rule per tab, so it is fixed): the
// owner's categories plus "Other". More, and the services show untabbed.
export const SERVICE_TABS_MAX_GROUPS = 8;
// Characters a category prints at most (the editor's field stops there).
export const SERVICE_CATEGORY_MAX = 30;

// What the editor can tell the owner when the switch is on but no tabs show
// (serviceTabsStatus 'few' / 'many'); editor-only text.
export const SERVICE_TABS_HINTS = {
  few: 'Tabs need at least two categories: give your services a Category in Edit > Services.',
  many: `Tabs fit up to ${SERVICE_TABS_MAX_GROUPS} groups (services without a category count as one): use fewer categories in Edit > Services.`,
};

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
// One line of text: control characters and line breaks become spaces,
// runs of spaces one.
const line = (v) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
  .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// `v` on one line, cut to `max` characters at a word (when one ends in the
// second half), without trailing punctuation; no ellipsis.
function clip(v, max) {
  const s = line(v);
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return (at >= max / 2 ? cut.slice(0, at) : s.slice(0, max)).replace(/[\s,;:–—-]+$/, '');
}

// A service's category as the tab prints it, '' for none (a string service,
// a missing or non-text category).
export function serviceCategoryOf(service) {
  return isObj(service) ? clip(service.category, SERVICE_CATEGORY_MAX) : '';
}

// Categories compared loosely: case, spaces and punctuation ignored, so
// "RVs", "rv's" and "RVs " share a tab. Letters of any script count.
export const categoryKey = (label) => line(label).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// The switch: copy.serviceTabs must be an object with enabled === true.
export function serviceTabsWanted(serviceTabs) {
  return isObj(serviceTabs) && serviceTabs.enabled === true;
}

// The services grouped by category: one group per category, in the order
// each first appears (the owner orders them by ordering the services), its
// label as first written; then the services without one (other: true,
// label ''). Every service lands in exactly one group, as { service, index }:
// the template's own item, untouched, and its place in `services`, so card
// ids and numbers stay what they were. -> { groups, categories } where
// categories counts the named groups.
export function serviceGroups(services) {
  const named = new Map();
  const other = [];
  (Array.isArray(services) ? services : []).forEach((service, index) => {
    const label = serviceCategoryOf(service);
    const key = categoryKey(label);
    if (!key) {
      other.push({ service, index });
      return;
    }
    if (!named.has(key)) named.set(key, { key, label, other: false, items: [] });
    named.get(key).items.push({ service, index });
  });
  const groups = [...named.values()];
  if (other.length) groups.push({ key: '', label: '', other: true, items: other });
  return { groups, categories: named.size };
}

function plan(services, serviceTabs) {
  if (!serviceTabsWanted(serviceTabs)) return { status: 'off', groups: [] };
  const { groups, categories } = serviceGroups(services);
  if (categories < 2) return { status: 'few', groups };
  if (groups.length > SERVICE_TABS_MAX_GROUPS) return { status: 'many', groups };
  return { status: 'on', groups };
}

// Why the tabs show or not: 'off' (the switch is off), 'few' (on, fewer than
// two categories), 'many' (on, more than SERVICE_TABS_MAX_GROUPS groups),
// 'on'. The editor's hint for 'few' / 'many' is SERVICE_TABS_HINTS.
export function serviceTabsStatus(services, serviceTabs) {
  return plan(services, serviceTabs).status;
}

// The tabs to render, or null (the template renders its services as
// before). -> { groups: [{ index, key, label, other, items: [{ service,
// index }] }], all, signature }
//   index      the tab's place (radio `${ns}-t<index>`, panel `${ns}-p<index>`)
//   all        an "All" tab comes first and is picked when the page opens
//              (else the first group is)
//   signature  changes whenever the tabs do: ServiceTabs keys its markup on
//              it, so the editor picks the first tab again after an edit
export function serviceTabsOf(services, serviceTabs) {
  const { status, groups } = plan(services, serviceTabs);
  if (status !== 'on') return null;
  const all = serviceTabs.all === true;
  return {
    groups: groups.map((g, index) => ({ index, ...g })),
    all,
    signature: [...(all ? ['+all'] : []), ...groups.map((g) => (g.other ? '+other' : g.key))].join('|'),
  };
}
