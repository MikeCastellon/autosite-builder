const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VEHICLE_SIZES = ['sedan','suv','truck','van','other'];
const REQUIRED = [
  'siteId','customer_name','customer_email','customer_phone',
  'preferred_at','vehicle_make','vehicle_model','vehicle_year','vehicle_size',
];

export function validateBookingPayload(p) {
  if (!p || typeof p !== 'object') return fail('Payload must be an object');

  // Honeypot — if filled, reject silently (caller should 200 and drop).
  if (typeof p.website === 'string' && p.website.trim() !== '') {
    return { ok: false, honeypot: true, error: 'honeypot' };
  }

  for (const key of REQUIRED) {
    if (p[key] === undefined || p[key] === null || p[key] === '') {
      return fail(`Missing required field: ${key}`);
    }
  }

  if (!UUID_RE.test(p.siteId)) return fail('Invalid siteId');
  if (!EMAIL_RE.test(p.customer_email)) return fail('Invalid customer_email');

  const year = Number(p.vehicle_year);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return fail('Invalid vehicle_year');
  }

  if (!VEHICLE_SIZES.includes(p.vehicle_size)) {
    return fail(`Invalid vehicle_size (must be one of ${VEHICLE_SIZES.join(', ')})`);
  }

  const when = Date.parse(p.preferred_at);
  if (Number.isNaN(when)) return fail('Invalid preferred_at');
  if (when <= Date.now()) return fail('preferred_at must be in the future');

  return { ok: true };
}

function fail(error) { return { ok: false, error }; }
