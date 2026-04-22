import { supabase } from './supabase.js';

const DEFAULT_HOURS = [{ start: '09:00', end: '17:00' }];

export function defaultSchedulerConfig() {
  return {
    welcome_text: "Tell us about your car and we'll be in touch.",
    button_label: 'Book Now',
    lead_time_hours: 24,
    slot_granularity_minutes: 30,
    services: [],
    availability: {
      mon: [...DEFAULT_HOURS], tue: [...DEFAULT_HOURS], wed: [...DEFAULT_HOURS],
      thu: [...DEFAULT_HOURS], fri: [...DEFAULT_HOURS], sat: [], sun: [],
    },
  };
}

function newServiceId() {
  return 'svc_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
}

export function seedServicesFromBusinessInfo(bizServices) {
  if (!Array.isArray(bizServices)) return [];
  return bizServices
    .filter((s) => s && typeof s.name === 'string' && s.name.trim() !== '')
    .map((s) => ({
      id: newServiceId(),
      name: String(s.name),
      duration_minutes: 60,
      price: s.price ?? '',
      description: s.description ?? '',
      enabled: true,
    }));
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
    .from('sites').select('scheduler_enabled, scheduler_config, business_info').eq('id', siteId).maybeSingle();
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
