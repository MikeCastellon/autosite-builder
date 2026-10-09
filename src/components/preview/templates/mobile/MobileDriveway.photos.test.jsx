// Driveway places gallery photos beyond the band's six in the About,
// How It Works and footer cards, and the rest back in the band: every
// photo shows exactly once while the gallery shows, and never twice
// whatever is hidden (the layout itself was checked in headless Chrome).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MobileDriveway from './MobileDriveway.jsx';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { full } from '../__fixtures__/businesses.js';

const photo = (i) => `https://example.test/photos/gallery-${i}.jpg`;
const STEP = { title: 'Step', desc: 'What happens.' };

// pairs: [[beforeIndex, afterIndex]] of gallery photos the Before & After band also uses.
function render({ photos, steps, aboutText, hidden = [], editor = false, pairs = [] }) {
  const images = { ...full.images, about: 'https://example.test/photos/about.jpg' };
  for (const k of Object.keys(images)) if (/^gallery\d+$/.test(k) || /^ba(Before|After)\d$/.test(k)) delete images[k];
  for (let i = 0; i < photos; i++) images[`gallery${i}`] = photo(i);
  pairs.forEach(([b, a], n) => { images[`baBefore${n}`] = photo(b); images[`baAfter${n}`] = photo(a); });
  const el = createElement(MobileDriveway, {
    businessInfo: normalizeBusinessInfo(full.businessInfo),
    generatedCopy: {
      ...full.generatedCopy, aboutText, howSteps: Array.from({ length: steps }, () => STEP), hiddenSections: hidden,
      ...(pairs.length ? { beforeAfter: { pairs: pairs.map(() => ({ caption: '' })) } } : {}),
    },
    templateMeta: buildTemplateMeta('mobile_driveway', {}, {}),
    images,
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}
const times = (html, url) => html.split(`src="${url}"`).length - 1;

describe('Driveway gallery photos', () => {
  const ABOUT = ['Lead paragraph.\n\nThe rest of the story.', ''];
  const HIDDEN = [[], ['gallery'], ['about'], ['process'], ['gallery', 'process'], ['about', 'process']];
  for (const editor of [false, true]) {
    for (const aboutText of ABOUT) {
      for (const hidden of HIDDEN) {
        it(`${editor ? 'editor' : 'published'}, about ${aboutText ? 'with' : 'without'} text, hidden [${hidden}]`, () => {
          for (const photos of [0, 1, 6, 7, 9, 12, 15]) {
            for (const steps of [0, 2, 3]) {
              const html = render({ photos, steps, aboutText, hidden, editor });
              const counts = Array.from({ length: photos }, (_, i) => times(html, photo(i)));
              const where = JSON.stringify({ photos, steps });
              expect(counts.every((n) => n <= 1), where).toBe(true);
              if (!hidden.includes('gallery')) expect(counts.every((n) => n === 1), where).toBe(true);
              // The About photo shows once at most: the footer borrows it only while About is off the page.
              expect(times(html, 'https://example.test/photos/about.jpg'), where).toBeLessThanOrEqual(1);
            }
          }
        });
      }
    }
  }
});

describe('Driveway Before & After photos', () => {
  it('shows a gallery photo the band uses only in the band, and the rest once each', () => {
    for (const editor of [false, true]) {
      for (const photos of [4, 8, 12]) {
        for (const steps of [0, 3]) {
          const pairs = [[photos - 4, photos - 3], [photos - 2, photos - 1]];
          const html = render({ photos, steps, aboutText: 'Lead.\n\nRest.', editor, pairs });
          const where = JSON.stringify({ editor, photos, steps });
          expect(html, where).toContain('data-section="beforeAfter"');
          for (let i = 0; i < photos; i++) expect(times(html, photo(i)), `${where} photo ${i}`).toBe(1);
        }
      }
    }
  });

  it('gives the How It Works cards photos for every step or for none', () => {
    // 8 photos: six in the band, one for About, one left: too few for three steps.
    const html = render({ photos: 8, steps: 3, aboutText: 'Lead.\n\nRest.' });
    expect(html).not.toContain('class="dw-step-ph"');
    for (let i = 0; i < 8; i++) expect(times(html, photo(i))).toBe(1);
    // 10 photos: six, About, three steps.
    expect(render({ photos: 10, steps: 3, aboutText: 'Lead.\n\nRest.' }).split('class="dw-step-ph"').length - 1).toBe(3);
  });

  it('drops the footer photo card when no photo is left for it', () => {
    const html = render({ photos: 7, steps: 0, aboutText: 'Lead.\n\nRest.' });
    expect(html).toContain('dw-foot-nophoto');
    expect(html).not.toContain('class="dw-foot-ph"');
  });
});
