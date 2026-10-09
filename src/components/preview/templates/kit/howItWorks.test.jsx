// The How It Works band (kit/howItWorks.js + kit/HowItWorks.jsx): which
// steps show and how they are numbered, the opt-in rule (nothing without
// copy.howSteps, so a theme with live sites stays byte-identical), the
// band's markup (an ordered list, decorative numbers, editor-only states)
// and howItWorksCss's hygiene (the same contract blocks.test.jsx holds the
// other kit blocks to).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HowItWorksBand, howItWorksCss } from './HowItWorks.jsx';
import {
  HOW_SECTION, HOW_DEFAULTS, HOW_TAB, HOW_HINTS, stepEmoji, stepNumber, howColumns, howItWorksSteps, howItWorksHeading,
} from './howItWorks.js';
import { EditorModeProvider } from './EditorMode.jsx';
import { EDITOR_TABS } from '../../editorCapabilities.js';

const band = (props, editor = false) => {
  const el = createElement(HowItWorksBand, { ns: 'xx-how', order: 4, ...props, editor });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, null, el) : el);
};
const count = (s, needle) => s.split(needle).length - 1;
const decode = (html) => html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const sectionTag = (html) => (html.match(/^<section\b[^>]*>/) || [''])[0];
const STEPS = [
  { emoji: '📱', title: 'Book online', desc: 'Pick a time that suits you.' },
  { emoji: '🚐', title: 'We come to you', desc: 'At home or at work.' },
  { emoji: '✨', title: 'Enjoy a clean ride', desc: 'That is it.' },
];

// Claims a template must never make up (templates.render.test.jsx).
const BANNED_CLAIMS = new RegExp([
  'Verified (Customer|Review|Buyer)', 'Real Reviews', '5\\.0 (Google )?Rating', 'Open Now', '0% for 12',
  '[\u2605\u2606\u2B50]', '100% Satisf', 'Satisfaction Guarantee', 'Top[- ]Rated', '(5|Five)[- ]Star',
  '\\d[\\d,]*\\s*\\+?\\s*(Happy|Satisfied)\\b',
].join('|'), 'i');

describe('howItWorksSteps', () => {
  it('is off (null) unless copy.howSteps is a non-empty array: no starter steps', () => {
    for (const v of [undefined, null, '', 'Book', 3, {}, { 0: STEPS[0] }, []]) expect(howItWorksSteps(v)).toBeNull();
  });

  it('keeps steps with a title or a description, trimmed, numbered in order', () => {
    const out = howItWorksSteps([
      { emoji: ' 📱 ', title: '  Book online ', desc: ' Pick a time. ' },
      { title: '', desc: '  ' },
      'junk',
      null,
      { desc: 'Only text' },
      { title: 'Only a title', emoji: 42 },
      { title: 7, desc: 8 },
    ]);
    expect(out).toEqual({
      steps: [
        { number: '01', emoji: '📱', title: 'Book online', desc: 'Pick a time.' },
        { number: '02', emoji: '', title: '', desc: 'Only text' },
        { number: '03', emoji: '42', title: 'Only a title', desc: '' },
        { number: '04', emoji: '', title: '7', desc: '8' },
      ],
      cols: 4,
    });
    // On, but nothing to show.
    expect(howItWorksSteps([{ title: ' ' }, {}])).toEqual({ steps: [], cols: 1 });
  });

  it('repairs the old seed\'s placard emoji the way the other designs do', () => {
    expect(stepEmoji('\u{1FAA7}')).toBe('\u{1FAE7}');
    expect(stepEmoji(' icon:truck ')).toBe('icon:truck');
    expect(stepEmoji(null)).toBe('');
    expect(howItWorksSteps([{ emoji: '\u{1FAA7}', title: 'Wash' }]).steps[0].emoji).toBe('\u{1FAE7}');
  });

  it('numbers two digits wide and lays rows out evenly', () => {
    expect([1, 9, 10, 12].map(stepNumber)).toEqual(['01', '09', '10', '12']);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(howColumns)).toEqual([1, 2, 3, 4, 3, 3, 4, 4, 3, 4, 4, 4]);
    expect([0, -2, NaN, 'x'].map(howColumns)).toEqual([1, 1, 1, 1]);
  });
});

describe('howItWorksHeading', () => {
  it('is the design\'s own heading by default, with no claims', () => {
    expect(HOW_SECTION).toBe('process');
    expect(HOW_DEFAULTS).toEqual({ eyebrow: 'The Process', title: 'How It Works' });
    expect(howItWorksHeading(undefined)).toEqual({ eyebrow: 'The Process', title: 'How It Works', accent: '', intro: '' });
    expect(JSON.stringify([HOW_DEFAULTS, HOW_HINTS])).not.toMatch(BANNED_CLAIMS);
  });

  it('takes copy.sectionTitles.process (Edit > Headings), then the theme\'s defaults', () => {
    const st = { process: { eyebrow: ' Easy ', title: 'Three Steps to a Clean Car', accent: 'a Clean Car', intro: 'Here is how.' } };
    expect(howItWorksHeading(st)).toEqual({ eyebrow: 'Easy', title: 'Three Steps to a Clean Car', accent: 'a Clean Car', intro: 'Here is how.' });
    expect(howItWorksHeading({ process: { title: 'Ours' } }, { eyebrow: 'Steps', title: 'Theirs' })).toEqual({ eyebrow: 'Steps', title: 'Ours', accent: '', intro: '' });
    expect(howItWorksHeading({ whyUs: { title: 'Not this one' } }).title).toBe('How It Works');
  });
});

describe('HowItWorksBand', () => {
  it('renders nothing without copy.howSteps, in the editor too (existing sites stay byte-identical)', () => {
    for (const editor of [false, true]) {
      for (const howSteps of [undefined, null, [], 'Book']) expect(band({ howSteps }, editor)).toBe('');
    }
    // On, but every step blank: nothing on the published page.
    expect(band({ howSteps: [{ title: '' }, { desc: ' ' }] })).toBe('');
  });

  it('publishes the steps as an ordered list with decorative numbers', () => {
    const html = band({ howSteps: STEPS });
    expect(sectionTag(html)).toBe('<section data-section="process" id="process" class="xx-how-band" aria-labelledby="xx-how-h" style="order:4">');
    expect(html).toContain('<div class="xx-how-head" data-acg-reveal=""><p class="xx-how-eyebrow">The Process</p><h2 id="xx-how-h" class="xx-how-title">How It Works</h2></div>');
    expect(html).toContain('<ol class="xx-how-steps" role="list" style="--xx-how-cols:3">');
    expect(count(html, '<li class="xx-how-step"')).toBe(3);
    expect(html).toContain(
      '<li class="xx-how-step" data-acg-reveal="" style="--acg-delay:0ms"><div class="xx-how-mark" aria-hidden="true"><span class="xx-how-num">01</span>'
      + '<span class="xx-how-emo"><span style="font-size:28px">📱</span></span><span class="xx-how-rule"></span></div>'
      + '<h3 class="xx-how-step-title">Book online</h3><p class="xx-how-desc">Pick a time that suits you.</p></li>',
    );
    expect(html).toContain('style="--acg-delay:180ms"><div class="xx-how-mark" aria-hidden="true"><span class="xx-how-num">03</span>');
    expect(html).not.toContain('data-acg-editor-only');
    expect(decode(html)).not.toMatch(/Edit >/);
  });

  it('draws icon: values as line icons, and leaves the emoji out when there is none', () => {
    const html = band({ howSteps: [{ emoji: 'icon:truck', title: 'We come to you' }, { title: 'Done', desc: 'Drive off.' }] }, false);
    expect(html).toMatch(/<span class="xx-how-emo"><svg width="28" height="28" viewBox="0 0 16 16"[^>]*><path d="[^"]+" stroke="currentColor"/);
    expect(html).toContain('<span class="xx-how-num">02</span><span class="xx-how-rule"></span>');
    expect(count(html, 'class="xx-how-emo"')).toBe(1);
    expect(band({ howSteps: [{ emoji: 'icon:truck', title: 'X' }], emojiSize: 20 })).toContain('<svg width="20" height="20"');
  });

  it('prints a title-only or a text-only step without an empty element', () => {
    const html = band({ howSteps: [{ title: 'Just a title' }, { desc: 'Just\ntext' }] });
    expect(html).toContain('<h3 class="xx-how-step-title">Just a title</h3></li>');
    expect(html).toContain('<span class="xx-how-rule"></span></div><p class="xx-how-desc">Just\ntext</p></li>');
    expect(html).not.toMatch(/<h3[^>]*><\/h3>|<p[^>]*><\/p>/);
  });

  it('escapes the owner\'s text', () => {
    const html = band({ howSteps: [{ title: '<img src=x onerror=alert(1)>', desc: '</li><script>alert(2)</script>' }] });
    expect(html).not.toMatch(/<img|<script/);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('in the editor: the same steps, and an editor-only band with a hint when none has content', () => {
    expect(band({ howSteps: STEPS }, true)).toBe(band({ howSteps: STEPS }));
    const empty = band({ howSteps: [{ emoji: '✨', title: '', desc: '' }] }, true);
    expect(sectionTag(empty)).toBe('<section data-section="process" id="process" class="xx-how-band" aria-labelledby="xx-how-h" style="order:4" data-acg-editor-only="">');
    expect(decode(empty)).toContain(`<p class="xx-how-hint" data-acg-editor-only="">${HOW_HINTS.empty}</p>`);
    expect(empty).not.toContain('xx-how-steps');
  });

  it('every hint names the How It Works tab the editor has', () => {
    expect(HOW_HINTS.empty).toContain(`Edit > ${HOW_TAB}`);
    expect(EDITOR_TABS.map((t) => t.label)).toContain(HOW_TAB);
  });

  it('reads the editor flag from context when the template passes none', () => {
    const blank = [{ title: '' }];
    const inEditor = renderToStaticMarkup(createElement(EditorModeProvider, null, createElement(HowItWorksBand, { ns: 'xx-how', howSteps: blank })));
    expect(inEditor).toContain('xx-how-hint');
    expect(renderToStaticMarkup(createElement(HowItWorksBand, { ns: 'xx-how', howSteps: blank }))).toBe('');
  });

  it('prints copy.sectionTitles.process, and takes a theme heading, hints, labels and id', () => {
    const own = band({ howSteps: STEPS, sectionTitles: { process: { eyebrow: 'Easy', title: 'Three Steps to a Clean Car', accent: 'a Clean Car', intro: 'Here is how.' } } });
    expect(own).toContain('<p class="xx-how-eyebrow">Easy</p><h2 id="xx-how-h" class="xx-how-title">Three Steps to <span class="xx-how-em">a Clean Car</span></h2><p class="xx-how-intro">Here is how.</p>');
    const themed = band({
      howSteps: [{}],
      heading: <h2 id="xx-own-h">Our heading</h2>,
      labelledBy: 'xx-own-h',
      hints: <p className="xx-hint">Theme hint</p>,
      className: 'xx-section',
      wrapClassName: 'xx-wrap',
      id: 'how',
    }, true);
    expect(sectionTag(themed)).toBe('<section data-section="process" id="how" class="xx-how-band xx-section" aria-labelledby="xx-own-h" style="order:4" data-acg-editor-only="">');
    expect(themed).toContain('<div class="xx-wrap"><h2 id="xx-own-h">Our heading</h2><p class="xx-hint">Theme hint</p></div>');
    expect(band({ howSteps: STEPS, labels: { eyebrow: 'Step by Step' } })).toContain('<p class="xx-how-eyebrow">Step by Step</p><h2 id="xx-how-h" class="xx-how-title">How It Works</h2>');
    // A theme heading without an id leaves aria-labelledby off.
    expect(sectionTag(band({ howSteps: STEPS, heading: <h2>Plain</h2> }))).not.toContain('aria-labelledby');
  });

  it('sets the row length from the step count', () => {
    const steps = (n) => Array.from({ length: n }, (_, i) => ({ title: `Step ${i + 1}` }));
    expect(band({ howSteps: steps(1) })).toContain('style="--xx-how-cols:1"');
    expect(band({ howSteps: steps(5) })).toContain('style="--xx-how-cols:3"');
    expect(band({ howSteps: steps(8) })).toContain('style="--xx-how-cols:4"');
  });

  it('keeps every class in its namespace', () => {
    for (const editor of [false, true]) {
      const html = band({ howSteps: [...STEPS, { emoji: 'icon:check', title: 'X' }], sectionTitles: { process: { intro: 'Hi', accent: 'Works' } } }, editor);
      for (const m of html.matchAll(/class="([^"]+)"/g)) {
        for (const c of m[1].split(' ')) expect(c.startsWith('xx-how-'), c).toBe(true);
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
  ['howItWorksCss', (ns) => howItWorksCss(ns)],
  ['howItWorksCss (rowFrom 768)', (ns) => howItWorksCss(ns, { rowFrom: 768 })],
])('%s hygiene', (_, gen) => {
  const ns = 'xx-how';
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

describe('howItWorksCss', () => {
  const css = howItWorksCss('xx-how');

  it('stacks the steps, and lines them up in a row of --cols from rowFrom', () => {
    expect(css).toMatch(/\.xx-how-steps\{display:grid;grid-template-columns:minmax\(0,1fr\);[^}]*list-style:none\}/);
    expect(css).toContain('@container (min-width:900px){\n.xx-how-steps{grid-template-columns:repeat(var(--xx-how-cols,3),minmax(0,1fr));max-width:none}');
    expect(howItWorksCss('xx-how', { rowFrom: 768 })).toContain('@container (min-width:768px){');
    // Step text keeps the owner's line breaks.
    expect(css).toMatch(/\.xx-how-desc\{[^}]*white-space:pre-line/);
  });
});
