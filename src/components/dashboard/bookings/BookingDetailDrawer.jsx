import { useState, useEffect } from 'react';
import StatusPill from './StatusPill.jsx';
import { updateBooking, saveOwnerNotes } from '../../../lib/bookings.js';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const ACTIONS_FOR = {
  pending:   ['confirm', 'decline', 'cancel'],
  confirmed: ['complete', 'cancel'],
  declined:  [],
  completed: [],
  cancelled: [],
};

const ACTION_LABELS = {
  confirm:  { label: 'Confirm',        className: 'bg-[#cc0000] hover:bg-[#aa0000] text-white' },
  decline:  { label: 'Decline',        className: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700' },
  complete: { label: 'Mark completed', className: 'bg-blue-600 hover:bg-blue-700 text-white' },
  cancel:   { label: 'Cancel',         className: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700' },
};

export default function BookingDetailDrawer({ booking, onClose, onUpdated }) {
  const [b, setB] = useState(booking);
  const [notes, setNotes] = useState(booking?.owner_notes || '');
  const [declineReason, setDeclineReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showDecline, setShowDecline] = useState(false);

  useEffect(() => { setB(booking); setNotes(booking?.owner_notes || ''); setShowDecline(false); setErr(null); }, [booking?.id]);

  if (!b) return null;

  async function run(action) {
    if (action === 'decline' && !showDecline) { setShowDecline(true); return; }
    setBusy(true); setErr(null);
    try {
      const updated = await updateBooking({
        bookingId: b.id,
        action,
        reason: action === 'decline' ? (declineReason.trim() || undefined) : undefined,
      });
      setB(updated);
      onUpdated && onUpdated(updated);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function onNotesBlur() {
    if (notes === (b.owner_notes || '')) return;
    try { const updated = await saveOwnerNotes(b.id, notes); setB(updated); onUpdated && onUpdated(updated); }
    catch (e) { setErr(e.message); }
  }

  const actions = ACTIONS_FOR[b.status] || [];

  return (
    <div className="fixed inset-0 z-[60] flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <aside className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/[0.04] hover:bg-[#cc0000]/10 hover:text-[#cc0000] text-[#555] flex items-center justify-center transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="mb-4 pr-10">
          <StatusPill status={b.status} />
        </div>

        <h2 className="text-xl font-black text-[#1a1a1a]">{b.customer_name}</h2>
        <p className="text-sm text-gray-500 mb-4">
          <a href={`mailto:${b.customer_email}`} className="hover:underline">{b.customer_email}</a>
          {' · '}
          <a href={`tel:${b.customer_phone}`} className="hover:underline">{b.customer_phone}</a>
        </p>

        <dl className="text-sm space-y-2 mb-6">
          <Row term="When"     def={fmt(b.preferred_at)} />
          <Row term="Vehicle"  def={`${b.vehicle_year} ${b.vehicle_make} ${b.vehicle_model} (${b.vehicle_size})`} />
          {b.service_address  && <Row term="Address" def={b.service_address} />}
          {b.notes            && <Row term="Notes" def={b.notes} />}
          {b.referral_source  && <Row term="Heard via" def={b.referral_source} />}
          {b.declined_reason  && <Row term="Declined" def={b.declined_reason} />}
          <Row term="Created" def={fmt(b.created_at)} />
        </dl>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Owner notes (private)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={onNotesBlur}
          rows={3}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400"
        />

        {showDecline && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason for declining</label>
            <input
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
        )}

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        {actions.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a}
                onClick={() => run(a)}
                disabled={busy}
                className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${ACTION_LABELS[a].className}`}
              >
                {ACTION_LABELS[a].label}
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ term, def }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 text-gray-500 shrink-0">{term}</dt>
      <dd className="text-gray-800 break-words">{def}</dd>
    </div>
  );
}
