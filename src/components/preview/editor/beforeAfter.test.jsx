// Edit > Before & After: the helpers keep copy.beforeAfter and the photos
// (images baBefore<i> / baAfter<i>) in step with what the band shows
// (kit/beforeAfter.js), move a pair's photos with its caption, never go
// past six pairs, and the panel renders on the server (node, no DOM).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BA_DEFAULTS, baBeforeKey, baAfterKey, beforeAfterPairs } from '../templates/kit/beforeAfter.js';
import {
  BA_TITLE_MAX, BA_INTRO_MAX, BA_CAPTION_MAX,
  baValue, baStart, baRows, baSetText, baSetCaption, baAddPair, baRemovePair, baMovePair, baRemoveImages, baMoveImages, baWithoutImages,
} from './beforeAfterEdit.js';
import BeforeAfterPanel from './BeforeAfterPanel.jsx';

const url = (side, i) => `https://img.test/${side}${i}.jpg`;
const PHOTOS = (n) => Object.assign({}, ...Array.from({ length: n }, (_, i) => ({ [baBeforeKey(i)]: url('b', i), [baAfterKey(i)]: url('a', i) })));
const noop = () => {};
const panel = (copy, images = {}) => renderToStaticMarkup(createElement(BeforeAfterPanel, {
  copy, setCopy: noop, images, setImage: noop, patchImages: noop, siteId: 's', confirm: async () => true, hasHeadingsTab: true,
}));
const decode = (html) => html.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&#x27;/g, "'");
// What the band shows for a value (editor view: [slot, caption, before, after]).
const shown = (ba, images) => beforeAfterPairs(ba, images, { editor: true }).pairs.map((p) => [p.index, p.caption, p.before, p.after]);

describe('beforeAfterEdit', () => {
  it('limits match the custom-site run', () => {
    expect([BA_TITLE_MAX, BA_INTRO_MAX, BA_CAPTION_MAX]).toEqual([80, 200, 80]);
  });

  it('reads the band as on only for an object, and starts it with one pair', () => {
    for (const v of [undefined, null, 'x', [], 3]) expect(baValue({ beforeAfter: v })).toBeNull();
    expect(baValue({ beforeAfter: { pairs: [] } })).toEqual({ pairs: [] });
    expect(baValue(null)).toBeNull();
    expect(baStart()).toEqual({ pairs: [{}] });
    expect(baRows({}, PHOTOS(2))).toEqual([]);
  });

  it('lists every pair the band counts, a photo without an entry included', () => {
    const copy = { beforeAfter: { pairs: [{ caption: 'Sedan' }, 'junk'] } };
    const images = { ...PHOTOS(1), [baAfterKey(2)]: url('a', 2), [baBeforeKey(1)]: null };
    expect(baRows(copy, images)).toEqual([
      { index: 0, caption: 'Sedan', complete: true },
      { index: 1, caption: '', complete: false },
      { index: 2, caption: '', complete: false },
    ]);
  });

  it('sets the heading and intro as typed, removing them when emptied', () => {
    const ba = { pairs: [{}] };
    expect(baSetText(ba, 'title', 'Fresh ')).toEqual({ pairs: [{}], title: 'Fresh ' });
    expect(baSetText({ title: 'X', intro: 'Y', pairs: [] }, 'intro', '')).toEqual({ title: 'X', pairs: [] });
    expect(baSetText(null, 'title', 'T')).toEqual({ title: 'T', pairs: [] });
    expect(ba).toEqual({ pairs: [{}] });
  });

  it('writes a caption on its own pair, padding the entries out to it', () => {
    const next = baSetCaption({ pairs: [] }, PHOTOS(3), 2, 'Van');
    expect(next).toEqual({ pairs: [{}, {}, { caption: 'Van' }] });
    expect(baSetCaption(next, PHOTOS(3), 2, '')).toEqual({ pairs: [{}, {}, {}] });
    expect(shown(next, PHOTOS(3))[2]).toEqual([2, 'Van', url('b', 2), url('a', 2)]);
  });

  it('adds pairs up to six', () => {
    let ba = baStart();
    for (let n = 2; n <= 6; n++) {
      ba = baAddPair(ba, {});
      expect(ba.pairs).toHaveLength(n);
    }
    expect(baAddPair(ba, {})).toBeNull();
    // Photos in later slots count too.
    expect(baAddPair({ pairs: [] }, { [baBeforeKey(5)]: url('b', 5) })).toBeNull();
  });

  it('removes a pair with its photos: later pairs move up, other images stay', () => {
    const ba = { title: 'T', pairs: [{ caption: 'A' }, { caption: 'B' }, { caption: 'C' }] };
    const images = { ...PHOTOS(3), hero: 'https://img.test/hero.jpg', gallery0: 'https://img.test/g0.jpg' };
    const nextBa = baRemovePair(ba, images, 1);
    const nextImages = baRemoveImages(images, 1);
    expect(nextBa).toEqual({ title: 'T', pairs: [{ caption: 'A' }, { caption: 'C' }] });
    expect(nextImages).toEqual({ hero: 'https://img.test/hero.jpg', gallery0: 'https://img.test/g0.jpg', ...PHOTOS(1), [baBeforeKey(1)]: url('b', 2), [baAfterKey(1)]: url('a', 2) });
    expect(shown(nextBa, nextImages)).toEqual([[0, 'A', url('b', 0), url('a', 0)], [1, 'C', url('b', 2), url('a', 2)]]);
    // The last pair: its slot empties, and the band keeps no pair for it.
    expect(shown(baRemovePair(nextBa, nextImages, 1), baRemoveImages(nextImages, 1))).toEqual([[0, 'A', url('b', 0), url('a', 0)]]);
  });

  it('moves a pair with its photos, a half-filled one included', () => {
    const ba = { pairs: [{ caption: 'A' }, { caption: 'B' }] };
    const images = { ...PHOTOS(1), [baAfterKey(1)]: url('a', 1) };
    const nextBa = baMovePair(ba, images, 1, 0);
    const nextImages = baMoveImages(images, 1, 0);
    expect(shown(nextBa, nextImages)).toEqual([[0, 'B', '', url('a', 1)], [1, 'A', url('b', 0), url('a', 0)]]);
    expect(Object.keys(nextImages).sort()).toEqual(['baAfter0', 'baAfter1', 'baBefore1']);
    // Out of range: unchanged.
    expect(baMovePair(ba, images, 0, 5)).toEqual(ba);
  });

  it('removing the section takes every band photo out of the images map', () => {
    expect(baWithoutImages({ ...PHOTOS(6), logo: 'https://img.test/logo.png', baBefore9: 'kept: not a band slot' }))
      .toEqual({ logo: 'https://img.test/logo.png', baBefore9: 'kept: not a band slot' });
  });
});

describe('BeforeAfterPanel', () => {
  it('offers to add the section while it is off', () => {
    const html = decode(panel({}));
    expect(html).toContain('+ Add a Before & After section');
    expect(html).not.toContain('type="file"');
    expect(decode(panel({ hiddenSections: ['beforeAfter'] }))).toContain('This section is switched off in Sections.');
  });

  it('lists each pair with its two photo slots, caption and what it still needs', () => {
    const copy = { beforeAfter: { title: 'Fresh', pairs: [{ caption: 'Sedan' }, {}] } };
    const html = decode(panel(copy, { ...PHOTOS(1), [baBeforeKey(1)]: url('b', 1) }));
    for (const label of ['Before & After 1: before photo', 'Before & After 1: after photo', 'Before & After 2: before photo', 'Before & After 2: after photo']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('Upload Before & After 2: after photo');
    expect(html).toContain('value="Sedan"');
    expect(html).toContain('value="Fresh"');
    expect(html).toContain(`placeholder="${BA_DEFAULTS.intro}"`);
    expect(html).toContain('Pair 1');
    expect(html.split('Not on your site yet: it needs both photos.').length - 1).toBe(1);
    expect(html).toContain('+ Add a pair');
    expect(html).toContain('Remove this section');
    expect(html).toContain('Edit > Headings');
  });

  it('stops adding at six pairs', () => {
    const html = decode(panel({ beforeAfter: { pairs: Array.from({ length: 6 }, () => ({})) } }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Up to 6 pairs<\/button>/);
  });
});
