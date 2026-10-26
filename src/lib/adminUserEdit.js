// Admin user drawer > Account > Edit: a super admin corrects a customer's
// name, email, phone or business name (a typo made at a hand-over or at
// sign-up). The pure parts, shared by the drawer and the admin-user-update
// function. No supabase import.
import { isEmail } from './freeSiteHandover.js';

// Form key -> profiles column. Max lengths match the hand-over form
// (sanitizeCustomer), where most of these values were first typed.
export const ACCOUNT_FIELDS = [
  { key: 'firstName', column: 'first_name', max: 80 },
  { key: 'lastName', column: 'last_name', max: 80 },
  { key: 'email', column: 'email', max: 200 },
  { key: 'phone', column: 'phone', max: 40 },
  { key: 'businessName', column: 'business_name', max: 120 },
];

// The form's starting values for a profiles row.
export function accountForm(profile = {}) {
  const form = {};
  for (const f of ACCOUNT_FIELDS) form[f.key] = profile[f.column] || '';
  return form;
}

const lower = (v) => String(v ?? '').trim().toLowerCase();

// The profile columns the form changes, compared with `current` (a
// profiles row). Only the keys present in `input` count, so a partial body
// leaves the rest alone. Returns { changes } (empty when nothing differs)
// or { error }.
export function accountChanges(input = {}, current = {}) {
  const changes = {};
  for (const f of ACCOUNT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, f.key)) continue;
    const raw = input[f.key];
    if (raw != null && typeof raw !== 'string') return { error: 'Invalid value' };
    let value = (raw || '').trim().slice(0, f.max);
    if (f.column === 'email') {
      value = value.toLowerCase();
      // The email is the sign-in address: it can be corrected, never cleared.
      if (!isEmail(value)) return { error: 'Enter a valid email' };
      if (value !== lower(current.email)) changes.email = value;
      continue;
    }
    const next = value || null;
    if (next !== (current[f.column] || null)) changes[f.column] = next;
  }
  return { changes };
}

// Free-website and custom-website rows tied to the account keep the
// details the team typed for the hand-over. A field that still holds the
// account's old value is the same typo and takes the new one; a field the
// team set to something else on purpose stays. A cleared value is not
// copied (the rows require a first name and an email).
const ROW_COLUMNS = {
  first_name: 'client_first_name',
  last_name: 'client_last_name',
  email: 'client_email',
  phone: 'client_phone',
  business_name: 'business_name',
};

export function handoverRowPatch(row = {}, before = {}, changes = {}) {
  const patch = {};
  for (const [column, value] of Object.entries(changes)) {
    const rowColumn = ROW_COLUMNS[column];
    if (!rowColumn || !value) continue;
    const old = column === 'email' ? lower(before[column]) : String(before[column] ?? '').trim();
    const held = column === 'email' ? lower(row[rowColumn]) : String(row[rowColumn] ?? '').trim();
    if (old && held === old) patch[rowColumn] = value;
  }
  return patch;
}
