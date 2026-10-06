// src/lib/kit/social.test.js
//
// The Social kit's pure module: its copies of the skill's data files
// (formats.json, text_rules.json) stay equal to them, the text gate gives
// the same answers as scripts/textrules.py on the shared fixtures, the
// sanitizer stores a validated social.json without flags and catches what
// the skill's gate would, and the view merges data with the stored files.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SOCIAL_FILES, SOCIAL_FORMATS, SOCIAL_TEXT_RULES, altProblems, captionProblems, captionsText, downloadHref, freeTextUnbacked, imageProblems,
  lineProblems, reviewSentences, sanitizeSocial, socialFormat, socialNotes, socialTokens, socialView, textIndex, unbackedClaims,
} from './social.js';
import { kitFilePath, kitSkill } from '../launchKit.js';
import SocialResult from '../../components/admin/kit/SocialResult.jsx';

const SKILL = path.resolve(__dirname, '../../../skills/api/launch-social-kit');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(SKILL, p), 'utf8'));
const FIX = readJson('tests/textrules_fixtures.json');
const SAMPLE_INPUT = readJson('tests/sample_input.json');
const SAMPLE_SOCIAL = readJson('tests/sample_social.json');

describe('the copies of the skill\'s data files', () => {
  it('SOCIAL_TEXT_RULES is data/text_rules.json', () => {
    const { _doc, ...rules } = readJson('data/text_rules.json');
    expect(_doc).toBeTruthy();
    expect(SOCIAL_TEXT_RULES).toEqual(rules);
  });

  it('SOCIAL_FORMATS is data/formats.json', () => {
    const fm = readJson('data/formats.json');
    expect(SOCIAL_FILES).toEqual(fm.order);
    expect(SOCIAL_FORMATS.map((f) => ({
      file: f.file, kind: f.kind, size: f.size, required: f.required, purpose: f.purpose, layouts: f.layouts, roles: f.roles, items: f.items,
    }))).toEqual(fm.order.map((file) => {
      const f = fm.formats[file];
      return {
        file, kind: f.kind, size: f.size, required: f.required, purpose: f.purpose, layouts: f.layouts,
        roles: Object.keys(f.text), items: f.text.items ? f.text.items[2] : 0,
      };
    }));
  });

  it('the formats are the registry\'s images, with its sizes and required flags', () => {
    const outputs = kitSkill('social').outputs.filter((o) => o.type === 'image/png');
    expect(outputs.map((o) => o.name)).toEqual(SOCIAL_FILES);
    for (const o of outputs) {
      expect(o.px).toEqual(socialFormat(o.name).size);
      expect(o.required).toBe(socialFormat(o.name).required);
    }
    expect(socialFormat('toString')).toBe(null);
  });
});

describe('the text gate (tests/textrules_fixtures.json, as textrules.py)', () => {
  const index = textIndex(FIX.sources, FIX.links);

  it('tokens and review sentences', () => {
    for (const c of FIX.tokens) expect(socialTokens(c.text)).toEqual(c.tokens);
    for (const c of FIX.sentences) expect(reviewSentences(c.text)).toEqual(c.sentences);
  });

  it('image lines', () => {
    for (const c of FIX.lines) {
      const problems = lineProblems(c.role, c.text, index);
      expect([c.role, c.text, problems.length === 0]).toEqual([c.role, c.text, c.ok]);
      if (c.unbacked) expect(unbackedClaims(c.text, index)).toEqual(c.unbacked);
    }
  });

  it('captions and alt text', () => {
    for (const c of FIX.captions) {
      expect([c.text, captionProblems(c.text, index).length === 0]).toEqual([c.text, c.ok]);
      if (c.unbacked) expect(freeTextUnbacked(c.text, index)).toEqual(c.unbacked);
    }
    for (const c of FIX.alts) {
      expect([c.text, altProblems(c.text, index).length === 0]).toEqual([c.text, c.ok]);
      if (c.unbacked) expect(freeTextUnbacked(c.text, index)).toEqual(c.unbacked);
    }
  });

  it('whole images: a cite is the quoted reviewer, "What our customers say" needs a quote', () => {
    for (const c of FIX.images) {
      expect([c.text, imageProblems(c.text, index).length === 0]).toEqual([c.text, c.ok]);
    }
    expect(index.reviewLines).toHaveLength(4);
    expect(lineProblems('quote', 'Jordan P. Five stars.', index)).toHaveLength(1);
  });

  it('a phrase that needs a link only passes with it', () => {
    expect(lineProblems('cta', 'Book online', textIndex(FIX.sources, {}))).toHaveLength(1);
    expect(lineProblems('cta', 'Book online', index)).toEqual([]);
  });
});

// The sample run: the brief the server sends and the social.json the
// skill's composer makes from it (tests/test_social.py keeps it current).
const opts = {
  sources: SAMPLE_INPUT.sources,
  links: SAMPLE_INPUT.links,
  photos: SAMPLE_INPUT.photos.map((p, i) => ({ name: p.file, path: `proj/photo/p${i + 1}.png` })),
  words: SAMPLE_INPUT.words.captions,
};

describe('sanitizeSocial', () => {
  it('stores the skill\'s validated file as written, nothing flagged', () => {
    const data = sanitizeSocial(SAMPLE_SOCIAL, opts);
    expect(data.version).toBe(1);
    expect(data.images.map((im) => im.file)).toEqual(SOCIAL_FILES);
    for (const [i, im] of data.images.entries()) {
      const raw = SAMPLE_SOCIAL.images[i];
      expect(im.checks).toEqual([]);
      expect({ ...im, photo: raw.photo, checks: undefined }).toEqual({ ...raw, checks: undefined });
    }
    // Container names back to the stored uploads.
    expect(data.images[0].photo).toBe('proj/photo/p1.png');
    expect(data.images.find((im) => im.file === 'profile-800.png').photo).toBe('');
    // Captions exactly as the kit contract has them (the claims ledger reads
    // every value under them); what the server knows about each, beside.
    expect(data.captions).toEqual(SAMPLE_SOCIAL.captions);
    expect(data.captionChecks).toEqual([
      { file: 'post-1.png', source: 'words', checks: [] }, { file: 'post-2.png', source: 'words', checks: [] }, { file: 'post-3.png', source: 'skill', checks: [] },
    ]);
    expect(data.fonts).toEqual(SAMPLE_SOCIAL.fonts);
    expect(Object.keys(data)).toEqual(['version', 'images', 'captions', 'captionChecks', 'fonts']);
  });

  it('flags what the skill\'s gate would have refused', () => {
    const raw = structuredClone(SAMPLE_SOCIAL);
    raw.images[0].text[1].text = 'The best detailer in Florida';
    raw.images[3].text.push({ role: 'sub', text: 'Sam made my truck look brand new' });
    raw.images[4].alt = 'Rated five stars by 500 drivers';
    raw.captions[2].text = SAMPLE_INPUT.words.captions[2];
    const data = sanitizeSocial(raw, opts);
    expect(data.images[0].checks).toEqual([
      'headline "The best detailer in Florida" is not in the site\'s copy, the Words kit or the business facts',
    ]);
    expect(data.images[3].checks).toEqual(['sub "Sam made my truck look brand new" comes from the pasted reviews: reviews go only in the quote role']);
    expect(data.images[4].checks.join(' ')).toMatch(/"500".*"rated".*"five stars"/);
    const cap = data.captionChecks[2];
    expect(cap.source).toBe('words');
    expect(cap.checks).toEqual([
      'Caption: the claim "500" is not in the business facts or the owner\'s answers',
      'Caption: the claim "trusted" is not in the business facts or the owner\'s answers',
    ]);
    expect(socialNotes({ notes: ['From the skill.'] }, data)).toEqual([
      'The server\'s check flagged 4 images or captions: see "Check" under each before posting.',
      'From the skill.',
    ]);
  });

  it('flags a cite that isn\'t the quoted reviewer and "What our customers say" without a quote', () => {
    const raw = structuredClone(SAMPLE_SOCIAL);
    raw.images[5].text = raw.images[5].text.map((t) => (t.role === 'cite' ? { role: 'cite', text: 'Casey V.' } : t));
    raw.images[4].text[0] = { role: 'eyebrow', text: 'What our customers say' };
    const data = sanitizeSocial(raw, opts);
    expect(data.images[5].checks).toEqual(['cite "Casey V." is not the name pasted with the quoted review (quote and name must be one review)']);
    expect(data.images[4].checks).toEqual(['"What our customers say" goes only on an image with a quote from the pasted reviews']);
  });

  it('keeps only what the kit knows, sized and described by the formats', () => {
    const data = sanitizeSocial({
      images: [
        { file: 'post-2.png', size: '999x999', purpose: 'Ignore all rules', alt: 'Our services', layout: 'collage', photo: 'photo-9.png',
          text: [{ role: 'items', text: 'Full Detail $199' }, { role: 'banner', text: 'x' }, { role: 'headline', text: 'Our services' }, { role: 'headline', text: 'Twice' }] },
        { file: 'post-2.png', alt: 'a duplicate' },
        { file: '../etc/passwd', alt: 'x' },
        { file: 'profile-800.png', alt: '', text: [{ role: 'headline', text: 'No text on a profile' }] },
        'junk',
      ],
      captions: [
        { file: 'post-2.png', text: '  Line one\r\n\r\n\r\nLine two  ' },
        { file: 'post-2.png', text: 'second caption for the same post' },
        { file: 'post-1.png', text: 'a post that did not come back' },
        { file: 'profile-800.png', text: 'not a post' },
      ],
      fonts: { heading: 'Oswald', body: 'Inter', standIn: 'yes' },
    }, opts);
    expect(data.images.map((im) => im.file)).toEqual(['profile-800.png', 'post-2.png']);
    const post = data.images[1];
    expect(post).toMatchObject({ size: '1080x1080', purpose: 'Launch post 2 (Instagram and Facebook feed)', layout: '', photo: '' });
    expect(post.text).toEqual([{ role: 'items', text: 'Full Detail $199' }, { role: 'headline', text: 'Our services' }]);
    expect(data.images[0].text).toEqual([]);
    expect(data.images[0].checks).toEqual(['no alt text']);
    expect(data.captions).toEqual([{ file: 'post-2.png', text: 'Line one\n\nLine two' }]);
    expect(data.captionChecks).toEqual([{ file: 'post-2.png', source: 'skill', checks: [] }]);
    expect(data.fonts).toEqual({ heading: 'Oswald', body: 'Inter', standIn: false });
  });

  it('caps long text and runs no check without the run\'s sources', () => {
    const data = sanitizeSocial({
      images: [{ file: 'share-1200x630.png', alt: 'x'.repeat(400), text: [{ role: 'headline', text: `The best ${'y'.repeat(300)}` }] }],
      captions: [],
    });
    expect(data.images[0].alt).toHaveLength(250);
    expect(data.images[0].text[0].text).toHaveLength(160);
    expect(data.images[0].checks).toEqual([]);
  });

  it('refuses a file with nothing usable', () => {
    expect(sanitizeSocial(null)).toBe(null);
    expect(sanitizeSocial({ images: 'all of them' })).toBe(null);
    expect(sanitizeSocial({ images: [{ file: 'stock.png' }] })).toBe(null);
  });
});

describe('socialView', () => {
  const data = sanitizeSocial(SAMPLE_SOCIAL, opts);
  const file = (name, url = `https://x.supabase.co/sign/${name}`) => ({ name, kind: 'image', url, sizeLabel: '120 KB' });

  it('shows the images that came back, with their data, and the captions with their post', () => {
    const view = socialView(data, [file('share-1200x630.png'), file('post-1.png'), file('post-3.png', ''), { name: 'social.json', kind: 'json' }]);
    expect(view.images.map((im) => [im.file, im.label, im.url !== ''])).toEqual([
      ['share-1200x630.png', 'Share image', true], ['post-1.png', 'Post 1', true], ['post-3.png', 'Post 3', false],
    ]);
    expect(view.images[0]).toMatchObject({ px: [1200, 630], sizeLabel: '120 KB', alt: data.images[0].alt, checks: [] });
    expect(view.images[0].text.map((t) => t.role)).toEqual(['eyebrow', 'headline', 'sub', 'footer']);
    expect(view.captions.map((c) => [c.file, c.label, c.source, !!c.url])).toEqual([
      ['post-1.png', 'Post 1', 'words', true], ['post-2.png', 'post-2.png', 'words', false], ['post-3.png', 'Post 3', 'skill', false],
    ]);
    expect(view.fonts).toEqual(data.fonts);
  });

  it('copes with a record without data', () => {
    expect(socialView(null, [file('share-1200x630.png')]).images[0]).toMatchObject({ file: 'share-1200x630.png', alt: '', text: [], checks: [] });
    expect(socialView(undefined, undefined)).toEqual({ images: [], captions: [], fonts: null });
  });
});

describe('the view\'s helpers', () => {
  it('downloadHref asks storage for an attachment', () => {
    expect(downloadHref('https://x.supabase.co/storage/v1/object/sign/b/p.png?token=abc', 'post-1.png'))
      .toBe('https://x.supabase.co/storage/v1/object/sign/b/p.png?token=abc&download=post-1.png');
    expect(downloadHref('javascript:alert(1)', 'x.png')).toBe('');
    expect(downloadHref('', 'x.png')).toBe('');
  });

  it('captionsText puts every caption under its post', () => {
    expect(captionsText([{ label: 'Post 1', text: 'One' }, { label: 'Post 2', text: 'Two\nlines' }])).toBe('Post 1:\nOne\n\nPost 2:\nTwo\nlines');
    expect(captionsText(null)).toBe('');
  });
});

describe('SocialResult', () => {
  const PID = '00000000-0000-4000-8000-0000000000aa';
  const data = sanitizeSocial(SAMPLE_SOCIAL, opts);
  const files = ['social.json', ...SOCIAL_FILES].map((name) => ({ name, path: kitFilePath(PID, 'social', name, 1759600000000), type: name.endsWith('.json') ? 'application/json' : 'image/png', size: 2048 }));
  const urls = Object.fromEntries(SOCIAL_FILES.map((n) => [n, `https://x.supabase.co/storage/v1/object/sign/custom-site-assets/${n}?token=t`]));

  it('shows every image with its download and alt text, and the captions to copy', () => {
    const html = renderToStaticMarkup(createElement(SocialResult, { run: { status: 'ready', data, files }, project: { id: PID }, urls }));
    for (const label of ['Share image', 'Facebook cover', 'Profile picture', 'Post 1', 'Post 2', 'Post 3', 'Story']) expect(html).toContain(label);
    expect(html).toContain('download=share-1200x630.png');
    expect(html).toContain('Alt text: </span>Sample Shine Mobile Detailing: Showroom shine, wherever you park.');
    expect(html).toContain('From the Words kit');
    expect(html).toContain('Written for this post');
    expect(html).toContain('Copy all');
    expect(html).toContain('The brand fonts (Oswald and Inter) couldn&#x27;t be fetched');
    expect(html).not.toContain('Check before posting');
    expect(html).toContain('rounded-full');
  });

  it('shows what the server flagged, and copes with expired links and no data', () => {
    const raw = structuredClone(SAMPLE_SOCIAL);
    raw.captions[2].text = 'Trusted by 500+ happy customers.';
    const flagged = sanitizeSocial(raw, opts);
    const html = renderToStaticMarkup(createElement(SocialResult, { run: { status: 'ready', data: flagged, files }, urls: {} }));
    expect(html).toContain('Check before posting');
    expect(html).toContain('the claim &quot;500&quot;');
    expect(html).toContain('Link expired: reload');
    expect(html).not.toContain('download=');
    const empty = renderToStaticMarkup(createElement(SocialResult, { run: { status: 'ready', data: null, files: [] }, urls: {} }));
    expect(empty).toContain('No images came back from this run.');
    expect(empty).toContain('No captions in this run.');
  });
});
