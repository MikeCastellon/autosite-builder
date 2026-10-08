// The list helpers the reference-site band tabs share (FAQ, Vehicle Types,
// Comparison): never mutate, keep only the entries the page counts, drop
// emptied fields but keep false (a "No" cell), and add / remove / move
// entries within the limit.
import { describe, it, expect } from 'vitest';
import { bandValue, bandEntries, bandSetText, bandSetField, bandAdd, bandRemove, bandMove } from './bandListEdit.js';

describe('bandListEdit', () => {
  it('reads the band as on only for an object', () => {
    for (const v of [undefined, null, '', 'x', 3, true, [], [{}]]) expect(bandValue({ faq: v }, 'faq')).toBeNull();
    expect(bandValue({ faq: { items: [] } }, 'faq')).toEqual({ items: [] });
    expect(bandValue(null, 'faq')).toBeNull();
  });

  it('lists the entries that count, as fresh objects (odd ones become {})', () => {
    const band = { items: [{ q: 'A' }, 'junk', null, { q: 'D' }] };
    const list = bandEntries(band, 'items', 3);
    expect(list).toEqual([{ q: 'A' }, {}, {}]);
    list[0].q = 'changed';
    expect(band.items[0].q).toBe('A');
    expect(bandEntries({ items: ['Boats'] }, 'items', 8, (e) => (typeof e === 'string' ? { name: e } : { ...e }))).toEqual([{ name: 'Boats' }]);
    expect(bandEntries({}, 'items', 8)).toEqual([]);
  });

  it('sets and clears the band\'s own text as typed, keeping the band on', () => {
    expect(bandSetText(null, 'items', 'title', 'Our FAQ ')).toEqual({ title: 'Our FAQ ', items: [] });
    expect(bandSetText({ title: 'X', intro: 'Y', items: [{}] }, 'items', 'intro', '')).toEqual({ title: 'X', items: [{}] });
    const band = { items: [] };
    bandSetText(band, 'items', 'title', 'T');
    expect(band).toEqual({ items: [] });
  });

  it('sets an entry\'s field, removing it when emptied but keeping false', () => {
    const band = { title: 'T', rows: [{ label: 'A' }, { label: 'B' }] };
    expect(bandSetField(band, 'rows', 10, 1, 'us', false)).toEqual({ title: 'T', rows: [{ label: 'A' }, { label: 'B', us: false }] });
    expect(bandSetField(band, 'rows', 10, 0, 'label', '')).toEqual({ title: 'T', rows: [{}, { label: 'B' }] });
    expect(bandSetField(band, 'rows', 10, 0, 'us', null)).toEqual({ title: 'T', rows: [{ label: 'A' }, { label: 'B' }] });
    expect(bandSetField(band, 'rows', 10, 5, 'label', 'Z')).toBe(band);
    expect(band.rows[0]).toEqual({ label: 'A' });
  });

  it('adds up to the limit, removes and moves within it', () => {
    let band = { items: [{ q: '1' }] };
    band = bandAdd(band, 'items', 2, { q: '2' });
    expect(band.items).toEqual([{ q: '1' }, { q: '2' }]);
    expect(bandAdd(band, 'items', 2)).toBeNull();
    expect(bandRemove(band, 'items', 2, 0)).toEqual({ items: [{ q: '2' }] });
    expect(bandMove(band, 'items', 2, 1, 0)).toEqual({ items: [{ q: '2' }, { q: '1' }] });
    expect(bandMove(band, 'items', 2, 0, 5)).toEqual(band);
    // Entries past the limit are not kept on a write.
    expect(bandRemove({ items: [{}, {}, {}, { q: 'past' }] }, 'items', 3, 0).items).toHaveLength(2);
  });
});
