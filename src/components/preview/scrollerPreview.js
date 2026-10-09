// The editor preview's twin of the published page's scroller script
// (siteRuntime.js SITE_SCROLL_JS). The preview renders templates with React
// and never runs the page runtime, so WebsitePreview.jsx attaches this
// listener to its document while it is mounted. Same contract and the same
// behavior: a click on
//   <button type="button" data-acg-scroll="prev|next" aria-controls="<track id>">
// (or on its icon) scrolls that track one card pitch back / on, stepping
// from the card nearest the current position and wrapping round at the
// ends. scrollerPreview.test.js runs both through the same scenarios.

// One card back (k = -1) or on (1) in a horizontal scroller. The pitch is
// the distance between its first two children (gap included), or its width
// with one child. A track that is not laid out or does not overflow is left
// alone. Assigning scrollLeft (not scrollBy/scrollTo with a behavior) lets
// the track's CSS scroll-behavior pick smooth or instant.
export function stepScroller(track, k) {
  if (!track || !k) return;
  const cards = track.children || [];
  const max = track.scrollWidth - track.clientWidth;
  const pitch = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
  if (!(max >= 1) || !(pitch > 0)) return;
  const x = track.scrollLeft;
  const i = Math.round(x / pitch) + k;
  if (k > 0) track.scrollLeft = x >= max - 1 ? 0 : Math.min(i * pitch, max);
  else track.scrollLeft = x < 1 ? max : Math.max(i * pitch, 0);
}

// Listens on `doc`; returns a function that stops listening.
export function attachScrollers(doc) {
  if (!doc || typeof doc.addEventListener !== 'function') return () => {};
  const onClick = (e) => {
    const b = e.target?.closest?.('button[data-acg-scroll]');
    if (!b) return;
    const dir = b.getAttribute('data-acg-scroll');
    const k = dir === 'next' ? 1 : dir === 'prev' ? -1 : 0;
    const id = b.getAttribute('aria-controls');
    if (k && id) stepScroller(doc.getElementById(id), k);
  };
  doc.addEventListener('click', onClick);
  return () => doc.removeEventListener('click', onClick);
}
