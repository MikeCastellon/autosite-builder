import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// supabase.js throws at import without env vars: a fake signed-in session.
let session = { access_token: 'tok-123' };
vi.mock('./supabase.js', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session } }) } },
}));

const {
  KIT_FN, formatFileSize, getKit, isNotSetUp, kitBuildConfirm, kitFiles, kitReadyRuns, kitResponse, kitRunError,
  kitRunNotes, kitTile, mergeKit, newerKitRun, projectWithKit, safeFileUrl, startKitRun,
} = await import('./customSiteKit.js');
const { KIT_SKILLS } = await import('./launchKit.js');
const { default: LaunchKitPanel, resultViewPath } = await import('../components/admin/LaunchKitPanel.jsx');
const { default: AlertProvider } = await import('../components/ui/AlertProvider.jsx');

const PID = '11111111-2222-4333-8444-555555555555';
const NOW = Date.parse('2026-10-05T20:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const kpath = (key, name) => `${PID}/kit/${key}/1759600000000-${name}`;

const READY_MOBILE = {
  status: 'ready', startedAt: ago(600000), finishedAt: ago(400000), model: 'claude-opus-5-5', data: { themeColor: '#e11d2e' },
  files: [
    { name: 'contact.vcf', path: kpath('mobile', 'contact.vcf'), type: 'text/vcard', size: 120 },
    { name: 'mobile.json', path: kpath('mobile', 'mobile.json'), type: 'application/json', size: 2048 },
    { name: 'icon-512.png', path: kpath('mobile', 'icon-512.png'), type: 'image/png', size: 3 * 1024 * 1024 },
  ],
  usage: { input_tokens: 1200, output_tokens: 300 },
  notes: ['Padded the logo.'],
  warnings: ['favicon-32.png didn\'t come back.'],
};

describe('kitResponse', () => {
  it('reads a get: runs, safe links, what is set up', () => {
    const view = kitResponse({
      kit: { mobile: READY_MOBILE, toString: { status: 'ready' }, words: { status: 'nope' } },
      urls: { mobile: { 'contact.vcf': 'https://files.test/a?token=t', 'icon-512.png': 'javascript:alert(1)' }, evil: { x: 'https://x.test' } },
      configured: { mobile: true, claims: false },
      notSetUp: { claims: 'Claims ledger isn\'t built yet' },
    });
    expect(Object.keys(view.kit)).toEqual(['mobile']);
    expect(view.kit.mobile.data).toEqual({ themeColor: '#e11d2e' });
    expect(view.urls).toEqual({ mobile: { 'contact.vcf': 'https://files.test/a?token=t' } });
    expect(view.configured).toEqual({ photos: false, mobile: true, words: false, claims: false, print: false, social: false, handover: false });
    expect(view.notSetUp.claims).toBe('Claims ledger isn\'t built yet');
    expect(view.alreadyRunning).toBe(false);
  });

  it('reads a start: its run (or just its startedAt), already running, needs, not set up', () => {
    const started = kitResponse({ skill: 'mobile', startedAt: ago(1000), configured: true }, { status: 200 });
    expect(started.run).toEqual(expect.objectContaining({ status: 'running', startedAt: ago(1000) }));
    expect(started.kit.mobile.status).toBe('running');
    expect(started.configured).toBeNull();

    const live = kitResponse({ error: 'Mobile kit is already being built', run: { status: 'running', startedAt: ago(5000) }, skill: 'mobile' }, { status: 409 });
    expect(live.alreadyRunning).toBe(true);
    expect(live.kit.mobile.status).toBe('running');

    const needs = kitResponse({ error: 'Build the written site first', code: 'needs', needs: [{ id: 'site', label: 'the written site' }], skill: 'mobile' }, { status: 409 });
    expect(needs).toMatchObject({ alreadyRunning: false, needs: [{ id: 'site', label: 'the written site' }], message: 'Build the written site first', run: null });

    const off = kitResponse({ configured: false, code: 'not_configured', error: 'Print studio isn\'t set up yet', skill: 'print' }, { status: 503 });
    expect(off).toMatchObject({ configured: { print: false }, notSetUp: { print: 'Print studio isn\'t set up yet' }, run: null });
    expect(isNotSetUp({ code: 'not_configured' })).toBe(true);
    expect(isNotSetUp({ configured: { photos: false } })).toBe(false);
  });

  it('safeFileUrl', () => {
    expect(safeFileUrl('https://x.supabase.co/storage/v1/object/sign/a?token=1')).toBeTruthy();
    expect(safeFileUrl('http://127.0.0.1:54321/storage/a')).toBeTruthy();
    expect(safeFileUrl('http://evil.test/a')).toBe('');
    expect(safeFileUrl('https://x.test/"onerror=1')).toBe('');
  });
});

describe('server calls', () => {
  let fetchMock;
  beforeEach(() => {
    session = { access_token: 'tok-123' };
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  const answer = (status, body) => ({ ok: status < 300, status, json: async () => body });

  it('start posts the skill with the admin\'s token; not set up, live and needs are answers', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { run: { status: 'running', startedAt: ago(0) }, skill: 'words', startedAt: ago(0), configured: true }));
    const view = await startKitRun(PID, 'words');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(KIT_FN);
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    expect(JSON.parse(init.body)).toEqual({ action: 'start', id: PID, skill: 'words' });
    expect(view.run.status).toBe('running');

    fetchMock.mockResolvedValueOnce(answer(503, { configured: false, code: 'not_configured', error: 'Words isn\'t set up yet', skill: 'words' }));
    expect((await startKitRun(PID, 'words')).configured).toEqual({ words: false });
    fetchMock.mockResolvedValueOnce(answer(409, { code: 'needs', needs: [{ id: 'site', label: 'the written site' }], skill: 'words', error: 'Build the written site first' }));
    expect((await startKitRun(PID, 'words')).needs).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(answer(500, { error: 'Something went wrong' }));
    await expect(startKitRun(PID, 'words')).rejects.toMatchObject({ message: 'Something went wrong', status: 500 });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(getKit(PID)).rejects.toMatchObject({ offline: true });
    await expect(startKitRun(PID, 'toString')).rejects.toThrow(/Unknown/);
    await expect(getKit('')).rejects.toThrow(/No project/);
    session = null;
    await expect(getKit(PID)).rejects.toThrow(/Not signed in/);
  });

  it('get posts the project id', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { kit: { mobile: READY_MOBILE }, urls: {}, configured: { mobile: true } }));
    const view = await getKit(PID);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'get', id: PID });
    expect(view.kit.mobile.status).toBe('ready');
    // The panel's polls ask for the runs only.
    fetchMock.mockResolvedValueOnce(answer(200, { kit: { mobile: READY_MOBILE }, configured: { mobile: true } }));
    const poll = await getKit(PID, { links: false });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ action: 'get', id: PID, links: false });
    expect(poll.urls).toEqual({});
  });
});

describe('runs and tiles', () => {
  it('newerKitRun and mergeKit keep the newest record per skill', () => {
    const old = { status: 'ready', startedAt: ago(9000), data: {} };
    const fresh = { status: 'running', startedAt: ago(1000) };
    expect(newerKitRun(old, fresh)).toBe(fresh);
    expect(newerKitRun(fresh, old)).toBe(fresh);
    const finished = { ...fresh, status: 'ready', data: {} };
    expect(newerKitRun(fresh, finished)).toBe(finished);
    expect(newerKitRun(finished, fresh)).toBe(finished);
    expect(newerKitRun(null, old)).toBe(old);
    expect(mergeKit({ mobile: old, words: old }, { mobile: fresh }, null)).toEqual({ mobile: fresh, words: old });
  });

  it('kitTile: build only when set up, nothing missing and nothing running', () => {
    const withSite = { site_id: 'x', design: {} };
    expect(kitTile('mobile', { run: null, project: withSite, configured: null, nowMs: NOW })).toMatchObject({ state: 'idle', canBuild: false, buildLabel: 'Build' });
    expect(kitTile('mobile', { run: null, project: withSite, configured: true, nowMs: NOW })).toMatchObject({ canBuild: true, needs: [] });
    expect(kitTile('mobile', { run: null, project: { design: {} }, configured: true, nowMs: NOW })).toMatchObject({ canBuild: false, needs: [{ id: 'site', label: 'the written site' }] });
    expect(kitTile('mobile', { run: { status: 'running', startedAt: ago(1000) }, project: withSite, configured: true, nowMs: NOW })).toMatchObject({ state: 'running', canBuild: false });
    expect(kitTile('mobile', { run: { status: 'running', startedAt: ago(20 * 60000) }, project: withSite, configured: true, nowMs: NOW })).toMatchObject({ state: 'stale', canBuild: true, buildLabel: 'Try again' });
    expect(kitTile('mobile', { run: READY_MOBILE, project: withSite, configured: true, nowMs: NOW }).buildLabel).toBe('Rebuild');
    expect(kitTile('mobile', { run: READY_MOBILE, project: withSite, configured: true, starting: true, nowMs: NOW })).toMatchObject({ canBuild: false, buildLabel: 'Starting…' });
    expect(kitTile('claims', { run: null, project: withSite, configured: false, notSetUp: 'Claims ledger isn\'t built yet', nowMs: NOW })).toMatchObject({ canBuild: false, notSetUp: 'Claims ledger isn\'t built yet' });
  });

  it('kitReadyRuns names the ready runs, so the panel knows when to sign links again', () => {
    expect(kitReadyRuns({}, NOW)).toEqual([]);
    expect(kitReadyRuns(null, NOW)).toEqual([]);
    const kit = { words: { status: 'ready', startedAt: ago(9000), data: {} }, mobile: READY_MOBILE, print: { status: 'running', startedAt: ago(1000) }, social: { status: 'ready', data: null } };
    expect(kitReadyRuns(kit, NOW)).toEqual([`mobile@${READY_MOBILE.startedAt}`, `words@${ago(9000)}`]);
  });

  it('projectWithKit lets a run the panel fetched satisfy another tile\'s needs', () => {
    const p = projectWithKit({ id: PID, design: { levers: {} } }, { words: { status: 'ready', data: {} } });
    expect(p.design.kit.words.status).toBe('ready');
    expect(p.design.levers).toEqual({});
  });

  it('kitBuildConfirm names the cost; a rebuild says it replaces the result', () => {
    const first = kitBuildConfirm('print', 'idle');
    expect(first.title).toBe('Build Print studio?');
    expect(first.message).toContain('about $0.4-1.2');
    const again = kitBuildConfirm('print', 'ready');
    expect(again.confirmText).toBe('Rebuild');
    expect(again.message).toContain('replaces');
    expect(kitBuildConfirm('nope', 'idle')).toBeNull();
  });

  it('kitRunError, kitRunNotes', () => {
    expect(kitRunError({ status: 'failed', error: 'contact.vcf isn\'t a vCard' }, NOW)).toBe('contact.vcf isn\'t a vCard');
    expect(kitRunError({ status: 'running', startedAt: ago(20 * 60000) }, NOW)).toMatch(/stopped answering/);
    expect(kitRunError({ status: 'ready', data: null }, NOW)).toMatch(/without a usable result/);
    expect(kitRunError(null, NOW)).toBe('Something went wrong.');
    expect(kitRunNotes(READY_MOBILE)).toEqual({ notes: ['Padded the logo.'], warnings: ['favicon-32.png didn\'t come back.'] });
  });
});

describe('files', () => {
  it('kitFiles lists a run\'s files in the skill\'s order with kinds, sizes and safe links', () => {
    const files = kitFiles('mobile', READY_MOBILE, { 'icon-512.png': 'https://files.test/i?token=t', 'contact.vcf': 'javascript:x' });
    expect(files.map((f) => [f.name, f.label, f.kind, f.sizeLabel, f.url])).toEqual([
      ['mobile.json', 'Mobile plan', 'json', '2 KB', ''],
      ['icon-512.png', 'App icon (512)', 'image', '3.0 MB', 'https://files.test/i?token=t'],
      ['contact.vcf', 'Contact card', 'vcard', '1 KB', ''],
    ]);
    expect(files[1].px).toEqual([512, 512]);
    expect(kitFiles('mobile', { files: [{ name: 'evil.sh', type: 'text/x-sh' }] })).toEqual([]);
    expect(kitFiles(undefined, READY_MOBILE).map((f) => f.name)).toEqual(['contact.vcf', 'mobile.json', 'icon-512.png']);
    expect(formatFileSize(0)).toBe('');
    expect(formatFileSize(500)).toBe('1 KB');
  });
});

describe('LaunchKitPanel', () => {
  const render = (project) => renderToStaticMarkup(createElement(AlertProvider, null, createElement(LaunchKitPanel, { projectId: PID, project, onRefresh: () => {} })));

  it('renders a tile per skill by tier, with needs, a ready run\'s files, notes and warnings', () => {
    const html = render({ id: PID, site_id: null, design: { kit: { mobile: READY_MOBILE, print: { status: 'failed', startedAt: ago(1000), error: 'The run finished without writing print.json.' } } } });
    expect(html).toContain('Launch kit');
    for (const s of KIT_SKILLS) expect(html).toContain(s.label);
    expect(html).toContain('Build</p>');
    expect(html).toContain('Check and hand over</p>');
    expect(html).toContain('Signature add-ons');
    expect(html).toContain('Needs the written site first.');
    expect(html).toContain('1 of 7 ready.');
    // The ready run: its files (no links until the panel fetched them), notes and warnings.
    expect(html).toContain('Contact card');
    expect(html).toContain('Padded the logo.');
    expect(html).toContain('favicon-32.png didn&#x27;t come back.');
    expect(html).toContain('The run finished without writing print.json.');
    // Nothing can be built before the server said what is set up.
    expect(html).toMatch(/<button type="button" disabled="" class="[^"]*">Build<\/button>/);
    expect(html).not.toMatch(/<button type="button" class="[^"]*">(Build|Rebuild|Try again)<\/button>/);
  });

  it('looks for each skill\'s own view at kit/<Key>Result.jsx', () => {
    expect(resultViewPath('photos')).toBe('./kit/PhotosResult.jsx');
    expect(resultViewPath('handover')).toBe('./kit/HandoverResult.jsx');
  });
});
