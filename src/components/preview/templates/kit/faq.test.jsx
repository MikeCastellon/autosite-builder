// The FAQ band (kit/faq.js + kit/Faq.jsx): which questions show (the
// published page: complete items only; the editor: every item, flagged),
// the limits, the FAQPage JSON-LD and its escaping, the band's markup
// (native details / summary, two independent columns, editor-only states)
// and faqCss's hygiene (the same contract blocks.test.jsx holds the other
// kit blocks to).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaqBand, faqCss } from './Faq.jsx';
import {
  FAQ_LIMITS, FAQ_SECTION, FAQ_DEFAULTS, FAQ_TAB, FAQ_HINTS, clipText, faqItems, faqHeading, faqJsonLd, scriptSafeJson,
} from './faq.js';
import { EditorModeProvider } from './EditorMode.jsx';
import { EDITOR_TABS } from '../../editorCapabilities.js';

const band = (props, editor = false) => {
  const el = createElement(FaqBand, { ns: 'xx-faq', order: 7, ...props, editor });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, null, el) : el);
};
const count = (s, needle) => s.split(needle).length - 1;
// Text as a reader sees it (React escapes <, >, & and quotes).
const decode = (html) => html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const sectionTag = (html) => (html.match(/^<section\b[^>]*>/) || [''])[0];
const ldOf = (html) => {
  const m = html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
};
const Q = (i) => ({ q: `Question number ${i}?`, a: `Answer number ${i}.` });

// Claims a template must never make up (templates.render.test.jsx).
const BANNED_CLAIMS = new RegExp([
  'Verified (Customer|Review|Buyer)', 'Real Reviews', '5\\.0 (Google )?Rating', 'Open Now', '0% for 12',
  '[\u2605\u2606\u2B50]', '100% Satisf', 'Satisfaction Guarantee', 'Top[- ]Rated', '(5|Five)[- ]Star',
  '\\d[\\d,]*\\s*\\+?\\s*(Happy|Satisfied)\\b',
].join('|'), 'i');

describe('faqItems', () => {
  it('is off (null) unless copy.faq is an object', () => {
    for (const v of [undefined, null, '', 'yes', 42, true, [], [{ q: 'a', a: 'b' }]]) {
      expect(faqItems(v)).toBeNull();
      expect(faqItems(v, { editor: true })).toBeNull();
    }
    expect(faqItems({})).toEqual({ title: '', intro: '', items: [], complete: 0 });
    expect(faqItems({ items: 'nope', title: 7 })).toEqual({ title: '7', intro: '', items: [], complete: 0 });
  });

  it('publishes complete items only; the editor gets every item, flagged, at its own index', () => {
    const faq = {
      title: '  Before   We Get\nStarted ',
      intro: ' Ask us anything. ',
      items: [{ q: ' Same day? ', a: ' Often. ' }, { q: 'Wax?' }, 'junk', { a: 'Only an answer' }, { q: 3, a: 4 }, null],
    };
    const pub = faqItems(faq);
    expect(pub.title).toBe('Before We Get Started');
    expect(pub.intro).toBe('Ask us anything.');
    expect(pub.complete).toBe(2);
    expect(pub.items).toEqual([
      { index: 0, q: 'Same day?', a: 'Often.', complete: true },
      { index: 4, q: '3', a: '4', complete: true },
    ]);
    const ed = faqItems(faq, { editor: true });
    expect(ed.items.map((it) => [it.index, it.complete, it.q, it.a])).toEqual([
      [0, true, 'Same day?', 'Often.'], [1, false, 'Wax?', ''], [2, false, '', ''], [3, false, '', 'Only an answer'], [4, true, '3', '4'], [5, false, '', ''],
    ]);
    expect(ed.complete).toBe(2);
  });

  it('counts only the first FAQ_LIMITS.items entries, in the editor and on the page alike', () => {
    expect(FAQ_LIMITS).toEqual({ title: 80, intro: 200, q: 160, a: 600, items: 12 });
    const items = Array.from({ length: 14 }, (_, i) => Q(i + 1));
    items[3] = { q: 'Unanswered' };
    expect(faqItems({ items }, { editor: true }).items.map((it) => it.index)).toEqual([...Array(12).keys()]);
    const pub = faqItems({ items });
    expect(pub.items).toHaveLength(11);
    expect(pub.items.map((it) => it.q)).not.toContain('Question number 13?');
  });

  it('clips every field to its limit, at a word break, with an ellipsis', () => {
    const long = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
    const out = faqItems({ title: long(40), intro: long(80), items: [{ q: long(60), a: long(200) }] });
    const lens = { title: out.title, intro: out.intro, q: out.items[0].q, a: out.items[0].a };
    for (const [k, v] of Object.entries(lens)) {
      expect(Array.from(v).length, k).toBeLessThanOrEqual(FAQ_LIMITS[k]);
      expect(Array.from(v).length, k).toBeGreaterThan(FAQ_LIMITS[k] * 0.6);
      expect(v.endsWith('…'), k).toBe(true);
      expect(v, k).toMatch(/word\d+…$/);
    }
    // At the limit nothing changes.
    const exact = 'x'.repeat(FAQ_LIMITS.q);
    expect(faqItems({ items: [{ q: exact, a: 'y' }] }).items[0].q).toBe(exact);
  });

  it('keeps an answer\'s paragraphs and line breaks, and makes everything else one line', () => {
    const out = faqItems({ items: [{ q: 'Two\nlines?', a: '  First   line\r\nsame paragraph \r\n\r\n\r\n\r\n  Second\tparagraph  ' }] });
    expect(out.items[0].q).toBe('Two lines?');
    expect(out.items[0].a).toBe('First line\nsame paragraph\n\nSecond paragraph');
  });
});

describe('clipText', () => {
  it('leaves text within the limit alone', () => {
    expect(clipText('Hello there', 11)).toBe('Hello there');
    expect(clipText('Hello there', 50)).toBe('Hello there');
    expect(clipText('Hello there', 0)).toBe('Hello there');
    expect(clipText(null, 5)).toBe('');
  });

  it('cuts at the last word break, without trailing punctuation, and ends with …', () => {
    expect(clipText('Do you offer same day service, too?', 20)).toBe('Do you offer same…');
    expect(clipText('One, two, three, four', 11)).toBe('One, two…');
    // A single long word is cut hard.
    expect(clipText('Supercalifragilistic', 8)).toBe('Superca…');
  });

  it('counts characters, so an emoji is never split', () => {
    const out = clipText('😀'.repeat(10), 5);
    expect(out).toBe(`${'😀'.repeat(4)}…`);
    expect(Array.from(out)).toHaveLength(5);
  });
});

describe('faqHeading', () => {
  it('is the design\'s own heading by default, with no claims', () => {
    expect(FAQ_SECTION).toBe('faq');
    expect(FAQ_DEFAULTS).toEqual({ eyebrow: 'FAQ', title: 'Questions, Answered' });
    expect(faqHeading(null, null)).toEqual({ eyebrow: 'FAQ', title: 'Questions, Answered', accent: '', intro: '' });
    expect(JSON.stringify([FAQ_DEFAULTS, FAQ_HINTS])).not.toMatch(BANNED_CLAIMS);
  });

  it('takes the owner\'s copy.faq first, then copy.sectionTitles.faq, then the theme\'s defaults', () => {
    const st = { faq: { eyebrow: ' Good to know ', title: 'Common Questions', accent: 'Questions', intro: 'From sectionTitles' } };
    expect(faqHeading({ title: 'Before We Get Started', intro: 'Ask away.' }, st)).toEqual({
      eyebrow: 'Good to know', title: 'Before We Get Started', accent: 'Questions', intro: 'Ask away.',
    });
    expect(faqHeading({}, st)).toEqual({ eyebrow: 'Good to know', title: 'Common Questions', accent: 'Questions', intro: 'From sectionTitles' });
    expect(faqHeading({}, null, { eyebrow: 'Help', title: 'Your Questions' })).toEqual({ eyebrow: 'Help', title: 'Your Questions', accent: '', intro: '' });
    expect(faqHeading({ title: 'x'.repeat(200) }, null).title).toHaveLength(FAQ_LIMITS.title);
  });
});

describe('faqJsonLd / scriptSafeJson', () => {
  it('describes exactly the published questions as a schema.org FAQPage', () => {
    expect(faqJsonLd(null)).toBeNull();
    expect(faqJsonLd({ items: [{ q: 'No answer yet' }] })).toBeNull();
    expect(faqJsonLd({ items: [Q(1), { q: 'Skipped' }, Q(2)] })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Question number 1?', acceptedAnswer: { '@type': 'Answer', text: 'Answer number 1.' } },
        { '@type': 'Question', name: 'Question number 2?', acceptedAnswer: { '@type': 'Answer', text: 'Answer number 2.' } },
      ],
    });
  });

  it('writes JSON that cannot end its <script> and parses back unchanged', () => {
    const value = { a: '</script><script>alert(1)</script>', b: '<!-- x -->', c: 'Tom & Jerry > Spike', d: 'line\u2028sep\u2029end' };
    const json = scriptSafeJson(value);
    expect(json).not.toMatch(/[<>&\u2028\u2029]/);
    expect(json).toContain('\\u003c/script\\u003e');
    expect(json).toContain('\\u0026');
    expect(JSON.parse(json)).toEqual(value);
    expect(scriptSafeJson(undefined)).toBe('');
  });
});

describe('FaqBand', () => {
  it('renders nothing while the band is off, or published without a complete item', () => {
    for (const editor of [false, true]) expect(band({ faq: null }, editor)).toBe('');
    for (const editor of [false, true]) expect(band({ faq: [Q(1)] }, editor)).toBe('');
    expect(band({ faq: {} })).toBe('');
    expect(band({ faq: { title: 'Ours', items: [{ q: 'No answer' }, { a: 'No question' }] } })).toBe('');
  });

  it('publishes each complete item as a native details / summary disclosure', () => {
    const html = band({ faq: { items: [{ q: 'Do you offer same-day service?', a: 'Often, yes.\nCall first.\n\nWe confirm by text.' }] } });
    expect(sectionTag(html)).toBe('<section data-section="faq" id="faq" class="xx-faq-band" aria-labelledby="xx-faq-h" style="order:7">');
    expect(html).toContain('<div class="xx-faq-head" data-acg-reveal=""><p class="xx-faq-eyebrow">FAQ</p><h2 id="xx-faq-h" class="xx-faq-title">Questions, Answered</h2></div>');
    expect(html).toContain(
      '<details class="xx-faq-item"><summary class="xx-faq-q"><span class="xx-faq-q-text">Do you offer same-day service?</span><span class="xx-faq-icon" aria-hidden="true"></span></summary>'
      + '<div class="xx-faq-a"><p>Often, yes.\nCall first.</p><p>We confirm by text.</p></div></details>',
    );
    // Closed until the visitor opens it; no script or ARIA needed for that.
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).not.toMatch(/aria-expanded|role="button"|tabindex/);
    expect(html).not.toContain('data-acg-editor-only');
    expect(decode(html)).not.toMatch(/Edit >/);
  });

  it('splits the questions into two columns that keep the reading order', () => {
    const html = band({ faq: { items: [Q(1), Q(2), Q(3), Q(4), Q(5)] } });
    expect(html).toContain('<div class="xx-faq-list" data-acg-reveal=""><div class="xx-faq-col">');
    // The markup only (the JSON-LD after it repeats every question).
    const cols = html.slice(0, html.indexOf('<script')).split('<div class="xx-faq-col">').slice(1);
    expect(cols).toHaveLength(2);
    expect(cols.map((c) => [...c.matchAll(/Question number (\d)/g)].map((m) => Number(m[1])))).toEqual([[1, 2, 3], [4, 5]]);
    // One question is one column, kept narrow (faqCss .xx-faq-solo).
    const solo = band({ faq: { items: [Q(1)] } });
    expect(solo).toContain('<div class="xx-faq-list xx-faq-solo" data-acg-reveal="">');
    expect(count(solo, 'class="xx-faq-col"')).toBe(1);
  });

  it('adds FAQPage JSON-LD for the printed questions, on the published page only', () => {
    const faq = { items: [Q(1), { q: 'Draft' }, Q(2)] };
    const html = band({ faq });
    expect(count(html, '<script')).toBe(1);
    expect(html).toMatch(/<\/div><script type="application\/ld\+json">[^<]*<\/script><\/section>$/);
    const ld = ldOf(html);
    expect(ld).toEqual(faqJsonLd(faq));
    expect(ld.mainEntity.map((m) => m.name)).toEqual([...html.matchAll(/class="xx-faq-q-text">([^<]*)</g)].map((m) => m[1]));
    expect(band({ faq }, true)).not.toContain('<script');
    expect(band({ faq, jsonLd: false })).not.toContain('<script');
  });

  it('escapes owner text in the markup, and the JSON-LD cannot close its script', () => {
    const evil = { q: 'Is </script><script>alert(1)</script> "safe"?', a: '<b>Yes</b> & <img src=x onerror=alert(2)>' };
    const html = band({ faq: { title: '<i>Title</i>', items: [evil] } });
    expect(html).not.toMatch(/<script>alert|<b>|<img|<i>Title/);
    expect(html).toContain('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(count(html, '</script>')).toBe(1);
    expect(ldOf(html).mainEntity[0]).toEqual({ '@type': 'Question', name: evil.q, acceptedAnswer: { '@type': 'Answer', text: evil.a } });
  });

  it('the editor shows incomplete items open, as editor-only, saying what each needs', () => {
    const faq = { items: [Q(1), { q: 'Do you wax?' }, { a: 'Yes, by hand.' }, {}] };
    const html = band({ faq }, true);
    // The band publishes (item 1 is complete): only the drafts are editor-only.
    expect(sectionTag(html)).not.toContain('data-acg-editor-only');
    expect(count(html, '<details class="xx-faq-item xx-faq-todo" data-acg-editor-only="" open="">')).toBe(3);
    expect(html).toContain('<details class="xx-faq-item"><summary');
    const text = decode(html);
    expect(text).toContain(`<span class="xx-faq-q-text">Do you wax?</span><span class="xx-faq-icon" aria-hidden="true"></span></summary><div class="xx-faq-a"><p class="xx-faq-hint">${FAQ_HINTS.noAnswer}</p>`);
    expect(text).toContain(`<span class="xx-faq-q-text">Question 3</span>`);
    expect(text).toContain(`<p>Yes, by hand.</p><p class="xx-faq-hint">${FAQ_HINTS.noQuestion}</p>`);
    expect(text).toContain(`<span class="xx-faq-q-text">Question 4</span>`);
    expect(text).toContain(`<p class="xx-faq-hint">${FAQ_HINTS.blank}</p>`);
    // The same data published: the complete item only.
    const pub = band({ faq });
    expect(count(pub, '<details')).toBe(1);
    expect(pub).not.toMatch(/Do you wax|by hand|Question 3|data-acg-editor-only|Edit &gt;/);
  });

  it('with no complete item the editor shows the whole band as editor-only, naming Edit > FAQ', () => {
    const empty = band({ faq: { title: 'Before We Get Started' } }, true);
    expect(sectionTag(empty)).toContain('data-acg-editor-only=""');
    expect(empty).toContain('>Before We Get Started</h2>');
    expect(decode(empty)).toContain(`<p class="xx-faq-hint" data-acg-editor-only="">${FAQ_HINTS.empty}</p>`);
    expect(FAQ_HINTS.empty).toContain(`Edit > ${FAQ_TAB}`);
    expect(empty).not.toContain('xx-faq-list');
    const drafts = band({ faq: { items: [{ q: 'Draft?' }] } }, true);
    expect(sectionTag(drafts)).toContain('data-acg-editor-only=""');
    expect(drafts).not.toContain(FAQ_HINTS.empty);
  });

  it('every hint names the FAQ tab the editor has', () => {
    expect(FAQ_TAB).toBe('FAQ');
    for (const h of Object.values(FAQ_HINTS)) expect(h).toContain(`Edit > ${FAQ_TAB}`);
    expect(EDITOR_TABS.find((t) => t.label === FAQ_TAB)).toMatchObject({ id: 'faq', needs: 'faq' });
  });

  it('reads the editor flag from context when the template passes none', () => {
    const faq = { items: [{ q: 'Draft?' }] };
    const inEditor = renderToStaticMarkup(createElement(EditorModeProvider, null, createElement(FaqBand, { ns: 'xx-faq', faq })));
    expect(inEditor).toContain('xx-faq-todo');
    expect(renderToStaticMarkup(createElement(FaqBand, { ns: 'xx-faq', faq }))).toBe('');
    // An explicit prop wins over the context.
    const forced = renderToStaticMarkup(createElement(EditorModeProvider, null, createElement(FaqBand, { ns: 'xx-faq', faq: { items: [Q(1)] }, editor: false })));
    expect(forced).toContain('<script type="application/ld+json">');
  });

  it('prints the owner\'s heading and highlighted words, and takes a theme heading, hints and labels', () => {
    const own = band({ faq: { title: 'Before We Get Started', intro: 'Quick answers.', items: [Q(1)] }, sectionTitles: { faq: { eyebrow: 'Help', accent: 'Get Started' } } });
    expect(own).toContain('<p class="xx-faq-eyebrow">Help</p><h2 id="xx-faq-h" class="xx-faq-title">Before We <span class="xx-faq-em">Get Started</span></h2><p class="xx-faq-intro">Quick answers.</p>');
    const themed = band({
      faq: { items: [] },
      heading: <h2 id="xx-own-h">Our heading</h2>,
      labelledBy: 'xx-own-h',
      hints: <p className="xx-hint">Theme hint</p>,
      className: 'xx-section',
      wrapClassName: 'xx-wrap',
      id: 'questions',
    }, true);
    expect(sectionTag(themed)).toBe('<section data-section="faq" id="questions" class="xx-faq-band xx-section" aria-labelledby="xx-own-h" style="order:7" data-acg-editor-only="">');
    expect(themed).toContain('<div class="xx-wrap"><h2 id="xx-own-h">Our heading</h2><p class="xx-hint">Theme hint</p></div>');
    expect(themed).not.toContain('xx-faq-head');
    const labelled = band({ faq: { items: [Q(1)] }, labels: { eyebrow: 'Good to Know', title: 'Ask Us' } });
    expect(labelled).toContain('<p class="xx-faq-eyebrow">Good to Know</p><h2 id="xx-faq-h" class="xx-faq-title">Ask Us</h2>');
  });

  it('keeps every class in its namespace', () => {
    for (const editor of [false, true]) {
      const html = band({ faq: { intro: 'Hi', items: [Q(1), Q(2), { q: 'Draft' }] }, sectionTitles: { faq: { accent: 'Answered' } } }, editor);
      for (const m of html.matchAll(/class="([^"]+)"/g)) {
        for (const c of m[1].split(' ')) expect(c.startsWith('xx-faq-'), c).toBe(true);
      }
    }
  });
});

// A tiny CSS reader: every rule with its selector and the at-rules around
// it (as in blocks.test.jsx).
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

describe.each([
  ['faqCss', (ns) => faqCss(ns)],
  ['faqCss (twoFrom 960)', (ns) => faqCss(ns, { twoFrom: 960 })],
])('%s hygiene', (_, gen) => {
  const ns = 'xx-faq';
  const css = gen(ns);
  const rules = cssRules(css);

  it('is non-empty, balanced and free of comments', () => {
    expect(rules.length).toBeGreaterThan(5);
    expect(css).not.toContain('/*');
  });

  it('has no hard-coded colors but black / white and neutral translucent overlays', () => {
    const hexes = [...css.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi)].map((m) => m[0].toLowerCase());
    expect(hexes.filter((h) => !['#fff', '#ffffff', '#000', '#000000'].includes(h))).toEqual([]);
    for (const m of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/gi)) {
      expect(m[1] === m[2] && m[2] === m[3] && m[4] !== undefined && Number(m[4]) < 1, m[0]).toBe(true);
    }
    expect(css).not.toMatch(/\b(hsl|oklch|lab)\(/i);
  });

  it('keeps hover in (hover:hover) and motion in prefers-reduced-motion', () => {
    for (const r of rules) {
      if (r.selector.includes(':hover')) expect(r.at, r.selector).toContain('@media (hover:hover)');
      if (/(^|;)\s*(transition|animation)\s*:/.test(r.body)) expect(r.at, r.selector).toContain('@media (prefers-reduced-motion:no-preference)');
    }
  });

  it('uses container breakpoints only', () => {
    expect(css).not.toMatch(/@media\s*\([^)]*width/);
    for (const r of rules) for (const at of r.at) expect(at).toMatch(/^@(container \(min-width:\d+px\)|media \(hover:hover\)|media \(prefers-reduced-motion:no-preference\))$/);
  });

  it('names every class and variable in the block\'s namespace', () => {
    for (const r of rules) {
      for (const m of r.selector.matchAll(/[.#](-?[_a-zA-Z][\w-]*)/g)) expect(m[1].startsWith(`${ns}-`), r.selector).toBe(true);
    }
    for (const m of css.matchAll(/var\(--([\w-]+)/g)) expect(m[1].startsWith(`${ns}-`), m[0]).toBe(true);
  });
});

describe('faqCss', () => {
  const css = faqCss('xx-faq');

  it('draws the question as a block with its own +/− instead of the browser triangle', () => {
    expect(css).toMatch(/\.xx-faq-q\{position:relative;display:block;[^}]*list-style:none;cursor:pointer/);
    expect(css).toContain('.xx-faq-q::-webkit-details-marker{display:none}');
    expect(css).toContain('.xx-faq-icon::after{transform:rotate(90deg)}');
    expect(css).toContain('.xx-faq-item[open] .xx-faq-icon::after{transform:rotate(180deg)}');
    expect(css).toContain('.xx-faq-q:focus-visible{outline:2px solid var(--xx-faq-focus);outline-offset:-3px}');
  });

  it('is one column on phones and two from twoFrom', () => {
    expect(css).toContain('.xx-faq-list{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}');
    expect(css).toContain('@container (min-width:768px){\n.xx-faq-list{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;column-gap:20px}');
    expect(faqCss('xx-faq', { twoFrom: 960 })).toContain('@container (min-width:960px){');
    // Answers keep the owner's line breaks.
    expect(css).toMatch(/\.xx-faq-a p\{[^}]*white-space:pre-line/);
  });
});
