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
// from the legacy text and guarantees an addons[] array. Idempotent.
export function normalizeService(service) {
  if (!service || typeof service !== 'object') return service;
  const out = { ...service };
  if (typeof out.price_cents !== 'number' || out.price_cents <= 0) {
    const parsed = parseDollarsToCents(out.price);
    if (parsed != null) out.price_cents = parsed;
  }
  if (!Array.isArray(out.addons)) out.addons = [];
  out.addons = out.addons
    .filter((a) => a && typeof a.name === 'string')
    .map((a) => ({
      id: a.id || newAddonId(),
      name: String(a.name),
      price_cents: typeof a.price_cents === 'number' && a.price_cents > 0 ? a.price_cents : 0,
      enabled: a.enabled !== false,
    }));
  return out;
}

export function mergeServicesFromBusinessInfo(existing, bizServices) {
  const existingByName = new Map((existing || []).map((s) => [s.name, s]));
  const newlySeeded = seedServicesFromBusinessInfo(bizServices);
  const result = [...(existing || [])];
  for (const s of newlySeeded) {
    if (!existingByName.has(s.name)) result.push(s);
  }
  return result;
}

export async function loadSchedulerConfig(siteId) {
  const { data, error } = await supabase
    .from('sites')
    .select('scheduler_enabled, scheduler_config, business_info, published_url, site_type, custom_domain, custom_domain_status')
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
  const config = {
    ...defaultSchedulerConfig(),
    services: seedServicesFromBusinessInfo(site?.business_info?.services),
  };
  return saveSchedulerConfig(siteId, config);
}
