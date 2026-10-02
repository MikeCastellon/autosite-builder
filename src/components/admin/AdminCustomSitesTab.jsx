import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { customSiteAdmin } from '../../lib/customSites.js';
import { STAGES, isEmail } from '../../lib/customSiteForm.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import CustomSiteProjectPage from './CustomSiteProjectPage.jsx';
import { StageBadge, copyText, duration, formatDateTime, timeAgo } from './customSiteUi.jsx';

// Custom websites (header nav): add a customer,
// email them the intake form link and track the build from "Form sent" to
// "Live". A project opens as a full page (CustomSiteProjectPage). The
// customer's side is /custom-site?t=<token> (CustomSiteFormPage).

function formStatus(p) {
  if (p.form_submitted_at) return { text: `Received ${formatDateTime(p.form_submitted_at)}`, tone: 'text-emerald-700 font-semibold' };
  if (p.form_saved_at) return { text: `In progress · ${timeAgo(p.form_saved_at)}`, tone: 'text-amber-700' };
  if (p.invite_sent_at) return { text: `Sent ${timeAgo(p.invite_sent_at)} · not started`, tone: 'text-ink-tertiary' };
  return { text: 'Link not sent', tone: 'text-ink-tertiary' };
}

export default function AdminCustomSitesTab({ initialProjectId, onOpenSiteEditor, onOpenBookingSettings }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active'); // 'active' | stage id
  const [openId, setOpenId] = useState(initialProjectId || null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { projects: list } = await customSiteAdmin('list');
      setProjects(list || []);
      setErr('');
    } catch (e) {
      setErr(e.message || 'Could not load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const counts = useMemo(() => {
    const c = { active: 0 };
    for (const p of projects) {
      c[p.stage] = (c[p.stage] || 0) + 1;
      if (p.stage !== 'archived') c.active += 1;
    }
    return c;
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (filter === 'active' ? p.stage === 'archived' : p.stage !== filter) return false;
      if (!q) return true;
      return [p.client_name, p.client_email, p.business_name, p.client_phone]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [projects, search, filter]);

  // Keeps the list row in step with the project page.
  const patchRow = useCallback((next) => {
    setProjects((prev) => prev.map((p) => (p.id === next.id ? { ...p, ...next } : p)));
  }, []);

  if (openId) {
    return (
      <CustomSiteProjectPage
        key={openId}
        projectId={openId}
        onBack={() => { setOpenId(null); refresh(); }}
        onChanged={patchRow}
        onDeleted={(id) => { setOpenId(null); setProjects((prev) => prev.filter((p) => p.id !== id)); }}
        onOpenSiteEditor={onOpenSiteEditor}
        onOpenBookingSettings={onOpenBookingSettings}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <p className="text-sm text-[#555] max-w-xl">
          Add a customer, send them their website form, and track the build from start to launch.
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white text-[13px] font-bold shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add customer
        </button>
      </div>

      {/* Pipeline: one card per stage, click to filter. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 mb-4">
        {STAGES.map((s, i) => {
          const on = filter === s.id;
          const n = counts[s.id] || 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilter(on ? 'active' : s.id)}
              aria-pressed={on}
              className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                on ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white' : 'bg-white border-black/[0.07] hover:border-[#cc0000]/40'
              }`}
            >
              <span className={`block text-[22px] font-[800] leading-none ${on ? 'text-white' : n ? 'text-[#1a1a1a]' : 'text-black/25'}`}>{n}</span>
              <span className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold leading-tight ${on ? 'text-white/80' : 'text-ink-tertiary'}`}>
                <span className="opacity-60">{i + 1}.</span> {s.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, business…"
          className="flex-1 min-w-[220px] sm:max-w-xs px-3 py-2 border border-black/[0.10] rounded-lg text-sm focus:outline-none focus:border-[#cc0000]"
        />
        {[
          ['active', 'All active'],
          ['on_hold', 'On hold'],
          ['archived', 'Archived'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
              filter === id ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white text-[#555] border-black/[0.10] hover:border-[#cc0000]/40'
            }`}
          >
            {label} <span className={`ml-1 ${filter === id ? 'opacity-70' : 'text-ink-tertiary'}`}>{counts[id] || 0}</span>
          </button>
        ))}
        <button onClick={refresh} className="ml-auto text-xs text-gray-500 hover:text-[#1a1a1a]">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {err ? (
        <div className="rounded-xl border border-[#cc0000]/20 bg-[#fff5f5] px-4 py-3 text-sm text-[#cc0000]">{err}</div>
      ) : loading && projects.length === 0 ? (
        <p className="text-sm text-ink-tertiary py-10 text-center">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="bg-white border border-black/[0.07] rounded-xl px-6 py-14 text-center">
          <p className="text-[16px] font-bold text-[#1a1a1a]">No custom websites yet</p>
          <p className="mt-1 text-sm text-ink-tertiary">Add your first customer to send them their website form.</p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-5 inline-flex px-4 py-2.5 rounded-lg bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-[13px] font-semibold"
          >
            Add customer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-tertiary text-center py-10">No projects match.</p>
      ) : (
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-[#faf9f7] text-left text-[10px] text-ink-tertiary uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Form</th>
                <th className="px-4 py-3">Files</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const fs = formStatus(p);
                return (
                  <tr
                    key={p.id}
                    onClick={() => setOpenId(p.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(p.id); }}
                    tabIndex={0}
                    className="border-t border-black/[0.05] hover:bg-[#faf9f7] cursor-pointer focus:outline-none focus-visible:bg-[#faf9f7]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1a1a1a] truncate max-w-[240px]">{p.business_name || p.client_name}</p>
                      <p className="text-[11px] text-ink-tertiary truncate max-w-[240px]">
                        {p.business_name ? `${p.client_name} · ` : ''}{p.client_email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={p.stage} />
                      {p.stageSince && <p className="mt-1 text-[11px] text-ink-tertiary whitespace-nowrap">for {duration(p.stageSince)}</p>}
                    </td>
                    <td className={`px-4 py-3 text-[12px] whitespace-nowrap ${fs.tone}`}>{fs.text}</td>
                    <td className="px-4 py-3 text-[12px] text-[#555]">{p.fileCount || <span className="text-ink-tertiary">—</span>}</td>
                    <td className="px-4 py-3">
                      {p.paid_at
                        ? <span className="text-[12px] font-semibold text-emerald-700">Paid</span>
                        : <span className="text-[12px] text-ink-tertiary">—</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-tertiary text-[12px] whitespace-nowrap">{timeAgo(p.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <AddCustomerModal
          onClose={() => setAdding(false)}
          onAdded={(p) => setProjects((prev) => [p, ...prev])}
          onOpen={(id) => { setAdding(false); setOpenId(id); }}
        />
      )}

    </div>
  );
}

const INPUT = 'w-full px-3 py-2.5 rounded-lg border border-black/[0.12] text-sm focus:outline-none focus:border-[#cc0000]';

function AddCustomerModal({ onClose, onAdded, onOpen }) {
  const { toast } = useAlert();
  const [v, setV] = useState({ firstName: '', lastName: '', clientEmail: '', note: '' });
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { project, emailError }
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k) => (e) => setV((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!v.firstName.trim()) { setError('Enter the customer\'s first name.'); return; }
    if (!isEmail(v.clientEmail)) { setError('Enter a valid email address.'); return; }
    setSaving(true);
    try {
      const res = await customSiteAdmin('create', { ...v, sendEmail });
      onAdded({ ...res.project, fileCount: 0 });
      setDone(res);
    } catch (err) {
      setError(err.message || 'Could not add the customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-custom-site-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.35)] overflow-hidden"
        style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
      >
        {done ? (
          <div className="px-7 py-8">
            <div className="w-12 h-12 rounded-full bg-[#cc0000]/10 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 id="add-custom-site-title" className="text-[22px] font-[900] tracking-tight text-[#1a1a1a]">
              {done.project.client_name} is added
            </h2>
            <p className="mt-1 text-sm text-[#555]">
              {done.emailError
                ? <span className="text-[#cc0000]">The welcome email didn't send ({done.emailError}). Copy the link below, or resend from their project.</span>
                : sendEmail
                  ? <>Welcome email sent to <strong>{done.project.client_email}</strong>.</>
                  : 'No email sent. Share their form link yourself:'}
            </p>
            <div className="mt-4 flex gap-2">
              <input readOnly value={done.project.formUrl} onFocus={(e) => e.target.select()} aria-label="Customer form link" className={`${INPUT} font-mono text-[12px] bg-[#faf9f7]`} />
              <button
                type="button"
                onClick={async () => toast(await copyText(done.project.formUrl) ? 'Form link copied' : 'Copy failed. Select the link and copy it.', 'info')}
                className="shrink-0 px-3 py-2 rounded-lg bg-white border border-black/[0.10] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40"
              >
                Copy
              </button>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-ink-tertiary hover:text-[#1a1a1a]">Done</button>
              <button type="button" onClick={() => onOpen(done.project.id)} className="px-4 py-2.5 rounded-lg bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-[13px] font-semibold">
                Open project
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="px-7 pt-7 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-[2.5px] text-[#cc0000] mb-1.5">Custom website</p>
              <h2 id="add-custom-site-title" className="text-[22px] font-[900] tracking-tight text-[#1a1a1a]">Add a customer</h2>
              <p className="mt-1 text-sm text-[#555]">
                Just their name and email. They'll tell us about their business, brand and photos in the form.
              </p>
            </div>
            <div className="px-7 py-4 grid grid-cols-2 gap-3">
              <Field label="First name" required className="col-span-2 sm:col-span-1">
                <input ref={firstRef} value={v.firstName} onChange={set('firstName')} autoComplete="off" className={INPUT} />
              </Field>
              <Field label="Last name" className="col-span-2 sm:col-span-1">
                <input value={v.lastName} onChange={set('lastName')} autoComplete="off" className={INPUT} />
              </Field>
              <Field label="Email" required className="col-span-2">
                <input type="email" value={v.clientEmail} onChange={set('clientEmail')} autoComplete="off" className={INPUT} />
              </Field>
              <label className="col-span-2 flex items-start gap-2.5 mt-1 text-[13px] text-[#1a1a1a] cursor-pointer">
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#cc0000]" />
                <span>
                  <span className="font-semibold">Send the welcome email now</span>
                  <span className="block text-[12px] text-ink-tertiary">It explains the process and links to their form. You can always copy the link instead.</span>
                </span>
              </label>
              {sendEmail && (
                <Field label="Personal note (optional)" className="col-span-2">
                  <textarea
                    value={v.note}
                    onChange={set('note')}
                    rows={3}
                    placeholder="Great talking with you today! Here's the form we mentioned…"
                    className={`${INPUT} leading-relaxed`}
                  />
                </Field>
              )}
              {error && <p role="alert" className="col-span-2 text-[13px] font-medium text-[#cc0000]">{error}</p>}
            </div>
            <div className="px-7 py-4 bg-[#faf9f7] border-t border-black/[0.06] flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-ink-tertiary hover:text-[#1a1a1a]">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold">
                {saving ? 'Adding…' : sendEmail ? 'Add & send email' : 'Add customer'}
              </button>
            </div>
          </form>
        )}
      </div>
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
