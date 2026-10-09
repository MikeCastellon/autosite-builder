// Edit > Vehicle Types: the helpers keep copy.vehicleTypes in step with
// what the band shows (kit/vehicleTypes.js: eight cards, named ones
// published, the icon from the name unless the owner picks one), quick picks
// fill the started card first and name their own icon, and the panel renders
// on the server.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VT_LIMITS, VT_ICONS, VT_DEFAULTS, vehicleTypesOf, vehicleIconFor } from '../templates/kit/vehicleTypes.js';
import {
  VT_TITLE_MAX, VT_INTRO_MAX, VT_NAME_MAX, VT_DESC_MAX, VT_MAX_ITEMS, VT_QUICK_NAMES,
  vtValue, vtStart, vtRows, vtIconChoices, vtQuickPicks, vtSetText, vtSetItem, vtAddItem, vtRemoveItem, vtMoveItem, vtAddQuick,
} from './vehicleTypesEdit.js';
import VehicleTypesPanel from './VehicleTypesPanel.jsx';

const noop = () => {};
const panel = (copy) => renderToStaticMarkup(createElement(VehicleTypesPanel, { copy, setCopy: noop, confirm: async () => true, hasHeadingsTab: true }));
const decode = (html) => html.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

describe('vehicleTypesEdit', () => {
  it('limits are the band\'s, and every icon has a quick-pick name', () => {
    expect([VT_TITLE_MAX, VT_INTRO_MAX, VT_NAME_MAX, VT_DESC_MAX, VT_MAX_ITEMS]).toEqual([VT_LIMITS.title, VT_LIMITS.intro, VT_LIMITS.name, VT_LIMITS.desc, VT_LIMITS.items]);
    expect(Object.keys(VT_QUICK_NAMES)).toEqual([...VT_ICONS]);
    expect(vtIconChoices().map((c) => c.id)).toEqual(['', ...VT_ICONS]);
    expect(VT_QUICK_NAMES).toMatchObject({
      sedan: 'Sedans', coupe: 'Coupes', sports: 'Sports Cars', luxury: 'Luxury Cars', ev: 'EVs', convertible: 'Convertibles', classic: 'Classic Cars',
    });
  });

  it('names every quick pick so the name leads back to its own icon', () => {
    // A quick pick saves its icon, but an owner who sets it back to
    // Automatic gets the icon of the name: the same drawing.
    for (const id of VT_ICONS) expect(vehicleIconFor(VT_QUICK_NAMES[id]), VT_QUICK_NAMES[id]).toBe(id);
    for (const id of VT_ICONS) {
      const [row] = vtRows({ vehicleTypes: vtSetItem(vtAddQuick(vtStart(), id), 0, 'icon', '') });
      expect([row.icon, row.autoIcon]).toEqual(['', id]);
    }
  });

  it('reads the band as on only for an object, and starts it with one card', () => {
    for (const v of [undefined, null, 'x', [], 3]) expect(vtValue({ vehicleTypes: v })).toBeNull();
    expect(vtStart()).toEqual({ items: [{}] });
    expect(vtRows({})).toEqual([]);
  });

  it('lists the cards with the owner\'s icon and the one the page draws', () => {
    const copy = { vehicleTypes: { items: [{ name: 'Boats' }, { name: 'Daily drivers', icon: 'suv' }, 'Trucks', { desc: 'No name', icon: 'nope' }] } };
    expect(vtRows(copy)).toEqual([
      { index: 0, name: 'Boats', desc: '', icon: '', autoIcon: 'boat', named: true },
      { index: 1, name: 'Daily drivers', desc: '', icon: 'suv', autoIcon: 'suv', named: true },
      { index: 2, name: 'Trucks', desc: '', icon: '', autoIcon: 'truck', named: true },
      { index: 3, name: '', desc: 'No name', icon: '', autoIcon: 'car', named: false },
    ]);
  });

  it('writes names, lines and icons ("" = automatic); a string entry stays a name', () => {
    const vt = { items: ['Trucks'] };
    expect(vtSetItem(vt, 0, 'icon', 'van')).toEqual({ items: [{ name: 'Trucks', icon: 'van' }] });
    expect(vtSetItem({ items: [{ name: 'Vans', icon: 'van' }] }, 0, 'icon', '')).toEqual({ items: [{ name: 'Vans' }] });
    expect(vtSetText(vt, 'title', 'Rides')).toEqual({ items: ['Trucks'], title: 'Rides' });
    expect(vtRemoveItem({ items: ['A', 'B'] }, 0)).toEqual({ items: [{ name: 'B' }] });
    expect(vtMoveItem({ items: [{ name: 'A' }, { name: 'B' }] }, 0, 1)).toEqual({ items: [{ name: 'B' }, { name: 'A' }] });
  });

  it('adds up to eight; a quick pick fills the started card, then adds', () => {
    let vt = vtStart();
    vt = vtAddQuick(vt, 'boat');
    expect(vt).toEqual({ items: [{ name: 'Boats', icon: 'boat' }] });
    vt = vtAddQuick(vt, 'rv');
    expect(vt.items).toEqual([{ name: 'Boats', icon: 'boat' }, { name: 'RVs', icon: 'rv' }]);
    expect(vtAddQuick(vt, 'helicopter')).toBeNull();
    for (let n = 3; n <= VT_MAX_ITEMS; n++) vt = vtAddItem(vt);
    expect(vt.items).toHaveLength(8);
    expect(vtAddItem(vt)).toBeNull();
    // What the band then shows: the two named cards.
    expect(vehicleTypesOf(vt).items.map((it) => [it.name, it.icon])).toEqual([['Boats', 'boat'], ['RVs', 'rv']]);
    // Full, a quick pick still fills a blank card; with none left, nothing.
    expect(vtAddQuick(vt, 'car').items[2]).toEqual({ name: 'Cars', icon: 'car' });
    const named = { items: VT_ICONS.map((icon) => ({ name: VT_QUICK_NAMES[icon], icon })) };
    expect(vtAddQuick(named, 'car')).toBeNull();
  });

  it('offers the quick picks not on the list yet, by icon or by name', () => {
    const copy = { vehicleTypes: { items: [{ name: 'Boats' }, { name: 'SUVs & Crossovers', icon: 'suv' }, { name: 'trucks' }] } };
    expect(vtQuickPicks(copy).map((q) => q.icon)).toEqual(['car', 'sedan', 'coupe', 'sports', 'luxury', 'ev', 'convertible', 'classic', 'van', 'rv', 'motorcycle', 'fleet']);
    expect(vtQuickPicks({ vehicleTypes: { items: [{}] } })).toHaveLength(15);
    // A kind of car on the list by its name alone is not offered again.
    const kinds = { vehicleTypes: { items: [{ name: 'Supercars' }, { name: 'sedans' }] } };
    expect(vtQuickPicks(kinds).map((q) => q.icon)).toEqual(['car', 'coupe', 'luxury', 'ev', 'convertible', 'classic', 'suv', 'truck', 'van', 'boat', 'rv', 'motorcycle', 'fleet']);
  });
});

describe('VehicleTypesPanel', () => {
  it('offers to add the section while it is off', () => {
    const html = decode(panel({}));
    expect(html).toContain('+ Add a Vehicle Types section');
    expect(decode(panel({ hiddenSections: ['vehicleTypes'] }))).toContain('This section is switched off in Sections.');
  });

  it('lists each card with its name, line, icon picker and what it still needs', () => {
    const html = decode(panel({ vehicleTypes: { items: [{ name: 'Boats' }, { desc: 'Pontoons' }] } }));
    expect(html).toContain(`placeholder="${VT_DEFAULTS.title}"`);
    expect(html).toContain('value="Boats"');
    expect(html).toContain('Vehicle 2');
    // The picker: Auto (the icon from the name) picked, then every icon.
    expect(html).toContain('aria-label="Automatic (Boat, from the name)"');
    expect((html.match(/role="radio"/g) || []).length).toBe(2 * 16);
    expect(html).toContain('aria-label="Electric (EV)"');
    expect(html).toMatch(/aria-checked="true" aria-label="Automatic \(Boat/);
    expect(html.split('Not on your site yet: it needs a name.').length - 1).toBe(1);
    expect(html).toContain('Quick add:');
    expect(html).toContain('Remove this section');
  });
});
