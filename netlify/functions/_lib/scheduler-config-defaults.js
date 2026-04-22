import { randomUUID } from 'node:crypto';

const DEFAULT_HOURS = [{ start: '09:00', end: '17:00' }];

export function defaultSchedulerConfig() {
  return {
    welcome_text: "Tell us about your car and we'll be in touch.",
    button_label: 'Book Now',
    lead_time_hours: 24,
    slot_granularity_minutes: 30,
    services: [],
    availability: {
      mon: [...DEFAULT_HOURS],
      tue: [...DEFAULT_HOURS],
      wed: [...DEFAULT_HOURS],
      thu: [...DEFAULT_HOURS],
      fri: [...DEFAULT_HOURS],
      sat: [],
      sun: [],
    },
  };
}

function newServiceId() {
  return 'svc_' + randomUUID().replace(/-/g, '').slice(0, 12);
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

  for (const seeded of newlySeeded) {
    if (!existingByName.has(seeded.name)) {
      result.push(seeded);
    }
  }
  return result;
}
