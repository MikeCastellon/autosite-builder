// "Match its layout" on the admin page: the upload's file checks, notes,
// cutting a tall screenshot into parts, and progress (referenceMatch.js),
// and what ReferenceShotUpload and SuggestPanel show (rendered to static
// markup: the intro saying what a match does and that colors and logo stay
// ours, the missing-screenshot message, the result's summary).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MATCH_SHOT_LIMIT, MATCH_SHOT_SEND_BYTES, REFERENCE_GROUP_RE, checkReferenceShot, referenceShots,
} from '../../../lib/designSuggest.js';
import {
  MAX_SHOTS_PER_PICK, SHOT_ACCEPT, SHOT_TILE_HEIGHT, SHOT_TILE_WIDTH, drawTiles, newShotGroup, paletteSourceText, planTiles, prepareShot,
  shotNote, shotProgress, shotStatusText, sortPickedShots, splitText, tileName, wholeShotName,
} from './referenceMatch.js';

vi.mock('../../../lib/customSites.js', () => ({ customSiteSuggest: vi.fn(), uploadReferenceShot: vi.fn() }));

const { default: SuggestPanel } = await import('./SuggestPanel.jsx');
const { default: ReferenceShotUpload } = await import('./ReferenceShotUpload.jsx');

const PID = '11111111-2222-4333-8444-555555555555';
const path = (kind, n, ext = 'png') => `${PID}/${kind}/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, '0')}.${ext}`;
const MB = 1024 * 1024;
const file = (name, size = 1000, type = 'image/png') => ({ name, size, type });
// Markup text with React's escaping undone, on one line.
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

describe('sortPickedShots', () => {
  it('keeps PNG, JPEG and WebP screenshots up to 10 MB, in the order picked', () => {
    const picked = [file('top.png'), file('mood.gif', 1000, 'image/gif'), file('mid.jpg', 1000, 'image/jpeg'), file('huge.png', 11 * MB), file('page.pdf', 1000, 'application/pdf'), file('end.webp', 1000, '')];
    const { ok, rejected } = sortPickedShots(picked);
    expect(ok.map((f) => f.name)).toEqual(['top.png', 'mid.jpg', 'end.webp']);
    expect(rejected).toEqual([
      { name: 'mood.gif', error: 'Use a PNG, JPEG or WebP screenshot.' },
      { name: 'huge.png', error: expect.stringMatching(/over 10 MB/) },
      { name: 'page.pdf', error: 'Use a PNG, JPEG or WebP screenshot.' },
    ]);
  });

  it('takes a few at a time', () => {
    const many = Array.from({ length: MAX_SHOTS_PER_PICK + 2 }, (_, i) => file(`tile${i}.png`));
    const { ok, rejected } = sortPickedShots(many);
    expect(ok).toHaveLength(MAX_SHOTS_PER_PICK);
    expect(rejected.map((r) => r.error)).toEqual([`Add at most ${MAX_SHOTS_PER_PICK} at a time.`, `Add at most ${MAX_SHOTS_PER_PICK} at a time.`]);
    expect(sortPickedShots(null)).toEqual({ ok: [], rejected: [] });
  });

  it('offers only the formats the server takes', () => {
    expect(SHOT_ACCEPT).toBe('image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp');
  });
});

describe('shotNote', () => {
  it('ties a screenshot to its reference address, so a match on that address finds it', () => {
    const note = shotNote('www.ref-site.test', '  the   hero  ');
    expect(note).toBe('Screenshot of https://www.ref-site.test/ - the hero');
    const asset = { path: path('reference', 1), kind: 'reference', name: 'home.png', note };
    expect(referenceShots({ kind: 'url', url: 'https://ref-site.test' }, [asset])).toEqual([asset]);
    expect(referenceShots({ kind: 'url', url: 'https://ref-site.test' }, [{ ...asset, note: shotNote('', 'the hero') }])).toEqual([]);
    expect(shotNote('javascript:alert(1)', 'x')).toBe('x');
    expect(shotNote('ref-site.test', 'y'.repeat(900))).toHaveLength(500);
  });
});

// Opus reads an image at up to 2576 px on its long side: every part fits.
const OPUS_MAX_SIDE = 2576;

describe('planTiles', () => {
  it('keeps a screenshot that fits one part as it is', () => {
    expect(planTiles({ width: 1440, height: 900 })).toEqual({
      width: 1440, height: 900, dropped: false, droppedShare: 0, asIs: true,
      tiles: [{ part: 1, sx: 0, sy: 0, sw: 1440, sh: 900, width: 1440, height: 900 }],
    });
    // A wide one is scaled down to the part width (never enlarged).
    const wide = planTiles({ width: 1920, height: 1080 });
    expect(wide.tiles).toEqual([{ part: 1, sx: 0, sy: 0, sw: 1920, sh: 1080, width: 1440, height: 810 }]);
    expect(wide.asIs).toBe(false);
    expect(planTiles({ width: 800, height: 600 }).tiles[0]).toMatchObject({ width: 800, height: 600 });
  });

  it('cuts a tall page into even parts, top first', () => {
    const plan = planTiles({ width: 1440, height: 5000 });
    expect(plan.tiles.map((t) => [t.part, t.sy, t.sh, t.height])).toEqual([[1, 0, 1667, 1667], [2, 1667, 1667, 1667], [3, 3334, 1666, 1666]]);
    expect(plan).toMatchObject({ dropped: false, droppedShare: 0, asIs: false });
    // A retina capture: drawn at half size, the rows still map back.
    const retina = planTiles({ width: 2880, height: 6000 });
    expect(retina.tiles.map((t) => [t.sy, t.sh, t.width, t.height])).toEqual([[0, 3000, 1440, 1500], [3000, 3000, 1440, 1500]]);
  });

  it(`keeps the top ${MATCH_SHOT_LIMIT} parts of a very long page and says how much was left out`, () => {
    const plan = planTiles({ width: 2880, height: 24000 });
    expect(plan.tiles).toHaveLength(MATCH_SHOT_LIMIT);
    expect(plan.tiles.map((t) => [t.sy, t.sh, t.height])).toEqual([[0, 4800, 2400], [4800, 4800, 2400], [9600, 4800, 2400], [14400, 4800, 2400]]);
    expect(plan.dropped).toBe(true);
    expect(plan.droppedShare).toBeCloseTo(0.2);
  });

  it('every part is small enough for the model and they cover the kept page without gaps', () => {
    for (const width of [320, 1024, 1440, 1441, 1600, 2880, 3840, 9000]) {
      for (const height of [1, 100, 900, 2400, 2401, 4800, 7201, 9600, 9601, 12000, 30000, 60000]) {
        const plan = planTiles({ width, height });
        expect(plan.tiles.length).toBeGreaterThan(0);
        expect(plan.tiles.length).toBeLessThanOrEqual(MATCH_SHOT_LIMIT);
        let y = 0;
        for (const t of plan.tiles) {
          expect(t.width).toBeLessThanOrEqual(SHOT_TILE_WIDTH);
          expect(t.height).toBeLessThanOrEqual(SHOT_TILE_HEIGHT);
          expect(Math.max(t.width, t.height)).toBeLessThanOrEqual(OPUS_MAX_SIDE);
          expect(t.height).toBeGreaterThan(0);
          expect(t.sy).toBe(y);
          expect(t.sh).toBeGreaterThan(0);
          y = t.sy + t.sh;
        }
        if (!plan.dropped) expect(y).toBe(height);
        else expect(y).toBeLessThan(height);
      }
    }
  });

  it('knows nothing about a size it can\'t read', () => {
    expect(planTiles({ width: 0, height: 900 })).toBeNull();
    expect(planTiles({ width: 1440, height: Infinity })).toBeNull();
    expect(planTiles()).toBeNull();
  });
});

describe('tile names and groups', () => {
  it('names each part after the screenshot, as a JPEG the server takes', () => {
    expect(tileName('home.png', 2, 3)).toBe('home (part 2 of 3).jpg');
    expect(tileName('home.png', 1, 1)).toBe('home.jpg');
    expect(tileName('', 1, 2)).toBe('screenshot (part 1 of 2).jpg');
    // A long name keeps its part (reference-add keeps 190 characters).
    const long = tileName(`${'a'.repeat(300)}.png`, 3, 4);
    expect(long.length).toBeLessThanOrEqual(190);
    expect(long.endsWith(' (part 3 of 4).jpg')).toBe(true);
    expect(wholeShotName(long)).toBe(`${'a'.repeat(150)}.jpg`);
    expect(checkReferenceShot({ fileName: tileName('home.webp', 4, 4), size: 10, type: 'image/jpeg' }).error).toBeUndefined();
  });

  it('labels a part by the screenshot it came from', () => {
    expect(wholeShotName(tileName('home.png', 2, 3))).toBe('home.jpg');
    expect(wholeShotName('home.png')).toBe('home.png');
    expect(wholeShotName('my (part 1 of 2) notes.png')).toBe('my (part 1 of 2) notes.png');
    expect(wholeShotName(undefined)).toBe('');
  });

  it('gives each cut-up screenshot a fresh group id the server accepts', () => {
    expect(newShotGroup({ randomUUID: () => 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE' })).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    // No randomUUID (an http page): still a valid, fresh id.
    const a = newShotGroup({});
    const b = newShotGroup(undefined);
    expect(a).toMatch(REFERENCE_GROUP_RE);
    expect(b).toMatch(REFERENCE_GROUP_RE);
    expect(a).not.toBe(b);
    expect(newShotGroup()).toMatch(REFERENCE_GROUP_RE);
  });
});

// A canvas that records what is drawn; toBlob answers with `sizes` per
// quality tried (null = the browser couldn't encode).
function fakeCanvas(log, sizes = {}) {
  return (width, height) => ({
    width,
    height,
    getContext: () => ({
      fillRect: (...a) => log.push(['fillRect', ...a]),
      drawImage(img, ...a) { log.push(['drawImage', img.id, ...a, this.imageSmoothingQuality]); },
    }),
    toBlob: (cb, type, quality) => {
      log.push(['toBlob', type, quality]);
      const size = quality in sizes ? sizes[quality] : 1000;
      cb(size === null ? null : new Blob([new Uint8Array(size)], { type }));
    },
  });
}

describe('drawTiles', () => {
  it('draws each part from its rows of the screenshot onto white, as JPEG files top first', async () => {
    const log = [];
    const plan = planTiles({ width: 2880, height: 6000 });
    const files = await drawTiles({ id: 'bitmap' }, plan, { name: 'home.png', makeCanvas: fakeCanvas(log) });
    expect(files.map((f) => [f.name, f.type])).toEqual([['home (part 1 of 2).jpg', 'image/jpeg'], ['home (part 2 of 2).jpg', 'image/jpeg']]);
    // Smoothed well: a retina capture is drawn at half size.
    expect(log.filter(([op]) => op === 'drawImage')).toEqual([
      ['drawImage', 'bitmap', 0, 0, 2880, 3000, 0, 0, 1440, 1500, 'high'],
      ['drawImage', 'bitmap', 0, 3000, 2880, 3000, 0, 0, 1440, 1500, 'high'],
    ]);
    expect(log.filter(([op]) => op === 'fillRect')).toEqual([['fillRect', 0, 0, 1440, 1500], ['fillRect', 0, 0, 1440, 1500]]);
  });

  it('lowers the quality only while a part is too heavy to send', async () => {
    const log = [];
    const files = await drawTiles({ id: 'b' }, planTiles({ width: 1440, height: 900 }), {
      name: 'x.png', makeCanvas: fakeCanvas(log, { 0.85: MATCH_SHOT_SEND_BYTES + 1, 0.7: 2000 }),
    });
    expect(log.filter(([op]) => op === 'toBlob').map(([, , q]) => q)).toEqual([0.85, 0.7]);
    expect(files[0].size).toBe(2000);
  });

  it('gives up (the original goes up as it is) when the browser can\'t draw or encode', async () => {
    const plan = planTiles({ width: 1440, height: 900 });
    const noContext = () => ({ getContext: () => null });
    expect(await drawTiles({}, plan, { name: 'x.png', makeCanvas: noContext })).toBeNull();
    expect(await drawTiles({}, plan, { name: 'x.png', makeCanvas: fakeCanvas([], { 0.85: null, 0.7: null, 0.55: null }) })).toBeNull();
  });
});

describe('prepareShot', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The browser's image decoding and canvas, faked.
  const browser = ({ width, height, fail = false }) => {
    const bitmap = { id: 'bitmap', width, height, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', async () => { if (fail) throw new Error('bad image'); return bitmap; });
    vi.stubGlobal('document', { createElement: () => fakeCanvas([])(0, 0) });
    return bitmap;
  };

  it('uploads a screenshot that fits one part and isn\'t too heavy as it is', async () => {
    const bitmap = browser({ width: 1440, height: 900 });
    const f = file('home.png', 900_000);
    const out = await prepareShot(f);
    expect(out.files).toEqual([f]);
    expect(out.files[0]).toBe(f);
    expect(out.plan.tiles).toHaveLength(1);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('redraws a heavy one and cuts a tall one into parts', async () => {
    browser({ width: 1440, height: 900 });
    const heavy = await prepareShot(file('heavy.png', 6 * MB));
    expect(heavy.files.map((f) => f.name)).toEqual(['heavy.jpg']);
    vi.unstubAllGlobals();
    browser({ width: 1440, height: 12000 });
    const tall = await prepareShot(file('long.png', 2 * MB));
    expect(tall.files.map((f) => f.name)).toEqual([1, 2, 3, 4].map((n) => `long (part ${n} of 4).jpg`));
    expect(tall.plan.dropped).toBe(true);
  });

  it('uploads the file as it is where the browser can\'t read or redraw it', async () => {
    const f = file('home.png', 6 * MB);
    // In node: no image decoding at all.
    expect(await prepareShot(f)).toEqual({ files: [f], plan: null });
    browser({ width: 1440, height: 900, fail: true });
    expect((await prepareShot(f)).files[0]).toBe(f);
  });
});

describe('splitText', () => {
  it('says how a screenshot was cut, and what of a long page was left out', () => {
    expect(splitText(planTiles({ width: 1440, height: 900 }))).toBe('');
    expect(splitText(null)).toBe('');
    expect(splitText(planTiles({ width: 1440, height: 5000 }))).toBe('Split into 3 parts, top first.');
    expect(splitText(planTiles({ width: 1440, height: 12000 }))).toBe(
      'Split into 4 parts, top first. The bottom 20% of the page was left out: a match looks at the top 4 parts only.',
    );
    // Never "add the rest as another screenshot": a match wouldn't send it.
    expect(splitText(planTiles({ width: 1440, height: 12000 }))).not.toMatch(/on its own|another screenshot/);
    // A sliver left out still counts.
    expect(splitText(planTiles({ width: 1440, height: 9601 }))).toContain('The bottom 1% of the page was left out');
  });
});

describe('upload progress', () => {
  it('counts three steps per uncut file over the whole pick', () => {
    expect(shotProgress({ index: 0, total: 2, phase: 'prepare' })).toBe(0);
    expect(shotProgress({ index: 0, total: 2, phase: 'save' })).toBeCloseTo(2 / 6);
    expect(shotProgress({ index: 1, total: 2, phase: 'upload' })).toBeCloseTo(4 / 6);
    expect(shotProgress({ index: 1, total: 2, phase: 'done' })).toBe(1);
    expect(shotProgress({ total: 0 })).toBe(0);
  });

  it('moves on with every part of a cut-up file', () => {
    // One file in 3 parts: preparing, then an upload and a save per part.
    const at = (phase, part) => shotProgress({ index: 0, total: 1, phase, part, parts: 3 });
    expect([at('prepare', 1), at('upload', 1), at('save', 1), at('upload', 2), at('save', 3), at('done', 3)])
      .toEqual([0, 1 / 7, 2 / 7, 3 / 7, 6 / 7, 1]);
  });

  it('says which file and part it is on', () => {
    expect(shotStatusText({ index: 1, total: 3, name: 'mid.png', phase: 'upload' })).toBe('Uploading 2 of 3: mid.png…');
    expect(shotStatusText({ index: 0, total: 1, name: 'top.png', phase: 'prepare' })).toBe('Preparing top.png…');
    expect(shotStatusText({ index: 0, total: 1, name: 'top.png', phase: 'save' })).toBe('Saving top.png…');
    expect(shotStatusText({ index: 0, total: 1, name: 'long.png', phase: 'upload', part: 2, parts: 4 })).toBe('Uploading long.png, part 2 of 4…');
    expect(shotStatusText({ index: 1, total: 2, name: 'long.png', phase: 'save', part: 4, parts: 4 })).toBe('Saving 2 of 2: long.png, part 4 of 4…');
  });
});

describe('paletteSourceText', () => {
  it('names where a match takes its colors from', () => {
    expect(paletteSourceText({ from: 'studio', studio: { bg: '#000000' } })).toBe('your Studio palette');
    expect(paletteSourceText({ from: 'brand', studio: { accent: '#abcdef' } })).toBe('their brand system, with your Studio colors on top');
    expect(paletteSourceText({ from: 'brandColors', studio: {} })).toBe('their brand color on the template\'s colors');
    expect(paletteSourceText({ from: 'template', studio: {} })).toBe('the template\'s own colors (they gave no brand colors yet)');
    // They gave colors, the page's toggle is off: never say they gave none.
    expect(paletteSourceText({ from: 'template', studio: {}, brandOff: true })).toBe('the template\'s own colors ("Use their brand color" is off)');
  });
});

// ─── What the panels show ─────────────────────────────────────────────

const SHOT = { path: path('reference', 20), kind: 'reference', name: 'home.png', size: 1000, note: 'Screenshot of https://ref-site.test/', addedBy: 'admin' };
const PROJECT = {
  id: PID,
  form: { businessName: 'Gloss Boss', businessType: 'mobile_detailing', colorMode: 'mine', colors: ['#cc0000'] },
  assets: [SHOT],
  files: [{ ...SHOT, url: 'https://files.test/home.png' }],
  design: { templateId: 'mobile_chrome', suggestion: null },
};
const FULL_STUDIO = { bg: '#101820', secondary: '#1c2630', text: '#f5f5f5', muted: '#b8c0c8', accent: '#ffb000' };
const current = (palette = {}) => ({ templateId: 'mobile_chrome', levers: { palette }, slots: { logo: '', hero: '', about: '', gallery: [] } });
const BY_URL = (url = 'https://ref-site.test/') => ({ mode: 'match', source: { kind: 'url', url }, replica: { status: 'none' } });
const panel = (props) => renderToStaticMarkup(<SuggestPanel project={PROJECT} current={current()} onApply={() => {}} {...props} />);
const button = (html) => /<button[^>]*>([^<]*)<\/button>/.exec(html);
const isDisabled = (tag) => / disabled=""/.test(tag);

describe('SuggestPanel', () => {
  it('says what a match does, and that colors, logo, photos and words stay ours', () => {
    const html = panel({ reference: BY_URL(), current: current(FULL_STUDIO) });
    const t = text(html);
    expect(t).toContain('Claude looks at the screenshot of ref-site.test and lays their site out like it: the closest template, the section order, the hero and about layouts, and fonts with the same feel.');
    expect(t).toContain('Colors come from your Studio palette, and the logo, photos and words stay theirs.');
    expect(t).toContain('Only layout and type feel are copied, never its text, photos, logo or brand.');
    expect(button(html)[1]).toBe('Match the layout with Claude');
    expect(isDisabled(button(html)[0])).toBe(false);
    // Without a Studio palette, their brand color.
    expect(text(panel({ reference: BY_URL() }))).toContain('Colors come from their brand color on the template\'s colors');
  });

  it('follows the page\'s brand-color toggle, saved or not', () => {
    const off = text(panel({ reference: BY_URL(), useBrand: false }));
    expect(off).toContain('Colors come from the template\'s own colors ("Use their brand color" is off)');
    // The page's toggle wins over the saved one, both ways.
    const savedOff = { ...PROJECT, design: { ...PROJECT.design, useBrand: false } };
    expect(text(panel({ project: savedOff, reference: BY_URL() }))).toContain('"Use their brand color" is off');
    expect(text(panel({ project: savedOff, reference: BY_URL(), useBrand: true }))).toContain('Colors come from their brand color on the template\'s colors');
    // Said too while the match still needs a screenshot.
    expect(text(panel({ reference: BY_URL('https://elsewhere.test'), useBrand: false }))).toContain('"Use their brand color" is off');
  });

  it('names a cut-up screenshot as the one it came from, and looks at all its parts', () => {
    const part = (n) => ({
      path: path('reference', 30 + n, 'jpg'), kind: 'reference', name: `long (part ${n} of 3).jpg`, size: 10, note: '', addedBy: 'admin', group: 'group-0001', part: n,
    });
    const project = { ...PROJECT, assets: [part(1), part(2), part(3)], files: [] };
    const t = text(panel({ project, reference: { mode: 'match', source: { kind: 'asset', path: part(2).path } } }));
    expect(t).toContain('Claude looks at the screenshots of long.jpg and lays their site out like it');
  });

  it('asks for a screenshot of a site it has none of, and offers the upload when the page takes it', () => {
    const html = panel({ reference: BY_URL('https://elsewhere.test') });
    expect(text(html)).toContain('Claude looks at a screenshot of elsewhere.test');
    expect(text(html)).toContain('Colors come from their brand color on the template\'s colors');
    expect(text(html)).toContain('Add a screenshot of this site to match it');
    expect(isDisabled(button(html)[0])).toBe(true);
    expect(text(html)).not.toContain('Used for ideas, or to match its layout');
    const withUpload = text(panel({ reference: BY_URL('https://elsewhere.test'), onReferenceAdded: () => {} }));
    expect(withUpload).toContain('Add a screenshot of elsewhere.test .');
    expect(withUpload).toContain('Used for ideas, or to match its layout and structure when you pick Match its layout. Its text, photos, logo, colors and brand never go on the customer\'s site.');
  });

  it('keeps the inspiration wording without a match', () => {
    for (const reference of [null, { mode: 'inspire', source: { kind: 'url', url: 'https://ref-site.test/' } }]) {
      const html = panel({ reference });
      expect(text(html)).toContain('Claude looks at their logo, reference screenshots and photos, reads their answers, and proposes the whole look.');
      expect(button(html)[1]).toBe('Suggest a design with Claude');
    }
  });

  it('shows what a match result mirrored', () => {
    const suggestion = {
      status: 'ready', startedAt: '2026-10-06T09:00:00.000Z', finishedAt: '2026-10-06T09:02:00.000Z', templateId: 'mobile_sudsy',
      levers: { palette: FULL_STUDIO, fonts: { heading: 'Oswald', body: 'Inter' }, sections: { order: [], hidden: [] }, heroLayout: 'full', aboutLayout: '' },
      photoPlan: { hero: '', about: '', gallery: [] },
      reasons: { palette: 'Kept your Studio palette. The reference\'s colors are never used.', reference: 'Full-width photo hero, three service cards' },
      facts: [], skipped: [],
      reference: { mode: 'match', source: { kind: 'url', url: 'https://ref-site.test/' }, label: 'ref-site.test', shots: [{ path: SHOT.path, name: 'home.png' }], paletteFrom: 'studio' },
    };
    const html = panel({ project: { ...PROJECT, design: { ...PROJECT.design, suggestion } }, reference: BY_URL() });
    const t = text(html);
    expect(t).toContain('Matched the layout of ref-site.test');
    expect(t).toContain('Full-width photo hero, three service cards');
    expect(t).toContain('the colors are from our side, and its text, photos, logo and brand stay out');
    expect(t).toContain('Kept your Studio palette.');
    expect(html).toContain('src="https://files.test/home.png"');
    expect(button(html)[1]).toBe('Match again');
  });
});

describe('ReferenceShotUpload', () => {
  it('names the site, the formats and that only the layout is used', () => {
    const html = renderToStaticMarkup(<ReferenceShotUpload projectId={PID} sourceUrl="https://www.ref-site.test/" onAdded={() => {}} />);
    const t = text(html);
    expect(t).toContain('Add a screenshot of ref-site.test . PNG, JPEG or WebP, up to 10 MB. One full-page screenshot is fine: it\'s split into parts automatically, and a match looks at the top 4.');
    expect(t).toContain('Its text, photos, logo, colors and brand never go on the customer\'s site.');
    expect(html).toContain(`accept="${SHOT_ACCEPT}"`);
    expect(html).toMatch(/type="file"[^>]*multiple=""/);
    expect(html).not.toContain('role="progressbar"');
    expect(text(renderToStaticMarkup(<ReferenceShotUpload projectId={PID} />))).toContain('Add a screenshot of the reference site.');
  });
});
