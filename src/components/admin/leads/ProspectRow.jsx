import { useState } from 'react';
import { categoryLabel } from '../../../lib/leadCategories.js';
import { WEBSITE_KINDS, bucketOf, mapsUrl, siteHref } from '../../../lib/prospectFilters.js';
import { BTN_PRIMARY, BTN_SECONDARY, LINK } from '../salesUi.jsx';
import ProspectNotes from './ProspectNotes.jsx';

const TONE = {
  hot: 'bg-[#cc0000] text-white border-[#cc0000]',
  warm: 'bg-[#fff5f5] text-[#cc0000] border-[#cc0000]/30',
  mild: 'bg-amber-50 text-amber-800 border-amber-200',
  cold: 'bg-[#faf9f7] text-ink-tertiary border-black/[0.08]',
};

/** The website badge: the reason a shop is a lead for us at all. */
export function WebsiteBadge({ kind }) {
  const k = WEBSITE_KINDS[kind] || WEBSITE_KINDS.none;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${TONE[k.tone]}`}>{k.short}</span>;
}

/**
 * One business. What it is, whether it has a website, how to reach it, and
 * the decision on it — which depends on the list it's on.
 */
export default function ProspectRow({
  prospect: p, chain = 0, noteCount = 0, userId, accountNames, onAction, onOpenLead, onUnmatch, onNoteCount,
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [unmatching, setUnmatching] = useState(false);
  const [rowError, setRowError] = useState('');
  const bucket = bucketOf(p);
  const meta = [
    categoryLabel(p.category),
    p.rating != null ? `★ ${Number(p.rating).toFixed(1)} (${p.rating_count || 0})` : 'No reviews',
    chain ? `Chain · ${chain} locations` : null,
  ].filter(Boolean).join(' · ');
  const place = [p.address, p.city, p.state].filter(Boolean).join(', ');
  const site = siteHref(p.website);

  return (
    <div className="rounded-xl border border-black/[0.07] bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-[#1a1a1a]">{p.name}</span>
            <WebsiteBadge kind={p.website_kind} />
          </p>
          <p className="mt-0.5 text-[12px] text-[#555]">{meta}</p>
          {place && <p className="text-[12px] text-ink-tertiary">{place}{p.google_type ? ` · ${p.google_type}` : ''}</p>}

          {bucket === 'dismissed' && (p.dismiss_reason || p.status_note) && (
            <p className="mt-1.5 text-[12px] text-[#555]">
              <span className="font-semibold">Not a fit:</span> {p.dismiss_reason}{p.status_note ? ` · ${p.status_note}` : ''}
            </p>
          )}
          {bucket === 'account' && (
            <p className="mt-1.5 text-[12px] text-emerald-700">
              Already has an account: <span className="font-semibold">{accountNames.get(p.match_user_id) || 'an account'}</span>
              {p.match_reason ? <span className="text-ink-tertiary"> · matched by {p.match_reason}</span> : null}
            </p>
          )}

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            {p.phone && <a href={`tel:${p.phone}`} className={LINK}>Call {p.phone}</a>}
            <a href={mapsUrl(p)} target="_blank" rel="noreferrer" className={LINK}>Map ↗</a>
            {site && <a href={site} target="_blank" rel="noreferrer" className={LINK}>Website ↗</a>}
            <button type="button" onClick={() => setShowNotes((v) => !v)} aria-expanded={showNotes} className={LINK}>
              Notes{noteCount ? ` (${noteCount})` : ''}
            </button>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {bucket === 'new' && (
            <>
              <button type="button" onClick={() => onAction('dismiss', p)} className={BTN_SECONDARY}>Not a fit</button>
              <button type="button" onClick={() => onAction('pipe', p)} className={`${BTN_PRIMARY} py-2 text-[12px]`}>Add to Pipeline</button>
            </>
          )}
          {bucket === 'piped' && p.lead_id && (
            <button type="button" onClick={() => onOpenLead(p.lead_id)} className={BTN_SECONDARY}>
              {p.status_by === userId ? 'In your Pipeline · ' : 'In Pipeline · '}open lead →
            </button>
          )}
          {bucket === 'account' && (
            <button
              type="button"
              disabled={unmatching}
              onClick={async () => {
                setUnmatching(true);
                setRowError('');
                const res = await onUnmatch(p);
                setUnmatching(false);
                if (res?.error) setRowError(res.error);
              }}
              className={BTN_SECONDARY}
            >
              Not this account
            </button>
          )}
          {bucket === 'dismissed' && (
            <button type="button" onClick={() => onAction('restore', p)} className={BTN_SECONDARY}>Put back</button>
          )}
        </div>
      </div>
      {rowError && <p role="alert" className="mt-2 text-[12px] font-semibold text-[#cc0000]">{rowError}</p>}
      {showNotes && <ProspectNotes prospectId={p.id} leadId={p.lead_id} userId={userId} onCount={onNoteCount} />}
    </div>
  );
}
