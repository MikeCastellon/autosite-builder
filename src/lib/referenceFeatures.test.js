// "Features on this site" (referenceFeatures.js): a label for every feature
// the capture can find, and what our product does about each one for the
// setup's template. The claims that rest on a template's code are checked
// against the sources here, so a template that changes fails this file
// until the table follows; anything we don't do says "not in our templates
// yet".
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURE_IDS, SECTION_KINDS, sanitizeOutline } from './referenceOutline.js';
import { TEMPLATES } from '../data/templates.js';
import { TEMPLATE_SECTIONS, sectionIdsFor } from '../data/templateSections.js';
import { templateReads } from '../components/preview/editorCapabilities.js';
import {
  FEATURE_LABELS, SECTION_KIND_LABELS, SUPPORT_STATUSES, catalogFamilyOf, featureRows, featureSupport, outlineFontsText, outlineSectionsText,
} from './referenceFeatures.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../data');
const registry = readFileSync(resolve(dataDir, 'templates.js'), 'utf8');
const FILES = {};
for (const m of registry.matchAll(/(\w+):\s*\(\)\s*=>\s*import\('([^']+)'\)/g)) FILES[m[1]] = resolve(dataDir, m[2]);
const source = (id) => readFileSync(FILES[id], 'utf8');
const read = (rel) => readFileSync(resolve(here, rel), 'utf8');

// Theme-ready templates (the ones the setup offers, and hidden Redline).
const THEME_READY = Object.keys(TEMPLATE_SECTIONS);
const VISIBLE = THEME_READY.filter((id) => !TEMPLATES[id].hidden);
const HIDDEN_LABELS = Object.values(TEMPLATES).filter((t) => t.hidden).map((t) => t.label);

describe('feature labels', () => {
  it('name every feature the capture can find, in plain words', () => {
    expect(Object.keys(FEATURE_LABELS).sort()).toEqual([...FEATURE_IDS].sort());
    for (const id of FEATURE_IDS) expect(FEATURE_LABELS[id]).toMatch(/^[A-Z][^<>]{2,60}$/);
    expect(FEATURE_LABELS.faq).toBe('FAQ (questions that open and close)');
    expect(FEATURE_LABELS['booking-widget']).toBe('Online booking widget');
  });

  it('name every section kind', () => {
    expect(Object.keys(SECTION_KIND_LABELS).sort()).toEqual([...SECTION_KINDS].sort());
  });
});

describe('featureSupport', () => {
  it('answers every feature for every template, the hidden and unknown ones too', () => {
    for (const templateId of [...THEME_READY, 'mobile_bold', 'replica_11111111', '', undefined, 'constructor']) {
      for (const id of FEATURE_IDS) {
        const s = featureSupport(id, templateId);
        expect(SUPPORT_STATUSES).toContain(s.status);
        expect(s.text.length).toBeGreaterThan(5);
        if (s.status === 'missing') expect(s.text).toBe('not in our templates yet');
        if (s.status === 'other-template') {
          // Up to two visible template names, never a hidden one.
          expect(s.text).toMatch(/^in /);
          for (const hidden of HIDDEN_LABELS) expect(s.text).not.toContain(hidden);
          const named = VISIBLE.map((t) => TEMPLATES[t].label).filter((l) => s.text.includes(l));
          expect(named.length).toBeGreaterThan(0);
          expect(named.length).toBeLessThanOrEqual(2);
        }
      }
    }
    expect(featureSupport('no-such-feature', 'detailing_sporty')).toEqual({ status: 'missing', text: 'not in our templates yet' });
  });

  it('says what Bold & Sporty, Bright & Bubbly, Forge Studio and Redline do', () => {
    const table = (templateId) => Object.fromEntries(FEATURE_IDS.map((id) => [id, featureSupport(id, templateId).status]));
    const missing = ['hero-video', 'hero-slider', 'before-after', 'faq', 'tabs', 'video', 'instagram-feed', 'chat', 'newsletter'];
    const covered = ['sticky-header', 'reviews-widget', 'booking-widget', 'quote-form', 'contact-form', 'service-area'];
    const base = { ...Object.fromEntries(missing.map((id) => [id, 'missing'])), ...Object.fromEntries(covered.map((id) => [id, 'covered'])) };
    expect(table('detailing_sporty')).toEqual({ ...base, carousel: 'have', gallery: 'have', reviews: 'have', pricing: 'have', map: 'missing', stats: 'have' });
    expect(table('mobile_sudsy')).toEqual({ ...base, carousel: 'other-template', gallery: 'have', reviews: 'have', pricing: 'have', map: 'missing', stats: 'other-template' });
    expect(table('wheel_apex')).toEqual({ ...base, carousel: 'have', gallery: 'have', reviews: 'have', pricing: 'have', map: 'missing', stats: 'other-template' });
    // Redline, though hidden, is the setup's template on some projects.
    expect(table('mobile_redline')).toEqual({ ...base, carousel: 'have', gallery: 'have', reviews: 'have', pricing: 'have', map: 'have', stats: 'other-template' });
  });

  it('words each answer for the template', () => {
    expect(featureSupport('stats', 'detailing_sporty')).toEqual({ status: 'have', text: 'its stats bar, with only numbers they give (none made up)' });
    expect(featureSupport('stats', 'mobile_sudsy')).toEqual({
      status: 'other-template', text: 'in Bold & Sporty, Industrial and 3 more, with only numbers they give (none made up)',
    });
    expect(featureSupport('carousel', 'mobile_sudsy').text).toBe('in Bold & Sporty, Industrial and 7 more');
    expect(featureSupport('carousel', 'detailing_sporty').text).toBe('its gallery becomes a sideways swipe row once it has enough photos');
    expect(featureSupport('carousel', 'mobile_redline').text).toBe('its reviews slide sideways');
    expect(featureSupport('pricing', 'carwash_bubble').text).toBe('its Packages section shows the prices they enter');
    expect(featureSupport('pricing', 'wheel_apex').text).toBe('its Products section shows the prices they enter');
    expect(featureSupport('map', 'mobile_redline').text).toBe('its Service Area & Hours section shows a Google map');
    expect(featureSupport('gallery', 'mechanic_ironclad').text).toBe('its Gallery section');
    // The Google rating badge is where the template reads it.
    expect(featureSupport('reviews-widget', 'mobile_chrome').text).toBe('our Reviews section and the Google rating badge (their real rating)');
    expect(featureSupport('reviews-widget', 'tint_elite').text).toBe('our Reviews section; the Google rating badge is in Bold & Sporty, Chrome Elite and 1 more');
    expect(featureSupport('quote-form', 'mobile_sudsy').text).toBe('our contact form, the hero price card, and the booking widget once booking is on');
    expect(featureSupport('quote-form', 'mechanic_garage').text).toBe('our contact form, and the booking widget once booking is on');
    expect(featureSupport('booking-widget', 'tint_obsidian').text).toBe('our booking widget, once booking is on (the Book buttons open it)');
  });

  it('names one or two other templates the same way', () => {
    // Stats bars: Sporty, Industrial, Raw Garage, Chrome Elite, Elite Gold.
    const others = (templateId) => featureSupport('stats', templateId).text.replace(/, with only.*$/, '');
    expect(others('wheel_apex')).toBe('in Bold & Sporty, Industrial and 3 more');
    expect(featureSupport('stats', 'tint_obsidian').status).toBe('other-template');
  });
});

describe('the claims match the templates\' code', () => {
  it('every theme-ready template keeps its nav on top (sticky-header)', () => {
    for (const id of THEME_READY) expect(source(id)).toMatch(/-nav\{position:sticky;top:0/);
  });

  it('a "carousel" is a gallery swipe row or Redline\'s sliding reviews, and only there', () => {
    for (const id of THEME_READY) {
      const src = source(id);
      const swipes = src.includes('aria-label="Photo gallery, scroll sideways for more"') && /-track\{[^}]*scroll-snap-type:x mandatory/.test(src);
      const slidingReviews = /\.rl-track\{[^}]*scroll-snap-type:x mandatory/.test(src) && src.includes('rl-rev');
      expect({ id, have: featureSupport('carousel', id).status === 'have' }).toEqual({ id, have: swipes || slidingReviews });
    }
    // Bright & Bubbly wraps its photos.
    expect(source('mobile_sudsy')).toContain('aria-label="Photo gallery"');
  });

  it('only Redline embeds a map, and nothing plays video or holds an FAQ, tabs, a chat or a sign-up', () => {
    for (const id of THEME_READY) {
      const src = source(id);
      expect({ id, map: /<iframe[\s\S]{0,200}output=embed/.test(src) }).toEqual({ id, map: featureSupport('map', id).status === 'have' });
      expect(src).not.toMatch(/<video|youtube\.com\/embed|player\.vimeo|\bfaq\b|role="tab|newsletter|subscribe/i);
      if (id !== 'mobile_redline') expect(src).not.toMatch(/<iframe/);
    }
    expect(sectionIdsFor('mobile_redline')).toContain('locations');
  });

  it('every theme-ready template shows the service area, and has a gallery and reviews', () => {
    for (const id of THEME_READY) {
      expect(source(id)).toMatch(/\bbiz\.serviceArea\b/);
      expect(sectionIdsFor(id)).toEqual(expect.arrayContaining(['gallery', 'testimonials']));
      expect(sectionIdsFor(id).some((s) => s === 'services' || s === 'products')).toBe(true);
    }
  });

  it('every published site gets the booking widget and the contact form in its contact section', () => {
    const exportHtml = read('./exportHtml.js');
    expect(exportHtml).toMatch(/'\/scheduler\.js'/);
    expect(exportHtml).toMatch(/'\/contact-form\.js'/);
    expect(exportHtml).toMatch(/siteId \? `<script src="\$\{CONTACT_WIDGET_URL\}"/);
    // It goes into #contact, which is every theme-ready template's contact
    // section (one the setup never hides).
    expect(read('../../public/contact-form.js')).toContain('document.querySelector(\'[data-section="contact"]\') || document.querySelector(\'#contact\')');
    for (const id of THEME_READY) expect(source(id)).toMatch(/data-section="cta" id="contact"/);
  });

  it('the Google rating badge and the hero price card are where the editor offers them', () => {
    for (const id of ['detailing_sporty', 'mobile_chrome', 'mobile_sudsy', 'mobile_redline']) {
      expect(templateReads(id, 'googleBadge')).toBe(true);
      expect(templateReads(id, 'heroServices')).toBe(true);
    }
    expect(templateReads('tint_elite', 'googleBadge')).toBe(false);
  });
});

describe('featureRows', () => {
  it('labels an outline\'s features with their support, in its order, with the provider', () => {
    const outline = sanitizeOutline({ v: 1, features: [{ id: 'faq' }, { id: 'booking-widget', provider: 'Square' }, 'sticky-header', { id: 'made-up' }] });
    expect(featureRows(outline.features, 'mobile_chrome')).toEqual([
      { id: 'sticky-header', provider: '', label: FEATURE_LABELS['sticky-header'], status: 'covered', text: featureSupport('sticky-header', 'mobile_chrome').text },
      { id: 'faq', provider: '', label: 'FAQ (questions that open and close)', status: 'missing', text: 'not in our templates yet' },
      { id: 'booking-widget', provider: 'Square', label: 'Online booking widget', status: 'covered', text: featureSupport('booking-widget', 'mobile_chrome').text },
    ]);
    expect(featureRows(null, 'mobile_chrome')).toEqual([]);
  });
});

describe('the outline as the Design step says it', () => {
  const outline = sanitizeOutline({
    v: 1,
    fonts: { heading: { family: 'Oswald', weight: 700, size: 48 }, body: { family: 'Inter', weight: 400, size: 16 }, button: { family: 'Gotham', weight: 600, size: 14 } },
    sections: [
      { kind: 'header', layout: 'full' },
      { kind: 'hero', layout: 'full', heading: 'Showroom shine' },
      { kind: 'services', layout: 'grid-3', cards: 3 },
      { kind: 'reviews', layout: 'carousel', cards: 6 },
      { kind: 'about', layout: 'split' },
      { kind: 'faq', layout: 'list', cards: 1 },
      { kind: 'booking' },
      { kind: 'footer' },
    ],
  });

  it('fonts: family and weight, marked when our catalog doesn\'t have one', () => {
    expect(outlineFontsText(outline)).toBe('Oswald 700 / Inter 400 (both in our catalog)');
    const gotham = sanitizeOutline({ fonts: { heading: { family: 'Gotham', weight: 800 }, body: { family: 'inter', weight: 400 } } });
    expect(outlineFontsText(gotham)).toBe('Gotham 800 (not in our catalog) / Inter 400 (in our catalog)');
    expect(outlineFontsText(sanitizeOutline({ fonts: { heading: { family: 'Bebas Neue', weight: 400 } } }))).toBe('Bebas Neue 400 (in our catalog)');
    expect(outlineFontsText(sanitizeOutline({}))).toBe('');
    expect(outlineFontsText(null)).toBe('');
  });

  it('sections: top to bottom, without the header, with cards or a carousel', () => {
    expect(outlineSectionsText(outline)).toBe('Hero → Services (3 cards) → Reviews (carousel) → About (split) → FAQ (1 card) → Booking → Footer');
    expect(outlineSectionsText(sanitizeOutline({}))).toBe('');
    expect(outlineSectionsText({ sections: [{ kind: 'constructor' }, null, { kind: 'cta' }] })).toBe('Call to action');
  });

  it('knows our catalog\'s families, case aside', () => {
    expect(catalogFamilyOf('Oswald')).toBe('Oswald');
    expect(catalogFamilyOf('playfair display')).toBe('Playfair Display');
    expect(catalogFamilyOf('Gotham')).toBe('');
    expect(catalogFamilyOf('constructor')).toBe('');
    expect(catalogFamilyOf(42)).toBe('');
  });
});
