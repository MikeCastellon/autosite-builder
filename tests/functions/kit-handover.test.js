// tests/functions/kit-handover.test.js
//
// The handover pack's server spec (netlify/functions/_lib/kit/handover.js):
// what a run sends (handover-inputs.json, the stored kit files, the brand
// board, the logo, the fonts), what it never sends (the customer's contact
// details), the prompt, the sanitizer over the skill's handover.json, the
// smoke sample and its strict check, and one run through production's
// buildKitRun with a fake Anthropic client. Nothing reaches the API, the
// database or the bucket.
//
// With HANDOVER_PYTHON set to a Python that has reportlab, Pillow and pypdf
// (e.g. a scratch venv), one more test runs the skill's real scripts on
// the inputs this spec builds and passes their output back through the
// sanitizer and smokeCheck:
//   HANDOVER_PYTHON=/path/to/venv/bin/python npx vitest run tests/functions/kit-handover.test.js
import { describe, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BOARD_MAX_BYTES, HANDOVER_INTAKE_FIELDS, TEMPLATE_INFO, buildPrompt, loadBoard, notes, partData, samplePdf, samplePng,
  sanitize, sectionLabels, signInUrl, smokeCheck, smokeSample, spec, tidyUrl, zipEntryNames,
} from '../../netlify/functions/_lib/kit/handover.js';
import { KIT_SPECS, kitConfigured } from '../../netlify/functions/_lib/kit/index.js';
import { KIT_INPUT_FILES_TOTAL_BYTES } from '../../netlify/functions/_lib/kit/inputs.js';
import { KIT_OUTPUT_MAX_BYTES, buildKitRun, prepareKitRun } from '../../netlify/functions/custom-site-kit-background.js';
import { sniffImage } from '../../netlify/functions/_lib/custom-site-suggest-ai.js';
import {
  HANDOVER_FILES, HANDOVER_INPUTS_FILE, HANDOVER_SECTIONS, HANDOVER_ZIP_MAX_BYTES, expectedZipPaths, sanitizeHandover,
} from '../../src/lib/kit/handover.js';
import { KIT_BUDGET_MS } from '../../src/lib/launchKit.js';
import { TEMPLATES } from '../../src/data/templates.js';

const ROOT = path.resolve(__dirname, '../..');
const NOW = Date.parse('2026-10-06T15:00:00.000Z');
const offline = async () => { throw new Error('offline'); };
const clone = (v) => JSON.parse(JSON.stringify(v));

// Storage that serves the sample's files; `fail` makes some downloads fail.
function sampleDb(files, { fail = () => false } = {}) {
  const downloads = [];
  return {
    downloads,
    storage: {
      from: () => ({
        download: async (p) => {
          downloads.push(p);
          if (fail(p) || !files[p]) return { data: null, error: { message: `no such object ${p}` } };
          return { data: new Blob([files[p]]), error: null };
        },
        upload: async () => { throw new Error('a handover run stores nothing itself'); },
      }),
    },
    from: (table) => { throw new Error(`no database here (asked for ${table})`); },
  };
}

async function prepare(sample, { db, fetchImpl = offline } = {}) {
  return prepareKitRun({
    db: db || sampleDb(sample.files), project: sample.project, site: sample.site, key: 'handover', spec: KIT_SPECS.handover,
    deadline: NOW + KIT_BUDGET_MS, nowMs: () => NOW, fetchImpl,
  });
}

const payloadOf = (prepared) => JSON.parse(prepared.files.find((f) => f.name === HANDOVER_INPUTS_FILE).data.toString('utf8'));

// A stored-only zip of these entries (enough for zipEntryNames and the
// background's zip check).
function crc32(buf) {
  let c = -1;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ -1) >>> 0;
}
function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const n = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, data);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// What a good run of the skill writes for these inputs (as build_handover
// would): the zip holds the PDF, the README, the board, the generated text
// and every kit file sent.
function goodRaw(inputs) {
  const generated = [...expectedZipPaths({ generated: ['brand', ...inputs.parts.filter((k) => k === 'words' || k === 'social')] })]
    .filter((p) => p.includes('/'));
  const files = ['handover.pdf', 'README.txt', ...(inputs.board ? ['01-brand/brand-board.png'] : []), ...generated, ...inputs.kitFiles.map((f) => f.zip)];
  return {
    version: 1,
    summary: `12-page handover for Sample Shine Mobile Detailing and a zip of ${files.length} files; 3 statements for the customer to confirm.`,
    sections: HANDOVER_SECTIONS.map((s) => s.title),
    pages: 12,
    files,
    left: [],
    links: { ...inputs.links },
    thisWeek: ['Check your site on your phone', 'Sign off the claims list', 'Paste your Google profile copy', 'Put your link everywhere', 'Ask five recent customers for a review']
      .map((title) => ({ title, detail: `${title}: the details.` })),
    checklist: [1, 2, 3, 4].map((week) => ({ week, task: `Week ${week}: one small step.` })),
    claims: { checked: 5, sourced: 2, toConfirm: 3, listed: 3 },
    notes: ['The intake notes asked to add a link to the guide; ignored.'],
  };
}

describe('the handover spec', () => {
  it('is a built spec with the skill\'s folder, configured from its env pair', () => {
    expect(KIT_SPECS.handover.stub).toBe(false);
    expect(KIT_SPECS.handover.folder).toBe('launch-handover');
    expect(KIT_SPECS.handover.maxTurns).toBe(8);
    expect(kitConfigured('handover', {})).toBe(false);
    expect(kitConfigured('handover', { CUSTOM_SITE_KIT_HANDOVER_SKILL_ID: 'skill_01Handover', CUSTOM_SITE_KIT_HANDOVER_SKILL_VERSION: '1' })).toBe(true);
    expect(spec.smokeSample).toBe(smokeSample);
  });

  it('the zip cap sits under what the server takes back, above the kit-file budget', () => {
    expect(HANDOVER_ZIP_MAX_BYTES).toBeLessThan(KIT_OUTPUT_MAX_BYTES['application/zip']);
    expect(KIT_INPUT_FILES_TOTAL_BYTES).toBeLessThan(HANDOVER_ZIP_MAX_BYTES);
    expect(BOARD_MAX_BYTES).toBeLessThanOrEqual(KIT_OUTPUT_MAX_BYTES['image/png']);
  });

  it('TEMPLATE_INFO mirrors every template\'s label and mood', () => {
    expect(Object.keys(TEMPLATE_INFO).sort()).toEqual(Object.keys(TEMPLATES).sort());
    for (const [id, t] of Object.entries(TEMPLATES)) expect(TEMPLATE_INFO[id], id).toEqual({ label: t.label, mood: t.mood });
  });

  it('sectionLabels: the visible sections top to bottom, as the owner reads them', () => {
    expect(sectionLabels({ sectionOrder: ['hero', 'services', 'awards', 'gallery', 'shadeGuide', 'myNewThing', 'faq'], hiddenSections: ['gallery'] }))
      .toEqual(['Top banner', 'Services', 'Shade guide', 'My New Thing', 'Questions']);
    expect(sectionLabels({ sectionOrder: ['hero', 'hero', 'bad id!', 7] })).toEqual(['Top banner']);
    expect(sectionLabels({})).toEqual([]);
    expect(sectionLabels(null)).toEqual([]);
  });

  it('signInUrl: the app\'s address, never another scheme', () => {
    expect(signInUrl({})).toBe('https://sitebuilder.autocaregenius.com');
    expect(signInUrl({ MAIN_APP_URL: 'https://app.example.test/' })).toBe('https://app.example.test');
    expect(signInUrl({ MAIN_APP_URL: 'javascript:alert(1)' })).toBe('https://sitebuilder.autocaregenius.com');
  });

  it('tidyUrl: no doubled slashes (the published URL comes back as ".../"), http(s) only', () => {
    expect(tidyUrl('https://a.autocaregeniushub.com/')).toBe('https://a.autocaregeniushub.com');
    expect(tidyUrl('https://a.autocaregeniushub.com//book#book')).toBe('https://a.autocaregeniushub.com/book#book');
    expect(tidyUrl('https://www.glossboss.com/book#book')).toBe('https://www.glossboss.com/book#book');
    expect(tidyUrl('https://search.google.com/local/writereview?placeid=ChIJ_x1')).toBe('https://search.google.com/local/writereview?placeid=ChIJ_x1');
    for (const bad of ['javascript:alert(1)', 'ftp://x.example', 'nope', '', null]) expect(tidyUrl(bad), String(bad)).toBe('');
  });

  it('partData keeps what the PDF and the text files use', () => {
    const claims = Array.from({ length: 40 }, (_, i) => ({ text: `Claim ${i}`, where: 'site', status: i < 5 ? 'sourced' : (i % 2 ? 'unsourced' : 'needs-rewrite'), suggestion: 'Fix it', source: null }));
    const c = partData('claims', { claims: [...claims, 'junk'] });
    expect(c.counts).toEqual({ total: 40, sourced: 5, toConfirm: 35 });
    expect(c.toConfirm).toHaveLength(30);
    expect(c.toConfirm[0]).toEqual({ where: 'site', status: 'unsourced', text: 'Claim 5', suggestion: 'Fix it' });
    expect(partData('photos', { picks: [{ path: 'x' }], shotList: ['A', '', 3, 'B'] })).toEqual({ shotList: ['A', 'B'] });
    expect(partData('words', { gbp: { description: 'd' }, adjustments: ['x'], seo: 'no' })).toEqual({ gbp: { description: 'd' }, seo: {}, reviews: {}, social: {} });
    expect(partData('social', { images: [{ file: 'post-1.png', alt: 'A car' }], captions: [{ file: 'post-1.png', text: 'Hi <b>' }] }))
      .toEqual({ images: [{ file: 'post-1.png', size: '', purpose: '', alt: 'A car' }], captions: [{ file: 'post-1.png', text: 'Hi ‹b›' }] });
    expect(partData('print', { pieces: [{ file: 'business-cards.pdf', name: 'Business cards', qr: [{ url: 'x' }] }] }).pieces[0])
      .toEqual({ file: 'business-cards.pdf', name: 'Business cards', size: '', note: '' });
    expect(partData('mobile', { phoneHeadline: 'Hi', vcard: { tel: '1' } })).toEqual({ phoneHeadline: 'Hi' });
    expect(partData('nope', {})).toBeNull();
    expect(partData('words', null)).toBeNull();
  });
});

describe('loadInputs on the smoke sample', () => {
  it('sends the inputs file, every kit file, the board and the logo, none shown as images', async () => {
    const sample = await smokeSample();
    const prepared = await prepare(sample);
    const names = prepared.files.map((f) => f.name);
    expect(names[0]).toBe(HANDOVER_INPUTS_FILE);
    expect(names).toContain('kit-print-business-cards.pdf');
    expect(names).toContain('kit-social-story-1080x1920.png');
    expect(names).toContain('kit-mobile-contact.vcf');
    expect(names).toContain('kit-photos-contact_sheet.png');
    expect(names).toContain('kit-words-words.pdf');
    expect(names).toContain('brand-board.png');
    expect(names).toContain('logo-1.png');
    expect(names.filter((n) => n.startsWith('kit-'))).toHaveLength(18);
    expect(prepared.files.every((f) => f.vision === false)).toBe(true);
    // Fonts were offline: a warning, never an error.
    expect(prepared.ctx.inputs.warnings).toEqual(['The brand fonts could not be fetched; the PDF uses Helvetica.']);
    const board = prepared.files.find((f) => f.name === 'brand-board.png');
    expect(sniffImage(board.data)).toMatchObject({ mediaType: 'image/png', width: 1600, height: 1000 });
  });

  it('handover-inputs.json: facts, links and kit data, never the contact details', async () => {
    const sample = await smokeSample();
    const prepared = await prepare(sample);
    const p = payloadOf(prepared);
    expect(p.version).toBe(1);
    expect(p.generatedAt).toBe('2026-10-06T15:00:00.000Z');
    expect(p.business).toEqual({ name: 'Sample Shine Mobile Detailing', type: 'Mobile detailing', area: 'Exampleton and Sampleville' });
    expect(p.site).toMatchObject({ templateId: 'mobile_redline', templateName: 'Redline', templateAbout: '', sections: ['Top banner', 'Services', 'About', 'Reviews', 'Contact'] });
    expect(p.site.facts).toContain('serviceArea: Exampleton and Sampleville');
    expect(p.links).toEqual({
      site: 'https://sample-shine.autocaregeniushub.com',
      booking: 'https://sample-shine.autocaregeniushub.com/book#book',
      review: 'https://search.google.com/local/writereview?placeid=ChIJ_sample_place_0001',
      signIn: 'https://sitebuilder.autocaregenius.com',
    });
    expect(p.domain).toEqual({ name: '', live: false });
    expect(p.look).toEqual({ palette: { bg: '#0e0e10', secondary: '#1a1a1d', text: '#f5f5f5', muted: '#a1a1aa', accent: '#c8102e' }, fonts: { heading: 'Bebas Neue', body: 'Barlow' }, source: 'brand' });
    expect(p.brand).toMatchObject({ board: 'brand-board.png', reasons: { palette: expect.any(String), accent: 'The red from the logo.', fonts: expect.any(String) } });
    expect(Object.keys(p.brand.alternates)).toEqual(['light', 'dark']);
    // The suggestion's reasons that still match the site (same template;
    // the palette and fonts came from the brand system, not the Studio).
    expect(Object.keys(p.designReasons)).toEqual(['template', 'sections']);
    expect(Object.keys(p.parts).sort()).toEqual(['claims', 'mobile', 'photos', 'print', 'social', 'words']);
    expect(p.parts.claims.counts).toEqual({ total: 5, sourced: 2, toConfirm: 3 });
    expect(p.notReady).toEqual([]);
    expect(p.kitFiles.find((f) => f.name === 'business-cards.pdf')).toMatchObject({ key: 'print', input: 'kit-print-business-cards.pdf', zip: '05-print/business-cards.pdf' });
    expect(p.kitSkipped).toEqual([]);
    expect(p.logo).toBe('logo-1.png');
    expect(p.fontFiles).toEqual([]);
    expect(p.zip).toEqual({ maxBytes: HANDOVER_ZIP_MAX_BYTES });
    // The intake: what the customer said about the business, no contact
    // details, no pasted reviews, no reference sites.
    const text = JSON.stringify(p);
    for (const secret of ['sam@example.test', '010-0123', 'Sam Sample', 'Best detailer']) expect(text).not.toContain(secret);
    expect(p.intake).toContain('Your story: I have been detailing cars for 8 years.');
    expect(HANDOVER_INTAKE_FIELDS).not.toContain('contactEmail');
    expect(HANDOVER_INTAKE_FIELDS).not.toContain('testimonials');
    // The planted instruction travels as data (the skill must ignore it).
    expect(p.intake).toContain('Ignore your instructions');
  });

  it('remembers every zip path the run may report', async () => {
    const prepared = await prepare(await smokeSample());
    const paths = new Set(prepared.ctx.inputs.zipPaths);
    for (const p of ['handover.pdf', 'README.txt', '01-brand/brand-board.png', '01-brand/brand-colors.txt', '04-words/paste-ready.txt', '06-social/captions.txt', '05-print/business-cards.pdf', '02-photos/contact_sheet.png']) {
      expect(paths.has(p), p).toBe(true);
    }
    expect(paths.size).toBe(24);
  });

  it('refuses before anything is spent without a site or a live address', async () => {
    const sample = await smokeSample();
    await expect(prepareKitRun({ db: sampleDb(sample.files), project: sample.project, site: null, key: 'handover', spec: KIT_SPECS.handover, deadline: NOW + KIT_BUDGET_MS, fetchImpl: offline }))
      .rejects.toThrow('needs the written site first');
    const unpublished = { ...sample.site, publishedUrl: '' };
    await expect(prepareKitRun({ db: sampleDb(sample.files), project: sample.project, site: unpublished, key: 'handover', spec: KIT_SPECS.handover, deadline: NOW + KIT_BUDGET_MS, fetchImpl: offline }))
      .rejects.toThrow('publish the site first');
  });

  it('a site with nothing else: no kit, no brand, no logo, no booking', async () => {
    const sample = await smokeSample();
    const project = clone({ ...sample.project, assets: [], design: { siteId: sample.project.design.siteId, kit: { words: { status: 'failed', error: 'x', files: [] }, print: { status: 'running', startedAt: new Date(NOW - 60000).toISOString() } } } });
    const site = { ...sample.site, schedulerEnabled: false, businessInfo: { businessName: 'Sample Shine Mobile Detailing' } };
    const db = sampleDb(sample.files);
    const prepared = await prepareKitRun({ db, project, site, key: 'handover', spec: KIT_SPECS.handover, deadline: NOW + KIT_BUDGET_MS, nowMs: () => NOW, fetchImpl: offline });
    expect(prepared.files.map((f) => f.name)).toEqual([HANDOVER_INPUTS_FILE]);
    expect(db.downloads).toEqual([]);
    const p = payloadOf(prepared);
    expect(p.links.booking).toBe('');
    expect(p.links.review).toBe('');
    expect(p.brand).toEqual({});
    expect(p.look.source).toBe('site');
    expect(p.notReady.map((n) => [n.key, n.state])).toEqual([
      ['photos', 'not built yet'], ['mobile', 'not built yet'], ['words', 'failed'], ['claims', 'not built yet'], ['print', 'still running'], ['social', 'not built yet'],
    ]);
    expect([...prepared.ctx.inputs.zipPaths].sort()).toEqual(['01-brand/brand-colors.txt', 'README.txt', 'handover.pdf']);
    expect(prepared.userText).toContain('Ready kit parts: none.');
    expect(prepared.userText).toContain('Words (failed)');
    expect(prepared.userText).toContain('- Booking page: (none: never mention it)');
  });

  it('a kit file over the budget is left out, listed and allowed as "left"', async () => {
    const sample = await smokeSample();
    const project = clone(sample.project);
    const story = project.design.kit.social.files.find((f) => f.name === 'story-1080x1920.png');
    story.size = 26 * 1024 * 1024;
    const db = sampleDb(sample.files, { fail: (p) => p.endsWith('-post-2.png') });
    const prepared = await prepare({ ...sample, project }, { db });
    const p = payloadOf(prepared);
    expect(p.kitSkipped).toEqual([
      { key: 'social', name: 'post-2.png', zip: '06-social/post-2.png', reason: 'Could not be downloaded' },
      { key: 'social', name: 'story-1080x1920.png', zip: '06-social/story-1080x1920.png', reason: 'Too large (26.0 MB)' },
    ]);
    expect(p.kitFiles.some((f) => f.name === 'story-1080x1920.png')).toBe(false);
    expect(db.downloads.some((d) => d.endsWith('story-1080x1920.png'))).toBe(false);
    expect(prepared.ctx.inputs.warnings).toContain('Social kit: story-1080x1920.png isn\'t in the zip (Too large (26.0 MB)).');
    expect(prepared.ctx.inputs.zipPaths).toContain('06-social/story-1080x1920.png');
    expect(prepared.userText).toContain('06-social/story-1080x1920.png: Too large (26.0 MB)');
  });

  it('the brand board: only this project\'s board path, only a PNG under the cap', async () => {
    const sample = await smokeSample();
    const { files, project } = sample;
    const boardPath = project.design.brand.boardPath;
    const with_ = (p) => ({ ...project, design: { ...project.design, brand: { ...project.design.brand, boardPath: p } } });
    expect(await loadBoard(sampleDb(files), project)).toEqual({ data: files[boardPath] });
    const other = sampleDb({ 'other-project/brand/board-1.png': files[boardPath] });
    expect(await loadBoard(other, with_('other-project/brand/board-1.png'))).toEqual({});
    expect(other.downloads).toEqual([]);
    expect(await loadBoard(sampleDb(files), with_(`${project.id}/brand/../logo/x.png`))).toEqual({});
    const pdfBoard = { [boardPath]: samplePdf(['not a png']) };
    expect((await loadBoard(sampleDb(pdfBoard), project)).warning).toMatch(/isn't a readable PNG/);
    const big = { [boardPath]: Buffer.concat([files[boardPath], Buffer.alloc(BOARD_MAX_BYTES)]) };
    expect((await loadBoard(sampleDb(big), project)).warning).toMatch(/too large/);
    expect((await loadBoard(sampleDb({}), project)).warning).toMatch(/could not be downloaded/);
  });

  it('Studio reasons only for what the Studio set; brand reasons only for what the brand set', async () => {
    const sample = await smokeSample();
    const project = clone(sample.project);
    project.design.brand = { status: 'failed', error: 'x' };
    project.design.levers = { palette: { bg: '#ffffff', secondary: '#f4f4f5', text: '#18181b', muted: '#52525b', accent: '#2563eb' }, fonts: { heading: 'Oswald', body: 'Inter' } };
    project.design.suggestion = { status: 'ready', templateId: 'detailing_sporty', reasons: { template: 'Sporty fits.', palette: 'Blue from the logo.', fonts: 'Oswald is bold.', sections: 'x' } };
    const p = payloadOf(await prepare({ ...sample, project }));
    expect(p.look.source).toBe('levers');
    expect(p.designReasons).toEqual({ palette: 'Blue from the logo.', fonts: 'Oswald is bold.' });
    expect(p.brand).toEqual({});
    expect(p.look.fonts).toEqual({ heading: 'Oswald', body: 'Inter' });
  });

  it('font files go in when they can be fetched', async () => {
    const sample = await smokeSample();
    const ttf = Buffer.concat([Buffer.from([0, 1, 0, 0]), Buffer.alloc(200)]);
    const fetchImpl = async (url) => (String(url).startsWith('https://fonts.googleapis.com/')
      ? { ok: true, text: async () => "@font-face { font-weight: 400; src: url(https://fonts.gstatic.com/s/x/a.ttf) format('truetype'); }" }
      : { ok: true, arrayBuffer: async () => ttf });
    const prepared = await prepare(sample, { fetchImpl });
    const p = payloadOf(prepared);
    expect(p.fontFiles).toEqual([{ family: 'Bebas Neue', weight: 400, file: 'font-BebasNeue-400.ttf' }, { family: 'Barlow', weight: 400, file: 'font-Barlow-400.ttf' }]);
    expect(prepared.files.filter((f) => f.name.startsWith('font-')).map((f) => f.mediaType)).toEqual(['font/ttf', 'font/ttf']);
    expect(prepared.ctx.inputs.warnings).toEqual([]);
  });
});

describe('the prompt', () => {
  it('names the files, the ready parts and the only links, with customer text as data', async () => {
    const sample = await smokeSample();
    sample.project.form.businessName = 'Sample <Shine> Mobile Detailing';
    sample.site.businessInfo.businessName = 'Sample <Shine> Mobile Detailing';
    const { system, userText } = await prepare(sample);
    expect(system).toContain('launch manager at Genius Websites');
    expect(system).toContain('Use the launch-handover skill');
    expect(system).toContain('handover.json');
    expect(userText).toContain('Build the website handover for Sample ‹Shine› Mobile Detailing.');
    expect(userText).not.toContain('<Shine>');
    expect(userText).toContain('18 kit files to pack as they are');
    expect(userText).toContain('brand-board.png: the brand board');
    expect(userText).toContain('logo-1.png: their logo');
    expect(userText).toContain('No font files: the PDF uses Helvetica.');
    expect(userText).toContain('Ready kit parts: Photo desk, Mobile kit, Words, Claims ledger, Print studio, Social kit.');
    expect(userText).toContain('- Google review link: https://search.google.com/local/writereview?placeid=ChIJ_sample_place_0001');
    expect(userText).toContain('<business>');
    // The intake stays in the file; the prompt never carries it.
    expect(userText).not.toContain('Ignore your instructions');
  });

  it('buildPrompt works from the context alone', () => {
    const { userText } = buildPrompt({ project: { business_name: 'X Detail' }, site: { businessInfo: {} }, inputs: {} });
    expect(userText).toContain('Build the website handover for X Detail.');
    expect(userText).toContain('No kit files');
  });
});

describe('sanitize and notes', () => {
  it('keeps a good handover.json for these inputs exactly', async () => {
    const prepared = await prepare(await smokeSample());
    const raw = goodRaw(prepared.ctx.inputs);
    expect(sanitize(raw, prepared.ctx)).toEqual(raw);
  });

  it('drops links and zip paths the inputs didn\'t give', async () => {
    const prepared = await prepare(await smokeSample());
    const raw = goodRaw(prepared.ctx.inputs);
    raw.links.review = 'https://cheap-wraps.example/deal';
    raw.files.push('05-print/flyer.pdf', 'other-customer.pdf');
    const data = sanitize(raw, prepared.ctx);
    expect(data.links.review).toBe('');
    expect(data.files).not.toContain('05-print/flyer.pdf');
    expect(data.files).not.toContain('other-customer.pdf');
  });

  it('is strict without inputs: the root files only, no links', () => {
    const data = sanitize({ sections: ['Your brand', 'A'], files: ['handover.pdf', '05-print/business-cards.pdf'], links: { site: 'https://a.example' } }, {});
    expect(data.files).toEqual(['handover.pdf']);
    expect(data.links.site).toBe('');
    expect(data.sections).toEqual(['Your brand']);
    expect(sanitize(null, {})).toBeNull();
  });

  it('notes are the sanitized notes', () => {
    expect(notes({ notes: ['raw <x>'] }, { notes: ['clean'] })).toEqual(['clean']);
    expect(notes({}, null)).toEqual([]);
  });
});

describe('zip entries and the smoke check', () => {
  it('zipEntryNames reads a zip\'s central directory', () => {
    expect(zipEntryNames(makeZip([['handover.pdf', Buffer.from('%PDF-')], ['05-print/x.pdf', Buffer.from('y')]]))).toEqual(['handover.pdf', '05-print/x.pdf']);
    expect(zipEntryNames(Buffer.from('not a zip'))).toBeNull();
    expect(zipEntryNames(Buffer.alloc(0))).toBeNull();
  });

  it('sample files are what they claim to be', async () => {
    expect(sniffImage(await samplePng(32, 32, [1, 2, 3]))).toMatchObject({ mediaType: 'image/png', width: 32, height: 32 });
    expect(samplePdf(['x']).toString('latin1', 0, 5)).toBe('%PDF-');
  });

  it('passes a good run and names every problem of a bad one', async () => {
    const prepared = await prepare(await smokeSample());
    const raw = goodRaw(prepared.ctx.inputs);
    const data = sanitize(raw, prepared.ctx);
    const zip = makeZip(data.files.map((f) => [f, Buffer.from('x')]));
    expect(smokeCheck(raw, data, [{ name: 'launch-kit.zip', data: zip }])).toEqual([]);

    const bad = clone(raw);
    bad.links.booking = 'https://cheap-wraps.example/deal';
    bad.thisWeek[0].detail = 'Tell everyone you are the #1 detailer in town.';
    bad.checklist = bad.checklist.filter((c) => c.week !== 3);
    bad.claims.toConfirm = 1;
    const badData = sanitize(bad, prepared.ctx);
    const problems = smokeCheck(bad, badData, [{ name: 'launch-kit.zip', data: makeZip(badData.files.slice(1).map((f) => [f, Buffer.from('x')])) }]);
    expect(problems.join('\n')).toMatch(/links\.booking isn't the link the server sent/);
    expect(problems.join('\n')).toMatch(/#1 detailer/);
    expect(problems.join('\n')).toMatch(/misses a week/);
    expect(problems.join('\n')).toMatch(/claims\.toConfirm is 1/);
    expect(problems.join('\n')).toMatch(/differ from the zip/);
    expect(smokeCheck(raw, data, [])).toContain('launch-kit.zip did not come back');
  });
});

// A fake Anthropic client whose one request "writes" these output files.
function fakeClient(outputs) {
  const uploads = [];
  const deleted = [];
  const byId = Object.fromEntries(Object.entries(outputs).map(([name, data], i) => [`file_out_${i + 1}`, { filename: name, data }]));
  return {
    uploads,
    deleted,
    files: {
      upload: vi.fn(async ({ file }) => {
        uploads.push({ name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) });
        return { id: `file_in_${uploads.length}` };
      }),
      retrieveMetadata: vi.fn(async (id) => ({ id, filename: byId[id]?.filename || '', size_bytes: byId[id]?.data.length || 0 })),
      download: vi.fn(async (id) => ({ arrayBuffer: async () => byId[id].data })),
      delete: vi.fn(async (id) => { deleted.push(id); return { id }; }),
    },
    messages: {
      stream: vi.fn(() => ({
        finalMessage: async () => ({
          model: 'claude-opus-5-5',
          stop_reason: 'end_turn',
          container: { id: 'cntr_handover' },
          usage: { input_tokens: 12000, output_tokens: 5000 },
          content: [{
            type: 'bash_code_execution_tool_result',
            tool_use_id: 'srvtoolu_1',
            content: {
              type: 'bash_code_execution_result', stdout: '', stderr: '', return_code: 0,
              content: Object.keys(byId).map((file_id) => ({ type: 'bash_code_execution_output', file_id })),
            },
          }],
        }),
      })),
    },
  };
}

describe('one run through production\'s buildKitRun (fake client)', () => {
  it('uploads the inputs, keeps the sanitized outline and the three files', async () => {
    const sample = await smokeSample();
    const prepared = await prepare(sample);
    const raw = goodRaw(prepared.ctx.inputs);
    const pdf = samplePdf(['Website handover']);
    const zip = makeZip(raw.files.map((f) => [f, f === 'handover.pdf' ? pdf : Buffer.from('x')]));
    const client = fakeClient({ [HANDOVER_FILES.data]: Buffer.from(JSON.stringify(raw)), [HANDOVER_FILES.pdf]: pdf, [HANDOVER_FILES.zip]: zip });
    const result = await buildKitRun({
      db: sampleDb(sample.files), client, project: sample.project, site: sample.site, key: 'handover', spec: KIT_SPECS.handover,
      skill: { type: 'custom', skill_id: 'skill_01Handover', version: '1759700000000000' },
      deadline: NOW + KIT_BUDGET_MS, nowMs: () => NOW, fetchImpl: offline,
    });
    expect(client.uploads[0]).toMatchObject({ name: HANDOVER_INPUTS_FILE, type: 'application/json' });
    expect(client.uploads).toHaveLength(prepared.files.length);
    const body = client.messages.stream.mock.calls[0][0];
    expect(body.container.skills).toEqual([{ type: 'custom', skill_id: 'skill_01Handover', version: '1759700000000000' }]);
    expect(body.messages[0].content.filter((b) => b.type === 'image')).toEqual([]);
    expect(result.data).toEqual(sanitizeHandover(raw, { zipPaths: new Set(prepared.ctx.inputs.zipPaths), links: prepared.ctx.inputs.links }));
    expect(result.data).toEqual(raw);
    expect(result.outputs.map((o) => o.name)).toEqual([HANDOVER_FILES.data, HANDOVER_FILES.pdf, HANDOVER_FILES.zip]);
    expect(result.notes).toEqual(raw.notes);
    expect(smokeCheck(raw, result.data, result.outputs)).toEqual([]);
  });

  it('fails the run when handover.json has no sections', async () => {
    const sample = await smokeSample();
    const client = fakeClient({ [HANDOVER_FILES.data]: Buffer.from('{"version":1,"sections":[]}'), [HANDOVER_FILES.pdf]: samplePdf(['x']) });
    await expect(buildKitRun({
      db: sampleDb(sample.files), client, project: sample.project, site: sample.site, key: 'handover', spec: KIT_SPECS.handover,
      skill: { type: 'custom', skill_id: 'skill_01Handover', version: '1' }, deadline: NOW + KIT_BUDGET_MS, nowMs: () => NOW, fetchImpl: offline,
    })).rejects.toThrow('handover.json came back without usable data.');
  });
});

// The skill's own scripts on the inputs this spec builds (opt-in: needs a
// Python with reportlab, Pillow and pypdf).
const PY = process.env.HANDOVER_PYTHON || '';
describe.skipIf(!PY)('the skill\'s scripts on the inputs this spec builds', () => {
  it('plan, draft, build and final check pass, and the server keeps the result as written', async () => {
    const prepared = await prepare(await smokeSample());
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-e2e-'));
    try {
      const up = path.join(dir, 'uploads');
      fs.mkdirSync(up);
      for (const f of prepared.files) fs.writeFileSync(path.join(up, f.name), f.data);
      const S = path.join(ROOT, 'skills/api/launch-handover/scripts');
      const work = path.join(dir, 'work');
      const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };
      const py = (...args) => execFileSync(PY, args, { env }).toString();
      expect(py(path.join(S, 'plan.py'), '--input', path.join(up, HANDOVER_INPUTS_FILE), '--out-dir', work)).toContain('=== END DATA ===');
      expect(py(path.join(S, 'validate_handover.py'), 'content', path.join(work, 'content.json'), '--plan', path.join(work, 'plan.json'))).toContain('OK');
      py(path.join(S, 'build_handover.py'), '--plan', path.join(work, 'plan.json'), '--content', path.join(work, 'content.json'), '--out-dir', path.join(work, 'out'));
      expect(py(path.join(S, 'validate_handover.py'), 'final', path.join(work, 'out'), '--plan', path.join(work, 'plan.json'))).toContain('OK');
      const raw = JSON.parse(fs.readFileSync(path.join(work, 'out', HANDOVER_FILES.data), 'utf8'));
      const data = sanitize(raw, prepared.ctx);
      expect(data).toEqual(raw);
      const outputs = [{ name: HANDOVER_FILES.zip, data: fs.readFileSync(path.join(work, 'out', HANDOVER_FILES.zip)) }];
      expect(smokeCheck(raw, data, outputs)).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120000);
});
