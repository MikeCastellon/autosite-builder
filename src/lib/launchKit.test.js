import { describe, it, expect } from 'vitest';
import {
  KIT_BUDGET_MS, KIT_KEYS, KIT_NEED_LABELS, KIT_SKILLS, KIT_STALE_MS, KIT_TIERS, failedKitRun, isKitFilePath, isKitKey,
  isKitRunLive, isKitRunStale, isSameKitClaim, kitEnvNames, kitFilePath, kitMissingNeeds, kitNeedLabel, kitNeedMet, kitOf,
  kitOutput, kitRunOf, kitRunState, kitSkill, kitUsage, parseKitFilePath, sanitizeKitRun,
} from './launchKit.js';

const PID = '11111111-2222-4333-8444-555555555555';
const NOW = Date.parse('2026-10-05T12:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

describe('KIT_SKILLS', () => {
  it('has the seven skills of the contract, with their folders, env prefixes and outputs', () => {
    expect(KIT_KEYS).toEqual(['photos', 'mobile', 'words', 'claims', 'print', 'social', 'handover']);
    const rows = Object.fromEntries(KIT_SKILLS.map((s) => [s.key, [s.folder, s.envPrefix, s.outputs.map((o) => o.name)]]));
    expect(rows).toEqual({
      photos: ['launch-photo-desk', 'CUSTOM_SITE_KIT_PHOTOS', ['photos.json', 'contact_sheet.png']],
      mobile: ['launch-mobile-kit', 'CUSTOM_SITE_KIT_MOBILE', ['mobile.json', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'favicon-32.png', 'contact.vcf']],
      words: ['launch-words', 'CUSTOM_SITE_KIT_WORDS', ['words.json', 'words.pdf']],
      claims: ['launch-claims-ledger', 'CUSTOM_SITE_KIT_CLAIMS', ['ledger.json']],
      print: ['launch-print-studio', 'CUSTOM_SITE_KIT_PRINT', ['print.json', 'review-hang-tag.pdf', 'counter-card.pdf', 'glovebox-card.pdf', 'business-cards.pdf']],
      social: ['launch-social-kit', 'CUSTOM_SITE_KIT_SOCIAL', ['social.json', 'share-1200x630.png', 'facebook-cover.png', 'profile-800.png', 'post-1.png', 'post-2.png', 'post-3.png', 'story-1080x1920.png']],
      handover: ['launch-handover', 'CUSTOM_SITE_KIT_HANDOVER', ['handover.json', 'handover.pdf', 'launch-kit.zip']],
    });
  });

  it('every entry is complete and consistent', () => {
    const tiers = KIT_TIERS.map((t) => t.id);
    for (const s of KIT_SKILLS) {
      // Skill names: <= 64, lowercase/digits/hyphens, no reserved words.
      expect(s.folder).toMatch(/^[a-z0-9-]{1,64}$/);
      expect(s.folder).not.toMatch(/claude|anthropic/);
      expect(tiers).toContain(s.tier);
      expect(s.label && s.blurb && s.estimate).toBeTruthy();
      expect(s.estimate).toMatch(/^about \$/);
      // The JSON comes first, is required and is the data file.
      expect(s.outputs[0]).toMatchObject({ type: 'application/json', required: true });
      expect(s.dataFile).toBe(s.outputs[0].name);
      expect(new Set(s.outputs.map((o) => o.name)).size).toBe(s.outputs.length);
      for (const o of s.outputs) {
        expect(o.name).toMatch(/^[A-Za-z0-9._-]{1,80}$/);
        expect(typeof o.required).toBe('boolean');
        expect(o.label).toBeTruthy();
      }
      for (const n of [...s.needs, ...s.uses]) {
        expect(isKitKey(n) || Object.hasOwn(KIT_NEED_LABELS, n)).toBe(true);
        expect(n).not.toBe(s.key);
      }
      expect(Object.isFrozen(s) && Object.isFrozen(s.outputs)).toBe(true);
    }
  });

  it('looks skills and outputs up by own keys only', () => {
    expect(isKitKey('photos')).toBe(true);
    for (const bad of ['toString', '__proto__', 'constructor', 'brand', '', null, 3]) expect(isKitKey(bad)).toBe(false);
    expect(kitSkill('nope')).toBeNull();
    expect(kitOutput('social', 'share-1200x630.png')).toMatchObject({ type: 'image/png', px: [1200, 630], required: true });
    expect(kitOutput('social', 'brand.json')).toBeNull();
    expect(kitEnvNames('print')).toEqual({ id: 'CUSTOM_SITE_KIT_PRINT_SKILL_ID', version: 'CUSTOM_SITE_KIT_PRINT_SKILL_VERSION' });
    expect(kitEnvNames('x')).toBeNull();
    expect(kitNeedLabel('site')).toBe('the written site');
    expect(kitNeedLabel('words')).toBe('Words');
  });
});

describe('runs', () => {
  it('has the contract budget and stale times', () => {
    expect(KIT_BUDGET_MS).toBe(11 * 60 * 1000);
    expect(KIT_STALE_MS).toBe(14 * 60 * 1000);
  });

  it('tells live, stale and the same claim apart, comparing instants', () => {
    const run = { status: 'running', startedAt: ago(60 * 1000) };
    expect(isKitRunLive(run, NOW)).toBe(true);
    expect(isKitRunStale(run, NOW)).toBe(false);
    const old = { status: 'running', startedAt: ago(15 * 60 * 1000) };
    expect(isKitRunLive(old, NOW)).toBe(false);
    expect(isKitRunStale(old, NOW)).toBe(true);
    expect(isKitRunStale({ status: 'running' }, NOW)).toBe(true);
    expect(isKitRunStale({ status: 'ready', startedAt: ago(99e6) }, NOW)).toBe(false);
    expect(isKitRunLive(null, NOW)).toBe(false);

    const claim = { status: 'running', startedAt: '2026-10-05T12:00:00.000Z' };
    expect(isSameKitClaim(claim, '2026-10-05T12:00:00+00:00')).toBe(true);
    expect(isSameKitClaim(claim, '2026-10-05T12:00:01.000Z')).toBe(false);
    expect(isSameKitClaim({ ...claim, status: 'ready' }, claim.startedAt)).toBe(false);
    expect(isSameKitClaim(claim, '')).toBe(false);
    expect(isSameKitClaim(claim, 'garbage')).toBe(false);
  });

  it('kitRunState', () => {
    expect(kitRunState(null, NOW)).toBe('idle');
    expect(kitRunState({ status: 'running', startedAt: ago(1000) }, NOW)).toBe('running');
    expect(kitRunState({ status: 'running', startedAt: ago(20 * 60 * 1000) }, NOW)).toBe('stale');
    expect(kitRunState({ status: 'ready', data: { a: 1 } }, NOW)).toBe('ready');
    expect(kitRunState({ status: 'ready', data: null }, NOW)).toBe('failed');
    expect(kitRunState({ status: 'failed' }, NOW)).toBe('failed');
    expect(kitRunState({ status: 'weird' }, NOW)).toBe('idle');
  });

  it('failedKitRun and kitUsage', () => {
    const f = failedKitRun({ startedAt: 'a', finishedAt: 'b', error: `x\n${'y'.repeat(900)}`, usage: { input_tokens: 10.4, output_tokens: -3 } });
    expect(f).toMatchObject({ status: 'failed', startedAt: 'a', finishedAt: 'b', files: [], data: null, notes: [], warnings: [], usage: { input_tokens: 10, output_tokens: 0 } });
    expect(f.error.length).toBe(500);
    expect(f.error.startsWith('x y')).toBe(true);
    expect(failedKitRun({}).error).toBe('Something went wrong');
    expect(kitUsage(null)).toEqual({ input_tokens: 0, output_tokens: 0 });
  });
});

describe('stored files', () => {
  it('kitFilePath and its parser agree, for the skill\'s own output names only', () => {
    const path = kitFilePath(PID, 'print', 'business-cards.pdf', 1759665600000.4);
    expect(path).toBe(`${PID}/kit/print/1759665600000-business-cards.pdf`);
    expect(parseKitFilePath(PID, path)).toEqual({ key: 'print', ms: 1759665600000, name: 'business-cards.pdf' });
    expect(isKitFilePath(PID, path)).toBe(true);
    expect(isKitFilePath(PID, path, 'print')).toBe(true);
    expect(isKitFilePath(PID, path, 'social')).toBe(false);
    // Another project, a customer upload, a name the skill doesn't write, traversal.
    expect(isKitFilePath('22222222-2222-4333-8444-555555555555', path)).toBe(false);
    expect(isKitFilePath(PID, `${PID}/photo/aaaaaaaa-bbbb-4ccc-8ddd-000000000001.jpg`)).toBe(false);
    expect(isKitFilePath(PID, `${PID}/kit/print/1-evil.pdf`)).toBe(false);
    expect(isKitFilePath(PID, `${PID}/kit/print/1-../../x/business-cards.pdf`)).toBe(false);
    expect(isKitFilePath(PID, `${PID}/kit/print/business-cards.pdf`)).toBe(false);
    expect(isKitFilePath(PID, `${PID}/kit/toString/1-business-cards.pdf`)).toBe(false);
    expect(isKitFilePath('', path)).toBe(false);
  });
});

describe('sanitizeKitRun', () => {
  const good = {
    status: 'ready',
    startedAt: '2026-10-05T12:00:00.000Z',
    finishedAt: '2026-10-05T12:04:00+00:00',
    model: 'claude-opus-5-5',
    skillVersion: 'skver_01',
    files: [
      { name: 'print.json', path: `${PID}/kit/print/5-print.json`, type: 'application/json', size: 120 },
      { name: 'business-cards.pdf', path: `${PID}/kit/print/5-business-cards.pdf`, type: 'application/pdf', size: 5000.6 },
      { name: 'business-cards.pdf', path: `${PID}/kit/print/6-business-cards.pdf`, type: 'application/pdf', size: 1 },
      { name: 'brand.json', path: `${PID}/kit/print/5-brand.json` },
      { name: 'counter-card.pdf', path: `${PID}/photo/x.pdf` },
      { name: 'glovebox-card.pdf', path: `${PID}/kit/social/5-glovebox-card.pdf` },
      'junk',
    ],
    data: { pieces: [] },
    usage: { input_tokens: 5, output_tokens: 6 },
    notes: ['one', 2, '', 'two\nlines', ...Array(10).fill('more')],
    warnings: ['w'],
    error: null,
    extra: 'dropped',
  };

  it('keeps the contract fields, only this skill\'s files at this project\'s paths', () => {
    const run = sanitizeKitRun(good, { projectId: PID, key: 'print' });
    expect(Object.keys(run).sort()).toEqual(['data', 'error', 'files', 'finishedAt', 'model', 'notes', 'skillVersion', 'startedAt', 'status', 'usage', 'warnings']);
    expect(run.files).toEqual([
      { name: 'print.json', path: `${PID}/kit/print/5-print.json`, type: 'application/json', size: 120 },
      { name: 'business-cards.pdf', path: `${PID}/kit/print/5-business-cards.pdf`, type: 'application/pdf', size: 5001 },
    ]);
    expect(run.notes).toEqual(['one', 'two lines', 'more', 'more', 'more', 'more', 'more', 'more']);
    expect(run.data).toEqual({ pieces: [] });
    expect(run.error).toBeNull();
    expect(run.finishedAt).toBe('2026-10-05T12:04:00+00:00');
  });

  it('refuses what isn\'t a run, and blanks bad fields', () => {
    expect(sanitizeKitRun(null)).toBeNull();
    expect(sanitizeKitRun({ status: 'done' })).toBeNull();
    expect(sanitizeKitRun([])).toBeNull();
    const run = sanitizeKitRun({ status: 'running', startedAt: 'not a time', data: [1], model: 7 });
    expect(run).toMatchObject({ status: 'running', startedAt: null, data: null, model: null, files: [], error: null });
  });
});

describe('needs', () => {
  const project = (extra = {}) => ({ id: PID, site_id: null, design: {}, ...extra });

  it('site, brand and other kit runs', () => {
    expect(kitNeedMet('site', project())).toBe(false);
    expect(kitNeedMet('site', project({ site_id: 'abc' }))).toBe(true);
    expect(kitNeedMet('site', project({ design: { siteId: 'abc' } }))).toBe(true);
    expect(kitNeedMet('brand', project({ design: { brand: { status: 'running' } } }))).toBe(false);
    expect(kitNeedMet('brand', project({ design: { brand: { status: 'ready' } } }))).toBe(true);
    expect(kitNeedMet('words', project({ design: { kit: { words: { status: 'ready', data: {} } } } }))).toBe(true);
    expect(kitNeedMet('words', project({ design: { kit: { words: { status: 'ready', data: null } } } }))).toBe(false);
    expect(kitNeedMet('nope', project())).toBe(false);

    expect(kitMissingNeeds('mobile', project())).toEqual([{ id: 'site', label: 'the written site' }]);
    expect(kitMissingNeeds('mobile', project({ site_id: 'abc' }))).toEqual([]);
    expect(kitMissingNeeds('photos', project())).toEqual([]);
    expect(kitMissingNeeds('nope', project())).toEqual([]);
  });

  it('kitOf keeps registry keys with record objects only', () => {
    const p = project({ design: { kit: { words: { status: 'ready' }, toString: { status: 'ready' }, print: 'x' } } });
    expect(kitOf(p)).toEqual({ words: { status: 'ready' } });
    expect(kitRunOf(p, 'words')).toEqual({ status: 'ready' });
    expect(kitRunOf(p, 'print')).toBeNull();
    expect(kitOf({})).toEqual({});
  });
});
