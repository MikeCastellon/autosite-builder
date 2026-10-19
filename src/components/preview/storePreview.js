// The editor preview's twin of the published page's Genius Store height
// listener (siteRuntime.js SITE_STORE_JS). The preview renders templates
// with React and never runs the page runtime, so WebsitePreview.jsx attaches
// this to its window while it is mounted. Same contract: a message from the
// store's origin, {type:'acg:height', height} with a height of 100-20000px,
// sets the height attribute of the <iframe data-acg-store> whose window sent
// it. storePreview.test.js runs both through the same scenarios.
import { STORE_ORIGIN } from './templates/kit/store.js';

// Applies one message event; true when it resized a frame.
export function applyStoreHeight(doc, e) {
  const d = e?.data;
  if (e?.origin !== STORE_ORIGIN || !d || d.type !== 'acg:height') return false;
  const h = Number(d.height);
  if (!(h >= 100 && h <= 20000)) return false;
  const frames = doc.querySelectorAll('iframe[data-acg-store]');
  for (const f of frames) {
    if (f.contentWindow === e.source) {
      f.setAttribute('height', String(Math.round(h)));
      return true;
    }
  }
  return false;
}

// Listens on `win`; returns a function that stops listening.
export function attachStoreFrames(win, doc) {
  if (!win || typeof win.addEventListener !== 'function' || !doc) return () => {};
  const onMessage = (e) => { applyStoreHeight(doc, e); };
  win.addEventListener('message', onMessage);
  return () => win.removeEventListener('message', onMessage);
}
