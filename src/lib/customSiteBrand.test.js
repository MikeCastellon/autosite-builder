import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// supabase.js throws at import without env vars: a fake signed-in session.
let session = { access_token: 'tok-123' };
vi.mock('./supabase.js', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session } }) } },
}));

const {
  BRAND_FN, brandAdjustments, brandChoices, brandContrastChecks, brandFonts, brandLogo, brandNotes, brandReasons,
  brandResponse, brandRunError, brandRunNotes, brandRunState, choiceInUse, elapsedLabel, getBrandRun, isNotSetUp,
  leversWithBrand, modelLabel, newerBrandRun, safeBoardUrl, startBrandRun, usageLabel,
} = await import('./customSiteBrand.js');
const { BRAND_CLAIM_STALE_MS, brandContrast, brandPaletteOf, brandToLevers } = await import('./brandSpec.js');
const { contrastRatio } = await import('../components/preview/templates/kit/theme.js');

const NOW = Date.parse('2026-10-05T20:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

const PALETTE = { bg: '#FFFFFF', secondary: '#f4f4f5', text: '#111111', muted: '#52525b', accent: '#B91C1C' };
const LIGHT = { bg: '#fafafa', secondary: '#ffffff', text: '#18181b', muted: '#52525b', accent: '#b91c1c' };
const DARK = { bg: '#0b0b0f', secondary: '#18181b', text: '#f4f4f5', muted: '#a1a1aa', accent: '#ef4444' };
const SPEC = {
  version: 1,
  palette: PALETTE,
  alternates: { light: LIGHT, dark: DARK },
  fonts: { heading: 'Oswald', body: 'Inter' },
  reasons: { palette: 'Built around the red in the logo.', accent: 'The logo red, darkened for white text.', fonts: 'Condensed like the logo.' },
  logo: { dominant: ['#B91C1C', '#111111'], background: 'transparent', hasText: true },
  notes: ['The logo has a thin outline that disappears below 32px.'],
};
const READY = { status: 'ready', startedAt: ago(90_000), finishedAt: ago(10_000), model: 'claude-opus-5-5', brand: SPEC, boardPath: 'p1/brand/board-1.png', usage: { input_tokens: 12345, output_tokens: 2345 }, error: null };

describe('brandRunState', () => {
  it('is idle before any run, and for a record it does not know', () => {
    expect(brandRunState(null, NOW)).toBe('idle');
    expect(brandRunState(undefined, NOW)).toBe('idle');
    expect(brandRunState({}, NOW)).toBe('idle');
    expect(brandRunState({ status: 'queued' }, NOW)).toBe('idle');
    expect(brandRunState([], NOW)).toBe('idle');
  });

  it('is running until the run is older than any run can take, then stale', () => {
    expect(brandRunState({ status: 'running', startedAt: ago(30_000) }, NOW)).toBe('running');
    expect(brandRunState({ status: 'running', startedAt: ago(BRAND_CLAIM_STALE_MS - 1) }, NOW)).toBe('running');
    expect(brandRunState({ status: 'running', startedAt: ago(BRAND_CLAIM_STALE_MS + 1) }, NOW)).toBe('stale');
    // A start the card can't date can't be waited on.
    expect(brandRunState({ status: 'running' }, NOW)).toBe('stale');
    expect(brandRunState({ status: 'running', startedAt: 'yesterday' }, NOW)).toBe('stale');
    // A start just after the card's clock last ticked is not negative-stale.
    expect(brandRunState({ status: 'running', startedAt: new Date(NOW + 5000).toISOString() }, NOW)).toBe('running');
  });

  it('is ready only with a full palette to show; failed otherwise', () => {
    expect(brandRunState(READY, NOW)).toBe('ready');
    expect(brandRunState({ ...READY, brand: { ...SPEC, palette: { ...PALETTE, muted: 'grey' } } }, NOW)).toBe('failed');
    expect(brandRunState({ ...READY, brand: null }, NOW)).toBe('failed');
    expect(brandRunState({ status: 'failed', error: 'boom' }, NOW)).toBe('failed');
  });

  it('never calls a finished run stale, however old', () => {
    expect(brandRunState({ status: 'failed', startedAt: ago(BRAND_CLAIM_STALE_MS * 2) }, NOW)).toBe('failed');
    expect(brandRunState({ ...READY, startedAt: ago(BRAND_CLAIM_STALE_MS * 2) }, NOW)).toBe('ready');
  });
});

describe('brandRunError', () => {
  it('shows the stored error on one line, or a plain fallback', () => {
    expect(brandRunError({ status: 'failed', error: 'The logo file\ncould not be read.' })).toBe('The logo file could not be read.');
    expect(brandRunError({ status: 'failed' })).toBe('Something went wrong.');
    expect(brandRunError({ status: 'ready', brand: {} })).toMatch(/without a usable palette/);
    expect(brandRunError({ status: 'failed', error: 'x'.repeat(1000) })).toHaveLength(400);
  });
});

describe('newerBrandRun', () => {
  const older = { status: 'ready', startedAt: ago(600_000), brand: SPEC };
  const newer = { status: 'running', startedAt: ago(5_000) };

  it('takes the later start, whichever side it is on', () => {
    expect(newerBrandRun(older, newer)).toBe(newer);
    expect(newerBrandRun(newer, older)).toBe(newer);
  });

  it('for the same run, a finished record beats the running one it replaced', () => {
    const running = { status: 'running', startedAt: READY.startedAt };
    expect(newerBrandRun(running, READY)).toBe(READY);
    expect(newerBrandRun(READY, running)).toBe(READY);
    const failed = { status: 'failed', startedAt: READY.startedAt, error: 'timed out' };
    expect(newerBrandRun(running, failed)).toBe(failed);
  });

  it('copes with missing records and dates', () => {
    expect(newerBrandRun(null, READY)).toBe(READY);
    expect(newerBrandRun(READY, undefined)).toBe(READY);
    expect(newerBrandRun(null, null)).toBe(null);
    expect(newerBrandRun({ foo: 1 }, READY)).toBe(READY);
    const undated = { status: 'ready', brand: SPEC };
    expect(newerBrandRun(undated, newer)).toBe(newer);
    expect(newerBrandRun(newer, undated)).toBe(newer);
  });
});

describe('brandChoices', () => {
  it('lists the recommended palette, then the light and dark versions', () => {
    const choices = brandChoices(SPEC);
    expect(choices.map((c) => c.id)).toEqual(['main', 'light', 'dark']);
    expect(choices.map((c) => c.which)).toEqual([undefined, 'light', 'dark']);
    expect(choices[0].palette.bg).toBe('#ffffff');
    expect(choices[2].palette).toEqual(DARK);
  });

  it('leaves out broken alternates and ones that repeat a palette already listed', () => {
    const sameAsMain = brandChoices({ ...SPEC, alternates: { light: { ...PALETTE }, dark: { ...DARK, text: 'white' } } });
    expect(sameAsMain.map((c) => c.id)).toEqual(['main']);
    expect(brandChoices({ palette: PALETTE }).map((c) => c.id)).toEqual(['main']);
    // sanitizeBrand stores an alternate it left out as null.
    expect(brandChoices({ ...SPEC, alternates: { light: null, dark: DARK } }).map((c) => c.id)).toEqual(['main', 'dark']);
    expect(brandChoices({ palette: { ...PALETTE, muted: '' } })).toEqual([]);
    expect(brandChoices(null)).toEqual([]);
  });
});

describe('brandFonts / reasons / logo / notes', () => {
  it('keeps catalog families only, and a body face that reads at paragraph size', () => {
    expect(brandFonts(SPEC)).toEqual({ heading: 'Oswald', body: 'Inter' });
    expect(brandFonts({ fonts: { heading: 'Comic Sans MS', body: 'Inter' } })).toEqual({ heading: '', body: 'Inter' });
    expect(brandFonts({ fonts: { heading: 'Bebas Neue', body: 'Bebas Neue' } })).toEqual({ heading: 'Bebas Neue', body: '' });
    expect(brandFonts({ fonts: { heading: 'constructor', body: 'toString' } })).toEqual({ heading: '', body: '' });
    expect(brandFonts(null)).toEqual({ heading: '', body: '' });
  });

  it('shows the same fonts brandToLevers applies', () => {
    for (const fonts of [SPEC.fonts, { heading: 'Anton', body: 'Space Mono' }, { heading: 'Nope', body: 'Lato' }]) {
      const shown = brandFonts({ fonts });
      const applied = brandToLevers({ ...SPEC, fonts }).fonts;
      expect({ heading: applied.heading || '', body: applied.body || '' }).toEqual(shown);
    }
  });

  it('puts reasons on one line', () => {
    expect(brandReasons({ reasons: { palette: '  Red\n\nlogo  ', fonts: 5 } })).toEqual({ palette: 'Red logo', accent: '', fonts: '' });
    expect(brandReasons(SPEC).accent).toBe(SPEC.reasons.accent);
  });

  it('reads the logo summary, or null when there is none', () => {
    expect(brandLogo(SPEC)).toEqual({ dominant: ['#b91c1c', '#111111'], background: 'transparent', hasText: true });
    expect(brandLogo({ logo: { dominant: ['#B91C1C', '#b91c1c', 'red'], background: 'plaid' } })).toEqual({ dominant: ['#b91c1c'], background: '', hasText: null });
    expect(brandLogo({ logo: {} })).toBe(null);
    expect(brandLogo({})).toBe(null);
  });

  it('keeps notes that say something', () => {
    expect(brandNotes({ notes: ['  one ', '', 3, 'two'] })).toEqual(['one', 'two']);
    expect(brandNotes({ notes: 'nope' })).toEqual([]);
  });
});

describe('brandContrastChecks', () => {
  it('checks the four pairs the contract names, as the site paints them', () => {
    const rows = brandContrastChecks(PALETTE);
    expect(rows.map((r) => r.id)).toEqual(['text', 'muted', 'onAccent', 'surface']);
    expect(rows.every((r) => r.pass && !r.adjusted)).toBe(true);
    expect(rows[0].ratio).toBeCloseTo(contrastRatio('#111111', '#ffffff'), 2);
    // Same numbers as the server's check.
    expect(rows.map(({ adjusted, ...r }) => (void adjusted, r))).toEqual(brandContrast(PALETTE));
  });

  it('marks a text color the site has to fix, and an accent no label can read on', () => {
    const rows = brandContrastChecks({ ...PALETTE, muted: '#d4d4d8', accent: '#797979' });
    const muted = rows.find((r) => r.id === 'muted');
    expect(muted.pass).toBe(true);
    expect(muted.adjusted).toBe(true);
    const onAccent = rows.find((r) => r.id === 'onAccent');
    expect(onAccent.ratio).toBeLessThan(4.5);
    expect(onAccent.pass).toBe(false);
  });

  it('is empty for a palette it cannot read', () => {
    expect(brandContrastChecks({ bg: '#fff' })).toEqual([]);
  });
});

describe('brandAdjustments', () => {
  it('names what the server changed after the board was drawn', () => {
    const spec = {
      adjustments: [
        { target: 'palette.accent', from: '#C0C0C0', to: '#6b6b6b', reason: 'Adjusted so button text reads at 4.5:1 on it' },
        { target: 'alternates.dark.secondary', from: '#333333', to: '#1a1a1a', reason: 'Moved toward the background' },
        { target: 'alternates.light', from: '', to: '', reason: 'Left out: not five #rrggbb colors' },
        { target: 'fonts.body', from: 'Anton', to: '', reason: 'A display or mono face doesn\'t read at paragraph size' },
        { target: 'palette.secondary', from: '#eee', to: '#f0f0f0' },
      ],
    };
    expect(brandAdjustments(spec)).toEqual([
      { what: 'Accent', from: '#c0c0c0', to: '#6b6b6b', reason: 'Adjusted so button text reads at 4.5:1 on it' },
      { what: 'Dark version: surface / secondary', from: '#333333', to: '#1a1a1a', reason: 'Moved toward the background' },
      { what: 'Light version', from: '', to: '', reason: 'Left out: not five #rrggbb colors' },
      { what: 'Body font', from: 'Anton', to: '', reason: 'A display or mono face doesn\'t read at paragraph size' },
    ]);
    expect(brandAdjustments({})).toEqual([]);
  });
});

describe('brandRunNotes', () => {
  it('lists the uploads the run left out and its warnings', () => {
    const run = {
      status: 'ready',
      skipped: [
        { path: 'p1/logo/a.pdf', kind: 'logo', name: 'logo.pdf', reason: 'PDF files aren\'t sent; only PNG, JPEG, WebP and GIF images are' },
        { path: 'p1/reference/big.png', kind: 'reference', name: '', reason: 'Too large to send' },
        'plain text note',
      ],
      warnings: ['The board font fell back to DejaVu Sans.', { message: 'Second\nline' }, 7],
    };
    expect(brandRunNotes(run)).toEqual({
      skipped: [
        'logo.pdf: PDF files aren\'t sent; only PNG, JPEG, WebP and GIF images are',
        'big.png: Too large to send',
        'plain text note',
      ],
      warnings: ['The board font fell back to DejaVu Sans.', 'Second line'],
    });
    expect(brandRunNotes(null)).toEqual({ skipped: [], warnings: [] });
  });
});

describe('leversWithBrand', () => {
  const levers = {
    palette: { accent: '#123456' },
    fonts: { heading: 'Poppins' },
    sections: { order: ['hero', 'services'], hidden: ['faq'] },
    heroLayout: 'split',
    facts: { warranty: '2 years' },
    googlePlace: { placeId: 'abc' },
  };

  it('replaces the palette and fonts and keeps every other lever', () => {
    const next = leversWithBrand(levers, { palette: DARK, fonts: { heading: 'Oswald', body: 'Inter' } });
    expect(next.palette).toEqual(DARK);
    expect(next.fonts).toEqual({ heading: 'Oswald', body: 'Inter' });
    expect(next.sections).toBe(levers.sections);
    expect(next.heroLayout).toBe('split');
    expect(next.facts).toBe(levers.facts);
    expect(next.googlePlace).toBe(levers.googlePlace);
    expect(levers.palette).toEqual({ accent: '#123456' });
  });

  it('sets only the font slots the brand has, so the other keeps the template font', () => {
    expect(leversWithBrand(levers, { palette: PALETTE, fonts: { heading: 'Oswald', body: 'Wingdings' } }).fonts).toEqual({ heading: 'Oswald' });
  });

  it('falls back to the choice shown when the patch has nothing usable', () => {
    const next = leversWithBrand(levers, null, { palette: LIGHT, fonts: { heading: 'Oswald', body: 'Inter' } });
    expect(next.palette).toEqual(LIGHT);
    expect(next.fonts).toEqual({ heading: 'Oswald', body: 'Inter' });
  });

  it('leaves the fonts alone when the brand has none', () => {
    const next = leversWithBrand(levers, { palette: PALETTE, fonts: {} });
    expect(next.fonts).toBe(levers.fonts);
    expect(leversWithBrand(undefined, { palette: PALETTE })).toEqual({ palette: brandPaletteOf(PALETTE) });
  });

  it('applies exactly what brandToLevers gives for each choice', () => {
    for (const choice of brandChoices(SPEC)) {
      const next = leversWithBrand({}, brandToLevers(SPEC, choice.which), choice);
      expect(next.palette).toEqual(choice.palette);
      expect(choiceInUse(brandChoices(SPEC), next, SPEC.fonts)).toBe(choice.id);
    }
  });
});

describe('choiceInUse', () => {
  const choices = brandChoices(SPEC);
  const fonts = brandFonts(SPEC);

  it('names the choice the levers already hold', () => {
    expect(choiceInUse(choices, { palette: DARK, fonts: { heading: 'Oswald', body: 'Inter' } }, fonts)).toBe('dark');
    expect(choiceInUse(choices, { palette: { ...PALETTE, accent: '#b91c1c', bg: '#ffffff' }, fonts }, fonts)).toBe('main');
  });

  it('is empty when the palette or a font differs', () => {
    expect(choiceInUse(choices, { palette: { ...DARK, accent: '#000000' }, fonts }, fonts)).toBe('');
    expect(choiceInUse(choices, { palette: DARK, fonts: { heading: 'Poppins', body: 'Inter' } }, fonts)).toBe('');
    expect(choiceInUse(choices, { palette: {} }, fonts)).toBe('');
    expect(choiceInUse(choices, null, fonts)).toBe('');
  });
});

describe('labels', () => {
  it('names models the way the admin knows them', () => {
    expect(modelLabel('claude-opus-5-5')).toBe('Claude Opus 5.5');
    expect(modelLabel('claude-sonnet-4-5-20250929')).toBe('Claude Sonnet 4.5');
    expect(modelLabel('claude-haiku-5')).toBe('Claude Haiku 5');
    expect(modelLabel('some-other-model')).toBe('some-other-model');
    expect(modelLabel(null)).toBe('');
  });

  it('says how many tokens a run used', () => {
    expect(usageLabel({ input_tokens: 12345, output_tokens: 2345 })).toBe('12,345 tokens in, 2,345 out');
    expect(usageLabel({ input_tokens: 10 })).toBe('10 tokens in, 0 out');
    expect(usageLabel({})).toBe('');
    expect(usageLabel(null)).toBe('');
    expect(usageLabel({ input_tokens: -4, output_tokens: 'lots' })).toBe('');
  });

  it('shows the time since the run started', () => {
    expect(elapsedLabel({ startedAt: ago(65_000) }, NOW)).toBe('1:05');
    expect(elapsedLabel({ startedAt: ago(5_000) }, NOW)).toBe('0:05');
    expect(elapsedLabel({ startedAt: new Date(NOW + 3000).toISOString() }, NOW)).toBe('0:00');
    expect(elapsedLabel({}, NOW)).toBe('');
  });
});

describe('brandResponse / safeBoardUrl / isNotSetUp', () => {
  it('reads the run record and the signed board link', () => {
    const v = brandResponse({ brand: READY, boardUrl: 'https://x.supabase.co/storage/v1/object/sign/custom-site-assets/p1/brand/board-1.png?token=abc' });
    expect(v).toMatchObject({ configured: true, run: READY, alreadyRunning: false, message: '' });
    expect(v.boardUrl).toMatch(/^https:\/\/x\.supabase\.co\//);
    expect(brandResponse({ brand: null }).run).toBe(null);
    expect(brandResponse({ run: READY }).run).toBe(READY);
    expect(brandResponse(null)).toMatchObject({ configured: true, run: null, boardUrl: '' });
  });

  it('counts a start that only sent its startedAt back as running', () => {
    expect(brandResponse({ startedAt: '2026-10-05T19:59:00.000Z' }).run).toEqual({ status: 'running', startedAt: '2026-10-05T19:59:00.000Z' });
    expect(brandResponse({ startedAt: '2026-10-05T19:59:00.000Z' }, { status: 409 }).run).toBe(null);
  });

  it('reports "not set up" from configured: false or the code', () => {
    expect(isNotSetUp({ configured: false })).toBe(true);
    expect(isNotSetUp({ code: 'not_configured' })).toBe(true);
    expect(isNotSetUp({ configured: true })).toBe(false);
    expect(isNotSetUp({})).toBe(false);
    expect(isNotSetUp(null)).toBe(false);
    const v = brandResponse({ configured: false, error: 'Brand skill not set up:\nset the env vars' }, { status: 503 });
    expect(v).toMatchObject({ configured: false, message: 'Brand skill not set up: set the env vars', run: null });
  });

  it('only lets web links through to the <img>', () => {
    expect(safeBoardUrl('https://a.b/c.png')).toBe('https://a.b/c.png');
    expect(safeBoardUrl('http://127.0.0.1:54321/storage/x.png')).toBe('http://127.0.0.1:54321/storage/x.png');
    expect(safeBoardUrl('http://evil.example/x.png')).toBe('');
    expect(safeBoardUrl('javascript:alert(1)')).toBe('');
    expect(safeBoardUrl('https://a.b/c.png" onerror="x')).toBe('');
    expect(safeBoardUrl(null)).toBe('');
  });
});

describe('startBrandRun / getBrandRun', () => {
  let fetchMock;
  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

  beforeEach(() => {
    session = { access_token: 'tok-123' };
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('posts the action with the admin sign-in', async () => {
    fetchMock.mockResolvedValue(reply(200, { brand: { status: 'running', startedAt: '2026-10-05T19:59:00.000Z' }, startedAt: '2026-10-05T19:59:00.000Z' }));
    const view = await startBrandRun('p1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(BRAND_FN);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ action: 'start', id: 'p1' });
    expect(view.run.status).toBe('running');

    fetchMock.mockResolvedValue(reply(200, { brand: READY, boardUrl: 'https://a.b/board.png' }));
    const got = await getBrandRun('p1');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ action: 'get', id: 'p1' });
    expect(got).toMatchObject({ configured: true, run: READY, boardUrl: 'https://a.b/board.png' });
  });

  it('answers "not set up" and "already running" instead of throwing', async () => {
    fetchMock.mockResolvedValue(reply(503, { configured: false, error: 'Not set up yet' }));
    await expect(startBrandRun('p1')).resolves.toMatchObject({ configured: false, message: 'Not set up yet' });

    const live = { status: 'running', startedAt: '2026-10-05T19:59:00.000Z' };
    fetchMock.mockResolvedValue(reply(409, { error: 'A brand system is already being built', brand: live }));
    await expect(startBrandRun('p1')).resolves.toMatchObject({ alreadyRunning: true, run: live, configured: true });
  });

  it('throws the server error, or a plain one when it says nothing', async () => {
    fetchMock.mockResolvedValue(reply(502, { error: 'Couldn\'t start the brand run: timeout' }));
    await expect(startBrandRun('p1')).rejects.toMatchObject({ message: 'Couldn\'t start the brand run: timeout', status: 502 });

    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('not json'); } });
    await expect(getBrandRun('p1')).rejects.toMatchObject({ message: 'Request failed (500)', status: 500 });
  });

  it('says when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getBrandRun('p1')).rejects.toMatchObject({ offline: true });
  });

  it('needs a sign-in and a project, and asks nothing without them', async () => {
    session = null;
    await expect(getBrandRun('p1')).rejects.toThrow('Not signed in');
    session = { access_token: 'tok-123' };
    await expect(startBrandRun('')).rejects.toThrow('No project');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
