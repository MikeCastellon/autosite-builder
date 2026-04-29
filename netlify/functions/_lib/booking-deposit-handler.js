// netlify/functions/_lib/booking-deposit-handler.js
// Receives checkout.session.completed events with mode='payment' from
// connected Stripe accounts. The session was created by create-booking
// with client_reference_id = booking.id.
//
// Two guards beyond the original "flip to paid" path:
//   1. Underpayment check (Security Audit H7): the session's amount_total
//      must be at least the booking's deposit_required_cents. This blocks
//      a stale Checkout URL from a different (smaller) amount being used
//      to mark the booking paid in full.
//   2. Idempotency on status (Security Audit CC-4 / Performance #4): the
//      UPDATE only matches rows currently in deposit_status='pending'. A
//      replayed checkout.session.completed after a refund or canceled
//      payment_intent will not re-flip a refunded/cancelled row to paid.
export async function handleBookingCheckoutCompleted(event, { db }) {
  const session = event.data.object;
  if (session?.mode !== 'payment') return;
  const bookingId = session.client_reference_id;
  if (!bookingId) return;

  const { data: booking } = await db
    .from('bookings')
    .select('deposit_required_cents, deposit_status')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking) return;

  const paid = session.amount_total ?? 0;
  if (
    booking.deposit_required_cents != null &&
    paid < booking.deposit_required_cents
  ) {
    console.warn(
      `[booking-deposit] underpayment ${paid} < required ${booking.deposit_required_cents} for booking ${bookingId} — leaving status unchanged`,
    );
    return;
  }

  await db
    .from('bookings')
    .update({
      deposit_status: 'paid',
      deposit_paid_cents: session.amount_total ?? null,
      deposit_paid_at: new Date(),
      deposit_payment_intent_id: session.payment_intent ?? null,
    })
    .eq('id', bookingId)
    .eq('deposit_status', 'pending');
}
