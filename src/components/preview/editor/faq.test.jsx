// Edit > FAQ: the helpers keep copy.faq in step with what the band shows
// (kit/faq.js: the first twelve items, complete ones published), the panel
// adds and removes the section, and it renders on the server (no DOM).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FAQ_LIMITS, FAQ_DEFAULTS, faqItems } from '../templates/kit/faq.js';
import {
  FAQ_TITLE_MAX, FAQ_INTRO_MAX, FAQ_Q_MAX, FAQ_A_MAX, FAQ_MAX_ITEMS,
  faqValue, faqStart, faqRows, faqSetText, faqSetItem, faqAddItem, faqRemoveItem, faqMoveItem,
} from './faqEdit.js';
import FaqPanel from './FaqPanel.jsx';

const noop = () => {};
const panel = (copy, extra = {}) => renderToStaticMarkup(createElement(FaqPanel, { copy, setCopy: noop, confirm: async () => true, hasHeadingsTab: true, ...extra }));
const decode = (html) => html.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const Q = (i) => ({ q: `Question ${i}?`, a: `Answer ${i}.` });

describe('faqEdit', () => {
  it('limits are the band\'s', () => {
    expect([FAQ_TITLE_MAX, FAQ_INTRO_MAX, FAQ_Q_MAX, FAQ_A_MAX, FAQ_MAX_ITEMS]).toEqual([FAQ_LIMITS.title, FAQ_LIMITS.intro, FAQ_LIMITS.q, FAQ_LIMITS.a, FAQ_LIMITS.items]);
  });

  it('reads the band as on only for an object, and starts it with one question', () => {
    for (const v of [undefined, null, 'x', [], 3]) expect(faqValue({ faq: v })).toBeNull();
    expect(faqStart()).toEqual({ items: [{}] });
    expect(faqRows({})).toEqual([]);
    // Started: on, and the editor shows the empty question (the page nothing).
    expect(faqItems(faqStart(), { editor: true }).items).toHaveLength(1);
    expect(faqItems(faqStart()).items).toHaveLength(0);
  });

  it('lists the questions the band counts, saying which are complete as the page reads them', () => {
    const copy = { faq: { items: [Q(1), { q: 'Only a question' }, 'junk', { q: '  ', a: 'Blank question' }] } };
    expect(faqRows(copy)).toEqual([
      { index: 0, q: 'Question 1?', a: 'Answer 1.', complete: true },
      { index: 1, q: 'Only a question', a: '', complete: false },
      { index: 2, q: '', a: '', complete: false },
      { index: 3, q: '  ', a: 'Blank question', complete: false },
    ]);
    const many = { faq: { items: Array.from({ length: 14 }, (_, i) => Q(i + 1)) } };
    expect(faqRows(many)).toHaveLength(FAQ_MAX_ITEMS);
  });

  it('writes the heading, intro and each question / answer as typed', () => {
    const faq = { items: [Q(1)] };
    expect(faqSetText(faq, 'title', 'Ask Us ')).toEqual({ items: [Q(1)], title: 'Ask Us ' });
    expect(faqSetText({ ...faq, intro: 'x' }, 'intro', '')).toEqual(faq);
    expect(faqSetItem(faq, 0, 'a', 'Yes, by hand.\n\nAlways.')).toEqual({ items: [{ q: 'Question 1?', a: 'Yes, by hand.\n\nAlways.' }] });
    expect(faqSetItem(faq, 0, 'q', '')).toEqual({ items: [{ a: 'Answer 1.' }] });
    expect(faq).toEqual({ items: [Q(1)] });
  });

  it('adds up to twelve, removes and moves questions', () => {
    let faq = faqStart();
    for (let n = 2; n <= FAQ_MAX_ITEMS; n++) faq = faqAddItem(faq);
    expect(faq.items).toHaveLength(12);
    expect(faqAddItem(faq)).toBeNull();
    const two = { items: [Q(1), Q(2)] };
    expect(faqRemoveItem(two, 0)).toEqual({ items: [Q(2)] });
    expect(faqMoveItem(two, 1, 0)).toEqual({ items: [Q(2), Q(1)] });
  });
});

describe('FaqPanel', () => {
  it('offers to add the section while it is off', () => {
    const html = decode(panel({}));
    expect(html).toContain('+ Add a FAQ section');
    expect(html).not.toContain('Remove this section');
    expect(decode(panel({ hiddenSections: ['faq'] }))).toContain('This section is switched off in Sections.');
  });

  it('lists each question with its answer and what it still needs', () => {
    const html = decode(panel({ faq: { title: 'Ask Us', items: [Q(1), { q: 'No answer yet' }] } }));
    expect(html).toContain('value="Ask Us"');
    expect(html).toContain(`placeholder="${FAQ_DEFAULTS.title}"`);
    expect(html).toContain('Question 1');
    expect(html).toContain('Question 2');
    expect(html).toContain('>Answer 1.</textarea>');
    expect(html.split('Not on your site yet: it needs a question and an answer.').length - 1).toBe(1);
    expect(html).toContain('+ Add a question');
    expect(html).toContain('Remove this section');
    expect(html).toContain('Edit > Headings');
    expect(html).toMatch(new RegExp(`maxlength="${FAQ_A_MAX}"`, 'i'));
    expect(decode(panel({ faq: { items: [] } }, { hasHeadingsTab: false }))).not.toContain('Edit > Headings');
  });

  it('stops adding at twelve questions', () => {
    const html = decode(panel({ faq: { items: Array.from({ length: 12 }, (_, i) => Q(i)) } }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Up to 12 questions<\/button>/);
  });
});
