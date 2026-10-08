// Pure helpers shared by the editor tabs of the kit's list bands (FAQ,
// Vehicle Types, Comparison and Detail Showcase; faqEdit.js & co. build on
// them). Each band lives on one copy key holding
//   { title?, intro?, ...labels, <list>: [entries] }
// and is on while that key is an object (kit/faq.js & co.). The helpers
// never mutate their input. Text is kept as typed: the kit trims and clips
// on the page, and trimming here would eat the space the owner just typed.
// An emptied field is removed, so the saved row only holds what the owner
// typed. Only the first `max` entries count, as on the page (FAQ_LIMITS
// .items & co.), so a write keeps exactly those and the tab never lists an
// entry the page ignores. `toEntry` turns a saved entry into an object (a
// band may accept a bare string as a name or title; anything else odd
// becomes {}).

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const plain = (v) => (isObj(v) ? { ...v } : {});

// fields.jsx's list helpers, here without React (this module stays pure).
function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

// copy[key] while the band is on (an object), else null.
export function bandValue(copy, key) {
  return isObj(copy?.[key]) ? copy[key] : null;
}

// The entries that count, as fresh objects.
export function bandEntries(band, listKey, max, toEntry = plain) {
  const own = isObj(band) && Array.isArray(band[listKey]) ? band[listKey] : [];
  return own.slice(0, max).map((e) => toEntry(e));
}

// A field is removed when emptied ('' / null / undefined); false and 0 are
// values (a comparison cell's "No").
const isEmpty = (v) => v === undefined || v === null || v === '';
function setField(obj, field, value) {
  const next = { ...obj };
  if (isEmpty(value)) delete next[field];
  else next[field] = value;
  return next;
}

// The band with one of its own text fields set (title, intro, a column
// label); '' removes it. The band stays on, with its list in place.
export function bandSetText(band, listKey, key, value) {
  const next = setField(isObj(band) ? band : {}, key, typeof value === 'string' ? value : '');
  if (!Array.isArray(next[listKey])) next[listKey] = [];
  return next;
}

// The band with entry `index`'s `field` set (an empty value removes it).
// An index past the list returns the band unchanged.
export function bandSetField(band, listKey, max, index, field, value, toEntry = plain) {
  const list = bandEntries(band, listKey, max, toEntry);
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return band;
  list[index] = setField(list[index], field, value);
  return { ...(isObj(band) ? band : {}), [listKey]: list };
}

// The band with one more entry (default {}), or null once it holds `max`.
export function bandAdd(band, listKey, max, entry = {}, toEntry = plain) {
  const list = bandEntries(band, listKey, max, toEntry);
  if (list.length >= max) return null;
  return { ...(isObj(band) ? band : {}), [listKey]: [...list, plain(entry)] };
}

// The band without entry `index` (the later ones move up).
export function bandRemove(band, listKey, max, index, toEntry = plain) {
  const list = bandEntries(band, listKey, max, toEntry);
  return { ...(isObj(band) ? band : {}), [listKey]: list.filter((_, i) => i !== index) };
}

// The band with entry `from` moved to `to` (out of range: the same list).
export function bandMove(band, listKey, max, from, to, toEntry = plain) {
  const list = bandEntries(band, listKey, max, toEntry);
  return { ...(isObj(band) ? band : {}), [listKey]: moveItem(list, from, to) };
}
