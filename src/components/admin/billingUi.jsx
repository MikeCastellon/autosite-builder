// Billing pieces shared by the Admin Dashboard, Admin > Customers and the
// user drawer, so a status reads the same (label and colour) everywhere.
// `status` is a billingStatusOf() result from lib/adminStats.js.

// Literal class strings, one per key: Tailwind only builds classes it can
// find written out in the source.
const BADGE_CLASSES = {
  paying: 'bg-[#cc0000] text-white',
  trial: 'bg-[#cc0000]/15 text-[#cc0000]',
  manual: 'bg-[#cc0000]/15 text-[#cc0000]',
  comped: 'bg-[#1a1a1a]/[0.08] text-[#1a1a1a]',
  past_due: 'bg-amber-100 text-amber-800',
  past_due_lapsed: 'bg-red-100 text-red-800',
  cancelled_grace: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-gray-200 text-gray-700',
  free: 'bg-gray-100 text-gray-600',
  admin: 'bg-[#1a1a1a] text-white',
};

export function BillingBadge({ status }) {
  const cls = BADGE_CLASSES[status?.key] || BADGE_CLASSES.free;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cls}`}>
      {status?.label || '—'}
    </span>
  );
}

// '$39.98', or '$40' for whole dollars: MRR tiles read better without a
// trailing '.00'. Anything that is not a number shows '—', never '$0'.
export function formatMoney(cents) {
  if (cents === null || cents === undefined || cents === '') return '—';
  const n = Math.round(Number(cents));
  if (!Number.isFinite(n)) return '—';
  const whole = n % 100 === 0;
  const amount = (Math.abs(n) / 100).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
  return `${n < 0 ? '-' : ''}$${amount}`;
}

// 'Oct 5, 26', the date style of the admin tables (AdminAccountsTab).
export function formatShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}
