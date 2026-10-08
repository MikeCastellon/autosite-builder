// Pure logic behind the Before & After band (kit/BeforeAfter.jsx): which
// photo pairs a page shows. No React and no browser globals; tolerates
// whatever a saved row holds (missing keys, wrong types).
//
// The data, written by the editor's Before & After tab and by the
// custom-site run:
//   copy.beforeAfter = { title?, intro?, pairs: [{ caption? }] }
//   images.baBefore0..5 / images.baAfter0..5   photo URLs of pair 0..5
// The object being there switches the band on: a site without it renders
// exactly as before (themes with live sites stay byte-identical). A pair is
// an index below BA_MAX_PAIRS with a pairs entry or a photo, so a photo the
// run uploaded without a caption entry still counts. The published page
// shows only pairs with both photos, and the band only when there is at
// least one; the editor shows every pair, so an incomplete one can say
// which photo it still needs.

// At most six pairs (one slide each). The published counter pads the slide
// numbers to two digits ("01 / 06").
export const BA_MAX_PAIRS = 6;

// The design's own words while the owner typed none. No claims: the photos
// make the point.
export const BA_DEFAULTS = {
  eyebrow: 'Before & After',
  title: 'See the Difference',
  intro: 'Drag the slider to compare.',
};

export const baBeforeKey = (i) => `baBefore${i}`;
export const baAfterKey = (i) => `baAfter${i}`;
// Image keys of the band (both sides, every slot).
export const BA_IMAGE_KEY = /^ba(?:Before|After)[0-5]$/;

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
// A stored photo is a URL string; anything else (null after Remove, a flag)
// is no photo.
const photo = (v) => (typeof v === 'string' && v.trim() ? v : '');

// Zero-padded slide number for the counter ("01").
export const baCounter = (n) => String(n).padStart(2, '0');

// How many pairs the owner has: pairs entries, or further when a later slot
// holds a photo; never more than BA_MAX_PAIRS.
export function beforeAfterCount(beforeAfter, images) {
  const imgs = isObj(images) ? images : {};
  const own = isObj(beforeAfter) && Array.isArray(beforeAfter.pairs) ? beforeAfter.pairs.length : 0;
  let n = Math.min(own, BA_MAX_PAIRS);
  for (let i = n; i < BA_MAX_PAIRS; i++) {
    if (photo(imgs[baBeforeKey(i)]) || photo(imgs[baAfterKey(i)])) n = i + 1;
  }
  return n;
}

// The band's content, or null while copy.beforeAfter is not an object (the
// band is off). -> { title, intro, pairs, complete }
//   title / intro  the owner's text, trimmed ('' = the design's own)
//   pairs          [{ index, before, after, caption, complete }]: complete
//                  pairs only on the published page, every pair in the
//                  editor; index is the slot (baBefore<index>)
//   complete       how many pairs have both photos
export function beforeAfterPairs(beforeAfter, images, { editor = false } = {}) {
  if (!isObj(beforeAfter)) return null;
  const imgs = isObj(images) ? images : {};
  const own = Array.isArray(beforeAfter.pairs) ? beforeAfter.pairs : [];
  const all = [];
  for (let i = 0, n = beforeAfterCount(beforeAfter, imgs); i < n; i++) {
    const entry = isObj(own[i]) ? own[i] : {};
    const before = photo(imgs[baBeforeKey(i)]);
    const after = photo(imgs[baAfterKey(i)]);
    all.push({ index: i, before, after, caption: str(entry.caption), complete: Boolean(before && after) });
  }
  const complete = all.filter((p) => p.complete);
  return {
    title: str(beforeAfter.title),
    intro: str(beforeAfter.intro),
    pairs: editor ? all : complete,
    complete: complete.length,
  };
}
