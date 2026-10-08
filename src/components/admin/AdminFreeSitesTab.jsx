import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATES } from '../../data/templates.js';
import { freeSiteAdmin } from '../../lib/freeSites.js';
import { FREE_SITE_STATUS_LABELS, customerName, freeSiteStatus, isEmail } from '../../lib/freeSiteHandover.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import { formatDateTime, timeAgo } from './customSiteUi.jsx';

// Admin > Free websites (an AdminShell tab, rendered by AdminPage): add a
// customer, build their site with the normal builder (in your own account),
// then hand it to their account. "Build the site" opens the wizard with the
// row's marker (App onBuildSite); the server links the saved site to the
// row. The hand-over is the custom websites' one (free-site-admin).
// `openHandoverId`: a row whose hand-over box opens once the list loads (the
// builder's last step, a Sites card's "Hand over"); `onHandoverShown` tells
// App it was used, so coming back to the tab doesn't open it again.

const BTN = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-black/[0.12] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors whitespace-nowrap';
const BTN_DARK = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-[12px] font-semibold disabled:opacity-50 transition-colors whitespace-nowrap';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[12px] font-bold transition-colors whitespace-nowrap';
const INPUT = 'w-full px-3 py-2.5 rounded-lg border border-black/[0.12] text-sm focus:outline-none focus:border-[#cc0000]';

const STATUS_STYLES = {
  not_started: 'bg-gray-100 text-gray-700',
  building: 'bg-amber-50 text-amber-800',
  handed_over: 'bg-emerald-50 text-emerald-800',
};

const FILTERS = [
  ['open', 'In progress'],
  ['handed_over', 'Handed over'],
  ['all', 'All'],
];

const templateLabel = (id) => TEMPLATES[id]?.label || '';
const shortUrl = (url) => String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

export default function AdminFreeSitesTab({ onBuildSite, onOpenSiteEditor, openHandoverId = null, onHandoverShown }) {
  const { toast, confirm } = useAlert();
  const pendingHandover = useRef({ id: openHandoverId, shown: onHandoverShown });
  const [rows, setRows] = useState([]);
  const [mySites, setMySites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('open');
  const [modal, setModal] = useState(null); // { kind: 'add' | 'edit' | 'link' | 'handover', row? }

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await freeSiteAdmin('list');
      setRows(res.handovers || []);
      setMySites(res.mySites || []);
      setErr('');
      const pending = pendingHandover.current;
      if (pending.id) {
        pendingHandover.current = { id: null };
        pending.shown?.();
        const row = (res.handovers || []).find((r) => r.id === pending.id);
        if (row && freeSiteStatus(row) === 'building') setModal({ kind: 'handover', row });
        else if (row && !row.handed_over_at) toast(`${customerName(row)}'s site isn't linked yet. Use "Use a site I built" on their row.`, 'error', 7000);
      }
    } catch (e) {
      setErr(e.message || 'Could not load free websites');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const counts = useMemo(() => {
    const c = { open: 0, handed_over: 0, all: rows.length };
    for (const r of rows) c[r.handed_over_at ? 'handed_over' : 'open'] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'open' && r.handed_over_at) return false;
      if (filter === 'handed_over' && !r.handed_over_at) return false;
      if (!q) return true;
      return [customerName(r), r.client_email, r.business_name, r.client_phone, r.site?.name]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, search, filter]);

  const replaceRow = (next) => setRows((prev) => {
    const found = prev.some((r) => r.id === next.id);
    return found ? prev.map((r) => (r.id === next.id ? next : r)) : [next, ...prev];
  });

  async function remove(row) {
    const ok = await confirm(
      row.site && !row.handed_over_at
        ? `Remove ${customerName(row)} from Free websites? Their site stays in ${row.site.ownerEmail || 'its builder'}'s Sites.`
        : `Remove ${customerName(row)} from Free websites?`,
      { title: 'Remove?', confirmText: 'Remove', danger: true },
    );
    if (!ok) return;
    try {
      await freeSiteAdmin('delete', { id: row.id });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      refresh();
    } catch (e) {
      toast(e.message || 'Could not remove', 'error');
    }
  }

  async function resend(row) {
    try {
      await freeSiteAdmin('handover-email', { id: row.id });
      toast(`Access email sent to ${row.client_email}`, 'success');
      refresh();
    } catch (e) {
      toast(e.message || 'The email did not send', 'error');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <p className="text-sm text-[#555] max-w-xl">
          Build a customer's site with the normal builder, in your own account, then hand it to theirs. They get an email to sign in.
        </p>
        <button
          type="button"
          onClick={() => setModal({ kind: 'add' })}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white text-[13px] font-bold shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add customer
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, business…"
          aria-label="Search free websites"
          className="flex-1 min-w-[220px] sm:max-w-xs px-3 py-2 border border-black/[0.10] rounded-lg text-sm focus:outline-none focus:border-[#cc0000]"
        />
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
              filter === id ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white text-[#555] border-black/[0.10] hover:border-[#cc0000]/40'
            }`}
          >
            {label} <span className={`ml-1 ${filter === id ? 'opacity-70' : 'text-ink-tertiary'}`}>{counts[id] || 0}</span>
          </button>
        ))}
        <button type="button" onClick={refresh} className="ml-auto text-xs text-gray-500 hover:text-[#1a1a1a]">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {err ? (
        <div className="rounded-xl border border-[#cc0000]/20 bg-[#fff5f5] px-4 py-3 text-sm text-[#cc0000]">{err}</div>
      ) : loading && rows.length === 0 ? (
        <p className="text-sm text-ink-tertiary py-10 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-black/[0.07] rounded-xl px-6 py-14 text-center">
          <p className="text-[16px] font-bold text-[#1a1a1a]">No free websites yet</p>
          <p className="mt-1 text-sm text-ink-tertiary">Add a customer, build their site, and hand it to their account when it's ready.</p>
          <button type="button" onClick={() => setModal({ kind: 'add' })} className={`${BTN_DARK} mt-5 px-4 py-2.5 text-[13px]`}>
            Add customer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-tertiary text-center py-10">Nothing matches.</p>
      ) : (
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-[#faf9f7] text-left text-[10px] text-ink-tertiary uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 text-right">Next</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Row
                  key={r.id}
                  row={r}
                  onBuild={() => onBuildSite?.(r)}
                  onOpen={() => onOpenSiteEditor?.(r.site.id)}
                  onLink={() => setModal({ kind: 'link', row: r })}
                  onEdit={() => setModal({ kind: 'edit', row: r })}
                  onHandover={() => setModal({ kind: 'handover', row: r })}
                  onResend={() => resend(r)}
                  onRemove={() => remove(r)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modal?.kind === 'add' || modal?.kind === 'edit') && (
        <CustomerModal
          row={modal.row}
          mySites={mySites}
          onClose={() => setModal(null)}
          onSaved={(row, { build }) => {
            replaceRow(row);
            setModal(null);
            if (build) onBuildSite?.(row);
            else refresh();
          }}
        />
      )}
      {modal?.kind === 'link' && (
        <LinkSiteModal
          row={modal.row}
          mySites={mySites}
          onClose={() => setModal(null)}
          onSaved={(row) => { replaceRow(row); setModal(null); refresh(); }}
        />
      )}
      {modal?.kind === 'handover' && (
        <HandoverModal
          row={modal.row}
          onClose={() => setModal(null)}
          onDone={(row) => { replaceRow(row); setModal(null); refresh(); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {FREE_SITE_STATUS_LABELS[status]}
    </span>
  );
}

function Row({ row, onBuild, onOpen, onLink, onEdit, onHandover, onResend, onRemove }) {
  const status = freeSiteStatus(row);
  const site = row.site;
  const name = customerName(row);
  return (
    <tr className="border-t border-black/[0.05] align-top">
      <td className="px-4 py-3">
        <p className="font-semibold text-[#1a1a1a] truncate max-w-[240px]">{row.business_name || name}</p>
        <p className="text-[11px] text-ink-tertiary truncate max-w-[240px]">{row.business_name ? `${name} · ` : ''}{row.client_email}</p>
        {row.note && <p className="mt-1 text-[11px] text-[#555] line-clamp-2 max-w-[240px]">{row.note}</p>}
      </td>
      <td className="px-4 py-3 text-[12px]">
        {site ? (
          <>
            <p className="font-semibold text-[#1a1a1a] truncate max-w-[220px]">{site.name || 'Untitled site'}</p>
            <p className="text-ink-tertiary">{templateLabel(site.templateId)}{site.updatedAt ? ` · edited ${timeAgo(site.updatedAt)}` : ''}</p>
            {site.publishedUrl ? (
              <a href={site.publishedUrl} target="_blank" rel="noreferrer" className="text-[#cc0000] hover:underline truncate block max-w-[220px]">{shortUrl(site.publishedUrl)}</a>
            ) : (
              <p className="text-amber-800">Not published yet</p>
            )}
          </>
        ) : (
          <p className="text-ink-tertiary">Not built yet</p>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
        {status === 'handed_over' ? (
          <p className="mt-1 text-[11px] text-ink-tertiary whitespace-nowrap">
            {formatDateTime(row.handed_over_at)}{row.comp_pro ? ' · Pro included' : ' · Free plan'}
          </p>
        ) : site?.ownerEmail ? (
          <p className="mt-1 text-[11px] text-ink-tertiary truncate max-w-[180px]">In {site.ownerEmail}'s account</p>
        ) : null}
        {row.email_error && (
          <p className="mt-1 text-[11px] text-[#cc0000] max-w-[200px]">Email failed: {row.email_error}</p>
        )}
      </td>
      <td className="px-4 py-3 text-[12px] text-ink-tertiary whitespace-nowrap">
        {timeAgo(row.created_at)}
        {row.createdByEmail && <span className="block truncate max-w-[160px]">by {row.createdByEmail}</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-1.5">
          {status === 'not_started' && (
            <>
              <button type="button" onClick={onBuild} className={BTN_DARK}>Build the site</button>
              <button type="button" onClick={onLink} className={BTN}>Use a site I built</button>
            </>
          )}
          {status === 'building' && (
            <>
              <button type="button" onClick={onOpen} className={BTN}>Open in editor</button>
              <button type="button" onClick={onHandover} className={BTN_PRIMARY}>Hand over…</button>
            </>
          )}
          {status === 'handed_over' && (
            <button type="button" onClick={onResend} className={BTN}>Resend access email</button>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] whitespace-nowrap">
          {status !== 'handed_over' && <button type="button" onClick={onEdit} className="text-ink-tertiary hover:text-[#1a1a1a]">Edit details</button>}
          {status === 'building' && <button type="button" onClick={onLink} className="text-ink-tertiary hover:text-[#1a1a1a]">Change site</button>}
          <button type="button" onClick={onRemove} className="text-ink-tertiary hover:text-[#cc0000]">Remove</button>
        </div>
      </td>
    </tr>
  );
}

// Escape closes, the first field takes focus once. The tab passes a new
// onClose each render (a refresh can land while a modal is open), so it is
// read through a ref: re-running the effect would pull focus back to the
// first field mid-typing.
function useModal(onClose, firstRef) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    firstRef?.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [firstRef]);
}

function ModalFrame({ titleId, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.35)]"
        style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHead({ id, eyebrow = 'Free website', title, children }) {
  return (
    <div className="px-7 pt-7 pb-2">
      <p className="text-[10px] font-bold uppercase tracking-[2.5px] text-[#cc0000] mb-1.5">{eyebrow}</p>
      <h2 id={id} className="text-[22px] font-[900] tracking-tight text-[#1a1a1a]">{title}</h2>
      {children && <p className="mt-1 text-sm text-[#555]">{children}</p>}
    </div>
  );
}

function ModalFoot({ onClose, children }) {
  return (
    <div className="sticky bottom-0 px-7 py-4 bg-[#faf9f7] border-t border-black/[0.06] flex justify-end gap-2">
      <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-ink-tertiary hover:text-[#1a1a1a]">Cancel</button>
      {children}
    </div>
  );
}

function Field({ label, required, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12px] font-semibold text-[#1a1a1a] mb-1">
        {label}{required && <span className="text-[#cc0000]" aria-hidden="true"> *</span>}
      </span>
      {children}
    </label>
  );
}

function SitePicker({ sites, value, onChange }) {
  if (!sites.length) {
    return <p className="text-[12px] text-ink-tertiary">You have no other websites in your account. Build a new one instead.</p>;
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Your site" className={INPUT}>
      <option value="">Pick one of your sites…</option>
      {sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name || 'Untitled site'}{s.templateId ? ` · ${templateLabel(s.templateId)}` : ''}{s.publishedUrl ? ` · ${shortUrl(s.publishedUrl)}` : ' · not published'}
        </option>
      ))}
    </select>
  );
}

// Add (no row) or edit a customer. Adding also says how the site gets
// built: a new one in the builder (default) or one already in your account.
function CustomerModal({ row, mySites, onClose, onSaved }) {
  const editing = !!row;
  const [v, setV] = useState({
    firstName: row?.client_first_name || '',
    lastName: row?.client_last_name || '',
    email: row?.client_email || '',
    phone: row?.client_phone || '',
    businessName: row?.business_name || '',
    note: row?.note || '',
  });
  const [source, setSource] = useState('new'); // 'new' | 'existing'
  const [siteId, setSiteId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef(null);
  useModal(onClose, firstRef);

  const set = (k) => (e) => setV((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!v.firstName.trim()) { setError('Enter the customer\'s first name.'); return; }
    if (!isEmail(v.email)) { setError('Enter a valid email address. Their account will use it.'); return; }
    if (!editing && source === 'existing' && !siteId) { setError('Pick one of your sites, or build a new one.'); return; }
    setSaving(true);
    try {
      const res = editing
        ? await freeSiteAdmin('update', { id: row.id, ...v })
        : await freeSiteAdmin('create', { ...v, ...(source === 'existing' ? { siteId } : {}) });
      onSaved(res.handover, { build: !editing && source === 'new' });
    } catch (err) {
      setError(err.message || 'Could not save');
      setSaving(false);
    }
  }

  return (
    <ModalFrame titleId="free-site-customer-title" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <ModalHead id="free-site-customer-title" title={editing ? 'Edit customer' : 'Add a customer'}>
          {editing
            ? 'The email is the account the site goes to.'
            : 'Their email is the account the site goes to. We create one at hand-over if they don\'t have it yet.'}
        </ModalHead>
        <div className="px-7 py-4 grid grid-cols-2 gap-3">
          <Field label="First name" required className="col-span-2 sm:col-span-1">
            <input ref={firstRef} value={v.firstName} onChange={set('firstName')} autoComplete="off" className={INPUT} />
          </Field>
          <Field label="Last name" className="col-span-2 sm:col-span-1">
            <input value={v.lastName} onChange={set('lastName')} autoComplete="off" className={INPUT} />
          </Field>
          <Field label="Email" required className="col-span-2">
            <input type="email" value={v.email} onChange={set('email')} autoComplete="off" className={INPUT} />
          </Field>
          <Field label="Business name" className="col-span-2 sm:col-span-1">
            <input value={v.businessName} onChange={set('businessName')} autoComplete="off" className={INPUT} />
          </Field>
          <Field label="Phone" className="col-span-2 sm:col-span-1">
            <input type="tel" value={v.phone} onChange={set('phone')} autoComplete="off" className={INPUT} />
          </Field>
          <Field label="Note for the team (optional)" className="col-span-2">
            <textarea value={v.note} onChange={set('note')} rows={2} placeholder="Met at the car show, wants the red template…" className={`${INPUT} leading-relaxed`} />
          </Field>
          {!editing && (
            <fieldset className="col-span-2 mt-1">
              <legend className="text-[12px] font-semibold text-[#1a1a1a] mb-1.5">The site</legend>
              <label className="flex items-start gap-2.5 text-[13px] text-[#1a1a1a] cursor-pointer">
                <input type="radio" name="free-site-source" checked={source === 'new'} onChange={() => setSource('new')} className="mt-0.5 w-4 h-4 accent-[#cc0000]" />
                <span>
                  <span className="font-semibold">Build it now</span>
                  <span className="block text-[12px] text-ink-tertiary">Opens the builder with their business name and phone filled in. The site is saved in your account until you hand it over.</span>
                </span>
              </label>
              <label className="mt-2 flex items-start gap-2.5 text-[13px] text-[#1a1a1a] cursor-pointer">
                <input type="radio" name="free-site-source" checked={source === 'existing'} onChange={() => setSource('existing')} className="mt-0.5 w-4 h-4 accent-[#cc0000]" />
                <span className="flex-1">
                  <span className="font-semibold">Use a site I already built</span>
                  <span className="block text-[12px] text-ink-tertiary">One of the websites in your own account.</span>
                </span>
              </label>
              {source === 'existing' && (
                <div className="mt-2 pl-6"><SitePicker sites={mySites} value={siteId} onChange={setSiteId} /></div>
              )}
            </fieldset>
          )}
          {error && <p role="alert" className="col-span-2 text-[13px] font-medium text-[#cc0000]">{error}</p>}
        </div>
        <ModalFoot onClose={onClose}>
          <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold">
            {saving ? 'Saving…' : editing ? 'Save' : source === 'new' ? 'Add & open the builder' : 'Add customer'}
          </button>
        </ModalFoot>
      </form>
    </ModalFrame>
  );
}

function LinkSiteModal({ row, mySites, onClose, onSaved }) {
  const [siteId, setSiteId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useModal(onClose);
  // The row's own site is not in mySites (a row holds it), so changing
  // the site lists only the others.
  async function save() {
    if (!siteId) { setError('Pick one of your sites.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await freeSiteAdmin('link-site', { id: row.id, siteId });
      onSaved(res.handover);
    } catch (e) {
      setError(e.message || 'Could not use that site');
      setSaving(false);
    }
  }
  return (
    <ModalFrame titleId="free-site-link-title" onClose={onClose}>
      <ModalHead id="free-site-link-title" title={`${customerName(row)}'s site`}>
        Pick a website you already built in your account. It's handed over to {row.client_email} when you're ready.
      </ModalHead>
      <div className="px-7 py-4">
        <SitePicker sites={mySites} value={siteId} onChange={setSiteId} />
        {error && <p role="alert" className="mt-2 text-[13px] font-medium text-[#cc0000]">{error}</p>}
      </div>
      <ModalFoot onClose={onClose}>
        <button type="button" onClick={save} disabled={saving || !mySites.length} className="px-4 py-2.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold">
          {saving ? 'Saving…' : 'Use this site'}
        </button>
      </ModalFoot>
    </ModalFrame>
  );
}

function HandoverModal({ row, onClose, onDone }) {
  const { toast, confirm } = useAlert();
  const [account, setAccount] = useState(undefined); // undefined = loading, null = none
  const [checkError, setCheckError] = useState('');
  const [compPro, setCompPro] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const site = row.site;
  const first = row.client_first_name || 'the customer';
  useModal(onClose);

  useEffect(() => {
    let live = true;
    freeSiteAdmin('handover-check', { id: row.id })
      .then((res) => { if (live) setAccount(res.account || null); })
      .catch((e) => { if (live) { setAccount(null); setCheckError(e.message || 'Could not check the email'); } });
    return () => { live = false; };
  }, [row.id]);

  const websites = (account?.sites || []).filter((s) => s.type === 'website');
  const pro = compPro && !account?.isPro;

  async function handOver() {
    const lines = [
      account ? `Move the site to ${account.email}'s account.` : `Create an account for ${row.client_email} and move the site there.`,
      pro ? 'Give them Pro (bookings and payments) at no charge.' : null,
      !compPro && !account?.isPro ? 'They stay on the free plan.' : null,
      sendEmail ? (account ? 'Email them that the site is in their account.' : 'Email them a link to set their password.') : 'Send no email.',
      'After this, they edit and publish it from their account.',
    ].filter(Boolean);
    const ok = await confirm(lines.join(' '), { title: 'Hand the site over?', confirmText: 'Hand over' });
    if (!ok) return;
    setBusy(true);
    try {
      // Never comp Pro on top of a plan they pay for.
      const res = await freeSiteAdmin('handover', { id: row.id, compPro: pro, sendEmail });
      if (res.emailError) toast(`Handed over, but the email didn't send: ${res.emailError}`, 'error');
      else toast(`The site is in ${row.client_email}'s account now`, 'success');
      if (res.widgetsRemoved && site?.publishedUrl) {
        toast('Your own reviews widget was taken off the site. Republish it from their account (Customers › View as user) to update the live page.', 'info', 9000);
      }
      onDone(res.handover);
    } catch (e) {
      toast(e.message || 'Could not hand over', 'error');
      setBusy(false);
    }
  }

  return (
    <ModalFrame titleId="free-site-handover-title" onClose={onClose}>
      <ModalHead id="free-site-handover-title" title={`Hand over to ${first}`}>
        {site?.name || 'The site'} moves from your account to {row.client_email}, with any bookings and messages it already has.
      </ModalHead>
      <div className="px-7 py-4 text-[13px]">
        {account === undefined ? (
          <p className="text-ink-tertiary">Checking {row.client_email}…</p>
        ) : (
          <>
            {checkError && <p role="alert" className="mb-2 text-[#cc0000]">{checkError}</p>}
            {account?.isAdmin ? (
              <p className="text-[#cc0000] font-medium">{row.client_email} is an admin account. Use the customer's own email (Edit details).</p>
            ) : account ? (
              <p className="text-[#1a1a1a]">
                {first} has an account ({account.email}){account.isPro ? ' on Pro' : ' on the free plan'}.
                {websites.length > 0 && (
                  <span className="block mt-1 text-amber-800">
                    They already have a website ({websites.map((s) => s.name || 'unnamed').join(', ')}). This becomes another one.
                  </span>
                )}
              </p>
            ) : (
              <p className="text-[#1a1a1a]">{first} doesn't have an account yet. We'll create one for {row.client_email}.</p>
            )}
            {!account?.isPro && !account?.isAdmin && (
              <label className="mt-3 flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={compPro} onChange={(e) => setCompPro(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#cc0000]" />
                <span>
                  Include Pro at no charge
                  <span className="block text-[11px] text-ink-tertiary">Off: they're on the free plan (free-plan badge, no bookings), like anyone who signs up.</span>
                </span>
              </label>
            )}
            <label className="mt-2 flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#cc0000]" />
              <span>Email {first} {account ? 'that it\'s in their account' : 'a link to set their password'}</span>
            </label>
            {site && !site.publishedUrl && (
              <p className="mt-3 text-[12px] text-amber-800">The site isn't published yet. Open it in the editor and press Publish first, so it's live when they sign in.</p>
            )}
            {pro && site?.publishedUrl && (
              <p className="mt-3 text-[12px] text-ink-tertiary">The live page keeps the free-plan badge until it's republished from their account.</p>
            )}
          </>
        )}
      </div>
      <ModalFoot onClose={onClose}>
        <button
          type="button"
          onClick={handOver}
          disabled={busy || account === undefined || !!account?.isAdmin}
          className="px-4 py-2.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold"
        >
          {busy ? 'Handing over…' : 'Hand over'}
        </button>
      </ModalFoot>
    </ModalFrame>
  );
}
