// "Match its layout": what SuggestPanel sends when it starts a run (the
// page's reference choice and, for a match, the Studio's current colors
// and brand-color toggle), what ReferenceShotUpload does with picked files
// (checks, one upload at a time, a tall one's parts as one group top first,
// the note tying them to the reference address, onAdded per recorded
// screenshot) and what customSites.js uploadReferenceShot sends.
//
// The tests run in node without a DOM: the React hooks are replaced by a
// tiny hook store, each component is called as a function, and its
// handlers are invoked straight from the returned element tree.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ slots: [], i: 0, suggest: null, upload: null, prepare: null, admin: null, storage: null }));

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    useState: (init) => {
      const i = h.i++;
      if (!(i in h.slots)) h.slots[i] = typeof init === 'function' ? init() : init;
      const set = (v) => { h.slots[i] = typeof v === 'function' ? v(h.slots[i]) : v; };
      return [h.slots[i], set];
    },
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (v) => ({ current: v === null ? null : true }),
    useId: () => 'id-1',
  };
});

vi.mock('../../../lib/customSites.js', () => ({
  customSiteSuggest: (...a) => h.suggest(...a),
  uploadReferenceShot: (...a) => h.upload(...a),
}));

// Preparing a file needs a browser (canvas): each test says what it gives.
// The group id is fixed so the calls can be compared.
vi.mock('./referenceMatch.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, prepareShot: (...a) => h.prepare(...a), newShotGroup: () => 'group-0001' };
});

// For the real uploadReferenceShot: a signed-in session and the storage
// upload (the admin function calls go through fetch).
vi.mock('../../../lib/supabase.js', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    storage: { from: () => ({ uploadToSignedUrl: (...a) => h.storage(...a) }) },
  },
}));

const { default: SuggestPanel } = await import('./SuggestPanel.jsx');
const { default: ReferenceShotUpload } = await import('./ReferenceShotUpload.jsx');
const { planTiles } = await import('./referenceMatch.js');

const PID = '11111111-2222-4333-8444-555555555555';
const SHOT = { path: `${PID}/reference/aaaaaaaa-bbbb-4ccc-8ddd-000000000020.png`, kind: 'reference', name: 'home.png', size: 1000, note: 'Screenshot of https://ref-site.test/' };
const PROJECT = { id: PID, form: { businessType: 'mobile_detailing' }, assets: [SHOT], files: [], design: { templateId: 'mobile_chrome' } };
const current = (palette) => ({ templateId: 'mobile_chrome', levers: { palette }, slots: { logo: '', hero: '', about: '', gallery: [] } });

// Every element of a returned tree (not descending into child components).
function elements(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => elements(n, out));
  else if (node && typeof node === 'object' && node.props) {
    out.push(node);
    elements(node.props.children, out);
  }
  return out;
}
function render(Component, props) {
  h.i = 0;
  return elements(Component(props));
}

beforeEach(() => {
  h.slots = [];
  h.suggest = vi.fn(async () => ({ suggestion: { status: 'running', startedAt: '2026-10-06T09:00:00.000Z' } }));
  h.upload = vi.fn();
  // As in a browser that can't redraw: the file goes up as it is.
  h.prepare = vi.fn(async (f) => ({ files: [f], plan: null }));
});

describe('SuggestPanel start', () => {
  const start = async (props) => {
    const button = render(SuggestPanel, { project: PROJECT, onApply: () => {}, current: current({}), ...props }).find((e) => e.type === 'button');
    expect(button.props.disabled).toBe(false);
    await button.props.onClick();
    return h.suggest.mock.calls[0];
  };

  it('sends a match with the Studio\'s current colors', async () => {
    const reference = { mode: 'match', source: { kind: 'url', url: 'https://ref-site.test/' }, replica: { status: 'requested' } };
    expect(await start({ reference, current: current({ accent: '#abcdef' }) })).toEqual(['start', {
      id: PID, reference: { mode: 'match', source: { kind: 'url', url: 'https://ref-site.test/' } }, palette: { accent: '#abcdef' },
    }]);
  });

  it('sends the page\'s brand-color toggle with a match, saved or not', async () => {
    const reference = { mode: 'match', source: { kind: 'url', url: 'https://ref-site.test/' } };
    const sent = async (props) => {
      h.suggest.mockClear();
      h.slots = [];
      return (await start({ reference, ...props }))[1];
    };
    expect(await sent({ useBrand: false })).toEqual({
      id: PID, reference: { mode: 'match', source: { kind: 'url', url: 'https://ref-site.test/' } }, palette: {}, useBrand: false,
    });
    expect((await sent({ useBrand: true })).useBrand).toBe(true);
    // No toggle on the page (or not a boolean): the saved one decides.
    expect(await sent({})).not.toHaveProperty('useBrand');
    expect(await sent({ useBrand: 'no' })).not.toHaveProperty('useBrand');
  });

  it('sends an inspiration choice without colors, and nothing extra without a choice', async () => {
    expect(await start({ reference: { mode: 'inspire' }, useBrand: false })).toEqual(['start', { id: PID, reference: { mode: 'inspire', source: null } }]);
    h.suggest.mockClear();
    h.slots = [];
    expect(await start({})).toEqual(['start', { id: PID }]);
  });

  it('won\'t start a match it can\'t run', () => {
    const reference = { mode: 'match', source: { kind: 'url', url: 'https://elsewhere.test/' } };
    const button = render(SuggestPanel, { project: PROJECT, onApply: () => {}, current: current({}), reference }).find((e) => e.type === 'button');
    expect(button.props.disabled).toBe(true);
  });
});

// The text of an element tree (child components left out).
const textOf = (node) => (node == null || typeof node === 'boolean' ? ''
  : typeof node === 'string' || typeof node === 'number' ? String(node)
    : Array.isArray(node) ? node.map(textOf).join('') : textOf(node.props?.children));

describe('SuggestPanel while screenshots upload', () => {
  const ELSEWHERE = { mode: 'match', source: { kind: 'url', url: 'https://elsewhere.test/' } };
  // The top part of a tall screenshot of elsewhere.test, just recorded.
  const TOP = {
    path: `${PID}/reference/aaaaaaaa-bbbb-4ccc-8ddd-000000000031.jpg`, kind: 'reference', name: 'long (part 1 of 3).jpg', size: 10,
    note: 'Screenshot of https://elsewhere.test/', group: 'group-0001', part: 1,
  };
  const view = (props) => {
    const els = render(SuggestPanel, { project: PROJECT, onApply: () => {}, current: current({}), reference: ELSEWHERE, onReferenceAdded: () => {}, ...props });
    return {
      upload: els.find((e) => e.type === ReferenceShotUpload),
      button: els.find((e) => e.type === 'button'),
      waiting: els.some((e) => e.props?.role === 'status' && textOf(e).startsWith('Waiting for the screenshots')),
    };
  };

  it('keeps its upload and holds the match until every part is in', () => {
    const before = view();
    expect(before.upload).toBeTruthy();
    expect(before.button.props.disabled).toBe(true);
    // The pick starts; its first part is recorded, which lifts the block.
    before.upload.props.onBusy(true);
    const withTop = { ...PROJECT, assets: [SHOT, TOP] };
    const going = view({ project: withTop });
    // Still shown (the other parts, a long page's cut and any failure are
    // said there), and the match waits.
    expect(going.upload).toBeTruthy();
    expect(going.upload.props.onAdded).toBeTypeOf('function');
    expect(going.button.props.disabled).toBe(true);
    expect(going.waiting).toBe(true);
    // All parts in: the match can run; the upload stays for this reference.
    going.upload.props.onBusy(false);
    const done = view({ project: withTop });
    expect(done.button.props.disabled).toBe(false);
    expect(done.waiting).toBe(false);
    expect(done.upload).toBeTruthy();
    // Another reference picked (one with a screenshot): no upload offered.
    expect(view({ project: withTop, reference: { mode: 'match', source: { kind: 'url', url: 'https://ref-site.test/' } } }).upload).toBeUndefined();
  });

  it('holds a match while the page uploads elsewhere, never an inspiration run', () => {
    const match = { mode: 'match', source: { kind: 'url', url: 'https://ref-site.test/' } };
    const held = view({ reference: match, uploading: true });
    expect(held.button.props.disabled).toBe(true);
    expect(held.waiting).toBe(true);
    expect(view({ reference: match, uploading: false }).button.props.disabled).toBe(false);
    const inspire = view({ reference: { mode: 'inspire', source: null }, uploading: true });
    expect(inspire.button.props.disabled).toBe(false);
    expect(inspire.waiting).toBe(false);
    expect(view({ reference: null, uploading: true }).button.props.disabled).toBe(false);
  });
});

describe('ReferenceShotUpload', () => {
  const pick = async (props, files) => {
    const input = render(ReferenceShotUpload, { projectId: PID, ...props }).find((e) => e.type === 'input' && e.props.type === 'file');
    const target = { files, value: 'C:\\fakepath\\x.png' };
    await input.props.onChange({ target });
    expect(target.value).toBe('');
  };

  it('uploads the good files one by one with the note, and hands each to the page', async () => {
    const added = [];
    h.upload.mockImplementation(async (id, f, { note, onProgress }) => {
      onProgress('upload');
      onProgress('save');
      return { asset: { path: `${id}/reference/${f.name}`, note }, project: { id } };
    });
    const files = [{ name: 'top.png', size: 1000, type: 'image/png' }, { name: 'mood.gif', size: 1000, type: 'image/gif' }, { name: 'mid.png', size: 1000, type: 'image/png' }];
    // The admin typed a note first.
    render(ReferenceShotUpload, { projectId: PID });
    h.slots[0] = 'the hero';
    await pick({ sourceUrl: 'ref-site.test', onAdded: (asset, project) => added.push([asset, project]) }, files);
    expect(h.upload.mock.calls.map(([id, f, o]) => [id, f.name, o.note])).toEqual([
      [PID, 'top.png', 'Screenshot of https://ref-site.test/ - the hero'],
      [PID, 'mid.png', 'Screenshot of https://ref-site.test/ - the hero'],
    ]);
    // An uncut screenshot is no group.
    expect(h.upload.mock.calls.every(([, , o]) => !('group' in o) && !('part' in o))).toBe(true);
    expect(added).toEqual([
      [{ path: `${PID}/reference/top.png`, note: 'Screenshot of https://ref-site.test/ - the hero' }, { id: PID }],
      [{ path: `${PID}/reference/mid.png`, note: 'Screenshot of https://ref-site.test/ - the hero' }, { id: PID }],
    ]);
    // Done: no progress left, the refused file named, the note kept for
    // another try since one file was refused.
    const [note, status, errors] = h.slots;
    expect(status).toBeNull();
    expect(errors).toEqual(['mood.gif: Use a PNG, JPEG or WebP screenshot.']);
    expect(note).toBe('the hero');

    // All of them recorded: the note is cleared for the next reference.
    h.upload.mockClear();
    await pick({ sourceUrl: 'ref-site.test' }, [files[0]]);
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.slots[0]).toBe('');
    expect(h.slots[2]).toEqual([]);
  });

  it('keeps going after a failed upload and says which one failed', async () => {
    h.upload.mockRejectedValueOnce(new Error('Could not start the upload. Try again.'))
      .mockResolvedValueOnce({ asset: { path: 'p2' }, project: { id: PID } });
    const added = [];
    await pick({ onAdded: (a) => added.push(a) }, [{ name: 'a.png', size: 10, type: 'image/png' }, { name: 'b.png', size: 10, type: 'image/png' }]);
    expect(h.upload).toHaveBeenCalledTimes(2);
    expect(added).toEqual([{ path: 'p2' }]);
    expect(h.slots[2]).toEqual(['a.png: Could not start the upload. Try again.']);
  });

  it('is never busy for a pick with nothing to upload', async () => {
    const busy = vi.fn();
    await pick({ onBusy: busy }, [{ name: 'mood.gif', size: 10, type: 'image/gif' }]);
    expect(busy).not.toHaveBeenCalled();
    expect(h.upload).not.toHaveBeenCalled();
  });

  // A tall screenshot cut into parts, as prepareShot gives them.
  const cut = (name, height) => {
    const plan = planTiles({ width: 1440, height });
    return { files: plan.tiles.map((t) => ({ name: `${name} (part ${t.part} of ${plan.tiles.length}).jpg`, size: 500, type: 'image/jpeg' })), plan };
  };

  it('uploads a tall screenshot\'s parts one by one as one group, top first, and says how it was cut', async () => {
    const seen = [];
    h.prepare.mockImplementation(async (f) => (f.name === 'long.png' ? cut('long', 12000) : { files: [f], plan: null }));
    h.upload.mockImplementation(async (id, f, o) => {
      o.onProgress('upload');
      // What the panel says while this part goes up.
      seen.push(h.slots[1]);
      o.onProgress('save');
      return { asset: { path: f.name, group: o.group, part: o.part }, project: { id } };
    });
    const added = [];
    const busy = [];
    await pick({ sourceUrl: 'https://ref-site.test/', onAdded: (a) => added.push(a), onBusy: (b) => busy.push([b, added.length]) }, [
      { name: 'long.png', size: 2000, type: 'image/png' }, { name: 'contact.png', size: 1000, type: 'image/png' },
    ]);
    // Busy from before the first part until after the last one.
    expect(busy).toEqual([[true, 0], [false, 5]]);
    expect(h.upload.mock.calls.map(([, f, o]) => [f.name, o.group, o.part, o.note])).toEqual([
      ['long (part 1 of 4).jpg', 'group-0001', 1, 'Screenshot of https://ref-site.test/'],
      ['long (part 2 of 4).jpg', 'group-0001', 2, 'Screenshot of https://ref-site.test/'],
      ['long (part 3 of 4).jpg', 'group-0001', 3, 'Screenshot of https://ref-site.test/'],
      ['long (part 4 of 4).jpg', 'group-0001', 4, 'Screenshot of https://ref-site.test/'],
      ['contact.png', undefined, undefined, 'Screenshot of https://ref-site.test/'],
    ]);
    expect(h.upload.mock.calls[4][2]).not.toHaveProperty('group');
    expect(added.map((a) => a.path)).toEqual([1, 2, 3, 4].map((n) => `long (part ${n} of 4).jpg`).concat('contact.png'));
    expect(seen.map((st) => [st.index, st.total, st.name, st.phase, st.part, st.parts])).toEqual([
      [0, 2, 'long.png', 'upload', 1, 4], [0, 2, 'long.png', 'upload', 2, 4], [0, 2, 'long.png', 'upload', 3, 4], [0, 2, 'long.png', 'upload', 4, 4],
      [1, 2, 'contact.png', 'upload', 1, 1],
    ]);
    // The cut is said, with what of the page was left out; nothing failed.
    expect(h.slots[3]).toEqual([{
      name: 'long.png',
      text: 'Split into 4 parts, top first. The bottom 20% of the page was left out: a match looks at the top 4 parts only.',
    }]);
    expect(h.slots[2]).toEqual([]);
    expect(h.slots[1]).toBeNull();
  });

  it('stops a cut-up screenshot at a failed part, keeps the parts above it, and goes on with the next file', async () => {
    h.prepare.mockImplementation(async (f) => (f.name === 'long.png' ? cut('long', 5000) : { files: [f], plan: null }));
    h.upload.mockImplementation(async (id, f) => {
      if (f.name === 'long (part 2 of 3).jpg') throw new Error('Network down');
      return { asset: { path: f.name }, project: { id } };
    });
    const added = [];
    const busy = [];
    await pick({ onAdded: (a) => added.push(a.path), onBusy: (b) => busy.push(b) }, [{ name: 'long.png', size: 2000, type: 'image/png' }, { name: 'b.png', size: 10, type: 'image/png' }]);
    // A failure still ends the busy state.
    expect(busy).toEqual([true, false]);
    expect(h.upload.mock.calls.map(([, f]) => f.name)).toEqual(['long (part 1 of 3).jpg', 'long (part 2 of 3).jpg', 'b.png']);
    expect(added).toEqual(['long (part 1 of 3).jpg', 'b.png']);
    expect(h.slots[2]).toEqual(['long.png stopped at part 2 of 3: Network down']);
    expect(h.slots[3]).toEqual([{ name: 'long.png', text: 'Split into 3 parts, top first.' }]);
  });
});

// The real module (the panels above get a stand-in).
const real = await vi.importActual('../../../lib/customSites.js');

describe('uploadReferenceShot', () => {
  const bodies = [];

  beforeEach(() => {
    bodies.length = 0;
    h.storage = vi.fn(async () => ({ error: null }));
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      bodies.push(body);
      const out = body.action === 'reference-upload-url'
        ? { path: `${PID}/reference/x.jpg`, uploadToken: 'up', type: 'image/jpeg' }
        : { asset: { path: `${PID}/reference/x.jpg` }, project: { id: PID } };
      return { ok: true, json: async () => out };
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const tile = { name: 'long (part 2 of 3).jpg', size: 500, type: 'image/jpeg' };

  it('records a part with its group and place', async () => {
    const phases = [];
    const res = await real.uploadReferenceShot(PID, tile, { note: 'Screenshot of https://ref-site.test/', group: 'group-0001', part: 2, onProgress: (p) => phases.push(p) });
    expect(res).toEqual({ asset: { path: `${PID}/reference/x.jpg` }, project: { id: PID } });
    expect(phases).toEqual(['upload', 'save']);
    expect(h.storage).toHaveBeenCalledWith(`${PID}/reference/x.jpg`, 'up', tile, { contentType: 'image/jpeg' });
    expect(bodies.map((b) => b.action)).toEqual(['reference-upload-url', 'reference-add']);
    expect(bodies[1]).toEqual({
      action: 'reference-add', id: PID, path: `${PID}/reference/x.jpg`, name: 'long (part 2 of 3).jpg', size: 500, type: 'image/jpeg',
      note: 'Screenshot of https://ref-site.test/', group: 'group-0001', part: 2,
    });
  });

  it('sends neither for a single screenshot', async () => {
    await real.uploadReferenceShot(PID, { name: 'home.png', size: 10, type: 'image/png' }, { note: '' });
    expect(bodies[1]).not.toHaveProperty('group');
    expect(bodies[1]).not.toHaveProperty('part');
  });
});
