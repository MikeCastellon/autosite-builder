import { useCallback, useEffect, useRef, useState } from 'react';
import { customSiteAdmin } from '../../lib/customSites.js';
import {
  ASSET_KINDS, FORM_SECTIONS, STAGES, answerText, describeEvent, fileExtension, formatBytes, isFieldShown,
  isPreviewable, missingRecommended, safeHref,
} from '../../lib/customSiteForm.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import { StageBadge, copyText, duration, formatDateTime, timeAgo } from './customSiteUi.jsx';
import { DesignCard, DesignSetup, HandoverCard } from './CustomSiteDesign.jsx';

// One custom website project, full page (Admin > Custom websites > a
// project): where the build is and what's next, the customer's answers and
// files, the form link and emails, payment, site link, notes and activity.

const BTN = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-black/[0.12] text-[13px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold transition-colors';
const INPUT = 'w-full px-3 py-2 rounded-lg border border-black/[0.10] text-sm focus:outline-none focus:border-[#cc0000]';

function Card({ title, aside, children, className = '' }) {
  return (
    <section className={`bg-white rounded-2xl border border-black/[0.07] p-5 sm:p-6 ${className}`}>
      {(title || aside) && (
        <div className="flex items-center gap-3 mb-4">
          {title && <h3 className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px]">{title}</h3>}
          {aside && <div className="ml-auto">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

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

// What's waiting, and on whom, for each stage. `act` names the buttons:
// welcome | resend | stage:<id> | draft | live.
function nextStep(p) {
  const first = p.client_first_name || 'the customer';
  const hasLink = !!p.site_url;
  switch (p.stage) {
    case 'new':
      return { text: 'The form link hasn\'t been sent yet.', act: [['welcome', 'Send welcome email', true]] };
    case 'invited':
      return { text: `Waiting on ${first} to start the form (sent ${timeAgo(p.invite_sent_at)}).`, act: [['resend', 'Resend welcome email']] };
    case 'form_started':
      return { text: `${first} is filling out the form (last saved ${timeAgo(p.form_saved_at)}).`, act: [['resend', 'Resend welcome email']] };
    case 'form_received':
      return {
        text: `${first} sent the form ${timeAgo(p.form_submitted_at)}. Look over their answers and files below, then set up the design.`,
        act: p.site && !p.handed_over_at ? [['editor', 'Open in editor', true]] : p.site ? [] : [['design', 'Set up the design', true]],
      };
    case 'designing':
      if (p.design_status === 'generating') return { text: 'The copy is being written. This page updates when it\'s done.', act: [] };
      if (!p.site) return { text: `Set up the design to build ${first}'s site.`, act: [['design', 'Set up the design', true]] };
      if (p.handed_over_at) return hasLink ? { text: `Email ${first} the draft link when it's ready.`, act: [['draft', `Email draft to ${first}`, true]] } : { text: 'The site is in the customer\'s account; publish it from there (View as user).', act: [] };
      return hasLink
        ? { text: `When the draft is ready, email ${first} the link. That moves the project to "Draft with customer".`, act: [['draft', `Email draft to ${first}`, true], ['editor', 'Open in editor']] }
        : { text: 'Polish the site in the editor, then press Publish there to get a draft link.', act: [['editor', 'Open in editor', true]] };
    case 'in_review':
      return {
        text: `Waiting on ${first}'s feedback on the draft. Their reply comes to your email.`,
        act: [['stage:revisions', 'Start revisions', true], ['draft', 'Email draft again']],
      };
    case 'revisions':
      return {
        text: `Working on ${first}'s changes. Send the updated draft, or mark the site live when it's done.`,
        act: [...(hasLink ? [['draft', 'Email updated draft', true]] : []), ['stage:live', 'Mark as live']],
      };
    case 'live':
      return {
        text: hasLink ? 'The site is live.' : 'The site is live. Add its link under Build.',
        act: hasLink ? [['live', `Email "you're live" to ${first}`]] : [],
      };
    case 'on_hold':
      return { text: 'On hold. Pick a stage above to pick it back up.', act: [] };
    case 'archived':
      return { text: 'Archived: the customer\'s form link is turned off. Pick a stage above to reopen it.', act: [] };
    default:
      return { text: '', act: [] };
  }
}

export default function CustomSiteProjectPage({ projectId, onBack, onChanged, onDeleted, onOpenSiteEditor, onOpenBookingSettings }) {
  const { toast, confirm } = useAlert();
  const [project, setProject] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState(null);
  const [notesState, setNotesState] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState({});
  const [siteUrl, setSiteUrl] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);

  // The list's row update, read through a ref so a new callback from the
  // parent never reloads the page.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  // The site link as last loaded: a refresh replaces the input only while
  // it still shows that value (never text being typed).
  const loadedSiteUrl = useRef('');

  const apply = useCallback((res) => {
    setProject(res.project);
    if (res.events) setEvents(res.events);
    const nextUrl = res.project.site_url || '';
    setSiteUrl((current) => (current === loadedSiteUrl.current ? nextUrl : current));
    loadedSiteUrl.current = nextUrl;
    setNotes((prev) => (prev === null ? res.project.admin_notes || '' : prev));
    onChangedRef.current?.(res.project);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await customSiteAdmin('get', { id: projectId }));
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [projectId, apply]);

  useEffect(() => { load(); }, [load]);

  // Background refresh (while the copy is written): a failed poll is not an
  // error screen.
  const refresh = useCallback(async () => {
    try { apply(await customSiteAdmin('get', { id: projectId })); } catch { /* next poll retries */ }
  }, [projectId, apply]);
  useEffect(() => { window.scrollTo(0, 0); }, [projectId]);

  // After a change: show the saved project, then refresh the activity log.
  function saved(next) {
    setProject((prev) => ({ ...prev, ...next, files: prev?.files }));
    onChangedRef.current?.(next);
    load();
  }

  async function update(patch, label) {
    setBusy(label);
    try {
      const res = await customSiteAdmin('update', { id: projectId, ...patch });
      saved(res.project);
      return true;
    } catch (e) {
      toast(e.message || 'Could not save', 'error');
      return false;
    } finally {
      setBusy('');
    }
  }

  // Notes autosave, debounced.
  useEffect(() => {
    if (!project || notes === null || notes === (project.admin_notes || '')) return undefined;
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
      saved(res.project);
      setNote('');
      setShowNote(false);
      toast(`Welcome email sent to ${res.project.client_email}`, 'success');
    } catch (e) {
      if (e.data?.project) saved(e.data.project);
      toast(e.message || 'The email did not send', 'error');
    } finally {
      setBusy('');
    }
  }

  async function emailCustomer(template) {
    const what = template === 'draft' ? 'the draft link' : 'the "you\'re live" email';
    const ok = await confirm(
      `Send ${what} to ${project.client_email}? It links to ${project.site_url}.`,
      { title: template === 'draft' ? 'Email the draft?' : 'Email "you\'re live"?', confirmText: 'Send email' },
    );
    if (!ok) return;
    setBusy('email');
    try {
      const res = await customSiteAdmin('email-customer', { id: projectId, template });
      saved(res.project);
      toast(`Email sent to ${project.client_email}`, 'success');
    } catch (e) {
      toast(e.message || 'The email did not send', 'error');
      load();
    } finally {
      setBusy('');
    }
  }

  function openEditor(siteId = project?.site?.id) {
    if (siteId) onOpenSiteEditor?.(siteId, projectId);
  }

  function runAction(key) {
    if (key === 'design') { setSetupOpen(true); window.scrollTo(0, 0); return null; }
    if (key === 'editor') return openEditor();
    if (key === 'welcome' || key === 'resend') return sendWelcome();
    if (key === 'draft' || key === 'live') return emailCustomer(key);
    if (key.startsWith('stage:')) return update({ stage: key.slice(6) }, 'stage');
    return null;
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
      saved(res.project);
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

  const back = (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-tertiary hover:text-[#1a1a1a]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
      All custom websites
    </button>
  );

  if (loadError) {
    return (
      <div>
        {back}
        <div className="mt-6 bg-white rounded-2xl border border-black/[0.07] px-6 py-12 text-center">
          <p className="text-sm text-[#cc0000] mb-3">{loadError}</p>
          <button type="button" onClick={load} className={BTN}>Try again</button>
        </div>
      </div>
    );
  }
  if (!project) {
    return <div>{back}<p className="py-16 text-center text-sm text-ink-tertiary">Loading…</p></div>;
  }

  if (setupOpen) {
    return (
      <DesignSetup
        project={project}
        onBack={() => { setSetupOpen(false); load(); }}
        onStarted={() => { setSetupOpen(false); load(); window.scrollTo(0, 0); }}
      />
    );
  }

  const title = project.business_name || project.client_name;
  const step = nextStep(project);
  const sent = !!project.invite_sent_at;

  return (
    <div>
      {back}

      <header className="mt-4 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#cc0000]">Custom website</p>
          <h2 className="mt-1 text-[28px] sm:text-[34px] leading-[1.1] font-[900] tracking-tight text-[#1a1a1a] break-words">{title}</h2>
          <p className="mt-1.5 text-[13px] text-ink-tertiary">
            {project.business_name ? `${project.client_name} · ` : ''}
            <a href={`mailto:${project.client_email}`} className="hover:text-[#cc0000]">{project.client_email}</a>
            {project.client_phone && <> · <a href={`tel:${project.client_phone.replace(/[^\d+]/g, '')}`} className="hover:text-[#cc0000]">{project.client_phone}</a></>}
            {' · '}added {formatDateTime(project.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={project.stage} />
          {project.paid_at && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800">Paid</span>}
          {project.site_url && <a href={project.site_url} target="_blank" rel="noreferrer" className={BTN}>Open site</a>}
          <a href={project.formUrl} target="_blank" rel="noreferrer" className={BTN}>Open their form</a>
        </div>
      </header>

      {/* Process: every stage, what's next, and the buttons for it. */}
      <Card className="mt-6" title="Progress" aside={project.stageSince && (
        <span className="text-[12px] text-ink-tertiary">In this stage for {duration(project.stageSince)}</span>
      )}>
        <StageStepper stage={project.stage} busy={busy === 'stage'} onPick={(s) => update({ stage: s }, 'stage')} />
        <div className="mt-4 rounded-xl bg-[#faf9f7] border border-black/[0.06] px-4 py-3.5 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#cc0000]">Next step</p>
            <p className="mt-0.5 text-[14px] text-[#1a1a1a]">{step.text}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {step.act.map(([key, label, primary]) => (
              <button key={key} type="button" onClick={() => runAction(key)} disabled={!!busy} className={primary ? BTN_PRIMARY : BTN}>
                {busy === 'email' && (key === 'welcome' || key === 'resend' || key === 'draft' || key === 'live') ? 'Sending…' : label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 justify-end">
          {project.stage !== 'on_hold' && <button type="button" onClick={() => update({ stage: 'on_hold' }, 'stage')} disabled={!!busy} className="text-[12px] font-semibold text-ink-tertiary hover:text-[#1a1a1a] px-2 py-1">Put on hold</button>}
          {project.stage !== 'archived' && <button type="button" onClick={() => update({ stage: 'archived' }, 'stage')} disabled={!!busy} className="text-[12px] font-semibold text-ink-tertiary hover:text-[#1a1a1a] px-2 py-1">Archive</button>}
        </div>
      </Card>

      <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <DesignCard
            project={project}
            onReload={refresh}
            onSetup={() => { setSetupOpen(true); window.scrollTo(0, 0); }}
            onOpenEditor={openEditor}
            onOpenBookingSettings={(siteId) => onOpenBookingSettings?.(siteId, projectId)}
          />
          <Answers project={project} />
          <Files project={project} />
        </div>

        <div className="space-y-6">
          <HandoverCard project={project} onDone={load} />

          <Card title="Form link">
            <div className="flex gap-2">
              <input
                readOnly
                value={project.formUrl}
                onFocus={(e) => e.target.select()}
                aria-label="Customer form link"
                className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-black/[0.10] bg-[#faf9f7] text-[12px] text-[#4a4a4a] focus:outline-none focus:border-[#cc0000] truncate"
              />
              <button type="button" onClick={copyLink} className={BTN}>Copy</button>
            </div>
            <p className="mt-2 text-[12px] text-ink-tertiary">
              {sent
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
              <button type="button" onClick={sendWelcome} disabled={!!busy || project.stage === 'archived'} className={sent ? BTN : BTN_PRIMARY}>
                {busy === 'email' ? 'Sending…' : sent ? 'Resend welcome email' : 'Send welcome email'}
              </button>
              {!showNote && (
                <button type="button" onClick={() => setShowNote(true)} className="text-[12px] font-semibold text-ink-tertiary hover:text-[#1a1a1a]">
                  + Personal note
                </button>
              )}
              <button type="button" onClick={resetLink} disabled={!!busy} className="ml-auto text-[12px] font-semibold text-ink-tertiary hover:text-[#cc0000]">
                Replace link
              </button>
            </div>
          </Card>

          <Card
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
                  <label key={k} className={`block ${k === 'clientEmail' || k === 'businessName' ? 'col-span-2' : ''}`}>
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
              <dl className="grid grid-cols-[96px_1fr] gap-y-2 text-[13px]">
                <Row label="Name" value={project.client_name} />
                <Row label="Email" value={project.client_email} />
                <Row label="Phone" value={project.client_phone} empty={project.form_started_at ? '—' : 'Comes from their form'} />
                <Row label="Business" value={project.business_name} empty={project.form_started_at ? '—' : 'Comes from their form'} />
              </dl>
            )}
          </Card>

          <Card title="Build">
            <label className="flex items-center gap-2.5 text-[13px] text-[#1a1a1a] cursor-pointer">
              <input
                type="checkbox"
                checked={!!project.paid_at}
                disabled={busy === 'paid'}
                onChange={(e) => update({ paid: e.target.checked }, 'paid')}
                className="w-4 h-4 accent-[#cc0000]"
              />
              <span className="font-semibold">Paid</span>
              {project.paid_at && <span className="text-ink-tertiary">· {formatDateTime(project.paid_at)}</span>}
            </label>
            <label className="block mt-4">
              <span className="block text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1">Site link (draft or live)</span>
              <div className="flex gap-2">
                <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://…" className={INPUT} />
                <button
                  type="button"
                  onClick={() => update({ siteUrl }, 'site')}
                  disabled={busy === 'site' || siteUrl === (project.site_url || '')}
                  className={BTN}
                >
                  {busy === 'site' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </label>
          </Card>

          <Card title="Notes">
            <textarea
              value={notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Internal notes, only admins see these: calls, decisions, what they asked for…"
              className={`${INPUT} leading-relaxed`}
            />
            <p className="text-[11px] text-ink-tertiary mt-1.5">
              {notesState === 'pending' || notesState === 'saving' ? 'Saving…' : notesState === 'error' ? 'Not saved' : 'Saves as you type'}
            </p>
          </Card>

          <Card title="Activity">
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
          </Card>

          <div className="text-right">
            <button type="button" onClick={remove} disabled={!!busy} className="text-[12px] font-semibold text-ink-tertiary hover:text-[#cc0000]">
              {busy === 'delete' ? 'Deleting…' : 'Delete project'}
            </button>
          </div>
        </div>
      </div>
    </div>
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

function StageStepper({ stage, busy, onPick }) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  const side = idx === -1;
  return (
    <ol className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
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
              title={current ? s.hint : `Move to ${s.label}`}
              className={`w-full h-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                current
                  ? 'border-[#cc0000] bg-[#cc0000]/[0.06]'
                  : done
                    ? 'border-black/[0.06] bg-[#faf9f7] hover:border-black/20'
                    : 'border-black/[0.08] bg-white hover:border-[#cc0000]/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${
                  current ? 'bg-[#cc0000] border-[#cc0000]' : done ? 'bg-[#1a1a1a] border-[#1a1a1a]' : 'bg-white border-black/20'
                }`}>
                  {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>}
                  {current && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-tertiary">Step {i + 1}</span>
              </span>
              <span className={`block mt-1.5 text-[13px] leading-tight ${current ? 'font-bold text-[#1a1a1a]' : done ? 'font-semibold text-[#1a1a1a]' : 'text-[#4a4a4a]'}`}>{s.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
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
      : 'Not started yet. These are the details we filled in for them.';
  const missing = project.form_started_at ? missingRecommended(form, files) : [];
  const sections = FORM_SECTIONS.map((s) => ({
    ...s,
    rows: s.fields.filter((f) => f.type !== 'files' && isFieldShown(f, form) && answerText(f, form[f.id])),
  })).filter((s) => s.rows.length);

  return (
    <Card
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
      <p className={`text-[13px] mb-4 ${project.form_submitted_at ? 'text-emerald-700 font-semibold' : 'text-ink-tertiary'}`}>{status}</p>
      {missing.length > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-900">
          Still missing: {missing.map((m) => m.label.toLowerCase()).join(', ')}
        </p>
      )}
      <div className="space-y-5">
        {sections.map((s) => (
          <div key={s.id}>
            <p className="text-[13px] font-bold text-[#1a1a1a] mb-2">{s.title}</p>
            <dl className="rounded-xl border border-black/[0.07] divide-y divide-black/[0.05]">
              {s.rows.map((f) => (
                <div key={f.id} className="grid sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 px-4 py-2.5">
                  <dt className="text-[12px] font-semibold text-ink-tertiary leading-snug sm:pt-0.5">{f.label}</dt>
                  <dd className="text-[14px] text-[#1a1a1a] min-w-0 break-words whitespace-pre-wrap"><AnswerValue field={f} value={form[f.id]} /></dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AnswerValue({ field, value }) {
  if (field.type === 'colors') {
    return (
      <span className="flex flex-wrap gap-3">
        {value.map((c) => (
          <span key={c} className="inline-flex items-center gap-2 font-mono text-[13px]">
            <span className="w-6 h-6 rounded-md border border-black/15" style={{ background: c }} />{c}
          </span>
        ))}
      </span>
    );
  }
  if (field.type === 'sites') {
    return (
      <span className="block space-y-2">
        {value.map((r, i) => {
          const href = safeHref(r.url);
          return (
            <span key={i} className="block">
              {href
                ? <a href={href} target="_blank" rel="noreferrer noopener" className="text-[#cc0000] font-semibold hover:underline break-all">{r.url}</a>
                : r.url && <span className="break-all">{r.url}</span>}
              {r.note && <span className="block text-[13px] text-[#4a4a4a]">{r.note}</span>}
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
    <Card title={`Files${files.length ? ` (${files.length})` : ''}`}>
      {files.length === 0 ? (
        <p className="text-[13px] text-ink-tertiary">No files yet.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(ASSET_KINDS).map(([kind, k]) => {
            const list = files.filter((f) => f.kind === kind);
            if (!list.length) return null;
            return (
              <div key={kind}>
                <p className="text-[13px] font-bold text-[#1a1a1a] mb-2.5">{k.label} <span className="font-normal text-ink-tertiary">({list.length})</span></p>
                <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {list.map((f) => (
                    <li key={f.path} className="min-w-0">
                      <a
                        href={f.url || undefined}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="block aspect-square rounded-xl overflow-hidden border border-black/[0.08] hover:border-[#cc0000]/50"
                        style={{ background: kind === 'photo' ? '#f4f3f0' : 'repeating-conic-gradient(#f1f1f1 0% 25%, #fff 0% 50%) 50% / 14px 14px' }}
                        title={`Open ${f.name}`}
                      >
                        {f.url && isPreviewable(f.name) ? (
                          <img src={f.url} alt={f.name} loading="lazy" className={`w-full h-full ${kind === 'photo' ? 'object-cover' : 'object-contain p-3'}`} />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center">
                            <span className="px-2 py-1 rounded-md bg-[#1a1a1a] text-white text-[11px] font-bold uppercase">{fileExtension(f.name) || 'file'}</span>
                          </span>
                        )}
                      </a>
                      <p className="mt-1.5 truncate text-[12px] text-[#1a1a1a]" title={f.name}>{f.name}</p>
                      <p className="text-[11px] text-ink-tertiary">
                        {formatBytes(f.size)}
                        {f.downloadUrl && <> · <a href={f.downloadUrl} className="font-semibold text-[#cc0000] hover:underline">Download</a></>}
                      </p>
                      {f.note && <p className="mt-1 text-[12px] text-[#4a4a4a] leading-snug">“{f.note}”</p>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="text-[11px] text-ink-tertiary">File links work for an hour. Reload the page for fresh ones.</p>
        </div>
      )}
    </Card>
  );
}
