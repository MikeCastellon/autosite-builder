// The Genius Store iframe's height, run twice over the same scenarios: the
// published page's SITE_STORE_JS (siteRuntime.js, compiled the way the page
// runs it) and its editor twin attachStoreFrames (storePreview.js), so the
// preview and the live site can't drift apart.
import { describe, it, expect } from 'vitest';
import * as espree from 'espree';
import { SITE_STORE_JS } from '../../lib/siteRuntime.js';
import { attachStoreFrames } from './storePreview.js';
import { STORE_ORIGIN } from './templates/kit/store.js';

function page() {
  const listeners = [];
  const window = {
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    removeEventListener: (type, fn) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  const frames = [];
  const frame = () => {
    const f = {
      contentWindow: { name: `frame${frames.length}` },
      attrs: { height: '900' },
      setAttribute(k, v) { this.attrs[k] = v; },
    };
    frames.push(f);
    return f;
  };
  const document = {
    querySelectorAll: (sel) => {
      if (sel !== 'iframe[data-acg-store]') throw new Error(`unexpected selector ${sel}`);
      return frames;
    },
  };
  const send = (source, data, origin = STORE_ORIGIN) => {
    for (const l of [...listeners]) if (l.type === 'message') l.fn({ origin, source, data });
  };
  return { window, document, listeners, frame, send };
}

const IMPLEMENTATIONS = [
  ['published SITE_STORE_JS', (p) => { new Function('window', 'document', SITE_STORE_JS)(p.window, p.document); }],
  ['editor attachStoreFrames', (p) => attachStoreFrames(p.window, p.document)],
];

describe.each(IMPLEMENTATIONS)('%s', (_, attach) => {
  it('listens for messages on the window only', () => {
    const p = page();
    attach(p);
    expect(p.listeners.map((l) => l.type)).toEqual(['message']);
  });

  it('sizes the iframe whose window sent the height, and no other', () => {
    const p = page();
    const a = p.frame();
    const b = p.frame();
    attach(p);
    p.send(b.contentWindow, { type: 'acg:height', height: 1834.6 });
    expect(b.attrs.height).toBe('1835');
    expect(a.attrs.height).toBe('900');
  });

  it('ignores other origins, other message types and absurd heights', () => {
    const p = page();
    const a = p.frame();
    attach(p);
    p.send(a.contentWindow, { type: 'acg:height', height: 1500 }, 'https://evil.example');
    p.send(a.contentWindow, { type: 'other', height: 1500 });
    p.send(a.contentWindow, { type: 'acg:height', height: 'tall' });
    p.send(a.contentWindow, { type: 'acg:height', height: 99 });
    p.send(a.contentWindow, { type: 'acg:height', height: 2_000_000 });
    p.send(a.contentWindow, null);
    p.send({ name: 'not a store frame' }, { type: 'acg:height', height: 1500 });
    expect(a.attrs.height).toBe('900');
  });
});

describe('SITE_STORE_JS', () => {
  it('is ES5 (it runs as-is on old phones)', () => {
    expect(() => espree.parse(SITE_STORE_JS, { ecmaVersion: 5 })).not.toThrow();
  });

  it('accepts exactly the origin the band frames', () => {
    expect(SITE_STORE_JS).toContain(`'${STORE_ORIGIN}'`);
  });
});

describe('attachStoreFrames', () => {
  it('stops listening when detached', () => {
    const p = page();
    const detach = attachStoreFrames(p.window, p.document);
    detach();
    expect(p.listeners).toEqual([]);
  });
});
