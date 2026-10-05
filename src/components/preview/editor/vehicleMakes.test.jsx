// Vehicle Makes tab: the helpers agree with the kit's vehicleMakesFor (what
// the band shows), never write [] and keep the owner's order; the panel
// renders on the server (node, no DOM).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VEHICLE_MAKES, vehicleMakesFor } from '../templates/kit/vehicleMakes.js';
import {
  CUSTOM_MAX_LEN, MAKES_MAX,
  currentMakes, effectiveNames, isPicked, toggleMake, addCustomMake, removeMake, customNames, clearKnownMakes, firstMakes, allMakes,
} from './vehicleMakesEdit.js';
import VehicleMakesPanel, { VehicleMakesPanel as Named } from './VehicleMakesPanel.jsx';

const ALL = VEHICLE_MAKES.map((m) => m.name);
const html = (copy) => renderToStaticMarkup(createElement(VehicleMakesPanel, { copy, setCopy: () => {} }));
const count = (s, re) => (s.match(re) || []).length;
// React writes `checked` after the other input attributes.
const ticked = (s, name) => /checked=""/.test((s.match(new RegExp(`<input[^>]*aria-label="Show ${name}"[^>]*>`)) || [''])[0]);

describe('vehicleMakesEdit', () => {
  it('limits match the spec', () => {
    expect([CUSTOM_MAX_LEN, MAKES_MAX]).toEqual([30, 40]);
    expect(VEHICLE_MAKES.length).toBe(30);
  });

  it('currentMakes: null for the default, owner names otherwise', () => {
    for (const v of [null, undefined, [], '', '  ', [' ', ''], 42, {}]) expect(currentMakes(v)).toBeNull();
    expect(currentMakes('BMW, vw, Rivian')).toEqual(['BMW', 'Volkswagen', 'Rivian']);
    expect(currentMakes(['Mercedes', 'Mercedes-Benz', 'benz'])).toEqual(['Mercedes-Benz']);
    expect(currentMakes(['Rivian', 'rivian ', 'RIVIAN'])).toEqual(['Rivian']);
    expect(currentMakes(['chevy', ' Tesla '])).toEqual(['Chevrolet', 'Tesla']);
    // Same list the band shows.
    const v = ['Porsche', 'lambo', 'Rivian', 'vw'];
    expect(currentMakes(v)).toEqual(vehicleMakesFor(v).map((m) => m.name));
  });

  it('effectiveNames and isPicked', () => {
    expect(effectiveNames(null)).toEqual(ALL);
    expect(effectiveNames(['BMW'])).toEqual(['BMW']);
    expect(isPicked(null, 'Audi')).toBe(true);
    expect(isPicked(['BMW', 'Rivian'], 'Audi')).toBe(false);
    expect(isPicked(['BMW', 'Rivian'], 'bmw')).toBe(true);
    expect(isPicked(['Mercedes'], 'Mercedes-Benz')).toBe(true);
    expect(isPicked(['Rivian'], 'RIVIAN')).toBe(true);
  });

  it('toggleMake starts from the default and keeps its order', () => {
    const next = toggleMake(null, 'Audi', false);
    expect(next).toHaveLength(29);
    expect(next).toEqual(ALL.filter((n) => n !== 'Audi'));
    // Ticking appends in the owner's order.
    expect(toggleMake(next, 'Audi', true)).toEqual([...ALL.filter((n) => n !== 'Audi'), 'Audi']);
    expect(toggleMake(['BMW'], 'Tesla', true)).toEqual(['BMW', 'Tesla']);
    // Unticking the last make goes back to the default (never []).
    expect(toggleMake(['BMW'], 'BMW', false)).toBeNull();
    expect(toggleMake('BMW', 'bmw', false)).toBeNull();
    // A toggle that changes nothing returns the value as read.
    expect(toggleMake(null, 'Audi', true)).toBeNull();
    expect(toggleMake(['BMW'], 'Audi', false)).toEqual(['BMW']);
  });

  it('never mutates the stored list', () => {
    const v = ['BMW', 'Audi'];
    toggleMake(v, 'Audi', false);
    toggleMake(v, 'Tesla', true);
    addCustomMake(v, 'Rivian');
    removeMake(v, 'BMW');
    expect(v).toEqual(['BMW', 'Audi']);
  });

  it('addCustomMake adds a name or explains why not', () => {
    expect(addCustomMake(['BMW'], 'Rivian')).toEqual({ names: ['BMW', 'Rivian'] });
    expect(addCustomMake(['BMW'], '  Lucid Motors ')).toEqual({ names: ['BMW', 'Lucid Motors'] });
    // A known make typed by hand is stored under its display name.
    expect(addCustomMake(['BMW'], 'vw')).toEqual({ names: ['BMW', 'Volkswagen'] });
    expect(addCustomMake(null, 'Rivian').names).toEqual([...ALL, 'Rivian']);
    expect(addCustomMake(['BMW'], '')).toEqual({ error: 'empty' });
    expect(addCustomMake(['BMW'], '  ')).toEqual({ error: 'empty' });
    expect(addCustomMake(['BMW'], '!!')).toEqual({ error: 'empty' });
    expect(addCustomMake(['BMW'], 'x'.repeat(31))).toEqual({ error: 'long' });
    expect(addCustomMake(['BMW', 'Rivian'], 'rivian')).toEqual({ error: 'duplicate' });
    expect(addCustomMake(['BMW'], 'bmw')).toEqual({ error: 'duplicate' });
    expect(addCustomMake(null, 'Mercedes')).toEqual({ error: 'duplicate' });
    const full = Array.from({ length: 40 }, (_, i) => `Make ${i}`);
    expect(addCustomMake(full, 'Rivian')).toEqual({ error: 'full' });
    expect(addCustomMake(full.slice(0, 39), 'Rivian').names).toHaveLength(40);
  });

  it('removeMake and customNames', () => {
    expect(removeMake(['BMW', 'Rivian'], 'rivian')).toEqual(['BMW']);
    expect(removeMake(['Rivian'], 'Rivian')).toBeNull();
    expect(customNames(null)).toEqual([]);
    expect(customNames('BMW, Rivian, vw, Lucid')).toEqual(['Rivian', 'Lucid']);
  });
});

describe('VehicleMakesPanel', () => {
  it('has a default and a named export', () => {
    expect(Named).toBe(VehicleMakesPanel);
  });

  it('ticks all 30 makes by default', () => {
    const out = html({});
    expect(count(out, /type="checkbox"/g)).toBe(30);
    expect(count(out, /checked=""/g)).toBe(30);
    expect(count(out, /<svg[^>]*viewBox="0 0 24 24"/g)).toBe(30);
    expect(out).toContain('aria-label="Show Mercedes-Benz"');
    expect(out).toContain('Showing all 30 makes.');
    expect(out).not.toContain('Show all makes');
    expect(out).not.toContain('switched off in Sections');
    expect(out).not.toContain('★');
  });

  it('ticks only the owner picks and lists custom names as chips', () => {
    const out = html({ vehicleMakes: ['BMW', 'Rivian', 'Mercedes'], hiddenSections: ['brands'] });
    expect(count(out, /type="checkbox"/g)).toBe(30);
    expect(count(out, /checked=""/g)).toBe(2);
    expect(ticked(out, 'BMW')).toBe(true);
    expect(ticked(out, 'Mercedes-Benz')).toBe(true);
    expect(ticked(out, 'Audi')).toBe(false);
    expect(out).toContain('3 makes picked.');
    expect(out).toContain('Show all makes');
    expect(out).toContain('aria-label="Remove Rivian"');
    expect(out).not.toContain('aria-label="Remove BMW"');
    expect(out).toContain('This band is switched off in Sections.');
    expect(out).toContain('aria-label="Add a make"');
    expect(out).toContain('maxLength="30"');
    expect(out).not.toContain('★');
  });

  it('a legacy comma string reads like the template', () => {
    const out = html({ vehicleMakes: 'BMW, vw' });
    expect(count(out, /checked=""/g)).toBe(2);
    expect(out).toContain('2 makes picked.');
    expect(html({ vehicleMakes: ['Tesla'] })).toContain('1 make picked.');
  });
});

describe('Clear all', () => {
  it('keeps only the owner\'s own names, or nothing to save', () => {
    expect(clearKnownMakes(['BMW', 'Rivian', 'Mercedes'])).toEqual(['Rivian']);
    expect(clearKnownMakes(null)).toBe(null);
    expect(clearKnownMakes(['BMW'])).toBe(null);
    expect(firstMakes('mercedes')).toEqual(['Mercedes-Benz']);
    expect(firstMakes('Rivian ')).toEqual(['Rivian']);
    expect(firstMakes('  ')).toBe(null);
  });

  it('is offered while grid makes are ticked', () => {
    expect(html({})).toContain('>Clear all<');
    expect(html({ vehicleMakes: ['BMW', 'Rivian'] })).toContain('>Clear all<');
    // Only custom names left: nothing in the grid to clear.
    expect(html({ vehicleMakes: ['Rivian'] })).not.toContain('>Clear all<');
  });
});

// Themes whose band is opt-in (editorCapabilities VEHICLE_MAKES_DEFAULT_ALL
// false, vehicleMakesFor(copy.vehicleMakes, [])): null means no band.
describe('opt-in band (defaultAll: false)', () => {
  const opt = { defaultAll: false };
  const optHtml = (copy) => renderToStaticMarkup(createElement(VehicleMakesPanel, { copy, setCopy: () => {}, defaultAll: false }));

  it('reads null as no makes, like the template', () => {
    expect(effectiveNames(null, opt)).toEqual([]);
    expect(vehicleMakesFor(null, [])).toEqual([]);
    expect(isPicked(null, 'BMW', opt)).toBe(false);
    expect(effectiveNames(['BMW'], opt)).toEqual(['BMW']);
  });

  it('the first tick starts a list of one; the last untick removes the band', () => {
    expect(toggleMake(null, 'BMW', true, opt)).toEqual(['BMW']);
    expect(toggleMake(['BMW'], 'BMW', false, opt)).toBeNull();
    expect(toggleMake(null, 'BMW', false, opt)).toBeNull();
    expect(addCustomMake(null, 'Rivian', opt)).toEqual({ names: ['Rivian'] });
    expect(removeMake(['Rivian'], 'Rivian', opt)).toBeNull();
    expect(allMakes()).toEqual(ALL);
  });

  it('the panel says there is no band yet and offers every make', () => {
    const out = optHtml({});
    expect(out).toContain('It shows once you tick at least one make.');
    expect(out).toContain('No band yet.');
    expect(out).toContain('>Show all makes<');
    expect(out).not.toContain('>Clear all<');
    expect(out).not.toContain('Showing all 30 makes');
    for (const name of ALL) expect(ticked(out, name)).toBe(false);
  });

  it('with picks: the count and Clear all, which removes the band', () => {
    const out = optHtml({ vehicleMakes: ['BMW', 'Rivian'] });
    expect(out).toContain('2 makes picked.');
    expect(out).toContain('>Clear all<');
    expect(out).toContain('Clear all removes the band from your page.');
    expect(out).not.toContain('>Show all makes<');
    expect(ticked(out, 'BMW')).toBe(true);
    expect(ticked(out, 'Audi')).toBe(false);
  });
});
