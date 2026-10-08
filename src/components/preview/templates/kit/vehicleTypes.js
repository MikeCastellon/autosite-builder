// Pure logic behind the Vehicle Types band (kit/VehicleTypes.jsx): which
// kinds of vehicle a page lists, with which icon, under which heading. No
// React and no browser globals; tolerates whatever a saved row holds
// (missing keys, wrong types).
//
// The data, written by the editor's Vehicle Types tab or a site run:
//   copy.vehicleTypes = { title?, intro?, items: [{ name, desc?, icon? }] }
// The object being there switches the band on: a site without it renders
// exactly as before (themes with live sites stay byte-identical). An item
// is an entry of items below VT_LIMITS.items, so the editor and the page
// agree on which eight count. The published page lists only items with a
// name, and shows the band only when there is at least one; the editor
// shows every item, so an unnamed one can say what it still needs. Every
// word on a card is the owner's: the design only supplies the heading
// (VT_DEFAULTS) and an icon.

import { sectionTitle } from './content.js';

// What the editor's fields allow. The page clips anything longer (a row
// written before the limits, or by a generator), so a pasted paragraph can
// never stretch a card.
export const VT_LIMITS = Object.freeze({ title: 80, intro: 200, name: 40, desc: 140, items: 8 });

// The section id (copy.sectionOrder / copy.hiddenSections, data-section).
export const VT_SECTION = 'vehicleTypes';

// The Edit panel tab every hint names, also the Sections list label
// (editorCapabilities.js EDITOR_TABS must hold a tab with exactly this
// label).
export const VT_TAB = 'Vehicle Types';

// The design's own heading while the owner typed none. No claims: the
// owner's list makes the point.
export const VT_DEFAULTS = Object.freeze({ eyebrow: 'Vehicles We Work On', title: 'Every Kind of Ride' });

// Editor-only hints: the empty band, and an item that will not publish yet.
export const VT_HINTS = Object.freeze({
  empty: `Add the kinds of vehicles you work on in Edit > ${VT_TAB}.`,
  noName: `Name this vehicle in Edit > ${VT_TAB}. Until then this card stays off your site.`,
});

// The icons an item may pick (kit/VehicleTypes.jsx draws them), in the
// order an icon picker offers them, with the words it can label them by.
export const VT_ICONS = Object.freeze(['car', 'suv', 'truck', 'van', 'boat', 'rv', 'motorcycle', 'fleet']);
export const VT_ICON_LABELS = Object.freeze({
  car: 'Car', suv: 'SUV', truck: 'Truck', van: 'Van', boat: 'Boat', rv: 'RV', motorcycle: 'Motorcycle', fleet: 'Fleet',
});

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const raw = (v) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
// Every field is one line: any run of whitespace (a pasted line break
// included) is one space.
const oneLine = (v) => raw(v).replace(/\s+/g, ' ').trim();

// `text` cut to at most `max` characters (code points, so an emoji is never
// split): at the last word break when that keeps most of the text, never
// ending on a space or a dangling comma, and closed with "…". Text within
// the limit comes back unchanged. (The FAQ band clips the same way.)
function clip(text, max) {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  let cut = chars.slice(0, max - 1).join('');
  const space = cut.search(/\s\S*$/);
  if (space >= cut.length * 0.6) cut = cut.slice(0, space);
  return `${cut.replace(/[\s.,;:!?…-]+$/u, '')}…`;
}
const field = (v, max) => clip(oneLine(v), max);

// An item without one of VT_ICONS gets the icon its name suggests ("Boats"
// -> boat), else the car. First match wins, so "Fleet vans" is the fleet
// and "Trucks & SUVs" the truck.
const ICON_WORDS = [
  ['fleet', /\b(fleets?|commercial|company|business)\b/i],
  ['boat', /\b(boats?|yachts?|marine|pontoons?|jet ?skis?|watercraft|vessels?)\b/i],
  ['rv', /\b(rvs?|motor ?homes?|campers?|caravans?|trailers?|coaches)\b/i],
  ['motorcycle', /\b(motorcycles?|motorbikes?|bikes?|scooters?)\b/i],
  ['truck', /\b(trucks?|pick-?ups?)\b/i],
  ['van', /\b(vans?|minivans?|sprinters?)\b/i],
  ['suv', /\b(suvs?|crossovers?|4x4s?|jeeps?)\b/i],
];
export function vehicleIconFor(name) {
  const n = oneLine(name);
  const hit = n ? ICON_WORDS.find(([, re]) => re.test(n)) : null;
  return hit ? hit[0] : 'car';
}

// The band's content, or null while copy.vehicleTypes is not an object (the
// band is off). -> { title, intro, items, named }
//   title / intro  the owner's text, one line, clipped ('' = the design's own)
//   items          [{ index, name, desc, icon, named }]: named items only on
//                  the published page, every item in the editor; index is
//                  the entry's place in copy.vehicleTypes.items. A plain
//                  string entry is a name.
//   named          how many items have a name (what the page lists)
export function vehicleTypesOf(vehicleTypes, { editor = false } = {}) {
  if (!isObj(vehicleTypes)) return null;
  const own = Array.isArray(vehicleTypes.items) ? vehicleTypes.items.slice(0, VT_LIMITS.items) : [];
  const all = own.map((entry, index) => {
    const e = isObj(entry) ? entry : typeof entry === 'string' ? { name: entry } : {};
    const name = field(e.name, VT_LIMITS.name);
    const icon = VT_ICONS.includes(e.icon) ? e.icon : vehicleIconFor(name);
    return { index, name, desc: field(e.desc, VT_LIMITS.desc), icon, named: Boolean(name) };
  });
  const named = all.filter((it) => it.named);
  return {
    title: field(vehicleTypes.title, VT_LIMITS.title),
    intro: field(vehicleTypes.intro, VT_LIMITS.intro),
    items: editor ? all : named,
    named: named.length,
  };
}

// The heading the band prints: the owner's title / intro (copy.vehicleTypes,
// which Edit > Headings edits too when a theme's headingFields says
// titleFrom 'vehicleTypes.title'), else copy.sectionTitles.vehicleTypes,
// else the design's own (VT_DEFAULTS, merged with the theme's `defaults`;
// '' there leaves a part out). Eyebrow and highlighted words come from
// copy.sectionTitles.vehicleTypes only. -> { eyebrow, title, accent, intro }
export function vehicleTypesHeading(vehicleTypes, sectionTitles, defaults) {
  const own = vehicleTypesOf(vehicleTypes) || { title: '', intro: '' };
  const st = sectionTitle(sectionTitles, VT_SECTION);
  const d = { ...VT_DEFAULTS, ...(isObj(defaults) ? defaults : {}) };
  return {
    eyebrow: st.eyebrow || oneLine(d.eyebrow),
    title: own.title || field(st.title, VT_LIMITS.title) || oneLine(d.title),
    accent: st.accent || oneLine(d.accent),
    intro: own.intro || field(st.intro, VT_LIMITS.intro) || oneLine(d.intro),
  };
}
