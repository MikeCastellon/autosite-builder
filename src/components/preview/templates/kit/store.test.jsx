import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { storeOf, storeDisclosure, isStoreSlug, STORE_ORIGIN, STORE_DEFAULTS } from './store.js';
import { StoreBand, storeCss } from './StoreBand.jsx';

describe('storeOf', () => {
  it('points only at the store origin, with the defaults filled in', () => {
    expect(storeOf({ slug: 'apex-detail' })).toEqual({
      slug: 'apex-detail',
      src: `${STORE_ORIGIN}/e/apex-detail`,
      eyebrow: STORE_DEFAULTS.eyebrow,
      title: STORE_DEFAULTS.title,
      intro: STORE_DEFAULTS.intro,
    });
  });

  it("uses the owner's heading and intro, tidied", () => {
    const s = storeOf({ slug: 'apex-detail', title: '  Our   shop ', intro: 'Pro products.' });
    expect(s.title).toBe('Our shop');
    expect(s.intro).toBe('Pro products.');
  });

  it('refuses anything that is not a Storefronts slug', () => {
    for (const slug of ['', 'ab', 'Apex', 'apex/../x', 'https://evil.example', '-apex', 'apex-', 'a'.repeat(51), 42]) {
      expect(storeOf({ slug }), String(slug)).toBeNull();
      expect(isStoreSlug(slug)).toBe(false);
    }
    expect(storeOf(null)).toBeNull();
    expect(storeOf('apex-detail')).toBeNull();
  });
});

describe('storeDisclosure', () => {
  it('names the business, or speaks for it', () => {
    expect(storeDisclosure('Apex Detail')).toBe('Apex Detail earns a commission on purchases made through this store.');
    expect(storeDisclosure('  ')).toBe('We earn a commission on purchases made through this store.');
  });
});

describe('StoreBand', () => {
  const render = (props) => renderToStaticMarkup(<StoreBand ns="xx-shop" order={7} businessName="Apex Detail" {...props} />);

  it('renders the section, the lazy iframe and the disclosure', () => {
    const html = render({ store: { slug: 'apex-detail' } });
    expect(html).toMatch(/^<section data-section="shop" id="shop" class="xx-shop-band" aria-labelledby="xx-shop-h" style="order:7">/);
    expect(html).toContain(`<iframe data-acg-store="" class="xx-shop-iframe" src="${STORE_ORIGIN}/e/apex-detail" title="Apex Detail store" width="100%" height="900" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"></iframe>`);
    expect(html).toContain('Apex Detail earns a commission on purchases made through this store.');
    expect(html).toContain('<h2 id="xx-shop-h" class="xx-shop-title">Shop car care products</h2>');
    // The store is the iframe: no script and nothing editor-only.
    expect(html).not.toContain('<script');
    expect(html).not.toContain('data-acg-editor-only');
  });

  it("takes the theme's heading node instead of its own", () => {
    const html = render({ store: { slug: 'apex-detail' }, heading: <h2 id="xx-shop-h">Mine</h2> });
    expect(html).toContain('<h2 id="xx-shop-h">Mine</h2>');
    expect(html).not.toContain('xx-shop-title');
  });

  it('renders nothing without a valid store', () => {
    expect(render({ store: null })).toBe('');
    expect(render({ store: { slug: 'https://evil.example' } })).toBe('');
  });

  it('keeps the iframe height to its attribute (the store reports its own)', () => {
    expect(storeCss('xx-shop')).not.toMatch(/xx-shop-iframe\{[^}]*[^-]height:/);
  });
});
