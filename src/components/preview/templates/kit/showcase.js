// Pure logic behind the Detail Showcase band (kit/Showcase.jsx): which photo
// cards a page shows. No React and no browser globals; tolerates whatever a
// saved row holds (missing keys, wrong types).
//
// The data, written by the editor's Detail Showcase tab (and a custom-site
// run):
//   copy.showcase = { title?, intro?, items: [{ title, caption? }] }
//   images.showcase0..5   the photo of item 0..5 (flat, like gallery0)
// The object being there switches the band on: a site without it renders
// exactly as before (themes with live sites stay byte-identical). An item is
// an index below SHOWCASE_MAX_ITEMS with an items entry or a photo, so a
// photo uploaded before its title was typed still counts. The published page
// shows only items with a title and a photo, and the band only when there is
// at least one; the editor shows every item, so an incomplete one can say
// what it still needs.

// The section as a template lists it (its `sections` / `addedSections`).
// Never rename the id: saved sites store it in copy.sectionOrder.
export const SHOWCASE_SECTION = { id: 'showcase', label: 'Detail Showcase' };

// At most six cards: three staggered rows on wide screens.
export const SHOWCASE_MAX_ITEMS = 6;

// Characters the page prints at most (the editor's fields stop there too);
// longer saved text (an import, a hand-edited row) is cut at a word.
export const SHOWCASE_LIMITS = { title: 80, intro: 200, itemTitle: 60, caption: 140 };

// The design's own words while the owner typed none. No claims: the
// photos make the point.
export const SHOWCASE_DEFAULTS = {
  eyebrow: 'The finishing touch',
  title: 'Every Detail Matters',
  intro: '',
};

// Where the owner adds what a card still needs (editor-only text; the
// published page never shows it).
export const SHOWCASE_HINTS = {
  photo: 'Add a photo: Edit > Detail Showcase',
  title: 'Add a title: Edit > Detail Showcase',
  empty: 'Add up to 6 photos, each with a short title: Edit > Detail Showcase',
};
// "Add a photo: Edit > Detail Showcase (item 2)" for slot index 1.
export const showcaseItemHint = (kind, index) => `${SHOWCASE_HINTS[kind] || SHOWCASE_HINTS.photo} (item ${index + 1})`;

export const showcaseKey = (i) => `showcase${i}`;
// Image keys of the band (every slot).
export const SHOWCASE_IMAGE_KEY = /^showcase[0-5]$/;

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
// One line of text: control characters and line breaks become spaces,
// runs of spaces one.
const line = (v) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
  .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
// A stored photo is a URL string; anything else (null after Remove, a flag)
// is no photo.
const photo = (v) => (typeof v === 'string' && v.trim() ? v : '');

// `s` cut to `max` characters at a word (when one ends in the second half),
// without trailing punctuation. No ellipsis: the editor stops typing at the
// same limit, so only unusual saved text is ever cut.
export function clipText(v, max) {
  const s = line(v);
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return (at >= max / 2 ? cut.slice(0, at) : s.slice(0, max)).replace(/[\s,;:–—-]+$/, '');
}

// An items entry: { title, caption } or a bare string (the title).
const entryOf = (v) => (typeof v === 'string' || typeof v === 'number' ? { title: v } : isObj(v) ? v : {});

// How many items the owner has: items entries, or further when a later slot
// holds a photo; never more than SHOWCASE_MAX_ITEMS.
export function showcaseCount(showcase, images) {
  const imgs = isObj(images) ? images : {};
  const own = isObj(showcase) && Array.isArray(showcase.items) ? showcase.items.length : 0;
  let n = Math.min(own, SHOWCASE_MAX_ITEMS);
  for (let i = n; i < SHOWCASE_MAX_ITEMS; i++) {
    if (photo(imgs[showcaseKey(i)])) n = i + 1;
  }
  return n;
}

// The band's content, or null while copy.showcase is not an object (the band
// is off). -> { title, intro, items, complete }
//   title / intro  the owner's text, one line, clipped ('' = the design's own)
//   items          [{ index, title, caption, photo, complete }]: complete
//                  items only on the published page, every item in the
//                  editor; index is the slot (images.showcase<index>)
//   complete       how many items have a title and a photo
export function showcaseItems(showcase, images, { editor = false } = {}) {
  if (!isObj(showcase)) return null;
  const imgs = isObj(images) ? images : {};
  const own = Array.isArray(showcase.items) ? showcase.items : [];
  const all = [];
  for (let i = 0, n = showcaseCount(showcase, imgs); i < n; i++) {
    const entry = entryOf(own[i]);
    const title = clipText(entry.title, SHOWCASE_LIMITS.itemTitle);
    const src = photo(imgs[showcaseKey(i)]);
    all.push({
      index: i,
      title,
      caption: clipText(entry.caption, SHOWCASE_LIMITS.caption),
      photo: src,
      complete: Boolean(title && src),
    });
  }
  const complete = all.filter((it) => it.complete);
  return {
    title: clipText(showcase.title, SHOWCASE_LIMITS.title),
    intro: clipText(showcase.intro, SHOWCASE_LIMITS.intro),
    items: editor ? all : complete,
    complete: complete.length,
  };
}
