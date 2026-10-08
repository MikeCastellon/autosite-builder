import { describe, it, expect } from 'vitest';
import { emptyLevers, familyOf, fontStack, fullSectionOrder, hasLevers, leverPatch, sanitizeLevers } from './designLevers.js';
import { FONT_CATALOG } from './fontCatalog.js';

describe('fonts', () => {
  it('builds a stack for catalog families only, and reads it back', () => {
    expect(fontStack('Fraunces')).toBe("'Fraunces', Georgia, serif");
    expect(fontStack('Inter')).toBe("'Inter', sans-serif");
    expect(fontStack('Comic Sans MS')).toBe('');
    expect(familyOf("'Space Grotesk', sans-serif")).toBe('Space Grotesk');
    expect(familyOf("'Nope', serif")).toBe('');
    expect(fontStack('constructor')).toBe('');
    expect(sanitizeLevers({ fonts: { heading: 'constructor', body: '__proto__' } }, 'mobile_chrome').fonts).toEqual({});
    // The editor's own stack, so its dropdown recognizes the pick.
    expect(fontStack('DM Serif Display')).toBe("'DM Serif Display', serif");
    for (const family of Object.keys(FONT_CATALOG)) expect(familyOf(fontStack(family))).toBe(family);
  });
});

describe('sections', () => {
  it('completes a partial order: template order for the rest, added sections beside their neighbor', () => {
    expect(fullSectionOrder(['gallery', 'hero', 'nope', 'gallery'], 'carwash_bubble'))
      .toEqual(['gallery', 'beforeAfter', 'hero', 'services', 'process', 'about', 'testimonials', 'cta']);
    // A look written before Sporty gained 'brands', 'featured',
    // 'beforeAfter' and the reference-site bands keeps them at their default
    // spots, never below the contact section.
    expect(fullSectionOrder(['hero', 'statsBar', 'services', 'about', 'gallery', 'testimonials', 'cta', 'awards'], 'detailing_sporty'))
      .toEqual([
        'hero', 'statsBar', 'brands', 'services', 'featured', 'vehicleTypes', 'process', 'about', 'gallery', 'beforeAfter',
        'showcase', 'comparison', 'testimonials', 'faq', 'cta', 'awards',
      ]);
    expect(fullSectionOrder([], 'carwash_bubble')).toEqual([]);
    expect(fullSectionOrder(['hero'], 'detailing_coastal')).toEqual([]);
  });

  it('never hides the hero or the contact section, and drops ids the template lacks', () => {
    const l = sanitizeLevers({ sections: { hidden: ['hero', 'cta', 'gallery', 'shadeGuide'] } }, 'carwash_bubble');
    expect(l.sections.hidden).toEqual(['gallery']);
  });
});

describe('sanitizeLevers', () => {
  it('keeps only valid values', () => {
    const l = sanitizeLevers({
      palette: { bg: '#0A0A0A', accent: 'red', text: '#fff', muted: '#a3a3a3', extra: '#000000' },
      fonts: { heading: 'Fraunces', body: 'Papyrus' },
      heroLayout: 'diagonal',
      aboutLayout: 'stats',
      aboutStats: [{ value: '12', label: 'Years' }, { value: '', label: 'x' }, { value: '5', label: 'Stars' }, { value: '1', label: 'a' }, { value: '2', label: 'b' }],
      facts: { tagline: '  Shine\nbright  ', yearsInBusiness: 12, awards: 'Best of Austin, Best of Austin; Readers Pick', insured: 'yes', warranty: '' },
      googlePlace: { placeId: 'abc', placeName: 'Gloss', rating: 4.86, reviewCount: 212, url: 'javascript:alert(1)' },
      evil: 1,
    }, 'mobile_chrome');
    expect(l.palette).toEqual({ bg: '#0a0a0a', muted: '#a3a3a3' });
    expect(l.fonts).toEqual({ heading: 'Fraunces' });
    expect(l.heroLayout).toBe('');
    expect(l.aboutLayout).toBe('stats');
    expect(l.aboutStats).toEqual([{ value: '12', label: 'Years' }, { value: '5', label: 'Stars' }, { value: '1', label: 'a' }]);
    expect(l.facts).toEqual({ tagline: 'Shine bright', yearsInBusiness: '12', awards: ['Best of Austin', 'Readers Pick'] });
    expect(l.googlePlace).toEqual({ placeId: 'abc', placeName: 'Gloss', rating: 4.9, reviewCount: 212, url: '' });
    expect(l).not.toHaveProperty('evil');
  });

  it('keeps a blank rating blank and links the badge only to Google', () => {
    const p = (extra) => sanitizeLevers({ googlePlace: { placeId: 'x', ...extra } }, 'mobile_chrome').googlePlace;
    expect(p({ rating: null, reviewCount: '' })).toEqual(expect.objectContaining({ rating: null, reviewCount: null }));
    expect(p({ url: 'https://evil.example/maps' }).url).toBe('');
    expect(p({ url: 'https://google.evil.io/maps' }).url).toBe('');
    expect(p({ url: 'https://www.google.co.uk/maps/place/x' }).url).toBe('https://www.google.co.uk/maps/place/x');
    expect(p({ url: 'https://www.google.com/maps/place/?q=place_id:x' }).url).toBe('https://www.google.com/maps/place/?q=place_id:x');
    expect(p({ url: 'https://maps.app.goo.gl/abc123' }).url).toBe('https://maps.app.goo.gl/abc123');
  });

  it('turns junk into empty levers', () => {
    expect(sanitizeLevers(null, 'mobile_chrome')).toEqual(emptyLevers());
    expect(sanitizeLevers('x', 'mobile_chrome')).toEqual(emptyLevers());
  });
});

describe('leverPatch', () => {
  const levers = {
    palette: { bg: '#101010', accent: '#e11d48' },
    fonts: { heading: 'Anton', body: 'Manrope' },
    sections: { order: ['about', 'services'], hidden: ['statsBar'] },
    heroLayout: 'split',
    aboutLayout: 'stats',
    aboutStats: [{ value: '12', label: 'Years' }],
    facts: { tagline: 'Shine', insured: true },
  };

  it('maps every lever to the keys the templates read', () => {
    const p = leverPatch(levers, 'detailing_sporty');
    expect(p.copy).toEqual({
      sectionOrder: [
        'about', 'services', 'featured', 'vehicleTypes', 'process', 'hero', 'statsBar', 'brands', 'gallery', 'beforeAfter',
        'showcase', 'comparison', 'testimonials', 'faq', 'cta', 'awards',
      ],
      hiddenSections: ['statsBar'],
      heroLayout: 'split',
      aboutLayout: 'stats',
      aboutStats: [{ value: '12', label: 'Years' }],
    });
    expect(p.info).toEqual({ tagline: 'Shine', insured: true });
    expect(p.colors).toEqual({ bg: '#101010', accent: '#e11d48' });
    expect(p.fonts).toEqual({ font: "'Anton', sans-serif", bodyFont: "'Manrope', sans-serif" });
  });

  it('skips what a template does not read', () => {
    expect(leverPatch(levers, 'mobile_redline').copy).not.toHaveProperty('heroLayout');
    const legacy = leverPatch(levers, 'detailing_coastal');
    expect(legacy.copy).toEqual({ aboutStats: [{ value: '12', label: 'Years' }] });
    expect(legacy.colors).toEqual({ bg: '#101010', accent: '#e11d48' });
  });

  it('an empty lever set changes nothing', () => {
    expect(hasLevers(emptyLevers(), 'mobile_chrome')).toBe(false);
    expect(hasLevers({ heroLayout: 'split' }, 'mobile_chrome')).toBe(true);
  });
});
