// The Design step's More sections (CustomSiteDesign.jsx DesignSetup +
// MoreSections + ShowcasePicker): a switch per section the template has,
// with one line each; what Save and "Write the site" send (the six
// switches, the change marks, the FAQ's pasted questions, the showcase's
// photos, the services' categories) and which photos the write copies;
// "Turn on what the reference site has" from a matched reference's
// outline; "Write it again" on a rewrite; and what the live preview gets.
//
// The tests run in node without a DOM, like CustomSiteDesign.reference.test
// .jsx: the React hooks are replaced by a tiny hook store (one per
// component), each component is called as a function, and its handlers
// are invoked straight from the returned element tree.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  PID: '11111111-2222-4333-8444-555555555555',
  store: {},
  cur: null,
  i: 0,
  admin: null,
  toast: null,
  effects: null,
  MORE: ['faq', 'process', 'vehicleTypes', 'comparison', 'showcase'],
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

// Bold & Sporty with every More section (service tabs through the editor's
// capability table) and Chrome Elite with none, whatever the templates do
// later (a no-op once templateSections.js lists them).
vi.mock('../../data/templateSections.js', async (importOriginal) => {
  const m = await importOriginal();
  const sectionIdsFor = (id) => {
    const real = m.sectionIdsFor(id);
    if (id === 'detailing_sporty') return [...real, ...['beforeAfter', ...h.MORE].filter((s) => !real.includes(s))];
    return id === 'mobile_chrome' ? real.filter((s) => s !== 'beforeAfter' && !h.MORE.includes(s)) : real;
  };
  return { ...m, sectionIdsFor };
});
vi.mock('../preview/editorCapabilities.js', async (importOriginal) => {
  const m = await importOriginal();
  const templateReads = (id, key) => (key === 'serviceTabs' && ['detailing_sporty', 'mobile_chrome'].includes(id)
    ? id === 'detailing_sporty' : m.templateReads(id, key));
  return { ...m, templateReads };
});

vi.mock('../../lib/customSites.js', () => ({
  customSiteAdmin: (...a) => h.admin(...a),
  captureReference: vi.fn(),
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

const { DesignSetup, MoreSections, ShowcasePicker } = await import('./CustomSiteDesign.jsx');
const sites = await import('../../lib/customSites.js');
const { EXTRA_SECTIONS } = await import('../../lib/customSiteSections.js');
const { sanitizeOutline } = await import('../../lib/referenceOutline.js');

const PID = h.PID;
const ALL = ['faq', 'process', 'vehicleTypes', 'comparison', 'showcase', 'serviceTabs'];
const OFF = Object.fromEntries(ALL.map((id) => [id, false]));
const photoPath = (n) => `${PID}/photo/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.jpg`;
const PHOTO = (n) => ({ path: photoPath(n), kind: 'photo', name: `car-${n}.jpg`, size: 10, type: 'image/jpeg' });
const PHOTOS = [1, 2, 3, 4, 5, 6, 7].map(PHOTO);
const withLink = (a) => ({ ...a, url: `https://files.test/${a.name}` });
const link = (n) => `https://files.test/car-${n}.jpg`;
const SERVICES = [
  { name: 'Hand Wash', price: '$40', description: '' },
  { name: 'Interior Detail', price: '$120', description: '' },
  { name: 'Hull Wash', price: '$200', description: '' },
  { name: 'RV Wash', price: '', description: '' },
];
const INFO = { businessName: 'Gloss Boss', businessType: 'mobile_detailing', city: 'Austin', state: 'TX', services: SERVICES };

// Bold & Sporty, with the customer's photos and no hero, about or gallery picks.
function makeProject({ design = {}, form = {}, assets = PHOTOS, extra = {} } = {}) {
  return {
    id: PID,
    client_first_name: 'Sam',
    business_name: 'Gloss Boss',
    form: { businessType: 'mobile_detailing', ...form },
    assets,
    files: assets.map(withLink),
    design: {
      businessInfo: INFO,
      templateId: 'detailing_sporty',
      slots: { logo: '', hero: '', about: '', gallery: [] },
      reference: { mode: 'inspire', source: null, replica: { status: 'none' } },
      ...design,
    },
    ...extra,
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
const page = (project) => call('setup', DesignSetup, { project, onBack: () => {}, onStarted: () => {} });
const byName = (els, name) => els.find((e) => typeof e.type === 'function' && e.type.name === name);
// The More sections block and the showcase picker as they render with the page's props now.
const more = (project) => {
  const el = byName(page(project), 'MoreSections');
  return { el, els: el ? call('more', MoreSections, el.props) : [] };
};
const picker = (project) => {
  const el = byName(page(project), 'ShowcasePicker');
  return { el, els: el ? call('picker', ShowcasePicker, el.props) : [] };
};
const rowOf = (els, id) => els.find((e) => e.type === 'li' && e.props['data-extra-section'] === id);
const switchOf = (row) => elements(row).find((e) => e.type === 'input' && e.props.role === 'switch');
const toggle = (project, id, on = true) => switchOf(rowOf(more(project).els, id)).props.onChange({ target: { checked: on } });
const buttonNamed = (els, name) => els.find((e) => e.type === 'button' && textOf(e).trim() === name);
const savedDesign = () => h.admin.mock.calls.filter(([a]) => a === 'design-save').at(-1)[1].design;
const previewOf = (els) => els.find((e) => e.props && 'existingInfo' in e.props);

beforeEach(() => {
  h.store = {};
  h.effects = null;
  h.admin = vi.fn(async () => ({}));
  h.toast = vi.fn();
});

describe('the More sections block', () => {
  it('lists the sections the template has, each with a switch and one line, all off', () => {
    const { el, els } = more(makeProject());
    expect(el.props.ids).toEqual(ALL);
    expect(el.props.on).toEqual(OFF);
    for (const s of EXTRA_SECTIONS) {
      const row = rowOf(els, s.id);
      expect(textOf(row)).toContain(s.label);
      expect(textOf(row)).toContain(s.what);
      expect(switchOf(row).props).toMatchObject({ type: 'checkbox', role: 'switch', checked: false, 'aria-checked': false });
    }
  });

  it('says a template has none of them; and for one that always shows its own, what off means', () => {
    h.store = {};
    const chrome = more(makeProject({ design: { templateId: 'mobile_chrome' } }));
    expect(chrome.el.props.ids).toEqual([]);
    expect(textOf(chrome.els)).toContain('Chrome Elite has none of them (FAQ, How it works, Vehicle types, Comparison, Detail showcase, Service tabs).');
    h.store = {};
    const sudsy = more(makeProject({ design: { templateId: 'mobile_sudsy' } }));
    expect(sudsy.el.props.ids).toContain('process');
    expect(textOf(rowOf(sudsy.els, 'process'))).toContain('Off: the template\'s own version shows.');
    // Bold & Sporty added it: off is off the page.
    h.store = {};
    expect(textOf(rowOf(more(makeProject()).els, 'process'))).not.toContain('template\'s own');
  });

  it('a switch turned on is saved with the other five, its change mark, and the FAQ\'s pasted questions', async () => {
    const project = makeProject({ form: { features: ['FAQ'] } });
    expect(textOf(rowOf(more(project).els, 'faq'))).toContain('They asked for an FAQ.');
    toggle(project, 'faq');
    toggle(project, 'comparison');
    const faq = rowOf(more(project).els, 'faq');
    expect(switchOf(faq).props.checked).toBe(true);
    // On, the FAQ takes the questions the customer sent.
    elements(faq).find((e) => e.type === 'textarea').props.onChange({ target: { value: 'Q: Do you take cards?\nA: Yes.' } });
    await buttonNamed(page(project), 'Save').props.onClick();
    const design = savedDesign();
    expect(design.extraSections).toEqual({ ...OFF, faq: true, comparison: true });
    expect(design.extraSectionsChanged).toEqual(['faq', 'comparison']);
    expect(design.faqNotes).toBe('Q: Do you take cards?\nA: Yes.');
    // Always sent, an empty list too, so the server can tell this page from an older one.
    expect(design.slots.showcase).toEqual([]);
    // Turned off again before saving: nothing changed.
    toggle(project, 'comparison', false);
    await buttonNamed(page(project), 'Save').props.onClick();
    expect(savedDesign().extraSectionsChanged).toEqual(['faq']);
  });

  it('starts from the saved switches, and keeps a saved mark until a run applies it', async () => {
    const project = makeProject({ design: { extraSections: { faq: true, process: true }, extraSectionsChanged: ['vehicleTypes'], faqNotes: 'Q: Cash? A: Yes.' } });
    const { el } = more(project);
    expect(el.props.on).toEqual({ ...OFF, faq: true, process: true });
    expect(el.props.marked).toEqual(['vehicleTypes']);
    expect(el.props.faqNotes).toBe('Q: Cash? A: Yes.');
    await buttonNamed(page(project), 'Save').props.onClick();
    expect(savedDesign().extraSectionsChanged).toEqual(['vehicleTypes']);
  });

  it('notes a section hidden under Sections, and switches kept for a template that has them', () => {
    const hidden = makeProject({ design: { extraSections: { faq: true }, levers: { sections: { order: [], hidden: ['faq'] } } } });
    expect(textOf(rowOf(more(hidden).els, 'faq'))).toContain('Hidden under Sections: show it there, or it stays off the site.');
    h.store = {};
    const chrome = more(makeProject({ design: { templateId: 'mobile_chrome', extraSections: { faq: true, showcase: true } } }));
    expect(textOf(chrome.els)).toContain('Chrome Elite doesn\'t have FAQ, Detail showcase: they stay switched on here for a template that has them.');
  });

  it('says what service tabs need, and what the showcase has', () => {
    const project = makeProject({ design: { extraSections: { serviceTabs: true, showcase: true } } });
    expect(textOf(rowOf(more(project).els, 'serviceTabs'))).toContain('Claude groups their services into 2 to 5 categories');
    expect(textOf(rowOf(more(project).els, 'showcase'))).toContain('Pick its photos under Photos: without any, it stays off the site.');
    h.store = {};
    const few = makeProject({ design: { extraSections: { serviceTabs: true }, businessInfo: { ...INFO, services: SERVICES.slice(0, 2) } } });
    expect(textOf(rowOf(more(few).els, 'serviceTabs'))).toContain('Type a Category for each service under Business details: tabs need at least two categories.');
    h.store = {};
    const none = makeProject({ assets: [], design: { extraSections: { showcase: true } } });
    expect(textOf(rowOf(more(none).els, 'showcase'))).toContain('No usable photos yet: it stays off the site until there are some to pick.');
    // On a rewrite the site keeps its own showcase until there are photos.
    h.store = {};
    const rewrite = makeProject({ design: { extraSections: { showcase: true }, siteId: '22222222-3333-4444-8555-666666666666' }, extra: { site_id: '22222222-3333-4444-8555-666666666666' } });
    expect(textOf(rowOf(more(rewrite).els, 'showcase'))).toContain('Pick its photos under Photos: without any, a rewrite leaves the site\'s as it is.');
  });
});

describe('service categories', () => {
  const categoryInput = (els, n) => els.find((e) => e.type === 'input' && e.props['aria-label'] === `Service ${n} category`);

  it('show under Services only while service tabs are on, and are saved with each service', async () => {
    const project = makeProject();
    expect(categoryInput(page(project), 1)).toBeUndefined();
    toggle(project, 'serviceTabs');
    const els = page(project);
    expect(textOf(els)).toContain('Service tabs are on: a Category puts a service under that tab');
    categoryInput(els, 1).props.onChange({ target: { value: 'Cars' } });
    categoryInput(page(project), 3).props.onChange({ target: { value: 'Boats' } });
    expect(categoryInput(page(project), 1).props.maxLength).toBe(30);
    await buttonNamed(page(project), 'Save').props.onClick();
    const design = savedDesign();
    expect(design.businessInfo.services.map((s) => s.category)).toEqual(['Cars', undefined, 'Boats', undefined]);
    expect(design.extraSectionsChanged).toEqual(['serviceTabs']);
    expect(textOf(rowOf(more(project).els, 'serviceTabs'))).toContain('Categories typed under Business details: 2 of 4 services. Claude groups the rest.');
  });

  it('a categories change alone marks the tabs changed', async () => {
    const project = makeProject({ design: { extraSections: { serviceTabs: true }, businessInfo: { ...INFO, services: SERVICES.map((s) => ({ ...s, category: 'Cars' })) } } });
    await buttonNamed(page(project), 'Save').props.onClick();
    expect(savedDesign().extraSectionsChanged).toEqual([]);
    page(project).find((e) => e.type === 'input' && e.props['aria-label'] === 'Service 4 category').props.onChange({ target: { value: 'RVs' } });
    await buttonNamed(page(project), 'Save').props.onClick();
    expect(savedDesign().extraSectionsChanged).toEqual(['serviceTabs']);
  });

  it('aren\'t offered for a business type that lists services by name only', () => {
    const { el } = more(makeProject({ design: { businessInfo: { ...INFO, businessType: 'mechanic_shop' } } }));
    expect(el.props.ids).toEqual(ALL.filter((id) => id !== 'serviceTabs'));
  });
});

describe('the showcase photos under Photos', () => {
  const thumb = (els, n) => els.find((e) => e.type === 'button' && elements(e.props.children).some((c) => c.type === 'img' && c.props.alt === `car-${n}.jpg`));
  const input = (els, label) => els.find((e) => e.type === 'input' && e.props['aria-label'] === label);

  it('shows on a template with the section, offering the photos alone, and says when its switch is off', () => {
    const { el, els } = picker(makeProject({ assets: [...PHOTOS, { path: `${PID}/logo/aaaaaaaa-bbbb-4ccc-8ddd-000000000099.png`, kind: 'logo', name: 'logo.png' }] }));
    expect(el.props.photos.map((f) => f.path)).toEqual(PHOTOS.map((f) => f.path));
    expect(el.props.on).toBe(false);
    expect(textOf(els)).toContain('Turn on Detail showcase under More sections, or these photos stay off the site.');
    h.store = {};
    const chrome = page(makeProject({ design: { templateId: 'mobile_chrome', slots: { showcase: [{ path: photoPath(1), title: 'x', caption: '' }] } } }));
    expect(byName(chrome, 'ShowcasePicker')).toBeUndefined();
    expect(chrome.some((e) => e.type === 'p' && textOf(e).includes('Chrome Elite has no Detail showcase'))).toBe(true);
  });

  it('picks up to 6 photos in order, each with a title and caption; a second click or Remove takes one off', async () => {
    const project = makeProject({ design: { extraSections: { showcase: true } } });
    for (const n of [3, 1, 2, 4, 5, 6]) thumb(picker(project).els, n).props.onClick();
    let els = picker(project).els;
    expect(textOf(els)).toContain('(6 of 6)');
    // Full: the rest wait.
    expect(thumb(els, 7).props.disabled).toBe(true);
    expect(textOf(thumb(els, 3))).toBe('1');
    input(els, 'Showcase photo 1 title').props.onChange({ target: { value: 'Ceramic coating' } });
    input(picker(project).els, 'Showcase photo 1 caption').props.onChange({ target: { value: 'Two coats' } });
    thumb(picker(project).els, 1).props.onClick();
    picker(project).els.find((e) => e.type === 'button' && e.props['aria-label'] === 'Remove showcase photo 5').props.onClick();
    els = picker(project).els;
    expect(els.filter((e) => e.type === 'li').length).toBe(4);
    expect(input(els, 'Showcase photo 1 title').props.maxLength).toBe(60);
    expect(input(els, 'Showcase photo 1 caption').props.maxLength).toBe(140);
    await buttonNamed(page(project), 'Save').props.onClick();
    expect(savedDesign().slots.showcase).toEqual([
      { path: photoPath(3), title: 'Ceramic coating', caption: 'Two coats' },
      { path: photoPath(2), title: '', caption: '' },
      { path: photoPath(4), title: '', caption: '' },
      { path: photoPath(5), title: '', caption: '' },
    ]);
    expect(savedDesign().extraSectionsChanged).toEqual(['showcase']);
    expect(textOf(rowOf(more(project).els, 'showcase'))).toContain('4 of 6 photos picked under Photos.');
  });

  describe('writing the site', () => {
    const run = async (project) => {
      sites.importAssetToSite.mockReset();
      sites.importAssetToSite.mockImplementation(async ({ imageKey }) => `https://public.test/${imageKey}.jpg`);
      h.admin.mockImplementation(async (action) => {
        if (action === 'get') return { project: { files: PHOTOS.map(withLink) } };
        if (action === 'design-generate') return { startedAt: '2026-10-08T10:00:00.000Z', project: {} };
        return {};
      });
      await buttonNamed(page(project), 'Write the site with Claude Opus 5.5').props.onClick();
      return savedDesign();
    };
    const PICKS = [{ path: photoPath(2), title: 'Hull wash', caption: '' }, { path: photoPath(5), title: '', caption: '' }];

    it('copies the picks\' photos to showcase{i}, like the gallery, while the switch is on', async () => {
      const design = await run(makeProject({ design: { extraSections: { showcase: true }, slots: { logo: '', hero: '', about: '', gallery: [], showcase: PICKS } } }));
      expect(sites.importAssetToSite.mock.calls.map(([a]) => [a.imageKey, a.url])).toEqual([['showcase0', link(2)], ['showcase1', link(5)]]);
      expect(design.imported).toEqual({ showcase0: photoPath(2), showcase1: photoPath(5) });
      expect(design.images).toEqual({ showcase0: 'https://public.test/showcase0.jpg', showcase1: 'https://public.test/showcase1.jpg' });
      expect(design.imagesChanged).toEqual(['showcase0', 'showcase1']);
      expect(design.slots.showcase).toEqual(PICKS);
    });

    it('copies none while it\'s off, and keeps the last copies on record', async () => {
      const design = await run(makeProject({
        design: { slots: { logo: '', hero: '', about: '', gallery: [], showcase: PICKS }, imported: { showcase0: photoPath(2) }, images: { showcase0: 'https://public.test/old.jpg' } },
      }));
      expect(sites.importAssetToSite).not.toHaveBeenCalled();
      expect(design.imagesChanged).toEqual([]);
      expect(design.imported).toEqual({ showcase0: photoPath(2) });
      expect(design.images).toEqual({ showcase0: 'https://public.test/old.jpg' });
    });
  });
});

describe('"Turn on what the reference site has"', () => {
  const refPath = (n) => `${PID}/reference/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.jpg`;
  const OUTLINE = {
    v: 1,
    sections: [{ kind: 'hero', heading: 'Shine' }, { kind: 'process', heading: 'Three steps' }, { kind: 'other', heading: 'Us vs. the tunnel' }, { kind: 'faq', heading: 'Questions' }],
    features: [{ id: 'faq', provider: '' }, { id: 'tabs', provider: '' }, { id: 'gallery', provider: '' }],
  };
  // Our server's capture of shop.test: part 1 carries the outline.
  const part = (n) => ({
    path: refPath(30 + n), kind: 'reference', name: `shop.test (part ${n} of 2).jpg`, size: 10, type: 'image/jpeg',
    note: 'Screenshot of https://shop.test/', addedBy: 'admin', group: 'capture-0001', part: n, captured: true,
    ...(n === 1 ? { outline: OUTLINE } : {}),
  });
  const matched = (design = {}) => makeProject({
    assets: [...PHOTOS, part(1), part(2)],
    design: { reference: { mode: 'match', source: { kind: 'url', url: 'https://shop.test/' }, replica: { status: 'none' } }, ...design },
  });
  // The page's effects, as React runs them: one loads designSuggest.js (the outline rule).
  async function loaded(project) {
    h.effects = [];
    page(project);
    const effects = h.effects;
    h.effects = null;
    effects.forEach((fn) => fn());
    await vi.waitFor(() => expect(more(project).el.props.suggested).not.toBeNull());
  }

  it('turns on what its code shows, on this template, and says so', async () => {
    const project = matched({ extraSections: { faq: true } });
    // While the rule loads: no button.
    expect(more(project).el.props.suggested).toBeNull();
    await loaded(project);
    const { el, els } = more(project);
    expect(el.props.suggested).toEqual({ ids: ['faq', 'process', 'comparison', 'serviceTabs'], missing: [] });
    expect(textOf(els)).toContain('Its code shows: FAQ, How it works, Comparison, Service tabs.');
    buttonNamed(els, 'Turn on what the reference site has').props.onClick();
    const after = more(project);
    expect(after.el.props.on).toEqual({ ...OFF, faq: true, process: true, comparison: true, serviceTabs: true });
    expect(textOf(after.els)).toContain('Turned on: How it works, Comparison, Service tabs. Check each one below.');
    // Nothing left to turn on.
    expect(buttonNamed(after.els, 'Turn on what the reference site has').props.disabled).toBe(true);
  });

  it('names what the template lacks, and shows nothing without a matched outline', async () => {
    const project = matched({ templateId: 'mobile_chrome' });
    await loaded(project);
    const { el, els } = more(project);
    expect(el.props.suggested).toEqual({ ids: [], missing: ['faq', 'process', 'comparison', 'serviceTabs'] });
    expect(textOf(els)).toContain('Its code shows none of these sections. Not in Chrome Elite: FAQ, How it works, Comparison, Service tabs.');
    expect(buttonNamed(els, 'Turn on what the reference site has').props.disabled).toBe(true);
    // Used as inspiration only: no matched outline.
    h.store = {};
    const inspired = makeProject({ assets: [...PHOTOS, part(1), part(2)] });
    await loadedInspired(inspired);
    expect(more(inspired).el.props.suggested).toBeNull();
  });

  async function loadedInspired(project) {
    h.effects = [];
    page(project);
    const effects = h.effects;
    h.effects = null;
    effects.forEach((fn) => fn());
    await vi.waitFor(() => expect(byName(page(project), 'ReferenceSection').props.outlineOf).toBeTypeOf('function'));
  }

  it('reads the sections the same way the outline is stored', () => {
    expect(sanitizeOutline(OUTLINE).features.map((f) => f.id)).toEqual(['gallery', 'faq', 'tabs']);
  });
});

describe('on a rewrite', () => {
  const SITE = '22222222-3333-4444-8555-666666666666';
  const written = (design = {}) => makeProject({ design: { siteId: SITE, ...design }, extra: { site_id: SITE } });

  it('"Write it again" marks a section a rewrite would otherwise keep', async () => {
    const project = written({ extraSections: { faq: true, process: true } });
    let row = rowOf(more(project).els, 'faq');
    expect(textOf(row)).toContain('A rewrite keeps the site\'s FAQ (with any editor changes) unless you press this.');
    buttonNamed(elements(row), 'Write it again').props.onClick();
    row = rowOf(more(project).els, 'faq');
    expect(textOf(row)).toContain('Written again on the next rewrite.');
    expect(buttonNamed(elements(row), 'Write it again')).toBeUndefined();
    await buttonNamed(page(project), 'Save').props.onClick();
    expect(savedDesign().extraSectionsChanged).toEqual(['faq']);
  });

  it('says what a switch turned off does on the next rewrite', () => {
    const project = written({ extraSections: { faq: true } });
    toggle(project, 'faq', false);
    expect(textOf(rowOf(more(project).els, 'faq'))).toContain('Taken off the site on the next rewrite.');
    h.store = {};
    const sudsy = written({ templateId: 'mobile_sudsy', extraSections: { process: true } });
    toggle(sudsy, 'process', false);
    expect(textOf(rowOf(more(sudsy).els, 'process'))).toContain('Back to the template\'s own on the next rewrite.');
  });

  it('gives the preview the sections as the next write applies them', () => {
    const project = written({
      extraSections: { faq: true, showcase: true },
      slots: { logo: '', hero: '', about: '', gallery: [], showcase: [{ path: photoPath(1), title: 'Ceramic coating', caption: '' }] },
    });
    // Nothing changed here since the last write: the site's own stay.
    expect(previewOf(page(project)).props.extraSections).toEqual({ applies: [], on: { ...OFF, faq: true, showcase: true }, showcase: null });
    // A showcase title changed: the showcase applies, with the setup's photo.
    picker(project).els.find((e) => e.type === 'input' && e.props['aria-label'] === 'Showcase photo 1 title').props.onChange({ target: { value: 'Coating' } });
    expect(previewOf(page(project)).props.extraSections).toEqual({
      applies: ['showcase'],
      on: { ...OFF, faq: true, showcase: true },
      showcase: { images: { showcase0: link(1) }, copy: { items: [{ title: 'Coating' }] } },
    });
  });

  it('before the first write, every section the template has applies', () => {
    expect(previewOf(page(makeProject({ design: { extraSections: { faq: true } } }))).props.extraSections.applies).toEqual(ALL);
  });
});
