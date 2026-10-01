// The shared editor controls render on the server (node, no DOM) and the
// list helpers never mutate their input.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Field, Switch, SwitchRow, Toggle, ImageSlot, Card, Note, Help, TextListEditor, MoveButtons, moveItem, removeAt, replaceAt } from './fields.jsx';

const html = (type, props) => renderToStaticMarkup(createElement(type, props));
const noop = () => {};

describe('editor fields', () => {
  it('renders every control without a DOM', () => {
    expect(html(Field, { label: 'Badge', value: 'Most Popular', onChange: noop, maxLength: 20 })).toContain('12/20');
    expect(html(Field, { label: 'Intro', value: null, onChange: noop, multiline: true })).toContain('<textarea');
    expect(html(Switch, { on: true, onChange: noop, label: 'Show' })).toContain('aria-checked="true"');
    expect(html(SwitchRow, { label: 'Insured', on: false, onChange: noop, help: 'Only if true.' })).toContain('Only if true.');
    expect(html(Toggle, { value: 'list', onChange: noop, options: [{ value: 'quote', label: 'Quote' }, { value: 'list', label: 'List' }] })).toMatch(/aria-checked="true"[^>]*>List</);
    expect(html(ImageSlot, { label: 'Featured Photo', value: null, onChange: noop, siteId: 's', uploadKey: 'featured' })).toContain('Upload Featured Photo');
    expect(html(ImageSlot, { label: 'Featured Photo', value: '/x.jpg', onChange: noop, siteId: 's', uploadKey: 'featured' })).toContain('Remove');
    expect(html(Card, { title: 'Service 1', onRemove: noop, children: 'x' })).toContain('Service 1');
    expect(html(Note, { title: 'Connected', tone: 'ok' })).toContain('bg-green-50');
    expect(html(Help, { children: null })).toBe('');
    expect(html(MoveButtons, { index: 0, count: 2, onMove: noop, label: 'row' })).toContain('disabled');
  });

  it('lists rows with their text and caps additions at max', () => {
    const out = html(TextListEditor, { items: ['Vacuum', { text: 'Wax', highlight: true }], onChange: noop, getText: (i) => (typeof i === 'string' ? i : i.text), max: 2, itemLabel: 'item' });
    expect(out).toContain('value="Vacuum"');
    expect(out).toContain('value="Wax"');
    expect(out).toContain('Up to 2');
  });

  it('list helpers return new arrays and ignore bad indexes', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(list, 0, 5)).toBe(list);
    expect(removeAt(list, 1)).toEqual(['a', 'c']);
    expect(replaceAt(list, 1, 'x')).toEqual(['a', 'x', 'c']);
    expect(list).toEqual(['a', 'b', 'c']);
    expect(removeAt(null, 0)).toEqual([]);
  });
});
