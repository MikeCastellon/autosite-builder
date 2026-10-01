// Pure helpers behind ServiceDetailsFields (Services tab > Package details):
// the optional per-package keys summary, badge, image and includes, which
// the template reads through kit/content.js serviceIncludes(). Nothing here
// mutates its input: ContentEditor writes the returned service into both
// businessInfo.services and .packages.
//
// includes items are a plain string, or { text, highlight: true } for a line
// this package adds over the one before it. A text ending in ':' is a group
// heading ("Interior:"), which readers never highlight.

export const SUMMARY_MAX = 60;
export const BADGE_MAX = 20;
export const INCLUDES_MAX = 24;

// Older sites store a service as a bare name string.
export function serviceObject(service) {
  if (typeof service === 'string') return { name: service };
  return service && typeof service === 'object' ? service : {};
}

// A new service with `key` set, or without it when the value is empty, so a
// cleared field leaves no '' / [] behind in the saved row.
export function setServiceField(service, key, value) {
  const next = { ...serviceObject(service) };
  const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
  if (empty) delete next[key];
  else next[key] = value;
  return next;
}

export function includeText(item) {
  if (typeof item === 'string') return item;
  return typeof item?.text === 'string' ? item.text : '';
}

export function isHeading(item) {
  return /:\s*$/.test(includeText(item));
}

// The stored flag, whatever the text says right now.
const flagged = (item) => Boolean(item) && typeof item === 'object' && item.highlight === true;

export function isHighlighted(item) {
  return flagged(item) && !isHeading(item);
}

// The item with new text, in the same form. Uses the stored flag rather than
// isHighlighted, so typing a ':' on the way to "Interior: full vacuum" does
// not drop the highlight before the owner has finished the line.
export function withText(item, text) {
  return flagged(item) ? { text, highlight: true } : text;
}

// Heading <-> plain line. A heading is never highlighted, so the flag goes.
export function toggleHeading(item) {
  const text = includeText(item);
  if (isHeading(item)) return text.replace(/\s*:\s*$/, '');
  return `${text.replace(/\s+$/, '')}:`;
}

// Plain <-> highlighted. Headings stay as they are (the button is disabled).
export function toggleHighlight(item) {
  if (isHeading(item)) return item;
  const text = includeText(item);
  return flagged(item) ? text : { text, highlight: true };
}

const filled = (v) => typeof v === 'string' && v.trim() !== '';

// Whether the owner has set any package detail (opens the section).
export function hasDetails(service) {
  const s = serviceObject(service);
  return filled(s.summary) || filled(s.badge) || filled(s.image) || (Array.isArray(s.includes) && s.includes.length > 0);
}

// The image key a package photo uploads under (like products' product<i>).
// The stored URL travels with the service row, so a later reorder or
// removal never points one package at another's photo.
export function photoUploadKey(index) {
  return `service${Number.isInteger(index) && index >= 0 ? index : 0}`;
}

// One package-detail field written into the services list as it is NOW
// (ContentEditor runs this inside a functional businessInfo update). A
// photo upload calls back seconds after the owner picked the file; writing
// the row as it was then would undo every other edit made meanwhile. `at`
// is the row as the owner saw it when the change started ({ name, count }):
// when the list has changed since, the row is found again by its name, and
// when it was removed nothing is written. Returns the next list, or null
// when there is nothing to write.
export function patchServiceList(list, index, key, value, at) {
  const rows = Array.isArray(list) ? list : [];
  let i = index;
  if (at && typeof at === 'object') {
    const name = typeof at.name === 'string' ? at.name : '';
    const same = (p) => (serviceObject(p).name || '') === name;
    if (!(i >= 0 && i < rows.length && same(rows[i]))) {
      const j = name ? rows.findIndex(same) : -1;
      if (j >= 0) i = j;
      // Same length, no row with that name: the row was renamed in place.
      else if (rows.length !== at.count) return null;
    }
  }
  if (!Number.isInteger(i) || i < 0 || i >= rows.length) return null;
  return rows.map((p, idx) => (idx === i ? setServiceField(p, key, value) : p));
}

// A pasted list ("Vacuum\nWindows\n- Tire shine") becomes one row per line,
// so a copied package list does not land in a single row. Bullet marks are
// dropped; a line ending in ':' stays a group heading. The rows replace the
// row pasted into when it is empty, else go in right after it. Returns
// { list, last } (the index of the last new row), or null for single-line
// text, which pastes normally.
const BULLET = /^\s*(?:[-*\u2022\u00b7\u2713\u2714]|\d+[.)])\s+/;
export function pasteIncludes(list, index, text, max = INCLUDES_MAX) {
  const rows = Array.isArray(list) ? list : [];
  if (typeof text !== 'string' || !/[\r\n]/.test(text)) return null;
  const lines = text.split(/\r?\n/).map((l) => l.replace(BULLET, '').trim()).filter(Boolean);
  if (!lines.length) return null;
  const replace = index >= 0 && index < rows.length && includeText(rows[index]).trim() === '';
  const at = replace ? index : Math.min(Math.max(index + 1, 0), rows.length);
  const room = Math.max(0, max - (rows.length - (replace ? 1 : 0)));
  const added = lines.slice(0, room);
  if (!added.length) return null;
  const next = [...rows.slice(0, at), ...added, ...rows.slice(replace ? at + 1 : at)];
  return { list: next, last: at + added.length - 1 };
}

// A new empty row right after `index` (Enter in a row), or null when full.
export function insertIncludeAfter(list, index, max = INCLUDES_MAX) {
  const rows = Array.isArray(list) ? list : [];
  if (rows.length >= max) return null;
  const at = Math.min(Math.max(index + 1, 0), rows.length);
  return [...rows.slice(0, at), '', ...rows.slice(at)];
}
