// The Design step's "Reference sites" wiring (CustomSiteDesign.jsx
// DesignSetup + ReferenceSection): a replica request turns ready once this
// project's replica template is in the build (withBuiltReplica), what a
// request or cancel saves (saveReference -> design-save), a screenshot the
// team adds showing at once and then the fresh lists (onShotAdded), the
// parts of a cut-up screenshot listed as one reference, and what
// SuggestPanel gets (the fresh project, the page's reference choice and
// its "Use their brand color" toggle).
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
  toast: null,
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
    useEffect: () => {},
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
  customSiteSuggest: vi.fn(),
  uploadReferenceShot: vi.fn(),
  importAssetToSite: vi.fn(),
  startDesignRun: vi.fn(),
}));
vi.mock('../../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../ui/AlertProvider.jsx', () => ({
  default: ({ children }) => children,
  useAlert: () => ({ toast: (...a) => h.toast(...a), confirm: async () => true }),
}));

const { DesignSetup } = await import('./CustomSiteDesign.jsx');

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
  h.admin = vi.fn(async () => ({}));
  h.toast = vi.fn();
});
afterEach(() => vi.useRealTimers());

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
