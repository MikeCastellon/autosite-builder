// tests/functions/kit-print.test.js
//
// Print studio's server spec (netlify/functions/_lib/kit/print.js): what a
// run sends (print-inputs.json with the links every code may hold, the
// logo, the brand fonts), the prompt, the sanitizer over the skill's
// print.json, the notes, the smoke sample and its strict check, and one run
// through production's buildKitRun with a fake Anthropic client. Nothing
// reaches the API, the network, the database or the bucket.
//
// It also keeps the skill's Python fixtures honest: tests/sample_inputs.json
// is the exact print-inputs.json a run sends for the smoke sample (with
// stand-in font files) and tests/sample_logo.png its logo; the skill's
// Python tests build and validate the PDFs from them and write
// tests/sample_print.json, which the sanitizer must store unchanged. After
// changing what a run sends:
//   UPDATE_SKILL_FIXTURES=1 npx vitest run tests/functions/kit-print.test.js
//   UPDATE_SKILL_FIXTURES=1 python3 skills/api/launch-print-studio/tests/test_print.py
//   npx vitest run tests/functions/kit-print.test.js
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildPrintInputs, businessTypeLabel, notes, printFactsText, sampleLogo, smokeCheck, smokeSample, spec,
} from '../../netlify/functions/_lib/kit/print.js';
import { KIT_SPECS, kitConfigured } from '../../netlify/functions/_lib/kit/index.js';
import { liveUrls } from '../../netlify/functions/_lib/kit/inputs.js';
import { buildKitRun, prepareKitRun } from '../../netlify/functions/custom-site-kit-background.js';
import { KIT_BUDGET_MS } from '../../src/lib/launchKit.js';
import { PRINT_INPUTS_FILE, PrintCheckError, sanitizePrint } from '../../src/lib/kit/print.js';

const ROOT = path.resolve(__dirname, '../..');
const SKILL_TESTS = path.join(ROOT, 'skills/api/launch-print-studio/tests');
const UPDATE = process.env.UPDATE_SKILL_FIXTURES === '1';
const NOW = Date.parse('2026-10-06T12:00:00.000Z');

function sampleDb(files, { fail = () => false } = {}) {
  const downloads = [];
  return {
    downloads,
    storage: {
      from: () => ({
        download: async (p) => {
          downloads.push(p);
          if (fail(p) || !files[p]) return { data: null, error: { message: 'Object not found' } };
          return { data: new Blob([files[p]]), error: null };
        },
      }),
    },
    from: (table) => { throw new Error(`no database here (asked for ${table})`); },
  };
}

// Google Fonts as fetchFontFiles sees it: a css2 answer per family with
// gstatic URLs, and tiny "TrueType" files (the right magic number).
function fontsFetch() {
  const calls = [];
  const ttf = (tag) => Buffer.concat([Buffer.from([0, 1, 0, 0]), Buffer.from(`stand-in ${tag}`.padEnd(60, '.'))]);
  const impl = vi.fn(async (url) => {
    calls.push(String(url));
    const u = new URL(String(url));
    if (u.hostname === 'fonts.googleapis.com') {
      const fam = u.searchParams.get('family').split(':')[0];
      const css = [400, 700].map((w) => `@font-face { font-family: '${fam}'; font-style: normal; font-weight: ${w}; src: url(https://fonts.gstatic.com/s/${fam.replace(/\s/g, '').toLowerCase()}/${w}.ttf) format('truetype'); }`).join('\n');
      return { ok: true, status: 200, text: async () => css };
    }
    if (u.hostname === 'fonts.gstatic.com') {
      const data = ttf(u.pathname);
      return { ok: true, status: 200, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.length) };
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  return { impl, calls };
}

const noNetwork = async () => { throw new Error('no network'); };

async function prepare(sample = smokeSample(), { fetchImpl = noNetwork, fail } = {}) {
  const db = sampleDb(sample.files || {}, { fail });
  const prepared = await prepareKitRun({
    db, project: sample.project, site: sample.site ?? null, key: 'print', spec: KIT_SPECS.print,
    deadline: NOW + KIT_BUDGET_MS, nowMs: () => NOW, fetchImpl,
  });
  return { ...prepared, db, payload: JSON.parse(prepared.files.find((f) => f.name === PRINT_INPUTS_FILE).data.toString('utf8')) };
}

const tweak = (fn) => {
  const s = smokeSample();
  fn(s);
  return s;
};

const readFixture = (name) => {
  const p = path.join(SKILL_TESTS, name);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};

// The Python build of the sample. Only an update run (which writes the
// inputs first, then the Python tests write this) may go without it.
function samplePrintFixture() {
  const raw = readFixture('sample_print.json');
  if (!raw && !UPDATE) throw new Error('skills/api/launch-print-studio/tests/sample_print.json is missing: run the Python tests with UPDATE_SKILL_FIXTURES=1');
  return raw;
}

describe('the print spec', () => {
  it('is built and runs once its skill id is set', () => {
    expect(KIT_SPECS.print.stub).toBe(false);
    expect(KIT_SPECS.print.maxTurns).toBe(8);
    expect(kitConfigured('print', { CUSTOM_SITE_KIT_PRINT_SKILL_ID: 'skill_01Print', CUSTOM_SITE_KIT_PRINT_SKILL_VERSION: '1759700000000000' })).toBe(true);
    expect(kitConfigured('print', {})).toBe(false);
    expect(spec.smokeCheck).toBe(smokeCheck);
  });

  it('labels business types and keeps contact details, reviews and the Google rating out of the facts', () => {
    expect(businessTypeLabel('mobile_detailing')).toBe('Mobile detailing');
    expect(businessTypeLabel('tint_shop')).toBe('Tint / PPF');
    expect(businessTypeLabel('ceramic_studio')).toBe('Ceramic studio');
    expect(businessTypeLabel('other')).toBe('');
    expect(businessTypeLabel('<b>x</b>')).toBe('');
    const { project, site } = smokeSample();
    const facts = printFactsText(project, site);
    expect(facts).toContain('Mobile detailing');
    expect(facts).toContain('8 years');
    expect(facts).toContain('Ceramic Coating - $899 (5 year warranty)');
    expect(facts).not.toContain('sam@example.test');
    expect(facts).not.toContain('Sam Sample');
    expect(facts).not.toContain('Best detailer');
    expect(facts).not.toContain('4.9');
    expect(facts).not.toContain('ChIJ_sample');
  });

  it('sends print-inputs.json, the logo and the brand fonts, with every link built by the server', async () => {
    const fonts = fontsFetch();
    const { files, payload, ctx, db } = await prepare(smokeSample(), { fetchImpl: fonts.impl });
    expect(files.map((f) => [f.name, f.mediaType, f.vision])).toEqual([
      [PRINT_INPUTS_FILE, 'application/json', false],
      ['logo-1.png', 'image/png', true],
      ['font-Oswald-400.ttf', 'font/ttf', false],
      ['font-Oswald-700.ttf', 'font/ttf', false],
      ['font-Inter-400.ttf', 'font/ttf', false],
      ['font-Inter-700.ttf', 'font/ttf', false],
    ]);
    expect(files[1].data.equals(sampleLogo())).toBe(true);
    expect(db.downloads).toEqual([smokeSample().project.assets[0].path]);
    expect(fonts.calls.filter((u) => u.includes('googleapis'))).toHaveLength(2);
    expect(payload.links).toEqual({
      site: 'https://sample-shine.autocaregeniushub.com/',
      // liveUrls gives ".com//book#book" (a slash-ended base plus "/book");
      // printed codes never carry the double slash.
      booking: 'https://sample-shine.autocaregeniushub.com/book#book',
      review: 'https://search.google.com/local/writereview?placeid=ChIJ_sample_place_0001',
      call: 'tel:+15550100199',
      vcard: [
        'BEGIN:VCARD', 'VERSION:3.0', 'N:Sample Shine Mobile Detailing;;;;', 'FN:Sample Shine Mobile Detailing', 'ORG:Sample Shine Mobile Detailing',
        'TEL;TYPE=WORK,VOICE:+15550100199', 'EMAIL;TYPE=WORK:hello@sample-shine.example', 'URL:https://sample-shine.autocaregeniushub.com/',
        'X-ABShowAs:COMPANY', 'END:VCARD',
      ].join('\r\n'),
    });
    expect(liveUrls(ctx.project, ctx.site).booking).toBe('https://sample-shine.autocaregeniushub.com/book#book');
    expect(payload.rebook).toBe('booking');
    expect(payload.business).toEqual({
      name: 'Sample Shine Mobile Detailing', type: 'Mobile detailing', person: 'Sam Sample', phone: '(555) 010-0199',
      email: 'hello@sample-shine.example', site: 'sample-shine.autocaregeniushub.com', address: '', city: 'Exampleton', state: 'FL',
      serviceArea: 'Exampleton and Sampleville',
    });
    expect(payload.look).toEqual({
      palette: { bg: '#0a0909', secondary: '#1a1818', text: '#f8f8f8', muted: '#a7a3a4', accent: '#ee3533' },
      fonts: { heading: 'Oswald', body: 'Inter' },
      source: { palette: 'brand', fonts: 'brand' },
      logoHasText: false,
    });
    expect(payload.fontFiles).toEqual([
      { file: 'font-Oswald-400.ttf', family: 'Oswald', weight: 400 },
      { file: 'font-Oswald-700.ttf', family: 'Oswald', weight: 700 },
      { file: 'font-Inter-400.ttf', family: 'Inter', weight: 400 },
      { file: 'font-Inter-700.ttf', family: 'Inter', weight: 700 },
    ]);
    expect(payload.logo).toEqual({ file: 'logo-1.png', width: 480, height: 150 });
    expect(payload.notes).toEqual([]);
    expect(ctx.inputs.warnings).toEqual([]);

    // The skill's Python tests build from exactly this file.
    const fixture = path.join(SKILL_TESTS, 'sample_inputs.json');
    if (UPDATE) {
      fs.mkdirSync(SKILL_TESTS, { recursive: true });
      fs.writeFileSync(fixture, `${JSON.stringify(payload, null, 1)}\n`);
      fs.writeFileSync(path.join(SKILL_TESTS, 'sample_logo.png'), sampleLogo());
    }
    expect(JSON.parse(fs.readFileSync(fixture, 'utf8'))).toEqual(payload);
    expect(fs.readFileSync(path.join(SKILL_TESTS, 'sample_logo.png')).equals(sampleLogo())).toBe(true);
  });

  it('runs without the fonts (DejaVu stands in) and says so', async () => {
    const { files, ctx, payload } = await prepare();
    expect(files.map((f) => f.name)).toEqual([PRINT_INPUTS_FILE, 'logo-1.png']);
    expect(payload.fontFiles).toEqual([]);
    expect(ctx.inputs.warnings.some((w) => /Oswald: the font files could not be fetched/.test(w))).toBe(true);
  });

  it('writes a prompt with the facts as data and the pieces this run makes', async () => {
    const { system, userText } = await prepare();
    expect(system).toContain('print designer');
    expect(system).toContain('Never type, shorten or "correct" a link');
    expect(system).toContain('Use the launch-print-studio skill');   // kitRules
    expect(userText).toContain('Make the print pieces for Sample Shine Mobile Detailing (Mobile detailing).');
    expect(userText).toContain(`- ${PRINT_INPUTS_FILE}:`);
    expect(userText).toContain('- logo-1.png: a logo. Their file name: "shine-logo.png". Their note: "Main logo".');
    expect(userText).toContain('No brand font files');
    expect(userText).toContain('make all four pieces');
    expect(userText).toContain('open the online booking page');
    expect(userText).toContain('from the brand system');
    // The planted instruction only appears inside the data tags.
    const inside = userText.slice(userText.indexOf('<customer_facts>'), userText.indexOf('</customer_facts>'));
    expect(inside).toContain('Voted #1 in Florida');
    expect(userText.replace(inside, '')).not.toContain('Voted');
    // Contact details live in the file, not the prompt.
    expect(userText).not.toContain('sam@example.test');
  });

  it('leaves the review pieces out without a Google profile, and says why', async () => {
    const { payload, userText, ctx } = await prepare(tweak((s) => { delete s.site.businessInfo.googlePlace; }));
    expect(payload.links.review).toBe('');
    expect(userText).toContain('No Google profile is linked');
    expect(userText).toContain('"omitted"');
    expect(ctx.inputs.warnings).toContain('No Google profile is linked, so the review hang tag and counter card will be left out.');
  });

  it('points the rebook codes at the site, then the phone, when booking is off', async () => {
    const off = await prepare(tweak((s) => { s.site.schedulerEnabled = false; }));
    expect(off.payload.links.booking).toBe('');
    expect(off.payload.rebook).toBe('site');
    expect(off.userText).toContain('open the website (online booking is off)');
    const bare = await prepare(tweak((s) => {
      s.site.schedulerEnabled = false;
      s.site.publishedUrl = '';
      s.project.site_url = '';
    }));
    expect(bare.payload.links.site).toBe('');
    expect(bare.payload.rebook).toBe('call');
    expect(bare.payload.links.vcard).not.toContain('URL:');
  });

  it('notes a custom domain that is not live yet', async () => {
    const { payload } = await prepare(tweak((s) => { s.site.customDomain = 'sampleshine.example'; s.site.domainStatus = 'pending'; }));
    expect(payload.notes).toEqual([
      'The custom domain sampleshine.example isn\'t live yet, so the codes and the printed address use sample-shine.autocaregeniushub.com. Rebuild once the domain is live.',
    ]);
  });

  it('refuses before anything is sent without the site or any way to reach the business', async () => {
    await expect(prepare(tweak((s) => { s.site = null; }))).rejects.toThrow('needs the written site');
    await expect(prepare(tweak((s) => {
      s.site.businessInfo.phone = '';
      s.site.businessInfo.email = '';
      s.site.publishedUrl = '';
      s.site.schedulerEnabled = false;
      s.project.form.contactEmail = '';
    }))).rejects.toThrow('needs a phone number, an email or a live site');
  });

  it('runs without a logo', async () => {
    const { files, payload, userText } = await prepare(tweak((s) => { s.project.assets = []; }));
    expect(files.map((f) => f.name)).toEqual([PRINT_INPUTS_FILE]);
    expect(payload.logo).toBe(null);
    expect(userText).toContain('No logo was sent');
  });
});

// ─── print.json from the skill ────────────────────────────────────────

describe('sanitize', () => {
  const inputs = () => readFixture('sample_inputs.json');
  const ctx = (i = inputs()) => ({ inputs: { printInputs: i } });

  it('stores the Python build of the sample exactly as the skill wrote it', () => {
    const raw = samplePrintFixture();
    if (!raw) return;   // an update run: the Python tests write it next
    expect(spec.sanitize(raw, ctx())).toEqual(raw);
    expect(raw.pieces.map((p) => p.file)).toEqual(['review-hang-tag.pdf', 'counter-card.pdf', 'glovebox-card.pdf', 'business-cards.pdf']);
    expect(raw.pieces.flatMap((p) => p.qr.map((q) => q.kind))).toEqual(['review', 'booking', 'review', 'contact', 'booking', 'site']);
    expect(notes(raw, spec.sanitize(raw, ctx()), ctx())).toEqual(raw.notes);
  });

  it('fails the run when a code points anywhere else', () => {
    const raw = samplePrintFixture();
    if (!raw) return;
    const bad = structuredClone(raw);
    bad.pieces[2].qr[1].url = 'https://evil.example/book';
    expect(() => spec.sanitize(bad, ctx())).toThrow(PrintCheckError);
    expect(() => spec.sanitize(bad, ctx())).toThrow('isn\'t this customer\'s booking page link');
    const vcard = structuredClone(raw);
    vcard.pieces[2].qr[0].vcard = vcard.pieces[2].qr[0].vcard.replace('+15550100199', '+15550100100');
    expect(() => spec.sanitize(vcard, ctx())).toThrow('doesn\'t hold this customer\'s contact card');
    const small = structuredClone(raw);
    small.pieces[3].qr[0].sizeIn = 0.5;
    expect(() => spec.sanitize(small, ctx())).toThrow('under 0.75 in');
  });

  it('fails the run on a review piece without a review link, a missing card or an incentive', () => {
    const raw = samplePrintFixture();
    if (!raw) return;
    const noReview = { ...inputs(), links: { ...inputs().links, review: '' } };
    expect(() => spec.sanitize(raw, ctx(noReview))).toThrow('needs the Google review link');
    const missing = structuredClone(raw);
    missing.pieces = missing.pieces.filter((p) => p.file !== 'business-cards.pdf');
    expect(() => spec.sanitize(missing, ctx())).toThrow('doesn\'t describe business-cards.pdf');
    const bribe = structuredClone(raw);
    bribe.pieces[1].text.push('Leave a review and get 10% off your next detail');
    expect(() => spec.sanitize(bribe, ctx())).toThrow('Google\'s review policy');
    const codeless = structuredClone(raw);
    codeless.pieces[1].qr = [];
    expect(() => spec.sanitize(codeless, ctx())).toThrow('has no review code');
    expect(() => spec.sanitize(raw, {})).toThrow(PrintCheckError);
  });

  it('accepts the glovebox and business cards alone, listing the review pieces as left out', () => {
    const raw = samplePrintFixture();
    if (!raw) return;
    const i = { ...inputs(), links: { ...inputs().links, review: '' } };
    const cards = { ...structuredClone(raw), pieces: raw.pieces.filter((p) => !/review|counter/.test(p.file)), omitted: [] };
    const data = spec.sanitize(cards, ctx(i));
    expect(data.pieces.map((p) => p.file)).toEqual(['glovebox-card.pdf', 'business-cards.pdf']);
    expect(data.omitted.map((o) => o.file)).toEqual(['review-hang-tag.pdf', 'counter-card.pdf']);
  });

  it('adds a note for a printed claim the facts do not back', () => {
    const raw = samplePrintFixture();
    if (!raw) return;
    const claimed = structuredClone(raw);
    claimed.pieces[3].text.push('Voted best in Florida');
    const data = spec.sanitize(claimed, ctx());
    expect(notes(claimed, data, ctx())[0]).toBe('Check before printing: "best" on the business cards isn\'t in the customer\'s answers.');
    // A full list keeps its last lines (the skill puts the server's notes
    // and Claude's own there) and drops its routine first lines instead.
    const full = { ...claimed, notes: ['routine 1', 'routine 2', 'routine 3', 'routine 4', 'routine 5', 'server', 'claude 1', 'claude 2'] };
    const kept = notes(full, spec.sanitize(full, ctx()), ctx());
    expect(kept).toHaveLength(8);
    expect(kept.slice(1)).toEqual(['routine 2', 'routine 3', 'routine 4', 'routine 5', 'server', 'claude 1', 'claude 2']);
  });
});

// ─── The smoke test's strict check ────────────────────────────────────

// A stand-in PDF with the page objects and boxes the check reads.
function fakePdf(pages, w, h) {
  const s = 36;
  const page = `<< /Type /Page /MediaBox [ 0 0 ${w + 2 * s} ${h + 2 * s} ] /TrimBox [ ${s} ${s} ${w + s} ${h + s} ] /BleedBox [ ${s - 9} ${s - 9} ${w + s + 9} ${h + s + 9} ] >>`;
  return Buffer.from(`%PDF-1.4\n<< /Type /Pages /Count ${pages} >>\n${Array(pages).fill(page).join('\n')}\n%%EOF\n`, 'latin1');
}

const SAMPLE_PDFS = () => [
  { name: 'review-hang-tag.pdf', data: fakePdf(3, 252, 612) },
  { name: 'counter-card.pdf', data: fakePdf(1, 288, 432) },
  { name: 'glovebox-card.pdf', data: fakePdf(2, 252, 144) },
  { name: 'business-cards.pdf', data: fakePdf(2, 252, 144) },
];

describe('smokeCheck', () => {
  it('passes the Python build of the sample and catches what it must', () => {
    const raw = samplePrintFixture();
    if (!raw) return;
    const data = sanitizePrint(raw, { inputs: readFixture('sample_inputs.json') });
    expect(smokeCheck(raw, data, SAMPLE_PDFS())).toEqual([]);

    const pdfs = SAMPLE_PDFS();
    pdfs[0].data = fakePdf(2, 252, 612);
    pdfs[2].data = fakePdf(2, 252, 150);
    expect(smokeCheck(raw, data, pdfs.slice(0, 3))).toEqual([
      'review-hang-tag.pdf has 2 pages, not 3',
      'glovebox-card.pdf: TrimBox isn\'t 3.5 x 2 in',
      'glovebox-card.pdf: BleedBox isn\'t the trim plus 0.125 in',
      'business-cards.pdf didn\'t come back',
    ]);
    const voted = structuredClone(raw);
    voted.pieces[3].text.push('Voted #1 in Florida');
    const p = smokeCheck(voted, sanitizePrint(voted, { inputs: readFixture('sample_inputs.json') }), SAMPLE_PDFS());
    expect(p).toContain('the intake\'s planted "Voted #1" line was printed');
  });
});

// ─── One run through production's buildKitRun ────────────────────────

function fakeClient(outputsByName) {
  const uploads = [];
  const deleted = [];
  const outputs = {};
  Object.entries(outputsByName).forEach(([filename, data], i) => { outputs[`file_out_${i + 1}`] = { filename, data }; });
  return {
    uploads,
    deleted,
    files: {
      upload: vi.fn(async ({ file }) => {
        uploads.push({ name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) });
        return { id: `file_in_${uploads.length}` };
      }),
      retrieveMetadata: vi.fn(async (id) => ({ id, filename: outputs[id]?.filename || '', size_bytes: outputs[id]?.data.length || 0 })),
      download: vi.fn(async (id) => ({ arrayBuffer: async () => outputs[id].data })),
      delete: vi.fn(async (id) => { deleted.push(id); return { id }; }),
    },
    messages: {
      stream: vi.fn(() => ({
        finalMessage: async () => ({
          model: 'claude-opus-5-5',
          stop_reason: 'end_turn',
          container: { id: 'cntr_print' },
          usage: { input_tokens: 12000, output_tokens: 5000 },
          content: [{
            type: 'bash_code_execution_tool_result',
            tool_use_id: 'srvtoolu_1',
            content: {
              type: 'bash_code_execution_result', stdout: '', stderr: '', return_code: 0,
              content: Object.keys(outputs).map((id) => ({ type: 'bash_code_execution_output', file_id: id })),
            },
          }],
        }),
      })),
    },
  };
}

describe('a run', () => {
  it('uploads the inputs, takes print.json and the PDFs back, stores what the server checked', async () => {
    const raw = samplePrintFixture();
    if (!raw) return;
    const sample = smokeSample();
    const outputs = { 'print.json': Buffer.from(JSON.stringify(raw)) };
    for (const p of SAMPLE_PDFS()) outputs[p.name] = p.data;
    const client = fakeClient(outputs);
    const result = await buildKitRun({
      db: sampleDb(sample.files), client, project: sample.project, site: sample.site, key: 'print', spec: KIT_SPECS.print,
      skill: { type: 'custom', skill_id: 'skill_01Print', version: '1759700000000000' },
      deadline: NOW + KIT_BUDGET_MS, nowMs: () => NOW, fetchImpl: noNetwork,
    });
    expect(client.uploads.map((u) => [u.name, u.type])).toEqual([[PRINT_INPUTS_FILE, 'application/json'], ['logo-1.png', 'image/png']]);
    const body = client.messages.stream.mock.calls[0][0];
    expect(body.container.skills).toEqual([{ type: 'custom', skill_id: 'skill_01Print', version: '1759700000000000' }]);
    // Only the logo is shown as an image.
    expect(body.messages[0].content.filter((b) => b.type === 'image')).toHaveLength(1);
    const sent = JSON.parse(client.uploads[0].bytes);
    expect(sent.links).toEqual(readFixture('sample_inputs.json').links);
    expect(result.data).toEqual(raw);
    expect(result.outputs.map((o) => o.name)).toEqual(['print.json', 'review-hang-tag.pdf', 'counter-card.pdf', 'glovebox-card.pdf', 'business-cards.pdf']);
    expect(result.notes).toEqual(raw.notes);
    expect(result.warnings.some((w) => /font files could not be fetched/.test(w))).toBe(true);
    expect(client.deleted.length).toBe(2 + 5);
  });

  it('fails the run when print.json names a code the server did not send', async () => {
    const raw = samplePrintFixture();
    if (!raw) return;
    const bad = structuredClone(raw);
    bad.pieces[0].qr[0].url = 'https://search.google.com/local/writereview?placeid=SomeoneElse0001';
    const sample = smokeSample();
    const outputs = { 'print.json': Buffer.from(JSON.stringify(bad)) };
    for (const p of SAMPLE_PDFS()) outputs[p.name] = p.data;
    await expect(buildKitRun({
      db: sampleDb(sample.files), client: fakeClient(outputs), project: sample.project, site: sample.site, key: 'print', spec: KIT_SPECS.print,
      skill: { type: 'custom', skill_id: 'skill_01Print', version: '1' }, deadline: NOW + KIT_BUDGET_MS, nowMs: () => NOW, fetchImpl: noNetwork,
    })).rejects.toThrow('print.json could not be checked: print.json: the "Scan to leave a Google review" code on review-hang-tag.pdf points to');
  });
});

describe('buildPrintInputs', () => {
  it('builds the same links as a run from liveUrls', () => {
    const { project, site } = smokeSample();
    const a = buildPrintInputs({ project, site, urls: liveUrls(project, site) });
    expect(a.links).toEqual(readFixture('sample_inputs.json')?.links || a.links);
    expect(a.look).toEqual({ palette: null, fonts: { heading: '', body: '' }, source: { palette: 'none', fonts: 'none' }, logoHasText: null });
  });
});
