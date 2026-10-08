// Edit > Comparison: cells are Yes (true) / No (false) / a short text /
// empty (left out, never a made-up "No"), as the band reads them
// (kit/comparison.js); rows count up to ten and publish once labelled; the
// panel renders on the server.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CMP_LIMITS, CMP_DEFAULTS, comparisonOf } from '../templates/kit/comparison.js';
import {
  CMP_TITLE_MAX, CMP_INTRO_MAX, CMP_COLUMN_MAX, CMP_LABEL_MAX, CMP_CELL_MAX, CMP_MAX_ROWS, CELL_MODES,
  cmpValue, cmpStart, cmpRows, cellMode, cellText, columnPlaceholders,
  cmpSetText, cmpSetLabel, cmpSetCell, cmpAddRow, cmpRemoveRow, cmpMoveRow,
} from './comparisonEdit.js';
import ComparisonPanel from './ComparisonPanel.jsx';

const noop = () => {};
const panel = (copy, businessName = "Walt's Mobile Detailing") => renderToStaticMarkup(createElement(ComparisonPanel, { copy, setCopy: noop, confirm: async () => true, businessName, hasHeadingsTab: true }));
const decode = (html) => html.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

describe('comparisonEdit', () => {
  it('limits are the band\'s', () => {
    expect([CMP_TITLE_MAX, CMP_INTRO_MAX, CMP_COLUMN_MAX, CMP_LABEL_MAX, CMP_CELL_MAX, CMP_MAX_ROWS])
      .toEqual([CMP_LIMITS.title, CMP_LIMITS.intro, CMP_LIMITS.usLabel, CMP_LIMITS.label, CMP_LIMITS.cell, CMP_LIMITS.rows]);
    expect(CELL_MODES.map((m) => m.id)).toEqual(['yes', 'no', 'text', 'blank']);
  });

  it('reads the band as on only for an object, and starts it with one row', () => {
    for (const v of [undefined, null, 'x', [], 3]) expect(cmpValue({ comparison: v })).toBeNull();
    expect(cmpStart()).toEqual({ rows: [{}] });
    expect(cmpRows({})).toEqual([]);
  });

  it('reads a cell the way the page does', () => {
    expect([true, false, 'From $49', 'Yes', '—', '', null, undefined, {}].map(cellMode)).toEqual(['yes', 'no', 'text', 'yes', 'no', 'blank', 'blank', 'blank', 'blank']);
    expect(cellText('From $49')).toBe('From $49');
    expect(cellText(true)).toBe('');
    expect(cellText('Yes')).toBe('');
  });

  it('writes each mode: Yes true, No false, text as typed, empty left out', () => {
    const cmp = { rows: [{ label: 'Comes to you' }] };
    expect(cmpSetCell(cmp, 0, 'us', 'yes')).toEqual({ rows: [{ label: 'Comes to you', us: true }] });
    expect(cmpSetCell(cmp, 0, 'them', 'no')).toEqual({ rows: [{ label: 'Comes to you', them: false }] });
    expect(cmpSetCell(cmp, 0, 'us', 'text', 'From $49 ')).toEqual({ rows: [{ label: 'Comes to you', us: 'From $49 ' }] });
    expect(cmpSetCell({ rows: [{ label: 'A', us: false }] }, 0, 'us', 'blank')).toEqual({ rows: [{ label: 'A' }] });
    expect(cmpSetCell(cmp, 0, 'us', 'text', '')).toEqual(cmp);
    expect(cmpSetCell(cmp, 0, 'label', 'yes')).toBe(cmp);
    // The band reads what was written.
    const next = cmpSetCell(cmpSetCell(cmp, 0, 'us', 'yes'), 0, 'them', 'no');
    expect(comparisonOf(next).rows[0]).toMatchObject({ us: { kind: 'yes' }, them: { kind: 'no' } });
  });

  it('lists the rows the band counts, labelled as the page reads them', () => {
    const copy = { comparison: { rows: [{ label: 'Comes to you', us: true, them: false }, { label: '  ', us: true }, 'junk'] } };
    expect(cmpRows(copy)).toEqual([
      { index: 0, label: 'Comes to you', us: true, them: false, labelled: true },
      { index: 1, label: '  ', us: true, them: undefined, labelled: false },
      { index: 2, label: '', us: undefined, them: undefined, labelled: false },
    ]);
  });

  it('labels, column names, rows: add up to ten, remove, move', () => {
    expect(cmpSetLabel({ rows: [{}] }, 0, 'Interior')).toEqual({ rows: [{ label: 'Interior' }] });
    expect(cmpSetText({ rows: [] }, 'themLabel', 'Gas station wash')).toEqual({ rows: [], themLabel: 'Gas station wash' });
    let cmp = cmpStart();
    for (let n = 2; n <= CMP_MAX_ROWS; n++) cmp = cmpAddRow(cmp);
    expect(cmp.rows).toHaveLength(10);
    expect(cmpAddRow(cmp)).toBeNull();
    const two = { rows: [{ label: 'A' }, { label: 'B' }] };
    expect(cmpRemoveRow(two, 1)).toEqual({ rows: [{ label: 'A' }] });
    expect(cmpMoveRow(two, 1, 0)).toEqual({ rows: [{ label: 'B' }, { label: 'A' }] });
    expect(columnPlaceholders('  Walt\'s  ')).toEqual({ usLabel: "Walt's", themLabel: CMP_DEFAULTS.themLabel });
    expect(columnPlaceholders('')).toEqual({ usLabel: 'Us', themLabel: CMP_DEFAULTS.themLabel });
  });
});

describe('ComparisonPanel', () => {
  it('offers to add the section while it is off', () => {
    const html = decode(panel({}));
    expect(html).toContain('+ Add a Comparison section');
    expect(decode(panel({ hiddenSections: ['comparison'] }))).toContain('This section is switched off in Sections.');
  });

  it('lists each row with its label and two cell controls named after the columns', () => {
    const html = decode(panel({ comparison: { rows: [{ label: 'Comes to you', us: true, them: false }, { us: 'From $49' }] } }));
    expect(html).toContain('placeholder="Walt\'s Mobile Detailing"');
    expect(html).toContain(`placeholder="${CMP_DEFAULTS.themLabel}"`);
    // The alternative is a kind of service, never a named competitor.
    expect(html).toContain('never a real business');
    expect(html).toContain('aria-label="Row 1, your column"');
    expect(html).toContain('aria-label="Row 2, compared with"');
    // Row 1: Yes / No picked; row 2: the text box with its text.
    expect(html).toMatch(/aria-label="Row 1, your column"><button type="button" role="radio" aria-checked="true"[^>]*>Yes</);
    expect(html).toMatch(/aria-label="Row 1, compared with"><button[^>]*aria-checked="false"[^>]*>Yes<\/button><button[^>]*aria-checked="true"[^>]*>No</);
    expect(html).toContain('value="From $49"');
    expect(html.split('Not on your site yet: it needs a label.').length - 1).toBe(1);
    expect(html).toContain('+ Add a row');
    expect(html).toContain('Remove this section');
  });
});
