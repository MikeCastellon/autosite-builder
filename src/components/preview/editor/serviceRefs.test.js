// Service names other copy keys point at: one key rule (MobileRedline's),
// the Services tab's source order, and renames that follow the service.
import { describe, it, expect } from 'vitest';
import { nameKey, serviceList, renameServiceRefs, followServiceRename, removeServiceRefs } from './serviceRefs.js';

describe('nameKey', () => {
  it('ignores case, spaces and punctuation', () => {
    expect(nameKey(' Premium  Detail ')).toBe('premiumdetail');
    expect(nameKey('premium-detail!')).toBe('premiumdetail');
    expect(nameKey('Ceramic Coating (5 yr)')).toBe('ceramiccoating5yr');
    expect(nameKey(null)).toBe('');
    expect(nameKey(undefined)).toBe('');
    expect(nameKey(299)).toBe('299');
  });
});

describe('serviceList', () => {
  it('reads businessInfo.services objects first', () => {
    const biz = {
      services: [{ name: ' Refresh Detail ', price: '$120', summary: ' Quick refresh ', description: 'x' }, { name: 'Premium', price: 260 }],
      packages: [{ name: 'Old package' }],
    };
    expect(serviceList(biz, {})).toEqual([
      { name: 'Refresh Detail', price: '$120', summary: 'Quick refresh' },
      { name: 'Premium', price: '260', summary: '' },
    ]);
  });

  it('splits an old free-text services list and accepts string items', () => {
    expect(serviceList({ services: 'Wash · Wax, Interior; Tint | ' }, {}).map((s) => s.name)).toEqual(['Wash', 'Wax', 'Interior', 'Tint']);
    expect(serviceList({ services: ['Wash', { name: 'Wax', price: '$40' }] }, {})).toEqual([
      { name: 'Wash', price: '', summary: '' },
      { name: 'Wax', price: '$40', summary: '' },
    ]);
  });

  it('falls back to packages, then to the AI service items', () => {
    expect(serviceList({ services: [], packages: [{ name: 'Gold', price: '$200' }] }, {})).toEqual([{ name: 'Gold', price: '$200', summary: '' }]);
    const copy = { servicesSection: { items: [{ name: 'Exterior Wash', description: 'Hand wash' }, 'Interior Detail'] } };
    expect(serviceList({}, copy).map((s) => s.name)).toEqual(['Exterior Wash', 'Interior Detail']);
    expect(serviceList(null, null)).toEqual([]);
  });

  it('drops nameless items', () => {
    expect(serviceList({ services: [{ name: '', price: '$10' }, null, { price: '$5' }, { name: '  ' }, { name: 'Real' }] }, {}).map((s) => s.name)).toEqual(['Real']);
  });
});

describe('renameServiceRefs', () => {
  const copy = {
    headline: 'Hi',
    heroServices: ['Refresh Detail', 'premium detail', 'Signature Detail'],
    featuredService: { serviceName: 'Premium Detail', priceFrom: '$600' },
  };

  it('renames hero entries and the featured service name', () => {
    const next = renameServiceRefs(copy, 'Premium Detail', '  Premium Plus ', ['Refresh Detail', 'Signature Detail']);
    expect(next.heroServices).toEqual(['Refresh Detail', 'Premium Plus', 'Signature Detail']);
    expect(next.featuredService).toEqual({ serviceName: 'Premium Plus', priceFrom: '$600' });
    expect(next.headline).toBe('Hi');
    expect(renameServiceRefs({ heroServices: ['Wash'] }, 'Wash', 'Hand Wash')).toEqual({ heroServices: ['Hand Wash'] });
    expect(renameServiceRefs({ featuredService: { serviceName: 'Wash' } }, 'wash', 'Hand Wash')).toEqual({ featuredService: { serviceName: 'Hand Wash' } });
  });

  it('returns null when nothing changes', () => {
    expect(renameServiceRefs(copy, 'Gold Package', 'Platinum', [])).toBe(null);
    expect(renameServiceRefs(copy, 'Premium Detail', '', [])).toBe(null);
    expect(renameServiceRefs(copy, 'Premium Detail', '   ', [])).toBe(null);
    expect(renameServiceRefs(copy, '', 'Premium Detail', [])).toBe(null);
    // Only case or punctuation changed: the key is the same.
    expect(renameServiceRefs(copy, 'Premium Detail', 'Premium detail!', [])).toBe(null);
    // Another service still carries the old name.
    expect(renameServiceRefs(copy, 'Premium Detail', 'Premium Plus', ['Refresh Detail', 'PREMIUM DETAIL'])).toBe(null);
    expect(renameServiceRefs(null, 'a', 'b')).toBe(null);
    expect(renameServiceRefs({}, 'a', 'b')).toBe(null);
  });

  it('never mutates the copy', () => {
    const before = structuredClone(copy);
    renameServiceRefs(copy, 'Premium Detail', 'Premium Plus', []);
    expect(copy).toEqual(before);
  });
});

describe('followServiceRename', () => {
  // Feeds a Name field's keystrokes through the helper as the Services tab
  // does (copy and pending carried from one keystroke to the next).
  const type = (copy, start, values, others = ['Refresh Detail']) => {
    let c = copy;
    let pending = null;
    let prev = start;
    for (const v of values) {
      const r = followServiceRename(c, prev, v, others, pending);
      if (r.copy) c = r.copy;
      pending = r.pending;
      prev = v;
    }
    return c;
  };
  const copy = { heroServices: ['Refresh Detail', 'Signature Detail'], featuredService: { serviceName: 'Signature Detail', priceFrom: '$600' } };
  const backspaces = (s) => Array.from({ length: s.length }, (_, i) => s.slice(0, s.length - 1 - i));
  const typing = (s) => Array.from({ length: s.length }, (_, i) => s.slice(0, i + 1));

  it('follows select-all + Delete, then a new name', () => {
    const next = type(copy, 'Signature Detail', ['', ...typing('Express')]);
    expect(next.heroServices).toEqual(['Refresh Detail', 'Express']);
    expect(next.featuredService).toEqual({ serviceName: 'Express', priceFrom: '$600' });
  });

  it('follows backspacing to nothing, then a new name', () => {
    const next = type(copy, 'Signature Detail', [...backspaces('Signature Detail'), ...typing('Express')]);
    expect(next.heroServices).toEqual(['Refresh Detail', 'Express']);
    expect(next.featuredService.serviceName).toBe('Express');
  });

  it("waits while the field holds another service's name", () => {
    // "Refresh Detail Plus" backspaced through "Refresh Detail" (another
    // service's name) on the way to "Refresh".
    const c = { heroServices: ['Refresh Detail Plus'], featuredService: { serviceName: 'Refresh Detail Plus' } };
    const next = type(c, 'Refresh Detail Plus', [...backspaces('Refresh Detail Plus').slice(0, 5), 'Refresh Detai']);
    expect(next.heroServices).toEqual(['Refresh Detai']);
    expect(next.featuredService.serviceName).toBe('Refresh Detai');
  });

  it('returns the waiting name while the field is empty, and a new row changes nothing', () => {
    expect(followServiceRename(copy, 'Signature Detail', '', [], null)).toEqual({ copy: null, pending: 'Signature Detail' });
    expect(followServiceRename(copy, '', '', [], 'Signature Detail')).toEqual({ copy: null, pending: 'Signature Detail' });
    expect(followServiceRename(copy, '', 'New', [], null)).toEqual({ copy: null, pending: null });
    // A stale waiting name never overrides a real previous name.
    const r = followServiceRename(copy, 'Signature Detail', 'Signature', [], 'Old Name');
    expect(r.copy.heroServices).toEqual(['Refresh Detail', 'Signature']);
  });
});

describe('removeServiceRefs', () => {
  const copy = { headline: 'Hi', heroServices: ['Refresh Detail', 'Premium Detail'], featuredService: { serviceName: 'premium detail', priceFrom: '$600', bullets: ['x'] } };

  it('drops the hero pick and the featured settings of a removed service', () => {
    const next = removeServiceRefs(copy, 'Premium Detail', ['Refresh Detail']);
    expect(next.heroServices).toEqual(['Refresh Detail']);
    expect(next.featuredService).toBe(null);
    expect(next.headline).toBe('Hi');
    expect(removeServiceRefs({ heroServices: ['Wash'] }, 'Wash', [])).toEqual({ heroServices: null });
  });

  it('changes nothing for other names, a nameless row or a name another service keeps', () => {
    expect(removeServiceRefs(copy, 'Signature Detail', [])).toBe(null);
    expect(removeServiceRefs(copy, '', [])).toBe(null);
    expect(removeServiceRefs(copy, 'Premium Detail', ['PREMIUM DETAIL'])).toBe(null);
    const before = structuredClone(copy);
    removeServiceRefs(copy, 'Premium Detail', []);
    expect(copy).toEqual(before);
  });
});
