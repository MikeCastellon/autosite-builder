// Pure helpers behind BeforeAfterPanel (Edit > Before & After). The band's
// data (kit/beforeAfter.js) is copy.beforeAfter = { title?, intro?,
// pairs: [{ caption? }] } plus the photos images.baBefore<i> /
// images.baAfter<i>. The tab lists the pairs the kit counts
// (beforeAfterCount), so it shows exactly the pairs the page knows about,
// a photo without a pairs entry included. Text is kept as typed (the
// template trims); a pair's entry is written out to its index first, so a
// caption always lands on its own pair. Removing or moving a pair moves
// its photos with it: a caption never ends up under another pair's photos.
// Limits match the custom-site run (customSiteDesign.js).
import { BA_MAX_PAIRS, BA_IMAGE_KEY, baBeforeKey, baAfterKey, beforeAfterCount } from '../templates/kit/beforeAfter.js';

export const BA_TITLE_MAX = 80;
export const BA_INTRO_MAX = 200;
export const BA_CAPTION_MAX = 80;

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const hasPhoto = (v) => typeof v === 'string' && v.trim() !== '';
// fields.jsx's list helpers, here without React (this module stays pure).
const removeAt = (list, index) => list.filter((_, i) => i !== index);
function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

// copy.beforeAfter while the band is on (an object), else null.
export function baValue(copy) {
  return isObj(copy?.beforeAfter) ? copy.beforeAfter : null;
}

// What "Add a Before & After section" saves: the band on, with one empty
// pair to fill.
export function baStart() {
  return { pairs: [{}] };
}

// The pairs entries, one per pair the kit counts (missing or odd entries
// become {}).
function pairsOf(ba, images) {
  const own = isObj(ba) && Array.isArray(ba.pairs) ? ba.pairs : [];
  return Array.from({ length: beforeAfterCount(ba, images) }, (_, i) => (isObj(own[i]) ? { ...own[i] } : {}));
}

// The tab's rows: [{ index, caption, complete }], one per pair.
export function baRows(copy, images) {
  const ba = baValue(copy);
  if (!ba) return [];
  const imgs = isObj(images) ? images : {};
  return pairsOf(ba, imgs).map((p, i) => ({
    index: i,
    caption: typeof p.caption === 'string' ? p.caption : '',
    complete: hasPhoto(imgs[baBeforeKey(i)]) && hasPhoto(imgs[baAfterKey(i)]),
  }));
}

// copy.beforeAfter with its heading ('title') or intro ('intro') set; ''
// removes the field. The band stays on.
export function baSetText(ba, key, value) {
  const next = { ...(isObj(ba) ? ba : {}) };
  if (typeof value === 'string' && value !== '') next[key] = value;
  else delete next[key];
  if (!Array.isArray(next.pairs)) next.pairs = [];
  return next;
}

// copy.beforeAfter with pair `index`'s caption set ('' removes it).
export function baSetCaption(ba, images, index, caption) {
  const pairs = pairsOf(ba, images);
  while (pairs.length <= index && pairs.length < BA_MAX_PAIRS) pairs.push({});
  if (!pairs[index]) return ba;
  if (typeof caption === 'string' && caption !== '') pairs[index].caption = caption;
  else delete pairs[index].caption;
  return { ...(isObj(ba) ? ba : {}), pairs };
}

// copy.beforeAfter with one more (empty) pair, or null when it holds
// BA_MAX_PAIRS already.
export function baAddPair(ba, images) {
  const pairs = pairsOf(ba, images);
  if (pairs.length >= BA_MAX_PAIRS) return null;
  return { ...(isObj(ba) ? ba : {}), pairs: [...pairs, {}] };
}

// copy.beforeAfter without pair `index` (the later ones move up); pair it
// with baRemoveImages for the photos.
export function baRemovePair(ba, images, index) {
  return { ...(isObj(ba) ? ba : {}), pairs: removeAt(pairsOf(ba, images), index) };
}

// copy.beforeAfter with pair `from` moved to `to`; pair it with
// baMoveImages for the photos.
export function baMovePair(ba, images, from, to) {
  return { ...(isObj(ba) ? ba : {}), pairs: moveItem(pairsOf(ba, images), from, to) };
}

// The images map with the band's photos rearranged: slot `to` gets the
// photos slot order[to] had. Every other key stays as it is; an empty slot
// has no key.
function remapPhotos(images, order) {
  const imgs = isObj(images) ? images : {};
  const out = {};
  for (const [k, v] of Object.entries(imgs)) if (!BA_IMAGE_KEY.test(k)) out[k] = v;
  order.forEach((from, to) => {
    for (const key of [baBeforeKey, baAfterKey]) {
      if (hasPhoto(imgs[key(from)])) out[key(to)] = imgs[key(from)];
    }
  });
  return out;
}

const SLOTS = Array.from({ length: BA_MAX_PAIRS }, (_, i) => i);

// The photos once pair `index` is removed: the later pairs move up a slot.
export function baRemoveImages(images, index) {
  return remapPhotos(images, removeAt(SLOTS, index));
}

// The photos once pair `from` moves to `to`.
export function baMoveImages(images, from, to) {
  return remapPhotos(images, moveItem(SLOTS, from, to));
}

// The images map without any of the band's photos (the section removed).
export function baWithoutImages(images) {
  return remapPhotos(images, []);
}
