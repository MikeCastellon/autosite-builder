import { servicePriceCents } from './deposit-math.js';
import { normalizeAppearance } from './appearance.js';
import { enabledVehicleTypes, resolveVariant } from './vehicle-pricing.js';
import { isOpenWindow, normalizeGranularity, normalizeLeadHours } from './slot-math.js';
import { resolveShopTimeZone, shopTodayISO } from './shop-time.js';

function formatCents(cents) {
  if (typeof cents !== 'number' || cents <= 0) return '';
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

const TEMPLATE_FALLBACK_COLORS = { default: '#1a1a1a' };

// Everything below comes from owner-written jsonb and is placed into
// innerHTML / style attributes on every published page, so colors must be
// plain hex and text is length-capped. The widget escapes text as well.
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
function safeColor(value, fallback) {
  return typeof value === 'string' && HEX_COLOR_RE.test(value.trim()) ? value.trim() : fallback;
}

function capText(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

// This payload is fetched (uncached) on every page view before the Book
// Now button appears. Booking Settings used to store uploaded logos as
// base64 data URLs: one of 400 KB+ made the widget wait seconds on a phone.
// Small inline images and http(s) URLs pass; anything else is dropped (the
// widget then shows the business initial).
export const MAX_INLINE_LOGO_CHARS = 48 * 1024;
function safeLogoUrl(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v.length <= 2048 ? v : null;
  if (/^data:image\//i.test(v)) return v.length <= MAX_INLINE_LOGO_CHARS ? v : null;
  return null;
}

function hasOpenHours(availability) {
  if (!availability || typeof availability !== 'object') return false;
  return Object.values(availability).some((wins) => Array.isArray(wins) && wins.some(isOpenWindow));
}

// Public payload discipline: nested per-vehicle maps only carry keys for
// vehicle types the owner currently offers (see vehicle-pricing.js for the
// map semantics). Keys are filtered, values pass through verbatim — an
// enabled:false variant or a null add-on price is meaningful widget data.
function pickVehicleKeys(map, ids) {
  const out = {};
  for (const k of Object.keys(map)) {
    if (ids.has(k)) out[k] = map[k];
  }
  return out;
}

// Pure builder: takes a `sites` row, returns the public widget payload.
// No DB / network — unit testable. `now` only moves "today" in tests.
export function buildSchedulerPayload(site, { now = Date.now() } = {}) {
  const businessName = capText(site.business_info?.businessName, 120) || 'Book Now';
  const customColors = site.generated_content?._customColors || {};
  const brandColor = safeColor(
    customColors.primary || customColors.accent || TEMPLATE_FALLBACK_COLORS[site.template_id],
    TEMPLATE_FALLBACK_COLORS.default,
  );

  const cfg = site.scheduler_config || {};
  const appearance = normalizeAppearance(cfg.appearance);
  appearance.accent_color = safeColor(appearance.accent_color, '#1a1a1a');
  appearance.logo_url = safeLogoUrl(appearance.logo_url) || '';
  appearance.tagline = capText(appearance.tagline, 160);
  const vehicleTypes = enabledVehicleTypes(cfg.vehicle_types);
  const vehicleTypeIds = new Set(vehicleTypes.map((t) => t.id));
  const enabledServices = (cfg.services || []).filter((s) => s && s.enabled !== false);
  const siteLogo = site.generated_content?._images?.logo || null;
  const logoUrl = appearance.logo_url || safeLogoUrl(cfg.logo_url) || safeLogoUrl(siteLogo) || null;
  const bookingMode = cfg.booking_mode === 'simple' ? 'simple' : 'full';
  const timeZone = resolveShopTimeZone(cfg, site.business_info);

  // Can a customer finish a booking at all? The request form (simple mode)
  // always can. The calendar needs opening hours, and once vehicle types
  // are saved, a service offered for at least one of them. When false the
  // widget shows "not available" instead of a flow that dead-ends.
  const bookable = bookingMode === 'simple' || (
    hasOpenHours(cfg.availability) && (
      vehicleTypes.length === 0
      || enabledServices.some((s) => vehicleTypes.some((t) => resolveVariant(s, t.id) !== null))
    )
  );

  return {
    enabled: true,
    bookable,
    site_type: site.site_type || 'website',
    businessName,
    brandColor,
    appearance,
    logo_url: logoUrl,
    city: capText(site.business_info?.city, 80),
    booking_mode: bookingMode,
    modal_theme: typeof cfg.modal_theme === 'string' ? cfg.modal_theme.slice(0, 20) : 'light',
    welcome_text: capText(cfg.welcome_text, 600) || "Tell us about your car and we'll be in touch.",
    button_label: capText(cfg.button_label, 40) || 'Book Now',
    lead_time_hours: normalizeLeadHours(cfg.lead_time_hours),
    slot_granularity_minutes: normalizeGranularity(cfg.slot_granularity_minutes),
    cta_selector: capText(cfg.cta_selector, 200),
    cancellation_policy: capText(cfg.cancellation_policy, 5000),
    // The shop's date, for the calendar's "past" days (the visitor's own
    // clock may be in another zone or wrong).
    timezone: timeZone,
    today: shopTodayISO(timeZone, now),
    vehicle_types: vehicleTypes.map((t) => ({ id: t.id, name: t.name })),
    services: enabledServices.map((s) => {
      const cents = servicePriceCents(s);
      const enabledAddons = Array.isArray(s.addons)
        ? s.addons
            .filter((a) => a && a.enabled !== false && typeof a.name === 'string' && a.name.trim() !== '')
            .map((a) => {
              const base = {
                id: a.id,
                name: a.name,
                price_cents: typeof a.price_cents === 'number' && a.price_cents > 0 ? a.price_cents : 0,
              };
              if (a.prices && typeof a.prices === 'object' && !Array.isArray(a.prices)) {
                // An add-on whose prices only reference vehicle types the
                // owner no longer offers can't be booked anywhere — dropping
                // the map would make the widget treat it as legacy (offered
                // everywhere) and the server would 400 at submit. Drop the
                // add-on entirely instead. But when NO vehicle types are
                // enabled (legacy flow), the server books it at its legacy
                // price — keep it as a plain legacy add-on.
                const filtered = pickVehicleKeys(a.prices, vehicleTypeIds);
                if (Object.keys(filtered).length === 0) return vehicleTypes.length > 0 ? null : base;
                return { ...base, prices: filtered };
              }
              return base;
            })
            .filter(Boolean)
        : [];
      return {
        id: s.id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price ?? (cents != null ? formatCents(cents) : ''),
        price_cents: cents,
        description: s.description ?? '',
        ...(s.variants && typeof s.variants === 'object' && !Array.isArray(s.variants)
          ? (() => {
              const filtered = pickVehicleKeys(s.variants, vehicleTypeIds);
              return Object.keys(filtered).length > 0 ? { variants: filtered } : {};
            })()
          : {}),
        addons: enabledAddons,
      };
    }),
    availability: cfg.availability || {},
  };
}
