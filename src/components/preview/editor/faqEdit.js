// Pure helpers behind FaqPanel (Edit > FAQ). The band's data (kit/faq.js)
// is copy.faq = { title?, intro?, items: [{ q, a }] }: on while copy.faq is
// an object, and the published page shows an item only once it has both a
// question and an answer. The tab lists the items the page counts (the
// first FAQ_LIMITS.items), and says which still need something with the
// kit's own reading of them, so the tab and the page always agree.
import { FAQ_LIMITS, faqItems } from '../templates/kit/faq.js';
import { bandValue, bandEntries, bandSetText, bandSetField, bandAdd, bandRemove, bandMove } from './bandListEdit.js';

export const FAQ_TITLE_MAX = FAQ_LIMITS.title;
export const FAQ_INTRO_MAX = FAQ_LIMITS.intro;
export const FAQ_Q_MAX = FAQ_LIMITS.q;
export const FAQ_A_MAX = FAQ_LIMITS.a;
export const FAQ_MAX_ITEMS = FAQ_LIMITS.items;

const LIST = 'items';

// copy.faq while the band is on, else null.
export const faqValue = (copy) => bandValue(copy, 'faq');

// What "Add a FAQ section" saves: the band on, with one empty question to
// fill (the editor shows it, the page waits for its answer).
export function faqStart() {
  return { items: [{}] };
}

// The tab's rows: [{ index, q, a, complete }], q / a as typed.
export function faqRows(copy) {
  const faq = faqValue(copy);
  if (!faq) return [];
  const shown = faqItems(faq, { editor: true }).items;
  return bandEntries(faq, LIST, FAQ_MAX_ITEMS).map((e, i) => ({
    index: i,
    q: typeof e.q === 'string' ? e.q : '',
    a: typeof e.a === 'string' ? e.a : '',
    complete: Boolean(shown[i]?.complete),
  }));
}

// copy.faq with its heading ('title') or intro ('intro') set.
export const faqSetText = (faq, key, value) => bandSetText(faq, LIST, key, value);
// copy.faq with item `index`'s question ('q') or answer ('a') set.
export const faqSetItem = (faq, index, key, value) => bandSetField(faq, LIST, FAQ_MAX_ITEMS, index, key, value);
// copy.faq with one more empty question, or null when it holds twelve.
export const faqAddItem = (faq) => bandAdd(faq, LIST, FAQ_MAX_ITEMS);
export const faqRemoveItem = (faq, index) => bandRemove(faq, LIST, FAQ_MAX_ITEMS, index);
export const faqMoveItem = (faq, from, to) => bandMove(faq, LIST, FAQ_MAX_ITEMS, from, to);
