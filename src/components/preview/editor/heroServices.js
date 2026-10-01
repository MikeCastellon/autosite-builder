// Edit > Hero > Services in the hero: which services the hero shows
// (copy.heroServices, service names in the owner's order) and how
// (copy.heroCard: 'quote' price card, 'list' price list, 'off' none).
// Pure helpers for HeroServicesPanel; the rules match MobileRedline's
// reader, so the panel shows what the page shows.
import { nameKey } from './serviceRefs.js';

export const HERO_CARD_MODES = ['quote', 'list', 'off'];
export const MAX_HERO_SERVICES = 4;

const hasPrice = (s) => /\d/.test(String(s?.price ?? ''));

// Absent or unknown means the price card (the template's default).
export function heroCardMode(copy) {
  const v = copy?.heroCard;
  return HERO_CARD_MODES.includes(v) ? v : 'quote';
}

// The template's automatic pick while the owner has chosen nothing: the
// first 3 named services whose price holds a number. The price list can
// show unpriced services, so in 'list' mode, when none has a price, the
// first 3 named ones (MobileRedline's autoPicks rule).
export function defaultHeroPicks(services, mode = 'quote') {
  const named = (Array.isArray(services) ? services : [])
    .filter((s) => s && typeof s.name === 'string' && s.name.trim());
  const priced = named.filter(hasPrice);
  return (priced.length || mode !== 'list' ? priced : named)
    .slice(0, 3)
    .map((s) => s.name.trim());
}

// What the hero shows: { names, automatic, stale }.
// names: the saved names that still match a service (by nameKey, first
// occurrence wins, at most 4), written as the service's current name.
// When none match, the automatic pick (automatic: true).
// stale: saved names that match no service any more (the reader ignores
// them; the panel offers Remove).
export function heroSelection(copy, services) {
  const list = Array.isArray(services) ? services : [];
  const byKey = new Map();
  for (const s of list) {
    const k = nameKey(s?.name);
    if (k && !byKey.has(k)) byKey.set(k, s.name.trim());
  }
  const saved = Array.isArray(copy?.heroServices) ? copy.heroServices : [];
  const names = [];
  const seen = new Set();
  const stale = [];
  const staleKeys = new Set();
  for (const entry of saved) {
    if (typeof entry !== 'string') continue;
    const k = nameKey(entry);
    if (!k) continue;
    if (byKey.has(k)) {
      if (!seen.has(k) && names.length < MAX_HERO_SERVICES) {
        seen.add(k);
        names.push(byKey.get(k));
      }
    } else if (!staleKeys.has(k)) {
      staleKeys.add(k);
      stale.push(entry.trim());
    }
  }
  if (!names.length) return { names: defaultHeroPicks(list, heroCardMode(copy)), automatic: true, stale };
  return { names, automatic: false, stale };
}

// Tick / untick one service. Starts from what the hero shows now, so the
// first click on the automatic pick turns it into the owner's own list.
// A 5th service is not added. Returns the names to save, or null when
// none are left (back to automatic). Stale names are dropped: they show
// nothing, and an old name must not come back if a service gets it again.
export function toggleHeroService(copy, services, name, on) {
  const { names } = heroSelection(copy, services);
  const k = nameKey(name);
  let next = names;
  if (on) {
    if (k && !names.some((n) => nameKey(n) === k) && names.length < MAX_HERO_SERVICES) {
      const service = (Array.isArray(services) ? services : []).find((s) => nameKey(s?.name) === k);
      next = [...names, service ? service.name.trim() : String(name).trim()];
    }
  } else {
    next = names.filter((n) => nameKey(n) !== k);
  }
  return next.length ? next : null;
}

// Move a picked service up / down. Saves the shown list as the owner's own.
export function moveHeroService(copy, services, from, to) {
  const { names } = heroSelection(copy, services);
  if (!names.length) return null;
  if (from === to || from < 0 || to < 0 || from >= names.length || to >= names.length) return names;
  const next = [...names];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// Drop one stale name from the saved list (the rest stays as saved).
export function removeStaleName(copy, name) {
  const k = nameKey(name);
  const saved = Array.isArray(copy?.heroServices) ? copy.heroServices : [];
  const next = saved.filter((n) => !(typeof n === 'string' && nameKey(n) === k));
  return next.length ? next : null;
}

// Picked names whose service has no number in its price: the price card
// skips them (the price list shows them without a price).
export function unpricedPicks(selection, services) {
  const names = Array.isArray(selection) ? selection : Array.isArray(selection?.names) ? selection.names : [];
  const list = Array.isArray(services) ? services : [];
  return names.filter((n) => !hasPrice(list.find((s) => nameKey(s?.name) === nameKey(n))));
}
