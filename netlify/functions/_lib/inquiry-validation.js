const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_NAME = 200;
const MAX_PHONE = 40;
const MAX_MESSAGE = 5000;

export function validateInquiryPayload(p) {
  if (!p || typeof p !== 'object') return fail('Payload must be an object');

  // Honeypot — if filled, reject silently (caller should 200 and drop).
  if (typeof p.website === 'string' && p.website.trim() !== '') {
    return { ok: false, honeypot: true, error: 'honeypot' };
  }

  if (!p.siteId || !UUID_RE.test(p.siteId)) return fail('Invalid siteId');

  if (!isNonEmptyString(p.name)) return fail('Missing required field: name');
  if (p.name.length > MAX_NAME) return fail('name too long');

  if (!isNonEmptyString(p.email)) return fail('Missing required field: email');
  if (!EMAIL_RE.test(p.email)) return fail('Invalid email');

  if (!isNonEmptyString(p.message)) return fail('Missing required field: message');
  if (p.message.length > MAX_MESSAGE) return fail('message too long');

  if (p.phone != null && p.phone !== '') {
    if (typeof p.phone !== 'string' || p.phone.length > MAX_PHONE) {
      return fail('Invalid phone');
    }
  }

  return { ok: true };
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function fail(error) { return { ok: false, error }; }
