// Admin > Pipeline: the board's filters, sorts, totals and journey.
import { describe, it, expect } from 'vitest';
import {
  filterLeads, findDuplicates, groupByStage, initials, isDue, journeyFor, matchesOwner, monthlyLabel,
  movementLabel, openPipelineTotal, stageAgeLabel, validateLead, visibleOnBoard,
} from './pipelineFilters.js';

const STAGES = [
  { id: 's1', name: 'New Lead', kind: 'open' },
  { id: 's2', name: 'Contacted', kind: 'open' },
  { id: 'won', name: 'Won', kind: 'won' },
  { id: 'lost', name: 'Lost', kind: 'lost' },
];

const lead = (over) => ({
  id: 'l', companyName: 'Shop', stageId: 's1', ownerId: 'me', createdBy: 'me',
  createdAt: '2026-10-01T10:00:00Z', stageEnteredAt: '2026-10-01T10:00:00Z', ...over,
});

describe('filterLeads', () => {
  const leads = [
    lead({ id: 'a', companyName: 'Bravo Detail', city: 'Orlando', stageEnteredAt: '2026-10-03T00:00:00Z', estMonthlyValue: 49, createdAt: '2026-10-03T00:00:00Z' }),
    lead({ id: 'b', companyName: 'Alpha Tint', ownerId: 'other', stageEnteredAt: '2026-09-01T00:00:00Z', estMonthlyValue: 99, nextActionOn: '2026-10-09' }),
    lead({ id: 'c', companyName: 'Charlie Wash', ownerId: null, createdBy: 'me', contactName: 'Dana', nextActionOn: '2026-10-06' }),
  ];

  it('defaults to the one that has sat longest, across all owners', () => {
    expect(filterLeads(leads).map((l) => l.id)).toEqual(['b', 'c', 'a']);
  });

  it('"Mine" is what I own, or started and nobody has taken over', () => {
    expect(filterLeads(leads, { owner: 'mine', userId: 'me' }).map((l) => l.id).sort()).toEqual(['a', 'c']);
    expect(matchesOwner(lead({ ownerId: null, createdBy: 'me' }), 'mine', 'me')).toBe(true);
    expect(matchesOwner(lead({ ownerId: 'x', createdBy: 'me' }), 'mine', 'me')).toBe(false);
  });

  it('searches the business, contact and town; sorts by value, name, and next action with blanks last', () => {
    expect(filterLeads(leads, { search: 'dana' }).map((l) => l.id)).toEqual(['c']);
    expect(filterLeads(leads, { search: 'orlando' }).map((l) => l.id)).toEqual(['a']);
    expect(filterLeads(leads, { sort: 'value' }).map((l) => l.id)).toEqual(['b', 'a', 'c']);
    expect(filterLeads(leads, { sort: 'name' }).map((l) => l.id)).toEqual(['b', 'a', 'c']);
    expect(filterLeads(leads, { sort: 'next' }).map((l) => l.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('the board', () => {
  it('groups by stage, totals only the open ones, and lets won leads go after a week', () => {
    const now = Date.parse('2026-10-20T00:00:00Z');
    const leads = [
      lead({ id: 'a', stageId: 's1', estMonthlyValue: 49 }),
      lead({ id: 'b', stageId: 's2', estMonthlyValue: '99' }),
      lead({ id: 'w-old', stageId: 'won', estMonthlyValue: 500, stageEnteredAt: '2026-10-01T00:00:00Z' }),
      lead({ id: 'w-new', stageId: 'won', stageEnteredAt: '2026-10-18T00:00:00Z' }),
      lead({ id: 'x', stageId: 'lost', estMonthlyValue: 20 }),
    ];
    expect(groupByStage(leads, STAGES).map((g) => g.leads.length)).toEqual([1, 1, 2, 1]);
    expect(openPipelineTotal(leads, STAGES)).toBe(148);
    expect(visibleOnBoard(leads, STAGES, now).map((l) => l.id)).toEqual(['a', 'b', 'w-new', 'x']);
  });

  it('labels value, age and due dates tersely', () => {
    expect(monthlyLabel(49)).toBe('$49/mo');
    expect(monthlyLabel(2200)).toBe('$2.2k/mo');
    expect(monthlyLabel(12000)).toBe('$12k/mo');
    expect(monthlyLabel(null)).toBeNull();
    const now = Date.parse('2026-10-05T15:00:00');
    expect(stageAgeLabel(lead({ stageEnteredAt: '2026-10-05T09:00:00' }), now)).toBe('today');
    expect(stageAgeLabel(lead({ stageEnteredAt: '2026-10-02T09:00:00' }), now)).toBe('3d');
    expect(isDue('2026-10-05', now)).toBe(true);
    expect(isDue('2026-10-01', now)).toBe(true);
    expect(isDue('2026-10-06', now)).toBe(false);
    expect(initials('Mike Castellon')).toBe('MC');
    expect(initials('dev@639hz.com')).toBe('DC');
    expect(initials('')).toBe('–');
  });
});

describe('validateLead / findDuplicates', () => {
  it('needs only a name and a stage', () => {
    expect(validateLead({ companyName: 'Shop', stageId: 's1' })).toEqual({});
    expect(Object.keys(validateLead({}))).toEqual(['companyName', 'stageId']);
    expect(validateLead({ companyName: 'Shop', stageId: 's1', email: 'nope' }).email).toBeTruthy();
    expect(validateLead({ companyName: 'Shop', stageId: 's1', estMonthlyValue: '-5' }).estMonthlyValue).toBeTruthy();
  });

  it('warns about the same name among leads and accounts', () => {
    const d = findDuplicates('shiny', {
      leads: [lead({ companyName: 'Shiny Auto Spa' }), lead({ companyName: 'Other' })],
      accounts: [{ id: 'u1', name: 'SHINY detailing' }],
    });
    expect(d.leads).toHaveLength(1);
    expect(d.accounts).toHaveLength(1);
    expect(findDuplicates('sh', { leads: [lead({ companyName: 'Shiny' })] }).leads).toHaveLength(0);
  });
});

describe('the journey', () => {
  it('marks only the stages the lead actually stood in as done', () => {
    const movements = [
      { fromStageId: null, toStageId: 's1', createdAt: '2026-10-01T00:00:00Z' },
      { fromStageId: 's1', toStageId: 'won', createdAt: '2026-10-02T00:00:00Z' },
    ];
    const steps = journeyFor(STAGES, movements, 'won');
    expect(steps.map((s) => (s.current ? 'current' : s.done ? 'done' : 'upcoming'))).toEqual(['done', 'upcoming', 'current', 'upcoming']);
    const byId = Object.fromEntries(STAGES.map((s) => [s.id, s]));
    expect(movementLabel(movements[0], byId)).toBe('Added to New Lead');
    expect(movementLabel(movements[1], byId)).toBe('New Lead → Won');
  });
});
