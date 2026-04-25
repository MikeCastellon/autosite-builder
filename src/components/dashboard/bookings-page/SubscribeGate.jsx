import { shouldShowUpgradeCard } from '../../../lib/subscriptionGating.js';
import UpgradeProPanel from '../../ui/UpgradeProPanel.jsx';

// Overlays the children (e.g. the bookings calendar) for non-Pro users.
// Children stay rendered underneath so customers see what they're missing —
// the upgrade panel floats centered on top with a soft backdrop. Pro users
// get an unobstructed page.
//
// Props `heading` and `subheading` customize the upgrade panel's copy so the
// same gate can wrap different Pro-only pages (Bookings, Customers, etc.)
// with page-specific messaging.
export default function SubscribeGate({
  profile,
  children,
  heading = 'Bookings is a Pro feature',
  subheading = 'Unlock the calendar behind this overlay — plus everything else included with Pro.',
}) {
  const showCard = shouldShowUpgradeCard(profile);
  const pastDue = profile?.subscription_status === 'past_due';

  if (!showCard) return children;

  return (
    <div className="relative">
      {/* The actual page content — visible behind the paywall but
          non-interactive. Pointer events pass through to the overlay. */}
      <div aria-hidden="true" className="pointer-events-none select-none opacity-90">
        {children}
      </div>

      {/* Soft backdrop with blur so the calendar shows through */}
      <div className="fixed inset-0 z-40 bg-white/40 backdrop-blur-[2px] pointer-events-auto" style={{ top: 64 }} />

      {/* Centered upgrade panel */}
      <div
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pointer-events-none"
        style={{ top: 64 }}
      >
        <div className="w-full max-w-md pointer-events-auto mt-8 sm:mt-0">
          {pastDue && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
              Your subscription has a payment issue.{' '}
              <a className="font-semibold underline hover:no-underline" href="https://account.shopify.com" target="_blank" rel="noreferrer">
                Update your payment method →
              </a>
            </div>
          )}
          <UpgradeProPanel
            heading={heading}
            subheading={subheading}
          />
        </div>
      </div>
    </div>
  );
}
