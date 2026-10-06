const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VEHICLE_SIZES = ['sedan','suv','truck','van','other'];
const REQUIRED = [
  'siteId','customer_name','customer_email','customer_phone',
  'preferred_at','vehicle_make','vehicle_model','vehicle_year','vehicle_size',
];

// The widget shows `error` to the customer, so missing fields read as
// requests, not field names.
const MISSING_MESSAGES = {
  siteId: 'Missing required field: siteId',
  customer_name: 'Please enter your name.',
  customer_email: 'Please enter your email.',
  customer_phone: 'Please enter your phone number.',
  preferred_at: 'Please pick a time.',
  vehicle_make: 'Please enter your vehicle make.',
  vehicle_model: 'Please enter your vehicle model.',
  vehicle_year: 'Please enter your vehicle year.',
  vehicle_size: 'Please pick your vehicle size.',
};

// Longest value each text field may hold: generous for real customers, but
// a scripted request can't store (and email to the owner and to whatever
// address it typed) megabytes of text. Anything that isn't a string is
// refused too: an object would be stored as its JSON.
export const FIELD_LIMITS = {
  customer_name: 100,
  customer_email: 254,
  customer_phone: 40,
  vehicle_make: 60,
  vehicle_model: 60,
  service_address: 300,
  notes: 2000,
  referral_source: 200,
  preferred_time_text: 200,
  service_id: 100,
  vehicle_type_id: 100,
};
const FIELD_LABELS = {
  customer_name: 'Name',
  customer_email: 'Email',
  customer_phone: 'Phone',
  vehicle_make: 'Make',
  vehicle_model: 'Model',
  service_address: 'Service address',
  notes: 'Notes',
  referral_source: '"How did you hear about us?"',
  preferred_time_text: 'Preferred time',
};
const MAX_ADDONS = 25;

const HOUR_MS = 3600 * 1000;

export function validateBookingPayload(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return fail('Payload must be an object');

  // Honeypot — if filled, reject silently (caller should 200 and drop).
  if (typeof p.website === 'string' && p.website.trim() !== '') {
    return { ok: false, honeypot: true, error: 'honeypot' };
  }

  for (const key of REQUIRED) {
    const v = p[key];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      return fail(MISSING_MESSAGES[key] || `Missing required field: ${key}`);
    }
  }

  for (const [key, max] of Object.entries(FIELD_LIMITS)) {
    const v = p[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') return fail(`Invalid ${key}`);
    if (v.length > max) {
      return fail(`${FIELD_LABELS[key] || key} is too long (${max} characters at most).`);
    }
  }

  if (typeof p.siteId !== 'string' || !UUID_RE.test(p.siteId)) return fail('Invalid siteId');
  if (!EMAIL_RE.test(p.customer_email)) return fail('Please enter a valid email address.');

  const year = Number(p.vehicle_year);
  if (typeof p.vehicle_year === 'boolean' || !Number.isInteger(year) || year < 1900 || year > 2100) {
    return fail('Please enter a valid vehicle year.');
  }

  if (!VEHICLE_SIZES.includes(p.vehicle_size)) {
    return fail(`Invalid vehicle_size (must be one of ${VEHICLE_SIZES.join(', ')})`);
  }

  if (p.addon_ids !== undefined && p.addon_ids !== null) {
    if (!Array.isArray(p.addon_ids) || p.addon_ids.length > MAX_ADDONS
        || p.addon_ids.some((id) => typeof id !== 'string' || id === '' || id.length > 100)) {
      return fail('Invalid addon_ids');
    }
  }

  // preferred_at is the shop's wall-clock time written as UTC (slot-math.js),
  // so it can read up to 14 hours behind the real instant (UTC-14) without
  // being in the past at the shop. create-booking does the exact check with
  // the shop's zone and lead time; this only drops junk.
  if (typeof p.preferred_at !== 'string') return fail('Invalid preferred_at');
  const when = Date.parse(p.preferred_at);
  if (Number.isNaN(when)) return fail('Invalid preferred_at');
  if (when <= Date.now() - 14 * HOUR_MS) return fail('preferred_at must be in the future');

  return { ok: true };
}

function fail(error) { return { ok: false, error }; }
