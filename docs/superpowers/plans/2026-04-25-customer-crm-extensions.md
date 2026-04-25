# Customer CRM Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Customers tab into a mini-CRM. Today it's read-only — customers only appear after they book through the public scheduler. This plan adds (1) a "+ Add Customer" form to manually create customer records with full contact + vehicle info, notes, and tags, and (2) a "+ Book This Customer" action on the detail page that lets the owner create bookings directly from the dashboard with no availability/lead-time checks (pure owner override). All existing features (history, tags/notes, CSV export, email composer) stay unchanged.

**Architecture:** `customer_profiles` becomes the canonical record for **manually-added** customers (currently unused — 0 rows; schema already has identity_key, notes, tags). We extend it with contact + vehicle columns. The Customers list merges two sources: the existing booking-derived customers (via `groupBookingsIntoCustomers`) and standalone `customer_profiles` rows whose identity_key doesn't appear in any booking yet. The identity_key algorithm from `src/lib/customerIdentity.js` stays the single source of truth so a manual customer who later books (or books-first-then-edits-profile) merges cleanly. `customer_metadata` continues as the notes+tags store for both manual and booked customers (keyed by identity_key — already works). A new `owner-create-booking` Netlify function inserts bookings bypassing public validation, status=`confirmed`, optionally fires the existing customer confirmation email.

**Tech Stack:** Supabase (Postgres + RLS), Netlify Functions (Node), React 19, existing Postmark helper, vitest for identity/merge logic.

**Depends on:** Existing customer system (identity grouping, detail page, metadata). No new external services.

**Out of scope:**
- Consolidating `customer_metadata` + `customer_profiles` (two tables with overlapping notes/tags columns). Left for a future clean-up — they don't conflict because they store different things here.
- Importing customers from CSV / contacts.
- SMS to customers.

**Existing facts locked in:**
- `customer_profiles` table exists (0 rows); columns: `id`, `owner_user_id`, `identity_key`, `notes`, `tags`, `created_at`, `updated_at`. RLS enabled.
- `customer_metadata` table is already used by the detail page for notes + tags; keyed by `(owner_user_id, identity_key)`. Works for both booked and manual.
- `src/lib/customerIdentity.js` → `identityKey({customer_email, customer_phone, customer_name})` is the single source of truth. Contacts fall back email → phone → name.
- `CustomersPage.jsx` already renders the list with search + CSV export; `CustomerDetailPage.jsx` shows contact info (from latest booking), booking history, notes, tags, email composer.
- Bookings table already has all booking fields including `service_id`, `service_name`, `deposit_status`, etc. Owner-created bookings can leave deposit fields null (deposit is a public-booking flow).
- Booking emails come from `netlify/functions/_lib/postmark.js`: `newBookingToOwner`, `bookingReceivedToCustomer`.
- `profiles.subscription_status` gating (`isEffectiveSchedulerActive`) protects the Customers feature via `SubscribeGate` — Pro-only.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `db/migrations/20260425_customer_profiles_contact.sql` | Extend `customer_profiles` with contact + vehicle columns + unique index on (owner_user_id, identity_key). |
| `src/lib/customerProfiles.js` | Client helpers: `listManualCustomers`, `getCustomerProfileByIdentityKey`, `createManualCustomer`, `updateManualCustomer`. |
| `src/components/dashboard/customers-page/AddCustomerModal.jsx` | Form modal — name, email, phone, vehicle fields, notes, tags. |
| `src/components/dashboard/customers-page/BookCustomerModal.jsx` | Form modal — service (from scheduler_config or free-text), date + time (datetime-local), vehicle fields (pre-filled), notes, checkbox "Email customer confirmation". |
| `netlify/functions/owner-create-booking.js` | Auth'd POST. Owner override: creates a booking with status=`confirmed`, skips availability/lead-time/slot checks. Optionally sends customer confirmation email. |

### Modified files

| Path | Change |
|---|---|
| `src/components/dashboard/customers-page/CustomersPage.jsx` | Add "+ Add Customer" button. Merge manual customers into the list. Adapt counts line to reflect both sources. |
| `src/components/dashboard/customers-page/CustomerDetailPage.jsx` | Support manual customers (no-bookings state with contact from `customer_profiles`). Add "+ Book This Customer" button that opens `BookCustomerModal`. |
| `src/lib/customerIdentity.js` | Add `makeCustomerLikeFromProfile(profile)` — shapes a `customer_profiles` row into the same object shape as `groupBookingsIntoCustomers` output so both can share list/detail rendering. |

---

## Task 1: Migration — extend customer_profiles

**Files:**
- Create: `db/migrations/20260425_customer_profiles_contact.sql`

- [ ] **Step 1: Write migration**

```sql
-- Manual customer records — extend customer_profiles with contact + vehicle
-- fields. Today the table is unused; this plan starts populating it with
-- manually-added customers whose identity_key doesn't overlap with any
-- existing booking.
-- Apply via Supabase SQL editor as the postgres role.

begin;

alter table public.customer_profiles
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_year smallint,
  add column if not exists vehicle_size text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customer_profiles_vehicle_size_check'
  ) then
    alter table public.customer_profiles
      add constraint customer_profiles_vehicle_size_check
      check (vehicle_size is null or vehicle_size in ('sedan','suv','truck','van','other'));
  end if;
end $$;

-- Enforce one profile per (owner, identity_key) so we never double-insert
-- when a customer is added twice.
create unique index if not exists customer_profiles_owner_identity_unique
  on public.customer_profiles (owner_user_id, identity_key);

commit;
```

- [ ] **Step 2: Apply** — controller applies via Supabase MCP.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/20260425_customer_profiles_contact.sql
git commit -m "feat(crm): extend customer_profiles with contact + vehicle fields"
```

---

## Task 2: Client helpers for customer_profiles

**Files:**
- Create: `src/lib/customerProfiles.js`

- [ ] **Step 1: Write the module**

```javascript
// src/lib/customerProfiles.js
import { supabase } from './supabase.js';
import { identityKey } from './customerIdentity.js';

// Columns we ever return/accept. Kept in one place so Supabase queries,
// the edit form, and the merged-list code can't drift apart.
const COLS = 'id, owner_user_id, identity_key, name, email, phone, vehicle_make, vehicle_model, vehicle_year, vehicle_size, notes, tags, created_at, updated_at';

export async function listManualCustomers({ ownerUserId }) {
  if (!ownerUserId) return [];
  const { data, error } = await supabase
    .from('customer_profiles')
    .select(COLS)
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getCustomerProfileByIdentityKey({ ownerUserId, key }) {
  if (!ownerUserId || !key) return null;
  const { data, error } = await supabase
    .from('customer_profiles')
    .select(COLS)
    .eq('owner_user_id', ownerUserId)
    .eq('identity_key', key)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Trim strings + compute identity_key so the caller doesn't have to.
// Returns the inserted row. Throws on duplicate identity (caller can catch
// to prompt "This customer already exists — open instead?").
export async function createManualCustomer({
  ownerUserId,
  name,
  email,
  phone,
  vehicleMake,
  vehicleModel,
  vehicleYear,
  vehicleSize,
  notes,
  tags,
}) {
  if (!ownerUserId) throw new Error('Missing owner');
  const cleanedName  = (name  || '').trim();
  const cleanedEmail = (email || '').trim().toLowerCase();
  const cleanedPhone = (phone || '').trim();
  if (!cleanedName && !cleanedEmail && !cleanedPhone) {
    throw new Error('At least one of name, email, or phone is required.');
  }
  const key = identityKey({ customer_email: cleanedEmail, customer_phone: cleanedPhone, customer_name: cleanedName });
  const cleanedTags = Array.isArray(tags)
    ? [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))]
    : [];

  const payload = {
    owner_user_id: ownerUserId,
    identity_key: key,
    name: cleanedName || null,
    email: cleanedEmail || null,
    phone: cleanedPhone || null,
    vehicle_make: (vehicleMake || '').trim() || null,
    vehicle_model: (vehicleModel || '').trim() || null,
    vehicle_year: vehicleYear ? Number(vehicleYear) : null,
    vehicle_size: vehicleSize || null,
    notes: (notes || '').trim() || null,
    tags: cleanedTags,
  };

  const { data, error } = await supabase
    .from('customer_profiles')
    .insert(payload)
    .select(COLS)
    .single();
  if (error) {
    // PG code 23505 = unique_violation → surface a friendlier message.
    if (error.code === '23505') {
      const err = new Error('A customer with this email / phone / name already exists.');
      err.code = 'duplicate';
      throw err;
    }
    throw error;
  }
  return data;
}

export async function updateManualCustomer({ id, patch }) {
  if (!id) throw new Error('Missing id');
  const { data, error } = await supabase
    .from('customer_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/customerProfiles.js
git commit -m "feat(crm): client helpers for manual customer profiles"
```

---

## Task 3: Identity-key helper to shape a manual customer like a booking-derived one

**Files:**
- Modify: `src/lib/customerIdentity.js`

- [ ] **Step 1: Append a new export to `src/lib/customerIdentity.js`**

At the end of the file:

```javascript
// Shape a customer_profiles row into the same object the list/detail pages
// expect from groupBookingsIntoCustomers. Keeps rendering logic shared.
export function makeCustomerLikeFromProfile(p) {
  return {
    key: p.identity_key,
    name: p.name || '(No name)',
    email: p.email || '',
    phone: p.phone || '',
    bookings: [],
    services: new Map(),
    siteIds: new Set(),
    firstBookedAt: null,
    lastBookedAt: null,
    nextUpcomingAt: null,
    // Marker the list uses to show a "Manual" badge and skip booking-only stats.
    isManual: true,
    profileId: p.id,
    createdAt: p.created_at,
    // Carry vehicle + notes through so the detail page can show them for
    // customers with no bookings yet.
    manualContact: {
      vehicleMake: p.vehicle_make || '',
      vehicleModel: p.vehicle_model || '',
      vehicleYear: p.vehicle_year || null,
      vehicleSize: p.vehicle_size || null,
      notes: p.notes || '',
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/customerIdentity.js
git commit -m "feat(crm): makeCustomerLikeFromProfile helper"
```

---

## Task 4: Merge manual customers into CustomersPage list

**Files:**
- Modify: `src/components/dashboard/customers-page/CustomersPage.jsx`

- [ ] **Step 1: Add imports + load manual profiles**

At the top of the file, import:
```javascript
import { listManualCustomers } from '../../../lib/customerProfiles.js';
import { makeCustomerLikeFromProfile } from '../../../lib/customerIdentity.js';
```

In the effect that fetches data, add a fourth parallel fetch:
```javascript
const [bookingsData, sitesRes, metaMap, manualProfiles] = await Promise.all([
  listBookingsForOwner({ userId }),
  supabase.from('sites').select('id, business_info').eq('user_id', userId),
  listCustomerMetadata({ ownerUserId: userId }),
  listManualCustomers({ ownerUserId: userId }),
]);
```

Add a state for the manual list:
```javascript
const [manualCustomers, setManualCustomers] = useState([]);
```

And inside the effect's success branch:
```javascript
setManualCustomers(manualProfiles || []);
```

- [ ] **Step 2: Merge into the customers memo**

Replace the `useMemo` that currently returns the grouped customers with one that merges booking-derived customers and manual profiles whose identity_key hasn't already appeared in a booking:

```javascript
const customers = useMemo(() => {
  const fromBookings = groupBookingsIntoCustomers(bookings);
  const bookedKeys = new Set(fromBookings.map((c) => c.key));
  const manualOnly = manualCustomers
    .filter((p) => !bookedKeys.has(p.identity_key))
    .map(makeCustomerLikeFromProfile);
  // Sort: booked customers first (by lastBookedAt desc), manual customers
  // after (by createdAt desc). Keeps the active pipeline visible.
  fromBookings.sort((a, b) => new Date(b.lastBookedAt) - new Date(a.lastBookedAt));
  manualOnly.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return [...fromBookings, ...manualOnly];
}, [bookings, manualCustomers]);
```

- [ ] **Step 3: Show a "Manual" badge on each manual row**

Where the row is rendered (find `<tr>` or `<li>` that iterates `filtered.map(...)`), next to the customer name add:

```jsx
{c.isManual && (
  <span className="ml-2 inline-flex items-center rounded-md bg-[#f4f3f0] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#888]">
    Manual
  </span>
)}
```

Match the existing row-cell styling; don't restructure the row.

- [ ] **Step 4: Update the counts line**

The subheading paragraph currently says `X customers · Y total bookings`. It's fine as-is since `customers.length` already reflects the merged total. No change needed.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/customers-page/CustomersPage.jsx
git commit -m "feat(crm): merge manual customer_profiles into customers list"
```

---

## Task 5: AddCustomerModal component

**Files:**
- Create: `src/components/dashboard/customers-page/AddCustomerModal.jsx`

- [ ] **Step 1: Write the modal**

```jsx
// src/components/dashboard/customers-page/AddCustomerModal.jsx
import { useState } from 'react';
import { createManualCustomer } from '../../../lib/customerProfiles.js';
import { saveCustomerMetadata } from '../../../lib/customers.js';

const VEHICLE_SIZES = [
  { id: '', label: 'Not specified' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'suv', label: 'SUV' },
  { id: 'truck', label: 'Truck' },
  { id: 'van', label: 'Van' },
  { id: 'other', label: 'Other' },
];

export default function AddCustomerModal({ ownerUserId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleSize, setVehicleSize] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const created = await createManualCustomer({
        ownerUserId,
        name,
        email,
        phone,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        vehicleSize,
        notes,
        tags,
      });
      // Also mirror notes+tags into customer_metadata so the detail page
      // picks them up via the existing read path.
      if (notes.trim() || tags.length > 0) {
        await saveCustomerMetadata({
          ownerUserId,
          identityKey: created.identity_key,
          notes,
          tags,
        }).catch(() => { /* non-fatal */ });
      }
      onCreated && onCreated(created);
    } catch (e) {
      setErr(e.message || 'Failed to create customer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight">Add customer</h2>
          <button type="button" onClick={onClose} className="text-[#888] hover:text-[#1a1a1a]" aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Name" required value={name} onChange={setName} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email" type="email" required value={email} onChange={setEmail} />
            <Field label="Phone" required value={phone} onChange={setPhone} />
          </div>

          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-2">Vehicle</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Make" required value={vehicleMake} onChange={setVehicleMake} />
              <Field label="Model" required value={vehicleModel} onChange={setVehicleModel} />
              <Field label="Year" required type="number" value={vehicleYear} onChange={setVehicleYear} />
              <div>
                <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Size</label>
                <select
                  value={vehicleSize}
                  onChange={(e) => setVehicleSize(e.target.value)}
                  className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
                >
                  {VEHICLE_SIZES.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="VIP, Referral, Monthly detail"
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
            />
          </div>

          {err && <p className="text-sm text-[#cc0000]">{err}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-semibold text-[#888] hover:text-[#1a1a1a]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-md text-sm font-semibold bg-[#cc0000] text-white hover:bg-[#b30000] disabled:opacity-60">
              {busy ? 'Saving…' : 'Add customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#1a1a1a] mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/customers-page/AddCustomerModal.jsx
git commit -m "feat(crm): AddCustomerModal form component"
```

---

## Task 6: Wire "+ Add Customer" button in CustomersPage

**Files:**
- Modify: `src/components/dashboard/customers-page/CustomersPage.jsx`

- [ ] **Step 1: Import the modal + add state**

At the top, import:
```javascript
import AddCustomerModal from './AddCustomerModal.jsx';
```

Add state near the top of the component:
```javascript
const [showAddModal, setShowAddModal] = useState(false);
```

- [ ] **Step 2: Add the button to the header**

In the header section (where the h1 + subheading live), wrap them in a flex row and add the button on the right:

```jsx
<header className="mb-6 flex items-start justify-between gap-4">
  <div>
    <h1 className="text-3xl sm:text-4xl font-black text-[#1a1a1a] tracking-[-0.5px]">Customers</h1>
    <p className="text-[13px] text-[#888] mt-1.5">
      {customers.length === 0
        ? 'Everyone who books through your scheduler will show up here.'
        : `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'} · ${bookings.length} total ${bookings.length === 1 ? 'booking' : 'bookings'}`}
    </p>
  </div>
  <button
    type="button"
    onClick={() => setShowAddModal(true)}
    className="shrink-0 px-4 py-2 rounded-md text-sm font-semibold bg-[#cc0000] text-white hover:bg-[#b30000]"
  >
    + Add customer
  </button>
</header>
```

- [ ] **Step 3: Render the modal at the bottom of the main container**

Just before the closing `</main>`:

```jsx
{showAddModal && (
  <AddCustomerModal
    ownerUserId={userId}
    onClose={() => setShowAddModal(false)}
    onCreated={(created) => {
      setManualCustomers((prev) => [created, ...prev]);
      setShowAddModal(false);
    }}
  />
)}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/customers-page/CustomersPage.jsx
git commit -m "feat(crm): + Add customer button + modal wiring"
```

---

## Task 7: CustomerDetailPage supports manual customers

**Files:**
- Modify: `src/components/dashboard/customers-page/CustomerDetailPage.jsx`

- [ ] **Step 1: Load manual profile on mount**

At the top of the file, add the import:
```javascript
import { getCustomerProfileByIdentityKey } from '../../../lib/customerProfiles.js';
```

The detail page already fetches bookings and filters by identityKey. ADD a parallel fetch for the profile row:

In the effect's Promise.all, append the profile fetch:
```javascript
const [bookingsData, sitesRes, metaRow, profileRow] = await Promise.all([
  listBookingsForOwner({ userId }),
  supabase.from('sites').select('id, business_info').eq('user_id', userId),
  getCustomerMetadata({ ownerUserId: userId, identityKey }),
  getCustomerProfileByIdentityKey({ ownerUserId: userId, key: identityKey }),
]);
// existing state setters…
setManualProfile(profileRow); // new state
```

Add state:
```javascript
const [manualProfile, setManualProfile] = useState(null);
```

- [ ] **Step 2: Derive the customer even when there are no bookings**

Currently the page computes `customer` by running `groupBookingsIntoCustomers(filteredBookings)` and taking the first entry. If the result is empty BUT `manualProfile` exists, derive a customer-like object from the profile so the page can still render.

Find the place where `customer` is computed; add a fallback branch:
```javascript
import { makeCustomerLikeFromProfile } from '../../../lib/customerIdentity.js';

const customer = useMemo(() => {
  const grouped = groupBookingsIntoCustomers(bookings.filter((b) => identityKey(b) === identityKeyProp));
  if (grouped.length > 0) {
    // Booked customer — latest snapshot wins. Merge in manual profile vehicle/contact
    // if present so the details page shows whichever is more complete.
    const base = grouped[0];
    if (manualProfile) {
      base.manualContact = {
        vehicleMake: manualProfile.vehicle_make || '',
        vehicleModel: manualProfile.vehicle_model || '',
        vehicleYear: manualProfile.vehicle_year || null,
        vehicleSize: manualProfile.vehicle_size || null,
        notes: manualProfile.notes || '',
      };
    }
    return base;
  }
  if (manualProfile) return makeCustomerLikeFromProfile(manualProfile);
  return null;
}, [bookings, identityKeyProp, manualProfile]);
```

(Adapt variable names to the file's actual identity-key prop name — read the file first to match.)

If `customer === null`, render a "Not found" empty state with a "Back to customers" link.

- [ ] **Step 3: In the booking history section, show an empty state for manual customers**

Where the page renders `sortedBookings.map(...)`:
```jsx
{sortedBookings.length === 0 ? (
  <div className="rounded-xl border border-dashed border-black/10 p-6 text-center">
    <p className="text-sm text-[#888]">No bookings yet for this customer.</p>
    <p className="text-xs text-[#bbb] mt-1">Click "Book this customer" above to schedule their first visit.</p>
  </div>
) : (
  // existing rendering
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/customers-page/CustomerDetailPage.jsx src/lib/customerIdentity.js
git commit -m "feat(crm): CustomerDetailPage supports manual customers"
```

---

## Task 8: owner-create-booking Netlify function

**Files:**
- Create: `netlify/functions/owner-create-booking.js`

- [ ] **Step 1: Write the function**

```javascript
// netlify/functions/owner-create-booking.js
// Owner override path: skip ALL public-booking validation (availability,
// lead time, slot granularity, rate limits). Create the booking row with
// status='confirmed' directly. Optionally send the standard customer
// confirmation email.
//
// Auth: Bearer <access_token> — must be an authenticated Pro owner; we
// reject if the caller doesn't own the target site.
import { createClient } from '@supabase/supabase-js';
import { bookingReceivedToCustomer } from './_lib/postmark.js';
import { isEffectiveSchedulerActive } from './_lib/subscription-gating.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};
const ok = (body) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const fail = (status, body) => ({ statusCode: status, headers: CORS, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST') return fail(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return fail(401, { error: 'Missing token' });
  const token = auth.slice(7);

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return fail(400, { error: 'Invalid JSON' }); }

  const {
    siteId,
    customer_name,
    customer_email,
    customer_phone,
    preferred_at,            // ISO string
    vehicle_make,
    vehicle_model,
    vehicle_year,
    vehicle_size,
    service_id,
    service_name,
    notes,
    send_email = true,
  } = payload;

  if (!siteId || !customer_name || !preferred_at) {
    return fail(400, { error: 'Missing required fields: siteId, customer_name, preferred_at' });
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return fail(401, { error: 'Invalid token' });

  // Verify caller owns the site AND has Pro access.
  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_info, scheduler_config, published_url')
    .eq('id', siteId)
    .maybeSingle();
  if (!site) return fail(404, { error: 'Site not found' });
  if (site.user_id !== user.id) return fail(403, { error: 'Forbidden' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!isEffectiveSchedulerActive(profile)) return fail(403, { error: 'Pro subscription required' });

  const { data: inserted, error: insErr } = await supabase
    .from('bookings')
    .insert({
      site_id: site.id,
      owner_user_id: site.user_id,
      status: 'confirmed',
      customer_name,
      customer_email: customer_email || '',
      customer_phone: customer_phone || '',
      preferred_at,
      vehicle_make: vehicle_make || '',
      vehicle_model: vehicle_model || '',
      vehicle_year: vehicle_year ? Number(vehicle_year) : null,
      vehicle_size: vehicle_size || 'other',
      service_address: null,
      notes: notes || null,
      referral_source: 'owner-dashboard',
      service_id: service_id || null,
      service_name: service_name || null,
    })
    .select()
    .single();

  if (insErr) {
    console.error('owner-create-booking insert error:', insErr);
    return fail(500, { error: 'Failed to create booking' });
  }

  if (send_email && customer_email) {
    try {
      await bookingReceivedToCustomer({ booking: inserted, site, isSimple: false });
    } catch (err) {
      console.error('owner-create-booking customer email failed:', err);
      // non-fatal: booking is saved
    }
  }

  return ok({ ok: true, bookingId: inserted.id, booking: inserted });
};
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/owner-create-booking.js
git commit -m "feat(crm): owner-create-booking endpoint

Authenticated Pro-only. Creates a booking with status='confirmed' and
skips the public flow's availability / lead-time / slot validation.
Owner override mode. Optionally fires the customer confirmation email."
```

---

## Task 9: BookCustomerModal component

**Files:**
- Create: `src/components/dashboard/customers-page/BookCustomerModal.jsx`

- [ ] **Step 1: Write the modal**

```jsx
// src/components/dashboard/customers-page/BookCustomerModal.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';

export default function BookCustomerModal({ customer, userId, onClose, onBooked }) {
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState('');
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [when, setWhen] = useState('');              // datetime-local string
  const [vehicleMake, setVehicleMake] = useState(customer?.manualContact?.vehicleMake || '');
  const [vehicleModel, setVehicleModel] = useState(customer?.manualContact?.vehicleModel || '');
  const [vehicleYear, setVehicleYear] = useState(customer?.manualContact?.vehicleYear || '');
  const [vehicleSize, setVehicleSize] = useState(customer?.manualContact?.vehicleSize || 'sedan');
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Load owner's sites + their scheduler services.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('sites')
        .select('id, business_info, scheduler_config')
        .eq('user_id', userId);
      setSites(data || []);
      if (data && data.length > 0) {
        setSiteId(data[0].id);
        const svcs = (data[0].scheduler_config?.services || []).filter((s) => s.enabled !== false);
        setServices(svcs);
        if (svcs.length > 0) {
          setServiceId(svcs[0].id);
          setServiceName(svcs[0].name);
        }
      }
    })();
  }, [userId]);

  // When site changes, reload its services.
  useEffect(() => {
    const site = sites.find((s) => s.id === siteId);
    const svcs = ((site?.scheduler_config?.services) || []).filter((s) => s.enabled !== false);
    setServices(svcs);
    if (svcs.length > 0) {
      setServiceId(svcs[0].id);
      setServiceName(svcs[0].name);
    } else {
      setServiceId('');
      setServiceName('');
    }
  }, [siteId, sites]);

  function handleServiceChange(id) {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    setServiceName(svc?.name || '');
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not signed in');

      const res = await fetch('/.netlify/functions/owner-create-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          siteId,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          preferred_at: new Date(when).toISOString(),
          vehicle_make: vehicleMake,
          vehicle_model: vehicleModel,
          vehicle_year: vehicleYear ? Number(vehicleYear) : null,
          vehicle_size: vehicleSize,
          service_id: serviceId || null,
          service_name: serviceName || null,
          notes,
          send_email: sendEmail,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create booking');
      onBooked && onBooked(body.booking);
    } catch (e) {
      setErr(e.message || 'Failed to create booking.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight">Book {customer.name}</h2>
          <button type="button" onClick={onClose} className="text-[#888] hover:text-[#1a1a1a]" aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {sites.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.business_info?.businessName || s.id}</option>
                ))}
              </select>
            </div>
          )}

          {services.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Service *</label>
              <select
                required
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.price ? ` · ${s.price}` : ''}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Service name *</label>
              <input
                type="text"
                required
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. Full detail"
                className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Date + time *</label>
            <input
              type="datetime-local"
              required
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
            />
            <p className="text-[11px] text-[#bbb] mt-1">Owner override — skips availability and lead-time checks.</p>
          </div>

          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-2">Vehicle</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField label="Make" value={vehicleMake} onChange={setVehicleMake} />
              <TextField label="Model" value={vehicleModel} onChange={setVehicleModel} />
              <TextField label="Year" type="number" value={vehicleYear} onChange={setVehicleYear} />
              <div>
                <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Size</label>
                <select
                  value={vehicleSize}
                  onChange={(e) => setVehicleSize(e.target.value)}
                  className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
                >
                  {['sedan','suv','truck','van','other'].map((v) => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[#1a1a1a]">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Email customer a confirmation
          </label>

          {err && <p className="text-sm text-[#cc0000]">{err}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-semibold text-[#888] hover:text-[#1a1a1a]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-md text-sm font-semibold bg-[#cc0000] text-white hover:bg-[#b30000] disabled:opacity-60">
              {busy ? 'Booking…' : 'Create booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#1a1a1a] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/customers-page/BookCustomerModal.jsx
git commit -m "feat(crm): BookCustomerModal for owner-created bookings"
```

---

## Task 10: Wire "+ Book this customer" button on detail page

**Files:**
- Modify: `src/components/dashboard/customers-page/CustomerDetailPage.jsx`

- [ ] **Step 1: Import the modal + add state**

```javascript
import BookCustomerModal from './BookCustomerModal.jsx';
```

```javascript
const [showBookModal, setShowBookModal] = useState(false);
```

- [ ] **Step 2: Add the button to the page header**

Where the detail page renders the customer's name header (find the `<h1>` or top section), add a button next to it:

```jsx
<button
  type="button"
  onClick={() => setShowBookModal(true)}
  className="ml-auto px-4 py-2 rounded-md text-sm font-semibold bg-[#cc0000] text-white hover:bg-[#b30000]"
>
  + Book this customer
</button>
```

Wrap the h1 + button in a flex row (`flex items-center gap-3 mb-6`) if not already.

- [ ] **Step 3: Render the modal**

At the bottom of the main content (before the closing tag):

```jsx
{showBookModal && customer && (
  <BookCustomerModal
    customer={customer}
    userId={userId}
    onClose={() => setShowBookModal(false)}
    onBooked={(booking) => {
      setBookings((prev) => [booking, ...prev]);
      setShowBookModal(false);
    }}
  />
)}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/customers-page/CustomerDetailPage.jsx
git commit -m "feat(crm): + Book this customer button + modal wiring"
```

---

## Task 11: End-to-end manual test

**Files:** none (manual)

- [ ] **Step 1: Apply migration** — controller applied via Supabase MCP during Task 1.

- [ ] **Step 2: Signed in as a Pro owner:**

1. Customers page → `+ Add customer` button visible.
2. Click it → modal opens.
3. Fill in: name "Jane Test", email "jane@example.com", phone "555-0123", make "Honda", model "Civic", year "2020", size "sedan", tags "VIP, Referral", notes "Likes the premium wax".
4. Submit → modal closes → Jane appears in the list with a "Manual" badge and those tags.

- [ ] **Step 3: Click Jane's row → detail page loads**

Expect: contact info shown, booking history empty-state card ("No bookings yet for this customer"), notes + tags visible, `+ Book this customer` button at the top.

- [ ] **Step 4: Click `+ Book this customer`**

Modal opens, service dropdown pre-populated (if the site has services), vehicle fields pre-filled from Jane's profile. Pick a service, choose a date/time (any time — no availability checks). Leave "Email customer a confirmation" checked. Submit.

- [ ] **Step 5: Verify**

- Booking appears in Jane's history section.
- Go to Bookings page → the new booking appears with status `confirmed`.
- Jane receives the standard booking-received email at jane@example.com.
- DB: `bookings` row shows `status='confirmed'`, `referral_source='owner-dashboard'`.

- [ ] **Step 6: Duplicate prevention**

Try adding another customer with email "jane@example.com". Expect: error message "A customer with this email / phone / name already exists." Modal stays open.

- [ ] **Step 7: Commit smoke doc**

```bash
mkdir -p docs/superpowers/smoke-tests
cat > docs/superpowers/smoke-tests/customer-crm.md <<'EOF'
# Customer CRM — smoke test

1. Pro owner → Customers → + Add customer
2. Fill form, submit → Jane appears with Manual badge
3. Click Jane → detail page, empty booking history, + Book this customer button
4. + Book this customer → fill form → Submit
5. Booking appears in Jane's history + on Bookings page as confirmed
6. Jane receives confirmation email via Postmark
7. Attempt to add another customer with same email → duplicate error
EOF
git add docs/superpowers/smoke-tests/customer-crm.md
git commit -m "docs(crm): smoke test checklist"
```

---

## Task 12: Go-live checklist

- [ ] `npx vitest run` all green
- [ ] Sandbox test (Task 11) passes on the branch deploy
- [ ] `customer_profiles` contact columns applied in Supabase (already applied during Task 1 by controller)
- [ ] Merge branch to master (no new env vars needed — this feature has no third-party dependencies)
