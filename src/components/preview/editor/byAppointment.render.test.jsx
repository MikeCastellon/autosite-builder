// Why Business Info offers "By appointment" per day for every template: each
// registered template, published, prints a per-day BY_APPOINTMENT value
// (as written, or title-cased) and never shows that day as "Closed" (only
// '' may read Closed).
// A template that starts guessing from the hours text fails here.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TEMPLATE_COMPONENT_MAP } from '../../../data/templates.js';
import { buildTemplateMeta } from '../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../lib/normalizeBusinessInfo.js';
import { BY_APPOINTMENT } from '../../../lib/businessHours.js';
import { FIXTURES } from '../templates/__fixtures__/businesses.js';

const HOURS = { Mon: '8am-6pm', Tue: '8am-6pm', Wed: '8am-6pm', Thu: '8am-6pm', Fri: '8am-6pm', Sat: '', Sun: BY_APPOINTMENT };

// What a visitor reads: no <style>/<script> bodies, no tags, entities undone.
const visibleText = (html) => html
  .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');

describe('per-day By appointment hours on every template', () => {
  for (const id of Object.keys(TEMPLATE_COMPONENT_MAP)) {
    it(`${id} prints By appointment and never shows Sunday as Closed`, async () => {
      const mod = await TEMPLATE_COMPONENT_MAP[id]();
      const out = renderToStaticMarkup(createElement(mod.default, {
        businessInfo: normalizeBusinessInfo({ ...FIXTURES.full.businessInfo, hours: HOURS }),
        generatedCopy: FIXTURES.full.generatedCopy,
        templateMeta: buildTemplateMeta(id),
        images: FIXTURES.full.images,
      }));
      const text = visibleText(out);
      // As written, or in the design's own title case (Redline).
      expect(text).toMatch(/By appointment/i);
      expect(text).not.toMatch(/\bSun[a-z]*\.?\s*:?\s*Closed/i);
    });
  }
});
