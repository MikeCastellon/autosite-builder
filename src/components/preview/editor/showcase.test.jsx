// Edit > Detail Showcase: the helpers keep copy.showcase and the photos
// (images showcase<i>) in step with what the band shows (kit/showcase.js),
// move a card's photo with its title, never go past six cards, and the
// panel renders on the server (no DOM).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SHOWCASE_LIMITS, SHOWCASE_DEFAULTS, showcaseKey, showcaseItems } from '../templates/kit/showcase.js';
import {
  SC_TITLE_MAX, SC_INTRO_MAX, SC_ITEM_TITLE_MAX, SC_CAPTION_MAX, SC_MAX_ITEMS,
  scValue, scStart, scRows, scSetText, scSetItem, scAddItem, scRemoveItem, scMoveItem, scRemoveImages, scMoveImages, scWithoutImages,
} from './showcaseEdit.js';
import ShowcasePanel from './ShowcasePanel.jsx';

const url = (i) => `https://img.test/s${i}.jpg`;
const PHOTOS = (...idx) => Object.assign({}, ...idx.map((i) => ({ [showcaseKey(i)]: url(i) })));
const noop = () => {};
const panel = (copy, images = {}) => renderToStaticMarkup(createElement(ShowcasePanel, {
  copy, setCopy: noop, images, setImage: noop, patchImages: noop, siteId: 's', confirm: async () => true, hasHeadingsTab: true,
}));
const decode = (html) => html.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&#x27;/g, "'");
// What the band shows (editor view: [slot, title, photo]).
const shown = (sc, images) => showcaseItems(sc, images, { editor: true }).items.map((it) => [it.index, it.title, it.photo]);

describe('showcaseEdit', () => {
  it('limits are the band\'s', () => {
    expect([SC_TITLE_MAX, SC_INTRO_MAX, SC_ITEM_TITLE_MAX, SC_CAPTION_MAX, SC_MAX_ITEMS])
      .toEqual([SHOWCASE_LIMITS.title, SHOWCASE_LIMITS.intro, SHOWCASE_LIMITS.itemTitle, SHOWCASE_LIMITS.caption, 6]);
  });

  it('reads the band as on only for an object, and starts it with one card', () => {
    for (const v of [undefined, null, 'x', [], 3]) expect(scValue({ showcase: v })).toBeNull();
    expect(scStart()).toEqual({ items: [{}] });
    expect(scRows({}, PHOTOS(0))).toEqual([]);
  });

  it('lists every card the band counts, a photo without an entry included', () => {
    const copy = { showcase: { items: [{ title: 'Wash', caption: 'Foam' }, 'Wax'] } };
    expect(scRows(copy, { ...PHOTOS(0, 3), [showcaseKey(1)]: null })).toEqual([
      { index: 0, title: 'Wash', caption: 'Foam', photo: true, complete: true },
      { index: 1, title: 'Wax', caption: '', photo: false, complete: false },
      { index: 2, title: '', caption: '', photo: false, complete: false },
      { index: 3, title: '', caption: '', photo: true, complete: false },
    ]);
  });

  it('writes a title on its own card, padding the entries out to it', () => {
    const next = scSetItem({ items: [] }, PHOTOS(2), 2, 'title', 'Hand Wax');
    expect(next).toEqual({ items: [{}, {}, { title: 'Hand Wax' }] });
    expect(scSetItem(next, PHOTOS(2), 2, 'title', '')).toEqual({ items: [{}, {}, {}] });
    expect(shown(next, PHOTOS(2))[2]).toEqual([2, 'Hand Wax', url(2)]);
    expect(scSetText(null, 'title', 'Up Close')).toEqual({ title: 'Up Close', items: [] });
  });

  it('adds cards up to six', () => {
    let sc = scStart();
    for (let n = 2; n <= SC_MAX_ITEMS; n++) {
      sc = scAddItem(sc, {});
      expect(sc.items).toHaveLength(n);
    }
    expect(scAddItem(sc, {})).toBeNull();
    // A photo in a later slot counts too.
    expect(scAddItem({ items: [] }, PHOTOS(5))).toBeNull();
  });

  it('removes and moves a card with its photo; other images stay', () => {
    const sc = { title: 'T', items: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] };
    const images = { ...PHOTOS(0, 1, 2), hero: 'https://img.test/hero.jpg', baBefore0: 'https://img.test/b.jpg' };
    const nextSc = scRemoveItem(sc, images, 1);
    const nextImages = scRemoveImages(images, 1);
    expect(nextSc).toEqual({ title: 'T', items: [{ title: 'A' }, { title: 'C' }] });
    expect(nextImages).toEqual({ hero: 'https://img.test/hero.jpg', baBefore0: 'https://img.test/b.jpg', [showcaseKey(0)]: url(0), [showcaseKey(1)]: url(2) });
    expect(shown(nextSc, nextImages)).toEqual([[0, 'A', url(0)], [1, 'C', url(2)]]);
    const moved = scMoveItem(sc, images, 2, 0);
    expect(shown(moved, scMoveImages(images, 2, 0))).toEqual([[0, 'C', url(2)], [1, 'A', url(0)], [2, 'B', url(1)]]);
  });

  it('removing the section takes every band photo out of the images map', () => {
    expect(scWithoutImages({ ...PHOTOS(0, 1, 2, 3, 4, 5), logo: 'https://img.test/logo.png', showcase9: 'kept: not a band slot' }))
      .toEqual({ logo: 'https://img.test/logo.png', showcase9: 'kept: not a band slot' });
  });
});

describe('ShowcasePanel', () => {
  it('offers to add the section while it is off', () => {
    const html = decode(panel({}));
    expect(html).toContain('+ Add a Detail Showcase section');
    expect(html).not.toContain('type="file"');
    expect(decode(panel({ hiddenSections: ['showcase'] }))).toContain('This section is switched off in Sections.');
  });

  it('lists each card with its photo slot, title, caption and what it still needs', () => {
    const html = decode(panel({ showcase: { items: [{ title: 'Wash' }, { caption: 'Glass' }, { title: 'Wax' }] } }, PHOTOS(0, 1)));
    expect(html).toContain(`placeholder="${SHOWCASE_DEFAULTS.title}"`);
    for (const label of ['Detail Showcase 1: photo', 'Detail Showcase 2: photo', 'Detail Showcase 3: photo']) expect(html).toContain(label);
    expect(html).toContain('Upload Detail Showcase 3: photo');
    expect(html).toContain('value="Wash"');
    expect(html).toContain('>Glass</textarea>');
    expect(html).toContain('Not on your site yet: it needs a title.');
    expect(html).toContain('Not on your site yet: it needs a photo.');
    expect(html.split('Not on your site yet').length - 1).toBe(2);
    expect(html).toContain('+ Add a photo card');
    expect(html).toContain('Remove this section');
    expect(html).toContain('Edit > Headings');
  });

  it('stops adding at six cards', () => {
    const html = decode(panel({ showcase: { items: Array.from({ length: 6 }, () => ({})) } }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Up to 6 photos<\/button>/);
  });
});
