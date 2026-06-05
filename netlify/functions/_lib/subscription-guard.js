// netlify/functions/_lib/subscription-guard.js
// Guards against a single Stripe customer accumulating multiple concurrent
// subscriptions. Stripe does NOT dedupe — every completed Checkout Session in
// subscription mode mints a new subscription on the customer. Without this
// guard, a customer who completes checkout more than once ends up with several
// subscriptions that all bill in parallel (the "double/triple charge" bug).

// Statuses that mean the customer already has a live, billable subscription.
// A new checkout must NOT be created when one of these exists.
// Excludes: canceled, incomplete, incomplete_expired, paused — those are not
// actively billing, so letting the customer (re)subscribe is correct.
export const BLOCKING_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

// Returns the first live subscription for a customer, or null if none.
// Skips the Stripe call entirely when there is no customer yet (brand-new
// customers cannot have prior subscriptions).
export async function findBlockingSubscription(stripe, customerId) {
  if (!customerId) return null;
  const { data } = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  });
  return data.find((sub) => BLOCKING_STATUSES.has(sub.status)) || null;
}

// Sum of money actually collected (and not yet returned) across a set of
// invoices, in the smallest currency unit (cents). Counts only `paid` invoices,
// and nets out anything already refunded via post-payment credit notes so the
// figure is the still-refundable amount.
export function paidInvoiceTotal(invoices) {
  return invoices.reduce((total, inv) => {
    if (inv.status !== 'paid') return total;
    const collected = inv.amount_paid || 0;
    const alreadyReturned = inv.post_payment_credit_notes_amount || 0;
    return total + Math.max(0, collected - alreadyReturned);
  }, 0);
}

// Pure planner for cleaning up customers who were already double-subscribed
// before the guard existed. Given a flat list of subscriptions, group the LIVE
// ones by customer; for any customer with more than one, keep the earliest
// (lowest `created`) and mark the rest for cancellation.
export function planDuplicateReconciliation(subscriptions) {
  const byCustomer = new Map();
  for (const sub of subscriptions) {
    if (!BLOCKING_STATUSES.has(sub.status)) continue;
    if (!byCustomer.has(sub.customer)) byCustomer.set(sub.customer, []);
    byCustomer.get(sub.customer).push(sub);
  }

  const plan = [];
  for (const [customer, subs] of byCustomer) {
    if (subs.length < 2) continue;
    const sorted = [...subs].sort((a, b) => a.created - b.created);
    const [keep, ...rest] = sorted;
    plan.push({
      customer,
      keepId: keep.id,
      cancelIds: rest.map((s) => s.id),
      liveCount: subs.length,
    });
  }
  return plan;
}
