import { useMemo, useState } from 'react';
import { isEffectiveSchedulerActive } from '../../lib/subscriptionGating.js';

const DISMISS_KEY = 'onboarding_checklist_dismissed';

function stepsFor(profile, sites) {
  const hasSite = sites.length > 0;
  const hasPublished = sites.some(s => s?.published_url);
  const hasDomain = sites.some(
    s => s?.custom_domain && s?.custom_domain_status === 'active_ssl'
  );
  const isPro = isEffectiveSchedulerActive(profile);

  return [
    {
      key: 'signup',
      label: 'Create your account',
      done: true,
      cta: null,
    },
    {
      key: 'build',
      label: 'Build your first site',
      done: hasSite,
      cta: hasSite ? null : { text: 'Build My Site', action: 'build' },
    },
    {
      key: 'publish',
      label: 'Publish it',
      done: hasPublished,
      cta: (hasSite && !hasPublished) ? { text: 'Open editor', action: 'edit-first' } : null,
    },
    {
      key: 'domain',
      label: 'Connect a custom domain',
      done: hasDomain,
      optional: true,
      pro: true,
      cta: hasPublished && !hasDomain ? { text: isPro ? 'Add domain' : 'Upgrade', action: isPro ? 'domain-first' : 'upgrade' } : null,
    },
    {
      key: 'pro',
      label: 'Upgrade to Pro',
      done: isPro,
      optional: true,
      cta: isPro ? null : { text: 'See plans', action: 'upgrade' },
    },
  ];
}

export default function OnboardingChecklist({ profile, sites, onAction }) {
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1'
  );

  const steps = useMemo(() => stepsFor(profile, sites), [profile, sites]);

  const completed = steps.filter(s => s.done).length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);

  // Hide when user has dismissed, OR when everything (including optional) is done.
  if (dismissed) return null;
  if (completed === total) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div
      className="bg-white border border-black/[0.07] rounded-2xl shadow-sm p-6 sm:p-8 mb-8 relative"
      style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss checklist"
        className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center text-lg leading-none text-[#888]"
      >
        ×
      </button>

      <div className="flex items-baseline gap-3 mb-1">
        <h3 className="text-lg font-bold text-[#1a1a1a]">Getting started</h3>
        <span className="text-xs text-[#888]">{completed} of {total} complete</span>
      </div>

      <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden mb-5">
        <div
          className="h-full bg-[#cc0000] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-3">
        {steps.map(step => (
          <li key={step.key} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`flex-none w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs leading-none ${
                step.done
                  ? 'bg-[#cc0000] border-[#cc0000] text-white'
                  : 'border-black/20 text-transparent'
              }`}
            >
              ✓
            </span>
            <span className={`flex-1 text-sm ${step.done ? 'text-[#888] line-through' : 'text-[#1a1a1a]'}`}>
              {step.label}
              {step.optional && !step.done && (
                <span className="ml-2 text-xs text-[#888]">· optional</span>
              )}
              {step.pro && !step.done && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#cc0000]/10 text-[#cc0000]">
                  Pro
                </span>
              )}
            </span>
            {step.cta && (
              <button
                type="button"
                onClick={() => onAction?.(step.cta.action)}
                className="flex-none text-sm font-semibold text-[#cc0000] hover:underline"
              >
                {step.cta.text}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
