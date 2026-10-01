// Pure helpers behind VehicleMakesPanel (copy.vehicleMakes). The value is
// the owner's list of make names in their order, or null for the template's
// default band (all of VEHICLE_MAKES). Parsing and de-duplication go
// through the kit's vehicleMakesFor, so the panel ticks exactly the makes
// the band shows. Known makes are stored under their display name
// ('Mercedes' -> 'Mercedes-Benz'); other names stay as typed.
//
// The panel never writes []: readers treat an empty list as "default", so
// removing the last make writes null and the band shows every make again.
import { VEHICLE_MAKES, findVehicleMake, vehicleMakesFor } from '../templates/kit/vehicleMakes.js';

export const CUSTOM_MAX_LEN = 30;
export const MAKES_MAX = 40;

// Same key the kit dedupes with: a known make's id, else the name reduced to
// lowercase letters and digits ('Rivian ', 'RIVIAN' -> 'rivian').
const keyOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const makeKey = (name) => findVehicleMake(name)?.id || keyOf(name);
const displayName = (name) => findVehicleMake(name)?.name || String(name).trim();

const DEFAULT_NAMES = VEHICLE_MAKES.map((m) => m.name);

// The owner's names (deduped, known makes renamed to their display name), or
// null when the value means the default: absent, not a list, or no names.
// A legacy comma string ("BMW, vw, Rivian") is read like the template does.
export function currentMakes(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\n·|;]+/) : [];
  const names = raw.map((n) => (typeof n === 'string' ? n.trim() : '')).filter((n) => keyOf(n));
  if (names.length === 0) return null;
  const out = vehicleMakesFor(names).map((m) => m.name);
  return out.length ? out : null;
}

// What the band shows: the owner's names, else every default make.
export function effectiveNames(value) {
  return currentMakes(value) || [...DEFAULT_NAMES];
}

export function isPicked(value, name) {
  const k = makeKey(name);
  return Boolean(k) && effectiveNames(value).some((n) => makeKey(n) === k);
}

// Tick (append, in the owner's order) or untick a make. Starts from what the
// band shows, so the first untick from the default keeps the other makes in
// the default order. Returns the names, or null once none are left (a
// toggle that changes nothing returns the value as it was read).
export function toggleMake(value, name, on) {
  const names = effectiveNames(value);
  const k = makeKey(name);
  const has = Boolean(k) && names.some((n) => makeKey(n) === k);
  if (!k || Boolean(on) === has) return currentMakes(value);
  const next = on ? [...names, displayName(name)] : names.filter((n) => makeKey(n) !== k);
  return next.length ? next : null;
}

// Add a typed name ('Rivian'; 'vw' adds the known Volkswagen). The cap only
// bounds free-typed names: ticking the 30 known makes never hits it.
export function addCustomMake(value, name) {
  const text = typeof name === 'string' ? name.trim() : '';
  if (!keyOf(text)) return { error: 'empty' };
  if (text.length > CUSTOM_MAX_LEN) return { error: 'long' };
  const names = effectiveNames(value);
  const k = makeKey(text);
  if (names.some((n) => makeKey(n) === k)) return { error: 'duplicate' };
  if (names.length >= MAKES_MAX) return { error: 'full' };
  return { names: [...names, displayName(text)] };
}

export function removeMake(value, name) {
  const k = makeKey(name);
  const names = effectiveNames(value).filter((n) => makeKey(n) !== k);
  return names.length ? names : null;
}

// The picked names that are not known makes (shown as removable chips; the
// band shows them as text).
export function customNames(value) {
  return (currentMakes(value) || []).filter((n) => !findVehicleMake(n));
}

// "Clear all": the owner's own (custom) names only, so every grid make is
// unticked. null when there are none: the value cannot say "no grid makes"
// (an empty list means every make), so the panel then waits for the first
// tick and writes firstMakes(name).
export function clearKnownMakes(value) {
  const custom = customNames(value);
  return custom.length ? custom : null;
}

// The list after the first tick on a cleared grid.
export function firstMakes(name) {
  return keyOf(name) ? [displayName(name)] : null;
}
