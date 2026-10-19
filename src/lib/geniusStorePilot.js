// Who sees the Genius Store while the owner tests it (2026-10-19: "don't make
// this available to anyone yet besides me"). Everything an owner could see or
// do is behind this: the business menu item and page (App.jsx), the editor's
// Genius Store tab and its row in Sections (WebsitePreview -> ContentEditor),
// and the server (netlify/functions/genius-store.js refuses everyone else).
// To open it to every owner, set GENIUS_STORE_OPEN to true.
export const GENIUS_STORE_OPEN = false;

export const GENIUS_STORE_PILOT = ['dev@639hz.com'];

export function geniusStoreAllowed(email) {
  if (GENIUS_STORE_OPEN) return true;
  return GENIUS_STORE_PILOT.includes(String(email ?? '').trim().toLowerCase());
}
