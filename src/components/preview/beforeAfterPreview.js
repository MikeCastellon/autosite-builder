// The editor preview's twin of the published page's Before & After script
// (siteRuntime.js SITE_BA_JS). The preview renders templates with React and
// never runs the page runtime, so WebsitePreview.jsx attaches these
// listeners to its document while it is mounted. Same data attributes and
// the same behavior (kit/BeforeAfter.jsx markup):
//   - input on a [data-acg-ba-range] sets --acg-ba (the divider) to its
//     value% on the closest [data-acg-ba] figure;
//   - [data-acg-ba-prev] / [data-acg-ba-next] scroll the slider's
//     [data-acg-ba-track] one slide back / on, wrapping round at the ends;
//   - a track's scroll writes "02 / 03" into the slider's
//     [data-acg-ba-count].
// The counter is the element's only text, so React (which wrote "01 / 03")
// keeps setting it the same way and never loses a node.
import { baCounter } from './templates/kit/beforeAfter.js';

// One slide back (k = -1) or on (1) in a [data-acg-ba-slider], or with
// k = 0 the counter brought up to date with where its track is.
export function stepBeforeAfter(slider, k) {
  const track = slider?.querySelector('[data-acg-ba-track]');
  if (!track) return;
  const n = track.children.length;
  const width = track.clientWidth;
  if (!n || !width) return;
  const i = Math.min(Math.round(track.scrollLeft / width), n - 1);
  if (k) {
    track.scrollLeft = ((i + k + n) % n) * width;
    return;
  }
  const count = slider.querySelector('[data-acg-ba-count]');
  if (count) count.textContent = `${baCounter(i + 1)} / ${baCounter(n)}`;
}

// Listens on `doc`; returns a function that stops listening.
export function attachBeforeAfter(doc) {
  if (!doc || typeof doc.addEventListener !== 'function') return () => {};
  const onInput = (e) => {
    const t = e.target;
    if (!t?.closest || !t.hasAttribute('data-acg-ba-range')) return;
    t.closest('[data-acg-ba]')?.style.setProperty('--acg-ba', `${t.value}%`);
  };
  const onClick = (e) => {
    const b = e.target?.closest?.('[data-acg-ba-prev],[data-acg-ba-next]');
    if (b) stepBeforeAfter(b.closest('[data-acg-ba-slider]'), b.hasAttribute('data-acg-ba-next') ? 1 : -1);
  };
  // Scroll events don't bubble: listen in the capture phase.
  const onScroll = (e) => {
    const t = e.target;
    if (t?.closest && t.hasAttribute('data-acg-ba-track')) stepBeforeAfter(t.closest('[data-acg-ba-slider]'), 0);
  };
  doc.addEventListener('input', onInput);
  doc.addEventListener('click', onClick);
  doc.addEventListener('scroll', onScroll, true);
  return () => {
    doc.removeEventListener('input', onInput);
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('scroll', onScroll, true);
  };
}
