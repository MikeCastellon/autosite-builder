// Driveway's photos: the second About photo and the How It Works step
// photos have their own slots (placeholders in the editor), gallery photos
// that a service card or the Before & After band shows stay out of the
// gallery, and the gallery band shows the rest, the footer card taking one
// past the sixth: every photo shows exactly once while the gallery shows,
// and never twice whatever is hidden (the layout itself was checked in
// headless Chrome).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MobileDriveway from './MobileDriveway.jsx';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { PHOTO_HINTS } from '../kit/PhotoSlot.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { full } from '../__fixtures__/businesses.js';

const photo = (i) => `https://example.test/photos/gallery-${i}.jpg`;
const own = (key) => `https://example.test/photos/${key}.jpg`;
const STEP = { title: 'Step', desc: 'What happens.' };
const ABOUT_TEXT = 'Lead paragraph.\n\nThe rest of the story.';

// pairs: [[beforeIndex, afterIndex]] of gallery photos the Before & After
// band also uses; servicePhotos: gallery indexes given to the first
// services as package photos; extra: more image keys (about2, howStep<i>).
function render({ photos, steps = 0, howSteps, aboutText = ABOUT_TEXT, hidden = [], editor = false, pairs = [], servicePhotos = [], extra = {} }) {
  const images = { ...full.images, about: own('about') };
  for (const k of Object.keys(images)) if (/^gallery\d+$/.test(k) || /^ba(Before|After)\d$/.test(k)) delete images[k];
  for (let i = 0; i < photos; i++) images[`gallery${i}`] = photo(i);
  pairs.forEach(([b, a], n) => { images[`baBefore${n}`] = photo(b); images[`baAfter${n}`] = photo(a); });
  Object.assign(images, extra);
  const biz = normalizeBusinessInfo(full.businessInfo);
  const packages = (biz.packages || []).map((p, i) => (i < servicePhotos.length ? { ...p, image: photo(servicePhotos[i]) } : p));
  const el = createElement(MobileDriveway, {
    businessInfo: { ...biz, packages },
    generatedCopy: {
      ...full.generatedCopy, aboutText, hiddenSections: hidden,
      howSteps: howSteps || Array.from({ length: steps }, () => STEP),
      ...(pairs.length ? { beforeAfter: { pairs: pairs.map(() => ({ caption: '' })) } } : {}),
    },
    templateMeta: buildTemplateMeta('mobile_driveway', {}, {}),
    images,
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}
const times = (html, url) => html.split(`src="${url}"`).length - 1;
const count = (html, needle) => html.split(needle).length - 1;
// Text as React writes it into the markup.
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ONE = 'class="dw-about-grid dw-about-one"';

describe('Driveway gallery photos', () => {
  const HIDDEN = [[], ['gallery'], ['about'], ['process'], ['gallery', 'process'], ['about', 'process']];
  for (const editor of [false, true]) {
    for (const aboutText of [ABOUT_TEXT, '']) {
      for (const hidden of HIDDEN) {
        it(`${editor ? 'editor' : 'published'}, about ${aboutText ? 'with' : 'without'} text, hidden [${hidden}]`, () => {
          for (const photos of [0, 1, 6, 7, 9, 12, 15]) {
            for (const steps of [0, 3]) {
              const html = render({ photos, steps, aboutText, hidden, editor });
              const counts = Array.from({ length: photos }, (_, i) => times(html, photo(i)));
              const where = JSON.stringify({ photos, steps });
              expect(counts.every((n) => n <= 1), where).toBe(true);
              if (!hidden.includes('gallery')) expect(counts.every((n) => n === 1), where).toBe(true);
              // The About photo shows once at most: the footer borrows it only while About is off the page.
              expect(times(html, own('about')), where).toBeLessThanOrEqual(1);
            }
          }
        });
      }
    }
  }

  it('never fills the second About photo or the step cards from the gallery', () => {
    const html = render({ photos: 12, steps: 3 });
    expect(html).not.toContain('class="dw-about-ph dw-about-ph2"');
    expect(html).not.toContain('class="dw-step-ph"');
    expect(html).toContain(ONE);
  });

  it('drops the footer photo card when no photo is left for it', () => {
    const html = render({ photos: 6, steps: 0 });
    expect(html).toContain('dw-foot-nophoto');
    expect(html).not.toContain('class="dw-foot-ph"');
    // A seventh photo fills it.
    expect(render({ photos: 7, steps: 0 })).toContain('class="dw-foot-ph"');
  });
});

describe('Driveway second About photo (images.about2)', () => {
  it('shows it once, as the second photo of the cascade', () => {
    const html = render({ photos: 6, extra: { about2: own('about2') } });
    expect(times(html, own('about2'))).toBe(1);
    expect(html).toContain('class="dw-about-ph dw-about-ph2"');
    expect(html).not.toContain(ONE);
  });

  it('leaves a published page without one to the photo and the story card, and asks for it in the editor', () => {
    const pub = render({ photos: 6 });
    expect(pub).not.toContain(esc(PHOTO_HINTS.about2));
    expect(pub).toContain(ONE);
    const ed = render({ photos: 6, editor: true });
    expect(ed).toContain(esc(PHOTO_HINTS.about2));
    expect(ed).toContain('class="dw-about-ph dw-about-ph2"');
  });
});

describe('Driveway How It Works step photos (images.howStep<i>)', () => {
  const three = { howStep0: own('s0'), howStep1: own('s1'), howStep2: own('s2') };

  it('shows them once every step has one', () => {
    const html = render({ photos: 6, steps: 3, extra: three });
    expect(count(html, 'class="dw-step-ph"')).toBe(3);
    for (const k of ['s0', 's1', 's2']) expect(times(html, own(k))).toBe(1);
  });

  it('shows none on the published page while a step still has none, and a placeholder per missing one in the editor', () => {
    const partial = { howStep0: own('s0'), howStep2: own('s2') };
    const pub = render({ photos: 6, steps: 3, extra: partial });
    expect(pub).not.toContain('class="dw-step-ph"');
    expect(pub).not.toContain(esc(PHOTO_HINTS.howStep));
    const ed = render({ photos: 6, steps: 3, extra: partial, editor: true });
    expect(count(ed, 'class="dw-step-ph"')).toBe(3);
    expect(count(ed, esc(PHOTO_HINTS.howStep))).toBe(1);
    expect(times(ed, own('s0'))).toBe(1);
    expect(times(ed, own('s2'))).toBe(1);
  });

  it('keeps each photo on its own step when a blank step sits between them', () => {
    const html = render({ photos: 6, howSteps: [STEP, {}, { title: 'Third' }], extra: { howStep0: own('s0'), howStep2: own('s2') } });
    const cards = html.split('<li class="dw-step"').slice(1);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain(own('s0'));
    expect(cards[1]).toContain('Third');
    expect(cards[1]).toContain(own('s2'));
  });
});

describe('Driveway Before & After and service photos', () => {
  it('shows a gallery photo the band uses only in the band, and the rest once each', () => {
    for (const editor of [false, true]) {
      for (const photos of [4, 8, 12]) {
        for (const steps of [0, 3]) {
          const pairs = [[photos - 4, photos - 3], [photos - 2, photos - 1]];
          const html = render({ photos, steps, editor, pairs });
          const where = JSON.stringify({ editor, photos, steps });
          expect(html, where).toContain('data-section="beforeAfter"');
          for (let i = 0; i < photos; i++) expect(times(html, photo(i)), `${where} photo ${i}`).toBe(1);
        }
      }
    }
  });

  it('shows a gallery photo a service card uses only on that card', () => {
    const html = render({ photos: 10, servicePhotos: [0, 1] });
    for (let i = 0; i < 10; i++) expect(times(html, photo(i)), `photo ${i}`).toBe(1);
  });
});

describe('Driveway hero review card', () => {
  const hero = (html) => html.slice(html.indexOf('data-section="hero"'), html.indexOf('data-section="statsBar"') > 0 ? html.indexOf('data-section="statsBar"') : undefined);

  it('quotes the first review when no Google rating is connected', () => {
    const html = render({ photos: 6 });
    const first = full.generatedCopy.testimonialPlaceholders[0];
    expect(hero(html)).toContain('dw-hq');
    expect(hero(html)).toContain(esc(first.name));
    expect(hero(html)).toContain('href="#reviews"');
    expect(hero(html)).not.toContain('Google review');
  });

  it('shows the Google rating instead once a place is connected, and nothing while reviews are hidden', () => {
    const el = createElement(MobileDriveway, {
      businessInfo: { ...normalizeBusinessInfo(full.businessInfo), googlePlace: { placeId: 'x', placeName: 'Shop', rating: 4.9, reviewCount: 283 } },
      generatedCopy: full.generatedCopy,
      templateMeta: buildTemplateMeta('mobile_driveway', {}, {}),
      images: full.images,
    });
    const html = renderToStaticMarkup(el);
    expect(hero(html)).toContain('283 reviews on Google');
    expect(hero(html)).not.toContain('class="dw-rating dw-hq"');
    expect(hero(render({ photos: 6, hidden: ['testimonials'] }))).not.toContain('class="dw-rating dw-hq"');
  });
});

describe('Driveway review scroller', () => {
  const quotes = (n) => Array.from({ length: n }, (_, i) => ({ text: `Review number ${i + 1} text.`, name: `Name ${i + 1}` }));
  const page = (n, extra = {}) => renderToStaticMarkup(createElement(MobileDriveway, {
    businessInfo: normalizeBusinessInfo(full.businessInfo),
    generatedCopy: { ...full.generatedCopy, testimonialPlaceholders: quotes(n), ...extra },
    templateMeta: buildTemplateMeta('mobile_driveway', {}, {}),
    images: full.images,
  }));

  it('gives the review row prev / next buttons the page runtime drives', () => {
    const html = page(6);
    expect(html).toMatch(/<button type="button" class="dw-rev-btn" data-acg-scroll="prev" aria-controls="dw-rev-track" aria-label="Previous review">/);
    expect(html).toMatch(/<button type="button" class="dw-rev-btn" data-acg-scroll="next" aria-controls="dw-rev-track" aria-label="Next review">/);
    const track = html.match(/<div id="dw-rev-track"[^>]*>/)[0];
    for (const attr of ['class="dw-rev"', 'role="region"', 'tabindex="0"', 'aria-label="Customer reviews, scroll sideways for more"']) expect(track).toContain(attr);
    expect(html).not.toContain('class="dw-rev-head dw-rev-few"');
    for (let i = 1; i <= 6; i++) expect(html).toContain(`Review number ${i} text.`);
  });

  it('keeps the buttons for phones only while three reviews fit, and none for one review or the Google widget', () => {
    expect(page(3)).toContain('class="dw-rev-head dw-rev-few"');
    expect(page(1)).not.toContain('data-acg-scroll="');
    expect(page(4, { googleWidgetKey: 'abc' })).not.toContain('data-acg-scroll="');
  });

  it('scrolls smoothly only for visitors who allow motion', () => {
    const css = page(6);
    const motion = css.indexOf('@media (prefers-reduced-motion: no-preference)');
    expect(css.indexOf('.dw-rev{scroll-behavior:smooth}')).toBeGreaterThan(motion);
    expect(css).toContain('.dw-rev{display:grid;grid-auto-flow:column');
    expect(css).toMatch(/\.dw-rev\{[^}]*scroll-snap-type:x mandatory/);
  });
});

describe('Driveway About photos on the published page', () => {
  const ABOUT = 'Lead.\n\nRest of the story.';
  it('shows only the photos that exist, the card taking the room of a missing one', () => {
    const none = render({ photos: 6, aboutText: ABOUT, extra: { about: '' } });
    expect(none).toContain('class="dw-about-grid dw-about-none"');
    expect(none).not.toContain('class="dw-about-ph');
    const onlySecond = render({ photos: 6, aboutText: ABOUT, extra: { about: '', about2: own('about2') } });
    expect(onlySecond).toContain('class="dw-about-grid dw-about-one"');
    expect(count(onlySecond, 'class="dw-about-ph')).toBe(1);
    expect(times(onlySecond, own('about2'))).toBe(1);
    const ed = render({ photos: 6, aboutText: ABOUT, extra: { about: '' }, editor: true });
    expect(count(ed, 'class="dw-about-ph')).toBe(2);
  });

  it('lists a single review plainly, without a scroll region', () => {
    const one = renderToStaticMarkup(createElement(MobileDriveway, {
      businessInfo: normalizeBusinessInfo(full.businessInfo),
      generatedCopy: { ...full.generatedCopy, testimonialPlaceholders: [{ text: 'Only one.', name: 'A' }] },
      templateMeta: buildTemplateMeta('mobile_driveway', {}, {}),
      images: full.images,
    }));
    expect(one).toContain('<div id="dw-rev-track" class="dw-rev" data-acg-reveal="">');
    expect(one).not.toMatch(/id="dw-rev-track"[^>]*tabindex/);
  });
});

