import { useEffect, useMemo, useState } from 'react';
import { BUSINESS_TYPES } from '../../../data/businessTypes.js';
import { useLead } from '../../../lib/pipeline.js';
import { SOURCES, initials, journeyFor, movementLabel, timeAgo } from '../../../lib/pipelineFilters.js';
import { siteHref } from '../../../lib/prospectFilters.js';
import { Avatar, BTN_DARK, BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, ErrorBox, Field, INPUT, LINK } from '../salesUi.jsx';

/** What this lead has actually done, not what we hoped: a skipped stage stays grey. */
function JourneyStrip({ steps }) {
  return (
    <ol className="flex flex-wrap gap-1.5">
      {steps.map((s) => (
        <li
          key={s.id}
          title={s.enteredAt ? `Entered ${timeAgo(s.enteredAt)} ago` : undefined}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            s.current
              ? 'border-[#cc0000] bg-[#cc0000] text-white'
              : s.done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-black/[0.08] text-ink-tertiary'
          }`}
        >
          {s.done && <span aria-hidden="true">✓ </span>}
          {s.name}
        </li>
      ))}
    </ol>
  );
}

function Timeline({ movements, stagesById }) {
  if (!movements.length) return <p className="text-sm text-ink-tertiary">No moves yet.</p>;
  return (
    <ol className="relative ml-1.5 border-l border-black/[0.08] space-y-4">
      {movements.map((m) => (
        <li key={m.id} className="pl-4 relative">
          <span aria-hidden="true" className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#cc0000]" />
          <p className="text-[13px] font-semibold text-[#1a1a1a]">{movementLabel(m, stagesById)}</p>
          <p className="text-[11px] text-ink-tertiary">{[m.moverName, `${timeAgo(m.createdAt)} ago`].filter(Boolean).join(' · ')}</p>
          {m.note && <p className="mt-1 rounded-lg bg-[#faf9f7] px-3 py-2 text-[13px] text-[#555] whitespace-pre-wrap">{m.note}</p>}
        </li>
      ))}
    </ol>
  );
}

function Notes({ notes, userId, disabled, onAdd, onDelete }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="space-y-3">
      {notes.length === 0 && <p className="text-sm text-ink-tertiary">No notes yet.</p>}
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="flex gap-2.5">
            <Avatar text={initials(n.authorName)} title={n.authorName || ''} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-ink-tertiary">
                <span className="font-semibold text-[#1a1a1a]">{n.authorName || 'Someone'}</span> · {timeAgo(n.createdAt)} ago
                {n.authorId === userId && (
                  <button type="button" onClick={() => onDelete(n.id)} className="ml-2 hover:text-[#cc0000]">Delete</button>
                )}
              </p>
              <p className="mt-0.5 text-[13px] text-[#1a1a1a] whitespace-pre-wrap break-words">{n.body}</p>
            </div>
          </li>
        ))}
      </ul>
      {!disabled && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const res = await onAdd(body);
            setBusy(false);
            if (res?.error) setError(res.error);
            else setBody('');
          }}
          className="space-y-2"
        >
          <textarea rows={3} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" aria-label="Add a note" className={`${INPUT} leading-relaxed`} />
          {error && <p role="alert" className="text-[12px] font-semibold text-[#cc0000]">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={busy || !body.trim()} className={BTN_SECONDARY}>{busy ? 'Saving…' : 'Add note'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * A field that saves on blur, and only when it changed. Also for dates: a
 * date input fires change on every typed digit, so saving on change wrote
 * year 0002 after the first digit of "2026". `nonce` remounts it with the
 * saved value after a failed save, so it never shows text that isn't saved.
 */
function BlurInput({ value, onSave, disabled, nonce = 0, ...rest }) {
  return (
    <input
      key={`${value ?? ''}:${nonce}`}
      defaultValue={value ?? ''}
      disabled={disabled}
      onBlur={(e) => {
        // A half-typed date reads as '' here: put the saved one back rather
        // than clearing it.
        if (e.target.validity?.badInput) { e.target.value = value ?? ''; return; }
        const next = e.target.value.trim();
        if (next === (value ?? '')) return;
        onSave(next === '' ? null : next);
      }}
      className={INPUT}
      {...rest}
    />
  );
}

/**
 * The lead in full, in a drawer over the board. Its own fetch, so it opens
 * from a card, from the Leads tab, or from a link, and it keeps its own copy
 * fresh after every write (otherwise a select visibly snaps back to the old
 * value while the board catches up).
 */
export default function LeadDrawer({
  leadId, version = 0, blocked = false, stages, admins, userId, onClose, onUpdate, onMove, onConvert, onArchive, onUnarchive,
}) {
  const { lead, movements, notes, loading, error, refresh, addNote, deleteNote } = useLead(leadId);
  const [tab, setTab] = useState('journey');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [nonce, setNonce] = useState(0);
  const stagesById = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s])), [stages]);
  const steps = useMemo(() => (lead ? journeyFor(stages, movements, lead.stageId) : []), [stages, movements, lead]);

  // A move or conversion made from the board's dialogs changed this lead.
  useEffect(() => { if (version) refresh(); }, [version, refresh]);

  // Escape closes the drawer, but not while a dialog opened from it (Move,
  // They bought…) is on top: that Escape belongs to the dialog.
  useEffect(() => {
    if (blocked) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, blocked]);

  // A failed save says so, and the fields go back to what is saved.
  const write = async (fn) => {
    setBusy(true);
    const res = await fn();
    await refresh();
    setBusy(false);
    if (res?.error) { setSaveError(res.error); setNonce((n) => n + 1); } else setSaveError('');
    return res;
  };
  const patch = (fields) => write(() => onUpdate(leadId, fields));

  const stage = lead ? stagesById[lead.stageId] : null;
  const converted = Boolean(lead?.accountUserId || lead?.customProjectId);
  const archived = Boolean(lead?.archivedAt);
  const place = lead ? [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ') : '';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[80]" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={lead?.companyName || 'Lead'}
        className="fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white z-[90] shadow-[0_0_60px_-12px_rgba(0,0,0,0.35)] overflow-y-auto"
        style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-black/[0.06] px-6 py-3 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-tertiary">Lead</span>
          <button type="button" onClick={onClose} className={BTN_GHOST}>Close</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loading && <div className="h-24 animate-pulse rounded-xl bg-[#faf9f7]" />}
          {error && <ErrorBox onRetry={refresh}>{error}</ErrorBox>}
          {!loading && !error && !lead && <p className="text-sm text-ink-tertiary">That lead is gone.</p>}

          {!loading && lead && (
            <>
              <header className="space-y-1.5">
                <h2 className="text-[22px] font-[900] tracking-tight text-[#1a1a1a]">{lead.companyName}</h2>
                {place && <p className="text-sm text-[#555]">{place}</p>}
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {lead.contactName && <span className="text-[#555]">{lead.contactName}</span>}
                  {lead.phone && <a href={`tel:${lead.phone}`} className={LINK}>{lead.phone}</a>}
                  {lead.email && <a href={`mailto:${lead.email}`} className={LINK}>{lead.email}</a>}
                  {siteHref(lead.website) && <a href={siteHref(lead.website)} target="_blank" rel="noreferrer" className={LINK}>Website ↗</a>}
                </p>
                <p className="text-[12px] text-ink-tertiary">
                  In {stage?.name || 'a hidden stage'} · added {timeAgo(lead.createdAt)} ago{lead.createdByName ? ` by ${lead.createdByName}` : ''}
                  {lead.source ? ` · ${lead.source}` : ''}
                </p>
              </header>

              <JourneyStrip steps={steps} />

              {converted && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-emerald-700">They bought.</p>
                  {lead.accountUserId && (
                    <p className="text-[#555]">Account: <span className="font-semibold text-[#1a1a1a]">{lead.accountName || 'linked'}</span>{lead.accountEmail ? ` (${lead.accountEmail})` : ''}</p>
                  )}
                  {lead.customProjectId && (
                    <p className="text-[#555]">
                      Custom website:{' '}
                      <a href={`/?admin=custom-sites&project=${lead.customProjectId}`} target="_blank" rel="noreferrer" className={LINK}>Open the project ↗</a>
                    </p>
                  )}
                </div>
              )}

              {archived && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                  <span className="text-amber-800">Archived {timeAgo(lead.archivedAt)} ago.</span>
                  <button type="button" disabled={busy} onClick={() => write(() => onUnarchive(lead.id))} className={BTN_SECONDARY}>Restore</button>
                </div>
              )}

              {lead.lostReason && (
                <div className="rounded-xl border border-black/[0.07] bg-[#faf9f7] px-4 py-3 text-sm">
                  <span className="font-semibold text-[#555]">Lost because: </span>
                  <span className="text-[#1a1a1a]">{lead.lostReason}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <span className="block text-[12px] font-semibold text-[#1a1a1a] mb-1">Stage</span>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate rounded-lg border border-black/[0.12] px-3 py-2.5 text-sm text-[#1a1a1a]">{stage?.name || '—'}</span>
                    <button type="button" disabled={archived || converted || busy} onClick={() => onMove(lead)} className={BTN_SECONDARY}>Move</button>
                  </div>
                </div>
                <Field label="Owner" className="col-span-2 sm:col-span-1">
                  <select value={lead.ownerId || ''} disabled={archived || busy} onChange={(e) => patch({ owner_id: e.target.value || null })} className={INPUT}>
                    <option value="">Unassigned</option>
                    {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="Next action" className="col-span-2 sm:col-span-1">
                  <BlurInput type="date" value={lead.nextActionOn} nonce={nonce} disabled={archived || busy} onSave={(v) => patch({ next_action_on: v })} />
                </Field>
                <Field label="Est. $ / month" className="col-span-2 sm:col-span-1">
                  <input
                    key={`${lead.estMonthlyValue ?? ''}:${nonce}`}
                    inputMode="decimal"
                    defaultValue={lead.estMonthlyValue ?? ''}
                    disabled={archived || busy}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const next = raw === '' ? null : Number(raw);
                      if (next !== null && (Number.isNaN(next) || next < 0)) { e.target.value = lead.estMonthlyValue ?? ''; return; }
                      if (next === (lead.estMonthlyValue ?? null)) return;
                      patch({ est_monthly_value: next });
                    }}
                    className={INPUT}
                  />
                </Field>
                <Field label="Business type" className="col-span-2 sm:col-span-1">
                  <select value={lead.businessType || ''} disabled={archived || busy} onChange={(e) => patch({ business_type: e.target.value || null })} className={INPUT}>
                    <option value="">—</option>
                    {BUSINESS_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Source" className="col-span-2 sm:col-span-1">
                  <select value={lead.source || ''} disabled={archived || busy} onChange={(e) => patch({ source: e.target.value || null })} className={INPUT}>
                    <option value="">—</option>
                    {[...new Set([...SOURCES, ...(lead.source ? [lead.source] : [])])].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Contact name" className="col-span-2 sm:col-span-1">
                  <BlurInput value={lead.contactName} nonce={nonce} disabled={archived || busy} onSave={(v) => patch({ contact_name: v })} />
                </Field>
                <Field label="Phone" className="col-span-2 sm:col-span-1">
                  <BlurInput type="tel" value={lead.phone} nonce={nonce} disabled={archived || busy} onSave={(v) => patch({ phone: v })} />
                </Field>
                <Field label="Email" className="col-span-2 sm:col-span-1">
                  <BlurInput type="email" value={lead.email} nonce={nonce} disabled={archived || busy} onSave={(v) => patch({ email: v })} />
                </Field>
                <Field label="Current website" className="col-span-2 sm:col-span-1">
                  <BlurInput value={lead.website} nonce={nonce} disabled={archived || busy} onSave={(v) => patch({ website: v })} />
                </Field>
              </div>

              {saveError && <ErrorBox>Not saved: {saveError}</ErrorBox>}

              <div className="flex flex-wrap gap-2">
                {!converted && !archived && (
                  <button type="button" onClick={() => onConvert(lead)} className={BTN_PRIMARY}>They bought…</button>
                )}
                {!archived && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => { const res = await write(() => onArchive(lead.id)); if (!res?.error) onClose(); }}
                    className={BTN_DARK}
                  >
                    Archive
                  </button>
                )}
              </div>

              <div>
                <div role="tablist" aria-label="Lead history" className="flex gap-1 rounded-lg border border-black/[0.07] p-1">
                  {[
                    { key: 'journey', label: `Journey (${movements.length})` },
                    { key: 'notes', label: `Notes (${notes.length})` },
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-semibold ${tab === t.key ? 'bg-[#1a1a1a] text-white' : 'text-[#555] hover:text-[#1a1a1a]'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  {tab === 'journey'
                    ? <Timeline movements={movements} stagesById={stagesById} />
                    : <Notes notes={notes} userId={userId} disabled={archived} onAdd={(b) => addNote(b, userId)} onDelete={deleteNote} />}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
