import { useCallback, useEffect, useRef, useState } from 'react';
import { customSiteAdmin } from '../../lib/customSites.js';
import {
  ASSET_KINDS, FORM_SECTIONS, STAGES, answerText, describeEvent, formatBytes, isFieldShown,
  isPreviewable, fileExtension, missingRecommended, safeHref, stageLabel,
} from '../../lib/customSiteForm.js';
import { useAlert } from '../ui/AlertProvider.jsx';

// One custom website project (Admin > Custom websites): where it is in the
// build, the customer's form link and emails, payment, the customer's
// answers and files, internal notes and the activity log.

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

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Section({ title, aside, children }) {
  return (
    <div className="border-b border-black/[0.07] py-5 last:border-b-0">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px]">{title}</p>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </div>
  );
}

const BTN = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/[0.10] text-[12px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[12px] font-bold transition-colors';
const INPUT = 'w-full px-3 py-2 rounded-lg border border-black/[0.10] text-sm focus:outline-none focus:border-[#cc0000]';

// Plain-text copy of every answer, for pasting into a brief or a chat.
function answersAsText(project) {
  const form = project.form || {};
  const lines = [];
  for (const s of FORM_SECTIONS) {
    const rows = s.fields
      .filter((f) => f.type !== 'files' && isFieldShown(f, form))
      .map((f) => [f.label, answerText(f, form[f.id])])
      .filter(([, v]) => v);
    if (!rows.length) continue;
    lines.push(s.title.toUpperCase());
    for (const [label, v] of rows) lines.push(`${label}: ${v.includes('\n') ? `\n${v}` : v}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export default function CustomSiteDrawer({ projectId, onClose, onChanged, onDeleted }) {
  const { toast, confirm } = useAlert();
  const [project, setProject] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState('');
  const [notesState, setNotesState] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState({});
  const [siteUrl, setSiteUrl] = useState('');
  const notesLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await customSiteAdmin('get', { id: projectId });
      setProject(res.project);
      setEvents(res.events || []);
      setSiteUrl(res.project.site_url || '');
      if (!notesLoaded.current) {
        notesLoaded.current = true;
        setNotes(res.project.admin_notes || '');
      }
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Esc to close + body scroll lock (same as AdminUserDrawer).
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Applies a server result and refreshes the activity log behind it.
  function applied(next) {
    setProject((prev) => ({ ...prev, ...next, files: prev?.files }));
    onChanged?.(next);
    customSiteAdmin('get', { id: projectId })
      .then((res) => { setEvents(res.events || []); setProject(res.project); })
      .catch(() => {});
  }

  async function update(patch, label) {
    setBusy(label);
    try {
      const res = await customSiteAdmin('update', { id: projectId, ...patch });
      applied(res.project);
      return true;
    } catch (e) {
      toast(e.message || 'Could not save', 'error');
      return false;
    } finally {
      setBusy('');
    }
  }

  // Notes autosave, debounced; the first value is the loaded one.
  useEffect(() => {
    if (!project || notes === (project.admin_notes || '')) return undefined;
    setNotesState('pending');
    const t = setTimeout(async () => {
      setNotesState('saving');
      try {
        const res = await customSiteAdmin('update', { id: projectId, adminNotes: notes });
        setProject((prev) => ({ ...prev, admin_notes: res.project.admin_notes }));
        setNotesState('saved');
      } catch (e) {
        setNotesState('error');
        toast(e.message || 'Could not save notes', 'error');
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  async function sendWelcome() {
    setBusy('email');
    try {
      const res = await customSiteAdmin('send-welcome', { id: projectId, note });
      applied(res.project);
      setNote('');
      setShowNote(false);
      toast(`Welcome email sent to ${res.project.client_email}`, 'success');
    } catch (e) {
      if (e.data?.project) applied(e.data.project);
      toast(e.message || 'The email did not send', 'error');
    } finally {
      setBusy('');
    }
  }

  async function resetLink() {
    const ok = await confirm(
      'The customer\'s current link stops working right away. Their answers and files stay. Send them the new link afterwards.',
      { title: 'Replace the form link?', confirmText: 'Replace link', danger: true },
    );
    if (!ok) return;
    setBusy('reset');
    try {
      const res = await customSiteAdmin('reset-link', { id: projectId });
      applied(res.project);
      toast('New link created. The old one no longer works.', 'success');
    } catch (e) {
      toast(e.message || 'Could not replace the link', 'error');
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    const ok = await confirm(
      `This permanently deletes ${project.business_name || project.client_name}'s project, their answers and every file they uploaded. This can't be undone.`,
      { title: 'Delete this project?', confirmText: 'Delete for good', danger: true },
    );
    if (!ok) return;
    setBusy('delete');
    try {
      await customSiteAdmin('delete', { id: projectId });
      toast('Project deleted', 'success');
      onDeleted?.(projectId);
    } catch (e) {
      toast(e.message || 'Could not delete', 'error');
      setBusy('');
    }
  }

  async function copyLink() {
    toast(await copyText(project.formUrl) ? 'Form link copied' : 'Copy failed. Select the link and copy it.', 'info');
  }

  async function saveDetails() {
    const ok = await update({
      firstName: details.firstName,
      lastName: details.lastName,
      clientEmail: details.clientEmail,
      clientPhone: details.clientPhone,
      businessName: details.businessName,
    }, 'details');
    if (ok) setEditing(false);
  }

  const title = project ? (project.business_name || project.client_name) : 'Custom website';

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-[80]" aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${title} project`}
        className="fixed top-0 right-0 h-full w-full sm:w-[580px] bg-white z-[90] shadow-[0_0_30px_rgba(0,0,0,0.15)] flex flex-col"
        style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
      >
        <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-black/[0.07]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[2px] text-[#cc0000]">Custom website</p>
            <h2 className="text-[20px] font-[800] text-[#1a1a1a] tracking-tight truncate">{title}</h2>
            {project && (
              <p className="text-[12px] text-ink-tertiary truncate">
                {project.client_name} · <a href={`mailto:${project.client_email}`} className="hover:text-[#cc0000]">{project.client_email}</a>
                {project.client_phone && <> · <a href={`tel:${project.client_phone.replace(/[^\d+]/g, '')}`} className="hover:text-[#cc0000]">{project.client_phone}</a></>}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full text-ink-tertiary hover:text-[#1a1a1a] hover:bg-black/[0.05] flex items-center justify-center shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6">
          {loadError ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#cc0000] mb-3">{loadError}</p>
              <button type="button" onClick={load} className={BTN}>Try again</button>
            </div>
          ) : !project ? (
            <p className="py-10 text-center text-sm text-ink-tertiary">Loading…</p>
          ) : (
            <>
              <Section title="Stage" aside={<StageBadge stage={project.stage} />}>
                <StageTracker
                  stage={project.stage}
                  busy={busy === 'stage'}
                  onPick={(s) => update({ stage: s }, 'stage')}
                />
              </Section>

              <Section title="Form link">
                <div className="flex gap-2">
                  <input readOnly value={project.formUrl} onFocus={(e) => e.target.select()} aria-label="Customer form link" className={`${INPUT} font-mono text-[12px] bg-[#faf9f7]`} />
                  <button type="button" onClick={copyLink} className={BTN}>Copy</button>
                  <a href={project.formUrl} target="_blank" rel="noreferrer" className={BTN}>Open</a>
                </div>
                <p className="mt-2 text-[12px] text-ink-tertiary">
                  {project.invite_sent_at
                    ? `Welcome email sent ${formatDateTime(project.invite_sent_at)}${project.invite_count > 1 ? ` · ${project.invite_count} emails so far` : ''}`
                    : 'The welcome email hasn\'t been sent yet.'}
                </p>
                {showNote && (
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Personal note shown at the top of the email (optional)"
                    className={`${INPUT} mt-3 leading-relaxed`}
                  />
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={sendWelcome} disabled={!!busy || project.stage === 'archived'} className={BTN_PRIMARY}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                    {busy === 'email' ? 'Sending…' : project.invite_sent_at ? 'Resend welcome email' : 'Send welcome email'}
                  </button>
                  {!showNote && (
                    <button type="button" onClick={() => setShowNote(true)} className="text-[12px] font-semibold text-ink-tertiary hover:text-[#1a1a1a]">
                      + Add a personal note
                    </button>
                  )}
                  <button type="button" onClick={resetLink} disabled={!!busy} className="ml-auto text-[12px] font-semibold text-ink-tertiary hover:text-[#cc0000]">
                    Replace link
                  </button>
                </div>
              </Section>

              <Section
                title="Customer"
                aside={!editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetails({
                        firstName: project.client_first_name || '',
                        lastName: project.client_last_name || '',
                        clientEmail: project.client_email || '',
                        clientPhone: project.client_phone || '',
                        businessName: project.business_name || '',
                      });
                      setEditing(true);
                    }}
                    className="text-[12px] font-semibold text-[#cc0000] hover:text-[#a80000]"
                  >
                    Edit
                  </button>
                )}
              >
                {editing ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      ['firstName', 'First name'], ['lastName', 'Last name'], ['clientEmail', 'Email'],
                      ['clientPhone', 'Phone'], ['businessName', 'Business'],
                    ].map(([k, label]) => (
                      <label key={k} className="block">
                        <span className="block text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1">{label}</span>
                        <input value={details[k]} onChange={(e) => setDetails((d) => ({ ...d, [k]: e.target.value }))} className={INPUT} />
                      </label>
                    ))}
                    <div className="col-span-2 flex gap-2 pt-1">
                      <button type="button" onClick={saveDetails} disabled={busy === 'details'} className={BTN_PRIMARY}>{busy === 'details' ? 'Saving…' : 'Save'}</button>
                      <button type="button" onClick={() => setEditing(false)} className={BTN}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
                    <Row label="Name" value={project.client_name} />
                    <Row label="Email" value={project.client_email} />
                    <Row label="Phone" value={project.client_phone} empty={project.form_started_at ? '—' : 'Comes from their form'} />
                    <Row label="Business" value={project.business_name} empty={project.form_started_at ? '—' : 'Comes from their form'} />
                    <Row label="Added" value={formatDateTime(project.created_at)} />
                  </dl>
                )}
              </Section>

              <Section title="Build">
                <label className="flex items-center gap-2.5 text-[13px] text-[#1a1a1a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!project.paid_at}
                    disabled={busy === 'paid'}
                    onChange={(e) => update({ paid: e.target.checked }, 'paid')}
                    className="w-4 h-4 accent-[#cc0000]"
                  />
                  <span className="font-semibold">Paid</span>
                  {project.paid_at && <span className="text-ink-tertiary">· marked {formatDateTime(project.paid_at)}</span>}
                </label>
                <label className="block mt-4">
                  <span className="block text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1">Site link (draft or live)</span>
                  <div className="flex gap-2">
                    <input
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                      placeholder="https://…"
                      className={INPUT}
                    />
                    <button
                      type="button"
                      onClick={() => update({ siteUrl }, 'site')}
                      disabled={busy === 'site' || siteUrl === (project.site_url || '')}
                      className={BTN}
                    >
                      {busy === 'site' ? 'Saving…' : 'Save'}
                    </button>
                    {project.site_url && <a href={project.site_url} target="_blank" rel="noreferrer" className={BTN}>Open</a>}
                  </div>
                </label>
              </Section>

              <Section title="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Internal notes, only admins see these: calls, decisions, what they asked for…"
                  className={`${INPUT} leading-relaxed`}
                />
                <p className="text-[10px] text-ink-tertiary mt-1.5">
                  {notesState === 'pending' || notesState === 'saving' ? 'Saving…' : notesState === 'error' ? 'Not saved' : 'Auto-saves as you type'}
                </p>
              </Section>

              <Answers project={project} />
              <Files project={project} />

              <Section title="Activity">
                {events.length === 0 ? (
                  <p className="text-[12px] text-ink-tertiary">Nothing yet.</p>
                ) : (
                  <ol className="relative border-l border-black/[0.10] ml-1.5 space-y-3">
                    {events.map((e) => (
                      <li key={e.id} className="pl-4 relative">
                        <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#1a1a1a]" aria-hidden="true" />
                        <p className={`text-[13px] ${e.type === 'email_failed' ? 'text-[#cc0000]' : 'text-[#1a1a1a]'}`}>{describeEvent(e)}</p>
                        <p className="text-[11px] text-ink-tertiary">
                          {formatDateTime(e.created_at)}
                          {e.actor && e.actor !== 'system' ? ` · ${e.actor === 'customer' ? 'by the customer' : e.actor}` : ''}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>

              <div className="py-6">
                <button type="button" onClick={remove} disabled={!!busy} className="text-[12px] font-semibold text-ink-tertiary hover:text-[#cc0000]">
                  {busy === 'delete' ? 'Deleting…' : 'Delete project'}
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function Row({ label, value, empty = '—' }) {
  return (
    <>
      <dt className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider pt-0.5">{label}</dt>
      <dd className="text-[#1a1a1a] min-w-0 break-words">{value || <span className="text-ink-tertiary">{empty}</span>}</dd>
    </>
  );
}

function StageTracker({ stage, busy, onPick }) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  const side = idx === -1;
  return (
    <div>
      {side && (
        <p className="mb-3 rounded-lg bg-[#faf9f7] border border-black/[0.07] px-3 py-2 text-[12px] text-[#4a4a4a]">
          {stage === 'archived'
            ? 'Archived: the customer\'s form link is turned off. Pick a stage to reopen it.'
            : 'On hold. Pick a stage to pick it back up.'}
        </p>
      )}
      <ol className="space-y-0.5">
        {STAGES.map((s, i) => {
          const current = s.id === stage;
          const done = !side && i < idx;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => !current && onPick(s.id)}
                disabled={busy}
                aria-current={current ? 'step' : undefined}
                className={`group w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left ${current ? 'bg-[#cc0000]/[0.06]' : 'hover:bg-black/[0.03]'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${
                  current ? 'bg-[#cc0000] border-[#cc0000]' : done ? 'bg-[#1a1a1a] border-[#1a1a1a]' : 'bg-white border-black/20'
                }`}>
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                  {current && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13px] ${current ? 'font-bold text-[#1a1a1a]' : done ? 'text-[#1a1a1a]' : 'text-[#4a4a4a]'}`}>{s.label}</span>
                  {current && s.hint && <span className="block text-[11px] text-ink-tertiary">{s.hint}</span>}
                </span>
                {!current && <span className="text-[11px] font-semibold text-[#cc0000] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">Move here</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex gap-2">
        {stage !== 'on_hold' && (
          <button type="button" onClick={() => onPick('on_hold')} disabled={busy} className={BTN}>Put on hold</button>
        )}
        {stage !== 'archived' && (
          <button type="button" onClick={() => onPick('archived')} disabled={busy} className={BTN}>Archive</button>
        )}
      </div>
    </div>
  );
}

function Answers({ project }) {
  const { toast } = useAlert();
  const form = project.form || {};
  const files = project.files || [];
  const status = project.form_submitted_at
    ? `Submitted ${formatDateTime(project.form_submitted_at)}`
    : project.form_saved_at
      ? `In progress · last saved ${formatDateTime(project.form_saved_at)}`
      : 'Not started yet. The fields we pre-filled are below.';
  const missing = project.form_started_at ? missingRecommended(form, files) : [];
  const sections = FORM_SECTIONS.map((s) => ({
    ...s,
    rows: s.fields.filter((f) => f.type !== 'files' && isFieldShown(f, form) && answerText(f, form[f.id])),
  })).filter((s) => s.rows.length);

  return (
    <Section
      title="Their answers"
      aside={sections.length > 0 && (
        <button
          type="button"
          onClick={async () => toast(await copyText(answersAsText(project)) ? 'Answers copied' : 'Copy failed', 'info')}
          className="text-[12px] font-semibold text-[#cc0000] hover:text-[#a80000]"
        >
          Copy all
        </button>
      )}
    >
      <p className={`text-[12px] mb-3 ${project.form_submitted_at ? 'text-emerald-700 font-semibold' : 'text-ink-tertiary'}`}>{status}</p>
      {missing.length > 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
          Still missing: {missing.map((m) => m.label.toLowerCase()).join(', ')}
        </p>
      )}
      {sections.map((s) => (
        <div key={s.id} className="mb-4 last:mb-0">
          <p className="text-[12px] font-bold text-[#1a1a1a] mb-1.5">{s.title}</p>
          <dl className="rounded-lg border border-black/[0.07] divide-y divide-black/[0.05]">
            {s.rows.map((f) => (
              <div key={f.id} className="grid grid-cols-[130px_1fr] gap-3 px-3 py-2">
                <dt className="text-[11px] font-semibold text-ink-tertiary leading-snug pt-0.5">{f.label}</dt>
                <dd className="text-[13px] text-[#1a1a1a] min-w-0 break-words whitespace-pre-wrap"><AnswerValue field={f} value={form[f.id]} /></dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </Section>
  );
}

function AnswerValue({ field, value }) {
  if (field.type === 'colors') {
    return (
      <span className="flex flex-wrap gap-2">
        {value.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5 font-mono text-[12px]">
            <span className="w-5 h-5 rounded border border-black/15" style={{ background: c }} />{c}
          </span>
        ))}
      </span>
    );
  }
  if (field.type === 'sites') {
    return (
      <span className="block space-y-1.5">
        {value.map((r, i) => {
          const href = safeHref(r.url);
          return (
            <span key={i} className="block">
              {href
                ? <a href={href} target="_blank" rel="noreferrer noopener" className="text-[#cc0000] font-semibold hover:underline break-all">{r.url}</a>
                : r.url && <span className="break-all">{r.url}</span>}
              {r.note && <span className="block text-[12px] text-[#4a4a4a]">{r.note}</span>}
            </span>
          );
        })}
      </span>
    );
  }
  const text = answerText(field, value);
  const href = field.type === 'url' ? safeHref(value) : null;
  if (href) return <a href={href} target="_blank" rel="noreferrer noopener" className="text-[#cc0000] font-semibold hover:underline break-all">{text}</a>;
  return text;
}

function Files({ project }) {
  const files = project.files || [];
  return (
    <Section title={`Files${files.length ? ` (${files.length})` : ''}`}>
      {files.length === 0 ? (
        <p className="text-[12px] text-ink-tertiary">No files yet.</p>
      ) : (
        Object.entries(ASSET_KINDS).map(([kind, k]) => {
          const list = files.filter((f) => f.kind === kind);
          if (!list.length) return null;
          return (
            <div key={kind} className="mb-4 last:mb-0">
              <p className="text-[12px] font-bold text-[#1a1a1a] mb-2">{k.label} <span className="font-normal text-ink-tertiary">({list.length})</span></p>
              <ul className="grid grid-cols-3 gap-2.5">
                {list.map((f) => (
                  <li key={f.path} className="min-w-0">
                    <a
                      href={f.url || undefined}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block aspect-square rounded-lg overflow-hidden border border-black/[0.08] hover:border-[#cc0000]/50"
                      style={{ background: kind === 'photo' ? '#f4f3f0' : 'repeating-conic-gradient(#f1f1f1 0% 25%, #fff 0% 50%) 50% / 12px 12px' }}
                      title={`Open ${f.name}`}
                    >
                      {f.url && isPreviewable(f.name) ? (
                        <img src={f.url} alt={f.name} loading="lazy" className={`w-full h-full ${kind === 'photo' ? 'object-cover' : 'object-contain p-1.5'}`} />
                      ) : (
                        <span className="w-full h-full flex flex-col items-center justify-center">
                          <span className="px-2 py-0.5 rounded bg-[#1a1a1a] text-white text-[10px] font-bold uppercase">{fileExtension(f.name) || 'file'}</span>
                        </span>
                      )}
                    </a>
                    <p className="mt-1 truncate text-[11px] text-[#1a1a1a]" title={f.name}>{f.name}</p>
                    <p className="text-[10px] text-ink-tertiary">
                      {formatBytes(f.size)}
                      {f.downloadUrl && <> · <a href={f.downloadUrl} className="font-semibold text-[#cc0000] hover:underline">Download</a></>}
                    </p>
                    {f.note && <p className="mt-0.5 text-[11px] text-[#4a4a4a] leading-snug">“{f.note}”</p>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
      {files.length > 0 && <p className="mt-3 text-[10px] text-ink-tertiary">Links work for an hour. Reopen the project for fresh ones.</p>}
    </Section>
  );
}
