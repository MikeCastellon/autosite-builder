// Pure helpers behind ShowcasePanel (Edit > Detail Showcase). The band's
// data (kit/showcase.js) is copy.showcase = { title?, intro?, items:
// [{ title, caption? }] } plus the photos images.showcase<i>: on while
// copy.showcase is an object, and the published page shows an item only
// once it has a title and a photo. The tab lists the items the kit counts
// (showcaseCount: an entry, or a photo in a later slot), so it shows exactly
// the cards the page knows about. An item's entry is written out to its
// index first, so a title always lands on its own photo, and removing or
// moving an item moves its photo with it (as Before & After's pairs do).
import {
  SHOWCASE_MAX_ITEMS, SHOWCASE_LIMITS, SHOWCASE_IMAGE_KEY, showcaseKey, showcaseCount, showcaseItems,
} from '../templates/kit/showcase.js';

export const SC_TITLE_MAX = SHOWCASE_LIMITS.title;
export const SC_INTRO_MAX = SHOWCASE_LIMITS.intro;
export const SC_ITEM_TITLE_MAX = SHOWCASE_LIMITS.itemTitle;
export const SC_CAPTION_MAX = SHOWCASE_LIMITS.caption;
export const SC_MAX_ITEMS = SHOWCASE_MAX_ITEMS;

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const hasPhoto = (v) => typeof v === 'string' && v.trim() !== '';
// The kit reads a bare string (or number) entry as the item's title.
const entryOf = (v) => (isObj(v) ? { ...v } : typeof v === 'string' || typeof v === 'number' ? { title: String(v) } : {});
const removeAt = (list, index) => list.filter((_, i) => i !== index);
function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

// copy.showcase while the band is on (an object), else null.
export function scValue(copy) {
  return isObj(copy?.showcase) ? copy.showcase : null;
}

// What "Add a Detail Showcase section" saves: the band on, with one item to
// fill.
export function scStart() {
  return { items: [{}] };
}

// The items entries, one per item the kit counts.
function itemsOf(sc, images) {
  const own = isObj(sc) && Array.isArray(sc.items) ? sc.items : [];
  return Array.from({ length: showcaseCount(sc, images) }, (_, i) => entryOf(own[i]));
}

// The tab's rows: [{ index, title, caption, photo, complete }], title /
// caption as typed, complete as the page reads it.
export function scRows(copy, images) {
  const sc = scValue(copy);
  if (!sc) return [];
  const imgs = isObj(images) ? images : {};
  const shown = showcaseItems(sc, imgs, { editor: true }).items;
  return itemsOf(sc, imgs).map((e, i) => ({
    index: i,
    title: typeof e.title === 'string' ? e.title : '',
    caption: typeof e.caption === 'string' ? e.caption : '',
    photo: hasPhoto(imgs[showcaseKey(i)]),
    complete: Boolean(shown[i]?.complete),
  }));
}

// copy.showcase with its heading ('title') or intro ('intro') set; ''
// removes it. The band stays on.
export function scSetText(sc, key, value) {
  const next = { ...(isObj(sc) ? sc : {}) };
  if (typeof value === 'string' && value !== '') next[key] = value;
  else delete next[key];
  if (!Array.isArray(next.items)) next.items = [];
  return next;
}

// copy.showcase with item `index`'s 'title' or 'caption' set ('' removes
// it), the entries padded out to it.
export function scSetItem(sc, images, index, key, value) {
  const items = itemsOf(sc, images);
  while (items.length <= index && items.length < SC_MAX_ITEMS) items.push({});
  if (!items[index]) return sc;
  if (typeof value === 'string' && value !== '') items[index][key] = value;
  else delete items[index][key];
  return { ...(isObj(sc) ? sc : {}), items };
}

// copy.showcase with one more (empty) item, or null when it holds six.
export function scAddItem(sc, images) {
  const items = itemsOf(sc, images);
  if (items.length >= SC_MAX_ITEMS) return null;
  return { ...(isObj(sc) ? sc : {}), items: [...items, {}] };
}

// copy.showcase without item `index`; pair it with scRemoveImages.
export function scRemoveItem(sc, images, index) {
  return { ...(isObj(sc) ? sc : {}), items: removeAt(itemsOf(sc, images), index) };
}

// copy.showcase with item `from` moved to `to`; pair it with scMoveImages.
export function scMoveItem(sc, images, from, to) {
  return { ...(isObj(sc) ? sc : {}), items: moveItem(itemsOf(sc, images), from, to) };
}

// The images map with the band's photos rearranged: slot `to` gets the
// photo slot order[to] had. Every other key stays; an empty slot has no key.
function remapPhotos(images, order) {
  const imgs = isObj(images) ? images : {};
  const out = {};
  for (const [k, v] of Object.entries(imgs)) if (!SHOWCASE_IMAGE_KEY.test(k)) out[k] = v;
  order.forEach((from, to) => {
    if (hasPhoto(imgs[showcaseKey(from)])) out[showcaseKey(to)] = imgs[showcaseKey(from)];
  });
  return out;
}

const SLOTS = Array.from({ length: SC_MAX_ITEMS }, (_, i) => i);

// The photos once item `index` is removed: the later items move up a slot.
export function scRemoveImages(images, index) {
  return remapPhotos(images, removeAt(SLOTS, index));
}

// The photos once item `from` moves to `to`.
export function scMoveImages(images, from, to) {
  return remapPhotos(images, moveItem(SLOTS, from, to));
}

// The images map without any of the band's photos (the section removed).
export function scWithoutImages(images) {
  return remapPhotos(images, []);
}
