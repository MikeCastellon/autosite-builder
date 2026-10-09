// The Comparison band (kit/comparison.js + kit/Comparison.jsx): what each
// cell says (never a made-up "No"), which rows show (the published page:
// labelled rows only; the editor: every row), the limits, the column labels
// and heading, the table's markup and accessibility, its editor-only states,
// and comparisonCss's hygiene (the same checks blocks.test.jsx runs on the
// other blocks' CSS) and narrow-container layout.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComparisonBand, comparisonCss, CMP_LABELS } from './Comparison.jsx';
import {
  CMP_LIMITS, CMP_SECTION, CMP_TAB, CMP_DEFAULTS, CMP_HINTS, comparisonCell, comparisonOf, comparisonHeading,
} from './comparison.js';
import { EditorModeProvider } from './EditorMode.jsx';

const band = (props, editor = false) => {
  const el = createElement(ComparisonBand, { ns: 'xx-cmp', order: 5, ...props, editor });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, null, el) : el);
};
const count = (s, needle) => s.split(needle).length - 1;
// Text as a reader sees it (React escapes > & ' " in text and attributes).
const decode = (html) => html.replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const sectionTag = (html) => (html.match(/^<section\b[^>]*>/) || [''])[0];
const visibleText = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const chars = (s) => Array.from(s).length;
const BANNED = /Verified (Customer|Review|Buyer)|Real Reviews|5\.0 (Google )?Rating|Open Now|[★☆⭐]|100% Satisf|Satisfaction Guarantee|Top[- ]Rated|(5|Five)[- ]Star|Certified|Guarantee/i;
const WALTS = "Walt's Mobile Detailing";

const ROWS = {
  title: 'Why a Mobile Detail',
  intro: 'A detailer in your driveway, next to a trip through the tunnel.',
  rows: [
    { label: 'Comes to you', us: true, them: false },
    { label: 'Hand wash and hand-applied wax', us: true, them: false },
    { label: 'Brushes that touch your paint', us: false, them: true },
    { label: 'Who does the work', us: 'A trained detailer', them: 'A machine' },
    { label: 'Ceramic coating', us: 'From $499' },
  ],
};
// The rows of a rendered table: [[header, cell, cell], ...] as markup.
const bodyRows = (html) => [...html.slice(html.indexOf('<tbody>')).matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/g)].map((m) => m[1]);

describe('comparisonCell', () => {
  it('true is a check, false a dash, words are the owner\'s text', () => {
    expect(comparisonCell(true)).toEqual({ kind: 'yes', text: '' });
    expect(comparisonCell(false)).toEqual({ kind: 'no', text: '' });
    expect(comparisonCell('  From\n$49 ')).toEqual({ kind: 'text', text: 'From $49' });
    expect(comparisonCell(3)).toEqual({ kind: 'text', text: '3' });
  });

  it('an empty or unreadable cell stays empty: it never becomes a "No"', () => {
    for (const v of [undefined, null, '', '   ', {}, [], NaN, Infinity]) expect(comparisonCell(v)).toEqual({ kind: 'empty', text: '' });
  });

  it('text that only says yes or no is that mark', () => {
    for (const v of ['Yes', ' yes ', 'YES', 'true', '✓', '✔', '✔️', '✅', '☑']) expect(comparisonCell(v).kind, v).toBe('yes');
    for (const v of ['No', 'no', 'false', '—', '–', '-', '−', '✗', '✘', '×', '❌']) expect(comparisonCell(v).kind, v).toBe('no');
    for (const v of ['Yes, always', 'x', 'Sometimes', 'Not really']) expect(comparisonCell(v).kind, v).toBe('text');
  });

  it('clips text past CMP_LIMITS.cell at a word, with an ellipsis', () => {
    const { kind, text } = comparisonCell('Hand applied in the shade by a trained detailer every time');
    expect(kind).toBe('text');
    expect(chars(text)).toBeLessThanOrEqual(40);
    expect(text).toBe('Hand applied in the shade by a trained…');
  });
});

describe('comparisonOf', () => {
  it('is off (null) unless copy.comparison is an object', () => {
    for (const v of [undefined, null, '', 'yes', 42, true, [], [{ label: 'x' }]]) {
      expect(comparisonOf(v)).toBeNull();
      expect(comparisonOf(v, { editor: true, businessName: WALTS })).toBeNull();
    }
    expect(comparisonOf({})).toEqual({ title: '', intro: '', usLabel: 'Us', themLabel: 'Automated car wash', rows: [], labelled: 0 });
  });

  it('labels the columns: the owner\'s, else the business name (or "Us"), else the design\'s', () => {
    expect(comparisonOf({}, { businessName: `  ${WALTS} ` })).toMatchObject({ usLabel: WALTS, themLabel: CMP_DEFAULTS.themLabel });
    expect(comparisonOf({ usLabel: ' Walt\'s ', themLabel: ' Gas station wash ' }, { businessName: WALTS })).toMatchObject({ usLabel: "Walt's", themLabel: 'Gas station wash' });
    expect(comparisonOf({ usLabel: '   ' }, { businessName: 7 }).usLabel).toBe('7');
    const longName = 'Walt and Sons Premium Mobile Auto Detailing and Ceramic Coating of Tampa Bay';
    const { usLabel } = comparisonOf({}, { businessName: longName });
    expect(chars(usLabel)).toBeLessThanOrEqual(40);
    expect(usLabel).toBe('Walt and Sons Premium Mobile Auto…');
  });

  it('publishes labelled rows only; the editor gets every row, flagged', () => {
    const cmp = { rows: [{ label: ' Comes to you ', us: true, them: false }, { us: true, them: 'Sometimes' }, 'junk', null, { label: 'Interior', us: 'Yes' }] };
    const pub = comparisonOf(cmp);
    expect(pub.labelled).toBe(2);
    expect(pub.rows).toEqual([
      { index: 0, label: 'Comes to you', us: { kind: 'yes', text: '' }, them: { kind: 'no', text: '' }, labelled: true },
      { index: 4, label: 'Interior', us: { kind: 'yes', text: '' }, them: { kind: 'empty', text: '' }, labelled: true },
    ]);
    const ed = comparisonOf(cmp, { editor: true });
    expect(ed.rows.map((r) => [r.index, r.labelled, r.us.kind, r.them.kind])).toEqual([
      [0, true, 'yes', 'no'], [1, false, 'yes', 'text'], [2, false, 'empty', 'empty'], [3, false, 'empty', 'empty'], [4, true, 'yes', 'empty'],
    ]);
    expect(ed.labelled).toBe(2);
  });

  it('counts the first CMP_LIMITS.rows entries only and clips text past its limit', () => {
    expect(CMP_LIMITS).toEqual({ title: 80, intro: 200, usLabel: 40, themLabel: 40, label: 80, cell: 40, rows: 10 });
    const twelve = { rows: Array.from({ length: 12 }, (_, i) => ({ label: `Row ${i}`, us: true })) };
    expect(comparisonOf(twelve).rows.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(comparisonOf(twelve, { editor: true }).rows).toHaveLength(10);
    const words = 'Hand wash with two buckets and grit guards then a hand applied wax '.repeat(6);
    const { title, intro, rows: [row] } = comparisonOf({ title: words, intro: words, rows: [{ label: words }] });
    for (const [text, max] of [[title, 80], [intro, 200], [row.label, 80]]) {
      expect(chars(text)).toBeLessThanOrEqual(max);
      expect(text.endsWith('…')).toBe(true);
      expect(words.startsWith(text.slice(0, -1))).toBe(true);
    }
    expect(comparisonOf({ rows: [{ label: 'Comes\nto\tyou' }] }).rows[0].label).toBe('Comes to you');
  });
});

describe('comparisonHeading', () => {
  it('the owner\'s title / intro, else Edit > Headings, else the design\'s own', () => {
    expect(comparisonHeading({}, undefined)).toEqual({ eyebrow: CMP_DEFAULTS.eyebrow, title: CMP_DEFAULTS.title, accent: '', intro: '' });
    const st = { comparison: { eyebrow: 'Why us', title: 'Us vs. Them', accent: 'Us', intro: 'Side by side.' } };
    expect(comparisonHeading({}, st)).toEqual({ eyebrow: 'Why us', title: 'Us vs. Them', accent: 'Us', intro: 'Side by side.' });
    expect(comparisonHeading({ title: 'Why Us.', intro: 'Own.' }, st)).toEqual({ eyebrow: 'Why us', title: 'Why Us.', accent: 'Us', intro: 'Own.' });
    expect(comparisonHeading({}, {}, { title: 'The Difference', eyebrow: '' })).toEqual({ eyebrow: '', title: 'The Difference', accent: '', intro: '' });
    expect(comparisonHeading(5, 'x', [])).toEqual(comparisonHeading({}, undefined));
  });

  it('names the section, tab, defaults, hints and marks', () => {
    expect(CMP_SECTION).toBe('comparison');
    expect(CMP_TAB).toBe('Comparison');
    expect(CMP_DEFAULTS).toEqual({ eyebrow: 'The Difference', title: 'How We Compare', usLabel: 'Us', themLabel: 'Automated car wash' });
    for (const h of Object.values(CMP_HINTS)) expect(h).toContain('Edit > Comparison');
    for (const d of Object.values(CMP_DEFAULTS)) expect(d).not.toMatch(BANNED);
    expect(CMP_LABELS).toEqual({ yes: 'Yes', no: 'No' });
  });
});

describe('ComparisonBand', () => {
  it('renders nothing while the band is off, or published without a labelled row', () => {
    for (const editor of [false, true]) expect(band({ comparison: null }, editor)).toBe('');
    expect(band({ comparison: {} })).toBe('');
    expect(band({ comparison: { rows: [{ us: true, them: false }] } })).toBe('');
  });

  it('published: a real table, its caption the heading, named by the title', () => {
    const html = band({ comparison: ROWS, businessName: WALTS, className: 'xx-section', wrapClassName: 'xx-wrap' });
    expect(sectionTag(html)).toBe('<section data-section="comparison" id="comparison" class="xx-cmp-band xx-section" aria-labelledby="xx-cmp-h" style="order:5">');
    expect(html).toContain(
      '<div class="xx-wrap"><table class="xx-cmp-table" aria-labelledby="xx-cmp-h" data-acg-reveal="">'
      + '<caption class="xx-cmp-caption"><div class="xx-cmp-head"><p class="xx-cmp-eyebrow">The Difference</p><h2 id="xx-cmp-h" class="xx-cmp-title">Why a Mobile Detail</h2><p class="xx-cmp-intro">A detailer in your driveway, next to a trip through the tunnel.</p></div></caption>'
      + '<thead><tr><td class="xx-cmp-corner"></td><th scope="col" class="xx-cmp-col xx-cmp-us">Walt&#x27;s Mobile Detailing</th><th scope="col" class="xx-cmp-col xx-cmp-them">Automated car wash</th></tr></thead><tbody>',
    );
    expect(html).not.toMatch(/data-acg-editor-only|xx-cmp-todo|xx-cmp-hint/);
    expect(visibleText(html)).not.toMatch(/Edit >|Edit panel/);
    expect(visibleText(html)).not.toMatch(BANNED);
  });

  it('marks are icons with visually hidden "Yes" / "No"; words print; an empty cell stays empty', () => {
    const rows = bodyRows(band({ comparison: ROWS, businessName: WALTS }));
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatch(/^<th scope="row" class="xx-cmp-row">Comes to you<\/th><td class="xx-cmp-cell xx-cmp-us"><svg class="xx-cmp-yes" viewBox="0 0 24 24" width="22" height="22" [^>]*aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"><\/path><\/svg><span class="xx-cmp-sr">Yes<\/span><\/td><td class="xx-cmp-cell xx-cmp-them"><svg class="xx-cmp-no" [^>]*aria-hidden="true" focusable="false"><path d="M5 12h14"><\/path><\/svg><span class="xx-cmp-sr">No<\/span><\/td>$/);
    expect(rows[2]).toContain('<td class="xx-cmp-cell xx-cmp-us"><svg class="xx-cmp-no"');
    expect(rows[2]).toContain('<td class="xx-cmp-cell xx-cmp-them"><svg class="xx-cmp-yes"');
    expect(rows[3]).toContain('<td class="xx-cmp-cell xx-cmp-us"><span class="xx-cmp-txt">A trained detailer</span></td><td class="xx-cmp-cell xx-cmp-them"><span class="xx-cmp-txt">A machine</span></td>');
    expect(rows[4]).toContain('<td class="xx-cmp-cell xx-cmp-us"><span class="xx-cmp-txt">From $499</span></td><td class="xx-cmp-cell xx-cmp-them"></td>');
    // What a screen reader reads, row by row.
    expect(rows.map(visibleText)).toEqual([
      'Comes to you Yes No', 'Hand wash and hand-applied wax Yes No', 'Brushes that touch your paint No Yes', 'Who does the work A trained detailer A machine', 'Ceramic coating From $499',
    ]);
  });

  it('headers: two column headers, one row header per row, caption first', () => {
    const html = band({ comparison: ROWS });
    expect(count(html, '<th scope="col"')).toBe(2);
    expect(count(html, '<th scope="row"')).toBe(5);
    expect(count(html, '<th ')).toBe(7);
    for (const r of bodyRows(html)) {
      expect(count(r, '<th ')).toBe(1);
      expect(count(r, '<td ')).toBe(2);
    }
    expect(html).toMatch(/<table [^>]*><caption /);
    expect(count(html, '<h2')).toBe(1);
    // No business name: the column is "Us".
    expect(html).toContain('<th scope="col" class="xx-cmp-col xx-cmp-us">Us</th>');
  });

  it('the editor shows an unlabelled row as an editor-only row naming the tab', () => {
    const cmp = { rows: [{ label: 'Comes to you', us: true, them: false }, { us: true, them: 'Sometimes' }] };
    const html = band({ comparison: cmp }, true);
    expect(sectionTag(html)).not.toContain('data-acg-editor-only');
    const rows = bodyRows(html);
    expect(rows).toHaveLength(2);
    expect(html).toContain('<tr class="xx-cmp-todo" data-acg-editor-only=""><th scope="row" class="xx-cmp-row">');
    expect(decode(rows[1])).toContain(`<th scope="row" class="xx-cmp-row">${CMP_HINTS.noLabel}</th>`);
    expect(rows[1]).toContain('<span class="xx-cmp-txt">Sometimes</span>');
    // The same data published: one row, no hint.
    const pub = band({ comparison: cmp });
    expect(bodyRows(pub)).toHaveLength(1);
    expect(pub).not.toMatch(/data-acg-editor-only|Sometimes|Edit &gt;|Edit >/);
  });

  it('with no labelled row the editor shows the whole band as editor-only; empty, the heading and the hint', () => {
    const empty = band({ comparison: {} }, true);
    expect(sectionTag(empty)).toContain('data-acg-editor-only=""');
    expect(empty).not.toContain('<table');
    expect(decode(empty)).toContain(`<div class="xx-cmp-head"><p class="xx-cmp-eyebrow">${CMP_DEFAULTS.eyebrow}</p><h2 id="xx-cmp-h" class="xx-cmp-title">${CMP_DEFAULTS.title}</h2></div><p class="xx-cmp-hint" data-acg-editor-only="">${CMP_HINTS.empty}</p>`);
    const unlabelled = band({ comparison: { rows: [{ us: true }] } }, true);
    expect(sectionTag(unlabelled)).toContain('data-acg-editor-only=""');
    expect(unlabelled).toContain('<table');
    expect(unlabelled).not.toContain('xx-cmp-hint');
  });

  it('takes the theme\'s heading (in the caption), hints, labels and section id', () => {
    const own = band({ comparison: ROWS, id: 'compare', labelledBy: 'th-h', heading: <h2 id="th-h">Theme heading</h2>, labels: { yes: 'Sí', no: 'No' } });
    expect(sectionTag(own)).toContain('id="compare"');
    expect(sectionTag(own)).toContain('aria-labelledby="th-h"');
    expect(own).toContain('<table class="xx-cmp-table" aria-labelledby="th-h" data-acg-reveal=""><caption class="xx-cmp-caption"><h2 id="th-h">Theme heading</h2></caption>');
    expect(own).toContain('<span class="xx-cmp-sr">Sí</span>');
    expect(own).not.toContain('xx-cmp-head');
    // heading={null}: no caption and no dangling name.
    const bare = band({ comparison: ROWS, heading: null });
    expect(bare).not.toMatch(/<caption|aria-labelledby/);
    const hints = band({ comparison: {}, heading: null, hints: <p className="th-hint">Theme hint</p> }, true);
    expect(hints).toContain('<div><p class="th-hint">Theme hint</p></div>');
    // Edit > Headings: eyebrow and highlighted words from copy.sectionTitles.
    const st = band({ comparison: { rows: ROWS.rows }, sectionTitles: { comparison: { title: 'Why a Mobile Detail', accent: 'Mobile Detail' } } });
    expect(st).toContain('<h2 id="xx-cmp-h" class="xx-cmp-title">Why a <span class="xx-cmp-em">Mobile Detail</span></h2>');
  });

  it('keeps every class it renders in its namespace', () => {
    const html = band({ comparison: { rows: [...ROWS.rows, {}] } }, true);
    for (const m of html.matchAll(/class="([^"]+)"/g)) {
      for (const c of m[1].split(' ')) expect(c.startsWith('xx-cmp-'), c).toBe(true);
    }
    for (const m of html.matchAll(/\bid="([^"]+)"/g)) expect(['comparison', 'xx-cmp-h']).toContain(m[1]);
  });
});

// A tiny CSS reader: every rule with its selector and the at-rules around it
// (blocks.test.jsx's).
function cssRules(css) {
  const out = [];
  const stack = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') {
      if (stack.length === 0) throw new Error('unbalanced }');
      const prelude = stack.pop();
      if (buf.trim()) out.push({ selector: prelude, body: buf.trim(), at: [...stack] });
      buf = '';
    } else buf += ch;
  }
  if (stack.length) throw new Error('unbalanced {');
  return out;
}

describe('comparisonCss', () => {
  const ns = 'xx-cmp';
  const css = comparisonCss(ns);
  const rules = cssRules(css);
  const rule = (sel, at = []) => rules.find((r) => r.selector === sel && r.at.join('|') === at.join('|'));
  const WIDE = ['@container (min-width:601px)'];
  const pct = (body) => Number((body.match(/(?:^|;)width:(\d+)%/) || [])[1]);

  it('is non-empty, balanced and free of comments and Redline names', () => {
    expect(rules.length).toBeGreaterThan(5);
    expect(css).not.toContain('/*');
    expect(css).not.toMatch(/\brl-|--rl-/);
  });

  it('has no hard-coded colors but black / white and neutral translucent overlays', () => {
    const hexes = [...css.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi)].map((m) => m[0].toLowerCase());
    expect(hexes.filter((h) => !['#fff', '#ffffff', '#000', '#000000'].includes(h))).toEqual([]);
    for (const m of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/gi)) {
      expect(m[1] === m[2] && m[2] === m[3] && m[4] !== undefined && Number(m[4]) < 1, m[0]).toBe(true);
    }
    expect(css).not.toMatch(/\b(hsl|oklch|lab)\(/i);
  });

  it('has no hover state and no motion of its own (the page runtime fades the table in)', () => {
    expect(css).not.toMatch(/:hover|transition|animation|@keyframes/);
  });

  it('uses container breakpoints only', () => {
    expect(css).not.toMatch(/@media/);
    for (const r of rules) for (const at of r.at) expect(at).toMatch(/^@container \(min-width:\d+px\)$/);
  });

  it(`names every class and variable in the ${ns}- namespace`, () => {
    for (const r of rules) {
      for (const m of r.selector.matchAll(/[.#](-?[_a-zA-Z][\w-]*)/g)) expect(m[1].startsWith(`${ns}-`), r.selector).toBe(true);
    }
    for (const m of css.matchAll(/var\(--([\w-]+)/g)) expect(m[1].startsWith(`${ns}-`), m[0]).toBe(true);
  });

  it('never widens the page: a full-width fixed table whose words break anywhere', () => {
    const table = rule(`.${ns}-table`).body;
    for (const d of ['width:100%', `max-width:var(--${ns}-max,1000px)`, 'table-layout:fixed', 'border-collapse:separate', 'border-spacing:0']) expect(table).toContain(d);
    for (const sel of ['row', 'col', 'txt']) expect(rule(`.${ns}-${sel}`).body).toContain('overflow-wrap:anywhere');
    // Three columns that add up, narrow and wide.
    expect(pct(rule(`.${ns}-corner`).body) + 2 * pct(rule(`.${ns}-col`).body)).toBe(100);
    expect(pct(rule(`.${ns}-corner`, WIDE).body) + 2 * pct(rule(`.${ns}-col`, WIDE).body)).toBe(100);
    // A third per column on a phone: at 30% Sporty's spaced "AUTOMATED" split mid-word at 390px.
    expect(pct(rule(`.${ns}-col`).body)).toBeGreaterThanOrEqual(33);
    // Narrow: smaller type and tighter cells than from 601px.
    expect(rule(`.${ns}-table`).body).toContain('font-size:14px');
    expect(rule(`.${ns}-table`, WIDE).body).toContain('font-size:16px');
    expect(rule(`.${ns}-cell`).body).toContain('padding:14px 6px');
    expect(rule(`.${ns}-cell`, WIDE).body).toContain('padding:20px 16px');
  });

  it('puts the caption (the heading) on top, left-aligned, and hides the marks\' words visually only', () => {
    expect(rule(`.${ns}-caption`).body).toMatch(/caption-side:top;.*text-align:left/);
    const sr = rule(`.${ns}-sr`).body;
    for (const d of ['position:absolute', 'width:1px', 'height:1px', 'overflow:hidden', 'clip:rect(0,0,0,0)', 'white-space:nowrap']) expect(sr).toContain(d);
    expect(sr).not.toMatch(/display:none|visibility:hidden/);
  });

  it('outlines and tints the business\'s column from block variables', () => {
    expect(rule(`.${ns}-col.${ns}-us`).body).toContain(`background:var(--${ns}-us-head-bg);color:var(--${ns}-us-head-text)`);
    const cell = rule(`.${ns}-cell.${ns}-us`).body;
    expect(cell).toContain(`border-right:2px solid var(--${ns}-us-line);border-left:2px solid var(--${ns}-us-line)`);
    expect(cell).toContain(`background:var(--${ns}-us-bg);color:var(--${ns}-us-text)`);
    expect(rule(`.${ns}-table tbody tr:last-child .${ns}-cell.${ns}-us`).body).toContain(`border-bottom:2px solid var(--${ns}-us-line)`);
    expect(rule(`.${ns}-us .${ns}-yes`).body).toBe(`color:var(--${ns}-us-yes,var(--${ns}-us-text))`);
    expect(rule(`.${ns}-no`).body).toBe(`color:var(--${ns}-no,var(--${ns}-muted))`);
  });
});
