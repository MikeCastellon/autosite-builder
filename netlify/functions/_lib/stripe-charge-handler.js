// netlify/functions/_lib/stripe-charge-handler.js
// Handles checkout.session.completed events where metadata.type === 'charge'.
// Flips the charges row from pending → paid.
export async function handleChargeCompleted(event, { db }) {
  const session = event.data.object;
  if (session?.mode !== 'payment') return;

  const chargeId = session.client_reference_id;
  if (!chargeId) return;

  await db.from('charges').update({
    status: 'paid',
    paid_at: new Date(),
    stripe_payment_intent_id: session.payment_intent ?? null,
    amount_cents: session.amount_total ?? null,
  }).eq('id', chargeId);
}
