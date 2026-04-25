// Shared dedup + grouping logic for the Customers feature.
//
// We treat anyone who has ever booked through this owner's site(s) as a
// "customer" — but bookings don't have a stable customer_id. So we collapse
// rows by a normalized identity key derived from email/phone/name in that
// order of preference. This file centralizes the logic so the list page,
// the detail page, the export, and the customer_metadata Supabase table
// all key on the SAME string. Changing the algorithm here is the only place
// you have to touch.

// Normalize a contact string into a stable identity key so "John@x.com" and
// "john@x.com  " collapse to the same customer, and phone numbers survive
// " (555) 123-4567 " vs "5551234567" punctuation drift.
export function identityKey(b) {
  const email = (b.customer_email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = (b.customer_phone || '').replace(/\D+/g, '');
  if (phone) return `phone:${phone}`;
  // Last resort — use the name so nameless/contactless entries still show up
  // as separate rows rather than all piling into one bucket.
  return `name:${(b.customer_name || '').trim().toLowerCase() || b.id}`;
}

// Group a flat list of bookings into one entry per unique customer. The
// returned objects mirror what the list & detail pages need: identity key,
// most-recent snapshot of name/email/phone, full booking history, distinct
// services with counts, sites they've booked at, first/last booked, and
// the next upcoming pending/confirmed booking (if any) for the green badge.
export function groupBookingsIntoCustomers(bookings) {
  const groups = new Map();
  for (const b of bookings) {
    const key = identityKey(b);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: b.customer_name || '(No name)',
        email: b.customer_email || '',
        phone: b.customer_phone || '',
        bookings: [],
        services: new Map(),        // serviceName → count
        siteIds: new Set(),
        firstBookedAt: b.created_at,
        lastBookedAt: b.created_at,
        nextUpcomingAt: null,
      });
    }
    const g = groups.get(key);
    g.bookings.push(b);
    if (b.service_name) {
      g.services.set(b.service_name, (g.services.get(b.service_name) || 0) + 1);
    }
    if (b.site_id) g.siteIds.add(b.site_id);
    // Track earliest + latest by created_at — keep name fresh on whichever
    // record has the latest customer_name (people's names change, phone
    // numbers change, emails stay — trust the most recent snapshot).
    if (new Date(b.created_at) < new Date(g.firstBookedAt)) g.firstBookedAt = b.created_at;
    if (new Date(b.created_at) >= new Date(g.lastBookedAt)) {
      g.lastBookedAt = b.created_at;
      g.name = b.customer_name || g.name;
      g.email = b.customer_email || g.email;
      g.phone = b.customer_phone || g.phone;
    }
    // Upcoming = future-dated preferred_at with status still pending/confirmed
    const pref = b.preferred_at ? new Date(b.preferred_at) : null;
    const isUpcoming = pref && pref >= new Date() && (b.status === 'pending' || b.status === 'confirmed');
    if (isUpcoming && (!g.nextUpcomingAt || pref < new Date(g.nextUpcomingAt))) {
      g.nextUpcomingAt = b.preferred_at;
    }
  }
  // Newest-first by last booking so returning customers bubble up.
  return [...groups.values()].sort((a, b) => new Date(b.lastBookedAt) - new Date(a.lastBookedAt));
}

// Most-recent site_id this customer booked at — used by the email composer
// to pick the right site context (business name, address, hours) when the
// owner has multiple sites.
export function pickPrimarySiteId(customer) {
  if (!customer || !customer.bookings.length) return null;
  const latest = [...customer.bookings].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  )[0];
  return latest?.site_id || null;
}

// Shape a customer_profiles row into the same object the list/detail pages
// expect from groupBookingsIntoCustomers. Keeps rendering logic shared.
export function makeCustomerLikeFromProfile(p) {
  return {
    key: p.identity_key,
    name: p.name || '(No name)',
    email: p.email || '',
    phone: p.phone || '',
    photoUrl: p.photo_url || '',
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
