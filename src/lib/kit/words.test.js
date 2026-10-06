// src/lib/kit/words.test.js
//
// The Words kit's pure contract and sanitizer: the limits and claim words
// match the skill's own data files (validate_words.py enforces the same),
// the skill's sample deck passes unchanged, and every repair the server
// makes to an untrusted words.json is listed for the admin.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WordsResult from '../../components/admin/kit/WordsResult.jsx';
import {
  CLAIM_TERMS, NAME_PLACEHOLDER, REVIEW_LINK_PLACEHOLDER, WORDS_LIMITS, WORDS_SCHEMA, cleanBlock, fitText, gatingHits,
  incentiveHits, moneyHits, nameKey, oneLine, phoneHits, sanitizeWords, saysBookOnline, unsourcedClaims, urlHits,
  wordsPlainText, wordsReport, wordsSections, wordsSources,
} from './words.js';

const SKILL = path.resolve(__dirname, '../../../skills/api/launch-words');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(SKILL, rel), 'utf8'));
const withoutDoc = ({ _doc, ...rest }) => rest;
const clone = (v) => structuredClone(v);

const SAMPLE_INPUTS = readJson('tests/sample_inputs.json');
const SAMPLE_WORDS = readJson('tests/sample_words.json');
const PLACE = 'ChIJsample-Words-Place01';
const REVIEW = `https://search.google.com/local/writereview?placeid=${PLACE}`;

// The sanitizer's options for a words-inputs.json (what the server spec
// builds from the same facts; the photo paths are the stored uploads).
function optionsOf(inputs) {
  const src = inputs.sources || {};
  return {
    services: inputs.services.map((s) => s.name),
    phone: inputs.business.phone,
    urls: inputs.urls,
    photos: inputs.photos.map((p) => ({ ref: p.ref, file: p.file, path: `proj/photo/${p.ref}.png`, name: p.name })),
    sources: { primary: `${src.intake}\n${src.business}`, reviews: src.reviews, site: src.site },
  };
}
const OPTS = optionsOf(SAMPLE_INPUTS);
const report = (raw, opts = OPTS) => wordsReport(raw, opts);

describe('the contract', () => {
  it('has the same limits and claim words as the skill', () => {
    expect(WORDS_LIMITS).toEqual(withoutDoc(readJson('data/limits.json')));
    expect(CLAIM_TERMS).toEqual(withoutDoc(readJson('data/claim_terms.json')));
  });

  it('matches the contract numbers', () => {
    expect(WORDS_LIMITS.gbp.description.max).toBe(750);
    expect(WORDS_LIMITS.gbp.posts.count).toBe(12);
    expect(WORDS_LIMITS.gbp.posts.body).toBe(1500);
    expect(WORDS_LIMITS.seo.title.max).toBe(60);
    expect(WORDS_LIMITS.seo.description.max).toBe(160);
    expect(WORDS_LIMITS.reviews.requestSms).toBe(300);
    expect(WORDS_LIMITS.social.bio).toBe(150);
    expect(WORDS_LIMITS.social.captions).toBe(3);
    expect(WORDS_LIMITS.ctas).toEqual(['BOOK', 'CALL', 'LEARN_MORE']);
  });

  it('describes words.json as a closed schema', () => {
    expect(WORDS_SCHEMA.required).toEqual(['gbp', 'seo', 'reviews', 'social', 'notes']);
    expect(WORDS_SCHEMA.properties.gbp.properties.posts.minItems).toBe(12);
    expect(WORDS_SCHEMA.properties.gbp.properties.categories.items.properties.confirm).toEqual({ const: true });
    expect(WORDS_SCHEMA.properties.reviews.properties.replies.items.properties.rating).toEqual({ type: 'integer', minimum: 1, maximum: 5 });
    expect(Object.isFrozen(WORDS_SCHEMA.properties.gbp)).toBe(true);
  });
});

describe('text helpers', () => {
  it('cleans one-line and block text like the skill', () => {
    expect(oneLine(' a\u2028b \u00a0 c ')).toBe('a b c');
    expect(cleanBlock('a  \r\nb\n\n\n\nc\u00a0')).toBe('a\nb\n\nc');
    expect(nameKey('Wash & Wax!')).toBe('washandwax');
  });

  it('cuts at a sentence, else at a word, never mid-word', () => {
    expect(fitText('Short.', 10)).toEqual({ text: 'Short.', cut: false });
    expect(fitText('One sentence here. Another one that runs long.', 30)).toEqual({ text: 'One sentence here.', cut: true });
    const cut = fitText('word '.repeat(30).trim(), 42);
    expect(cut.cut).toBe(true);
    expect(cut.text.length).toBeLessThanOrEqual(42);
    expect(cut.text.endsWith('word…')).toBe(true);
    // Never half an emoji (a lone surrogate) before the ellipsis.
    expect(fitText(`aaaaa${'\u{1F697}'.repeat(5)}`, 7)).toEqual({ text: 'aaaaa…', cut: true });
  });

  it('finds incentives, gating, prices, phones, links and booking promises', () => {
    expect(incentiveHits('Get 10% off your next detail')).toEqual(['10% off']);
    expect(incentiveHits('Feel free to reply')).toEqual([]);
    expect(incentiveHits('Entered to win a gift card')).toEqual(expect.arrayContaining(['gift card', 'entered to win']));
    expect(gatingHits('If you were happy, leave 5 stars')).toEqual(expect.arrayContaining(['if you were happy', '5 stars']));
    expect(moneyHits('Full Detail $220, Coating from $1,200.')).toEqual(['$220', '$1,200']);
    expect(phoneHits('Call (813) 555-0142 or 813.555.0199')).toEqual(['(813) 555-0142', '813.555.0199']);
    expect(phoneHits(REVIEW)).toEqual([]);
    expect(urlHits('See northside.com/book and https://x.co/a')).toEqual(['northside.com/book', 'https://x.co/a']);
    expect(saysBookOnline('Book online in a minute')).toBe(true);
    expect(saysBookOnline('Booking a detail is easy')).toBe(false);
  });
});

describe('unsourced claims', () => {
  const sources = wordsSources({
    primary: 'Mobile detailing. Full Detail $220. Started in 2019. Pet hair is our specialty.',
    reviews: '"Best detailer in Tampa, five stars!" - Kim R.',
    site: 'Fully insured detailers.',
  });
  const claims = (t) => unsourcedClaims(t, sources);

  it('flags facts nobody gave', () => {
    expect(claims('The #1 detailer since 2010, 500+ cars, $99 washes.')).toEqual(expect.arrayContaining([
      { level: 'hard', claim: '#1' }, { level: 'hard', claim: 'since 2010' }, { level: 'hard', claim: '$99' },
    ]));
    expect(claims('Licensed, guaranteed and award-winning.').map((c) => c.claim)).toEqual(expect.arrayContaining(['licensed', 'guarantee', 'award-winning'].map((w) => expect.stringContaining(w.slice(0, 7)))));
    expect(claims('Over 500 cars detailed.')).toEqual([{ level: 'hard', claim: '500 cars' }]);
  });

  it('passes what the customer said, figures of speech and their own numbers', () => {
    expect(claims('Mobile detailing from $220, since 2019. Feel free to text. A swirl-free finish. License plates blurred.')).toEqual([]);
  });

  it('takes review claims only as word-for-word quotes', () => {
    expect(claims('Five stars from our customers.')).toEqual([{ level: 'hard', claim: 'five stars' }]);
    expect(claims('"Best detailer in Tampa, five stars!" - Kim R.')).toEqual([]);
  });

  it('marks a claim only the site makes as soft', () => {
    expect(claims('Fully insured.')).toEqual([{ level: 'soft', claim: 'insured' }]);
  });
});

describe('sanitizeWords', () => {
  it('keeps the skill\'s sample deck as written', () => {
    const { data, adjustments } = report(SAMPLE_WORDS);
    expect(adjustments).toEqual([]);
    expect(data.adjustments).toEqual([]);
    expect(Object.keys(data)).toEqual(['gbp', 'seo', 'reviews', 'social', 'adjustments']);
    expect(data.gbp.description).toBe(SAMPLE_WORDS.gbp.description);
    expect(data.gbp.services).toEqual(SAMPLE_WORDS.gbp.services);
    expect(data.gbp.categories).toEqual(SAMPLE_WORDS.gbp.categories);
    expect(data.gbp.posts.map((p) => [p.title, p.body, p.cta, p.imageHint])).toEqual(SAMPLE_WORDS.gbp.posts.map((p) => [p.title, p.body, p.cta, p.imageHint]));
    expect(data.seo).toEqual(SAMPLE_WORDS.seo);
    expect(data.reviews.requestSms).toBe(SAMPLE_WORDS.reviews.requestSms);
    expect(data.reviews.requestEmail).toEqual(SAMPLE_WORDS.reviews.requestEmail);
    expect(data.reviews.replies.map((r) => r.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(data.reviews.link).toBe(REVIEW);
    expect(data.social).toEqual(SAMPLE_WORDS.social);
  });

  it('sets each post\'s link from the run and maps photos to the stored uploads', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.gbp.posts[0].link = 'https://evil.example';
    const { data } = report(raw);
    const [intro, spotlight] = data.gbp.posts;
    expect(intro.link).toBe(SAMPLE_INPUTS.urls.site);
    expect(spotlight.link).toBe(SAMPLE_INPUTS.urls.booking);
    expect(data.gbp.posts[11]).toMatchObject({ cta: 'CALL', link: '' });
    expect(intro.photo).toEqual({ path: 'proj/photo/photo-4.png', name: 'van.png' });
    expect(data.gbp.posts[3].photo).toBeNull();
    // BOOK falls back to the site without a booking page.
    const noBooking = report(SAMPLE_WORDS, { ...OPTS, urls: { ...OPTS.urls, booking: '' } }).data;
    expect(noBooking.gbp.posts[1].link).toBe(SAMPLE_INPUTS.urls.site);
    // Only http(s) links ever become a button's link.
    const odd = report(SAMPLE_WORDS, { ...OPTS, urls: { site: 'javascript:alert(1)', booking: 'data:text/html,x', review: REVIEW } }).data;
    expect(odd.gbp.posts.map((p) => p.link)).toEqual(Array(12).fill(''));
  });

  it('returns null for nothing usable', () => {
    expect(sanitizeWords(null)).toBeNull();
    expect(sanitizeWords('words')).toBeNull();
    expect(sanitizeWords([])).toBeNull();
    expect(sanitizeWords({ gbp: { posts: 'x' }, seo: 5 })).toBeNull();
    expect(sanitizeWords({ seo: { title: 'Mobile Detailing in Tampa' } })).not.toBeNull();
  });

  it('cuts what is over a limit and says so', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.gbp.description = `${'We detail cars in Tampa at your driveway. '.repeat(20)}`;
    raw.seo.title = 'Mobile Detailing in North Tampa, Lutz and Wesley Chapel | Northside Shine';
    raw.social.bio = `${raw.social.bio} ${raw.social.bio}`;
    const { data, adjustments } = report(raw);
    expect(data.gbp.description.length).toBeLessThanOrEqual(750);
    expect(data.gbp.description.endsWith('.')).toBe(true);
    expect(data.seo.title.length).toBeLessThanOrEqual(60);
    expect(data.social.bio.length).toBeLessThanOrEqual(150);
    expect(adjustments).toEqual(expect.arrayContaining([
      'Shortened the GBP description to 750 characters.', 'Shortened the SEO title to 60 characters.', 'Shortened the social bio to 150 characters.',
    ]));
  });

  it('puts the site\'s services back, in the site\'s order', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.gbp.services = [
      { name: 'ceramic coating', description: 'Coating.' },
      { name: 'Headlight Restoration', description: 'Not on the site.' },
      { name: 'Full Detail', description: 'Everything.' },
    ];
    const { data, adjustments } = report(raw);
    expect(data.gbp.services).toEqual([
      { name: 'Full Detail', description: 'Everything.' },
      { name: 'Interior Refresh', description: '' },
      { name: 'Ceramic Coating', description: 'Coating.' },
      { name: 'Maintenance Wash', description: '' },
    ]);
    expect(adjustments).toEqual(expect.arrayContaining([
      'Left out GBP services the site doesn\'t list: "Headlight Restoration".',
      'Added the site\'s service "Interior Refresh" to the GBP services, without a description.',
    ]));
    // Without site services the model's list stands (deduplicated).
    const own = report(raw, { ...OPTS, services: [] }).data;
    expect(own.gbp.services.map((s) => s.name)).toEqual(['ceramic coating', 'Headlight Restoration', 'Full Detail']);
  });

  it('makes every category a suggestion to confirm', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.gbp.categories = [{ name: 'Car detailing service', confirm: false }, 'Car wash', { name: 'car wash' }, ...Array.from({ length: 12 }, (_, i) => ({ name: `Cat ${i}` }))];
    const { data } = report(raw);
    expect(data.gbp.categories[0]).toEqual({ name: 'Car detailing service', confirm: true });
    expect(data.gbp.categories[1]).toEqual({ name: 'Car wash', confirm: true });
    expect(data.gbp.categories).toHaveLength(10);
    expect(data.gbp.categories.every((c) => c.confirm === true)).toBe(true);
  });

  it('repairs post buttons and photos and lists each repair', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.gbp.posts[0].cta = 'SHOP_NOW';
    raw.gbp.posts[1].photo = 'photo-9';
    raw.gbp.posts[2].photo = 'photo-3.png';
    raw.gbp.posts[4].title = '';
    raw.gbp.posts.push({ ...raw.gbp.posts[5], title: 'A 13th post' });
    const { data, adjustments } = report(raw);
    expect(data.gbp.posts).toHaveLength(11);
    expect(data.gbp.posts[0].cta).toBe('LEARN_MORE');
    expect(data.gbp.posts[1].photo).toBeNull();
    expect(data.gbp.posts[2].photo).toEqual({ path: 'proj/photo/photo-3.png', name: 'interior-before.png' });
    expect(adjustments).toEqual(expect.arrayContaining([
      'Kept the first 12 of 13 GBP posts.',
      'Post 1\'s button "SHOP_NOW" isn\'t a GBP button; set to Learn more.',
      'Post 2 named a photo the run didn\'t have ("photo-9").',
      'Left out a GBP post without a title.',
      'Only 11 of 12 GBP posts came back.',
    ]));
    const noPhone = report(SAMPLE_WORDS, { ...OPTS, phone: '' });
    expect(noPhone.data.gbp.posts[11].cta).toBe('LEARN_MORE');
    expect(noPhone.adjustments).toContain('Post 12 had a Call button but the business has no phone; set to Learn more.');
  });

  it('flags phone numbers, links and invented facts in posts', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.gbp.posts[0].body += '\n\nCall (813) 555-0142.';
    raw.gbp.posts[1].body += '\n\nThe #1 detailer since 2010. See https://example.com.';
    raw.gbp.description += ' Full Detail from $220.';
    const { adjustments } = report(raw);
    expect(adjustments).toEqual(expect.arrayContaining([
      'Check post 1: Google rejects posts with a phone number in the text ((813) 555-0142).',
      'Check post 2: "since 2010" isn\'t in the customer\'s answers.',
      'Check post 2: a link that isn\'t the business\'s (https://example.com.).',
      'Check the GBP description: Google keeps prices out of it ($220).',
    ]));
    // "#1" is in the sample intake (a planted instruction): the customer's
    // own words back it, so only the smoke check catches it.
    expect(adjustments.join(' ')).not.toContain('"#1"');
  });

  it('flags keywords and image hints like the skill\'s validator', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.seo.keywords.push('award winning detailer tampa');
    raw.gbp.posts[3].imageHint = 'Our certified team, see northside.com/team';
    const { adjustments } = report(raw);
    expect(adjustments).toEqual(expect.arrayContaining([
      'Check SEO keyword 7: "award" isn\'t in the customer\'s answers.',
      'Check post 4\'s image hint: "certified" isn\'t in the customer\'s answers.',
      'Check post 4\'s image hint: leave the link out (northside.com/team).',
    ]));
  });

  it('flags "book online" when the site takes no bookings', () => {
    const { adjustments } = report(SAMPLE_WORDS, { ...OPTS, urls: { ...OPTS.urls, booking: '' } });
    expect(adjustments).toContain('Check the GBP description: it says to book online, but the site takes no online bookings.');
  });

  it('keeps the review link where it belongs', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.reviews.requestSms = `Hi ${NAME_PLACEHOLDER}! Would you share an honest review on Google? ${REVIEW_LINK_PLACEHOLDER}`;
    raw.reviews.requestEmail.body = 'Hi [name],\n\nWould you share an honest review on Google?\n\nThanks!';
    const { data, adjustments } = report(raw);
    expect(data.reviews.requestSms).toBe(`Hi [name]! Would you share an honest review on Google? ${REVIEW}`);
    expect(data.reviews.requestEmail.body).toBe(`Hi [name],\n\nWould you share an honest review on Google?\n\nThanks!\n${REVIEW}`);
    expect(adjustments).toContain('Added the Google review link to the review email.');

    // No Google place: the placeholder stays, and is added where missing.
    const none = report(raw, { ...OPTS, urls: { ...OPTS.urls, review: '' } });
    expect(none.data.reviews.requestSms).toContain(REVIEW_LINK_PLACEHOLDER);
    expect(none.data.reviews.requestEmail.body.endsWith(` ${REVIEW_LINK_PLACEHOLDER}`)).toBe(true);
    expect(none.data.reviews.link).toBe('');
    expect(none.adjustments).toContain('Added [review link] to the review email: there is no Google place for the real link yet.');
  });

  it('never puts the review link in twice or past the limit', () => {
    const max = WORDS_LIMITS.reviews.requestSms;
    const raw = clone(SAMPLE_WORDS);
    // The link and a leftover placeholder: the placeholder goes.
    raw.reviews.requestEmail.body = `Hi [name],\n\nPlease review us: ${REVIEW}\n\n${REVIEW_LINK_PLACEHOLDER}\n\nThanks!`;
    // A placeholder whose link would run past 300: the link goes at the end.
    raw.reviews.requestSms = `Hi [name]! ${'Thanks for choosing us. '.repeat(10)}Review us: ${REVIEW_LINK_PLACEHOLDER}`;
    const { data, adjustments } = report(raw);
    expect(data.reviews.requestEmail.body).toBe(`Hi [name],\n\nPlease review us: ${REVIEW}\n\nThanks!`);
    expect(adjustments).toContain('Took [review link] out of the review email: the Google review link is already there.');
    expect(data.reviews.requestSms.length).toBeLessThanOrEqual(max);
    expect(data.reviews.requestSms.endsWith(` ${REVIEW}`)).toBe(true);
    expect(data.reviews.requestSms.split(REVIEW)).toHaveLength(2);
    expect(data.reviews.requestSms).not.toContain(REVIEW_LINK_PLACEHOLDER);

    // Over the limit with the link last: the length cut drops the link,
    // which comes back once, at the end, within the limit.
    const cut = clone(SAMPLE_WORDS);
    cut.reviews.requestSms = `Hi [name]! ${'Thanks for choosing us. '.repeat(10)}Review us: ${REVIEW}`;
    const sms = report(cut).data.reviews.requestSms;
    expect(sms.length).toBeLessThanOrEqual(max);
    expect(sms.endsWith(` ${REVIEW}`)).toBe(true);
    expect(sms.match(/https:\/\//g)).toHaveLength(1);
    expect(sms).not.toContain('…');
  });

  it('flags review incentives and gating, and sorts one reply per rating', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.reviews.requestSms = `If you were happy, leave us 5 stars and get 10% off! ${REVIEW}`;
    raw.reviews.replies = [
      { rating: 1, text: 'Sorry, [name]. Your next wash is free.' },
      { rating: 5, text: 'Thanks, [name]!' },
      { rating: 5, text: 'A second five.' },
      { rating: 7, text: 'No such rating.' },
      { rating: '3', text: 'A rating as text still counts.' },
      { rating: 2.5, text: 'Not a whole rating.' },
    ];
    const { data, adjustments } = report(raw);
    expect(data.reviews.replies).toEqual([
      { rating: 5, text: 'Thanks, [name]!' }, { rating: 3, text: 'A rating as text still counts.' }, { rating: 1, text: 'Sorry, [name]. Your next wash is free.' },
    ]);
    expect(adjustments).toEqual(expect.arrayContaining([
      'Check the review request text: "10% off" reads as something in return for a review, which Google forbids.',
      'Check the review request text: "5 stars" asks for a particular kind of review; ask for an honest one.',
      'Check the 1-star reply: "free" reads as something in return for a review, which Google forbids.',
      'No reply template for 2, 4 stars.',
    ]));
  });

  it('keeps three different captions', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.social.captions = ['One.', 'one.', 'Two.', 'Three.', 'Four.'];
    expect(report(raw).data.social.captions).toEqual(['One.', 'Two.', 'Three.']);
  });

  it('caps the list of adjustments it stores', () => {
    const raw = clone(SAMPLE_WORDS);
    raw.gbp.posts.forEach((p, i) => { p.cta = `BAD${i}`; p.photo = `nope-${i}`; });
    const { data, adjustments } = report(raw);
    expect(adjustments.length).toBeGreaterThan(20);
    expect(data.adjustments).toHaveLength(20);
  });
});

describe('showing the deck', () => {
  const data = report(SAMPLE_WORDS).data;

  it('lays it out as sections of copyable pieces with limits', () => {
    const sections = wordsSections(data);
    expect(sections.map((s) => s.id)).toEqual(['gbp', 'posts', 'seo', 'reviews', 'social']);
    const gbp = sections[0];
    expect(gbp.items[0]).toMatchObject({ id: 'gbp-description', text: SAMPLE_WORDS.gbp.description, max: 750 });
    expect(gbp.items.find((i) => i.id === 'gbp-categories')).toMatchObject({ text: 'Car detailing service\nCar wash' });
    const posts = sections[1];
    expect(posts.title).toBe('Starter posts (12)');
    expect(posts.items[0].meta).toEqual([
      `Button: Learn more (${SAMPLE_INPUTS.urls.site})`,
      'Image: The white detailing van, parked on a driveway. (their photo: van.png)',
    ]);
    expect(posts.items[11].meta[0]).toBe('Button: Call now (the profile\'s phone)');
    expect(sections[3].hint).toBe(`Google review link: ${REVIEW}`);
    expect(sections[3].items.map((i) => i.id)).toEqual(['review-sms', 'review-subject', 'review-email', 'reply-5', 'reply-4', 'reply-3', 'reply-2', 'reply-1']);
    expect(sections[4].items.map((i) => i.max)).toEqual([150, 2200, 2200, 2200]);
  });

  it('leaves out empty pieces and says when there is no review link', () => {
    const thin = { gbp: { description: '', services: [], categories: [], posts: [] }, seo: { title: 'T', description: '', keywords: [] },
      reviews: { requestSms: `Hi! ${REVIEW_LINK_PLACEHOLDER}`, requestEmail: { subject: '', body: '' }, replies: [], link: '' }, social: { bio: '', captions: [] } };
    const sections = wordsSections(thin);
    expect(sections.map((s) => s.id)).toEqual(['seo', 'reviews']);
    expect(sections[1].hint).toContain(REVIEW_LINK_PLACEHOLDER);
    expect(wordsSections(null)).toEqual([]);
  });

  it('copies everything as plain text', () => {
    const text = wordsPlainText(data);
    expect(text.startsWith('GOOGLE BUSINESS PROFILE')).toBe(true);
    for (const p of SAMPLE_WORDS.gbp.posts) expect(text).toContain(p.body);
    expect(text).toContain(SAMPLE_WORDS.social.captions[2]);
  });
});

describe('the admin view (WordsResult)', () => {
  const data = report(SAMPLE_WORDS).data;
  const render = (props) => renderToStaticMarkup(createElement(WordsResult, props));

  it('shows every piece with its count and a copy button, and the PDF', () => {
    const html = render({ run: { status: 'ready', data }, urls: { 'words.pdf': 'https://signed.example/words.pdf?token=1' } });
    expect(html).toContain('Google Business Profile');
    expect(html).toContain('Starter posts (12)');
    expect(html).toContain('546 / 750');
    expect(html).toContain('aria-label="Copy Business description"');
    expect(html).toContain('aria-label="Copy the whole deck as text"');
    expect(html).toContain('href="https://signed.example/words.pdf?token=1"');
    expect(html).toContain('Printable deck (PDF)');
    expect((html.match(/aria-label="Copy /g) || []).length).toBe(1 + wordsSections(data).reduce((n, s) => n + s.items.length, 0));
    expect(html).not.toContain('Server checks');
  });

  it('puts the server checks first and works without a PDF', () => {
    const flagged = report({ ...clone(SAMPLE_WORDS), social: { ...SAMPLE_WORDS.social, bio: 'Licensed and insured since 2015.' } }).data;
    const html = render({ run: { status: 'ready', data: flagged }, urls: {} });
    expect(html).toContain('Server checks (1)');
    expect(html.indexOf('Server checks')).toBeLessThan(html.indexOf('Google Business Profile'));
    expect(html).not.toContain('Printable deck');
    expect(render({ run: { status: 'ready', data: null }, urls: {} })).toContain('This run has no copy to show.');
  });

  it('links only an http(s) PDF and escapes the copy', () => {
    const odd = render({ run: { status: 'ready', data }, urls: { 'words.pdf': 'javascript:alert(1)' } });
    expect(odd).not.toContain('javascript:');
    expect(odd).not.toContain('Printable deck');
    const tagged = report({ ...clone(SAMPLE_WORDS), social: { ...SAMPLE_WORDS.social, bio: '<img src=x onerror=alert(1)> Mobile detailing.' } }).data;
    const html = render({ run: { status: 'ready', data: tagged }, urls: {} });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
