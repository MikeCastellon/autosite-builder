#!/usr/bin/env node
// scripts/audit-duplicate-subscriptions.mjs
//
// Finds Stripe customers who have more than one LIVE subscription (the
// double/triple-charge bug) and reports how many duplicates exist and how much
// money is refundable. Built on the same tested helpers the runtime guard uses
// (netlify/functions/_lib/subscription-guard.js).
//
// SAFE BY DEFAULT: with no flags it only READS from Stripe and prints a report.
//
//   node scripts/audit-duplicate-subscriptions.mjs            # dry run, report only
//   node scripts/audit-duplicate-subscriptions.mjs --cancel   # cancel duplicate subs
//   node scripts/audit-duplicate-subscriptions.mjs --refund   # refund duplicates' paid invoices
//   node scripts/audit-duplicate-subscriptions.mjs --cancel --refund
//
// For each affected customer it KEEPS the earliest-created subscription and
// treats every later one as a duplicate to cancel/refund.
//
// Requires STRIPE_SECRET_KEY in the environment (same key the functions use).
// PowerShell:  $env:STRIPE_SECRET_KEY="sk_live_..."; node scripts/audit-duplicate-subscriptions.mjs

import Stripe from 'stripe';
import {
  planDuplicateReconciliation,
  paidInvoiceTotal,
} from '../netlify/functions/_lib/subscription-guard.js';

const DO_CANCEL = process.argv.includes('--cancel');
const DO_REFUND = process.argv.includes('--refund');

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set. Aborting.');
  process.exit(1);
}
const stripe = new Stripe(key, { apiVersion: '2025-01-27.acacia' });
const live = key.startsWith('sk_live');

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

async function main() {
  console.log(`\nStripe mode: ${live ? 'LIVE' : 'TEST'}`);
  console.log(`Actions: cancel=${DO_CANCEL ? 'YES' : 'no'}  refund=${DO_REFUND ? 'YES' : 'no'}`);
  console.log('Scanning all subscriptions…\n');

  // 1. Pull every subscription (any status) with its customer expanded.
  const subs = [];
  for await (const sub of stripe.subscriptions.list({
    status: 'all',
    limit: 100,
    expand: ['data.customer'],
  })) {
    subs.push({
      id: sub.id,
      customer: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      customerObj: typeof sub.customer === 'string' ? null : sub.customer,
      status: sub.status,
      created: sub.created,
    });
  }

  // 2. Decide what to keep vs. cancel (tested pure logic).
  const plan = planDuplicateReconciliation(subs);
  if (plan.length === 0) {
    console.log('No customers with duplicate live subscriptions. Nothing to do. ✅\n');
    return;
  }

  const emailFor = (customerId) =>
    subs.find((s) => s.customer === customerId)?.customerObj?.email || '(unknown email)';

  let totalDupSubs = 0;
  let totalRefundable = 0;
  let totalRefunded = 0;
  let totalCancelled = 0;

  // 3. Per affected customer: compute refundable money, then optionally act.
  for (const entry of plan) {
    const email = emailFor(entry.customer);
    console.log('─'.repeat(72));
    console.log(`${email}  (${entry.customer})`);
    console.log(`  live subscriptions: ${entry.liveCount}  →  keep ${entry.keepId}, cancel ${entry.cancelIds.length}`);

    let customerRefundable = 0;
    for (const subId of entry.cancelIds) {
      totalDupSubs++;

      // Paid invoices for this duplicate subscription = money wrongly collected.
      const invoices = [];
      for await (const inv of stripe.invoices.list({ subscription: subId, limit: 100 })) {
        invoices.push(inv);
      }
      const refundable = paidInvoiceTotal(invoices);
      customerRefundable += refundable;
      console.log(`    dup ${subId}: collected ${money(refundable)} across ${invoices.length} invoice(s)`);

      if (DO_REFUND && refundable > 0) {
        for (const inv of invoices) {
          if (inv.status !== 'paid') continue;
          const alreadyReturned = inv.post_payment_credit_notes_amount || 0;
          const net = (inv.amount_paid || 0) - alreadyReturned;
          if (net <= 0) continue;
          const target = inv.payment_intent
            ? { payment_intent: typeof inv.payment_intent === 'string' ? inv.payment_intent : inv.payment_intent.id }
            : inv.charge
            ? { charge: typeof inv.charge === 'string' ? inv.charge : inv.charge.id }
            : null;
          if (!target) {
            console.log(`      ! invoice ${inv.id} has no charge/payment_intent — skip refund`);
            continue;
          }
          const refund = await stripe.refunds.create({ ...target, amount: net });
          totalRefunded += net;
          console.log(`      ↩ refunded ${money(net)} (${refund.id})`);
        }
      }

      if (DO_CANCEL) {
        await stripe.subscriptions.cancel(subId);
        totalCancelled++;
        console.log(`      ✖ cancelled ${subId}`);
      }
    }

    totalRefundable += customerRefundable;
    console.log(`  refundable for this customer: ${money(customerRefundable)}`);
  }

  // 4. Summary.
  console.log('═'.repeat(72));
  console.log(`Affected customers:        ${plan.length}`);
  console.log(`Duplicate subscriptions:   ${totalDupSubs}`);
  console.log(`Total refundable:          ${money(totalRefundable)}`);
  if (DO_CANCEL) console.log(`Subscriptions cancelled:   ${totalCancelled}`);
  if (DO_REFUND) console.log(`Total refunded this run:   ${money(totalRefunded)}`);
  if (!DO_CANCEL && !DO_REFUND) {
    console.log('\nDRY RUN — no changes made. Re-run with --cancel and/or --refund to act.');
  }
  console.log('');
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
