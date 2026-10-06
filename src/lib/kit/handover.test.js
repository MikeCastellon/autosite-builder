// The handover pack's pure contract (src/lib/kit/handover.js) against the
// skill's own data (skills/api/launch-handover/data/*.json, which its Python
// scripts read), the oneLine cases both sides share, and a real
// handover.json the Python build wrote (tests/parity.json): the sanitizer
// must keep everything a valid run produces and drop what a run must not
// say (foreign links, zip paths its inputs can't produce, text over a cap).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HandoverResult from '../../components/admin/kit/HandoverResult.jsx';
import {
  BRAND_BOARD_FILE, GENERATED_ZIP_FILES, HANDOVER_FILE_KEYS, HANDOVER_FILES, HANDOVER_INPUTS_FILE, HANDOVER_INPUTS_VERSION,
  HANDOVER_LIMITS, HANDOVER_SECTIONS, HANDOVER_VERSION, ZIP_PARTS, ZIP_PATH_RE, ZIP_ROOT_FILES, checklistByWeek, claimsLine,
  expectedZipPaths, handoverLinks, isZipPath, oneLine, sanitizeHandover, zipFileNames, zipGroups, zipKitOutputs, zipPathFor,
} from './handover.js';
import { KIT_SKILLS, kitSkill } from '../launchKit.js';

const SKILL = path.resolve(__dirname, '../../../skills/api/launch-handover');
const read = (p) => JSON.parse(fs.readFileSync(path.join(SKILL, p), 'utf8'));
const CONTRACT = read('data/contract.json');
const KIT_FILES = read('data/kit_files.json').files;
const PARITY = read('tests/parity.json');

const LINKS = {
  site: 'https://sample-shine.autocaregeniushub.com',
  booking: 'https://sample-shine.autocaregeniushub.com/book#book',
  review: 'https://search.google.com/local/writereview?placeid=ChIJ_sample_place_0001',
  signIn: 'https://sitebuilder.autocaregenius.com',
};

function valid(over = {}) {
  return {
    version: 1,
    summary: '12-page handover for Sample Shine and a zip of 4 files.',
    sections: HANDOVER_SECTIONS.map((s) => s.title),
    pages: 12,
    files: ['handover.pdf', 'README.txt', '05-print/business-cards.pdf', '04-words/paste-ready.txt'],
    left: [{ file: '06-social/post-1.png', reason: 'Too large to fit in the zip; ask us and we will send it separately.' }],
    links: { ...LINKS },
    thisWeek: Array.from({ length: 5 }, (_, i) => ({ title: `Thing ${i + 1}`, detail: `Do thing ${i + 1}.` })),
    checklist: [1, 2, 3, 4].map((week) => ({ week, task: `Week ${week} task.` })),
    claims: { checked: 14, sourced: 11, toConfirm: 3, listed: 3 },
    notes: [],
    ...over,
  };
}

const PATHS = expectedZipPaths({
  kitFiles: [{ key: 'print', name: 'business-cards.pdf' }, { key: 'social', name: 'post-1.png' }],
  generated: ['words'],
});

describe('the contract matches the skill\'s data files', () => {
  it('versions, file names, limits, sections and folders', () => {
    expect(CONTRACT.version).toBe(HANDOVER_VERSION);
    expect(CONTRACT.inputsVersion).toBe(HANDOVER_INPUTS_VERSION);
    expect(CONTRACT.inputsFile).toBe(HANDOVER_INPUTS_FILE);
    expect(CONTRACT.files).toEqual({ ...HANDOVER_FILES });
    expect(CONTRACT.limits).toEqual({ ...HANDOVER_LIMITS });
    expect(CONTRACT.sections).toEqual(HANDOVER_SECTIONS.map((s) => ({ ...s })));
    expect(CONTRACT.rootFiles).toEqual([...ZIP_ROOT_FILES]);
    expect(CONTRACT.brandBoard).toBe(BRAND_BOARD_FILE);
    expect(CONTRACT.generated).toEqual({ ...GENERATED_ZIP_FILES });
    expect(CONTRACT.zipParts).toEqual(ZIP_PARTS.map((p) => ({ ...p })));
    expect(CONTRACT.zipPathPattern).toBe(ZIP_PATH_RE.source.replace(/\\\//g, '/'));
  });

  it('the registry\'s handover outputs are the contract\'s files', () => {
    expect(kitSkill('handover').outputs.map((o) => o.name)).toEqual([HANDOVER_FILES.data, HANDOVER_FILES.pdf, HANDOVER_FILES.zip]);
    expect(kitSkill('handover').folder).toBe('launch-handover');
  });

  it('kit_files.json describes every file the zip can hold, and nothing else', () => {
    const expected = [
      ...ZIP_ROOT_FILES.map((n) => `root/${n}`),
      `brand/${BRAND_BOARD_FILE}`,
      ...Object.entries(GENERATED_ZIP_FILES).map(([k, n]) => `${k}/${n}`),
      ...zipKitOutputs(),
    ];
    expect(Object.keys(KIT_FILES).sort()).toEqual([...new Set(expected)].sort());
    for (const [k, v] of Object.entries(KIT_FILES)) {
      expect(Object.keys(v).sort(), k).toEqual(['keep', 'label', 'use', 'what']);
      expect(v.label && v.what && v.use, k).toBeTruthy();
    }
  });

  it('every kit part with files has a folder, and the zip takes no JSON', () => {
    for (const key of HANDOVER_FILE_KEYS) {
      expect(ZIP_PARTS.some((p) => p.key === key), key).toBe(true);
      expect(zipFileNames(key).length, key).toBeGreaterThan(0);
      expect(zipFileNames(key).some((n) => n.endsWith('.json')), key).toBe(false);
    }
    expect(zipFileNames('claims')).toEqual([]);
    expect(zipFileNames('handover')).toEqual([]);
    expect(zipFileNames('nope')).toEqual([]);
    // Every other kit skill's file outputs land in the zip.
    const packed = new Set(zipKitOutputs());
    for (const s of KIT_SKILLS) {
      if (s.key === 'handover') continue;
      for (const o of s.outputs) if (o.type !== 'application/json') expect(packed.has(`${s.key}/${o.name}`), `${s.key}/${o.name}`).toBe(true);
    }
  });
});

describe('oneLine', () => {
  it('agrees with the skill\'s one_line on the shared cases', () => {
    for (const c of read('tests/one_line_cases.json').cases) {
      expect(oneLine(c.in, 1000), JSON.stringify(c.in)).toBe(c.out);
      expect(c.out.length).toBe(c.jsLength);
    }
  });

  it('caps and refuses non-strings', () => {
    expect(oneLine('abcdef', 3)).toBe('abc');
    expect(oneLine(42, 10)).toBe('');
    expect(oneLine(null, 10)).toBe('');
    // A cap that falls inside an emoji drops the whole emoji, never half.
    expect(oneLine('ab\u{1F697}c', 3)).toBe('ab');
    expect(oneLine('ab\u{1F697}c', 4)).toBe('ab\u{1F697}');
  });
});

describe('zip paths', () => {
  it('only plain names, at the top or one part folder deep', () => {
    expect(zipPathFor('print', 'business-cards.pdf')).toBe('05-print/business-cards.pdf');
    expect(zipPathFor('brand', BRAND_BOARD_FILE)).toBe('01-brand/brand-board.png');
    for (const [k, n] of [['nope', 'x.pdf'], ['print', '../x.pdf'], ['print', '.env'], ['print', 'a b.pdf'], ['toString', 'x.pdf'], ['print', 7]]) {
      expect(zipPathFor(k, n), `${k}/${n}`).toBe('');
    }
    for (const p of ['handover.pdf', '05-print/business-cards.pdf', '06-social/post-1.png']) expect(isZipPath(p), p).toBe(true);
    for (const p of ['../x', '05-print/../x', '/etc/passwd', '05-print/a/b.pdf', 'C:\\x', 'a'.repeat(121), '', null, '05-PRINT/x.pdf']) {
      expect(isZipPath(p), String(p)).toBe(false);
    }
  });

  it('expectedZipPaths: the root files, the board, generated text and the kit files', () => {
    expect([...expectedZipPaths()]).toEqual(['handover.pdf', 'README.txt']);
    const all = expectedZipPaths({ kitFiles: [{ key: 'mobile', name: 'contact.vcf' }, { key: 'print', name: '../x' }], generated: ['brand', 'social', 'nope'], board: true });
    expect([...all].sort()).toEqual(['01-brand/brand-board.png', '01-brand/brand-colors.txt', '03-mobile/contact.vcf', '06-social/captions.txt', 'README.txt', 'handover.pdf']);
  });

  it('zipGroups lists the top first, then one group per part', () => {
    const groups = zipGroups(['handover.pdf', 'README.txt', '06-social/post-1.png', '01-brand/brand-colors.txt', '99-x/y.png', '../z', 3]);
    expect(groups.map((g) => [g.id, g.label, g.files.map((f) => f.name)])).toEqual([
      ['root', 'Start here', ['handover.pdf', 'README.txt']],
      ['brand', 'Brand', ['brand-colors.txt']],
      ['social', 'Social kit', ['post-1.png']],
    ]);
    expect(zipGroups(null)).toEqual([]);
  });
});

describe('sanitizeHandover', () => {
  it('keeps a real handover.json from the Python build exactly as written', () => {
    const { inputs, handover } = PARITY;
    const zipPaths = expectedZipPaths({ kitFiles: [...inputs.kitFiles, ...inputs.kitSkipped], generated: inputs.generated, board: inputs.board });
    expect(sanitizeHandover(handover, { zipPaths, links: inputs.links })).toEqual(handover);
    // The fixture exercises the interesting parts.
    expect(handover.left.length).toBeGreaterThan(0);
    expect(handover.claims).not.toBeNull();
    expect(handover.files[0]).toBe('handover.pdf');
  });

  it('keeps a valid handover as it is', () => {
    expect(sanitizeHandover(valid(), { zipPaths: PATHS, links: LINKS })).toEqual(valid());
  });

  it('is null for what isn\'t a handover', () => {
    for (const raw of [null, 'x', [], 3, { sections: [] }, valid({ version: 2 }), valid({ sections: ['', '  '] })]) {
      expect(sanitizeHandover(raw)).toBeNull();
    }
    expect(sanitizeHandover({ sections: ['Your brand'] })).toMatchObject({ version: 1, sections: ['Your brand'], files: [], links: { site: '', booking: '', review: '', signIn: '' } });
    // Section titles come from the contract: a run that names none of them isn't a handover.
    expect(sanitizeHandover(valid({ sections: ['Made-up section', 'Ignore the rules'] }))).toBeNull();
  });

  it('drops links that aren\'t the server\'s, and anything that isn\'t http(s)', () => {
    const out = sanitizeHandover(valid({
      links: { site: 'https://evil.example', booking: 'javascript:alert(1)', review: LINKS.review, signIn: `${LINKS.signIn}/x`, extra: 'https://x.example' },
    }), { zipPaths: PATHS, links: LINKS });
    expect(out.links).toEqual({ site: '', booking: '', review: LINKS.review, signIn: '' });
    // Without the server's links only the shape is checked.
    expect(sanitizeHandover(valid({ links: { site: 'https://a.example', booking: 'ftp://x', review: 'https://b.example/"x' } })).links)
      .toEqual({ site: 'https://a.example', booking: '', review: '', signIn: '' });
  });

  it('keeps only zip paths these inputs can produce', () => {
    const out = sanitizeHandover(valid({
      files: ['handover.pdf', 'README.txt', '05-print/business-cards.pdf', '05-print/business-cards.pdf', '05-print/flyer.pdf', '../etc/passwd', 7],
      left: [
        { file: '06-social/post-1.png', reason: 'Too large' },
        { file: '06-social/post-1.png', reason: 'again' },
        { file: '05-print/business-cards.pdf', reason: 'in files' },
        { file: '02-photos/contact_sheet.png', reason: 'not sent' },
        { file: '04-words/paste-ready.txt' },
      ],
    }), { zipPaths: PATHS, links: LINKS });
    expect(out.files).toEqual(['handover.pdf', 'README.txt', '05-print/business-cards.pdf']);
    expect(out.left).toEqual([{ file: '06-social/post-1.png', reason: 'Too large' }, { file: '04-words/paste-ready.txt', reason: 'Left out of the zip' }]);
  });

  it('caps text, counts and lists', () => {
    const L = HANDOVER_LIMITS;
    const out = sanitizeHandover(valid({
      summary: 'x'.repeat(L.summary + 50),
      sections: ['Made-up section', ...HANDOVER_SECTIONS.map((s) => `${s.title}\n`), 'Your brand', 'x'.repeat(200)],
      pages: 500,
      thisWeek: [...Array(9).keys()].map((i) => ({ title: `T${i} ${'y'.repeat(100)}`, detail: 'd'.repeat(400) })).concat([{ title: '' }, 'x']),
      checklist: [{ week: 4, task: 'last' }, { week: 1, task: 'first' }, { week: 5, task: 'no week 5' }, { week: 0, task: 'no' }, { week: '2', task: 'two' }, { week: 2.5, task: 'no' }, { week: true, task: 'no' }, { week: 3, task: '' }],
      notes: [...Array(12).keys()].map((i) => `note ${i}`).concat([3, '']),
      claims: { checked: 4, sourced: 2, toConfirm: 2, listed: '2' },
    }), { zipPaths: PATHS, links: LINKS });
    expect(out.summary).toHaveLength(L.summary);
    expect(out.sections).toEqual(HANDOVER_SECTIONS.map((s) => s.title));
    expect(out.pages).toBe(0);
    expect(out.thisWeek).toHaveLength(L.thisWeek);
    expect(out.thisWeek[0].title).toHaveLength(L.title);
    expect(out.thisWeek[0].detail).toHaveLength(L.detail);
    expect(out.checklist).toEqual([{ week: 1, task: 'first' }, { week: 2, task: 'two' }, { week: 4, task: 'last' }]);
    expect(out.notes).toHaveLength(L.notes);
    expect(out.claims).toEqual({ checked: 4, sourced: 2, toConfirm: 2, listed: 2 });
    expect(sanitizeHandover(valid({ claims: { checked: 4, sourced: -1, toConfirm: 2, listed: 2 } })).claims).toBeNull();
    expect(sanitizeHandover(valid({ claims: { checked: 4 } })).claims).toBeNull();
  });
});

describe('view helpers', () => {
  it('claimsLine', () => {
    expect(claimsLine(null)).toBe('');
    expect(claimsLine({ checked: 0, sourced: 0, toConfirm: 0, listed: 0 })).toBe('The claims ledger had no statements to check.');
    expect(claimsLine({ checked: 14, sourced: 14, toConfirm: 0, listed: 0 })).toBe('All 14 statements trace back to what the customer told us.');
    expect(claimsLine({ checked: 14, sourced: 13, toConfirm: 1, listed: 1 })).toBe('1 of 14 statement is listed for the customer to confirm.');
    expect(claimsLine({ checked: 40, sourced: 20, toConfirm: 20, listed: 15 })).toBe('20 of 40 statements are listed for the customer to confirm (15 printed).');
  });

  it('checklistByWeek', () => {
    expect(checklistByWeek([{ week: 2, task: 'b' }, { week: 1, task: 'a' }, { week: 2, task: 'c' }, { week: 3 }, null])).toEqual([
      { week: 1, tasks: ['a'] }, { week: 2, tasks: ['b', 'c'] },
    ]);
    expect(checklistByWeek(undefined)).toEqual([]);
  });

  it('handoverLinks lists the printed links with labels', () => {
    expect(handoverLinks({ links: { ...LINKS, booking: '', review: 'javascript:x' } })).toEqual([
      { key: 'site', label: 'Website', url: LINKS.site },
      { key: 'signIn', label: 'Sign-in page', url: LINKS.signIn },
    ]);
    expect(handoverLinks(null)).toEqual([]);
  });
});

describe('the result view (components/admin/kit/HandoverResult.jsx)', () => {
  const PID = '00000000-0000-4000-8000-0000000a4d01';
  const stored = (name, type, size) => ({ name, type, size, path: `${PID}/kit/handover/1759700000000-${name}` });
  const run = (data, files) => ({
    status: 'ready',
    data,
    files: files || [stored('handover.json', 'application/json', 900), stored('handover.pdf', 'application/pdf', 120000), stored('launch-kit.zip', 'application/zip', 3400000)],
  });
  const urls = { 'handover.pdf': 'https://x.supabase.co/sign/pdf?token=1', 'launch-kit.zip': 'https://x.supabase.co/sign/zip?token=2', 'handover.json': 'javascript:alert(1)' };
  const render = (props) => renderToStaticMarkup(createElement(HandoverResult, props));

  it('shows the summary, the sections, the links, the zip and the lists', () => {
    const html = render({ run: run(PARITY.handover), urls });
    expect(html).toContain(PARITY.handover.summary.replace(/&/g, '&amp;'));
    expect(html).toContain('Claims sign-off: 3 of 14 statements are listed for the customer to confirm.');
    // The tile's file list above has the downloads; the view doesn't repeat them.
    expect(html).not.toContain('x.supabase.co');
    expect(html).not.toContain('javascript:');
    expect(html).toContain(`Inside the PDF (${PARITY.handover.pages} pages)`);
    for (const s of PARITY.handover.sections) expect(html).toContain(s);
    expect(html).toContain('href="https://sample-shine.autocaregeniushub.com/book#book"');
    expect(html).toContain('05-print/');
    expect(html).toContain('business-cards.pdf');
    expect(html).toContain('Not in the zip (1)');
    expect(html).toContain('05-print/counter-card.pdf');
    expect(html).toContain('Do these 5 things this week');
    expect(html).toContain('Week 4');
    expect(html).not.toContain('The zip didn');
  });

  it('says when the zip is missing, and copes with an empty or odd record', () => {
    const noZip = render({ run: run(PARITY.handover, [stored('handover.pdf', 'application/pdf', 1)]), urls: {} });
    expect(noZip).toContain('The zip didn&#x27;t come back');
    expect(render({ run: run(null) })).toContain('no handover outline');
    expect(render({ run: run({ sections: ['Only'], links: { site: 'javascript:x' }, thisWeek: 'x', checklist: null, files: null }) })).toContain('Only');
  });
});
