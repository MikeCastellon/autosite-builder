import { useEffect, useRef, useState } from 'react';
import UpgradeProDialog from './UpgradeProDialog.jsx';
import { isEffectiveSchedulerActive, proTrialEndsAt } from '../../lib/subscriptionGating.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Under the header on every business page while the account's Pro comes
// only from a trial (a free website's hand-over can include one): when it
// ends, and a way to keep Pro. The rest of the app hides its upgrade offers
// from Pro accounts, so without this a trial had no way to subscribe.
//
// The trial emails link to ?upgrade=pro: that opens the upgrade box once
// the profile has loaded (during the trial or after it ended), then leaves
// the address bar.
export default function ProTrialBanner({ profile }) {
  const [open, setOpen] = useState(false);
  const handled = useRef(false);
  const endsAt = proTrialEndsAt(profile);

  useEffect(() => {
    if (handled.current || !profile) return;
    handled.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') !== 'pro') return;
    params.delete('upgrade');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    // Pro some other way (paying, or Pro at no charge): nothing to buy.
    if (!isEffectiveSchedulerActive(profile) || proTrialEndsAt(profile)) setOpen(true);
  }, [profile]);

  const daysLeft = endsAt ? Math.max(1, Math.ceil((endsAt.getTime() - Date.now()) / DAY_MS)) : 0;
  const endDay = endsAt ? endsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '';

  return (
    <>
      {endsAt && (
        <div className="bg-[#fff5f5] border-b border-[#cc0000]/15 px-4 sm:px-8 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-[#1a1a1a]">
          <span>
            Your free Pro trial ends <strong>{endDay}</strong> ({daysLeft} {daysLeft === 1 ? 'day' : 'days'} left).
          </span>
          <button type="button" onClick={() => setOpen(true)} className="font-bold text-[#cc0000] hover:text-[#a80000] hover:underline underline-offset-2">
            Keep Pro
          </button>
        </div>
      )}
      <UpgradeProDialog
        open={open}
        onClose={() => setOpen(false)}
        heading={endsAt ? 'Keep Pro after your trial' : 'Upgrade to Pro'}
        subheading={endsAt
          ? `Upgrade now so online booking and card payments keep working after ${endDay}.`
          : 'Turn online booking and card payments back on.'}
      />
    </>
  );
}
