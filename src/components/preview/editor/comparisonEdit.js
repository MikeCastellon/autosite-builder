// Pure helpers behind ComparisonPanel (Edit > Comparison). The band's data
// (kit/comparison.js) is copy.comparison = { title?, intro?, usLabel?,
// themLabel?, rows: [{ label, us, them }] }: on while copy.comparison is an
// object, and the published page shows a row only once it has a label. A
// cell is true (a check, "Yes"), false (a dash, "No"), a short text, or
// left out (an empty cell: the page never turns it into a "No").
import { CMP_LIMITS, CMP_DEFAULTS, comparisonCell, comparisonOf } from '../templates/kit/comparison.js';
import { bandValue, bandEntries, bandSetText, bandSetField, bandAdd, bandRemove, bandMove } from './bandListEdit.js';

export const CMP_TITLE_MAX = CMP_LIMITS.title;
export const CMP_INTRO_MAX = CMP_LIMITS.intro;
export const CMP_COLUMN_MAX = CMP_LIMITS.usLabel;
export const CMP_LABEL_MAX = CMP_LIMITS.label;
export const CMP_CELL_MAX = CMP_LIMITS.cell;
export const CMP_MAX_ROWS = CMP_LIMITS.rows;

const LIST = 'rows';

// A cell's choices in the tab, in the order the panel offers them.
export const CELL_MODES = Object.freeze([
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
  { id: 'text', label: 'Text' },
  { id: 'blank', label: 'Empty' },
]);

// copy.comparison while the band is on, else null.
export const cmpValue = (copy) => bandValue(copy, 'comparison');

// What "Add a Comparison section" saves: the band on, with one row to fill.
export function cmpStart() {
  return { rows: [{}] };
}

// What a stored cell is in the tab: 'yes' / 'no' (also text that only says
// so, as the page reads it), 'text', or 'blank'.
export function cellMode(value) {
  const kind = comparisonCell(value).kind;
  return kind === 'empty' ? 'blank' : kind;
}

// A cell's text while it is a text cell ('' otherwise).
export const cellText = (value) => (cellMode(value) === 'text' && typeof value !== 'boolean' ? String(value) : '');

// The tab's rows: [{ index, label, us, them, labelled }]: label as typed,
// us / them the stored cells.
export function cmpRows(copy) {
  const cmp = cmpValue(copy);
  if (!cmp) return [];
  const shown = comparisonOf(cmp, { editor: true }).rows;
  return bandEntries(cmp, LIST, CMP_MAX_ROWS).map((e, i) => ({
    index: i,
    label: typeof e.label === 'string' ? e.label : '',
    us: e.us,
    them: e.them,
    labelled: Boolean(shown[i]?.labelled),
  }));
}

// The column labels' placeholders: what the page prints while they are
// empty (the business name, else "Us"; the design's alternative).
export function columnPlaceholders(businessName) {
  const name = typeof businessName === 'string' ? businessName.replace(/\s+/g, ' ').trim() : '';
  return { usLabel: name || CMP_DEFAULTS.usLabel, themLabel: CMP_DEFAULTS.themLabel };
}

// copy.comparison with 'title', 'intro', 'usLabel' or 'themLabel' set.
export const cmpSetText = (cmp, key, value) => bandSetText(cmp, LIST, key, value);
// copy.comparison with row `index`'s label set.
export const cmpSetLabel = (cmp, index, value) => bandSetField(cmp, LIST, CMP_MAX_ROWS, index, 'label', value);

// copy.comparison with row `index`'s 'us' or 'them' cell set to a mode:
// 'yes' (true), 'no' (false), 'text' (the text; '' leaves the cell empty),
// anything else empty.
export function cmpSetCell(cmp, index, side, mode, text = '') {
  if (side !== 'us' && side !== 'them') return cmp;
  const value = mode === 'yes' ? true : mode === 'no' ? false : mode === 'text' ? String(text ?? '') : null;
  return bandSetField(cmp, LIST, CMP_MAX_ROWS, index, side, value);
}

// One more empty row, or null when it holds ten.
export const cmpAddRow = (cmp) => bandAdd(cmp, LIST, CMP_MAX_ROWS);
export const cmpRemoveRow = (cmp, index) => bandRemove(cmp, LIST, CMP_MAX_ROWS, index);
export const cmpMoveRow = (cmp, from, to) => bandMove(cmp, LIST, CMP_MAX_ROWS, from, to);
