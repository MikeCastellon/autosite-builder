import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  BUSINESS_INFO_PREFIX, CLAIM_KINDS, CLAIM_LIMITS, CLAIM_SOURCE_FIELDS, CLAIM_STATUSES, CLAIM_WHERE, LEDGER_VERSION,
  REVIEW_FIELD, claimCounts, claimNumbers, claimsSignOffLine, filterClaims, groupClaims, isReviewPath, ledgerSummary,
  normalizeClaimText, openClaims, quoteInText, sanitizeClaimsSignOff, sanitizeLedger, sourceFieldOf, sourceLabel,
} from './claims.js';
import { FACT_SOURCE_FIELDS, quoteInText as suggestQuoteInText } from '../designSuggest.js';
import { FORM_FIELDS } from '../customSiteForm.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ClaimsResult from '../../components/admin/kit/ClaimsResult.jsx';

// The launch-claims-ledger skill (skills/api/launch-claims-ledger) runs in
// Anthropic's code-execution container: Python, no Node. Its validator
// (scripts/validate_claims.py, scripts/claimlib.py) mirrors this module's
// text rules and limits, so a ledger it passes is stored as written. This
// test writes those cases to the skill's tests/parity.json and fails when
// the committed copy drifts; tests/test_claims.py checks Python agrees.
//
// After changing src/lib/kit/claims.js:
//   UPDATE_SKILL_FIXTURES=1 npx vitest run src/lib/kit/claims.test.js
//   python3 skills/api/launch-claims-ledger/tests/test_claims.py

const ROOT = path.resolve(__dirname, '../../..');
const PARITY = path.join(ROOT, 'skills/api/launch-claims-ledger/tests/parity.json');
const UPDATE = process.env.UPDATE_SKILL_FIXTURES === '1';

const NUMBER_CASES = [
  'Over 10 years of experience',
  'over twenty-five years, 4.90 stars',
  'Full detail $1,299.00 or $199',
  'five-year warranty and a 5 year warranty',
  'Open 24/7, #1 in town, 08 bays',
  'Rated 4.9/5 from 127 Google reviews',
  'one-stop shop, no one else',
  'Ninety nine problems, ninety-nine cars',
  'v2.0 and Step 1. Wash',
  'Since 2015 \u2014 500+ cars, 100% satisfaction',
  'Fullwidth \uff11\uff12 years',
  '',
];
const QUOTE_CASES = [
  ['I\u2019ve been detailing for 8 years', 'Story: I\'ve been   detailing for 8 years. Love it.'],
  ['"great job!"', 'they said: \u201cGreat JOB!\u201d - Mike'],
  ['8 yrs', 'We have 8 yrs'],
  ['abc', 'abcdef'],
  ['great job\u2026', 'Great job on the truck'],
  ['IDA certified', 'I got my IDA certification'],
  ['well\u2014worth it', 'Well-worth it, thanks'],
  ['zero\u200bwidth', 'zerowidth here'],
  ['', 'anything'],
  ['Not in there', 'Something else entirely'],
];

const REVIEW_PATH_CASES = [
  'testimonialPlaceholders[0].text',
  'testimonialPlaceholders[2]',
  'testimonials[1].quote',
  'testimonialPlaceholders[0].name',
  'sectionTitles.testimonials',
  'words.reviews.replies[0].text',
  'testimonialPlaceholders.text',
];

// One run's sources and texts, and single claims the server must store as
// written exactly when the skill's validator passes them (test_claims.py
// runs validate_claims.py on each): the two sides apply the same rules.
const LEDGER_SOURCES = [
  { field: 'about', text: 'I\'ve been detailing cars for 8 years. I got my IDA certification in 2024.' },
  { field: 'services', text: 'Full Detail - $199\nCeramic Coating - $899 (5 year warranty)' },
  { field: 'serviceArea', text: 'Exampleton and Sampleville' },
  { field: 'testimonials', text: '"Best detailer in town!" - Riley Q.\n"On time and friendly. Highly recommend!" - Casey V.' },
  { field: 'businessInfo.googlePlace', text: 'googlePlace.rating: 4.8\ngooglePlace.reviewCount: 37' },
];
const LEDGER_CHECKED = [
  { where: 'site', path: 'aboutText', text: 'Sam has been detailing cars for 8 years. Over 10 years of experience. Full Detail from $149.' },
  { where: 'site', path: 'headline', text: 'Exampleton\'s #1 detailer with 500+ cars done' },
  { where: 'site', path: 'testimonialPlaceholders[0].text', text: 'Best detailer in town!' },
  { where: 'site', path: 'testimonialPlaceholders[1].text', text: 'On time and friendly. Highly recommend us to everyone!' },
  { where: 'gbp', path: 'words.gbp.description', text: 'Rated 4.8 on Google. Serving Exampleton, Sampleville and Demo Beach. A lifetime warranty.' },
];
const lc = (name, claim) => ({ name, claim: { text: '', where: 'site', kind: 'other', path: '', source: null, status: 'unsourced', suggestion: '', ...claim } });
const LEDGER_CLAIM_CASES = [
  lc('sourced, same number', { text: 'detailing cars for 8 years', kind: 'years', path: 'aboutText', source: { field: 'about', quote: 'detailing cars for 8 years' }, status: 'sourced' }),
  lc('sourced, from the business info', { text: 'Rated 4.8 on Google', where: 'gbp', kind: 'rating', source: { field: 'businessInfo.googlePlace', quote: 'googlePlace.rating: 4.8' }, status: 'sourced' }),
  lc('sourced, quote nowhere', { text: 'Over 10 years of experience', kind: 'years', source: { field: 'about', quote: 'detailing cars for 10 years' }, status: 'sourced' }),
  lc('sourced, quote under 4 characters', { text: 'Over 10 years of experience', kind: 'years', source: { field: 'about', quote: '8' }, status: 'sourced' }),
  lc('sourced, quote in another field', { text: 'Full Detail from $149', kind: 'price', source: { field: 'about', quote: 'Full Detail - $199' }, status: 'sourced' }),
  lc('sourced, number the quote lacks', { text: 'Over 10 years of experience', kind: 'years', source: { field: 'about', quote: 'detailing cars for 8 years' }, status: 'sourced' }),
  lc('sourced business claim by a review', { text: 'Best detailer in town!', kind: 'superlative', path: 'testimonialPlaceholders[0].text', source: { field: 'testimonials', quote: 'Best detailer in town!' }, status: 'sourced' }),
  lc('sourced review, word for word', { text: 'Best detailer in town!', kind: 'review', path: 'testimonialPlaceholders[0].text', source: { field: 'testimonials', quote: 'Best detailer in town!' }, status: 'sourced' }),
  lc('sourced review by an intake answer', { text: 'Best detailer in town!', kind: 'review', source: { field: 'about', quote: 'detailing cars for 8 years' }, status: 'sourced' }),
  lc('sourced review, reworded', { text: 'On time and friendly. Highly recommend us to everyone!', kind: 'review', path: 'testimonialPlaceholders[1].text', source: { field: 'testimonials', quote: 'On time and friendly. Highly recommend!' }, status: 'sourced' }),
  lc('sourced review, excerpt of a reworded one', { text: 'On time and friendly', kind: 'review', path: 'testimonialPlaceholders[1].text', source: { field: 'testimonials', quote: 'On time and friendly' }, status: 'sourced' }),
  lc('sourced with a suggestion', { text: 'detailing cars for 8 years', kind: 'years', source: { field: 'about', quote: 'detailing cars for 8 years' }, status: 'sourced', suggestion: 'Keep it' }),
  lc('unsourced, rewrite stays inside the sources', { text: 'Exampleton\'s #1 detailer', kind: 'superlative', path: 'headline', suggestion: 'Exampleton detailing, 8 years of experience' }),
  lc('unsourced, remove with its own number', { text: '500+ cars done', kind: 'number', path: 'headline', suggestion: 'Remove "500+ cars done"' }),
  lc('unsourced, rewrite adds a number', { text: 'Exampleton\'s #1 detailer', kind: 'superlative', suggestion: 'Exampleton\'s detailer since 2012' }),
  lc('unsourced without a suggestion', { text: 'Exampleton\'s #1 detailer', kind: 'superlative' }),
  lc('unsourced with a source', { text: 'A lifetime warranty', where: 'gbp', kind: 'warranty', source: { field: 'services', quote: 'Ceramic Coating - $899 (5 year warranty)' }, suggestion: 'A 5-year warranty' }),
  lc('needs a rewrite, source and suggestion', { text: 'A lifetime warranty', where: 'gbp', kind: 'warranty', source: { field: 'services', quote: 'Ceramic Coating - $899 (5 year warranty)' }, status: 'needs-rewrite', suggestion: 'A 5-year warranty on ceramic coating' }),
  lc('needs a rewrite without a suggestion', { text: 'Serving Exampleton, Sampleville and Demo Beach', where: 'gbp', kind: 'area', source: { field: 'serviceArea', quote: 'Exampleton and Sampleville' }, status: 'needs-rewrite' }),
  lc('needs a rewrite, suggestion adds a number', { text: 'Over 10 years of experience', kind: 'years', source: { field: 'about', quote: 'detailing cars for 8 years' }, status: 'needs-rewrite', suggestion: 'Over 12 years of experience' }),
  lc('a note the skill wrote', { text: 'Exampleton\'s #1 detailer', kind: 'superlative', path: 'headline', suggestion: 'Exampleton detailing', note: 'Checked by the server' }),
];

// Does sanitizeLedger store the claim exactly as the skill wrote it?
function keptAsWritten(claim) {
  const data = sanitizeLedger({ claims: [claim] }, { sources: LEDGER_SOURCES, checked: LEDGER_CHECKED });
  return JSON.stringify(data.claims[0]) === JSON.stringify(claim);
}

function parityFixture() {
  return {
    generatedBy: 'src/lib/kit/claims.test.js from src/lib/kit/claims.js',
    constants: {
      version: LEDGER_VERSION,
      statuses: [...CLAIM_STATUSES],
      where: [...CLAIM_WHERE],
      kinds: [...CLAIM_KINDS],
      limits: { ...CLAIM_LIMITS },
      reviewField: REVIEW_FIELD,
      businessInfoPrefix: BUSINESS_INFO_PREFIX,
    },
    normalize: NUMBER_CASES.concat(QUOTE_CASES.map((q) => q[0])).map((t) => [t, normalizeClaimText(t)]),
    numbers: NUMBER_CASES.map((t) => [t, claimNumbers(t)]),
    quotes: QUOTE_CASES.map(([q, t]) => [q, t, quoteInText(q, t)]),
    reviewPaths: REVIEW_PATH_CASES.map((p) => [p, isReviewPath(p)]),
    ledgerSources: LEDGER_SOURCES,
    ledgerChecked: LEDGER_CHECKED,
    ledgerClaims: LEDGER_CLAIM_CASES.map(({ name, claim }) => ({ name, claim, kept: keptAsWritten(claim) })),
  };
}

// Non-ASCII as \\u escapes: the cases include invisible characters.
const ascii = (v) => JSON.stringify(v).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

// One case per line: readable diffs.
function stableJson(obj) {
  const lines = ['{'];
  const keys = Object.keys(obj);
  keys.forEach((key, i) => {
    const v = obj[key];
    const comma = i < keys.length - 1 ? ',' : '';
    if (Array.isArray(v)) {
      lines.push(`  ${JSON.stringify(key)}: [`);
      v.forEach((item, j) => lines.push(`    ${ascii(item)}${j < v.length - 1 ? ',' : ''}`));
      lines.push(`  ]${comma}`);
    } else if (v && typeof v === 'object') {
      const inner = Object.keys(v);
      lines.push(`  ${JSON.stringify(key)}: {`);
      inner.forEach((k, j) => lines.push(`    ${JSON.stringify(k)}: ${ascii(v[k])}${j < inner.length - 1 ? ',' : ''}`));
      lines.push(`  }${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${ascii(v)}${comma}`);
    }
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

describe('launch-claims-ledger skill data', () => {
  it('tests/parity.json matches src/lib/kit/claims.js', () => {
    const content = stableJson(parityFixture());
    if (UPDATE || !fs.existsSync(PARITY)) fs.writeFileSync(PARITY, content);
    const committed = fs.readFileSync(PARITY, 'utf8').replace(/\r\n/g, '\n');
    expect(committed, 'skills/api/launch-claims-ledger/tests/parity.json is stale: UPDATE_SKILL_FIXTURES=1 npx vitest run src/lib/kit/claims.test.js').toBe(content);
  });
});

describe('text rules', () => {
  it('compares quotes exactly like designSuggest.js', () => {
    for (const [q, t] of QUOTE_CASES) expect(quoteInText(q, t), q).toBe(suggestQuoteInText(q, t));
  });

  it('reads numbers in digits and words', () => {
    expect(claimNumbers('Over 10 years')).toEqual(['10']);
    expect(claimNumbers('over twenty-five years')).toEqual(['25']);
    expect(claimNumbers('a five-year warranty')).toEqual(['5']);
    expect(claimNumbers('$1,299.00')).toEqual(['1299']);
    expect(claimNumbers('4.90 stars')).toEqual(['4.9']);
    expect(claimNumbers('Showroom shine')).toEqual([]);
  });

  it('names source fields canonically', () => {
    expect(sourceFieldOf('about')).toBe('about');
    expect(sourceFieldOf('intake.about')).toBe('about');
    expect(sourceFieldOf('reviews')).toBe(REVIEW_FIELD);
    expect(sourceFieldOf('businessInfo.services[0].price')).toBe('businessInfo.services');
    expect(sourceFieldOf('business_info: yearsInBusiness')).toBe('businessInfo.yearsInBusiness');
    expect(sourceFieldOf('../etc')).toBe('');
    expect(sourceFieldOf(42)).toBe('');
  });

  it('labels sources for the admin', () => {
    expect(sourceLabel('about')).toBe('Intake: Your story');
    expect(sourceLabel('testimonials')).toBe('Pasted reviews');
    expect(sourceLabel('businessInfo.yearsInBusiness')).toBe('Business info: Years in business');
    expect(sourceLabel('businessInfo.somethingNew')).toBe('Business info: somethingNew');
    expect(sourceLabel('')).toBe('Unknown source');
  });

  it('quotes from the intake answers the suggestion step trusts, and real form fields only', () => {
    for (const id of FACT_SOURCE_FIELDS) expect(CLAIM_SOURCE_FIELDS).toContain(id);
    for (const id of CLAIM_SOURCE_FIELDS) expect(FORM_FIELDS.some((f) => f.id === id), id).toBe(true);
    expect(FORM_FIELDS.some((f) => f.id === REVIEW_FIELD)).toBe(true);
    for (const id of ['contactName', 'contactEmail', 'contactPhone']) expect(CLAIM_SOURCE_FIELDS).not.toContain(id);
  });
});

const SOURCES = [
  { field: 'about', text: 'I\'ve been detailing cars for 8 years. I got my IDA certification in 2024.' },
  { field: 'services', text: 'Full Detail - $199\nCeramic Coating - $899 (5 year warranty)' },
  { field: 'testimonials', text: '"Best detailer in town!" - Riley Q.' },
  { field: 'businessInfo.googlePlace', text: 'googlePlace.rating: 4.8\ngooglePlace.reviewCount: 37' },
];
const claim = (extra) => ({ text: 'x', where: 'site', kind: 'other', path: 'p', source: null, status: 'unsourced', suggestion: 'Remove it', ...extra });

describe('sanitizeLedger', () => {
  it('rejects what is not a ledger', () => {
    expect(sanitizeLedger(null)).toBeNull();
    expect(sanitizeLedger([])).toBeNull();
    expect(sanitizeLedger({ claims: 'no' })).toBeNull();
    expect(sanitizeLedger({ claims: [] })).toEqual({
      version: 1, claims: [], counts: { sourced: 0, unsourced: 0, needsRewrite: 0, total: 0 }, scope: [], dismissed: 0,
    });
  });

  it('keeps a well-formed ledger as written and recomputes the counts', () => {
    const raw = {
      version: 1,
      claims: [
        claim({ text: 'detailing cars for 8 years', kind: 'years', path: 'aboutText', source: { field: 'about', quote: 'detailing cars for 8 years' }, status: 'sourced', suggestion: '' }),
        claim({ text: 'Exampleton\'s #1 detailer', kind: 'superlative', path: 'headline', suggestion: 'Exampleton mobile detailing' }),
        claim({ text: 'lifetime warranty', kind: 'warranty', where: 'print', path: 'print:glovebox-card.pdf p1', source: { field: 'services', quote: 'Ceramic Coating - $899 (5 year warranty)' }, status: 'needs-rewrite', suggestion: '5-year warranty on ceramic coating' }),
        claim({ text: 'Best detailer in town!', kind: 'review', path: 'testimonialPlaceholders[0].text', source: { field: 'testimonials', quote: 'Best detailer in town!' }, status: 'sourced', suggestion: '' }),
      ],
      dismissed: [{ ref: 'c9', reason: 'top coat' }],
      counts: { sourced: 99, unsourced: 0, needsRewrite: 0 },
    };
    const data = sanitizeLedger(raw, { sources: SOURCES, scope: ['print', 'site', 'nowhere'] });
    expect(data.claims).toEqual(raw.claims.map(({ ...c }) => c));
    expect(data.counts).toEqual({ sourced: 2, unsourced: 1, needsRewrite: 1, total: 4 });
    expect(data.scope).toEqual(['site', 'print']);
    expect(data.dismissed).toBe(1);
    expect(data.claims.some((c) => 'note' in c)).toBe(false);
  });

  it('never lets a quote the customer did not write source a claim', () => {
    const data = sanitizeLedger({
      claims: [claim({ text: 'Over 10 years', kind: 'years', source: { field: 'about', quote: 'detailing cars for 10 years' }, status: 'sourced', suggestion: '' })],
    }, { sources: SOURCES });
    expect(data.claims[0]).toMatchObject({ status: 'unsourced', source: null });
    expect(data.claims[0].suggestion).toMatch(/Remove it/);
    expect(data.claims[0].note).toMatch(/isn't in the customer's answers/);
  });

  it('moves a real quote to the field that holds it', () => {
    const data = sanitizeLedger({
      claims: [claim({ text: 'Full Detail $199', kind: 'price', source: { field: 'about', quote: 'Full Detail - $199' }, status: 'sourced', suggestion: '' })],
    }, { sources: SOURCES });
    expect(data.claims[0]).toMatchObject({ status: 'sourced', source: { field: 'services', quote: 'Full Detail - $199' } });
    expect(data.claims[0].note).toBeUndefined();
  });

  it('downgrades a sourced claim whose numbers the quote does not state', () => {
    const data = sanitizeLedger({
      claims: [claim({ text: 'detailing cars for 10 years', kind: 'years', source: { field: 'about', quote: 'detailing cars for 8 years' }, status: 'sourced', suggestion: '' })],
    }, { sources: SOURCES });
    expect(data.claims[0]).toMatchObject({ status: 'needs-rewrite', suggestion: 'Say only what the source says: "detailing cars for 8 years"' });
    expect(data.claims[0].note).toMatch(/doesn't say 10/);
  });

  it('keeps reviews to reviews', () => {
    const data = sanitizeLedger({
      claims: [
        claim({ text: 'Best detailer in town', kind: 'superlative', source: { field: 'reviews', quote: 'Best detailer in town!' }, status: 'sourced', suggestion: '' }),
        claim({ text: 'Great work every time', kind: 'review', source: { field: 'about', quote: 'detailing cars for 8 years' }, status: 'sourced', suggestion: '' }),
      ],
    }, { sources: SOURCES });
    expect(data.claims[0]).toMatchObject({ status: 'needs-rewrite', source: { field: 'testimonials' } });
    expect(data.claims[0].suggestion).toMatch(/Show it only as a review/);
    expect(data.claims[1]).toMatchObject({ status: 'unsourced', source: null });
  });

  it('fills a missing suggestion and clears one on a sourced claim', () => {
    const data = sanitizeLedger({
      claims: [
        claim({ text: 'a', suggestion: '' }),
        claim({ text: 'b', status: 'needs-rewrite', source: { field: 'services', quote: 'Ceramic Coating - $899 (5 year warranty)' }, suggestion: '' }),
        claim({ text: 'c', status: 'needs-rewrite', suggestion: '' }),
        claim({ text: 'rating 4.8', kind: 'rating', status: 'sourced', source: { field: 'businessInfo.googlePlace', quote: 'googlePlace.rating: 4.8' }, suggestion: 'keep' }),
      ],
    }, { sources: SOURCES });
    expect(data.claims.map((c) => c.status)).toEqual(['unsourced', 'needs-rewrite', 'needs-rewrite', 'sourced']);
    expect(data.claims[0].suggestion).toMatch(/^Remove it/);
    expect(data.claims[1].suggestion).toBe('Say only what the source says: "Ceramic Coating - $899 (5 year warranty)"');
    expect(data.claims[2].suggestion).toMatch(/^Reword it/);
    expect(data.claims[3].suggestion).toBe('');
  });

  it('cleans every field: enums, one line, caps, repeats', () => {
    const long = 'word '.repeat(200);
    const data = sanitizeLedger({
      claims: [
        claim({ text: `  Line one\nline\ttwo ${long}`, where: 'billboard', kind: 'gossip', status: 'maybe', path: 7, source: 'about', suggestion: long }),
        claim({ text: 'Line ONE line two', where: 'site' }),
        claim({ text: 'Same text', where: 'gbp' }),
        claim({ text: 'Same  text', where: 'gbp' }),
        claim({ text: 'Same text', where: 'print' }),
        claim({ text: '   ' }),
        'nope',
      ],
      scope: ['gbp'],
      dismissed: 3,
    });
    const [first] = data.claims;
    expect(first).toMatchObject({ where: 'site', kind: 'other', status: 'unsourced', path: '', source: null });
    expect(first.text.length).toBeLessThanOrEqual(CLAIM_LIMITS.text);
    expect(first.text).not.toMatch(/[\n\t]|  /);
    expect(first.suggestion.length).toBeLessThanOrEqual(CLAIM_LIMITS.suggestion);
    expect(data.claims.map((c) => `${c.where}:${c.text}`).slice(1)).toEqual(['site:Line ONE line two', 'gbp:Same text', 'print:Same text']);
    expect(data.scope).toEqual(['gbp']);
    expect(data.dismissed).toBe(3);
  });

  it('keeps the same claim in another text, once per text', () => {
    const data = sanitizeLedger({
      claims: [
        claim({ text: 'lifetime warranty', where: 'gbp', path: 'words.gbp.posts[0].body' }),
        claim({ text: 'Lifetime  warranty', where: 'gbp', path: 'words.gbp.posts[3].body' }),
        claim({ text: 'lifetime warranty', where: 'gbp', path: 'words.gbp.posts[0].body', suggestion: 'again' }),
      ],
    }, { sources: SOURCES });
    expect(data.claims.map((c) => c.path)).toEqual(['words.gbp.posts[0].body', 'words.gbp.posts[3].body']);
  });

  it('never takes a note from the skill as the server\'s own', () => {
    const fresh = sanitizeLedger({
      claims: [claim({ text: 'Exampleton\'s #1 detailer', note: 'Verified by the server.' })],
    }, { sources: SOURCES, checked: [] });
    expect(fresh.claims[0]).not.toHaveProperty('note');
    // Stored data read again (the view, no sources) keeps the server's note.
    expect(sanitizeLedger({ claims: [{ ...fresh.claims[0], note: 'The source doesn\'t say 10.' }] }).claims[0].note)
      .toBe('The source doesn\'t say 10.');
  });

  it('caps the number of claims', () => {
    const many = Array.from({ length: CLAIM_LIMITS.claims + 20 }, (_, i) => claim({ text: `claim ${i}` }));
    expect(sanitizeLedger({ claims: many }).claims).toHaveLength(CLAIM_LIMITS.claims);
  });

  it('stores exactly the claims the skill\'s validator passes (parity.json ledgerClaims)', () => {
    const kept = LEDGER_CLAIM_CASES.filter(({ claim: c }) => keptAsWritten(c)).map((x) => x.name);
    expect(kept).toEqual([
      'sourced, same number',
      'sourced, from the business info',
      'sourced review, word for word',
      'unsourced, rewrite stays inside the sources',
      'unsourced, remove with its own number',
      'needs a rewrite, source and suggestion',
    ]);
  });

  it('flags a review on the page that is not the customer\'s exact wording', () => {
    const data = sanitizeLedger({
      claims: LEDGER_CLAIM_CASES.filter((x) => /^sourced review, (reworded|excerpt)/.test(x.name)).map((x) => x.claim),
    }, { sources: LEDGER_SOURCES, checked: LEDGER_CHECKED });
    for (const c of data.claims) {
      expect(c).toMatchObject({ status: 'needs-rewrite', source: { field: 'testimonials' } });
      expect(c.note).toMatch(/isn't word for word one of the pasted reviews/);
    }
    expect(data.claims[0].suggestion).toBe('Use the customer\'s own wording exactly: "On time and friendly. Highly recommend!"');
    // Without the checked texts, an excerpt that is in the reviews passes.
    expect(sanitizeLedger({ claims: [data.claims[1]].map((c) => ({ ...c, status: 'sourced', suggestion: '', note: undefined })) }, { sources: LEDGER_SOURCES }).claims[0].status).toBe('sourced');
  });

  it('never keeps a rewrite that brings in a number no source states', () => {
    const [c] = sanitizeLedger({
      claims: [LEDGER_CLAIM_CASES.find((x) => x.name === 'needs a rewrite, suggestion adds a number').claim],
    }, { sources: LEDGER_SOURCES, checked: LEDGER_CHECKED }).claims;
    expect(c.status).toBe('needs-rewrite');
    expect(c.suggestion).toBe('Say only what the source says: "detailing cars for 8 years"');
    expect(c.note).toBe('The suggested rewrite said 12, which no source states.');
  });

  it('knows which checked texts are reviews shown on the site', () => {
    expect(REVIEW_PATH_CASES.filter(isReviewPath)).toEqual(['testimonialPlaceholders[0].text', 'testimonialPlaceholders[2]', 'testimonials[1].quote']);
    expect(isReviewPath(null)).toBe(false);
  });

  it('is stable: sanitizing stored data again changes nothing', () => {
    const once = sanitizeLedger({
      claims: [
        claim({ text: 'detailing cars for 10 years', source: { field: 'about', quote: 'detailing cars for 8 years' }, status: 'sourced', suggestion: '' }),
        claim({ text: 'Over 10 years', source: { field: 'about', quote: 'made up quote here' }, status: 'sourced', suggestion: '' }),
      ],
    }, { sources: SOURCES, scope: ['site'] });
    expect(sanitizeLedger(once)).toEqual(once);
  });
});

describe('the admin view helpers', () => {
  const data = sanitizeLedger({
    claims: [
      claim({ text: 'Tampa\'s #1 detailer', kind: 'superlative', where: 'site' }),
      claim({ text: '8 years', kind: 'years', where: 'gbp', status: 'sourced', source: { field: 'about', quote: 'detailing cars for 8 years' }, suggestion: '' }),
      claim({ text: 'lifetime warranty', kind: 'warranty', where: 'print', status: 'needs-rewrite', suggestion: '5-year warranty' }),
      claim({ text: 'satisfaction guaranteed', kind: 'guarantee', where: 'seo' }),
    ],
  }, { sources: SOURCES });

  it('filters by status, place and text', () => {
    expect(filterClaims(data.claims, { status: 'unsourced' }).map((c) => c.text)).toEqual(['Tampa\'s #1 detailer', 'satisfaction guaranteed']);
    expect(filterClaims(data.claims, { where: 'print' }).map((c) => c.text)).toEqual(['lifetime warranty']);
    expect(filterClaims(data.claims, { query: 'WARRANTY' })).toHaveLength(1);
    expect(filterClaims(data.claims, { query: 'best / #1' })).toHaveLength(1);
    expect(filterClaims(data.claims, { status: 'all', where: 'all', query: '' })).toHaveLength(4);
    expect(filterClaims(null)).toEqual([]);
  });

  it('groups by status, what needs work first', () => {
    expect(groupClaims(data.claims).map((g) => [g.status, g.label, g.claims.length])).toEqual([
      ['needs-rewrite', 'Needs a rewrite', 1], ['unsourced', 'No source', 2], ['sourced', 'Sourced', 1],
    ]);
    expect(groupClaims([])).toEqual([]);
  });

  it('sums up in one line', () => {
    expect(ledgerSummary(data)).toBe('1 needs a rewrite, 2 have no source, 1 sourced');
    expect(ledgerSummary({ counts: { sourced: 3, unsourced: 1, needsRewrite: 0 } })).toBe('1 has no source, 3 sourced');
    expect(ledgerSummary({ claims: [] })).toBe('No claims found to check.');
    expect(ledgerSummary(null)).toBe('No claims found to check.');
    expect(openClaims(data)).toBe(3);
    expect(claimCounts(data.claims)).toEqual(data.counts);
  });
});

describe('the sign-off', () => {
  it('reads a sign-off from untrusted input', () => {
    expect(sanitizeClaimsSignOff({ at: '2026-10-05T15:30:00+00:00', by: '  Mike\nR. ', open: 2, startedAt: '2026-10-05T12:00:00Z', x: 1 }))
      .toEqual({ at: '2026-10-05T15:30:00.000Z', by: 'Mike R.', open: 2, startedAt: '2026-10-05T12:00:00.000Z' });
    expect(sanitizeClaimsSignOff(true)).toEqual({ at: '', by: '', open: null, startedAt: '' });
    expect(sanitizeClaimsSignOff({ at: 'yesterday', open: -1 })).toEqual({ at: '', by: '', open: null, startedAt: '' });
    for (const v of [false, null, 'yes', [], { signedOff: false, at: '2026-10-05T15:30:00Z' }]) expect(sanitizeClaimsSignOff(v)).toBeNull();
  });

  it('sums it up for the handover, for this run only', () => {
    const data = { counts: { sourced: 14, unsourced: 0, needsRewrite: 2 } };
    const run = { startedAt: '2026-10-05T12:00:00.000Z' };
    expect(claimsSignOffLine(data, null, run)).toBe('Not signed off: 2 need a rewrite, 14 sourced');
    expect(claimsSignOffLine(data, { at: '2026-10-05T15:30:00Z', by: 'Mike', open: 2, startedAt: run.startedAt }, run))
      .toBe('Signed off 2026-10-05 by Mike; 2 claims were still open.');
    expect(claimsSignOffLine(data, { at: '2026-10-05T15:30:00Z', open: 0 }, run)).toBe('Signed off 2026-10-05; every claim was fixed or sourced.');
    expect(claimsSignOffLine(data, true)).toBe('Signed off.');
    // A sign-off of an earlier ledger: this one hasn't been checked.
    expect(claimsSignOffLine(data, { at: '2026-10-01T09:00:00Z', startedAt: '2026-10-01T08:00:00Z' }, run)).toMatch(/^Not signed off/);
  });
});

// ─── The admin's result view (server-rendered: no DOM here) ───────────

describe('ClaimsResult', () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'skills/api/launch-claims-ledger/tests/sample_ledger.json'), 'utf8'));
  const run = (data, extra = {}) => ({ status: 'ready', startedAt: '2026-10-05T12:00:00.000Z', finishedAt: '2026-10-05T12:04:00.000Z', data, ...extra });
  const stored = sanitizeLedger(ledger, { scope: ['site', 'seo', 'gbp', 'social'] });
  const render = (props) => renderToStaticMarkup(createElement(ClaimsResult, { project: {}, urls: {}, ...props }));
  const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

  it('groups the claims by what needs work first, with sources and suggestions', () => {
    const html = render({ run: run(stored) });
    const t = text(html);
    expect(t).toContain('7 need a rewrite, 5 have no source, 26 sourced');
    // The stored scope left Print out, but the ledger has print claims: it was read.
    expect(t).toContain('Checked: Site, Google profile, Search (SEO), Social, Print. 1 pattern match');
    expect(t).not.toContain('Not checked');
    expect(t).toContain('Everywhere Site · 18 Google profile · 8 Search (SEO) · 6 Social · 3 Print · 3');
    expect(t).toContain('1 pattern match was read and judged not to be claims.');
    const order = ['Needs a rewrite 7', 'No source 5', 'Sourced 26'].map((g) => t.indexOf(` ${g} `));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The sourced list starts closed while claims are open; the others open.
    expect(html.match(/<details open=""/g)).toHaveLength(2);
    expect(t).toContain('“Over 10 years of experience”');
    expect(t).toContain('Intake: Your story');
    expect(t).toContain('8 years of experience Copy');
    expect(t).toContain('Remove "satisfaction guaranteed" Copy');
    expect(t).toContain('Business info: Google profile');
    expect(html).toContain('aria-pressed="true"');
    // Table roles survive the phone layout (rows and cells shown as blocks).
    expect(html).toContain('<table role="table"');
    expect(html.match(/<td role="cell"/g)).toHaveLength(stored.claims.length * 3);
    expect(html).not.toMatch(/<script|on[a-z]+="/i);
  });

  it('has a sign-off box that works without a saver, and shows a saved one', () => {
    const unsaved = text(render({ run: run(stored) }));
    expect(unsaved).toContain('Signed off Every claim is fixed');
    expect(unsaved).toContain('Only on this screen: the sign-off isn\'t saved yet.');
    expect(unsaved).toContain('12 claims in this ledger still need a rewrite or a source.');
    expect(render({ run: run(stored) })).not.toMatch(/type="checkbox"[^>]*checked=""/);

    const saved = render({ run: run(stored), signedOff: { at: '2026-10-05T15:30:00.000Z' }, onSignOff: () => {} });
    expect(saved).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(text(saved)).not.toContain('Only on this screen');
    expect(text(saved)).toMatch(/Signed off Oct 5, \d+:30 [AP]M\./);
    expect(render({ run: run(stored, { signOff: true }) })).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(render({ run: run(stored, { signOff: true }), signedOff: false })).not.toMatch(/type="checkbox"[^>]*checked=""/);
    expect(text(render({ run: run(stored), signedOff: { by: 'Mike', startedAt: '2026-10-05T12:00:00+00:00' } }))).toContain('Signed off by Mike.');
    // Signed off for an earlier run of the ledger: this one starts unchecked.
    expect(render({ run: run(stored), signedOff: { at: '2026-10-01T09:00:00Z', startedAt: '2026-10-01T08:00:00Z' } })).not.toMatch(/type="checkbox"[^>]*checked=""/);
  });

  it('opens the sourced list when nothing else needs work, and copes with empty or broken data', () => {
    const allSourced = sanitizeLedger({ claims: ledger.claims.filter((c) => c.status === 'sourced') });
    const html = render({ run: run(allSourced) });
    expect(html.match(/<details open=""/g)).toHaveLength(1);
    expect(text(html)).not.toContain('still need');
    expect(text(render({ run: run({ claims: [] }) }))).toContain('The pages hold no factual claims to check');
    expect(text(render({ run: run({ claims: [], scope: ['site', 'seo'] }) })))
      .toContain('Checked: Site, Search (SEO). Not checked: Google profile, Social, Print (nothing there to check when this ran).');
    expect(text(render({ run: run({ nope: 1 }) }))).toContain('The ledger in this run couldn\'t be read.');
    expect(text(render({ run: null }))).toContain('couldn\'t be read');
  });

  it('shows what the server changed and why', () => {
    const changed = sanitizeLedger({
      claims: [claim({ text: 'detailing cars for 10 years', kind: 'years', source: { field: 'about', quote: 'detailing cars for 8 years' }, status: 'sourced', suggestion: '' })],
    }, { sources: SOURCES });
    expect(text(render({ run: run(changed) }))).toContain('Changed by the server: The source doesn\'t say 10.');
  });
});
