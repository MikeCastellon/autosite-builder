// Package details (Services tab): the pure helpers never mutate a service
// and store includes in the shape kit/content.js serviceIncludes reads; the
// fields render on the server (node, no DOM).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SUMMARY_MAX, BADGE_MAX, INCLUDES_MAX,
  setServiceField, includeText, isHeading, isHighlighted, withText,
  toggleHeading, toggleHighlight, hasDetails, photoUploadKey, patchServiceList,
  pasteIncludes, insertIncludeAfter,
} from './serviceDetails.js';
import ServiceDetailsFields, { ServiceDetailsFields as Named } from './ServiceDetailsFields.jsx';
import { serviceIncludes } from '../templates/kit/content.js';

const noop = () => {};
const html = (props) => renderToStaticMarkup(createElement(ServiceDetailsFields, { index: 0, onChange: noop, siteId: 's', ...props }));
const base = { name: 'Signature Detail', price: '$199', description: 'Inside and out.' };

describe('serviceDetails helpers', () => {
  it('limits match the spec', () => {
    expect([SUMMARY_MAX, BADGE_MAX, INCLUDES_MAX]).toEqual([60, 20, 24]);
  });

  it('setServiceField sets a value and removes the key for empty values', () => {
    expect(setServiceField(base, 'badge', 'Most Popular')).toEqual({ ...base, badge: 'Most Popular' });
    const full = { ...base, summary: 'x', badge: 'y', image: '/p.jpg', includes: ['a'] };
    for (const [key, empty] of [['summary', ''], ['badge', null], ['image', undefined], ['includes', []]]) {
      const next = setServiceField(full, key, empty);
      expect(key in next).toBe(false);
      expect(next.name).toBe('Signature Detail');
      expect(next.price).toBe('$199');
      expect(next.description).toBe('Inside and out.');
    }
    // An include row being typed ([''] is not empty) is kept.
    expect(setServiceField(base, 'includes', [''])).toEqual({ ...base, includes: [''] });
  });

  it('setServiceField never mutates and accepts a bare name', () => {
    const before = structuredClone({ ...base, badge: 'Old' });
    const input = structuredClone(before);
    const next = setServiceField(input, 'badge', 'New');
    expect(input).toEqual(before);
    expect(next).not.toBe(input);
    expect(setServiceField('Express Wash', 'summary', 'Quick')).toEqual({ name: 'Express Wash', summary: 'Quick' });
    expect(setServiceField(null, 'badge', 'x')).toEqual({ badge: 'x' });
  });

  it('reads item text, headings and highlights', () => {
    expect(includeText('Vacuum')).toBe('Vacuum');
    expect(includeText({ text: 'Wax', highlight: true })).toBe('Wax');
    expect(includeText({})).toBe('');
    expect(includeText(null)).toBe('');
    expect(isHeading('Interior:')).toBe(true);
    expect(isHeading('Interior:  ')).toBe(true);
    expect(isHeading('Interior: vacuum')).toBe(false);
    expect(isHighlighted({ text: 'Wax', highlight: true })).toBe(true);
    expect(isHighlighted('Wax')).toBe(false);
    expect(isHighlighted({ text: 'Wax' })).toBe(false);
    // A heading is never highlighted, whatever the stored flag says.
    expect(isHighlighted({ text: 'Exterior:', highlight: true })).toBe(false);
  });

  it('withText keeps the item form', () => {
    expect(withText('Vacuum', 'Vacuum seats')).toBe('Vacuum seats');
    expect(withText({ text: 'Wax', highlight: true }, 'Wax + sealant')).toEqual({ text: 'Wax + sealant', highlight: true });
    expect(withText({ text: 'Wax' }, 'Wax 2')).toBe('Wax 2');
    // Typing through a colon keeps the flag for the rest of the line.
    const mid = withText({ text: 'Interior', highlight: true }, 'Interior:');
    expect(mid).toEqual({ text: 'Interior:', highlight: true });
    expect(withText(mid, 'Interior: steam')).toEqual({ text: 'Interior: steam', highlight: true });
  });

  it('toggleHeading adds and removes the colon and drops the highlight', () => {
    expect(toggleHeading('Interior')).toBe('Interior:');
    expect(toggleHeading('Interior  ')).toBe('Interior:');
    expect(toggleHeading('Interior:')).toBe('Interior');
    expect(toggleHeading('Interior :')).toBe('Interior');
    expect(toggleHeading({ text: 'Exterior', highlight: true })).toBe('Exterior:');
    expect(toggleHeading({ text: 'Exterior:', highlight: true })).toBe('Exterior');
  });

  it('toggleHighlight switches string <-> object and leaves headings alone', () => {
    expect(toggleHighlight('Wax')).toEqual({ text: 'Wax', highlight: true });
    expect(toggleHighlight({ text: 'Wax', highlight: true })).toBe('Wax');
    expect(toggleHighlight({ text: 'Wax' })).toEqual({ text: 'Wax', highlight: true });
    expect(toggleHighlight('Interior:')).toBe('Interior:');
    const heading = { text: 'Exterior:', highlight: true };
    expect(toggleHighlight(heading)).toBe(heading);
  });

  it('stored items read back through serviceIncludes as the panel shows them', () => {
    const items = ['Interior:', { text: 'Steam clean', highlight: true }, 'Vacuum', { text: 'Exterior:', highlight: true }, ''];
    expect(serviceIncludes(items)).toEqual([
      { text: 'Interior:', heading: true, highlight: false },
      { text: 'Steam clean', heading: false, highlight: true },
      { text: 'Vacuum', heading: false, highlight: false },
      { text: 'Exterior:', heading: true, highlight: false },
    ]);
    for (const item of items.filter((i) => includeText(i))) {
      const read = serviceIncludes([item])[0];
      expect({ item, heading: isHeading(item), highlight: isHighlighted(item) }).toEqual({ item, heading: read.heading, highlight: read.highlight });
    }
  });

  it('hasDetails', () => {
    expect(hasDetails(base)).toBe(false);
    expect(hasDetails('Express Wash')).toBe(false);
    expect(hasDetails(null)).toBe(false);
    expect(hasDetails({ ...base, summary: '  ' })).toBe(false);
    expect(hasDetails({ ...base, includes: [] })).toBe(false);
    expect(hasDetails({ ...base, summary: 'Quick' })).toBe(true);
    expect(hasDetails({ ...base, badge: 'Most Popular' })).toBe(true);
    expect(hasDetails({ ...base, image: '/p.jpg' })).toBe(true);
    expect(hasDetails({ ...base, includes: [''] })).toBe(true);
  });

  it('package photos upload under service<i>', () => {
    expect(photoUploadKey(0)).toBe('service0');
    expect(photoUploadKey(3)).toBe('service3');
    expect(photoUploadKey(undefined)).toBe('service0');
  });
});

describe('ServiceDetailsFields', () => {
  it('has a default and a named export', () => {
    expect(Named).toBe(ServiceDetailsFields);
  });

  it('opens only when the package has details', () => {
    expect(html({ service: base })).toMatch(/^<details class="mb-1">/);
    expect(html({ service: { ...base, badge: 'Most Popular' } })).toMatch(/^<details open="" class="mb-1">/);
    expect(html({ service: 'Express Wash' })).toContain('Package details');
  });

  it('shows the summary counter, badge help and the Package Photo slot', () => {
    const out = html({ service: base, index: 2 });
    expect(out).toContain('Short summary');
    expect(out).toContain('0/60');
    expect(out).toContain('0/20');
    expect(out).toContain('Only if it&#x27;s true. Leave empty for no badge.');
    expect(out).toContain('Upload Package Photo');
    expect(out).toContain('aria-label="Upload Package Photo"');
    expect(out).toContain('What&#x27;s included');
    expect(out).toContain('+ Add item');
    expect(html({ service: { ...base, summary: 'Full detail + wax' } })).toContain('17/60');
    expect(html({ service: { ...base, image: '/p.jpg' } })).toContain('src="/p.jpg"');
  });

  it('lists include rows with their toggles', () => {
    const out = html({ service: { ...base, includes: ['Interior:', { text: 'Steam clean', highlight: true }, 'Vacuum', ''] } });
    expect(out).toContain('value="Interior:"');
    expect(out).toContain('value="Steam clean"');
    expect(out).toContain('value="Vacuum"');
    // The highlighted object's Highlight button is pressed; a plain row's is not.
    expect(out).toMatch(/aria-pressed="true" aria-label="Item 2: highlight"/);
    expect(out).toMatch(/aria-pressed="false" aria-label="Item 3: highlight"/);
    // A heading: Heading pressed, Highlight disabled.
    expect(out).toMatch(/aria-pressed="true" aria-label="Item 1: group heading"/);
    expect(out).toMatch(/aria-pressed="false" aria-label="Item 1: highlight"[^>]*disabled=""/);
    expect(out).not.toMatch(/aria-label="Item 3: highlight"[^>]*disabled=""/);
    // An empty row cannot become a lone ':' heading.
    expect(out).toMatch(/aria-label="Item 4: group heading"[^>]*disabled=""/);
    // Row controls carry the same names as fields.jsx's TextListEditor.
    expect(out).toContain('aria-label="item 1"');
    expect(out).toContain('aria-label="Remove item 4"');
    expect(out).toMatch(/disabled="" aria-label="Move item 1 up"|aria-label="Move item 1 up"[^>]*disabled=""/);
    expect(out).toContain('aria-label="Move item 4 down"');
    expect(out).toContain('+ Add item');
    expect(out).not.toContain('Up to 24');
  });

  it('caps the list at 24 items', () => {
    const out = html({ service: { ...base, includes: Array.from({ length: 24 }, (_, i) => `Item ${i}`) } });
    expect(out).toContain('Up to 24');
  });
});

describe('patchServiceList (a package field written into the latest list)', () => {
  const list = [
    { name: 'Refresh Detail', price: '$120' },
    { name: 'Signature Detail', price: '$180', badge: 'Most Popular' },
    { name: 'Premium Detail', price: '$260' },
  ];

  it('writes the field into the row and keeps every other edit', () => {
    // The owner changed another card's price while the photo uploaded.
    const now = list.map((p, i) => (i === 0 ? { ...p, price: '$130' } : p));
    const next = patchServiceList(now, 1, 'image', '/p.jpg', { name: 'Signature Detail', count: 3 });
    expect(next[0].price).toBe('$130');
    expect(next[1]).toEqual({ name: 'Signature Detail', price: '$180', badge: 'Most Popular', image: '/p.jpg' });
    expect(next[2]).toBe(now[2]);
    // An empty value removes the key, as setServiceField does.
    expect('badge' in patchServiceList(list, 1, 'badge', '', { name: 'Signature Detail', count: 3 })[1]).toBe(false);
  });

  it('finds the row again after a removal and writes nothing when it is gone', () => {
    const shifted = list.slice(1);
    expect(patchServiceList(shifted, 1, 'image', '/p.jpg', { name: 'Premium Detail', count: 3 })[1].image).toBe('/p.jpg');
    expect(patchServiceList(shifted, 0, 'image', '/p.jpg', { name: 'Signature Detail', count: 3 })[0].image).toBe('/p.jpg');
    const gone = [list[0], list[2]];
    expect(patchServiceList(gone, 1, 'image', '/p.jpg', { name: 'Signature Detail', count: 3 })).toBe(null);
  });

  it('follows a row renamed in place, and accepts no `at`', () => {
    const renamed = list.map((p, i) => (i === 1 ? { ...p, name: 'Signature Plus' } : p));
    expect(patchServiceList(renamed, 1, 'image', '/p.jpg', { name: 'Signature Detail', count: 3 })[1].name).toBe('Signature Plus');
    expect(patchServiceList(renamed, 1, 'image', '/p.jpg', { name: 'Signature Detail', count: 3 })[1].image).toBe('/p.jpg');
    expect(patchServiceList(list, 2, 'summary', 'Top tier')[2].summary).toBe('Top tier');
    expect(patchServiceList(list, 5, 'summary', 'x')).toBe(null);
    expect(patchServiceList(null, 0, 'summary', 'x')).toBe(null);
  });
});

describe('typing a what\'s-included list fast', () => {
  it('splits a pasted list into rows, dropping bullets and blank lines', () => {
    const r = pasteIncludes([''], 0, 'Interior:\n- Vacuum\n\u2022 Windows\r\n\n2. Door jambs\n');
    expect(r.list).toEqual(['Interior:', 'Vacuum', 'Windows', 'Door jambs']);
    expect(r.last).toBe(3);
  });

  it('inserts after a filled row and keeps the rows around it', () => {
    const r = pasteIncludes(['A', { text: 'B', highlight: true }, 'C'], 1, 'X\nY');
    expect(r.list).toEqual(['A', { text: 'B', highlight: true }, 'X', 'Y', 'C']);
    expect(r.last).toBe(3);
  });

  it('leaves single-line text to the normal paste and stops at the row limit', () => {
    expect(pasteIncludes(['A'], 0, 'just one line')).toBeNull();
    expect(pasteIncludes(['A'], 0, '\n \n')).toBeNull();
    const r = pasteIncludes(['A', 'B'], 1, 'C\nD\nE', 3);
    expect(r.list).toEqual(['A', 'B', 'C']);
    expect(pasteIncludes(['A', 'B', 'C'], 2, 'D\nE', 3)).toBeNull();
  });

  it('adds an empty row right after the current one, unless the list is full', () => {
    expect(insertIncludeAfter(['A', 'B'], 0)).toEqual(['A', '', 'B']);
    expect(insertIncludeAfter(['A', 'B'], 1)).toEqual(['A', 'B', '']);
    expect(insertIncludeAfter(['A', 'B'], 1, 2)).toBeNull();
  });
});

describe('ServiceDetailsFields summary help', () => {
  it("takes the editor's wording when the hero shows no services", () => {
    expect(html({ service: base })).toContain('One line under the name in the hero price card or list.');
    const off = html({ service: base, summaryHelp: 'Your hero shows no services yet.' });
    expect(off).toContain('Your hero shows no services yet.');
    expect(off).not.toContain('One line under the name in the hero price card or list.');
  });
});
