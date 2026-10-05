// Services in the hero: the panel's helpers follow MobileRedline's rules
// (first 3 priced services until the owner picks, at most 4, names matched
// by nameKey), and the panel renders on the server (node, no DOM).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { heroCardMode, defaultHeroPicks, heroSelection, toggleHeroService, moveHeroService, removeStaleName, unpricedPicks, MAX_HERO_SERVICES } from './heroServices.js';
import HeroServicesPanel from './HeroServicesPanel.jsx';

const SERVICES = [
  { name: 'Refresh Detail', price: '$120', summary: 'Essential refresh' },
  { name: 'Signature Detail', price: '$180', summary: '' },
  { name: 'Call Us', price: 'Call for quote', summary: '' },
  { name: 'Premium Detail', price: '$260', summary: 'Deep clean' },
  { name: 'Ceramic Coating', price: '$600', summary: '' },
];
const BIZ = { services: SERVICES };
const noop = () => {};
const html = (props) => renderToStaticMarkup(<HeroServicesPanel copy={{}} setCopy={noop} businessInfo={BIZ} {...props} />);

describe('heroCardMode', () => {
  it('falls back to the price card', () => {
    expect(heroCardMode(undefined)).toBe('quote');
    expect(heroCardMode({})).toBe('quote');
    expect(heroCardMode({ heroCard: 'cards' })).toBe('quote');
    expect(heroCardMode({ heroCard: 'LIST' })).toBe('quote');
    expect(heroCardMode({ heroCard: 'list' })).toBe('list');
    expect(heroCardMode({ heroCard: 'off' })).toBe('off');
  });
});

describe('defaultHeroPicks', () => {
  it('takes the first 3 named services with a number in the price', () => {
    expect(defaultHeroPicks(SERVICES)).toEqual(['Refresh Detail', 'Signature Detail', 'Premium Detail']);
    expect(defaultHeroPicks([{ name: '', price: '$5' }, { name: 'A', price: '' }, { name: 'B', price: '$9' }])).toEqual(['B']);
    expect(defaultHeroPicks(null)).toEqual([]);
  });
});

describe('heroSelection', () => {
  it('is automatic while nothing is saved', () => {
    for (const heroServices of [undefined, null, [], 'Refresh Detail']) {
      expect(heroSelection({ heroServices }, SERVICES)).toEqual({ names: ['Refresh Detail', 'Signature Detail', 'Premium Detail'], automatic: true, stale: [] });
    }
  });

  it('matches saved names despite case and punctuation, in the saved order, deduped', () => {
    const sel = heroSelection({ heroServices: ['premium-detail', 'CALL US', 'Premium Detail '] }, SERVICES);
    expect(sel).toEqual({ names: ['Premium Detail', 'Call Us'], automatic: false, stale: [] });
  });

  it('lists stale names and stays automatic when none match', () => {
    expect(heroSelection({ heroServices: ['Gold Package', 'Refresh Detail'] }, SERVICES)).toEqual({ names: ['Refresh Detail'], automatic: false, stale: ['Gold Package'] });
    expect(heroSelection({ heroServices: ['Gold Package', 'gold package'] }, SERVICES)).toEqual({ names: defaultHeroPicks(SERVICES), automatic: true, stale: ['Gold Package'] });
  });

  it('keeps at most 4', () => {
    const sel = heroSelection({ heroServices: SERVICES.map((s) => s.name) }, SERVICES);
    expect(sel.names).toHaveLength(MAX_HERO_SERVICES);
    expect(sel.names).toEqual(['Refresh Detail', 'Signature Detail', 'Call Us', 'Premium Detail']);
  });
});

describe('toggleHeroService', () => {
  it('turns the automatic pick into the owner list when a 4th is added', () => {
    expect(toggleHeroService({}, SERVICES, 'ceramic coating', true)).toEqual(['Refresh Detail', 'Signature Detail', 'Premium Detail', 'Ceramic Coating']);
  });

  it('removes one from the automatic pick', () => {
    expect(toggleHeroService({}, SERVICES, 'Signature Detail', false)).toEqual(['Refresh Detail', 'Premium Detail']);
  });

  it('does not add a 5th', () => {
    const copy = { heroServices: ['Refresh Detail', 'Signature Detail', 'Premium Detail', 'Ceramic Coating'] };
    expect(toggleHeroService(copy, SERVICES, 'Call Us', true)).toEqual(copy.heroServices);
  });

  it('returns null when emptied, and drops stale names', () => {
    expect(toggleHeroService({ heroServices: ['Call Us'] }, SERVICES, 'call us', false)).toBe(null);
    expect(toggleHeroService({ heroServices: ['Gone', 'Call Us'] }, SERVICES, 'Refresh Detail', true)).toEqual(['Call Us', 'Refresh Detail']);
  });

  it('never mutates the copy', () => {
    const copy = { heroServices: ['Call Us'] };
    toggleHeroService(copy, SERVICES, 'Refresh Detail', true);
    expect(copy).toEqual({ heroServices: ['Call Us'] });
  });
});

describe('moveHeroService / removeStaleName / unpricedPicks', () => {
  it('moves a pick and makes the list explicit', () => {
    expect(moveHeroService({}, SERVICES, 2, 0)).toEqual(['Premium Detail', 'Refresh Detail', 'Signature Detail']);
    expect(moveHeroService({ heroServices: ['Call Us', 'Premium Detail'] }, SERVICES, 0, 1)).toEqual(['Premium Detail', 'Call Us']);
    expect(moveHeroService({ heroServices: ['Call Us', 'Premium Detail'] }, SERVICES, 0, 5)).toEqual(['Call Us', 'Premium Detail']);
    expect(moveHeroService({}, [], 0, 1)).toBe(null);
  });

  it('removes one stale name', () => {
    expect(removeStaleName({ heroServices: ['Gone', 'Call Us', 'Old'] }, 'gone')).toEqual(['Call Us', 'Old']);
    expect(removeStaleName({ heroServices: ['Gone'] }, 'Gone')).toBe(null);
  });

  it('finds picks without a price', () => {
    const sel = heroSelection({ heroServices: ['Call Us', 'Refresh Detail', 'Gone'] }, SERVICES);
    expect(unpricedPicks(sel, SERVICES)).toEqual(['Call Us']);
    expect(unpricedPicks(['Refresh Detail'], SERVICES)).toEqual([]);
  });
});

describe('HeroServicesPanel', () => {
  it('lists every service with a checkbox, price card selected by default', () => {
    const out = html();
    expect(out).toContain('Services in the hero');
    expect(out).toMatch(/aria-checked="true"[^>]*>Price card</);
    for (const s of SERVICES) expect(out).toContain(`aria-label="Show ${s.name} in the hero"`);
    expect(out).toContain('Showing your first 3 services with a price.');
    expect(out).toContain('Essential refresh');
    expect(out).toContain('No summary: add one in Services &gt; Package details');
    expect(out).toContain('Call for quote');
    expect(html({ businessInfo: { services: [...SERVICES, { name: 'Wax', price: '' }] } })).toContain('no price');
    // The automatic picks come first, ticked.
    expect(out.indexOf('Show Premium Detail in the hero')).toBeLessThan(out.indexOf('Show Call Us in the hero'));
    expect((out.match(/checked=""/g) || []).length).toBe(3);
    expect(out).not.toContain('Back to automatic');
  });

  it('renders no rows when the card is off', () => {
    const out = html({ copy: { heroCard: 'off', heroServices: ['Call Us'] } });
    expect(out).toContain('your headline uses the full width');
    expect(out).not.toContain('type="checkbox"');
  });

  it('asks for services first when there are none', () => {
    expect(html({ businessInfo: {} })).toContain('Add services in the Services tab first.');
  });

  it('warns about an unpriced pick in price-card mode only', () => {
    const warn = 'No price, so the price card skips it.';
    expect(html({ copy: { heroServices: ['Call Us', 'Refresh Detail'] } })).toContain(warn);
    expect(html({ copy: { heroCard: 'list', heroServices: ['Call Us', 'Refresh Detail'] } })).not.toContain(warn);
    expect(html({ copy: { heroServices: ['Refresh Detail'] } })).not.toContain(warn);
  });

  it('lists stale names with Remove and offers Back to automatic when explicit', () => {
    const out = html({ copy: { heroServices: ['Gold Package', 'Call Us'] } });
    expect(out).toContain('No longer in your services: Gold Package');
    expect(out).toContain('Back to automatic');
    expect(out).toContain('Shown in this order, up to 4.');
  });

  it('disables the unticked checkboxes once 4 are picked', () => {
    const out = html({ copy: { heroServices: ['Refresh Detail', 'Signature Detail', 'Premium Detail', 'Ceramic Coating'] } });
    expect(out).toMatch(/<input type="checkbox"[^>]*disabled=""[^>]*aria-label="Show Call Us in the hero"/);
    expect((out.match(/disabled=""[^>]*aria-label="Show [^"]+ in the hero"/g) || []).length).toBe(1);
  });
});

describe('services without prices', () => {
  const UNPRICED = [{ name: 'Wash', price: '' }, { name: 'Wax', price: 'Call' }, { name: 'Interior', price: '' }, { name: 'Engine', price: '' }];

  it("the price list falls back to the first 3 named services (the template's rule)", () => {
    expect(defaultHeroPicks(UNPRICED)).toEqual([]);
    expect(defaultHeroPicks(UNPRICED, 'list')).toEqual(['Wash', 'Wax', 'Interior']);
    // A priced service still wins in list mode.
    expect(defaultHeroPicks([...UNPRICED, { name: 'Gold', price: '$90' }], 'list')).toEqual(['Gold']);
    expect(heroSelection({ heroCard: 'list' }, UNPRICED)).toEqual({ names: ['Wash', 'Wax', 'Interior'], automatic: true, stale: [] });
  });

  it('says why no price card shows, and what the list shows', () => {
    const quote = html({ businessInfo: { services: UNPRICED } });
    expect(quote).toContain('None of your services has a price yet, so no price card shows. Add prices in Services, or pick Price list.');
    expect(quote).not.toContain('Showing your first 3 services');
    const list = html({ businessInfo: { services: UNPRICED }, copy: { heroCard: 'list' } });
    expect(list).toContain('Showing your first 3 services. Tick the ones you want (up to 4).');
    expect((list.match(/checked=""/g) || []).length).toBe(3);
  });

  it('puts each price on its own line under the name', () => {
    const out = html();
    expect(out).toMatch(/<span class="block text-\[13px\][^"]*">Call Us<\/span><span class="block text-\[12px\][^"]*">Call for quote<\/span>/);
  });
});

// Themes whose hero had no card before (editorCapabilities HERO_CARD_DEFAULTS
// 'off'): unset copy.heroCard reads as None there.
describe("a template whose default is no card ('off')", () => {
  it('reads an unset or unknown mode as the fallback', () => {
    expect(heroCardMode({}, 'off')).toBe('off');
    expect(heroCardMode({ heroCard: 'cards' }, 'off')).toBe('off');
    expect(heroCardMode({ heroCard: 'quote' }, 'off')).toBe('quote');
    expect(heroCardMode({ heroCard: 'list' }, 'off')).toBe('list');
  });

  it('starts on None, with the template\'s own help and no rows', () => {
    const out = html({ defaultMode: 'off', offHelp: 'No services in the hero: it keeps its usual look.' });
    expect(out).toContain('No services in the hero: it keeps its usual look.');
    expect(out).not.toContain('your headline uses the full width');
    expect(out).not.toContain('aria-label="Show Refresh Detail in the hero"');
  });

  it('shows the picker once the owner picks a mode, with the same automatic picks', () => {
    const out = html({ copy: { heroCard: 'quote' }, defaultMode: 'off' });
    expect(out).toContain('aria-label="Show Refresh Detail in the hero"');
    expect(heroSelection({ heroCard: 'list' }, SERVICES, 'off')).toEqual(heroSelection({ heroCard: 'list' }, SERVICES));
    expect(toggleHeroService({ heroCard: 'quote' }, SERVICES, 'Premium Detail', false, 'off')).toEqual(['Refresh Detail', 'Signature Detail']);
    expect(moveHeroService({ heroCard: 'quote' }, SERVICES, 0, 1, 'off')).toEqual(['Signature Detail', 'Refresh Detail', 'Premium Detail']);
  });

  it('keeps the shared None help without offHelp', () => {
    expect(html({ copy: { heroCard: 'off' } })).toContain('your headline uses the full width');
  });
});

describe('HeroServicesPanel in None mode', () => {
  it('offers no Back to automatic for the hidden list', () => {
    const picked = { heroServices: [SERVICES[0].name] };
    expect(html({ copy: picked })).toContain('Back to automatic');
    expect(html({ copy: { ...picked, heroCard: 'off' } })).not.toContain('Back to automatic');
    expect(html({ copy: picked, defaultMode: 'off' })).not.toContain('Back to automatic');
  });
});
