// The shop's clock, for lead time and "is this in the past". Shared by the
// booking functions (netlify/functions/_lib/shop-time.js) and Booking
// Settings, so both name the same zone for a site. Pure: Intl only.
//
// bookings.preferred_at and every availability window are the shop's
// wall-clock time written as UTC: a 9:00 window yields "…T09:00:00.000Z"
// (slot-math.js, src/lib/bookings.js). So "now" must be read the same way,
// as the shop's wall clock written as UTC. Comparing those times with the
// real instant Date.now() made Florida shops (UTC-4) look 4 hours further
// ahead than they are: the first 4 hours of slots after every lead-time
// boundary were hidden (next-day mornings, with the default 24 hours) and
// same-day booking was impossible.
//
// The zone is scheduler_config.timezone when the owner picked one on the
// Availability tab, else the business state's zone, else America/New_York
// (every shop live today is in Florida or Puerto Rico). Never the browser's
// zone: admins set up and edit shops from other time zones.

export const DEFAULT_SHOP_TIME_ZONE = 'America/New_York';

// Best single zone per US state or territory (most of the population).
const STATE_ZONES = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix',
  AR: 'America/Chicago', CA: 'America/Los_Angeles', CO: 'America/Denver',
  CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu',
  ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago', KS: 'America/Chicago', KY: 'America/New_York',
  LA: 'America/Chicago', ME: 'America/New_York', MD: 'America/New_York',
  MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago',
  MS: 'America/Chicago', MO: 'America/Chicago', MT: 'America/Denver',
  NE: 'America/Chicago', NV: 'America/Los_Angeles', NH: 'America/New_York',
  NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York',
  NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York',
  RI: 'America/New_York', SC: 'America/New_York', SD: 'America/Chicago',
  TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
  VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles',
  WV: 'America/New_York', WI: 'America/Chicago', WY: 'America/Denver',
  PR: 'America/Puerto_Rico', VI: 'America/St_Thomas', GU: 'Pacific/Guam',
};

// business_info.state holds "FL" on most sites and "Florida" on some.
const STATE_NAMES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'puerto rico': 'PR', 'virgin islands': 'VI', guam: 'GU',
};

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || tz === '' || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function stateCode(state) {
  const s = String(state || '').trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  if (STATE_ZONES[upper]) return upper;
  return STATE_NAMES[s.toLowerCase().replace(/\s+/g, ' ')] || null;
}

// The IANA zone a site's booking times are in.
export function resolveShopTimeZone(cfg, businessInfo) {
  if (isValidTimeZone(cfg?.timezone)) return cfg.timezone;
  const code = stateCode(businessInfo?.state);
  return (code && STATE_ZONES[code]) || DEFAULT_SHOP_TIME_ZONE;
}

// The shop's wall-clock time at `now` (ms), written as UTC milliseconds:
// the same form as preferred_at and slot times.
export function shopNowWallMs(timeZone, now = Date.now()) {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_SHOP_TIME_ZONE;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(now));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  // Some engines print midnight as hour 24 even with h23.
  const hour = get('hour') % 24;
  return Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
}

// "YYYY-MM-DD" of today at the shop.
export function shopTodayISO(timeZone, now = Date.now()) {
  return new Date(shopNowWallMs(timeZone, now)).toISOString().slice(0, 10);
}
