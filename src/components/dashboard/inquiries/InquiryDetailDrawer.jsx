import { useState, useEffect } from 'react';
import InquiryStatusPill from './InquiryStatusPill.jsx';
import { shopLines } from './InquiriesList.jsx';
import { isImpersonationTab } from '../../../lib/supabase.js';
import { updateInquiryStatus, saveInquiryOwnerNotes } from '../../../lib/inquiries.js';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const ACTIONS_FOR = {
  new:      [{ to: 'read',     label: 'Mark read',   primary: true },
             { to: 'archived', label: 'Archive',     primary: false }],
  read:     [{ to: 'new',      label: 'Mark unread', primary: true },
             { to: 'archived', label: 'Archive',     primary: false }],
  archived: [{ to: 'read',     label: 'Restore',     primary: true }],
};

function hostOf(url) {
  return String(url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

// readOnly: someone other than the owner is looking (Admin > All inquiries),
// so no status changes and no note edits. A "View as user" tab is always
// read-only. shop (all-shops view only) names whose inquiry this is.
export default function InquiryDetailDrawer({ inquiry, onClose, onUpdated, readOnly = false, shop = null }) {
  const [i, setI] = useState(inquiry);
  const [notes, setNotes] = useState(inquiry?.owner_notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { setI(inquiry); setNotes(inquiry?.owner_notes || ''); setErr(null); }, [inquiry?.id]);

  if (!i) return null;

  const locked = readOnly || isImpersonationTab;

  async function setStatus(to) {
    if (locked) return;
    setBusy(true); setErr(null);
    try {
      const updated = await updateInquiryStatus(i.id, to);
      setI(updated);
      onUpdated && onUpdated(updated);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function onNotesBlur() {
    if (locked || notes === (i.owner_notes || '')) return;
    try {
      const updated = await saveInquiryOwnerNotes(i.id, notes);
      setI(updated);
      onUpdated && onUpdated(updated);
    } catch (e) { setErr(e.message); }
  }

  const actions = ACTIONS_FOR[i.status] || [];

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
          <InquiryStatusPill status={i.status} />
        </div>

        <h2 className="text-xl font-black text-[#1a1a1a]">{i.name}</h2>
        <p className="text-sm text-gray-500 mb-4">
          <a href={`mailto:${i.email}`} className="hover:underline">{i.email}</a>
          {i.phone ? (<>{' · '}<a href={`tel:${i.phone}`} className="hover:underline">{i.phone}</a></>) : null}
        </p>

        <dl className="text-sm space-y-2 mb-6">
          {shop && <ShopRow shop={shop} />}
          <div className="flex gap-2">
            <dt className="w-20 text-gray-500 shrink-0">Message</dt>
            <dd className="text-gray-800 break-words whitespace-pre-wrap">{i.message}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 text-gray-500 shrink-0">Received</dt>
            <dd className="text-gray-800">{fmt(i.created_at)}</dd>
          </div>
        </dl>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Owner notes (private)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={onNotesBlur}
          rows={3}
          readOnly={locked}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-gray-400 read-only:opacity-60 read-only:cursor-not-allowed"
        />

        {readOnly && !isImpersonationTab && (
          <p className="mt-2 text-xs text-gray-500">Read-only: the status and notes belong to the shop owner.</p>
        )}

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        {!locked && actions.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.to}
                onClick={() => setStatus(a.to)}
                disabled={busy}
                className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${
                  a.primary
                    ? 'bg-[#cc0000] hover:bg-[#aa0000] text-white'
                    : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function ShopRow({ shop }) {
  const { title } = shopLines(shop);
  // Name and email both, minus whichever one already is the title.
  const owner = [shop.ownerName, shop.ownerEmail].filter((x) => x && x !== title).join(' · ');
  return (
    <div className="flex gap-2">
      <dt className="w-20 text-gray-500 shrink-0">Shop</dt>
      <dd className="text-gray-800 min-w-0">
        <span className="font-semibold">{title}</span>
        {shop.ownerIsAdmin && (
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#1a1a1a] text-white align-middle">ADMIN</span>
        )}
        {owner && <span className="block text-xs text-gray-500 break-words">{owner}</span>}
        {shop.siteUrl && (
          <a href={shop.siteUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#cc0000] hover:underline break-all">
            {hostOf(shop.siteUrl)}
          </a>
        )}
      </dd>
    </div>
  );
}
