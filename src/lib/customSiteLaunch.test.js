import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_ROUNDS_INCLUDED, LAUNCH_ITEMS, LAUNCH_ITEM_IDS, LAUNCH_NOTES_MAX, MAX_ROUNDS,
  applyLaunchPatch, describeLaunchEvent, launchOf, launchProgress, roundStatus, sanitizeLaunch,
} from './customSiteLaunch.js';

// The card's network and toast hooks: the smoke render below needs neither.
vi.mock('./customSites.js', () => ({ customSiteAdmin: vi.fn(async () => ({})) }));
vi.mock('../components/ui/AlertProvider.jsx', () => ({ useAlert: () => ({ toast: () => {}, confirm: async () => true }) }));

const NOW = '2026-10-05T18:30:00.000Z';
const EARLIER = '2026-10-01T12:00:00.000Z';

describe('LAUNCH_ITEMS', () => {
  it('keeps the stored ids (saved projects use them: never rename one)', () => {
    expect(LAUNCH_ITEM_IDS).toEqual([
      'domain', 'google_profile', 'test_booking', 'contact_form', 'logo_favicon', 'mobile', 'seo', 'customer_approved', 'handed_over',
    ]);
    for (const item of LAUNCH_ITEMS) {
      expect(item.label).toBeTruthy();
      expect(item.hint).toBeTruthy();
    }
  });
});

describe('sanitizeLaunch', () => {
  it('fills the defaults from nothing', () => {
    const empty = { checked: {}, round: 0, roundsIncluded: DEFAULT_ROUNDS_INCLUDED, notes: '' };
    for (const raw of [undefined, null, 'x', 42, [], {}]) expect(sanitizeLaunch(raw)).toEqual(empty);
    expect(DEFAULT_ROUNDS_INCLUDED).toBe(3);
  });

  it('keeps known items with real dates, normalized to UTC ISO', () => {
    const out = sanitizeLaunch({
      checked: { domain: '2026-10-01T04:00:00-05:00', mobile: 'not a date', made_up: EARLIER, seo: true, google_profile: '' },
    });
    expect(out.checked).toEqual({ domain: '2026-10-01T09:00:00.000Z' });
  });

  it('clamps the counters to whole numbers in range and ignores non-numbers', () => {
    expect(sanitizeLaunch({ round: 25, roundsIncluded: 0 })).toMatchObject({ round: MAX_ROUNDS, roundsIncluded: 1 });
    expect(sanitizeLaunch({ round: -3, roundsIncluded: 99 })).toMatchObject({ round: 0, roundsIncluded: MAX_ROUNDS });
    expect(sanitizeLaunch({ round: '2', roundsIncluded: '4.4' })).toMatchObject({ round: 2, roundsIncluded: 4 });
    expect(sanitizeLaunch({ round: true, roundsIncluded: '' })).toMatchObject({ round: 0, roundsIncluded: 3 });
    expect(sanitizeLaunch({ round: 'abc', roundsIncluded: null })).toMatchObject({ round: 0, roundsIncluded: 3 });
  });

  it('trims and caps the notes', () => {
    expect(sanitizeLaunch({ notes: '  call Tue  ' }).notes).toBe('call Tue');
    expect(sanitizeLaunch({ notes: 'x'.repeat(LAUNCH_NOTES_MAX + 50) }).notes).toHaveLength(LAUNCH_NOTES_MAX);
    expect(sanitizeLaunch({ notes: 7 }).notes).toBe('');
  });

  it('launchOf reads a project, with or without a design', () => {
    expect(launchOf({ design: { launch: { round: 2 } } }).round).toBe(2);
    expect(launchOf({ design: {} })).toEqual(sanitizeLaunch(null));
    expect(launchOf(null)).toEqual(sanitizeLaunch(null));
  });
});

describe('applyLaunchPatch', () => {
  it('dates a new tick with the given clock and keeps the first date of one already ticked', () => {
    const current = { checked: { domain: EARLIER }, round: 1 };
    const { launch, changed, event } = applyLaunchPatch(current, { checked: { domain: true, mobile: true } }, NOW);
    expect(launch.checked).toEqual({ domain: EARLIER, mobile: NOW });
    expect(changed).toBe(true);
    expect(event).toEqual({ checked: ['mobile'] });
    // The stored object is never changed in place.
    expect(current.checked).toEqual({ domain: EARLIER });
  });

  it('unticks, and ignores unknown ids and values that are not booleans', () => {
    const { launch, event } = applyLaunchPatch(
      { checked: { domain: EARLIER, seo: EARLIER } },
      { checked: { domain: false, seo: 'yes', made_up: true, mobile: 1 } },
      NOW,
    );
    expect(launch.checked).toEqual({ seo: EARLIER });
    expect(event).toEqual({ unchecked: ['domain'] });
  });

  it('records round changes with the included count they were made against', () => {
    const { launch, event } = applyLaunchPatch({ round: 3 }, { round: 4 }, NOW);
    expect(launch.round).toBe(4);
    expect(event).toEqual({ round: { from: 3, to: 4, of: 3 } });
    const both = applyLaunchPatch({ round: 3 }, { round: 4, roundsIncluded: 5 }, NOW);
    expect(both.event).toEqual({ roundsIncluded: { from: 3, to: 5 }, round: { from: 3, to: 4, of: 5 } });
  });

  it('clamps counters and reports no change when nothing moved', () => {
    expect(applyLaunchPatch({ round: MAX_ROUNDS }, { round: MAX_ROUNDS + 1 }, NOW)).toMatchObject({ changed: false, event: null });
    expect(applyLaunchPatch({ round: 0 }, { round: -1 }, NOW)).toMatchObject({ changed: false, event: null });
    expect(applyLaunchPatch({}, { checked: { domain: false } }, NOW)).toMatchObject({ changed: false, event: null });
    expect(applyLaunchPatch({}, {}, NOW)).toMatchObject({ changed: false, event: null });
    expect(applyLaunchPatch({}, null, NOW)).toMatchObject({ changed: false, event: null });
  });

  it('saves notes without an activity entry', () => {
    const out = applyLaunchPatch({ notes: 'a' }, { notes: ' b ' }, NOW);
    expect(out).toMatchObject({ changed: true, event: null });
    expect(out.launch.notes).toBe('b');
    expect(applyLaunchPatch({ notes: 'b' }, { notes: 'b  ' }, NOW).changed).toBe(false);
  });

  it('cleans what it was given (an old or hand-edited row)', () => {
    const { launch } = applyLaunchPatch({ checked: { domain: 'garbage', made_up: EARLIER }, round: 99 }, { checked: { mobile: true } }, NOW);
    expect(launch).toEqual({ checked: { mobile: NOW }, round: MAX_ROUNDS, roundsIncluded: 3, notes: '' });
  });
});

describe('launchProgress', () => {
  it('counts the known items ticked', () => {
    expect(launchProgress(undefined)).toEqual({ done: 0, total: 9, complete: false, label: '0 of 9 done' });
    expect(launchProgress({ checked: { domain: EARLIER, mobile: EARLIER, made_up: EARLIER } })).toMatchObject({ done: 2, label: '2 of 9 done' });
    const all = Object.fromEntries(LAUNCH_ITEM_IDS.map((id) => [id, EARLIER]));
    expect(launchProgress({ checked: all })).toEqual({ done: 9, total: 9, complete: true, label: 'All 9 done' });
  });
});

describe('roundStatus', () => {
  it('reads "Round n of m" and warns past the included rounds', () => {
    expect(roundStatus({})).toMatchObject({ round: 0, included: 3, over: 0, label: 'No revision rounds yet', warning: '', isLastIncluded: false });
    expect(roundStatus({ round: 2 })).toMatchObject({ label: 'Round 2 of 3', warning: '', isLastIncluded: false });
    expect(roundStatus({ round: 3 })).toMatchObject({ label: 'Round 3 of 3', isLastIncluded: true });
    expect(roundStatus({ round: 4 })).toMatchObject({ over: 1, label: 'Round 4 of 3', warning: '1 round over the 3 included' });
    expect(roundStatus({ round: 6, roundsIncluded: 2 }).warning).toBe('4 rounds over the 2 included');
  });
});

describe('describeLaunchEvent', () => {
  it('names what changed in plain words', () => {
    expect(describeLaunchEvent({ checked: ['domain', 'mobile'] })).toBe('Launch list: ticked "Domain connected", "Mobile checked"');
    expect(describeLaunchEvent({ unchecked: ['seo'] })).toBe('Launch list: unticked "SEO title/description checked"');
    expect(describeLaunchEvent({ round: { from: 1, to: 2, of: 3 } })).toBe('Launch list: revision round 2 of 3');
    expect(describeLaunchEvent({ round: { from: 3, to: 4, of: 3 } })).toBe('Launch list: revision round 4 of 3 (over the included rounds)');
    expect(describeLaunchEvent({ round: { from: 2, to: 0, of: 3 } })).toBe('Launch list: revision rounds reset');
    expect(describeLaunchEvent({ roundsIncluded: { from: 3, to: 5 }, round: { from: 4, to: 5, of: 5 } }))
      .toBe('Launch list: included revision rounds set to 5; revision round 5 of 5');
    expect(describeLaunchEvent(null)).toBe('Launch list updated');
  });
});

describe('LaunchCard (static render)', () => {
  const project = (launch, extra = {}) => ({
    id: 'p1', client_first_name: 'Dana', handed_over_at: null, design: { templateId: 'mobile_chrome', launch }, ...extra,
  });

  it('shows the ticks with their dates, the progress and the round', async () => {
    const { LaunchCard } = await import('../components/admin/LaunchCard.jsx');
    const html = renderToStaticMarkup(createElement(LaunchCard, { project: project({ checked: { domain: EARLIER }, round: 2 }) }));
    expect(html).toContain('1 of 9 done');
    expect(html).toContain('Round 2 of 3');
    expect(html).toContain('Domain connected');
    expect(html).toMatch(/Done Oct 1/);
    expect(html.match(/type="checkbox"/g)).toHaveLength(9);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).not.toContain('over the');
  });

  it('warns past the included rounds and notes a hand-over already done', async () => {
    const { LaunchCard } = await import('../components/admin/LaunchCard.jsx');
    const html = renderToStaticMarkup(createElement(LaunchCard, {
      project: project({ round: 5 }, { handed_over_at: '2026-10-04T12:00:00Z' }),
    }));
    expect(html).toContain('Round 5 of 3');
    expect(html).toContain('2 rounds over the 3 included. Agree on extra rounds with Dana before doing them.');
    expect(html).toContain('Hand-over done Oct 4');
  });

  it('renders a project that has no design yet', async () => {
    const { LaunchCard } = await import('../components/admin/LaunchCard.jsx');
    const html = renderToStaticMarkup(createElement(LaunchCard, { project: { id: 'p2', design: null } }));
    expect(html).toContain('0 of 9 done');
    expect(html).toContain('No revision rounds yet');
  });
});
