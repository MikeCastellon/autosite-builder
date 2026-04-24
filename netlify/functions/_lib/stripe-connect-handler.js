// netlify/functions/_lib/stripe-connect-handler.js
// Handles Stripe account.updated events for connected Express accounts.
// Writes charges_enabled / payouts_enabled / details_submitted back to the
// profile so feature-gates in the UI can flip once onboarding completes.
//
// Profile resolution order:
//   1. account.metadata.supabase_user_id — set at account create time.
//   2. Fallback: match on existing profiles.stripe_connect_account_id.
// If neither matches, the event is ignored (orphan / another platform).
export async function handleAccountUpdated(event, { db }) {
  const account = event.data.object;
  if (!account?.id) return;

  let profileId = account.metadata?.supabase_user_id || null;

  if (!profileId) {
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('stripe_connect_account_id', account.id)
      .maybeSingle();
    profileId = profile?.id || null;
  }

  if (!profileId) return;

  await db.from('profiles').update({
    stripe_connect_account_id: account.id,
    stripe_connect_charges_enabled: !!account.charges_enabled,
    stripe_connect_payouts_enabled: !!account.payouts_enabled,
    stripe_connect_details_submitted: !!account.details_submitted,
    stripe_connect_updated_at: new Date(),
  }).eq('id', profileId);
}
