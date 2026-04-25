// netlify/functions/_lib/booking-deposit-handler.js
// Receives checkout.session.completed events with mode='payment' from
// connected Stripe accounts. The session was created by create-booking
// with client_reference_id = booking.id. Flip the row to paid.
//
// Idempotent: a duplicate event re-writes the same data; no harm done.
export async function handleBookingCheckoutCompleted(event, { db }) {
  const session = event.data.object;
  if (session?.mode !== 'payment') return;
  const bookingId = session.client_reference_id;
  if (!bookingId) return;

  await db.from('bookings').update({
    deposit_status: 'paid',
    deposit_paid_cents: session.amount_total ?? null,
    deposit_paid_at: new Date(),
    deposit_payment_intent_id: session.payment_intent ?? null,
  }).eq('id', bookingId);
}
