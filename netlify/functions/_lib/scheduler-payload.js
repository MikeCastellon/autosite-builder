import { servicePriceCents } from './deposit-math.js';
import { normalizeAppearance } from './appearance.js';
import { enabledVehicleTypes } from './vehicle-pricing.js';

function formatCents(cents) {
  if (typeof cents !== 'number' || cents <= 0) return '';
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

const TEMPLATE_FALLBACK_COLORS = { default: '#1a1a1a' };

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
// No DB / network — unit testable.
export function buildSchedulerPayload(site) {
  const businessName = site.business_info?.businessName || 'Book Now';
  const customColors = site.generated_content?._customColors || {};
  const brandColor =
    customColors.primary ||
    customColors.accent ||
    TEMPLATE_FALLBACK_COLORS[site.template_id] ||
    TEMPLATE_FALLBACK_COLORS.default;

  const cfg = site.scheduler_config || {};
  const appearance = normalizeAppearance(cfg.appearance);
  const vehicleTypes = enabledVehicleTypes(cfg.vehicle_types);
  const vehicleTypeIds = new Set(vehicleTypes.map((t) => t.id));
  const enabledServices = (cfg.services || []).filter((s) => s.enabled !== false);
  const siteLogo = site.generated_content?._images?.logo || null;
  const logoUrl = appearance.logo_url || cfg.logo_url || siteLogo || null;

  return {
    enabled: true,
    site_type: site.site_type || 'website',
    businessName,
    brandColor,
    appearance,
    logo_url: logoUrl,
    city: site.business_info?.city || '',
    booking_mode: cfg.booking_mode === 'simple' ? 'simple' : 'full',
    modal_theme: cfg.modal_theme || 'light',
    welcome_text: cfg.welcome_text || "Tell us about your car and we'll be in touch.",
    button_label: cfg.button_label || 'Book Now',
    lead_time_hours: cfg.lead_time_hours ?? 24,
    slot_granularity_minutes: cfg.slot_granularity_minutes ?? 30,
    cta_selector: cfg.cta_selector || '',
    cancellation_policy: cfg.cancellation_policy || '',
    vehicle_types: vehicleTypes.map((t) => ({ id: t.id, name: t.name })),
    services: enabledServices.map((s) => {
      const cents = servicePriceCents(s);
      const enabledAddons = Array.isArray(s.addons)
        ? s.addons
            .filter((a) => a && a.enabled !== false && typeof a.name === 'string' && a.name.trim() !== '')
            .map((a) => ({
              id: a.id,
              name: a.name,
              price_cents: typeof a.price_cents === 'number' && a.price_cents > 0 ? a.price_cents : 0,
              ...(a.prices && typeof a.prices === 'object' && !Array.isArray(a.prices)
                ? (() => {
                    const filtered = pickVehicleKeys(a.prices, vehicleTypeIds);
                    return Object.keys(filtered).length > 0 ? { prices: filtered } : {};
                  })()
                : {}),
            }))
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
