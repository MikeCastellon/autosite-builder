import { stageLabel } from '../../lib/customSiteForm.js';

// Small pieces shared by the Custom websites list and project page.

export const STAGE_STYLES = {
  new: 'bg-gray-100 text-gray-700',
  invited: 'bg-sky-50 text-sky-800',
  form_started: 'bg-amber-50 text-amber-800',
  form_received: 'bg-[#cc0000] text-white',
  designing: 'bg-violet-50 text-violet-800',
  in_review: 'bg-amber-100 text-amber-900',
  revisions: 'bg-orange-50 text-orange-800',
  live: 'bg-emerald-50 text-emerald-800',
  on_hold: 'bg-gray-200 text-gray-700',
  archived: 'bg-gray-100 text-gray-500',
};

export function StageBadge({ stage }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${STAGE_STYLES[stage] || STAGE_STYLES.new}`}>
      {stageLabel(stage)}
    </span>
  );
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// "3 days", "5 hours": how long something has been going on.
export function duration(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return 'under an hour';
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} hour${h === 1 ? '' : 's'}`; }
  const d = Math.floor(s / 86400);
  return `${d} day${d === 1 ? '' : 's'}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
