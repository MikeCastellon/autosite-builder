// Business Info panels render on the server (node, no DOM): the per-day hours
// rows for every kind of stored day, and the areas / insured controls.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DayHoursEditor, { firstFilledDay, isLegacyHours } from './DayHoursEditor.jsx';
import BusinessExtrasPanel, { areaItems, splitServiceArea } from './BusinessExtrasPanel.jsx';
import { BY_APPOINTMENT, HOURS_DAYS } from '../../../lib/businessHours.js';

const noop = () => {};
const html = (type, props) => renderToStaticMarkup(createElement(type, props));
// React escapes quotes in text and attributes; undo that so the asserts read naturally.
const decode = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const week = (over = {}) => ({ ...Object.fromEntries(HOURS_DAYS.map((d) => [d, ''])), ...over });
const hoursHtml = (value) => decode(html(DayHoursEditor, { label: 'Business Hours', value, onChange: noop }));
// The markup of one day's row (rows are flex divs starting with the day name).
const rowOf = (out, day) => {
  const start = out.indexOf(`>${day}</span>`);
  const next = HOURS_DAYS[HOURS_DAYS.indexOf(day) + 1];
  const end = next ? out.indexOf(`>${next}</span>`) : out.length;
  return out.slice(start, end);
};

describe('DayHoursEditor', () => {
  it('shows Closed with Open and By appt. buttons for an empty day', () => {
    const row = rowOf(hoursHtml(week({ Mon: '8am-6pm' })), 'Tue');
    expect(row).toContain('Closed');
    expect(row).toContain('>Open<');
    expect(row).toContain('aria-label="Tue: by appointment"');
    expect(row).toContain('By appt.');
    expect(row).not.toContain('type="time"');
  });

  it('shows the two time inputs for a time range', () => {
    const row = rowOf(hoursHtml(week({ Mon: '8am-6pm' })), 'Mon');
    expect(row).toContain('aria-label="Mon open time"');
    expect(row).toContain('value="08:00"');
    expect(row).toContain('aria-label="Mon close time"');
    expect(row).toContain('value="18:00"');
    expect(row).toContain('aria-label="Mark Mon closed"');
    expect(row).not.toContain('Closed<');
  });

  it('keeps the time inputs while one of them is cleared', () => {
    const row = rowOf(hoursHtml(week({ Mon: '9am-' })), 'Mon');
    expect(row).toContain('value="09:00"');
    expect(row).toContain('aria-label="Mon close time"');
  });

  it('shows By appointment (any spelling) with Hours and closed buttons, never Closed', () => {
    const row = rowOf(hoursHtml(week({ Sun: 'By Appointment' })), 'Sun');
    expect(row).toContain('By appointment');
    expect(row).toContain('aria-label="Sun: set hours"');
    expect(row).toContain('aria-label="Mark Sun closed"');
    expect(row).not.toContain('Closed<');
    expect(row).not.toContain('type="time"');
  });

  it('shows old free text quoted, with its help line', () => {
    const out = hoursHtml(week({ Sat: '24 hours' }));
    const row = rowOf(out, 'Sat');
    expect(row).toContain('“24 hours”');
    expect(row).toContain('title="24 hours"');
    expect(row).toContain('aria-label="Sat: set hours"');
    expect(out).toContain('Some days hold text from your old hours; it shows on your site as written.');
    expect(hoursHtml(week({ Sat: '9am-5pm' }))).not.toContain('Some days hold text');
  });

  it('always explains By appointment', () => {
    expect(hoursHtml(week())).toContain('A By appointment day shows on your site as By appointment, never as Closed.');
    expect(hoursHtml(null)).toContain('A By appointment day shows on your site as By appointment, never as Closed.');
  });

  it('names the first filled day on the copy button (By appointment counts)', () => {
    expect(hoursHtml(week({ Wed: '9am-5pm', Fri: '8am-6pm' }))).toContain('Copy Wed to all days');
    expect(hoursHtml(week({ Tue: BY_APPOINTMENT, Wed: '9am-5pm' }))).toContain('Copy Tue to all days');
    expect(hoursHtml(week())).not.toContain('to all days');
    expect(firstFilledDay(week({ Thu: '24 hours' }))).toBe('Thu');
    expect(firstFilledDay(week())).toBe(null);
  });

  it('warns before replacing hours saved in an older format', () => {
    expect(hoursHtml('By appointment only')).toContain('saved in an older format ("By appointment only")');
    expect(hoursHtml({ 'Mon-Fri': '8am-6pm' })).toContain('("Mon-Fri 8am-6pm")');
    expect(hoursHtml(week({ Mon: '9am-5pm' }))).not.toContain('older format');
    expect(isLegacyHours('')).toBe(false);
    expect(isLegacyHours(week())).toBe(false);
    expect(isLegacyHours({ 'Mon-Fri': '8am-6pm' })).toBe(true);
  });

  it('migrates a legacy shape into the per-day shape and writes once per click', () => {
    // Drive the click handlers through the element tree (no DOM in node).
    const writes = [];
    const tree = DayHoursEditor({ label: 'Business Hours', value: 'Mon-Fri 8am-6pm', onChange: (v) => writes.push(v) });
    const buttons = [];
    const collect = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(collect); return; }
      if (node.type === 'button') buttons.push(node);
      if (typeof node.type === 'function' && node.type.name === 'ClearButton') buttons.push(node.type(node.props));
      collect(node.props?.children);
    };
    collect(tree);
    buttons.find((b) => b.props['aria-label'] === 'Sun: by appointment').props.onClick();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual({ Mon: '8am-6pm', Tue: '8am-6pm', Wed: '8am-6pm', Thu: '8am-6pm', Fri: '8am-6pm', Sat: '', Sun: BY_APPOINTMENT });
    buttons.find((b) => b.props['aria-label'] === 'Mark Mon closed').props.onClick();
    expect(writes[1].Mon).toBe('');
    expect(Object.keys(writes[1])).toEqual(HOURS_DAYS);
  });
});

describe('DayHoursEditor round r1', () => {
  it('prints the range on the day line, offers By appt. on open days, and puts the time inputs under it', () => {
    const row = rowOf(hoursHtml(week({ Mon: '8am-6pm' })), 'Mon');
    expect(row).toContain('>8am – 6pm<');
    expect(row).toContain('title="8:00 AM – 6:00 PM"');
    expect(row).toContain('aria-label="Mon: by appointment"');
    // The inputs come after the day line, on their own.
    expect(row.indexOf('aria-label="Mark Mon closed"')).toBeLessThan(row.indexOf('aria-label="Mon open time"'));
    expect(row).toContain('min-w-[5.5rem]');
  });

  it('keeps a day an older text says is by appointment, instead of Closed', () => {
    const out = hoursHtml('Mon-Fri 8am-6pm, Sat by appointment');
    const sat = rowOf(out, 'Sat');
    expect(sat).toContain('By appointment');
    expect(sat).not.toContain('Closed<');
    expect(rowOf(out, 'Fri')).toContain('value="08:00"');
    expect(rowOf(out, 'Sun')).toContain('Closed');
    expect(out).toContain('older format');
  });
});

describe('BusinessExtrasPanel', () => {
  const panel = (businessInfo, extra = {}) => decode(html(BusinessExtrasPanel, { businessInfo, setBiz: noop, ...extra }));

  it('lists area rows from an array, and from an older string', () => {
    const out = panel({ serviceAreas: ['Lake Nona', 'Winter Park'] });
    expect(out).toContain('value="Lake Nona"');
    expect(out).toContain('value="Winter Park"');
    expect(out).toContain('aria-label="area 2"');
    expect(out).toContain('+ Add area');
    const legacy = panel({ serviceAreas: 'Orlando, Kissimmee · Apopka' });
    expect(legacy).toContain('value="Orlando"');
    expect(legacy).toContain('value="Kissimmee"');
    expect(legacy).toContain('value="Apopka"');
    expect(areaItems(null)).toEqual([]);
    expect(areaItems(['A', null, ''])).toEqual(['A', '', '']);
  });

  it('shows the service area line with its help', () => {
    const out = panel({ serviceArea: 'Orlando and surrounding areas' });
    expect(out).toContain('Service area');
    expect(out).toContain('value="Orlando and surrounding areas"');
    expect(out).toContain('placeholder="e.g. Orlando and surrounding areas"');
    expect(out).toContain('One line about where you work.');
    expect(out).toContain('Leave empty to use the Service area line.');
  });

  it('offers the places from the service area line only when it splits and the list is empty', () => {
    expect(panel({ serviceArea: 'Orlando, Lake Nona, Winter Park' })).toContain('Use the 3 places from your Service area line');
    expect(panel({ serviceArea: 'Orlando, Lake Nona, Winter Park', serviceAreas: [''] })).toContain('Use the 3 places');
    expect(panel({ serviceArea: 'Orlando, Lake Nona, Winter Park', serviceAreas: ['Apopka'] })).not.toContain('Use the');
    expect(panel({ serviceArea: 'Orlando and surrounding areas' })).not.toContain('Use the');
    expect(panel({})).not.toContain('Use the');
    expect(splitServiceArea('Orlando; Lake Nona\nWinter Park | Orlando')).toEqual(['Orlando', 'Lake Nona', 'Winter Park']);
    expect(splitServiceArea(`Orlando, ${'x'.repeat(41)}`)).toBe(null);
    expect(splitServiceArea('Orlando')).toBe(null);
  });

  it('switches Fully insured on only for insured === true', () => {
    const on = panel({ insured: true });
    expect(on).toMatch(/aria-checked="true" aria-label="Fully insured"/);
    expect(on).toContain("Only switch this on if you carry business insurance. Your page then says 'Fully Insured'.");
    expect(panel({ insured: 'true' })).toMatch(/aria-checked="false" aria-label="Fully insured"/);
    expect(panel({})).toMatch(/aria-checked="false" aria-label="Fully insured"/);
  });

  it('hides the areas list and the insured switch when the template does not read them', () => {
    const out = panel({ serviceArea: 'Orlando, Lake Nona', serviceAreas: ['A'], insured: true }, { showAreas: false, showInsured: false });
    expect(out).toContain('Service area');
    expect(out).not.toContain('Areas served');
    expect(out).not.toContain('Use the');
    expect(out).not.toContain('Fully insured');
  });
});
