import { useState, useEffect } from 'react';
import StatusPill from './StatusPill.jsx';
import { updateBooking, saveOwnerNotes, sendBookingReminder, buildSmsReminderHref, defaultReminderMessage } from '../../../lib/bookings.js';
import { supabase } from '../../../lib/supabase.js';

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
  complete: { label: 'Mark completed', className: 'bg-[#cc0000] hover:bg-[#aa0000] text-white' },
  cancel:   { label: 'Cancel',         className: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700' },
};

export default function BookingDetailDrawer({ booking, onClose, onUpdated }) {
  const [b, setB] = useState(booking);
  const [notes, setNotes] = useState(booking?.owner_notes || '');
  const [declineReason, setDeclineReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showDecline, setShowDecline] = useState(false);
  const [site, setSite] = useState(null);
  const [reminderState, setReminderState] = useState({ status: 'idle', error: null });

  useEffect(() => { setB(booking); setNotes(booking?.owner_notes || ''); setShowDecline(false); setErr(null); setReminderState({ status: 'idle', error: null }); }, [booking?.id]);

  // Pull the site so reminder copy + email footer can use the business name.
  useEffect(() => {
    if (!booking?.site_id) { setSite(null); return; }
    let cancelled = false;
    supabase
      .from('sites')
      .select('id, business_info, slug, published_url')
      .eq('id', booking.site_id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setSite(data || null); });
    return () => { cancelled = true; };
  }, [booking?.site_id]);

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

  async function sendEmailReminder() {
    setReminderState({ status: 'sending', error: null });
    try {
      await sendBookingReminder({ bookingId: b.id });
      setReminderState({ status: 'sent', error: null });
    } catch (e) {
      setReminderState({ status: 'idle', error: e.message });
    }
  }

  const smsHref = buildSmsReminderHref({
    phone: b.customer_phone,
    message: defaultReminderMessage(b, site),
  });
  const canEmail = !!b.customer_email;
  const remindable = ['pending', 'confirmed'].includes(b.status);

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

        {b?.deposit_status && b.deposit_status !== 'not_required' && (
          <div className="border-t border-black/[0.07] pt-4 mt-4 mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-2">Deposit</h3>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between">
                <dt className="text-[#888]">Status</dt>
                <dd className="font-semibold text-[#1a1a1a]">
                  {b.deposit_status === 'paid' && 'Paid'}
                  {b.deposit_status === 'pending' && 'Pending'}
                  {b.deposit_status === 'refunded' && 'Refunded'}
                  {b.deposit_status === 'failed' && 'Failed'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#888]">Required</dt>
                <dd className="font-mono">{b.deposit_required_cents != null ? `$${(b.deposit_required_cents / 100).toFixed(2)}` : '—'}</dd>
              </div>
              {b.deposit_paid_cents != null && (
                <div className="flex justify-between">
                  <dt className="text-[#888]">Paid</dt>
                  <dd className="font-mono">${(b.deposit_paid_cents / 100).toFixed(2)}</dd>
                </div>
              )}
              {b.deposit_paid_at && (
                <div className="flex justify-between">
                  <dt className="text-[#888]">Paid at</dt>
                  <dd>{new Date(b.deposit_paid_at).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {remindable && (
          <div className="border-t border-black/[0.07] pt-4 mt-4 mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-2">Send reminder</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={sendEmailReminder}
                disabled={!canEmail || reminderState.status === 'sending'}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 3h10a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1zm0 1l5 4 5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {reminderState.status === 'sending' ? 'Sending…' : reminderState.status === 'sent' ? 'Email sent ✓' : 'Email reminder'}
              </button>
              {smsHref ? (
                <a
                  href={smsHref}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 transition-colors"
                  title="Opens your phone's text app pre-filled — sends from your own number"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 2h8a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 2.5V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Text reminder
                </a>
              ) : (
                <button type="button" disabled className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-400 cursor-not-allowed">
                  Text reminder (no phone on file)
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-2 leading-snug">
              Email goes through Postmark using your business info. Text opens your phone's messaging app pre-filled — you send it from your own number, no extra charge.
            </p>
            {reminderState.error && (
              <p className="text-xs text-red-600 mt-2">{reminderState.error}</p>
            )}
          </div>
        )}

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
