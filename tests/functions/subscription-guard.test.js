// tests/functions/subscription-guard.test.js
import { describe, it, expect, vi } from 'vitest';
import {
  findBlockingSubscription,
  planDuplicateReconciliation,
  paidInvoiceTotal,
  BLOCKING_STATUSES,
} from '../../netlify/functions/_lib/subscription-guard.js';

// Fake Stripe client exposing just subscriptions.list.
function fakeStripe(data) {
  return {
    subscriptions: {
      list: vi.fn().mockResolvedValue({ data }),
    },
  };
}

describe('findBlockingSubscription', () => {
  it('returns the existing subscription when the customer is trialing', async () => {
    const sub = { id: 'sub_1', customer: 'cus_a', status: 'trialing' };
    const stripe = fakeStripe([sub]);

    const found = await findBlockingSubscription(stripe, 'cus_a');

    expect(stripe.subscriptions.list).toHaveBeenCalledWith({
      customer: 'cus_a',
      status: 'all',
      limit: 100,
    });
    expect(found).toEqual(sub);
  });

  it.each(['active', 'past_due', 'unpaid'])(
    'treats a %s subscription as blocking',
    async (status) => {
      const sub = { id: 'sub_1', customer: 'cus_a', status };
      const found = await findBlockingSubscription(fakeStripe([sub]), 'cus_a');
      expect(found).toEqual(sub);
    }
  );

  it('returns null when the only subscriptions are canceled/incomplete', async () => {
    const stripe = fakeStripe([
      { id: 'sub_x', customer: 'cus_a', status: 'canceled' },
      { id: 'sub_y', customer: 'cus_a', status: 'incomplete_expired' },
    ]);
    expect(await findBlockingSubscription(stripe, 'cus_a')).toBeNull();
  });

  it('returns null and does not call Stripe when customerId is missing', async () => {
    const stripe = fakeStripe([]);
    expect(await findBlockingSubscription(stripe, null)).toBeNull();
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
  });
});

describe('planDuplicateReconciliation', () => {
  it('keeps the earliest live subscription and cancels the rest, per customer', () => {
    const subs = [
      { id: 'sub_new', customer: 'cus_a', status: 'active', created: 300 },
      { id: 'sub_old', customer: 'cus_a', status: 'active', created: 100 },
      { id: 'sub_mid', customer: 'cus_a', status: 'past_due', created: 200 },
    ];

    const plan = planDuplicateReconciliation(subs);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      customer: 'cus_a',
      keepId: 'sub_old', // earliest created
      liveCount: 3,
    });
    expect(plan[0].cancelIds.sort()).toEqual(['sub_mid', 'sub_new']);
  });

  it('ignores customers with a single live subscription', () => {
    const subs = [{ id: 'sub_1', customer: 'cus_solo', status: 'active', created: 1 }];
    expect(planDuplicateReconciliation(subs)).toEqual([]);
  });

  it('does not count canceled/incomplete subscriptions toward duplicates', () => {
    const subs = [
      { id: 'sub_live', customer: 'cus_a', status: 'active', created: 100 },
      { id: 'sub_dead', customer: 'cus_a', status: 'canceled', created: 200 },
      { id: 'sub_inc', customer: 'cus_a', status: 'incomplete', created: 300 },
    ];
    // Only one live sub → not a duplicate, nothing to reconcile.
    expect(planDuplicateReconciliation(subs)).toEqual([]);
  });

  it('reconciles multiple affected customers independently', () => {
    const subs = [
      { id: 'a1', customer: 'cus_a', status: 'active', created: 10 },
      { id: 'a2', customer: 'cus_a', status: 'active', created: 20 },
      { id: 'b1', customer: 'cus_b', status: 'trialing', created: 5 },
      { id: 'b2', customer: 'cus_b', status: 'trialing', created: 15 },
    ];
    const plan = planDuplicateReconciliation(subs);
    const byCustomer = Object.fromEntries(plan.map((p) => [p.customer, p]));
    expect(byCustomer.cus_a.keepId).toBe('a1');
    expect(byCustomer.cus_a.cancelIds).toEqual(['a2']);
    expect(byCustomer.cus_b.keepId).toBe('b1');
    expect(byCustomer.cus_b.cancelIds).toEqual(['b2']);
  });
});

describe('paidInvoiceTotal', () => {
  it('sums amount_paid across paid invoices only (in cents)', () => {
    const invoices = [
      { status: 'paid', amount_paid: 1999 },
      { status: 'paid', amount_paid: 1999 },
      { status: 'open', amount_paid: 0 },
      { status: 'void', amount_paid: 1999 }, // not collected — excluded
    ];
    expect(paidInvoiceTotal(invoices)).toBe(3998);
  });

  it('returns 0 for no invoices', () => {
    expect(paidInvoiceTotal([])).toBe(0);
  });

  it('ignores already-refunded amounts via amount_paid net of refunds', () => {
    // Stripe exposes the originally collected figure in amount_paid; a fully
    // refunded invoice still reports amount_paid but we treat post_payment_credit_notes_amount
    // as already-returned and net it out.
    const invoices = [
      { status: 'paid', amount_paid: 1999, post_payment_credit_notes_amount: 1999 },
      { status: 'paid', amount_paid: 1999, post_payment_credit_notes_amount: 0 },
    ];
    expect(paidInvoiceTotal(invoices)).toBe(1999);
  });
});

describe('BLOCKING_STATUSES', () => {
  it('is the set of statuses that represent a live/billable subscription', () => {
    expect(BLOCKING_STATUSES.has('active')).toBe(true);
    expect(BLOCKING_STATUSES.has('trialing')).toBe(true);
    expect(BLOCKING_STATUSES.has('past_due')).toBe(true);
    expect(BLOCKING_STATUSES.has('unpaid')).toBe(true);
    expect(BLOCKING_STATUSES.has('canceled')).toBe(false);
    expect(BLOCKING_STATUSES.has('incomplete')).toBe(false);
  });
});
