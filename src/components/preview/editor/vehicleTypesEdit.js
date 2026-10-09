// Pure helpers behind VehicleTypesPanel (Edit > Vehicle Types). The band's
// data (kit/vehicleTypes.js) is copy.vehicleTypes = { title?, intro?,
// items: [{ name, desc?, icon? }] }: on while copy.vehicleTypes is an
// object, and the published page lists an item only once it has a name. An
// item without an icon of its own gets the one its name suggests (Boats ->
// boat), so the tab shows that one as the automatic pick.
import { VT_LIMITS, VT_ICONS, VT_ICON_LABELS, vehicleTypesOf } from '../templates/kit/vehicleTypes.js';
import { bandValue, bandEntries, bandSetText, bandSetField, bandAdd, bandRemove, bandMove } from './bandListEdit.js';

export const VT_TITLE_MAX = VT_LIMITS.title;
export const VT_INTRO_MAX = VT_LIMITS.intro;
export const VT_NAME_MAX = VT_LIMITS.name;
export const VT_DESC_MAX = VT_LIMITS.desc;
export const VT_MAX_ITEMS = VT_LIMITS.items;

const LIST = 'items';
const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
// The kit reads a bare string entry as a name; a write keeps it that way.
const toEntry = (e) => (isObj(e) ? { ...e } : typeof e === 'string' ? { name: e } : {});

// The quick picks: one per icon, named the way a list of vehicle kinds reads
// ("Cars", "SUVs"). The owner picks what they work on: nothing is listed for
// them. Each name leads back to its own icon through vehicleIconFor, so a
// quick pick whose icon is later set to Automatic keeps its drawing.
export const VT_QUICK_NAMES = Object.freeze({
  car: 'Cars', sedan: 'Sedans', coupe: 'Coupes', sports: 'Sports Cars', luxury: 'Luxury Cars', ev: 'EVs',
  convertible: 'Convertibles', classic: 'Classic Cars',
  suv: 'SUVs', truck: 'Trucks', van: 'Vans', boat: 'Boats', rv: 'RVs', motorcycle: 'Motorcycles', fleet: 'Fleet',
});

// copy.vehicleTypes while the band is on, else null.
export const vtValue = (copy) => bandValue(copy, 'vehicleTypes');

// What "Add a Vehicle Types section" saves: the band on, with one empty
// card to fill.
export function vtStart() {
  return { items: [{}] };
}

// The tab's rows: [{ index, name, desc, icon, autoIcon, named }]: name /
// desc as typed, icon the owner's pick ('' = automatic) and autoIcon the
// icon the page draws for it.
export function vtRows(copy) {
  const vt = vtValue(copy);
  if (!vt) return [];
  const shown = vehicleTypesOf(vt, { editor: true }).items;
  return bandEntries(vt, LIST, VT_MAX_ITEMS, toEntry).map((e, i) => ({
    index: i,
    name: typeof e.name === 'string' ? e.name : '',
    desc: typeof e.desc === 'string' ? e.desc : '',
    icon: VT_ICONS.includes(e.icon) ? e.icon : '',
    autoIcon: shown[i]?.icon || 'car',
    named: Boolean(shown[i]?.named),
  }));
}

// The icon picker's choices: [{ id, label }], '' first (automatic).
export function vtIconChoices() {
  return [{ id: '', label: 'Automatic' }, ...VT_ICONS.map((id) => ({ id, label: VT_ICON_LABELS[id] }))];
}

// The quick picks not on the list yet (by icon or by name).
export function vtQuickPicks(copy) {
  const rows = vtRows(copy);
  const names = new Set(rows.map((r) => r.name.trim().toLowerCase()).filter(Boolean));
  const icons = new Set(rows.filter((r) => r.name.trim()).map((r) => r.icon || r.autoIcon));
  return VT_ICONS
    .filter((id) => !icons.has(id) && !names.has(VT_QUICK_NAMES[id].toLowerCase()))
    .map((id) => ({ icon: id, name: VT_QUICK_NAMES[id] }));
}

// copy.vehicleTypes with its heading ('title') or intro ('intro') set.
export const vtSetText = (vt, key, value) => bandSetText(vt, LIST, key, value);
// copy.vehicleTypes with item `index`'s 'name', 'desc' or 'icon' set ('' =
// automatic icon / removed text).
export const vtSetItem = (vt, index, key, value) => bandSetField(vt, LIST, VT_MAX_ITEMS, index, key, value, toEntry);
// One more card (empty, or a quick pick's { name, icon }), or null at eight.
export const vtAddItem = (vt, entry = {}) => bandAdd(vt, LIST, VT_MAX_ITEMS, entry, toEntry);
export const vtRemoveItem = (vt, index) => bandRemove(vt, LIST, VT_MAX_ITEMS, index, toEntry);
export const vtMoveItem = (vt, from, to) => bandMove(vt, LIST, VT_MAX_ITEMS, from, to, toEntry);

// A quick pick fills the first card still without a name (the one
// "Add a section" starts with), else adds a card; null when full.
export function vtAddQuick(vt, icon) {
  if (!VT_ICONS.includes(icon)) return null;
  const entry = { name: VT_QUICK_NAMES[icon], icon };
  const list = bandEntries(vt, LIST, VT_MAX_ITEMS, toEntry);
  const blank = list.findIndex((e) => !(typeof e.name === 'string' && e.name.trim()) && !(typeof e.desc === 'string' && e.desc.trim()));
  if (blank >= 0) {
    list[blank] = { ...list[blank], ...entry };
    return { ...(isObj(vt) ? vt : {}), [LIST]: list };
  }
  return vtAddItem(vt, entry);
}
