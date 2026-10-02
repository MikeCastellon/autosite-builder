import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import IntakeField, { SHORT_TYPES } from './IntakeFields.jsx';
import {
  ASSET_KINDS, FORM_SECTIONS, checkUpload, firstName, isFieldShown, isPreviewable,
  missingRecommended, missingRequired,
} from '../../lib/customSiteForm.js';
import { beaconSaveIntake, loadIntake, saveIntake, submitIntake, uploadIntakeFile } from '../../lib/customSites.js';

// Public page at /custom-site?t=<token>: the intake form for a custom
// website. The link comes from the welcome email sent from Admin > Custom
// websites; no account needed. Answers autosave as the customer types,
// files upload straight to storage, and they can come back with the same
// link to finish or change anything, also after sending.

const ACG_LOGO = 'https://www.autocaregenius.com/cdn/shop/files/v11_1.svg?v=1760731533&width=200';
const STEPS = [...FORM_SECTIONS.map((s) => ({ id: s.id, title: s.title })), { id: 'review', title: 'Review & send' }];
const REVIEW = STEPS.length - 1;
const SAVE_DELAY_MS = 1200;
const RETRY_MS = 5000;
const UPLOAD_CONCURRENCY = 3;

function readToken() {
  try { return new URLSearchParams(window.location.search).get('t') || ''; } catch { return ''; }
}

// The step survives a reload of the tab (answers come back from the server).
const stepKey = (token) => `gw.customSiteStep:${token}`;

function readStep(token) {
  try {
    const n = Number(window.sessionStorage.getItem(stepKey(token)));
    return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0;
  } catch {
    return 0;
  }
}

function hasAnswer(field, form, assets) {
  if (field.type === 'files') return assets.some((a) => a.kind === field.kind);
  const v = form[field.id];
  if (Array.isArray(v)) return v.some((x) => (typeof x === 'string' ? x.trim() : x && (x.url?.trim() || x.note?.trim())));
  return typeof v === 'string' ? v.trim() !== '' : !!v;
}

function sectionProgress(section, form, assets) {
  const shown = section.fields.filter((f) => isFieldShown(f, form) && f.type !== 'checkbox');
  return { answered: shown.filter((f) => hasAnswer(f, form, assets)).length, total: shown.length };
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export default function CustomSiteFormPage() {
  const [token] = useState(readToken);
  const [status, setStatus] = useState('loading'); // loading | ready | invalid | error
  const [loadError, setLoadError] = useState('');
  const [meta, setMeta] = useState({ firstName: '', clientName: '', businessName: '', submittedAt: null });
  const [form, setForm] = useState({});
  const [assets, setAssets] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [step, setStep] = useState(() => readStep(token));
  const [errors, setErrors] = useState({});
  const [save, setSave] = useState({ state: 'idle', at: null }); // idle | pending | saving | saved | error
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [thanks, setThanks] = useState(null); // null | { resubmitted }
  const [laterNote, setLaterNote] = useState(false);
  const headingRef = useRef(null);

  useEffect(() => { document.title = 'Your website form · Auto Care Genius'; }, []);

  useEffect(() => {
    try { window.sessionStorage.setItem(stepKey(token), String(step)); } catch { /* storage off */ }
  }, [token, step]);

  const load = useCallback(async () => {
    if (!token) { setStatus('invalid'); return; }
    setStatus('loading');
    try {
      const { project } = await loadIntake(token);
      setMeta({
        firstName: project.firstName,
        clientName: project.clientName,
        businessName: project.businessName,
        submittedAt: project.submittedAt,
      });
      setForm(project.form || {});
      setAssets(project.assets || []);
      setSave({ state: 'idle', at: project.savedAt });
      setStatus('ready');
    } catch (e) {
      setLoadError(e.message);
      setStatus(e.status === 404 ? 'invalid' : 'error');
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  // ─── Autosave ───────────────────────────────────────────────────────
  // Edits mark the form dirty and schedule a save; the save sends the
  // latest form and files (read from the ref, so a save scheduled by an
  // older render still sends the newest answers). Failed saves retry.
  const latest = useRef({ form, assets });
  latest.current = { form, assets };
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef(null);
  const flushRef = useRef(null);

  flushRef.current = async () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    if (saving.current) { timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY_MS); return; }
    dirty.current = false;
    saving.current = true;
    setSave((s) => ({ ...s, state: 'saving' }));
    try {
      const { savedAt } = await saveIntake(token, latest.current.form, latest.current.assets);
      setSave({ state: dirty.current ? 'pending' : 'saved', at: savedAt });
    } catch (e) {
      dirty.current = true;
      if (e.status === 404) { setLoadError(e.message); setStatus('invalid'); return; }
      setSave((s) => ({ ...s, state: 'error' }));
      timer.current = setTimeout(() => flushRef.current(), RETRY_MS);
    } finally {
      saving.current = false;
    }
    if (dirty.current) timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY_MS);
  };

  const markDirty = useCallback(() => {
    dirty.current = true;
    setSave((s) => (s.state === 'error' ? s : { ...s, state: 'pending' }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY_MS);
  }, []);

  // Leaving or switching tabs: send what's unsaved as a beacon, which still
  // goes out while the page unloads.
  useEffect(() => {
    function onHide() {
      if (document.visibilityState !== 'hidden' || !dirty.current || saving.current) return;
      if (beaconSaveIntake(token, latest.current.form, latest.current.assets)) {
        dirty.current = false;
        clearTimeout(timer.current);
        setSave({ state: 'saved', at: new Date().toISOString() });
      }
    }
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [token]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Closing the tab mid-upload loses the file, so ask first.
  const uploading = uploads.some((u) => u.status === 'uploading');
  useEffect(() => {
    if (!uploading) return undefined;
    const onBefore = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [uploading]);

  const setField = (id, value) => {
    setForm((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    markDirty();
  };

  // ─── Uploads ────────────────────────────────────────────────────────
  const queue = useRef([]);
  const active = useRef(0);

  function pump() {
    while (active.current < UPLOAD_CONCURRENCY && queue.current.length) {
      const job = queue.current.shift();
      active.current += 1;
      uploadIntakeFile(token, job.kind, job.file)
        .then((asset) => {
          setAssets((prev) => [...prev, { ...asset, url: job.previewUrl }]);
          setUploads((prev) => prev.filter((u) => u.id !== job.id));
          markDirty();
        })
        .catch((e) => {
          if (job.previewUrl) URL.revokeObjectURL(job.previewUrl);
          setUploads((prev) => prev.map((u) => (u.id === job.id ? { ...u, status: 'error', error: e.message || 'Upload failed' } : u)));
        })
        .finally(() => { active.current -= 1; pump(); });
    }
  }

  function addFiles(kind, files) {
    const max = ASSET_KINDS[kind].max;
    let room = max - assets.filter((a) => a.kind === kind).length
      - uploads.filter((u) => u.kind === kind && u.status === 'uploading').length;
    const entries = files.map((file) => {
      const id = newId();
      const check = checkUpload({ kind, fileName: file.name, size: file.size });
      if (check.error) return { id, kind, name: file.name, status: 'error', error: check.error };
      if (room <= 0) return { id, kind, name: file.name, status: 'error', error: `You can add up to ${max} files here.` };
      room -= 1;
      const previewUrl = isPreviewable(file.name) ? URL.createObjectURL(file) : null;
      queue.current.push({ id, kind, file, previewUrl });
      return { id, kind, name: file.name, status: 'uploading' };
    });
    setUploads((prev) => [...prev, ...entries]);
    pump();
  }

  const fileProps = {
    assets,
    uploads,
    onAdd: addFiles,
    onRemove: (asset) => {
      setAssets((prev) => prev.filter((a) => a.path !== asset.path));
      if (asset.url?.startsWith('blob:')) URL.revokeObjectURL(asset.url);
      markDirty();
    },
    onNote: (asset, note) => {
      setAssets((prev) => prev.map((a) => (a.path === asset.path ? { ...a, note } : a)));
      markDirty();
    },
    onDismiss: (id) => setUploads((prev) => prev.filter((u) => u.id !== id)),
  };

  // ─── Navigation ─────────────────────────────────────────────────────
  function goTo(i, focusFieldId) {
    flushRef.current();
    setStep(i);
    setLaterNote(false);
    requestAnimationFrame(() => {
      const el = focusFieldId && document.getElementById(`f-${focusFieldId}`);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.focus({ preventScroll: true });
      } else {
        window.scrollTo(0, 0);
        headingRef.current?.focus({ preventScroll: true });
      }
    });
  }

  function finishLater() {
    flushRef.current();
    setLaterNote(true);
  }

  async function submit() {
    setSubmitError('');
    const missing = missingRequired(form);
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((m) => [
        m.id,
        m.id === 'contactEmail' && form.contactEmail ? 'Enter a valid email address' : 'This is required',
      ])));
      goTo(STEPS.findIndex((s) => s.id === missing[0].section), missing[0].id);
      return;
    }
    if (uploading) { setSubmitError('Wait for your files to finish uploading, then send.'); return; }
    setSubmitting(true);
    clearTimeout(timer.current);
    // A save already on its way could land after the submit with older answers.
    while (saving.current) await new Promise((r) => setTimeout(r, 100));
    try {
      const { savedAt, submittedAt } = await submitIntake(token, form, assets);
      dirty.current = false;
      setSave({ state: 'saved', at: savedAt });
      setThanks({ resubmitted: !!meta.submittedAt });
      setMeta((m) => ({ ...m, submittedAt }));
      window.scrollTo(0, 0);
    } catch (e) {
      if (e.status === 404) { setLoadError(e.message); setStatus('invalid'); return; }
      setSubmitError(e.message || 'Could not send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const first = meta.firstName || firstName(form.contactName || meta.clientName);

  if (status === 'loading') {
    return (
      <Shell>
        <div className="flex justify-center py-32" role="status" aria-label="Loading your form">
          <span className="w-8 h-8 border-4 border-black/10 border-t-[#cc0000] rounded-full motion-safe:animate-spin" />
        </div>
      </Shell>
    );
  }

  if (status === 'invalid' || status === 'error') {
    const invalid = status === 'invalid';
    return (
      <Shell>
        <CenterCard
          tone="muted"
          eyebrow={invalid ? 'Link not active' : 'Connection problem'}
          title={invalid ? 'This link isn\'t working' : 'We couldn\'t load your form'}
        >
          <p>
            {invalid
              ? (loadError || 'Open the form with the link in your welcome email. If it still doesn\'t work, reply to that email and we\'ll send you a new link.')
              : (loadError || 'Check your connection and try again.')}
          </p>
          {!invalid && (
            <button type="button" onClick={load} className="mt-6 inline-flex px-6 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-sm font-semibold">
              Try again
            </button>
          )}
        </CenterCard>
      </Shell>
    );
  }

  if (thanks) {
    return (
      <Shell save={save}>
        <CenterCard
          eyebrow={thanks.resubmitted ? 'Updates sent' : 'Form sent'}
          title={thanks.resubmitted ? 'Got your updates, thanks!' : `Thanks${first ? `, ${first}` : ''}! We've got everything.`}
        >
          <p>
            {thanks.resubmitted
              ? 'Your changes came straight to our team.'
              : 'We\'ll start on your design and reach out if we have any questions. A confirmation is on its way to your inbox.'}
          </p>
          {!thanks.resubmitted && (
            <ol className="mt-6 text-left space-y-3">
              {[
                ['We go through your answers', 'Your brand, the sites you like and your photos.'],
                ['We design your site', 'Built around your business and your look.'],
                ['You review it', 'We fine-tune it with you before it goes live.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="w-6 h-6 mt-0.5 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span><span className="block text-[14px] font-semibold text-[#1a1a1a]">{t}</span><span className="text-[13px] text-ink-tertiary">{d}</span></span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-6 text-[13px] text-ink-tertiary">Remembered something? Use the link in your email to come back anytime.</p>
          <button
            type="button"
            onClick={() => { setThanks(null); setStep(0); window.scrollTo(0, 0); }}
            className="mt-4 inline-flex px-6 py-2.5 rounded-xl border border-black/[0.12] bg-white hover:border-[#cc0000]/50 text-[#1a1a1a] text-sm font-semibold"
          >
            Back to my answers
          </button>
        </CenterCard>
      </Shell>
    );
  }

  const section = FORM_SECTIONS[step];
  const required = missingRequired(form);
  const recommended = missingRecommended(form, assets);

  return (
    <Shell save={save} onRetry={() => flushRef.current()}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[2.5px] text-[#cc0000] mb-2">
          Custom website{meta.businessName ? ` · ${meta.businessName}` : ''}
        </p>
        <h1 className="text-[28px] sm:text-[38px] leading-[1.08] font-[900] tracking-tight text-[#1a1a1a] max-w-2xl">
          {first ? `Hi ${first}, let's build your website` : 'Let\'s build your website'}
        </h1>
        <p className="mt-3 text-[15px] sm:text-[16px] text-[#4a4a4a] leading-relaxed max-w-2xl">
          Tell us about your business and the look you want. Answer what you can: everything saves as you go,
          so you can come back anytime with the link from your email.
        </p>
        {meta.submittedAt && (
          <div className="mt-5 max-w-2xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] text-emerald-900">
            You sent this on {formatDate(meta.submittedAt)}. You can still change anything; press <strong>Send my updates</strong> at the end when you're done.
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 grid lg:grid-cols-[220px_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
        <nav aria-label="Form steps" className="hidden lg:block sticky top-20">
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const on = i === step;
              // A check once the step has answers and nothing required is missing.
              const done = i < REVIEW && sectionProgress(FORM_SECTIONS[i], form, assets).answered > 0
                && !required.some((m) => m.section === s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={on ? 'step' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[14px] ${
                      on ? 'bg-white shadow-sm border border-black/[0.07] font-semibold text-[#1a1a1a]' : 'text-[#4a4a4a] hover:bg-black/[0.03]'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                      on ? 'bg-[#cc0000] text-white' : done ? 'bg-[#1a1a1a] text-white' : 'bg-black/[0.06] text-[#4a4a4a]'
                    }`}>
                      {done && !on ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : i + 1}
                    </span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0">
          <div className="lg:hidden mb-4">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-semibold text-[#1a1a1a]">Step {step + 1} of {STEPS.length}</span>
              <span className="text-ink-tertiary">{STEPS[step].title}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-black/[0.07] overflow-hidden" aria-hidden="true">
              <div className="h-full bg-[#cc0000] rounded-full" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>

          <section className="bg-white rounded-2xl border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-8" aria-labelledby="step-title">
            <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-[22px] sm:text-[26px] font-[800] tracking-tight text-[#1a1a1a] focus:outline-none">
              {STEPS[step].title}
            </h2>

            {step < REVIEW ? (
              <>
                <p className="mt-1 text-[15px] text-[#4a4a4a]">{section.intro}</p>
                <div className="mt-6 grid sm:grid-cols-2 gap-x-4 gap-y-6">
                  {section.fields.filter((f) => isFieldShown(f, form)).map((f, i, list) => (
                    <Fragment key={f.id}>
                      {f.group && f.group !== list[i - 1]?.group && (
                        <h3 className="sm:col-span-2 pt-5 -mb-1 border-t border-black/[0.07] text-[12px] font-bold uppercase tracking-[1.5px] text-[#1a1a1a]">
                          {f.group}
                        </h3>
                      )}
                      <div className={SHORT_TYPES.includes(f.type) ? '' : 'sm:col-span-2'}>
                        <IntakeField
                          field={f}
                          value={form[f.id]}
                          onChange={(v) => setField(f.id, v)}
                          error={errors[f.id]}
                          files={fileProps}
                        />
                      </div>
                    </Fragment>
                  ))}
                </div>
              </>
            ) : (
              <Review
                form={form}
                assets={assets}
                required={required}
                recommended={recommended}
                onGo={(sectionId, fieldId) => goTo(STEPS.findIndex((s) => s.id === sectionId), fieldId)}
              />
            )}

            <div className="mt-8 pt-5 border-t border-black/[0.07] flex flex-wrap items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => goTo(step - 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-black/[0.12] bg-white hover:border-black/30 text-[15px] font-semibold text-[#1a1a1a]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
                  Back
                </button>
              )}
              <button type="button" onClick={finishLater} className="px-2 py-3 text-[14px] font-semibold text-ink-tertiary hover:text-[#1a1a1a]">
                Finish later
              </button>
              <div className="flex-1" />
              {step < REVIEW ? (
                <button
                  type="button"
                  onClick={() => goTo(step + 1)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white text-[15px] font-semibold"
                >
                  <span>Next<span className="hidden sm:inline">: {STEPS[step + 1].title}</span></span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[15px] font-bold shadow-sm"
                >
                  {submitting ? 'Sending…' : meta.submittedAt ? 'Send my updates' : 'Send to our team'}
                </button>
              )}
            </div>
            {laterNote && (
              <p role="status" className="mt-3 text-[13px] text-[#4a4a4a]">
                {save.state === 'error'
                  ? 'We couldn\'t save just now and will keep trying. Keep this page open for a moment.'
                  : 'Your answers are saved. Come back anytime with the link in your email.'}
              </p>
            )}
            {submitError && <p role="alert" className="mt-3 text-[14px] font-medium text-[#cc0000]">{submitError}</p>}
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Review({ form, assets, required, recommended, onGo }) {
  const counts = Object.entries(ASSET_KINDS)
    .map(([kind, k]) => [k.label, assets.filter((a) => a.kind === kind).length])
    .filter(([, n]) => n > 0);
  return (
    <div className="mt-1">
      <p className="text-[15px] text-[#4a4a4a]">Check what you've told us, then send it over. You can still make changes afterwards.</p>

      {required.length > 0 && (
        <div className="mt-5 rounded-xl border border-[#cc0000]/30 bg-[#fff5f5] px-4 py-3.5">
          <p className="text-[14px] font-semibold text-[#cc0000]">Needed before you can send</p>
          <ul className="mt-2 space-y-1">
            {required.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onGo(m.section, m.id)} className="text-[14px] text-[#1a1a1a] underline underline-offset-2 hover:text-[#cc0000]">
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommended.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <p className="text-[14px] font-semibold text-amber-900">Good to add if you have it</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recommended.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onGo(m.section, m.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-amber-300 text-[13px] font-semibold text-amber-900 hover:border-amber-500"
                >
                  + {m.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[13px] text-amber-900/80">You can send now and add these later with the same link.</p>
        </div>
      )}

      <ul className="mt-5 divide-y divide-black/[0.06] rounded-xl border border-black/[0.08]">
        {FORM_SECTIONS.map((s) => {
          const { answered, total } = sectionProgress(s, form, assets);
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${answered ? 'bg-emerald-500' : 'bg-black/15'}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#1a1a1a]">{s.title}</p>
                <p className="text-[12px] text-ink-tertiary">{answered} of {total} answered</p>
              </div>
              <button type="button" onClick={() => onGo(s.id)} className="text-[13px] font-semibold text-[#cc0000] hover:text-[#a80000]">
                Edit<span className="sr-only"> {s.title}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[13px] text-ink-tertiary">
        {counts.length ? `Files: ${counts.map(([l, n]) => `${l} ${n}`).join(' · ')}` : 'No files uploaded yet.'}
      </p>
    </div>
  );
}

function Shell({ children, save, onRetry }) {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/[0.07]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <img src={ACG_LOGO} alt="Auto Care Genius" className="h-6 sm:h-7" />
          {save && <SaveStatus save={save} onRetry={onRetry} />}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function SaveStatus({ save, onRetry }) {
  let content = null;
  if (save.state === 'pending' || save.state === 'saving') {
    content = (
      <>
        <span className="w-3 h-3 border-2 border-black/15 border-t-[#6b6b6b] rounded-full motion-safe:animate-spin" aria-hidden="true" />
        Saving…
      </>
    );
  } else if (save.state === 'error') {
    content = (
      <>
        <span className="text-[#cc0000]">Not saved</span>
        {onRetry && <button type="button" onClick={onRetry} className="font-semibold text-[#1a1a1a] underline underline-offset-2">Retry</button>}
      </>
    );
  } else if (save.state === 'saved' || save.at) {
    content = (
      <>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
        Saved
      </>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-ink-tertiary" aria-live="polite">
      {content}
    </p>
  );
}

function CenterCard({ eyebrow, title, children, tone }) {
  return (
    <div className="px-4 py-12 sm:py-20">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-black/[0.07] shadow-sm overflow-hidden">
        <div className={`h-1.5 ${tone === 'muted' ? 'bg-[#888]' : 'bg-[#cc0000]'}`} />
        <div className="px-7 sm:px-8 py-10 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${tone === 'muted' ? 'bg-black/5' : 'bg-[#cc0000]/10'}`}>
            {tone === 'muted' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /><line x1="3" y1="3" x2="21" y2="21" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            )}
          </div>
          <p className={`text-[11px] font-semibold uppercase tracking-[2px] mb-2 ${tone === 'muted' ? 'text-ink-tertiary' : 'text-[#cc0000]'}`}>{eyebrow}</p>
          <h1 className="text-2xl font-[900] text-[#1a1a1a] tracking-tight mb-3">{title}</h1>
          <div className="text-[14px] text-[#4a4a4a] leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
