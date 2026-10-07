// The Design step's "Reference sites" wiring (CustomSiteDesign.jsx
// DesignSetup + ReferenceSection): a replica request turns ready once this
// project's replica template is in the build (withBuiltReplica), what a
// request or cancel saves (saveReference -> design-save), a screenshot the
// team adds showing at once and then the fresh lists (onShotAdded), the
// parts of a cut-up screenshot listed as one reference, what SuggestPanel
// gets (the fresh project, the page's reference choice and its "Use their
// brand color" toggle), and the sites the team adds by address: the add box
// (design-save, then reference-capture), the capture's statuses while the
// page polls (and the poller's clock and cleanup), matching one like a site
// the customer listed, a match on a captured part following a recapture,
// and removing one.
//
// The tests run in node without a DOM: the React hooks are replaced by a
// tiny hook store (one per component), each component is called as a
// function, and its handlers are invoked straight from the returned
// element tree. Lazy panels (SuggestPanel, ReferenceShotUpload) are never
// rendered: their props are read off the tree.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  PID: '11111111-2222-4333-8444-555555555555',
  store: {},
  cur: null,
  i: 0,
  admin: null,
  capture: null,
  toast: null,
  // Set to a list to collect the effects of the components called (they
  // never run otherwise).
  effects: null,
}));

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal();
  const slot = (init) => {
    const i = h.i++;
    if (!(i in h.cur)) h.cur[i] = init();
    return i;
  };
  return {
    ...real,
    useState: (init) => {
      const store = h.cur;
      const i = slot(() => (typeof init === 'function' ? init() : init));
      const set = (v) => { store[i] = typeof v === 'function' ? v(store[i]) : v; };
      return [store[i], set];
    },
    useRef: (v) => h.cur[slot(() => ({ current: v }))],
    useMemo: (fn) => fn(),
    useEffect: (fn) => { if (h.effects) h.effects.push(fn); },
    useId: () => 'id-1',
  };
});

// Two replica templates built for this project (contract naming: id
// replica_<8 chars of the project id>, label "Exact replica").
vi.mock('../../data/templates.js', async (importOriginal) => {
  const m = await importOriginal();
  const replica = (id) => ({
    ...m.TEMPLATES.mobile_chrome, id, label: 'Exact replica', description: 'Built from a reference site for one customer.', hidden: true, customFor: [h.PID],
  });
  return { ...m, TEMPLATES: { ...m.TEMPLATES, replica_11111111: replica('replica_11111111'), replica_11111111_v2: replica('replica_11111111_v2') } };
});

vi.mock('../../lib/customSites.js', () => ({
  customSiteAdmin: (...a) => h.admin(...a),
  captureReference: (...a) => h.capture(...a),
  customSiteSuggest: vi.fn(),
  uploadReferenceShot: vi.fn(),
  importAssetToSite: vi.fn(),
  startDesignRun: vi.fn(),
}));
// A session for the real customSites.js (its captureReference test below).
vi.mock('../../lib/supabase.js', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'token-1' } } }) } },
}));
vi.mock('../ui/AlertProvider.jsx', () => ({
  default: ({ children }) => children,
  useAlert: () => ({ toast: (...a) => h.toast(...a), confirm: async () => true }),
}));

const { DesignSetup, watchCapture } = await import('./CustomSiteDesign.jsx');
const { checkReferenceChoice, referenceShots } = await import('../../lib/designSuggest.js');

const PID = h.PID;
const OTHER = '99999999-2222-4333-8444-555555555555';
const refPath = (id, n, ext = 'png') => `${id}/reference/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.${ext}`;
const SHOT = { path: refPath(PID, 1), kind: 'reference', name: 'home.png', size: 10, type: 'image/png', note: 'Screenshot of https://ref.test/', addedBy: 'admin' };
const withLink = (a) => ({ ...a, url: `https://files.test/${a.name}`, downloadUrl: `https://files.test/${a.name}?download` });
const BY_URL = { kind: 'url', url: 'https://ref.test/' };

function makeProject({ id = PID, design = {}, form = {}, assets = id === PID ? [SHOT] : [] } = {}) {
  return {
    id,
    client_first_name: 'Sam',
    business_name: 'Gloss Boss',
    form: { businessType: 'mobile_detailing', colorMode: 'mine', colors: ['#cc0000'], referenceSites: [{ url: 'ref.test', note: 'love it' }], ...form },
    assets,
    files: assets.map(withLink),
    design: {
      businessInfo: { businessName: 'Gloss Boss', businessType: 'mobile_detailing' },
      templateId: 'mobile_chrome',
      useBrand: true,
      reference: { mode: 'match', source: BY_URL, replica: { status: 'none' } },
      ...design,
    },
  };
}

// Every element of a returned tree (not descending into child components).
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
function call(scope, Component, props) {
  h.store[scope] ||= [];
  h.cur = h.store[scope];
  h.i = 0;
  return elements(Component(props));
}

// The setup page as it renders now, with the two panels' props.
function page(project) {
  const els = call('setup', DesignSetup, { project, onBack: () => {}, onStarted: () => {} });
  const refs = els.find((e) => typeof e.type === 'function' && e.type.name === 'ReferenceSection');
  const suggest = els.find((e) => e.props && 'onReferenceAdded' in e.props);
  // The "Use their brand color" checkbox (only with brand colors given).
  const brandLabel = els.find((e) => e.type === 'label' && textOf(e).includes('Use their brand color'));
  const brandBox = brandLabel && elements(brandLabel).find((e) => e.type === 'input');
  const alert = els.find((e) => e.props?.role === 'alert');
  return { els, refs, suggest, brandBox, alert: alert ? textOf(alert) : '' };
}
// The Reference sites section itself, from the props the page gave it.
const section = (refs) => call('refs', refs.type, refs.props);
const buttonNamed = (els, name) => els.find((e) => e.type === 'button' && textOf(e).trim() === name);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  h.store = {};
  h.effects = null;
  h.admin = vi.fn(async () => ({}));
  h.capture = vi.fn(async () => ({}));
  h.toast = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the exact-replica request', () => {
  const requested = { status: 'requested', requestedAt: '2026-10-06T10:00:00.000Z', templateId: '', note: 'the hero' };

  it('turns ready once this project\'s replica is in the build, naming the first one', () => {
    const { refs, suggest } = page(makeProject({ design: { reference: { mode: 'match', source: BY_URL, replica: requested } } }));
    expect(refs.props.replicas.map((t) => t.id)).toEqual(['replica_11111111', 'replica_11111111_v2']);
    expect(refs.props.reference).toEqual({ mode: 'match', source: BY_URL, replica: { ...requested, status: 'ready', templateId: 'replica_11111111' } });
    // Suggest a design gets the same choice.
    expect(suggest.props.reference).toBe(refs.props.reference);
  });

  it('names the replica in use, else the one the request named', () => {
    const inUse = page(makeProject({ design: { templateId: 'replica_11111111_v2', reference: { mode: 'match', source: BY_URL, replica: requested } } }));
    expect(inUse.refs.props.reference.replica).toMatchObject({ status: 'ready', templateId: 'replica_11111111_v2' });
    h.store = {};
    const named = page(makeProject({ design: { reference: { mode: 'match', source: BY_URL, replica: { ...requested, status: 'building', templateId: 'replica_11111111_v2' } } } }));
    expect(named.refs.props.reference.replica).toMatchObject({ status: 'ready', templateId: 'replica_11111111_v2' });
  });

  it('switches to a ready replica from the section, and the request follows', () => {
    const project = makeProject({ design: { reference: { mode: 'match', source: BY_URL, replica: requested } } });
    const { refs } = page(project);
    const ready = section(refs);
    expect(ready.filter((e) => e.type === 'button' && textOf(e) === 'Use this template')).toHaveLength(2);
    // The second one's button.
    ready.filter((e) => e.type === 'button' && textOf(e) === 'Use this template')[1].props.onClick();
    const after = page(project);
    expect(after.refs.props.templateId).toBe('replica_11111111_v2');
    expect(after.refs.props.reference.replica.templateId).toBe('replica_11111111_v2');
    expect(after.suggest.props.current.templateId).toBe('replica_11111111_v2');
    // One row per replica: the second is the one in use now.
    const rows = section(after.refs).filter((e) => e.type === 'div' && (textOf(e).match(/Ready:/g) || []).length === 1);
    expect(rows.map((r) => textOf(r).includes('In use'))).toEqual([false, true]);
  });

  it('stays as it is for another project (no replica of theirs is built)', () => {
    const { refs } = page(makeProject({ id: OTHER, design: { reference: { mode: 'match', source: BY_URL, replica: requested } } }));
    expect(refs.props.replicas).toEqual([]);
    expect(refs.props.reference.replica).toEqual(requested);
  });
});

describe('saveReference', () => {
  it('saves the whole page with a request, ready at once when the replica is built', async () => {
    const project = makeProject();
    const { refs } = page(project);
    const next = { ...refs.props.reference, replica: { status: 'requested', requestedAt: '2026-10-06T10:00:00.000Z', templateId: '', note: 'hero' } };
    await refs.props.onSave(next, 'Replica requested');
    expect(h.admin).toHaveBeenCalledTimes(1);
    const [action, body] = h.admin.mock.calls[0];
    expect(action).toBe('design-save');
    expect(body.id).toBe(PID);
    expect(body.design).toMatchObject({
      templateId: 'mobile_chrome',
      useBrand: true,
      businessInfo: expect.objectContaining({ businessName: 'Gloss Boss', businessType: 'mobile_detailing' }),
      reference: {
        mode: 'match', source: BY_URL,
        replica: { status: 'ready', requestedAt: '2026-10-06T10:00:00.000Z', templateId: 'replica_11111111', note: 'hero' },
      },
    });
    expect(h.toast).toHaveBeenCalledWith('Replica requested', 'success');
    expect(page(project).refs.props.busy).toBe('');
  });

  it('sends the request from the section\'s button, with the note typed there', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-06T12:30:00.000Z'));
    const project = makeProject({ id: OTHER });
    const { refs } = page(project);
    section(refs);
    // The admin typed what to copy (the section's first state).
    h.store.refs[0] = 'the services grid';
    await buttonNamed(section(refs), 'Request exact replica').props.onClick();
    const [action, body] = h.admin.mock.calls[0];
    expect(action).toBe('design-save');
    expect(body.design.reference).toEqual({
      mode: 'match', source: BY_URL,
      replica: { status: 'requested', requestedAt: '2026-10-06T12:30:00.000Z', templateId: '', note: 'the services grid' },
    });
    // Saved: the page now shows the request and the prompt to paste.
    const after = page(project);
    expect(after.refs.props.reference.replica.status).toBe('requested');
    expect(textOf(section(after.refs).find((e) => e.type === 'code'))).toBe(
      `Build the exact replica template for custom website project ${OTHER} (Gloss Boss). `
      + 'Copy only its layout, structure, spacing, type feel and component style, never the reference\'s words, photos, logo, brand marks or name.',
    );
  });

  it('shows a request only once it is saved', async () => {
    const project = makeProject({ id: OTHER });
    const { refs } = page(project);
    const save = deferred();
    h.admin.mockReturnValueOnce(save.promise);
    const done = refs.props.onSave({ ...refs.props.reference, replica: { status: 'requested', requestedAt: '2026-10-06T10:00:00.000Z', note: '' } }, 'Replica requested');
    // While it saves: busy, still no request.
    const saving = page(project);
    expect(saving.refs.props.busy).toBe('save');
    expect(saving.suggest.props.disabled).toBe(true);
    save.reject(new Error('Could not save the design'));
    await done;
    const after = page(project);
    expect(after.refs.props.reference.replica.status).toBe('none');
    expect(after.refs.props.busy).toBe('');
    expect(after.alert).toBe('Could not save the design');
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('cancels a request: nothing of it is kept', async () => {
    const project = makeProject({ id: OTHER, design: { reference: { mode: 'match', source: BY_URL, replica: { status: 'building', requestedAt: '2026-10-06T10:00:00.000Z', note: 'hero' } } } });
    const { refs } = page(project);
    await buttonNamed(section(refs), 'Cancel the request').props.onClick();
    expect(h.admin.mock.calls[0][1].design.reference.replica).toEqual({ status: 'none', requestedAt: '', templateId: '', note: '' });
    expect(h.toast).toHaveBeenCalledWith('Replica request cancelled', 'success');
    expect(page(project).refs.props.reference.replica.status).toBe('none');
  });
});

describe('a screenshot the team adds (onShotAdded)', () => {
  const NEW = { path: refPath(PID, 2, 'jpg'), kind: 'reference', name: 'contact.jpg', size: 20, type: 'image/jpeg', note: 'Screenshot of https://ref.test/', addedBy: 'admin' };

  it('shows at once, in both panels, then the fresh lists', async () => {
    const project = makeProject();
    const { refs } = page(project);
    const get = deferred();
    h.admin.mockReturnValueOnce(get.promise);
    const row = { id: PID, assets: [SHOT, NEW] };
    const done = refs.props.onShotAdded(withLink(NEW), row);
    expect(h.admin).toHaveBeenCalledWith('get', { id: PID });
    const now = page(project);
    expect(now.refs.props.files.map((f) => f.path)).toEqual([SHOT.path, NEW.path]);
    expect(now.suggest.props.project.files.map((f) => f.path)).toEqual([SHOT.path, NEW.path]);
    expect(now.suggest.props.project.assets).toBe(row.assets);
    // The project's other fields stay.
    expect(now.suggest.props.project).toMatchObject({ id: PID, business_name: 'Gloss Boss', form: project.form });
    // Then the fresh lists (signed links for every file).
    const fresh = { files: [SHOT, NEW].map(withLink).map((f) => ({ ...f, url: `${f.url}?fresh` })), assets: [SHOT, NEW] };
    get.resolve({ project: fresh });
    await done;
    const after = page(project);
    expect(after.refs.props.files).toBe(fresh.files);
    expect(after.suggest.props.project.files).toBe(fresh.files);
    expect(after.suggest.props.project.assets).toBe(fresh.assets);
  });

  it('keeps only the latest refresh when an older one lands last', async () => {
    const project = makeProject();
    const { refs } = page(project);
    const first = deferred();
    const second = deferred();
    h.admin.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const a = refs.props.onShotAdded(withLink(NEW), { assets: [SHOT, NEW] });
    const b = refs.props.onShotAdded(withLink({ ...NEW, path: refPath(PID, 3, 'jpg'), name: 'more.jpg' }), { assets: [SHOT, NEW] });
    const latest = { files: [withLink(SHOT)], assets: [SHOT] };
    second.resolve({ project: latest });
    await b;
    first.resolve({ project: { files: [], assets: [] } });
    await a;
    const after = page(project);
    expect(after.refs.props.files).toBe(latest.files);
    expect(after.suggest.props.project.assets).toBe(latest.assets);
  });

  it('without the saved row, keeps the new asset without its links, once', async () => {
    const project = makeProject();
    const { refs } = page(project);
    h.admin.mockReturnValue(new Promise(() => {}));
    refs.props.onShotAdded(withLink(NEW));
    refs.props.onShotAdded(withLink(NEW));
    const now = page(project);
    expect(now.suggest.props.project.assets).toEqual([SHOT, NEW]);
    expect(now.refs.props.files.map((f) => f.path)).toEqual([SHOT.path, NEW.path]);
  });

  it('says when the list didn\'t refresh', async () => {
    const { refs } = page(makeProject());
    h.admin.mockRejectedValueOnce(new Error('offline'));
    await refs.props.onShotAdded(withLink(NEW), { assets: [SHOT, NEW] });
    expect(h.toast).toHaveBeenCalledWith('Added, but the list didn\'t refresh (offline)', 'error');
  });

  it('is what both upload spots hand their screenshots to', () => {
    const { refs, suggest } = page(makeProject());
    expect(suggest.props.onReferenceAdded).toBe(refs.props.onShotAdded);
    const upload = section(refs).find((e) => e.props && e.props.projectId === PID && 'onAdded' in e.props);
    expect(upload.props.onAdded).toBe(refs.props.onShotAdded);
    // A matched address labels the screenshots added there as its own.
    expect(upload.props.sourceUrl).toBe('https://ref.test/');
  });

  it('holds Suggest a design\'s match while a pick uploads here', () => {
    const project = makeProject();
    const { refs, suggest } = page(project);
    expect(suggest.props.uploading).toBe(false);
    const upload = section(refs).find((e) => e.props && e.props.projectId === PID && 'onBusy' in e.props);
    expect(upload.props.onBusy).toBe(refs.props.onShotBusy);
    // Two picks overlap: still uploading until both are done.
    upload.props.onBusy(true);
    upload.props.onBusy(true);
    expect(page(project).suggest.props.uploading).toBe(true);
    upload.props.onBusy(false);
    expect(page(project).suggest.props.uploading).toBe(true);
    upload.props.onBusy(false);
    expect(page(project).suggest.props.uploading).toBe(false);
    // An extra "done" never goes below none.
    upload.props.onBusy(false);
    upload.props.onBusy(true);
    expect(page(project).suggest.props.uploading).toBe(true);
  });
});

describe('a cut-up screenshot in the list', () => {
  const part = (n, group = 'group-0001') => ({
    path: refPath(PID, 10 + n, 'jpg'), kind: 'reference', name: `long (part ${n} of 3).jpg`, size: 10, type: 'image/jpeg',
    note: 'Screenshot of https://ref.test/', addedBy: 'admin', group, part: n,
  });

  it('shows as one reference, top part first, and a match on any part shows on it', () => {
    // Recorded out of order, with another screenshot between the parts.
    const assets = [part(2), SHOT, part(1), part(3)];
    const project = makeProject({ assets, design: { reference: { mode: 'match', source: { kind: 'asset', path: part(2).path }, replica: { status: 'none' } } } });
    const { refs } = page(project);
    const items = section(refs).filter((e) => e.type === 'li');
    const texts = items.map(textOf);
    // The site they listed, the cut-up screenshot, the single one.
    expect(items).toHaveLength(3);
    expect(texts[1]).toContain('long.jpg3 parts, top first');
    expect(texts[2]).toContain('home.png');
    expect(texts[2]).not.toContain('parts, top first');
    const thumb = elements(items[1]).find((e) => e.type === 'img');
    expect(thumb.props.src).toBe(withLink(part(1)).url);
    // The match (saved on part 2) is this item.
    const radios = (li) => elements(li).filter((e) => e.type === 'input' && e.props.type === 'radio');
    expect(radios(items[1]).map((r) => r.props.checked)).toEqual([false, true]);
    expect(radios(items[2]).map((r) => r.props.checked)).toEqual([true, false]);
    expect(textOf(section(refs).find((e) => e.type === 'p' && textOf(e).startsWith('Suggest a design will mirror')))).toContain('long.jpg');
    // Matching it picks the top part (the run sends them all, top first).
    radios(items[2])[1].props.onChange();
    expect(page(project).refs.props.reference.source).toEqual({ kind: 'asset', path: SHOT.path });
    radios(section(page(project).refs).filter((e) => e.type === 'li')[1])[1].props.onChange();
    expect(page(project).refs.props.reference.source).toEqual({ kind: 'asset', path: part(1).path });
  });

  it('counts it as one screenshot of a matched address', () => {
    const project = makeProject({ assets: [part(1), part(2), part(3), SHOT] });
    const { refs } = page(project);
    // What the section says for the screenshots the run would send.
    const said = (shots) => {
      const els = call('refs', refs.type, { ...refs.props, urlShots: () => shots });
      return textOf(els.find((e) => e.type === 'p' && textOf(e).startsWith('Matched from')));
    };
    expect(said([part(1), part(2), part(3)])).toContain('Matched from its screenshot in 3 parts, top first, labeled "Screenshot of ref.test".');
    expect(said([part(1), part(2), part(3), SHOT])).toContain('Matched from its 2 screenshots in 4 parts, top first, labeled');
    expect(said([SHOT])).toContain('Matched from its screenshot, labeled');
    expect(said([SHOT, { ...SHOT, path: refPath(PID, 9) }])).toContain('Matched from its 2 screenshots, top first, labeled');
  });

  it('names it as one screenshot under a replica request', () => {
    const parts = [part(1, 'group-0002'), part(2, 'group-0002')].map((p) => ({ ...p, path: refPath(OTHER, 20 + p.part, 'jpg') }));
    const project = makeProject({
      id: OTHER, assets: parts,
      design: { reference: { mode: 'match', source: { kind: 'asset', path: parts[1].path }, replica: { status: 'requested', requestedAt: '2026-10-06T10:00:00.000Z', note: '' } } },
    });
    const status = section(page(project).refs).find((e) => e.type === 'p' && textOf(e).startsWith('Requested'));
    expect(textOf(status)).toContain(' · from long.jpg');
  });
});

describe('what Suggest a design gets', () => {
  it('the page\'s brand-color toggle, as it is now', () => {
    const project = makeProject();
    const first = page(project);
    expect(first.suggest.props.useBrand).toBe(true);
    first.brandBox.props.onChange({ target: { checked: false } });
    const after = page(project);
    expect(after.suggest.props.useBrand).toBe(false);
    // Not saved: the project it gets still has the saved setting.
    expect(after.suggest.props.project.design.useBrand).toBe(true);
  });

  it('starts from the saved toggle, and off without brand colors', () => {
    expect(page(makeProject({ design: { useBrand: false } })).suggest.props.useBrand).toBe(false);
    h.store = {};
    const noColors = page(makeProject({ form: { colorMode: 'logo', colors: [] } }));
    expect(noColors.suggest.props.useBrand).toBe(false);
    expect(noColors.brandBox).toBeUndefined();
  });

  it('the fresh project and the page\'s reference choice, changed or not', () => {
    const project = makeProject({ design: { reference: { mode: 'inspire', source: null, replica: { status: 'none' } } } });
    const { refs, suggest } = page(project);
    expect(suggest.props.project).toMatchObject({ id: PID, files: project.files, assets: project.assets });
    expect(suggest.props.reference.mode).toBe('inspire');
    // Choosing "Match its layout" on the listed site (not saved yet).
    const site = section(refs).filter((e) => e.type === 'li')[0];
    elements(site).filter((e) => e.type === 'input' && e.props.type === 'radio')[1].props.onChange();
    const after = page(project);
    expect(after.suggest.props.reference).toMatchObject({ mode: 'match', source: BY_URL });
    expect(after.suggest.props.reference).toBe(after.refs.props.reference);
  });
});

// ─── Sites the team adds by address ──────────────────────────────────

describe('sites the team adds by address (design.referenceSites)', () => {
  const NOW = '2026-10-07T12:00:30.000Z';
  const SHOP = { kind: 'url', url: 'https://shop.test/' };
  const TEAM_SITE = { url: 'https://shop.test/', note: 'the hero', addedAt: '2026-10-07T11:00:00.000Z' };
  const RUNNING = { status: 'running', url: 'https://shop.test/', startedAt: '2026-10-07T12:00:00.000Z', finishedAt: '', parts: 0, error: '' };
  const READY = { ...RUNNING, status: 'ready', finishedAt: '2026-10-07T12:00:40.000Z', parts: 2 };
  const FAILED = { ...RUNNING, status: 'failed', finishedAt: '2026-10-07T12:00:40.000Z', error: 'That site didn\'t load in 25 seconds' };
  // A part of the server's capture, as custom-site-capture-background stores it.
  const capturedPart = (n) => ({
    path: refPath(PID, 30 + n, 'jpg'), kind: 'reference', name: `shop.test (part ${n} of 2).jpg`, size: 10, type: 'image/jpeg',
    note: 'Screenshot of https://shop.test/ - the hero', addedBy: 'admin', group: 'capture-0001', part: n, captured: true,
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });

  const team = (design = {}, opts = {}) => makeProject({ ...opts, design: { referenceSites: [TEAM_SITE], ...design } });
  const listItems = (refs, props = {}) => section({ ...refs, props: { ...refs.props, ...props } }).filter((e) => e.type === 'li');
  const itemFor = (refs, title, props) => listItems(refs, props).find((li) => textOf(li).includes(title));
  const inputNamed = (els, label) => els.find((e) => e.type === 'input' && e.props['aria-label'] === label);
  const watcher = (els) => els.find((e) => typeof e.type === 'function' && e.type.name === 'CaptureWatch');
  const radios = (li) => elements(li).filter((e) => e.type === 'input' && e.props.type === 'radio');

  it('lists them after the sites the customer listed, labeled as the team\'s, with their note', () => {
    const { refs } = page(team());
    expect(refs.props.teamSites).toEqual([TEAM_SITE]);
    const items = listItems(refs);
    const texts = items.map(textOf);
    expect(texts[0]).toContain('ref.test');
    expect(texts[0]).not.toContain('Added by the team');
    expect(texts[1]).toContain('shop.testAdded by the team');
    expect(texts[1]).toContain('Note: "the hero"');
    // Only the team's own sites can be removed here.
    expect(elements(items[0]).some((e) => e.type === 'button' && textOf(e).trim() === 'Remove')).toBe(false);
    expect(elements(items[1]).find((e) => e.type === 'button' && textOf(e).trim() === 'Remove').props['aria-label']).toBe('Remove shop.test');
  });

  it('is matched like a site the customer listed: its captured parts, found by their note, top first', () => {
    const assets = [SHOT, capturedPart(2), capturedPart(1)];
    const project = team({}, { assets });
    const { refs } = page(project);
    // Match its layout on the team's site.
    radios(itemFor(refs, 'shop.test'))[1].props.onChange();
    const after = page(project);
    expect(after.refs.props.reference).toMatchObject({ mode: 'match', source: SHOP });
    expect(after.suggest.props.reference).toBe(after.refs.props.reference);
    // The run's own rule (designSuggest.js): the server accepts it and sends
    // both parts, top first, as it does for the customer's ref.test and its
    // screenshot.
    const check = checkReferenceChoice(after.suggest.props.reference, after.suggest.props.project);
    expect(check.error).toBe('');
    expect(check.shots.map((a) => a.path)).toEqual([capturedPart(1).path, capturedPart(2).path]);
    expect(checkReferenceChoice({ mode: 'match', source: BY_URL }, after.suggest.props.project).shots.map((a) => a.path)).toEqual([SHOT.path]);
    // The section says so, from the page's urlShots rule, and shows the top part.
    const urlShots = (source) => referenceShots(source, assets);
    const li = itemFor(after.refs, 'shop.test', { urlShots });
    expect(radios(li).map((r) => r.props.checked)).toEqual([false, true]);
    expect(textOf(li)).toContain('Matched from its screenshot in 2 parts, top first, labeled "Screenshot of shop.test".');
    expect(elements(li).find((e) => e.type === 'img').props.src).toBe(withLink(capturedPart(1)).url);
    // Its parts were captured: the button retakes them.
    expect(elements(li).some((e) => e.type === 'button' && textOf(e) === 'Capture again')).toBe(true);
  });

  it('adds a site from the box: saves the page with it, then captures it', async () => {
    const project = makeProject();
    const { refs } = page(project);
    expect(buttonNamed(section(refs), 'Add').props.disabled).toBe(true);
    inputNamed(section(refs), 'Site address').props.onChange({ target: { value: ' Shop.test/pricing ' } });
    inputNamed(section(refs), 'What to copy from it (optional)').props.onChange({ target: { value: 'the services grid' } });
    const pricing = { ...RUNNING, url: 'https://shop.test/pricing' };
    h.capture.mockResolvedValueOnce({ capture: pricing });
    const add = buttonNamed(section(refs), 'Add');
    expect(add.props.disabled).toBe(false);
    await add.props.onClick();

    expect(h.admin).toHaveBeenCalledTimes(1);
    const [action, body] = h.admin.mock.calls[0];
    expect(action).toBe('design-save');
    expect(body.id).toBe(PID);
    const site = { url: 'https://shop.test/pricing', note: 'the services grid', addedAt: NOW };
    // The whole page, as Save sends it, with the site.
    expect(body.design).toMatchObject({
      templateId: 'mobile_chrome', referenceSites: [site], reference: { mode: 'match', source: BY_URL },
      businessInfo: expect.objectContaining({ businessName: 'Gloss Boss' }),
    });
    // Then the capture, with the team's note (never the customer's words).
    expect(h.capture).toHaveBeenCalledWith(PID, 'https://shop.test/pricing', 'the services grid');
    // The box is empty again; the site is listed, capturing.
    expect(inputNamed(section(refs), 'Site address').props.value).toBe('');
    expect(inputNamed(section(refs), 'What to copy from it (optional)').props.value).toBe('');
    const after = page(project);
    expect(after.refs.props.teamSites).toEqual([site]);
    expect(after.refs.props.capture).toEqual(pricing);
    const li = itemFor(after.refs, 'shop.test/pricing');
    expect(textOf(elements(li).find((e) => e.props.role === 'status'))).toContain('Capturing…');
    // ... and the page polls while it goes.
    expect(watcher(after.els)).toBeTruthy();
    // A later Save keeps the site.
    await buttonNamed(after.els, 'Save').props.onClick();
    expect(h.admin.mock.calls.at(-1)[1].design.referenceSites).toEqual([site]);
  });

  it('refuses an address it can\'t use, one already listed, and an eleventh', async () => {
    const { refs } = page(makeProject());
    expect(await refs.props.onAddSite('javascript:alert(1)', '')).toEqual({ error: 'Enter a web address, like shopname.com.' });
    expect(await refs.props.onAddSite('localhost:8888', '')).toEqual({ error: 'Enter a web address, like shopname.com.' });
    // The customer listed ref.test already.
    expect(await refs.props.onAddSite('https://www.REF.test/', '')).toEqual({ error: 'That site is already in the list.' });
    h.store = {};
    const ten = Array.from({ length: 10 }, (_, i) => ({ url: `https://site${i}.test/`, note: '', addedAt: '' }));
    const full = page(makeProject({ design: { referenceSites: ten } }));
    expect(await full.refs.props.onAddSite('https://site3.test', '')).toEqual({ error: 'That site is already in the list.' });
    expect(await full.refs.props.onAddSite('https://new.test', '')).toEqual({ error: 'The team can add up to 10 sites.' });
    expect(buttonNamed(section(full.refs), 'Add').props.disabled).toBe(true);
    expect(h.admin).not.toHaveBeenCalled();
    expect(h.capture).not.toHaveBeenCalled();
    // The box shows why.
    h.store = {};
    const { refs: again } = page(makeProject());
    inputNamed(section(again), 'Site address').props.onChange({ target: { value: 'ref.test' } });
    await buttonNamed(section(again), 'Add').props.onClick();
    expect(textOf(section(again).find((e) => e.props?.role === 'alert'))).toBe('That site is already in the list.');
    expect(inputNamed(section(again), 'Site address').props.value).toBe('ref.test');
  });

  it('a failed save keeps the box as it was and captures nothing', async () => {
    const project = makeProject();
    const { refs } = page(project);
    inputNamed(section(refs), 'Site address').props.onChange({ target: { value: 'shop.test' } });
    h.admin.mockRejectedValueOnce(new Error('Could not save the design'));
    await buttonNamed(section(refs), 'Add').props.onClick();
    expect(h.capture).not.toHaveBeenCalled();
    expect(inputNamed(section(refs), 'Site address').props.value).toBe('shop.test');
    const after = page(project);
    expect(after.alert).toBe('Could not save the design');
    expect(after.refs.props.teamSites).toEqual([]);
    expect(after.refs.props.busy).toBe('');
  });

  it('polls while it captures, then shows the screenshots at once', async () => {
    const project = team({ capture: RUNNING, reference: { mode: 'match', source: SHOP, replica: { status: 'none' } } });
    const first = page(project);
    expect(textOf(itemFor(first.refs, 'shop.test'))).toContain('Capturing…');
    // Suggest a design holds a match on it until the parts are in.
    expect(first.suggest.props.uploading).toBe(true);
    // No capture can start while one goes.
    expect(elements(itemFor(first.refs, 'ref.test')).find((e) => e.type === 'button' && textOf(e) === 'Capture screenshots').props.disabled).toBe(true);
    const watch = watcher(first.els);
    expect(watch).toBeTruthy();

    // A poll while it still runs: only the run is taken (new signed links
    // would reload every thumbnail).
    h.admin.mockResolvedValueOnce({ project: { id: PID, design: { capture: RUNNING }, files: [], assets: [] } });
    watch.props.onResult(await watch.props.load());
    expect(h.admin).toHaveBeenLastCalledWith('get', { id: PID });
    let now = page(project);
    expect(now.refs.props.files).toBe(project.files);
    expect(watcher(now.els)).toBeTruthy();

    // It ended: the run, and the fresh lists with its parts.
    const assets = [SHOT, capturedPart(1), capturedPart(2)];
    const fresh = { id: PID, design: { capture: READY }, files: assets.map(withLink), assets };
    h.admin.mockResolvedValueOnce({ project: fresh });
    watch.props.onResult(await watch.props.load());
    now = page(project);
    expect(now.refs.props.capture).toBe(READY);
    expect(now.refs.props.files).toBe(fresh.files);
    expect(now.suggest.props.project.assets).toBe(fresh.assets);
    expect(now.suggest.props.uploading).toBe(false);
    // The polls stop: the watcher is gone.
    expect(watcher(now.els)).toBeUndefined();
    const li = itemFor(now.refs, 'shop.test');
    expect(textOf(li)).toContain('Screenshots ready · 2 parts, top first');
    expect(elements(li).find((e) => e.type === 'button' && textOf(e) === 'Capture again').props.disabled).toBe(false);
    // Its parts are listed as one screenshot the team added.
    expect(listItems(now.refs).map(textOf).some((t) => t.includes('shop.test.jpg2 parts, top first'))).toBe(true);
  });

  it('a poll that lands after a newer screenshot refresh leaves the files alone', async () => {
    const project = team({ capture: RUNNING });
    const { els, refs } = page(project);
    const watch = watcher(els);
    const poll = deferred();
    h.admin.mockReturnValueOnce(poll.promise);
    const asked = watch.props.load();
    // A screenshot is added meanwhile, and its refresh comes back first.
    const latest = { files: [withLink(SHOT)], assets: [SHOT] };
    h.admin.mockResolvedValueOnce({ project: latest });
    await refs.props.onShotAdded(withLink(SHOT), { assets: [SHOT] });
    poll.resolve({ project: { id: PID, design: { capture: READY }, files: [], assets: [] } });
    watch.props.onResult(await asked);
    const after = page(project);
    expect(after.refs.props.capture).toBe(READY);
    expect(after.refs.props.files).toBe(latest.files);
  });

  it('a failed capture says why and points at the uploader', async () => {
    const project = team({ capture: FAILED });
    const { refs } = page(project);
    const li = itemFor(refs, 'shop.test');
    expect(textOf(li)).toContain('Couldn\'t capture it. That site didn\'t load in 25 seconds');
    // No polls for a finished run.
    expect(watcher(page(project).els)).toBeUndefined();
    // Upload a screenshot instead: the uploader labels what it adds as this site's.
    const upload = (els) => els.find((e) => e.props && e.props.projectId === PID && 'onAdded' in e.props);
    expect(upload(section(refs)).props.sourceUrl).toBe('https://ref.test/');
    elements(li).find((e) => e.type === 'button' && textOf(e) === 'Upload a screenshot instead').props.onClick();
    const els = section(refs);
    expect(upload(els).props.sourceUrl).toBe('https://shop.test/');
    expect(textOf(els.find((e) => e.type === 'p' && textOf(e).startsWith('Add a screenshot of')))).toContain('Add a screenshot of shop.test');
    buttonNamed(els, 'Not of this site').props.onClick();
    expect(upload(section(refs)).props.sourceUrl).toBe('https://ref.test/');
    // Capture again, with the team's note.
    h.capture.mockResolvedValueOnce({ capture: { ...RUNNING, startedAt: NOW } });
    await elements(itemFor(refs, 'shop.test')).find((e) => e.type === 'button' && textOf(e) === 'Capture again').props.onClick();
    expect(h.capture).toHaveBeenCalledWith(PID, 'https://shop.test/', 'the hero');
    const after = page(project);
    expect(textOf(itemFor(after.refs, 'shop.test'))).toContain('Capturing…');
    expect(watcher(after.els)).toBeTruthy();
  });

  it('a run that never finished counts as failed, and the polls stop', () => {
    vi.setSystemTime(new Date('2026-10-07T12:11:00.000Z'));
    const { els, refs } = page(team({ capture: RUNNING }));
    expect(watcher(els)).toBeUndefined();
    expect(textOf(itemFor(refs, 'shop.test'))).toContain('The capture didn\'t finish (it may have timed out).');
  });

  it('a start the server refuses says why on that site; one refused because another runs watches that one', async () => {
    const project = team();
    const { refs } = page(project);
    // The customer's listed site: captured with no note (their words stay theirs).
    h.capture.mockRejectedValueOnce(Object.assign(new Error('That address points inside a private network.'), { status: 400, data: {} }));
    await elements(itemFor(refs, 'ref.test')).find((e) => e.type === 'button' && textOf(e) === 'Capture screenshots').props.onClick();
    expect(h.capture).toHaveBeenCalledWith(PID, 'https://ref.test/', '');
    let now = page(project);
    expect(textOf(itemFor(now.refs, 'ref.test'))).toContain('Couldn\'t capture it. That address points inside a private network.');
    expect(watcher(now.els)).toBeUndefined();

    // Another site's capture is going: watch it, and say so here.
    const other = { ...RUNNING, startedAt: NOW };
    h.capture.mockRejectedValueOnce(Object.assign(new Error('A capture is already running'), { status: 409, data: { capture: other } }));
    await elements(itemFor(now.refs, 'ref.test')).find((e) => e.type === 'button' && textOf(e) === 'Capture again').props.onClick();
    now = page(project);
    expect(now.refs.props.capture).toBe(other);
    expect(textOf(itemFor(now.refs, 'ref.test'))).toContain('Another site was being captured. Capture this one once that\'s done.');
    expect(textOf(itemFor(now.refs, 'shop.test'))).toContain('Capturing…');
    expect(watcher(now.els)).toBeTruthy();
    // Once that one is done the message still holds (and Capture again works).
    h.admin.mockResolvedValueOnce({ project: { id: PID, design: { capture: { ...other, status: 'ready', parts: 1 } }, files: [], assets: [] } });
    const watch = watcher(now.els);
    watch.props.onResult(await watch.props.load());
    now = page(project);
    expect(watcher(now.els)).toBeUndefined();
    const refItem = itemFor(now.refs, 'ref.test');
    expect(textOf(refItem)).toContain('Another site was being captured. Capture this one once that\'s done.');
    expect(elements(refItem).find((e) => e.type === 'button' && textOf(e) === 'Capture again').props.disabled).toBe(false);

    // Refused because this very site is being captured: just watch it.
    h.store = {};
    const second = team();
    const { refs: r2 } = page(second);
    h.capture.mockRejectedValueOnce(Object.assign(new Error('A capture is already running'), { status: 409, data: { capture: other } }));
    await elements(itemFor(r2, 'shop.test')).find((e) => e.type === 'button' && textOf(e) === 'Capture screenshots').props.onClick();
    const li = itemFor(page(second).refs, 'shop.test');
    expect(textOf(li)).toContain('Capturing…');
    expect(textOf(li)).not.toContain('Another site');
  });

  it('removing one saves the page without it; its screenshots stay', async () => {
    const assets = [SHOT, capturedPart(1), capturedPart(2)];
    const project = team({ capture: READY }, { assets });
    const { refs } = page(project);
    await elements(itemFor(refs, 'shop.test')).find((e) => e.type === 'button' && textOf(e).trim() === 'Remove').props.onClick();
    const [action, body] = h.admin.mock.calls[0];
    expect(action).toBe('design-save');
    expect(body.design.referenceSites).toEqual([]);
    const after = page(project);
    expect(after.refs.props.teamSites).toEqual([]);
    const texts = listItems(after.refs).map(textOf);
    expect(texts.some((t) => t.startsWith('shop.testAdded by the team'))).toBe(false);
    expect(texts.some((t) => t.includes('shop.test.jpg2 parts, top first'))).toBe(true);
    expect(after.refs.props.files.map((f) => f.path)).toEqual(assets.map((a) => a.path));
  });

  it('a failed remove keeps the site', async () => {
    const project = team();
    const { refs } = page(project);
    h.admin.mockRejectedValueOnce(new Error('offline'));
    await refs.props.onRemoveSite('https://shop.test/');
    const after = page(project);
    expect(after.refs.props.teamSites).toEqual([TEAM_SITE]);
    expect(after.alert).toBe('offline');
  });

  it('a 409 without a live run says the server\'s own message and watches nothing', async () => {
    const project = team();
    const click = async (title) => elements(itemFor(page(project).refs, title)).find((e) => e.type === 'button' && /^Capture/.test(textOf(e))).props.onClick();
    // The claim lost to other writes three times over.
    h.capture.mockRejectedValueOnce(Object.assign(new Error('The project kept changing while saving. Try again.'), { status: 409, data: {} }));
    await click('ref.test');
    expect(textOf(itemFor(page(project).refs, 'ref.test'))).toContain('Couldn\'t capture it. The project kept changing while saving. Try again.');
    // A run the server still called live but this page's clock says died:
    // nothing to watch, so no polls, and no "another site" story.
    const old = { ...RUNNING, url: 'https://other.test/', startedAt: '2026-10-07T11:00:00.000Z' };
    h.capture.mockRejectedValueOnce(Object.assign(new Error('A screenshot is already being taken for this project. Wait for it to finish.'), { status: 409, data: { capture: old } }));
    await click('ref.test');
    const now = page(project);
    expect(textOf(itemFor(now.refs, 'ref.test'))).toContain('A screenshot is already being taken for this project. Wait for it to finish.');
    expect(now.refs.props.capture).toBeNull();
    expect(watcher(now.els)).toBeUndefined();
  });

  it('a start that failed is forgotten once that site\'s run is seen going', async () => {
    const project = team();
    const { refs } = page(project);
    h.capture.mockRejectedValueOnce(Object.assign(new Error('Couldn\'t start the capture: network error'), { status: 502, data: {} }));
    await elements(itemFor(refs, 'shop.test')).find((e) => e.type === 'button' && textOf(e) === 'Capture screenshots').props.onClick();
    expect(textOf(itemFor(page(project).refs, 'shop.test'))).toContain('Couldn\'t start the capture: network error');
    // Another tab started shop.test meanwhile: a click here hears of it.
    const elsewhere = { ...RUNNING, startedAt: NOW };
    h.capture.mockRejectedValueOnce(Object.assign(new Error('A screenshot is already being taken'), { status: 409, data: { capture: elsewhere } }));
    await elements(itemFor(page(project).refs, 'ref.test')).find((e) => e.type === 'button' && textOf(e) === 'Capture screenshots').props.onClick();
    let now = page(project);
    expect(textOf(itemFor(now.refs, 'shop.test'))).toContain('Capturing…');
    // It ends: what shows is its outcome, not the old failure.
    h.admin.mockResolvedValueOnce({ project: { id: PID, design: { capture: { ...elsewhere, status: 'ready', parts: 2 } }, files: [], assets: [] } });
    const watch = watcher(now.els);
    watch.props.onResult(await watch.props.load());
    now = page(project);
    const li = itemFor(now.refs, 'shop.test');
    expect(textOf(li)).toContain('Screenshots ready · 2 parts, top first');
    expect(textOf(li)).not.toContain('network error');
  });

  it('every poll tick moves the clock: a run nobody hears from turns stale and the polls stop', () => {
    const project = team({ capture: RUNNING });
    const first = page(project);
    const watch = watcher(first.els);
    // Ten minutes of failed polls (offline): only the ticks arrive.
    vi.setSystemTime(new Date('2026-10-07T12:10:01.000Z'));
    watch.props.onTick();
    const now = page(project);
    expect(watcher(now.els)).toBeUndefined();
    expect(textOf(itemFor(now.refs, 'shop.test'))).toContain('The capture didn\'t finish (it may have timed out).');
  });

  it('the poller runs the page\'s latest handlers until it goes', async () => {
    // Every timer this time (the describe's fake clock fakes Date alone, and
    // a second useFakeTimers keeps the first one's settings).
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const project = team({ capture: RUNNING });
    const watch = watcher(page(project).els);
    // Mounted: its effect starts the polls; its cleanup is the stop.
    h.effects = [];
    call('watch', watch.type, watch.props);
    const [effect] = h.effects;
    h.effects = null;
    const stop = effect();
    expect(typeof stop).toBe('function');
    h.admin.mockResolvedValueOnce({ project: { id: PID, design: { capture: RUNNING }, files: [], assets: [] } });
    await vi.advanceTimersByTimeAsync(4000);
    expect(h.admin).toHaveBeenCalledTimes(1);
    expect(h.admin).toHaveBeenLastCalledWith('get', { id: PID });
    // Rendered again with new handlers: the next tick uses those.
    const load = vi.fn(async () => ({ project: null, seq: 0 }));
    const onResult = vi.fn();
    const onTick = vi.fn();
    call('watch', watch.type, { load, onResult, onTick });
    await vi.advanceTimersByTimeAsync(4000);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ project: null, seq: 0 });
    expect(h.admin).toHaveBeenCalledTimes(1);
    // Gone (the run ended, the page closed): no more polls.
    stop();
    await vi.advanceTimersByTimeAsync(20000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('a match on a part of an earlier capture is held while that site is captured again, then follows to the new part', async () => {
    const newPart = (n) => ({ ...capturedPart(n), path: refPath(PID, 40 + n, 'jpg'), group: 'capture-0002' });
    const oldAssets = [SHOT, capturedPart(1), capturedPart(2)];
    const project = team({
      capture: READY,
      reference: { mode: 'match', source: { kind: 'asset', path: capturedPart(2).path }, replica: { status: 'none' } },
    }, { assets: oldAssets });
    const first = page(project);
    expect(first.suggest.props.uploading).toBe(false);
    // Capture again: the parts it is about to replace can't be matched meanwhile.
    const again = { ...RUNNING, startedAt: NOW };
    h.capture.mockResolvedValueOnce({ capture: again });
    await elements(itemFor(first.refs, 'shop.test')).find((e) => e.type === 'button' && textOf(e) === 'Capture again').props.onClick();
    let now = page(project);
    expect(now.suggest.props.uploading).toBe(true);
    // Done: the new parts took the old ones' place, and the match follows
    // to part 2 of the new capture (as the server moved the saved one).
    const freshAssets = [SHOT, newPart(1), newPart(2)];
    const fresh = { id: PID, design: { capture: { ...again, status: 'ready', parts: 2 } }, files: freshAssets.map(withLink), assets: freshAssets };
    h.admin.mockResolvedValueOnce({ project: fresh });
    const watch = watcher(now.els);
    watch.props.onResult(await watch.props.load());
    now = page(project);
    expect(now.refs.props.reference.source).toEqual({ kind: 'asset', path: newPart(2).path });
    expect(now.suggest.props.reference.source).toEqual({ kind: 'asset', path: newPart(2).path });
    expect(now.suggest.props.uploading).toBe(false);
    // The list shows the match on the new screenshot, not a missing one.
    const shot = listItems(now.refs).find((li) => textOf(li).includes('shop.test.jpg'));
    expect(radios(shot).map((r) => r.props.checked)).toEqual([false, true]);
    expect(section(now.refs).some((e) => textOf(e).startsWith('The reference being matched'))).toBe(false);
    // And a Save keeps the new part.
    await buttonNamed(now.els, 'Save').props.onClick();
    expect(h.admin.mock.calls.at(-1)[1].design.reference.source).toEqual({ kind: 'asset', path: newPart(2).path });
  });

  it('a match on any other screenshot stays as it is when a site is captured again', async () => {
    const newPart = (n) => ({ ...capturedPart(n), path: refPath(PID, 40 + n, 'jpg'), group: 'capture-0002' });
    const project = team({
      capture: READY,
      reference: { mode: 'match', source: { kind: 'asset', path: SHOT.path }, replica: { status: 'none' } },
    }, { assets: [SHOT, capturedPart(1), capturedPart(2)] });
    const first = page(project);
    h.capture.mockResolvedValueOnce({ capture: { ...RUNNING, startedAt: NOW } });
    await elements(itemFor(first.refs, 'shop.test')).find((e) => e.type === 'button' && textOf(e) === 'Capture again').props.onClick();
    let now = page(project);
    // SHOT pictures ref.test, not the site being captured: nothing to hold.
    expect(now.suggest.props.uploading).toBe(false);
    const freshAssets = [SHOT, newPart(1), newPart(2)];
    h.admin.mockResolvedValueOnce({ project: { id: PID, design: { capture: { ...RUNNING, startedAt: NOW, status: 'ready', parts: 2 } }, files: freshAssets.map(withLink), assets: freshAssets } });
    const watch = watcher(now.els);
    watch.props.onResult(await watch.props.load());
    now = page(project);
    expect(now.refs.props.reference.source).toEqual({ kind: 'asset', path: SHOT.path });
  });

  it('offers "Capture again" only where our server took that address, not where a capture\'s note mentions it', () => {
    const mentions = { ...capturedPart(1), note: 'Screenshot of https://shop.test/ - the hero, like https://ref.test/' };
    const assets = [mentions];
    const { refs } = page(team({}, { assets }));
    const urlShots = (source) => referenceShots(source, assets);
    const label = (title) => textOf(elements(itemFor(refs, title, { urlShots })).find((e) => e.type === 'button' && /^Capture/.test(textOf(e))));
    expect(label('ref.test')).toBe('Capture screenshots');
    expect(label('shop.test')).toBe('Capture again');
  });

  it('adds from either box with Enter', async () => {
    const project = makeProject();
    const { refs } = page(project);
    inputNamed(section(refs), 'Site address').props.onChange({ target: { value: 'shop.test' } });
    const prevented = vi.fn();
    inputNamed(section(refs), 'What to copy from it (optional)').props.onKeyDown({ key: 'Enter', preventDefault: prevented });
    await vi.waitFor(() => expect(h.capture).toHaveBeenCalledWith(PID, 'https://shop.test/', ''));
    expect(prevented).toHaveBeenCalled();
    expect(h.admin.mock.calls[0][0]).toBe('design-save');
  });

  it('says an address is too long, and waits for a capture start before adding another site', async () => {
    const project = team();
    const { refs } = page(project);
    // 500 characters typed, 508 once "https://" is added.
    expect(await refs.props.onAddSite(`shop.test/${'a'.repeat(490)}`, '')).toEqual({ error: 'That address is too long (500 characters at most).' });
    const start = deferred();
    h.capture.mockReturnValueOnce(start.promise);
    const clicked = elements(itemFor(refs, 'shop.test')).find((e) => e.type === 'button' && textOf(e) === 'Capture screenshots').props.onClick();
    inputNamed(section(page(project).refs), 'Site address').props.onChange({ target: { value: 'new.test' } });
    expect(buttonNamed(section(page(project).refs), 'Add').props.disabled).toBe(true);
    start.resolve({ capture: { ...RUNNING, startedAt: NOW } });
    await clicked;
    // Adding while a capture goes is fine: that site's capture waits its turn (409).
    expect(buttonNamed(section(page(project).refs), 'Add').props.disabled).toBe(false);
  });
});

describe('watchCapture (the polls while a capture goes)', () => {
  it('asks every few seconds, rides out a failed ask, never overlaps, and stops', async () => {
    vi.useFakeTimers();
    const slow = deferred();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('second')
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValue('later');
    const onResult = vi.fn();
    const stop = watchCapture({ load, onResult, intervalMs: 4000 });
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
    // The blip is forgotten: the next tick asks again.
    await vi.advanceTimersByTimeAsync(4000);
    expect(onResult).toHaveBeenCalledWith('second');
    // A slow answer: the ticks it overlaps don't ask.
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(8000);
    expect(load).toHaveBeenCalledTimes(3);
    // Stopped (the run ended, the page went): nothing more, not even the
    // answer still out.
    stop();
    slow.resolve('too late');
    await vi.advanceTimersByTimeAsync(12000);
    expect(load).toHaveBeenCalledTimes(3);
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('ticks on every interval, answered, failed or still waiting', async () => {
    vi.useFakeTimers();
    const slow = deferred();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(slow.promise);
    const onTick = vi.fn();
    const onResult = vi.fn();
    const stop = watchCapture({ load, onResult, onTick, intervalMs: 4000 });
    await vi.advanceTimersByTimeAsync(4000); // asks, fails
    await vi.advanceTimersByTimeAsync(4000); // asks, no answer yet
    await vi.advanceTimersByTimeAsync(8000); // two ticks spent waiting
    expect(load).toHaveBeenCalledTimes(2);
    expect(onTick).toHaveBeenCalledTimes(4);
    expect(onResult).not.toHaveBeenCalled();
    stop();
    await vi.advanceTimersByTimeAsync(8000);
    expect(onTick).toHaveBeenCalledTimes(4);
  });

  it('polls every 4 seconds by default', async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => 'x');
    const stop = watchCapture({ load, onResult: () => {} });
    await vi.advanceTimersByTimeAsync(3999);
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('captureReference (customSites.js)', () => {
  it('asks custom-site-admin for reference-capture, signed in', async () => {
    const real = await vi.importActual('../../lib/customSites.js');
    const capture = { status: 'running', url: 'https://shop.test/', startedAt: '2026-10-07T12:00:00.000Z' };
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ capture }) }));
    vi.stubGlobal('fetch', fetch);
    expect(await real.captureReference(PID, 'https://shop.test/', 'the hero')).toEqual({ capture });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/.netlify/functions/custom-site-admin');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    expect(JSON.parse(init.body)).toEqual({ action: 'reference-capture', id: PID, url: 'https://shop.test/', note: 'the hero' });
    // A capture already going comes back as a 409 carrying that run.
    fetch.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'A capture is already running', capture }) });
    await expect(real.captureReference(PID, 'https://other.test/')).rejects.toMatchObject({ status: 409, data: { capture } });
    expect(JSON.parse(fetch.mock.calls[1][1].body).note).toBe('');
  });
});
