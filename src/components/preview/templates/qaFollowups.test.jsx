// QA follow-ups for five templates (carwash_bubble, mechanic_ironclad,
// wheel_apex, tint_obsidian, tint_elite), beyond the shared contract in
// templates.render.test.jsx: which link each CTA button takes, which buttons
// open the booking widget, and the class hooks the nav / price CSS keys on
// for long names and worded prices (the layout itself was checked in
// headless Chrome at 390 / 601 / 1024 / 1280 / 1440).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CarwashBubble from './carwash/CarwashBubble.jsx';
import MechanicIronclad from './mechanic/MechanicIronclad.jsx';
import WheelApex from './wheel/WheelApex.jsx';
import TintObsidian from './tint/TintObsidian.jsx';
import TintElite from './tint/TintElite.jsx';
import { buildTemplateMeta } from '../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../lib/normalizeBusinessInfo.js';
import { full } from './__fixtures__/businesses.js';

const IG = 'https://instagram.com/someshop';
const LONG_NAME = 'Precision Auto Detailing & Ceramic Coating Studio of Greater Tucson';

function render(Component, id, { biz = {}, copy = {}, images = {} } = {}) {
  return renderToStaticMarkup(createElement(Component, {
    businessInfo: normalizeBusinessInfo({ ...full.businessInfo, ...biz }),
    generatedCopy: { ...full.generatedCopy, ...copy },
    templateMeta: buildTemplateMeta(id, {}, {}),
    images,
  }));
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
// Every <a> as { cls, href, text, books }.
const links = (html) => [...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, inner]) => ({
  cls: (attrs.match(/class="([^"]*)"/) || [])[1] || '',
  href: decode((attrs.match(/href="([^"]*)"/) || [])[1] || ''),
  text: decode(inner.replace(/<[^>]+>/g, '').replace(/<!-- -->/g, '')).trim(),
  books: /data-scheduler-trigger=""/.test(attrs),
}));
const navOf = (html) => (html.match(/<nav class="([^"]*)" aria-label="Main"/) || [])[1] || '';

describe('carwash_bubble', () => {
  const ID = 'carwash_bubble';
  const phoneButton = (html) => links(html).find((l) => l.cls === 'cb-btn cb-btn-outline' && /^Call /.test(l.text));

  it('keeps the default "Call ..." contact button on tel: when only Hero > Button 2 URL is set', () => {
    const btn = phoneButton(render(CarwashBubble, ID, { copy: { ctaSecondaryUrl: IG } }));
    expect(btn).toBeTruthy();
    expect(btn.href).toMatch(/^tel:/);
  });

  it('lets the shared URL win once the contact button has its own text, or when it dials / texts', () => {
    const own = links(render(CarwashBubble, ID, { copy: { ctaSecondaryUrl: IG, ctaSecondaryText: 'Follow us' } }))
      .find((l) => l.text === 'Follow us');
    expect(own.href).toBe(IG);
    const sms = phoneButton(render(CarwashBubble, ID, { copy: { ctaSecondaryUrl: 'sms:5558001234' } }));
    expect(sms.href).toBe('sms:5558001234');
  });

  it('sets a worded price (over 10 characters) a size down', () => {
    const html = render(CarwashBubble, ID, {
      biz: { services: [
        { name: 'Basic', price: '$1,299.99' },
        { name: 'Brakes', price: 'Starting at $149.99/hr' },
      ] },
    });
    expect(html).toContain('<p class="cb-amt">$1,299.99</p>');
    expect(html).toContain('<p class="cb-amt cb-amt-long">Starting at $149.99/hr</p>');
  });

  it('tiers the nav by name length (no logo) and shows the menu once links step aside', () => {
    expect(navOf(render(CarwashBubble, ID, { biz: { businessName: 'Sunrise Wash' } }))).toBe('cb-nav cb-nav-x');
    expect(navOf(render(CarwashBubble, ID, { biz: { businessName: 'Rivera Brothers Auto Care' } }))).toBe('cb-nav cb-nav-x cb-nav-long');
    expect(navOf(render(CarwashBubble, ID, { biz: { businessName: LONG_NAME } }))).toBe('cb-nav cb-nav-x cb-nav-long cb-nav-xl');
    expect(navOf(render(CarwashBubble, ID, { biz: { businessName: LONG_NAME }, images: { logo: 'https://example.com/logo.png' } }))).toBe('cb-nav cb-nav-x');
  });

  it('hands the links to the menu just above phone width whenever the menu shows', () => {
    // 19-22 character names in a wide face were cut at 601-650 beside the
    // menu button and three links.
    expect(render(CarwashBubble, ID)).toContain('@container (max-width:680px){.cb-nav-x .cb-links{display:none}}');
  });
});

describe('mechanic_ironclad', () => {
  const ID = 'mechanic_ironclad';

  it('marks which nav links can step aside, so the menu shows whenever one does', () => {
    const images = { gallery0: 'https://example.com/g0.jpg' };
    expect(navOf(render(MechanicIronclad, ID, { images }))).toBe('ic-nav ic-has-y ic-has-x ic-nav-name');
    const bare = render(MechanicIronclad, ID, { copy: { hiddenSections: ['about', 'gallery', 'testimonials'] } });
    expect(navOf(bare)).toBe('ic-nav ic-nav-name');
  });

  it('treats a long name as dense at every width', () => {
    const html = render(MechanicIronclad, ID, { biz: { businessName: LONG_NAME } });
    expect(html).toMatch(/class="ic-root[^"]* ic-long[^"]* ic-dense"/);
    expect(navOf(html)).toBe('ic-nav ic-has-y ic-nav-name ic-nav-long');
    expect(html).toContain('.ic-nav-long .ic-link-x,.ic-nav-long .ic-link-y{display:none}');
    expect(html).toContain('.ic-nav-long.ic-has-x .acg-menu,.ic-nav-long.ic-has-y .acg-menu{display:block}');
  });

  it('keeps every link for a logo, whatever the name\'s length', () => {
    // The logo replaces the name, so a long one needs no extra nav room:
    // only the root keeps ic-long (and ic-dense), as before.
    const html = render(MechanicIronclad, ID, { biz: { businessName: LONG_NAME }, images: { logo: 'https://example.com/logo.png' } });
    expect(html).toMatch(/class="ic-root[^"]* ic-long[^"]* ic-dense"/);
    expect(navOf(html)).toBe('ic-nav ic-has-y');
  });

  it('lets the menu take the phone\'s place beside a shop name in a dense nav', () => {
    const html = render(MechanicIronclad, ID);
    expect(html).toContain('@container (max-width:1400px){.ic-dense .ic-nav-name.ic-has-x .ic-nav-phone{display:none}}');
    expect(html).toContain('@container (max-width:1240px){.ic-dense .ic-nav-name.ic-has-y .ic-nav-phone{display:none}}');
  });
});

describe('wheel_apex', () => {
  const ID = 'wheel_apex';
  // The nav button, then the first .wa-btn in the page (the hero's; the
  // Contact one comes later and follows its own Button URL).
  const heroAndNav = (html) => {
    const all = links(html);
    return [all.find((l) => l.cls === 'wa-btn wa-btn-sm wa-nav-cta'), all.find((l) => l.cls === 'wa-btn')];
  };

  it('opens booking from hero Button 1 and the nav button when they have no URL of their own', () => {
    const btns = heroAndNav(render(WheelApex, ID));
    for (const b of btns) {
      expect(b.text).toBe(full.generatedCopy.ctaPrimary);
      expect(b.books).toBe(true);
      expect(b.href).toMatch(/^tel:/);
    }
  });

  it('follows the owner Button 1 URL without the booking trigger', () => {
    const btns = heroAndNav(render(WheelApex, ID, { copy: { ctaPrimaryUrl: 'https://example.com/book' } }));
    for (const b of btns) {
      expect(b.text).toBe(full.generatedCopy.ctaPrimary);
      expect(b.books).toBe(false);
      expect(b.href).toBe('https://example.com/book');
    }
  });
});

describe('tint_obsidian', () => {
  const ID = 'tint_obsidian';

  it('gives the nav name 460px and hands a long name\'s links to the menu at tablet width', () => {
    expect(render(TintObsidian, ID)).toContain('max-width:460px');
    expect(navOf(render(TintObsidian, ID, { biz: { businessName: 'Northside Tint Lab' } }))).toBe('ob-nav');
    expect(navOf(render(TintObsidian, ID, { biz: { businessName: 'Rivera Brothers Window Tinting' } }))).toBe('ob-nav ob-nav-long');
  });

  it('keeps a very long name\'s links in the menu up to 980px, where the Book button would leave it too narrow', () => {
    const html = render(TintObsidian, ID, { biz: { businessName: LONG_NAME } });
    expect(navOf(html)).toBe('ob-nav ob-nav-long ob-nav-xl');
    expect(html).toContain('@container (max-width:980px){.ob-nav-xl .ob-links{display:none}.ob-nav-xl .acg-menu{display:block}}');
    expect(navOf(render(TintObsidian, ID, { biz: { businessName: LONG_NAME }, images: { logo: 'https://example.com/logo.png' } }))).toBe('ob-nav');
  });
});

describe('tint_elite', () => {
  const ID = 'tint_elite';
  const BOTH = { warranty: 'Lifetime warranty on ceramic film', warrantyOffered: '12-month parts and labor' };
  const warranty = (html) => {
    const block = (html.match(/<aside class="te-warranty[\s\S]*?<\/aside>/) || [''])[0];
    return {
      title: decode((block.match(/<h3 id="te-warranty-h"[^>]*>([^<]*)<\/h3>/) || [])[1] || ''),
      note: decode((block.match(/<p class="te-warranty-note">([^<]*)<\/p>/) || [])[1] || ''),
    };
  };

  it('shows the menu once the About / Work / Reviews links step aside', () => {
    expect(navOf(render(TintElite, ID))).toBe('te-nav te-nav-x');
    expect(navOf(render(TintElite, ID, { biz: { businessName: LONG_NAME } }))).toBe('te-nav te-wm-xl te-nav-x');
    expect(navOf(render(TintElite, ID, { copy: { hiddenSections: ['about', 'gallery', 'testimonials'] } }))).toBe('te-nav');
  });

  it('leads with the tint / detailing warranty field for those business types', () => {
    for (const businessType of ['tint_shop', 'detailing_shop', 'mobile_detailing']) {
      expect(warranty(render(TintElite, ID, { biz: { businessType, ...BOTH } })))
        .toEqual({ title: BOTH.warranty, note: BOTH.warrantyOffered });
    }
  });

  it('leads with the parts & labor warranty for other types, and shows whichever one is set', () => {
    expect(warranty(render(TintElite, ID, { biz: { businessType: 'mechanic_shop', ...BOTH } })))
      .toEqual({ title: BOTH.warrantyOffered, note: BOTH.warranty });
    expect(warranty(render(TintElite, ID, { biz: { businessType: 'tint_shop', warranty: '', warrantyOffered: BOTH.warrantyOffered } })))
      .toEqual({ title: BOTH.warrantyOffered, note: '' });
    expect(warranty(render(TintElite, ID, { biz: { businessType: 'mechanic_shop', warranty: BOTH.warranty, warrantyOffered: '' } })))
      .toEqual({ title: BOTH.warranty, note: '' });
  });
});
