import { shouldShowUpgradeCard } from '../../../lib/subscriptionGating.js';
import UpgradeProPanel from '../../ui/UpgradeProPanel.jsx';

// Wraps the Bookings page. If the user doesn't have an active Pro subscription,
// renders the shared Pro upgrade panel instead of the booking content. Same
// upgrade entry point as the floating button + publish-page panel — every Pro
// CTA in the app routes through Shopify checkout.
export default function SubscribeGate({ profile, children }) {
  const showCard = shouldShowUpgradeCard(profile);
  const pastDue = profile?.subscription_status === 'past_due';

  if (!showCard) return children;

  return (
    <main className="max-w-xl mx-auto px-6 py-12">
      {pastDue && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your subscription has a payment issue.{' '}
          <a className="font-semibold underline hover:no-underline" href="https://account.shopify.com" target="_blank" rel="noreferrer">
            Update your payment method →
          </a>
        </div>
      )}
      <UpgradeProPanel
        size="lg"
        heading="Bookings is a Pro feature"
        subheading="Customers can request appointments right from your website. Calendar, services, availability, and confirmation emails — all managed from this dashboard."
      />
    </main>
  );
}
