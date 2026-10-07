// The project page's iPhone photo (HEIC) card: which uploads count as HEIC
// (the server's rule), when a run is live, which record of a run wins, what
// the card shows in each state (rendered to static markup), and what it
// does: the button's call, polling `get` every 4 s while the run is live
// (past a network blip, never after unmount) and one page refresh once the
// run has ended.
//
// The behaviour tests run in node without a DOM: while h.fake is on, the
// React hooks are a tiny hook store that also runs effects (with their
// cleanups), the component is called as a function and its handlers are
// invoked straight from the returned element tree. Off, the real hooks run
// (renderToStaticMarkup).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const h = vi.hoisted(() => ({ fake: false, slots: [], i: 0, pending: [], admin: null, convert: null, confirm: null }));

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal();
  const slot = (init) => {
    const i = h.i++;
    if (!(i in h.slots)) h.slots[i] = init();
    return i;
  };
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, k) => Object.is(v, b[k]));
  return {
    ...real,
    useState: (init) => {
      if (!h.fake) return real.useState(init);
      const i = slot(() => (typeof init === 'function' ? init() : init));
      const set = (v) => { h.slots[i] = typeof v === 'function' ? v(h.slots[i]) : v; };
      return [h.slots[i], set];
    },
    useRef: (v) => (h.fake ? h.slots[slot(() => ({ current: v }))] : real.useRef(v)),
    useCallback: (fn, deps) => {
      if (!h.fake) return real.useCallback(fn, deps);
      const i = slot(() => ({ fn, deps }));
      if (!same(h.slots[i].deps, deps)) h.slots[i] = { fn, deps };
      return h.slots[i].fn;
    },
    useEffect: (fn, deps) => {
      if (!h.fake) return real.useEffect(fn, deps);
      const e = h.slots[slot(() => ({ effect: true, deps: null, cleanup: null, ran: false }))];
      if (!e.ran || !same(e.deps, deps)) {
        e.ran = true;
        e.deps = deps;
        h.pending.push([e, fn]);
      }
      return undefined;
    },
  };
});

vi.mock('../../lib/customSites.js', () => ({
  convertHeic: (...a) => h.convert(...a),
  customSiteAdmin: (...a) => h.admin(...a),
}));
vi.mock('../ui/AlertProvider.jsx', () => ({
  useAlert: () => ({ toast: () => {}, confirm: (...a) => h.confirm(...a) }),
}));

const {
  default: HeicConvertCard, HEIC_POLL_MS, HEIC_RUN_LIVE_MS, heicAssetsOf, heicCardView, isHeicAsset, isHeicRunLive,
  newerHeicRun, newerProject,
} = await import('./HeicConvertCard.jsx');

const PID = '11111111-2222-4333-8444-555555555555';
const NOW = Date.parse('2026-10-07T12:00:00.000Z');
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const path = (kind, n, ext) => `${PID}/${kind}/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.${ext}`;
const heic = (n, kind = 'photo') => ({ path: path(kind, n, 'heic'), kind, name: `IMG_${n}.HEIC`, size: 2000, type: 'image/heic' });
const jpeg = (n) => ({ path: path('photo', n, 'jpg'), kind: 'photo', name: `car${n}.jpg`, size: 1000, type: 'image/jpeg' });
const converted = (n) => ({ path: path('photo', 100 + n, 'jpg'), kind: 'photo', name: `IMG_${n}.jpg`, size: 900, type: 'image/jpeg', convertedFrom: path('photo', n, 'heic') });
const project = ({ assets = [], heicRun, updatedAt = iso(60_000) } = {}) => ({
  id: PID, assets, updated_at: updatedAt, design: heicRun ? { templateId: 'mobile_chrome', heic: heicRun } : { templateId: 'mobile_chrome' },
});
const running = (over = {}) => ({ status: 'running', startedAt: iso(30_000), by: 'admin', ...over });

// Markup text with React's escaping undone, on one line.
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const markup = (props) => renderToStaticMarkup(createElement(HeicConvertCard, { onRefresh: () => {}, ...props }));

// ─── The hook store ────────────────────────────────────────────────────

function elements(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => elements(n, out));
  else if (node && typeof node === 'object' && node.props) {
    out.push(node);
    elements(node.props.children, out);
  }
  return out;
}
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return node.props ? textOf(node.props.children) : '';
}
// One render: the component's tree, then its effects (old cleanup first).
function render(props) {
  h.i = 0;
  h.pending = [];
  const tree = HeicConvertCard(props);
  for (const [e, fn] of h.pending) {
    if (typeof e.cleanup === 'function') e.cleanup();
    const c = fn();
    e.cleanup = typeof c === 'function' ? c : null;
  }
  return { tree, els: elements(tree), text: textOf(tree).replace(/\s+/g, ' ') };
}
function unmount() {
  for (const s of h.slots) if (s && s.effect && typeof s.cleanup === 'function') s.cleanup();
}
const button = (els) => els.find((e) => e.type === 'button');

beforeEach(() => {
  // The card's clock (and timeAgo) read Date.now(): every test runs at NOW.
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  h.fake = false;
  h.slots = [];
  h.admin = vi.fn(async () => ({}));
  h.convert = vi.fn(async () => ({ heic: running({ startedAt: new Date(Date.now()).toISOString() }) }));
  h.confirm = vi.fn(async () => true);
});
afterEach(() => vi.useRealTimers());

// ─── Pure rules ────────────────────────────────────────────────────────

describe('isHeicAsset', () => {
  it('takes a HEIC or HEIF type or extension, in the four upload kinds', () => {
    expect(isHeicAsset(heic(1))).toBe(true);
    expect(isHeicAsset({ ...heic(1), type: '' })).toBe(true);
    expect(isHeicAsset({ path: path('photo', 2, 'heif'), kind: 'photo', name: 'IMG_2.heif' })).toBe(true);
    expect(isHeicAsset({ path: path('logo', 3, 'jpg'), kind: 'logo', name: 'logo.jpg', type: 'image/HEIF' })).toBe(true);
    // The server's list (heic-run.js) also takes the sequence types.
    expect(isHeicAsset({ path: path('photo', 5, 'bin'), kind: 'photo', name: 'live', type: 'image/heic-sequence' })).toBe(true);
    for (const kind of ['photo', 'logo', 'brand', 'reference']) expect(isHeicAsset(heic(4, kind))).toBe(true);
  });

  it('leaves out other formats, other kinds, converted files and files without a path', () => {
    expect(isHeicAsset(jpeg(1))).toBe(false);
    expect(isHeicAsset({ ...heic(1), kind: 'kit' })).toBe(false);
    expect(isHeicAsset({ ...heic(1), convertedFrom: path('photo', 0, 'heic') })).toBe(false);
    expect(isHeicAsset(converted(1))).toBe(false);
    expect(isHeicAsset({ ...heic(1), path: '' })).toBe(false);
    expect(isHeicAsset({ kind: 'photo', name: 'x.heic' })).toBe(false);
    for (const v of [null, undefined, 'x.heic', 7]) expect(isHeicAsset(v)).toBe(false);
  });

  it('heicAssetsOf keeps the ones still to convert, in order', () => {
    expect(heicAssetsOf([jpeg(1), heic(2), converted(3), heic(4, 'logo'), null]).map((a) => a.name)).toEqual(['IMG_2.HEIC', 'IMG_4.HEIC']);
    expect(heicAssetsOf(undefined)).toEqual([]);
  });
});

// The card keeps its own copy of the server's rules (the browser never
// imports the functions' code): they must agree, or the card would offer a
// run the server refuses ("Nothing to convert") or hide one it would make.
describe('the card\'s rules match the server\'s (heic-run.js)', () => {
  it('counts the same uploads and calls the same runs live', async () => {
    const server = await import('../../../netlify/functions/_lib/heic-run.js');
    const assets = [
      heic(1), jpeg(2), converted(3), heic(4, 'logo'), heic(5, 'brand'), heic(6, 'reference'), { ...heic(7), kind: 'kit' },
      { ...heic(8), type: '' }, { ...heic(9), type: ' IMAGE/HEIF ' }, { ...jpeg(10), type: 'image/heic-sequence' },
      { ...jpeg(11), type: 'image/heif-sequence' }, { path: path('photo', 12, 'HEIF'), kind: 'photo', name: '' },
      { ...heic(13), path: '' }, { ...heic(14), path: 7 }, { kind: 'photo', name: 'x.heic' }, null, 'x.heic', 7, [],
    ];
    for (const a of assets) expect([a, isHeicAsset(a)]).toEqual([a, server.isHeicAsset(a)]);
    expect(heicAssetsOf(assets)).toEqual(server.heicAssetsOf(assets));
    const runs = [
      running(), running({ startedAt: iso(HEIC_RUN_LIVE_MS - 1) }), running({ startedAt: iso(HEIC_RUN_LIVE_MS) }),
      { status: 'running', startedAt: '2026-10-07T11:50:00+00:00' }, { status: 'running' }, { status: 'ready', startedAt: iso(1000) },
      { ...running(), startedAt: 'soon' }, null, undefined, 'running', [],
    ];
    for (const r of runs) expect([r, isHeicRunLive(r, NOW)]).toEqual([r, server.isHeicRunLive(r, NOW)]);
    expect(HEIC_RUN_LIVE_MS).toBe(server.HEIC_RUN_LIVE_MS);
  });
});

describe('isHeicRunLive', () => {
  it('is a running run started within 15 minutes, with the time as Postgres writes it', () => {
    expect(isHeicRunLive(running(), NOW)).toBe(true);
    expect(isHeicRunLive({ status: 'running', startedAt: '2026-10-07T11:50:00+00:00' }, NOW)).toBe(true);
    expect(isHeicRunLive({ status: 'running', startedAt: '2026-10-07T11:45:00+00:00' }, NOW)).toBe(false);
    expect(isHeicRunLive(running({ startedAt: iso(HEIC_RUN_LIVE_MS - 1) }), NOW)).toBe(true);
  });

  it('is never a finished run, a run without a start, or nothing', () => {
    expect(isHeicRunLive({ ...running(), status: 'ready' }, NOW)).toBe(false);
    expect(isHeicRunLive({ status: 'running' }, NOW)).toBe(false);
    expect(isHeicRunLive(null, NOW)).toBe(false);
  });
});

describe('newerHeicRun / newerProject', () => {
  it('shows the later run, and for the same run the finished record', () => {
    const a = running({ startedAt: '2026-10-07T11:00:00+00:00' });
    const b = running({ startedAt: '2026-10-07T11:30:00.000Z' });
    expect(newerHeicRun(a, b)).toBe(b);
    expect(newerHeicRun(b, a)).toBe(b);
    const done = { ...a, startedAt: '2026-10-07T11:00:00.000Z', status: 'ready', converted: 3 };
    expect(newerHeicRun(a, done)).toBe(done);
    expect(newerHeicRun(done, a)).toBe(done);
    expect(newerHeicRun(null, a)).toBe(a);
    expect(newerHeicRun({ nope: 1 }, undefined)).toBe(null);
  });

  it('keeps the project saved last, the first on a tie', () => {
    const older = project({ updatedAt: iso(10_000) });
    const newer = project({ updatedAt: iso(1_000) });
    expect(newerProject(older, newer)).toBe(newer);
    expect(newerProject(newer, older)).toBe(newer);
    const twin = { ...older };
    expect(newerProject(older, twin)).toBe(older);
    expect(newerProject(null, older)).toBe(older);
    expect(newerProject(null, null)).toBe(null);
  });
});

describe('heicCardView', () => {
  it('names the state', () => {
    expect(heicCardView({ assets: [jpeg(1)], nowMs: NOW }).state).toBe('none');
    expect(heicCardView({ assets: [heic(1)], nowMs: NOW }).state).toBe('idle');
    expect(heicCardView({ assets: [heic(1)], run: running(), nowMs: NOW }).state).toBe('running');
    expect(heicCardView({ assets: [heic(1)], run: running({ startedAt: iso(HEIC_RUN_LIVE_MS + 1) }), nowMs: NOW }).state).toBe('stale');
    expect(heicCardView({ run: { status: 'ready', converted: 2 }, nowMs: NOW }).state).toBe('ready');
    expect(heicCardView({ run: { status: 'failed', converted: 0 }, nowMs: NOW }).state).toBe('failed');
  });

  it('cleans up the counts and the failures', () => {
    const v = heicCardView({
      assets: [heic(1)],
      run: { status: 'ready', converted: 2.7, failed: [{ path: 'p/x.heic', reason: 'Too large' }, null, { name: 'IMG_9.HEIC' }] },
      nowMs: NOW,
    });
    expect(v.converted).toBe(2);
    expect(v.failed).toEqual([{ name: 'p/x.heic', reason: 'Too large' }, { name: 'IMG_9.HEIC', reason: '' }]);
    expect(heicCardView({ run: { status: 'ready', converted: -1 } }).converted).toBe(0);
  });
});

// ─── What the card shows ───────────────────────────────────────────────

describe('the card', () => {
  it('renders nothing without HEIC files or a run', () => {
    expect(markup({ project: project({ assets: [jpeg(1), converted(2)] }) })).toBe('');
    expect(markup({ project: { id: PID } })).toBe('');
  });

  it('counts the HEIC files and offers the conversion', () => {
    const t = text(markup({ project: project({ assets: [jpeg(1), ...Array.from({ length: 18 }, (_, i) => heic(10 + i)), converted(3)] }) }));
    expect(t).toContain('18 iPhone photos (HEIC) can\'t be shown on a website or seen by Claude.');
    expect(t).toContain('Convert them to JPEG');
    expect(t).not.toContain('Converting');
  });

  it('says it for one file, and reads the files list when the project has no assets', () => {
    const t = text(markup({ project: { id: PID, files: [{ ...heic(1), url: 'https://files.test/a' }] } }));
    expect(t).toContain('1 iPhone photo (HEIC) can\'t be shown on a website or seen by Claude.');
    expect(t).toContain('Convert it to JPEG');
  });

  it('shows a live run without the button, and who started it', () => {
    const html = markup({ project: project({ assets: [heic(1), heic(2), converted(3)], heicRun: running({ by: 'customer' }) }) });
    const t = text(html);
    expect(html).toContain('role="status"');
    expect(t).toContain('Converting iPhone photos to JPEG…');
    expect(t).toContain('2 left.');
    expect(t).toContain('when the customer saved their form');
    expect(html).not.toContain('<button');
  });

  it('shows the result with the failures by name, and the button for what is left', () => {
    const run = {
      status: 'ready', startedAt: iso(120_000), finishedAt: iso(30_000), converted: 16, by: 'admin',
      failed: [{ path: heic(1).path, name: 'IMG_1.HEIC', reason: 'Could not read the image' }, { path: heic(2).path, name: 'IMG_2.HEIC', reason: 'Over 30 MB' }],
    };
    const t = text(markup({ project: project({ assets: [heic(1), heic(2), converted(3)], heicRun: run }) }));
    expect(t).toContain('Converted 16 photos from HEIC to JPEG');
    expect(t).toContain('Couldn\'t convert 2 files:');
    expect(t).toContain('IMG_1.HEIC : Could not read the image');
    expect(t).toContain('IMG_2.HEIC : Over 30 MB');
    expect(t).toContain('2 iPhone photos (HEIC) can\'t be shown on a website or seen by Claude.');
    expect(t).toContain('Convert them to JPEG');
  });

  it('shows a run that stopped early with its note, and one line once all are done', () => {
    const early = { status: 'ready', startedAt: iso(900_000), finishedAt: iso(160_000), converted: 30, note: 'Stopped at the time limit; 4 are left. Run it again to convert them.' };
    const t = text(markup({ project: project({ assets: [heic(1), heic(2), heic(3), heic(4)], heicRun: early }) }));
    expect(t).toContain('Converted 30 photos from HEIC to JPEG');
    expect(t).toContain('Stopped at the time limit; 4 are left.');
    expect(t).toContain('4 iPhone photos (HEIC)');

    const done = text(markup({ project: project({ assets: [converted(1)], heicRun: { status: 'ready', startedAt: iso(900_000), finishedAt: iso(800_000), converted: 1 } }) }));
    expect(done).toContain('Converted 1 photo from HEIC to JPEG');
    expect(done).not.toContain('Convert it');
    expect(done).not.toContain('Couldn\'t');
  });

  it('never says "Nothing left to convert" next to HEIC files a finished run did not see', () => {
    const empty = { status: 'ready', startedAt: iso(600_000), finishedAt: iso(590_000), converted: 0, failed: [] };
    const t = text(markup({ project: project({ assets: [heic(1), heic(2)], heicRun: empty }) }));
    expect(t).not.toContain('Nothing left to convert');
    expect(t).toContain('2 iPhone photos (HEIC) can\'t be shown on a website or seen by Claude.');
    expect(t).toContain('Convert them to JPEG');
  });

  it('offers a new run after one that never finished or failed', () => {
    const stale = text(markup({ project: project({ assets: [heic(1)], heicRun: running({ startedAt: iso(HEIC_RUN_LIVE_MS + 60_000), converted: 0 }) }) }));
    expect(stale).toContain('The last conversion didn\'t finish');
    expect(stale).toContain('Convert it to JPEG');
    const failed = text(markup({ project: project({ assets: [heic(1)], heicRun: { status: 'failed', startedAt: iso(60_000), converted: 2, error: 'Storage was unreachable.' } }) }));
    expect(failed).toContain('The conversion stopped');
    expect(failed).toContain('Storage was unreachable. It converted 2 photos before it stopped.');
    expect(failed).toContain('Convert it to JPEG');
  });
});

// ─── What the card does ────────────────────────────────────────────────

describe('converting', () => {
  beforeEach(() => { h.fake = true; });
  afterEach(() => {
    unmount();
    h.fake = false;
  });

  it('starts a run, polls get every 4 s while it goes, and refreshes the page once when it ends', async () => {
    const onRefresh = vi.fn();
    const page = project({ assets: [heic(1), heic(2)], updatedAt: iso(60_000) });
    const props = { project: page, onRefresh };
    const first = render(props);
    expect(first.text).toContain('2 iPhone photos (HEIC)');

    await button(first.els).props.onClick();
    expect(h.confirm).toHaveBeenCalledWith(expect.stringContaining('HEIC original is deleted'), expect.objectContaining({ title: 'Convert 2 iPhone photos to JPEG?' }));
    expect(h.convert).toHaveBeenCalledWith(PID);
    const startedAt = h.convert.mock.results[0].value;
    const { heic: run } = await startedAt;

    // The answer's run shows at once, before the page's project knows it.
    const live = render(props);
    expect(live.text).toContain('Converting iPhone photos to JPEG…');
    expect(button(live.els)).toBeUndefined();
    expect(h.admin).not.toHaveBeenCalled();

    // One converted so far: the card counts from its own fetch.
    h.admin.mockResolvedValueOnce({ project: project({ assets: [converted(1), heic(2)], heicRun: run, updatedAt: iso(-3_000) }) });
    await vi.advanceTimersByTimeAsync(HEIC_POLL_MS);
    expect(h.admin).toHaveBeenCalledWith('get', { id: PID });
    expect(render(props).text).toContain('1 left.');
    expect(onRefresh).not.toHaveBeenCalled();

    // Done: the page reloads once (fresh file links), the polls stop.
    const finished = { ...run, status: 'ready', finishedAt: iso(-7_000), converted: 2, failed: [] };
    h.admin.mockResolvedValueOnce({ project: project({ assets: [converted(1), converted(2)], heicRun: finished, updatedAt: iso(-8_000) }) });
    await vi.advanceTimersByTimeAsync(HEIC_POLL_MS);
    const after = render(props);
    expect(after.text).toContain('Converted 2 photos from HEIC to JPEG');
    expect(onRefresh).toHaveBeenCalledTimes(1);
    render(props);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    const calls = h.admin.mock.calls.length;
    await vi.advanceTimersByTimeAsync(HEIC_POLL_MS * 3);
    expect(h.admin).toHaveBeenCalledTimes(calls);

    // The page's reload arrives with the finished run: nothing more to do.
    render({ ...props, project: project({ assets: [converted(1), converted(2)], heicRun: finished, updatedAt: iso(-8_000) }) });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('keeps polling after a failed request, and stops on unmount', async () => {
    const props = { project: project({ assets: [heic(1)], heicRun: running() }), onRefresh: vi.fn() };
    render(props);
    h.admin.mockRejectedValueOnce(Object.assign(new Error('Can\'t reach the server.'), { offline: true }));
    await vi.advanceTimersByTimeAsync(HEIC_POLL_MS);
    expect(h.admin).toHaveBeenCalledTimes(1);
    expect(render(props).text).toContain('Converting iPhone photos to JPEG…');
    await vi.advanceTimersByTimeAsync(HEIC_POLL_MS);
    expect(h.admin).toHaveBeenCalledTimes(2);

    unmount();
    await vi.advanceTimersByTimeAsync(HEIC_POLL_MS * 3);
    expect(h.admin).toHaveBeenCalledTimes(2);
  });

  it('stops polling a run that never answers once it is past 15 minutes', async () => {
    const props = { project: project({ assets: [heic(1)], heicRun: running({ startedAt: iso(HEIC_RUN_LIVE_MS - 5_000) }) }), onRefresh: vi.fn() };
    render(props);
    h.admin.mockResolvedValue({ project: props.project });
    await vi.advanceTimersByTimeAsync(HEIC_POLL_MS);
    expect(render(props).text).toContain('Converting');
    await vi.advanceTimersByTimeAsync(HEIC_POLL_MS);
    const stale = render(props);
    expect(stale.text).toContain('The last conversion didn\'t finish');
    expect(button(stale.els)).toBeDefined();
    const calls = h.admin.mock.calls.length;
    await vi.advanceTimersByTimeAsync(HEIC_POLL_MS * 3);
    expect(h.admin).toHaveBeenCalledTimes(calls);
  });

  it('watches the run already going when the server says so (409)', async () => {
    const theirs = running({ by: 'customer', startedAt: iso(20_000) });
    h.convert = vi.fn(async () => { throw Object.assign(new Error('Already converting'), { status: 409, data: { heic: theirs } }); });
    const props = { project: project({ assets: [heic(1)] }), onRefresh: vi.fn() };
    await button(render(props).els).props.onClick();
    const t = render(props).text;
    expect(t).toContain('Converting iPhone photos to JPEG…');
    expect(t).toContain('when the customer saved their form');
    expect(t).not.toContain('Already converting');
    h.admin.mockResolvedValueOnce({ project: project({ assets: [heic(1)], heicRun: theirs, updatedAt: iso(-1_000) }) });
    await vi.advanceTimersByTimeAsync(HEIC_POLL_MS);
    expect(h.admin).toHaveBeenCalledTimes(1);
  });

  it('says why it could not start, and reloads the page when there was nothing to convert', async () => {
    h.convert = vi.fn(async () => { throw Object.assign(new Error('Nothing to convert'), { status: 400, data: {} }); });
    const onRefresh = vi.fn();
    const props = { project: project({ assets: [heic(1)] }), onRefresh };
    await button(render(props).els).props.onClick();
    const r = render(props);
    expect(r.els.find((e) => e.props?.role === 'alert') && textOf(r.els.find((e) => e.props?.role === 'alert'))).toBe('Nothing to convert');
    expect(onRefresh).toHaveBeenCalledTimes(1);

    h.convert = vi.fn(async () => { throw Object.assign(new Error('Request failed (500)'), { status: 500, data: {} }); });
    await button(render(props).els).props.onClick();
    expect(render(props).text).toContain('Request failed (500)');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the admin cancels the confirm', async () => {
    h.confirm = vi.fn(async () => false);
    const props = { project: project({ assets: [heic(1)] }), onRefresh: vi.fn() };
    await button(render(props).els).props.onClick();
    expect(h.convert).not.toHaveBeenCalled();
    expect(render(props).text).toContain('Convert it to JPEG');
  });
});
