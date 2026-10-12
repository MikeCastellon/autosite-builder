// Driveway's menu-bar logo and Edit > Hero > Logo size (copy.logoSize): the
// stylesheet sizes the logo (38px tall, 150px wide at most) and a saved size
// only sets the root's --dw-logo-h / --dw-logo-w. The logo gives way before
// the bar overflows, phones cap it at 52px tall, and the sticky Services
// card, the How It Works heading and jump targets move down by however much
// the bar grew (all as at 100% without a saved size). The layout itself was
// measured in headless Chrome: square, oval and 4:1 logos at 100/150/200%,
// 320-1440px wide, the logo 12px from its neighbour, the bar inside the
// hero's top padding, and section text clear of the bar after a jump.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MobileDriveway from './MobileDriveway.jsx';
import { EditorModeProvider } from '../kit/EditorMode.jsx';
import { buildTemplateMeta } from '../../../../lib/siteRender.js';
import { normalizeBusinessInfo } from '../../../../lib/normalizeBusinessInfo.js';
import { full } from '../__fixtures__/businesses.js';

const LOGO = 'https://example.test/logo.png';

function render({ logoSize, logo = LOGO, editor = false } = {}) {
  const copy = { ...full.generatedCopy, ...(logoSize === undefined ? {} : { logoSize }) };
  const el = createElement(MobileDriveway, {
    businessInfo: normalizeBusinessInfo(full.businessInfo),
    generatedCopy: copy,
    templateMeta: buildTemplateMeta('mobile_driveway'),
    images: { ...full.images, logo },
  });
  return renderToStaticMarkup(editor ? createElement(EditorModeProvider, { value: true }, el) : el);
}

const rootStyle = (html) => html.match(/<div class="dw-root" style="([^"]*)"/)[1];
const navLogo = (html) => html.match(/<a class="dw-logo" href="#top">(<img[^>]*>)/)[1];

describe('Driveway logo size', () => {
  it('sizes the menu-bar logo from the stylesheet, with no inline height', () => {
    const html = render();
    for (const rule of [
      '.dw-logo img{height:var(--dw-logo-h,38px);max-width:var(--dw-logo-w,150px);min-width:0}',
      '.dw-logo img{height:min(var(--dw-logo-h,38px),52px)}',
      '.dw-root section[id]{scroll-margin-top:max(0px,calc(var(--dw-logo-h,38px) - 38px))}',
      '.dw-root section[id]{scroll-margin-top:max(0px,calc(min(var(--dw-logo-h,38px),52px) - 38px))}',
      '.dw-svc-panels{position:sticky;top:calc(58px + var(--dw-logo-h,38px));min-width:0}',
      '.dw-how-head{position:sticky;top:calc(72px + var(--dw-logo-h,38px))}',
    ]) expect(html).toContain(rule);
    const img = navLogo(html);
    expect(img).toContain(`src="${LOGO}"`);
    expect(img).toContain('style="display:block;width:auto;object-fit:contain;border-radius:3px"');
  });

  it('sets nothing on the root without a saved size, or at 100%', () => {
    for (const logoSize of [undefined, null, 100, 'oops']) {
      for (const editor of [false, true]) expect(rootStyle(render({ logoSize, editor }))).not.toContain('--dw-logo');
    }
  });

  it('sets the logo height and width cap on the root for a saved size', () => {
    const cases = [[80, '30px', '120px'], [120, '46px', '180px'], [150, '57px', '225px'], [200, '76px', '300px'], [999, '76px', '300px'], ['135', '51px', '203px']];
    for (const [logoSize, h, w] of cases) {
      for (const editor of [false, true]) {
        const style = rootStyle(render({ logoSize, editor }));
        expect(style).toContain(`--dw-logo-h:${h}`);
        expect(style).toContain(`--dw-logo-w:${w}`);
      }
    }
  });

  it('leaves the footer logo at its own size', () => {
    const html = render({ logoSize: 200 });
    expect(html).toContain('style="display:block;width:auto;height:64px;object-fit:contain;max-width:220px;border-radius:3px"');
  });

  it('ignores a saved size once the logo is removed', () => {
    for (const editor of [false, true]) {
      const html = render({ logo: '', logoSize: 200, editor });
      expect(html).toMatch(/<a class="dw-logo" href="#top"><span class="dw-logo-name">/);
      // The bar holds the name at its usual height, so nothing below moves.
      expect(rootStyle(html)).not.toContain('--dw-logo');
    }
  });
});
