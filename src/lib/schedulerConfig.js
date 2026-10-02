import { supabase } from './supabase.js';

const DEFAULT_HOURS = [{ start: '09:00', end: '17:00' }];

// Mirror of netlify/functions/_lib/deposit-math.js parsePriceToCents.
// Kept inline so the dashboard bundle doesn't need to import server-only code.
export function parseDollarsToCents(input) {
  if (input == null) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0 ? Math.round(input * 100) : null;
  }
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[\s$,]/g, '');
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?/);
  if (!match) return null;
  const dollars = parseInt(match[1], 10);
  const fractional = match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0;
  const cents = dollars * 100 + fractional;
  return cents > 0 ? cents : null;
}

export function formatCentsAsDisplay(cents) {
  if (typeof cents !== 'number' || cents <= 0) return '';
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

const APPEARANCE_ENUMS = {
  page_style: ['branded', 'minimal'],
  background: ['light', 'dark', 'image'],
  corner_style: ['rounded', 'sharp'],
};

export function defaultAppearance() {
  return {
    page_style: 'branded',
    accent_color: '#1a1a1a',
    background: 'light',
    background_image_url: '',
    corner_style: 'rounded',
    font: 'Inter',
    logo_url: '',
    tagline: '',
  };
}

export function normalizeAppearance(input) {
  const base = defaultAppearance();
  if (!input || typeof input !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(base)) {
    const val = input[key];
    if (val == null) continue;
    if (APPEARANCE_ENUMS[key]) {
      if (APPEARANCE_ENUMS[key].includes(val)) out[key] = val;
    } else if (typeof val === 'string') {
      out[key] = val;
    }
  }
  return out;
}

export function defaultSchedulerConfig() {
  return {
    welcome_text: "Tell us about your car and we'll be in touch.",
    button_label: 'Book Now',
    lead_time_hours: 24,
    slot_granularity_minutes: 30,
    deposit_percentage: 0,
    cta_selector: '',
    cancellation_policy: '',
    services: [],
    vehicle_types: defaultVehicleTypes(),
    appearance: defaultAppearance(),
    availability: {
      mon: [...DEFAULT_HOURS], tue: [...DEFAULT_HOURS], wed: [...DEFAULT_HOURS],
      thu: [...DEFAULT_HOURS], fri: [...DEFAULT_HOURS], sat: [], sun: [],
    },
  };
}

function newServiceId() {
  return 'svc_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
}

export function newAddonId() {
  return 'add_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
}

// Mirror of netlify/functions/_lib/vehicle-pricing.js (dashboard copy —
// same reason parseDollarsToCents is mirrored). One deliberate difference:
// the editor seeds the default list when the config has none, while the
// server-side normalizeVehicleTypes returns [] so the public widget never
// sees vehicle types the owner hasn't saved.
export const DEFAULT_VEHICLE_TYPE_NAMES = [
  'Sedan', 'SUV/Crossover', 'Truck', 'Van/Minivan', 'Motorcycle', 'Other',
];

export function newVehicleTypeId() {
  return 'vt_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
}

export function defaultVehicleTypes() {
  return DEFAULT_VEHICLE_TYPE_NAMES.map((name) => ({ id: newVehicleTypeId(), name, enabled: true }));
}

export function normalizeVehicleTypes(input) {
  if (!Array.isArray(input) || input.length === 0) return defaultVehicleTypes();
  const cleaned = input
    .filter((t) => t && typeof t.id === 'string' && t.id.trim() !== '' && typeof t.name === 'string' && t.name.trim() !== '')
    .map((t) => ({ id: t.id, name: t.name.trim(), enabled: t.enabled !== false }));
  return cleaned.length > 0 ? cleaned : defaultVehicleTypes();
}

// Mirror of netlify/functions/_lib/vehicle-pricing.js resolveVariant.
// { price_cents, duration_minutes } the given vehicle books this service at,
// or null when the service is not offered for that vehicle. No vehicleTypeId
// (or no variants map) falls back to the base fields; legacy text prices parse.
export function resolveVariant(service, vehicleTypeId) {
  if (!service) return null;
  const baseCents =
    typeof service.price_cents === 'number' && service.price_cents > 0
      ? service.price_cents
      : parseDollarsToCents(service.price);
  const base = {
    price_cents: baseCents ?? null,
    duration_minutes:
      typeof service.duration_minutes === 'number' && service.duration_minutes > 0
        ? service.duration_minutes
        : 60,
  };
  if (!vehicleTypeId || !service.variants || typeof service.variants !== 'object') return base;
  const v = service.variants[vehicleTypeId];
  if (!v) return base;
  if (v.enabled === false) return null;
  return {
    price_cents: typeof v.price_cents === 'number' && v.price_cents > 0 ? v.price_cents : base.price_cents,
    duration_minutes:
      typeof v.duration_minutes === 'number' && v.duration_minutes > 0 ? v.duration_minutes : base.duration_minutes,
  };
}

// Mirror of netlify/functions/_lib/vehicle-pricing.js addonPriceForVehicle.
// Cents (>= 0) when the add-on is offered for that vehicle, else null.
export function addonPriceForVehicle(addon, vehicleTypeId) {
  if (!addon) return null;
  const legacy = typeof addon.price_cents === 'number' && addon.price_cents > 0 ? addon.price_cents : 0;
  if (!vehicleTypeId || !addon.prices || typeof addon.prices !== 'object') return legacy;
  const p = addon.prices[vehicleTypeId];
  if (p == null) return null;
  return typeof p === 'number' && p > 0 ? p : 0;
}

// Mirror of the server's enabledVehicleTypes: the vehicle types the owner
// saved and left on. Unlike normalizeVehicleTypes it never seeds defaults,
// because prices can only be looked up for ids the config really has.
export function savedVehicleTypes(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t) => t && t.enabled !== false && typeof t.id === 'string' && t.id.trim() !== ''
      && typeof t.name === 'string' && t.name.trim() !== '')
    .map((t) => ({ id: t.id, name: t.name.trim(), enabled: true }));
}

export function seedServicesFromBusinessInfo(bizServices) {
  if (!Array.isArray(bizServices)) return [];
  return bizServices
    .filter((s) => s && typeof s.name === 'string' && s.name.trim() !== '')
    .map((s) => {
      const cents = parseDollarsToCents(s.price);
      return {
        id: newServiceId(),
        name: String(s.name),
        duration_minutes: 60,
        price: s.price ?? '',
        price_cents: cents,
        description: s.description ?? '',
        enabled: true,
        addons: [],
      };
    });
}

// Bring an existing service forward into the new shape — fills price_cents
// from the legacy text and guarantees an addons[] array. When vehicleTypes
// is provided (the editor), also materializes a variant per vehicle type and
// a per-vehicle price map per add-on so every editor cell has a value.
// Explicit nulls in addon prices mean "not offered" and are preserved.
// Idempotent.
export function normalizeService(service, vehicleTypes) {
  if (!service || typeof service !== 'object') return service;
  const out = { ...service };
  if (typeof out.price_cents !== 'number' || out.price_cents <= 0) {
    const parsed = parseDollarsToCents(out.price);
    if (parsed != null) out.price_cents = parsed;
  }
  const hasTypes = Array.isArray(vehicleTypes) && vehicleTypes.length > 0;
  if (!Array.isArray(out.addons)) out.addons = [];
  out.addons = out.addons
    .filter((a) => a && typeof a.name === 'string')
    .map((a) => {
      const addon = {
        id: a.id || newAddonId(),
        name: String(a.name),
        price_cents: typeof a.price_cents === 'number' && a.price_cents > 0 ? a.price_cents : 0,
        enabled: a.enabled !== false,
      };
      if (hasTypes) {
        const prices = {};
        for (const t of vehicleTypes) {
          const existing = a.prices && typeof a.prices === 'object' ? a.prices[t.id] : undefined;
          prices[t.id] = existing !== undefined ? existing : addon.price_cents;
        }
        addon.prices = prices;
      } else if (a.prices && typeof a.prices === 'object') {
        addon.prices = { ...a.prices };
      }
      return addon;
    });
  if (hasTypes) {
    const variants = {};
    for (const t of vehicleTypes) {
      const v = (out.variants && typeof out.variants === 'object' && out.variants[t.id]) || null;
      variants[t.id] = {
        enabled: v ? v.enabled !== false : true,
        price_cents:
          v && typeof v.price_cents === 'number' && v.price_cents > 0
            ? v.price_cents
            : (typeof out.price_cents === 'number' && out.price_cents > 0 ? out.price_cents : null),
        duration_minutes:
          v && typeof v.duration_minutes === 'number' && v.duration_minutes > 0
            ? v.duration_minutes
            : (typeof out.duration_minutes === 'number' && out.duration_minutes > 0 ? out.duration_minutes : 60),
      };
    }
    out.variants = variants;
  }
  return out;
}

function businessServiceNames(bizServices) {
  if (!Array.isArray(bizServices)) return [];
  const names = bizServices
    .filter((s) => s && typeof s.name === 'string' && s.name.trim() !== '')
    .map((s) => s.name.trim());
  return [...new Set(names)];
}

const serviceKey = (name) => String(name || '').trim().toLowerCase();

// Offers each website service (business_info.services) to the booking
// menu once. `seeded_service_names` records every website service name
// already offered, so one the owner deleted or renamed in Booking settings
// stays gone; the old merge re-added it, enabled and bookable, on every load.
// A service added to the website later is still offered once.
//
// Set-up configs (availability and a services list) saved before this
// marker existed went through that every-load merge, so each current
// website service was offered already: any of them missing from the menu
// was removed by the owner. They are recorded without re-adding anything.
// A config that was never set up has nothing to protect and is offered
// everything. Pass the STORED config (or {}), never defaultSchedulerConfig(),
// whose availability would make an unsaved config look set up.
//
// Returns { services, seeded_service_names, changed }.
export function syncServicesFromBusinessInfo(config, bizServices) {
  const cfg = config || {};
  const existing = Array.isArray(cfg.services) ? cfg.services : [];
  const names = businessServiceNames(bizServices);
  let prior = Array.isArray(cfg.seeded_service_names) ? cfg.seeded_service_names : null;

  if (!prior && cfg.availability && Array.isArray(cfg.services)) {
    return { services: existing, seeded_service_names: names, changed: true };
  }
  if (!prior) prior = [];

  const offered = new Set(prior.map(serviceKey));
  const onMenu = new Set(existing.map((s) => serviceKey(s && s.name)));
  const fresh = names.filter((n) => !offered.has(serviceKey(n)));
  if (fresh.length === 0) {
    return { services: existing, seeded_service_names: prior, changed: false };
  }
  const added = seedServicesFromBusinessInfo(
    fresh.filter((n) => !onMenu.has(serviceKey(n)))
      .map((n) => bizServices.find((s) => s && typeof s.name === 'string' && s.name.trim() === n)),
  );
  return {
    services: [...existing, ...added],
    seeded_service_names: [...prior, ...fresh],
    changed: true,
  };
}

export async function loadSchedulerConfig(siteId) {
  const { data, error } = await supabase
    .from('sites')
    .select('scheduler_enabled, scheduler_config, business_info, published_url, site_type, slug, custom_domain, custom_domain_status')
    .eq('id', siteId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveSchedulerConfig(siteId, patch) {
  const { data: current } = await supabase
    .from('sites').select('scheduler_config').eq('id', siteId).maybeSingle();
  const next = { ...(current?.scheduler_config || {}), ...patch };
  const { data, error } = await supabase
    .from('sites')
    .update({ scheduler_config: next, updated_at: new Date().toISOString() })
    .eq('id', siteId).select().single();
  if (error) throw error;
  return data.scheduler_config;
}

export async function setSchedulerEnabled(siteId, enabled) {
  const { data, error } = await supabase
    .from('sites').update({ scheduler_enabled: enabled, updated_at: new Date().toISOString() }).eq('id', siteId).select().single();
  if (error) throw error;
  return data;
}

export async function initializeSchedulerConfig(siteId) {
  const { data: site } = await supabase
    .from('sites').select('scheduler_config, business_info').eq('id', siteId).maybeSingle();
  const existing = site?.scheduler_config || {};
  if (existing.availability && existing.services) return existing;
  // Booking settings work while bookings are off, so keep what the owner
  // already saved there (menu, vehicle types the prices are keyed to,
  // appearance, ...) and fill the rest with defaults; this used to reset it
  // all. The website's services join the menu once (see
  // syncServicesFromBusinessInfo), so ones deleted before switching bookings
  // on stay deleted.
  const sync = syncServicesFromBusinessInfo(existing, site?.business_info?.services);
  const saved = Object.fromEntries(Object.entries(existing).filter(([, v]) => v != null));
  const config = {
    ...defaultSchedulerConfig(),
    ...saved,
    services: sync.services,
    seeded_service_names: sync.seeded_service_names,
  };
  return saveSchedulerConfig(siteId, config);
}
