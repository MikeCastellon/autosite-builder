// Free websites (Admin > Free websites): a team member builds a customer's
// site with the normal builder, in their own account, then hands it to the
// customer's account. The pure parts, shared by the free-site-admin
// function, the Admin tab and the builder. No supabase import.

// business_info key that marks a site built for a free-website row (the
// row's id). It does what customProjectId does for a custom website: the
// builder's own review widgets stay off the site, the site publishes on the
// free plan, and free-site-admin links the site to its row. The hand-over
// removes it.
export const FREE_SITE_MARKER = 'freeSiteId';

// A site the team is building for a customer, in a team member's account.
export function builtForCustomer(businessInfo) {
  return !!(businessInfo?.customProjectId || businessInfo?.[FREE_SITE_MARKER]);
}

// Publishing decides the free-plan badge and fonts by the signed-in
// account's plan. A free website is built in a team member's (Pro) account
// but goes to a free account, so it publishes as the free plan until the
// hand-over takes the marker off.
export function publishesAsPro(businessInfo, isPro) {
  return !!isPro && !businessInfo?.[FREE_SITE_MARKER];
}

// Where a row stands: no site yet, a site being built (in the team's
// account), or in the customer's account.
export function freeSiteStatus(row) {
  if (row?.handed_over_at) return 'handed_over';
  if (row?.site) return 'building';
  return 'not_started';
}

export const FREE_SITE_STATUS_LABELS = {
  not_started: 'Not started',
  building: 'Building',
  handed_over: 'Handed over',
};

export function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

function clean(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// The customer's details as the admin typed them. Returns { values } with
// the row's column names, or { error }. `partial`: only the fields present
// in `input` (an edit), and only checked when present.
export function sanitizeCustomer(input = {}, { partial = false } = {}) {
  const has = (k) => !partial || Object.prototype.hasOwnProperty.call(input, k);
  const values = {};
  if (has('firstName')) {
    const first = clean(input.firstName, 80);
    if (!first) return { error: 'First name is required' };
    values.client_first_name = first;
  }
  if (has('lastName')) values.client_last_name = clean(input.lastName, 80) || null;
  if (has('email')) {
    const email = clean(input.email, 200).toLowerCase();
    if (!isEmail(email)) return { error: 'A valid email is required' };
    values.client_email = email;
  }
  if (has('phone')) values.client_phone = clean(input.phone, 40) || null;
  if (has('businessName')) values.business_name = clean(input.businessName, 120) || null;
  if (has('note')) values.note = clean(input.note, 2000);
  return { values };
}

// The builder's starting point for a row: what the admin already knows,
// plus the marker that ties the new site to the row.
export function freeSiteBusinessInfo(row) {
  const info = { [FREE_SITE_MARKER]: row.id };
  if (row.business_name) info.businessName = row.business_name;
  if (row.client_phone) info.phone = row.client_phone;
  return info;
}

export function customerName(row) {
  return [row?.client_first_name, row?.client_last_name].filter(Boolean).join(' ');
}
