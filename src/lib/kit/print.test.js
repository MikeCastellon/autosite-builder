// src/lib/kit/print.test.js
//
// The Print studio contract shared by the server and the admin view: the
// piece registry, the links the server builds (tel:, the vCard), the claim
// and review-policy patterns, and sanitizePrint in both modes (the server's
// check that fails a run, the view's quiet clean-up). Also keeps the skill's
// own copies equal: data/pieces.json, data/claims.json and the wording in
// data/wording.json.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintResult from '../../components/admin/kit/PrintResult.jsx';
import {
  PAGE_LABELS, PRINT_BLEED, PRINT_CLAIM_PATTERNS, PRINT_LIMITS, PRINT_PIECES, PRINT_REVIEW_BANNED_PATTERNS, PRINT_SCHEMA,
  PrintCheckError, QR_KINDS, QR_KIND_LABELS, QR_MIN_IN, REBOOK_ORDER, REVIEW_PIECE_FILES, phoneE164, printClaimFlags,
  printFacts, printLinks, printOwnNames, printPieceSpec, printReviewFlags, printShopNotes, printSiteLabel, qrTargetLabel, rebookKind, sanitizePrint,
  telLink, vcardText,
} from './print.js';
import { kitSkill } from '../launchKit.js';

const SKILL = path.resolve(__dirname, '../../../skills/api/launch-print-studio');
const data = (name) => JSON.parse(fs.readFileSync(path.join(SKILL, 'data', name), 'utf8'));

const LINKS = printLinks({
  site: 'https://shine.example/', booking: 'https://shine.example//book#book',
  review: 'https://search.google.com/local/writereview?placeid=ChIJ_test_place_01', phone: '(555) 010-0199',
  email: 'hello@shine.example', business: 'Shine, Wax & Co; Detail',
});
const INPUTS = { links: LINKS, business: { name: 'Shine, Wax & Co; Detail' }, facts: 'We have 8 years of experience.' };

function piece(file, qr, extra = {}) {
  const spec = printPieceSpec(file);
  return { file, name: spec.name, size: spec.size, bleed: PRINT_BLEED, pages: [...spec.pages], qr, text: ['Hello'], note: '', ...extra };
}
const q = (kind, size = 1.2, label = QR_KIND_LABELS[kind]) => ({
  label, kind, url: kind === 'contact' ? '' : LINKS[kind], vcard: kind === 'contact' ? LINKS.vcard : '', sizeIn: size,
});
function fullPrint() {
  return {
    version: 1,
    pieces: [
      piece('review-hang-tag.pdf', [q('review', 2), q('booking', 1.6)]),
      piece('counter-card.pdf', [q('review', 2.2)]),
      piece('glovebox-card.pdf', [q('contact', 1.3), q('booking', 1.3)]),
      piece('business-cards.pdf', [q('site', 0.85)]),
    ],
    omitted: [],
    fonts: { heading: 'Oswald', body: 'Inter', fallback: false },
    colors: { panel: '#0a0909', ink: '#f8f8f8', accent: '#ee3533', cmykRisk: [] },
    notes: ['Colors are RGB.'],
  };
}

describe('the skill\'s data files', () => {
  it('pieces.json matches PRINT_PIECES and the registry outputs', () => {
    const p = data('pieces.json');
    expect(p.pieces.map(({ file, name, size, pages, review }) => ({ file, name, size, pages, review })))
      .toEqual(PRINT_PIECES.map(({ file, name, size, pages, review }) => ({ file, name, size, pages: [...pages], review })));
    expect(`${p.bleedIn}in`).toBe(PRINT_BLEED);
    expect(p.qrMinIn).toBe(QR_MIN_IN);
    for (const piece of p.pieces) {
      expect(piece.size).toBe(`${piece.w} x ${piece.h} in`);
      for (const [side, code] of Object.entries(piece.qr)) {
        expect(piece.pages).toContain(side);
        expect(code.sizeIn).toBeGreaterThanOrEqual(QR_MIN_IN);
      }
    }
    const pdfs = kitSkill('print').outputs.filter((o) => o.type === 'application/pdf').map((o) => o.name);
    expect(PRINT_PIECES.map((x) => x.file)).toEqual(pdfs);
    expect(REVIEW_PIECE_FILES).toEqual(['review-hang-tag.pdf', 'counter-card.pdf']);
    // The registry makes the review pieces optional and the cards required.
    for (const o of kitSkill('print').outputs.filter((x) => x.type === 'application/pdf')) {
      expect(o.required).toBe(!REVIEW_PIECE_FILES.includes(o.name));
    }
  });

  it('claims.json matches the patterns and the limits', () => {
    const c = data('claims.json');
    expect(c.patterns).toEqual([...PRINT_CLAIM_PATTERNS]);
    expect(c.reviewBanned).toEqual([...PRINT_REVIEW_BANNED_PATTERNS]);
    expect(c.limits).toEqual({ ...PRINT_LIMITS });
  });

  it('every fixed wording passes the claim and review checks', () => {
    const w = data('wording.json');
    const lines = Object.entries(w).filter(([k]) => k !== '_doc')
      .flatMap(([, v]) => (Array.isArray(v) ? v : typeof v === 'object' ? Object.values(v) : [v]))
      .map((s) => s.replace('{name}', 'Shine'));
    expect(lines.length).toBeGreaterThan(15);
    expect(printClaimFlags(lines, '')).toEqual([]);
    expect(printReviewFlags(lines, true)).toEqual([]);
    expect(Object.keys(w.rebookAsk)).toEqual([...REBOOK_ORDER]);
  });
});

describe('links the server builds', () => {
  it('formats phones for tel: links and vCards', () => {
    expect(phoneE164('(555) 010-0199')).toBe('+15550100199');
    expect(phoneE164('1-555-010-0199')).toBe('+15550100199');
    expect(phoneE164('+44 20 7946 0958')).toBe('+442079460958');
    expect(phoneE164('12345')).toBe('');
    expect(telLink('555.010.0199')).toBe('tel:+15550100199');
    expect(telLink('call us')).toBe('');
  });

  it('writes a vCard 3.0 for the business, escaped, CRLF, capped', () => {
    const v = vcardText({ business: 'Shine, Wax & Co; Detail', phone: '(555) 010-0199', email: 'hello@shine.example', url: 'https://shine.example/' });
    expect(v.split('\r\n')).toEqual([
      'BEGIN:VCARD', 'VERSION:3.0', 'N:Shine\\, Wax & Co\\; Detail;;;;', 'FN:Shine\\, Wax & Co\\; Detail', 'ORG:Shine\\, Wax & Co\\; Detail',
      'TEL;TYPE=WORK,VOICE:+15550100199', 'EMAIL;TYPE=WORK:hello@shine.example', 'URL:https://shine.example/', 'X-ABShowAs:COMPANY', 'END:VCARD',
    ]);
    expect(vcardText({ business: 'Shine' })).toBe('');
    expect(vcardText({ phone: '5550100199' })).toBe('');
    expect(vcardText({ business: 'Shine', email: 'not an email' })).toBe('');
    // Too long for a small code: the email goes first, then the site, then
    // the name is shortened. Always a whole card (a cut one would print a
    // code no phone can save).
    const whole = (v) => v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n') && v.endsWith('\r\nX-ABShowAs:COMPANY\r\nEND:VCARD');
    const mail = `${'e'.repeat(60)}@shine.example`;
    const url = `https://shine.example/${'p'.repeat(150)}`;
    expect(vcardText({ business: 'Shine Auto Spa', phone: '5550100199', email: mail, url }).length).toBeGreaterThan(0);
    const noMail = vcardText({ business: 'Shine Auto Spa', phone: '5550100199', email: mail, url });
    expect(whole(noMail)).toBe(true);
    expect(noMail).not.toContain('EMAIL');
    expect(noMail).toContain(`URL:${url}`);
    // A site link too long even alone: the email stays, the site goes.
    const noSite = vcardText({ business: 'Shine Auto Spa', phone: '5550100199', email: mail, url: `https://shine.example/${'p'.repeat(250)}` });
    expect(whole(noSite)).toBe(true);
    expect(noSite).toContain(`EMAIL;TYPE=WORK:${mail}`);
    expect(noSite).not.toContain('URL:');
    const words = 'Sample Shine Premium Mobile Auto Detailing, Paint Correction and Ceramic Coating Specialists of Exampleton and Sampleville';
    const shortened = vcardText({ business: words, phone: '5550100199', email: mail, url });
    expect(shortened.length).toBeLessThanOrEqual(PRINT_LIMITS.vcard);
    expect(whole(shortened)).toBe(true);
    expect(shortened).toContain('TEL;TYPE=WORK,VOICE:+15550100199');
    expect(shortened).not.toMatch(/EMAIL|URL:/);
    const fn = /\r\nFN:([^\r]*)\r\n/.exec(shortened)[1].replace(/\\([,;\\])/g, '$1');
    expect(words.startsWith(fn)).toBe(true);
    expect(fn).not.toMatch(/[\s,]$/);   // cut at a word
    const oneWord = vcardText({ business: 'S'.repeat(190), phone: '5550100199', email: mail, url });
    expect(oneWord.length).toBeLessThanOrEqual(PRINT_LIMITS.vcard);
    expect(whole(oneWord)).toBe(true);
    // Without a phone the card keeps the site (a card with no way to reach
    // them is no card).
    const noTel = vcardText({ business: words, url: 'https://shine.example/' });
    expect(whole(noTel)).toBe(true);
    expect(noTel).toContain('URL:https://shine.example/');
  });

  it('keeps only https links, folds a doubled slash, and picks the rebook target', () => {
    expect(LINKS).toEqual({
      site: 'https://shine.example/',
      booking: 'https://shine.example/book#book',
      review: 'https://search.google.com/local/writereview?placeid=ChIJ_test_place_01',
      call: 'tel:+15550100199',
      vcard: expect.stringContaining('URL:https://shine.example/\r\n'),
    });
    const weak = printLinks({ site: 'http://shine.example', booking: 'javascript:alert(1)', review: 'https://x.example/a b' });
    expect(weak).toEqual({ site: '', booking: '', review: '', call: '', vcard: '' });
    expect(rebookKind(LINKS)).toBe('booking');
    expect(rebookKind({ ...LINKS, booking: '' })).toBe('site');
    expect(rebookKind({ call: 'tel:+15550100199' })).toBe('call');
    expect(rebookKind({})).toBe('');
    expect(rebookKind(null)).toBe('');
  });

  it('labels links for people', () => {
    expect(printSiteLabel('https://www.Shine.example/')).toBe('shine.example');
    expect(printSiteLabel('https://shine.example/book/')).toBe('shine.example/book');
    expect(printSiteLabel('tel:+1555')).toBe('');
    expect(qrTargetLabel({ kind: 'call', url: 'tel:+15550100199' })).toBe('Call +15550100199');
    expect(qrTargetLabel({ kind: 'site', url: 'https://www.shine.example/' })).toBe('shine.example');
    expect(qrTargetLabel({ kind: 'contact', vcard: LINKS.vcard })).toBe('Contact card: Shine, Wax & Co; Detail');
    expect(qrTargetLabel(null)).toBe('');
  });
});

describe('claims and the review policy', () => {
  it('flags claim-like phrases the facts do not contain', () => {
    const facts = printFacts(INPUTS);
    expect(printClaimFlags(['8 years of mobile detailing', 'Shine, Wax & Co; Detail'], facts)).toEqual([]);
    expect(printClaimFlags(['Top-rated and insured', '20+ years', '100% satisfaction'], facts).map((f) => f.phrase))
      .toEqual(['top-rated', 'insured', '20+ years', '20+', '100%']);
    expect(printClaimFlags(['Best Choice Auto'], printFacts({ business: { name: 'Best Choice Auto' } }))).toEqual([]);
    expect(printClaimFlags(['★★★★★', 'From $99', 'Free estimates'], '').map((f) => f.phrase)).toEqual(['★', '$9', 'free estimates']);
  });

  it('flags review incentives and gating', () => {
    expect(printReviewFlags(['How did we do?', 'Scan to leave a Google review'], true)).toEqual([]);
    expect(printReviewFlags(['If you were happy, leave us a review'], true).map((f) => f.phrase)).toEqual(['If you were happy']);
    expect(printReviewFlags(['Review us and get entered to win'], false).length).toBeGreaterThan(0);
    expect(printReviewFlags(['Leave a great review!'], false).map((f) => f.phrase)).toEqual(['Leave a great review']);
    expect(printReviewFlags(['Ask about fleet discounts'], false)).toEqual([]);
    expect(printReviewFlags(['Ask about fleet discounts'], true).map((f) => f.phrase)).toEqual(['discounts']);
  });

  it('never reads the business\'s own name as an incentive', () => {
    const inputs = { business: { name: '5 Star Auto Spa', site: 'fivestar.example' }, links: { site: 'https://www.fivestar.example/' } };
    expect(printOwnNames(inputs)).toEqual(['5 Star Auto Spa', 'fivestar.example']);
    const own = printOwnNames(inputs);
    expect(printReviewFlags(['Thanks for choosing 5 Star Auto Spa'], true).length).toBe(1);
    expect(printReviewFlags(['Thanks for choosing 5 star auto spa'], true, own)).toEqual([]);
    expect(printReviewFlags(['Review 5 Star Auto Spa, get 10% off'], true, own).length).toBeGreaterThan(0);
    expect(printReviewFlags(['5 Star Auto Spa: leave a great review'], false, own).map((f) => f.phrase)).toEqual(['leave a great review']);
    expect(printReviewFlags(['Thanks for choosing Discount Detail Co'], true, ['Discount Detail Co'])).toEqual([]);
    expect(printReviewFlags(['Odd (name) [x]'], true, ['(name) [x]'])).toEqual([]);   // escaped, not a pattern
    expect(printOwnNames(null)).toEqual([]);
  });
});

describe('sanitizePrint on the server', () => {
  it('keeps a clean print.json exactly', () => {
    const raw = fullPrint();
    expect(sanitizePrint(raw, { inputs: INPUTS })).toEqual(raw);
  });

  it('fails the run for a code with another target, a wrong kind or a small size', () => {
    const swap = fullPrint();
    swap.pieces[2].qr[1] = { ...q('booking'), url: 'https://other.example/book' };
    expect(() => sanitizePrint(swap, { inputs: INPUTS })).toThrow(PrintCheckError);
    const kind = fullPrint();
    kind.pieces[3].qr[0] = { ...q('site'), kind: 'menu' };
    expect(() => sanitizePrint(kind, { inputs: INPUTS })).toThrow('has no known kind');
    const both = fullPrint();
    both.pieces[3].qr[0] = { ...q('site'), vcard: LINKS.vcard };
    expect(() => sanitizePrint(both, { inputs: INPUTS })).toThrow('isn\'t this customer\'s website link');
    const tiny = fullPrint();
    tiny.pieces[0].qr[0].sizeIn = 0.6;
    expect(() => sanitizePrint(tiny, { inputs: INPUTS })).toThrow('under 0.75 in');
    const noBooking = fullPrint();
    expect(() => sanitizePrint(noBooking, { inputs: { ...INPUTS, links: { ...LINKS, booking: '' } } })).toThrow('booking page link');
  });

  it('needs the cards, a review link for the review pieces and their review code', () => {
    const raw = fullPrint();
    expect(() => sanitizePrint(raw, { inputs: { ...INPUTS, links: { ...LINKS, review: '' } } })).toThrow('needs the Google review link');
    const noCards = { ...fullPrint(), pieces: fullPrint().pieces.slice(0, 3) };
    expect(() => sanitizePrint(noCards, { inputs: INPUTS })).toThrow('doesn\'t describe business-cards.pdf');
    const noReviewCode = fullPrint();
    noReviewCode.pieces[1].qr = [];
    expect(() => sanitizePrint(noReviewCode, { inputs: INPUTS })).toThrow('counter-card.pdf has no review code');
    const noContact = fullPrint();
    noContact.pieces[2].qr = [];
    expect(() => sanitizePrint(noContact, { inputs: INPUTS })).toThrow('glovebox-card.pdf has no save-contact code');
    const bribe = fullPrint();
    bribe.pieces[0].text = ['Show this tag for a free wash with your review'];
    expect(() => sanitizePrint(bribe, { inputs: INPUTS })).toThrow('Google\'s review policy');
    // With a contact card, a glovebox card whose only code books is wrong;
    // without one (no business name), its code may open the site.
    const bookOnly = fullPrint();
    bookOnly.pieces[2].qr = [q('booking', 1.3)];
    expect(() => sanitizePrint(bookOnly, { inputs: INPUTS })).toThrow('glovebox-card.pdf has no save-contact code');
    const noCard = { ...INPUTS, links: { ...LINKS, vcard: '' } };
    const siteOnly = fullPrint();
    siteOnly.pieces[2].qr = [q('site', 1.3), q('booking', 1.3)];
    expect(sanitizePrint(siteOnly, { inputs: noCard }).pieces[2].qr.map((x) => x.kind)).toEqual(['site', 'booking']);
    // The shop's own name on a review piece is not an incentive.
    const own = fullPrint();
    own.pieces[0].text = ['Thank you for choosing 5 Star Auto Spa'];
    expect(() => sanitizePrint(own, { inputs: INPUTS })).toThrow('Google\'s review policy');
    expect(sanitizePrint(own, { inputs: { ...INPUTS, business: { name: '5 Star Auto Spa' } } }).pieces[0].text).toEqual(own.pieces[0].text);
  });

  it('stores each piece\'s own pages, whatever print.json says', () => {
    const raw = fullPrint();
    raw.pieces[1].pages = ['front', 'back', 'die-line'];
    raw.pieces[3].pages = ['front'];
    const out = sanitizePrint(raw, { inputs: INPUTS });
    expect(out.pieces.map((p) => p.pages)).toEqual(PRINT_PIECES.map((p) => [...p.pages]));
  });

  it('lists the review pieces as omitted without a review link', () => {
    const cards = { ...fullPrint(), pieces: fullPrint().pieces.slice(2) };
    const out = sanitizePrint(cards, { inputs: { ...INPUTS, links: { ...LINKS, review: '' } } });
    expect(out.omitted).toEqual([
      { file: 'review-hang-tag.pdf', reason: 'No Google profile is linked, so there is no review link.' },
      { file: 'counter-card.pdf', reason: 'No Google profile is linked, so there is no review link.' },
    ]);
    const own = sanitizePrint({ ...cards, omitted: [{ file: 'counter-card.pdf', reason: 'No place id' }, { file: 'glovebox-card.pdf', reason: 'x' }] },
      { inputs: { ...INPUTS, links: { ...LINKS, review: '' } } });
    expect(own.omitted.map((o) => o.reason)).toEqual(['No place id', 'No Google profile is linked, so there is no review link.']);
  });
});

describe('sanitizePrint for the view', () => {
  it('cleans the shape and never throws', () => {
    expect(sanitizePrint(null)).toBe(null);
    expect(sanitizePrint({ pieces: [] })).toBe(null);
    const raw = fullPrint();
    raw.pieces.push({ file: 'flyer.pdf', name: 'Flyer', size: '8.5 x 11 in', qr: [], text: [] });
    raw.pieces.unshift(piece('business-cards.pdf', [q('site')], { size: '9 x 9 in', pages: ['nope'], name: '' }));
    raw.pieces[1].qr.push({ label: 'x', kind: 'site', url: 'javascript:alert(1)', vcard: '', sizeIn: 1 });
    raw.pieces[1].qr.push({ label: 'y', kind: 'contact', url: 'https://x.example', vcard: 'BEGIN:VCARD', sizeIn: 1 });
    raw.colors.panel = 'red';
    raw.colors.cmykRisk = ['#00FF00', '#00ff00', 'nope'];
    raw.notes = ['a b', 5, ''];
    const out = sanitizePrint(raw);
    expect(out.pieces.map((p) => p.file)).toEqual(['review-hang-tag.pdf', 'counter-card.pdf', 'glovebox-card.pdf', 'business-cards.pdf']);
    const cards = out.pieces[3];
    expect([cards.name, cards.size, cards.pages]).toEqual(['Business cards', '3.5 x 2 in', ['front', 'back']]);
    expect(out.pieces[0].qr.map((x) => x.kind)).toEqual(['review', 'booking']);
    expect(out.colors).toEqual({ panel: '', ink: '#f8f8f8', accent: '#ee3533', cmykRisk: ['#00ff00'] });
    expect(out.notes).toEqual(['a b']);
  });

  it('describes a schema with the registry\'s files, sizes and kinds', () => {
    const p = PRINT_SCHEMA.properties.pieces.items.properties;
    expect(p.file.enum).toEqual(PRINT_PIECES.map((x) => x.file));
    expect(p.size.enum).toEqual(['3.5 x 8.5 in', '4 x 6 in', '3.5 x 2 in']);
    expect(p.pages.items.enum).toEqual(Object.keys(PAGE_LABELS));
    expect(p.qr.items.properties.kind.enum).toEqual([...QR_KINDS]);
    expect(p.qr.items.properties.sizeIn.minimum).toBe(QR_MIN_IN);
    expect(PRINT_SCHEMA.properties.omitted.items.properties.file.enum).toEqual(REVIEW_PIECE_FILES);
  });
});

describe('the result view', () => {
  const render = (data, urls = {}) => renderToStaticMarkup(createElement(PrintResult, { run: { status: 'ready', data }, project: {}, urls }));

  it('shows each piece with its size, codes, targets and download', () => {
    const sample = JSON.parse(fs.readFileSync(path.join(SKILL, 'tests', 'sample_print.json'), 'utf8'));
    const html = render(sample, {
      'review-hang-tag.pdf': 'https://store.example/signed/tag.pdf?token=a',
      'business-cards.pdf': 'javascript:alert(1)',
    });
    for (const s of ['Review hang tag', 'Counter card', 'Glovebox card', 'Business cards', '3.5 x 8.5 in trim', '0.125 in bleed',
      'Front, back and die-line', 'Google review', 'search.google.com/local/writereview?placeid=ChIJ_sample_place_0001',
      'Contact card: Sample Shine Mobile Detailing', 'Booking page', 'The last page is the cut path', 'Copy notes for the print shop']) {
      expect(html).toContain(s);
    }
    expect(html).toContain('href="https://store.example/signed/tag.pdf?token=a"');
    expect(html).not.toContain('javascript:');
    expect((html.match(/PDF not stored/g) || []).length).toBe(3);
    expect(html).not.toContain('Left out');
  });

  it('lists the pieces left out and the fonts that fell back', () => {
    const cards = { ...fullPrint(), pieces: fullPrint().pieces.slice(2), fonts: { heading: 'DejaVu Sans', body: 'DejaVu Sans', fallback: true } };
    const data = sanitizePrint(cards, { inputs: { ...INPUTS, links: { ...LINKS, review: '' } } });
    const html = render({ ...data, colors: { ...data.colors, accent: '#00ff00', cmykRisk: ['#00ff00'] } });
    expect(html).toContain('Left out');
    expect(html).toContain('Review hang tag</span>: No Google profile is linked');
    expect(html).toContain('DejaVu Sans stands in');
    expect(html).toContain('#00ff00<span class="ml-1 text-amber-900">· may shift in CMYK</span>');
    expect(render(null)).toContain('no print plan');
    expect(printShopNotes(data).split('\n')).toHaveLength(2);
  });
});
