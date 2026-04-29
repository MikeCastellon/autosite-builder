// netlify/functions/_lib/stripe-charge-handler.js
// Handles checkout.session.completed events where metadata.type === 'charge'.
// Flips the charges row from pending → paid.
//
// Idempotency guard (Security Audit CC-4): the UPDATE only matches rows
// currently in status='pending'. A replayed checkout.session.completed
// after a refund or canceled payment_intent will not re-flip a refunded
// row to paid.
export async function handleChargeCompleted(event, { db }) {
  const session = event.data.object;
  if (session?.mode !== 'payment') return;

  const chargeId = session.client_reference_id;
  if (!chargeId) return;

  await db
    .from('charges')
    .update({
      status: 'paid',
      paid_at: new Date(),
      stripe_payment_intent_id: session.payment_intent ?? null,
      amount_cents: session.amount_total ?? null,
    })
    .eq('id', chargeId)
    .eq('status', 'pending');
}
