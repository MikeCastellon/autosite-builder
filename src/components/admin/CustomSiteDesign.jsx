import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATES } from '../../data/templates.js';
import { customSiteAdmin, importAssetToSite, startDesignRun } from '../../lib/customSites.js';
import {
  DESIGN_MODEL, DESIGN_STALE_MS, SITE_BUSINESS_TYPES, brandAccent, designFromIntake, designProblems, isImportable, rankTemplates, showsPrices,
} from '../../lib/customSiteDesign.js';
import { formatBytes } from '../../lib/customSiteForm.js';
import { changedLeverGroups, leverGroupsChanged, sanitizeLevers } from '../../lib/designLevers.js';
import { unpackGeneratedContent } from '../../lib/siteRender.js';
import { supabase } from '../../lib/supabase.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import { formatDateTime } from './customSiteUi.jsx';
import { slotImages } from './studio/designPreview.js';

// The Design Studio loads only when an admin opens the setup page: these
// stay out of the bundle every visitor downloads.
const BrandSystemCard = lazy(() => import('./studio/BrandSystemCard.jsx'));
const DesignPreview = lazy(() => import('./studio/DesignPreview.jsx'));
const FactsField = lazy(() => import('./studio/FactsField.jsx'));
const FontField = lazy(() => import('./studio/FontField.jsx'));
const GooglePlaceField = lazy(() => import('./studio/GooglePlaceField.jsx'));
const LayoutField = lazy(() => import('./studio/LayoutField.jsx'));
const LooksPicker = lazy(() => import('./studio/LooksPicker.jsx'));
const PaletteField = lazy(() => import('./studio/PaletteField.jsx'));
const SectionsField = lazy(() => import('./studio/SectionsField.jsx'));
const SuggestPanel = lazy(() => import('./studio/SuggestPanel.jsx'));
const Loading = () => <p className="text-[13px] text-ink-tertiary">Loading…</p>;

// The Design step of a custom website project: the card on the project page
// (state of the build and what to do next) and the full-page setup where the
// admin confirms the details, picks the look and photos, and has Claude write
// the site. See src/lib/customSiteDesign.js.

const MODEL_NAME = DESIGN_MODEL === 'claude-opus-5-5' ? 'Claude Opus 5.5' : DESIGN_MODEL;
const BTN = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-black/[0.12] text-[13px] font-semibold text-[#1a1a1a] hover:border-[#cc0000]/40 disabled:opacity-50 transition-colors';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-60 text-white text-[13px] font-bold transition-colors';
const INPUT = 'w-full px-3 py-2 rounded-lg border border-black/[0.12] text-sm bg-white focus:outline-none focus:border-[#cc0000]';
const ALL_TEMPLATES = Object.values(TEMPLATES);

function templateById(id) {
  return ALL_TEMPLATES.find((t) => t.id === id) || null;
}

// Starts a copy-writing run: the server claims it, then the background
// function runs it. Returns the claimed project.
export async function generateDesign(projectId) {
  const res = await customSiteAdmin('design-generate', { id: projectId });
  try {
    await startDesignRun(projectId, res.startedAt);
  } catch (e) {
    // Give the claim up so the project doesn't sit at "generating".
    await customSiteAdmin('design-release', { id: projectId, startedAt: res.startedAt, error: e.message }).catch(() => {});
    throw e;
  }
  return res.project;
}

// ─── Card on the project page ────────────────────────────────────────

export function DesignCard({ project, onReload, onSetup, onOpenEditor, onOpenBookingSettings }) {
  const { toast } = useAlert();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const status = project.design_status || 'none';
  const site = project.site || null;
  const first = project.client_first_name || 'the customer';
  const handedOver = !!project.handed_over_at;
  const template = templateById(site?.templateId || project.design?.templateId);

  // While Claude writes, check every few seconds.
  useEffect(() => {
    if (status !== 'generating') return undefined;
    const poll = setInterval(() => onReload?.(), 5000);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [status, onReload]);

  async function retry() {
    setBusy(true);
    try {
      await generateDesign(project.id);
      onReload?.();
    } catch (e) {
      toast(e.message || 'Could not start', 'error');
    } finally {
      setBusy(false);
    }
  }

  function openEditor() {
    onOpenEditor?.(site.id);
  }

  const elapsed = project.design_started_at ? Math.max(0, Math.round((Date.now() - Date.parse(project.design_started_at)) / 1000)) : 0;
  void tick;

  return (
    <section className="bg-white rounded-2xl border border-black/[0.07] p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px]">Design</h3>
        {template && <span className="text-[12px] text-ink-tertiary">Template: {template.label}</span>}
        {site && !handedOver && <span className="ml-auto text-[11px] font-semibold text-ink-tertiary">In your account until hand-over</span>}
      </div>

      {status === 'generating' ? (
        <div className="flex items-center gap-4 rounded-xl bg-[#faf9f7] border border-black/[0.06] px-4 py-4" role="status">
          <span className="w-6 h-6 border-[3px] border-black/10 border-t-[#cc0000] rounded-full motion-safe:animate-spin shrink-0" aria-hidden="true" />
          <div>
            <p className="text-[14px] font-semibold text-[#1a1a1a]">{MODEL_NAME} is writing {first}'s site…</p>
            <p className="text-[12px] text-ink-tertiary">
              Usually 1–3 minutes. You can leave this page; it keeps going. {elapsed > 0 && `(${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')})`}
            </p>
            {elapsed > 10 * 60 && elapsed * 1000 <= DESIGN_STALE_MS && (
              <p className="mt-1 text-[12px] text-amber-800">Taking longer than usual. It stops by itself after 16 minutes, then you can try again.</p>
            )}
            {elapsed * 1000 > DESIGN_STALE_MS && (
              <button type="button" onClick={retry} disabled={busy} className={`${BTN_PRIMARY} mt-2`}>{busy ? 'Starting…' : 'Try again'}</button>
            )}
          </div>
        </div>
      ) : status === 'failed' ? (
        <div className="rounded-xl bg-[#fff5f5] border border-[#cc0000]/20 px-4 py-3.5">
          <p className="text-[14px] font-semibold text-[#cc0000]">The copy didn't get written</p>
          <p className="mt-0.5 text-[13px] text-[#4a4a4a]">{project.design_error || 'Something went wrong.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={retry} disabled={busy} className={BTN_PRIMARY}>{busy ? 'Starting…' : 'Try again'}</button>
            <button type="button" onClick={onSetup} className={BTN}>Edit details</button>
          </div>
        </div>
      ) : site ? (
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className="text-[#1a1a1a] font-semibold">{site.name || project.business_name || 'Site'}</span>
            {site.publishedUrl
              ? <a href={site.publishedUrl} target="_blank" rel="noreferrer" className="text-[#cc0000] font-semibold hover:underline break-all">{site.publishedUrl.replace(/^https?:\/\//, '')}</a>
              : <span className="text-ink-tertiary">Not published yet: open the editor and press Publish to get a draft link.</span>}
          </div>
          <p className="mt-1 text-[12px] text-ink-tertiary">
            {handedOver ? `In ${site.ownerEmail || project.client_email}'s account since ${formatDateTime(project.handed_over_at)}.` : `Last written ${formatDateTime(project.design_finished_at)}.`}
            {site.schedulerEnabled ? ' Bookings are on.' : ''}
          </p>
          {handedOver ? (
            <p className="mt-3 text-[12px] text-[#4a4a4a]">
              To change it now, sign in as them: Admin › Customers › their account › View as user. Edits made from your own account would move the site back to you.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={openEditor} className={BTN_PRIMARY}>Open in editor</button>
              <button type="button" onClick={() => onOpenBookingSettings?.(site.id)} className={BTN}>Booking settings</button>
              <button type="button" onClick={onSetup} className={BTN}>Edit details &amp; rewrite</button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <p className="min-w-0 flex-1 text-[14px] text-[#4a4a4a]">
            Build the site from {first}'s answers: confirm the details, pick the look and photos, and {MODEL_NAME} writes every page.
            {!project.form_submitted_at && ' They haven\'t sent the form yet, so start with what you have or wait for it.'}
          </p>
          <button type="button" onClick={onSetup} className={project.form_submitted_at ? BTN_PRIMARY : BTN}>Set up the design</button>
        </div>
      )}
    </section>
  );
}

// ─── Full-page setup ─────────────────────────────────────────────────

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12px] font-semibold text-[#1a1a1a] mb-1">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[11px] text-ink-tertiary">{hint}</span>}
    </label>
  );
}

function Section({ title, intro, children }) {
  return (
    <section className="bg-white rounded-2xl border border-black/[0.07] p-5 sm:p-6">
      <h3 className="text-[16px] font-[800] text-[#1a1a1a]">{title}</h3>
      {intro && <p className="mt-0.5 text-[13px] text-ink-tertiary">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const SLOT_LABELS = { logo: 'Logo', hero: 'Hero (top of the page)', about: 'About section' };

export function DesignSetup({ project, onBack, onStarted }) {
  const { toast, confirm } = useAlert();
  const form = project.form || {};
  const saved = project.design && project.design.businessInfo ? project.design : null;
  const start = useMemo(() => {
    const fromIntake = designFromIntake(project);
    if (!saved) return fromIntake;
    return {
      ...fromIntake,
      ...saved,
      businessInfo: { ...fromIntake.businessInfo, ...saved.businessInfo },
      slots: { ...fromIntake.slots, ...(saved.slots || {}) },
      brandHexes: fromIntake.brandHexes,
    };
  }, [project, saved]);

  const [info, setInfo] = useState(start.businessInfo);
  const ranked = useMemo(() => rankTemplates(ALL_TEMPLATES, info.businessType, form.styles || []), [info.businessType, form.styles]);
  const [templateId, setTemplateId] = useState(start.templateId || '');
  const [useBrand, setUseBrand] = useState(saved ? saved.useBrand !== false && start.brandHexes.length > 0 : start.brandHexes.length > 0);
  const [slots, setSlots] = useState(start.slots);
  // The Design Studio's settings (src/lib/designLevers.js).
  const [levers, setLevers] = useState(() => sanitizeLevers(start.levers, start.templateId || ''));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // Default to the best match once the business type is known.
  useEffect(() => {
    if (!templateId && ranked.length && info.businessType) setTemplateId(ranked[0].id);
  }, [templateId, ranked, info.businessType]);

  // A section order belongs to one template: a switch starts the new one
  // from its own default order (keeping the rest of the settings).
  const leversTemplate = useRef(start.templateId || '');
  useEffect(() => {
    if (leversTemplate.current === templateId) return;
    const from = leversTemplate.current;
    leversTemplate.current = templateId;
    setLevers((l) => sanitizeLevers(from ? { ...l, sections: { order: [], hidden: [] } } : l, templateId));
  }, [templateId]);

  // The site's own text and settings once it has been written, so the
  // preview shows the real page rather than sample text.
  const [site, setSite] = useState(null);
  useEffect(() => {
    const id = saved?.siteId || project.site_id;
    if (!id) return undefined;
    let live = true;
    supabase.from('sites').select('business_info, generated_content').eq('id', id).maybeSingle()
      .then(({ data }) => { if (live && data) setSite({ info: data.business_info || {}, ...unpackGeneratedContent(data.generated_content) }); })
      .catch(() => {});
    return () => { live = false; };
  }, [saved?.siteId, project.site_id]);

  // Half-typed About stat rows survive applying a look, brand or suggestion
  // (those sanitize the levers, which drops incomplete rows).
  const keepStats = (next) => setLevers((l) => ({ ...next, aboutStats: l.aboutStats }));

  const template = templateById(templateId);
  const accent = template && useBrand ? brandAccent(template.colors?.bg, start.brandHexes) : {};
  const files = (project.files || []).filter((f) => f.url);
  const importable = files.filter((f) => isImportable(f.name));
  const notImportable = files.filter((f) => !isImportable(f.name) && f.kind !== 'reference');
  const set = (k) => (e) => setInfo((prev) => ({ ...prev, [k]: e.target.value }));

  function setService(i, patch) {
    setInfo((prev) => ({ ...prev, services: prev.services.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  }

  // Changed since the last write? Sticky until a run applies them (the
  // background run clears it), so Save now and Rewrite later still applies.
  const cleanLevers = sanitizeLevers(levers, templateId);
  const leversChanged = [...new Set([
    ...leverGroupsChanged(saved?.leversChanged),
    ...changedLeverGroups(cleanLevers, sanitizeLevers(saved?.levers, templateId)),
  ])];

  // The design as it will be saved, with images (once imported) and colors.
  function buildDesign(extra = {}) {
    return {
      levers: cleanLevers,
      leversChanged,
      businessInfo: info,
      templateId,
      template: { label: template?.label || '', mood: template?.mood || '' },
      customColors: accent,
      useBrand,
      slots,
      images: saved?.images || {},
      imported: saved?.imported || {},
      siteId: saved?.siteId || project.site_id || '',
      ...extra,
    };
  }

  async function save() {
    setBusy('save');
    setError('');
    try {
      await customSiteAdmin('design-save', { id: project.id, design: buildDesign() });
      toast('Design saved', 'success');
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setBusy('');
    }
  }

  // Copies the chosen uploads into the site's images (only ones that
  // changed since the last run), then saves and starts the writing.
  async function generate() {
    setError('');
    const draft = buildDesign();
    const missing = designProblems({ ...draft, siteId: 'pending' });
    if (missing.length) { setError(`Fill in: ${missing.join(', ')}`); return; }
    if (project.site_id) {
      const ok = await confirm(
        'This rewrites the site\'s text and business details from this page, replacing text changed in the editor. Photos, the brand color and the Design Studio settings change only where you changed them here; the rest of your editor work stays.',
        { title: 'Rewrite the site?', confirmText: 'Rewrite' },
      );
      if (!ok) return;
    }
    setBusy('generate');
    try {
      const siteId = draft.siteId || crypto.randomUUID();
      const wanted = { logo: slots.logo, hero: slots.hero, about: slots.about };
      slots.gallery.forEach((p, i) => { wanted[`gallery${i}`] = p; });
      // Photo links expire an hour after the page loaded: get fresh ones.
      const fresh = (await customSiteAdmin('get', { id: project.id })).project?.files || [];
      const images = {};
      const imported = {};
      for (const [key, path] of Object.entries(wanted)) {
        if (!path) continue;
        if (draft.imported[key] === path && draft.images[key]) {
          images[key] = draft.images[key];
          imported[key] = path;
          continue;
        }
        const file = fresh.find((f) => f.path === path && f.url);
        if (!file) continue;
        setBusy(`Copying ${file.name}…`);
        images[key] = await importAssetToSite({ url: file.url, name: file.name, siteId, imageKey: key });
        imported[key] = path;
      }
      // What this session changed: a rewrite applies only these to the site.
      const keys = new Set([...Object.keys(wanted), ...Object.keys(draft.imported)]);
      const imagesChanged = [...keys].filter((k) => (wanted[k] || '') !== (draft.imported[k] || ''));
      const colorsChanged = (saved?.customColors?.accent || '') !== (accent.accent || '') || (saved?.templateId || '') !== templateId;
      setBusy('Starting…');
      await customSiteAdmin('design-save', { id: project.id, design: { ...draft, siteId, images, imported, imagesChanged, colorsChanged } });
      await generateDesign(project.id);
      onStarted?.();
    } catch (e) {
      setError(e.message || 'Could not start');
      setBusy('');
    }
  }

  const toggleGallery = (path) => setSlots((prev) => {
    const has = prev.gallery.includes(path);
    return { ...prev, gallery: has ? prev.gallery.filter((p) => p !== path) : [...prev.gallery, path].slice(0, 12) };
  });

  return (
    <div>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-tertiary hover:text-[#1a1a1a]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        Back to the project
      </button>
      <header className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#cc0000]">Design · {project.business_name || project.client_name}</p>
        <h2 className="mt-1 text-[28px] sm:text-[34px] leading-[1.1] font-[900] tracking-tight text-[#1a1a1a]">Set up the site</h2>
        <p className="mt-1.5 text-[14px] text-[#4a4a4a] max-w-2xl">
          Everything here starts from {project.client_first_name || 'the customer'}'s answers. Check it, pick the look and photos,
          and {MODEL_NAME} writes the site from these details plus their whole brief. You'll polish it in the editor after.
        </p>
      </header>

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)] lg:gap-6 lg:items-start">
      <div className="space-y-6 min-w-0">
        <Section title="Business details" intro="What the site says about the business. Facts only: the AI won't invent anything you leave out.">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Business name"><input value={info.businessName} onChange={set('businessName')} className={INPUT} /></Field>
            <Field label="Business type" hint={!form.businessType || form.businessType === 'other' ? `They answered "${form.businessType ? 'Something else' : 'nothing'}": pick the closest.` : null}>
              <select value={info.businessType} onChange={set('businessType')} className={INPUT}>
                <option value="">Choose one</option>
                {SITE_BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="City" hint="Used in headings and search results."><input value={info.city} onChange={set('city')} className={INPUT} /></Field>
            <Field label="State" hint="Two letters, like FL."><input value={info.state} onChange={set('state')} maxLength={20} className={INPUT} /></Field>
            <Field label="Phone"><input value={info.phone} onChange={set('phone')} className={INPUT} /></Field>
            <Field label="Address" hint="Leave blank for mobile-only businesses."><input value={info.address} onChange={set('address')} className={INPUT} /></Field>
            <Field label="Service area"><input value={info.serviceArea} onChange={set('serviceArea')} className={INPUT} /></Field>
            <Field label="Hours" hint="As they wrote them."><input value={info.hours} onChange={set('hours')} className={INPUT} /></Field>
            <Field label="Why customers choose them" className="sm:col-span-2">
              <textarea rows={3} value={info.specialties} onChange={set('specialties')} className={`${INPUT} leading-relaxed`} />
            </Field>
          </div>
          <div className="mt-5">
            <p className="text-[12px] font-semibold text-[#1a1a1a] mb-2">Services</p>
            {!showsPrices(info.businessType) && (
              <p className="-mt-1 mb-2 text-[11px] text-ink-tertiary">This business type's templates list services without prices.</p>
            )}
            <div className="space-y-2">
              {info.services.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input value={s.name} onChange={(e) => setService(i, { name: e.target.value })} placeholder="Service" aria-label={`Service ${i + 1} name`} className={INPUT} />
                  {showsPrices(info.businessType) && (
                    <input value={s.price} onChange={(e) => setService(i, { price: e.target.value })} placeholder="Price" aria-label={`Service ${i + 1} price`} className={`${INPUT} max-w-[140px]`} />
                  )}
                  <button
                    type="button"
                    onClick={() => setInfo((prev) => ({ ...prev, services: prev.services.filter((_, j) => j !== i) }))}
                    aria-label={`Remove service ${i + 1}`}
                    className="w-9 shrink-0 rounded-lg text-ink-tertiary hover:text-[#cc0000] hover:bg-black/[0.04]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setInfo((prev) => ({ ...prev, services: [...prev.services, { name: '', price: '', description: '' }] }))}
              className="mt-2 text-[13px] font-semibold text-[#cc0000] hover:text-[#a80000]"
            >
              + Add a service
            </button>
          </div>
        </Section>

        <Section title="Look" intro={form.styles?.length ? `They picked: ${form.styles.join(', ')}.` : 'They didn\'t pick a style.'}>
          {!info.businessType ? (
            <p className="text-[13px] text-ink-tertiary">Choose the business type first.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ranked.map((r, i) => {
                const t = templateById(r.id);
                const on = templateId === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setTemplateId(r.id)}
                      aria-pressed={on}
                      className={`w-full h-full text-left rounded-xl border p-3.5 transition-colors ${on ? 'border-[#cc0000] bg-[#cc0000]/[0.05]' : 'border-black/[0.08] hover:border-[#cc0000]/40'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex overflow-hidden rounded-md border border-black/10" aria-hidden="true">
                          {[t.colors.bg, t.colors.accent, t.colors.secondary].map((c, k) => <span key={k} className="w-5 h-7" style={{ background: c }} />)}
                        </span>
                        <span className="text-[14px] font-bold text-[#1a1a1a]">{t.label}</span>
                        {i === 0 && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#cc0000]">Best match</span>}
                      </span>
                      <span className="block mt-1.5 text-[12px] text-ink-tertiary leading-snug">{t.description}</span>
                      {r.reasons.length > 0 && <span className="block mt-1 text-[11px] text-[#4a4a4a]">{r.reasons.join(' · ')}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {start.brandHexes.length > 0 ? (
              <>
                <label className="inline-flex items-center gap-2 text-[13px] text-[#1a1a1a] cursor-pointer">
                  <input type="checkbox" checked={useBrand} onChange={(e) => setUseBrand(e.target.checked)} className="w-4 h-4 accent-[#cc0000]" />
                  Use their brand color for buttons and highlights
                </label>
                <span className="flex gap-1.5" aria-label="Their colors">
                  {start.brandHexes.map((h) => <span key={h} title={h} className="w-5 h-5 rounded border border-black/15" style={{ background: h }} />)}
                </span>
                {useBrand && template && (
                  accent.accent
                    ? <span className="text-[12px] text-ink-tertiary">Accent on {template.label}: <span className="inline-block w-3 h-3 rounded-sm align-middle border border-black/15" style={{ background: accent.accent }} /> {accent.accent}</span>
                    : <span className="text-[12px] text-amber-800">None of their colors works as a highlight on this template's background; it keeps its own.</span>
                )}
              </>
            ) : (
              <p className="text-[13px] text-ink-tertiary">
                {form.colorMode === 'logo' ? 'They asked to match their logo: set the colors in the editor after.' : 'No brand colors given: the template keeps its own. You can change colors in the editor.'}
              </p>
            )}
          </div>
        </Section>

        <Suspense fallback={<Loading />}>
        <Section title="Suggest a design" intro={`Let ${MODEL_NAME} propose the whole look from their files and answers. You review every part.`}>
          <SuggestPanel
            project={project}
            current={{ templateId, levers: cleanLevers, slots }}
            modelName={MODEL_NAME}
            disabled={!!busy}
            onApply={(next) => {
              // The suggestion's sections are made for its template: move the
              // levers' template marker first so the switch keeps them.
              if (next.templateId !== templateId) {
                leversTemplate.current = next.templateId;
                setTemplateId(next.templateId);
              }
              keepStats(next.levers);
              setSlots(next.slots);
            }}
          />
        </Section>

        <BrandSystemCard
          projectId={project.id}
          brand={project.design?.brand || null}
          levers={cleanLevers}
          onApply={(next) => keepStats(sanitizeLevers(next, templateId))}
        />

        {template && (
          <>
            <Section title="Starting look" intro="Curated looks for this template. Pick one, then fine-tune below.">
              <LooksPicker templateId={templateId} levers={cleanLevers} disabled={!!busy} onApply={keepStats} />
            </Section>

            <Section title="Colors" intro="All five colors of the page. The site repairs any pair that isn't readable.">
              <PaletteField
                value={levers.palette}
                onChange={(palette) => setLevers((l) => ({ ...l, palette }))}
                templateId={templateId}
                defaults={template.colors}
                brandHexes={start.brandHexes}
              />
            </Section>

            <Section title="Fonts" intro="A heading and body pair. Custom sites can use every font in the catalog.">
              <FontField
                value={levers.fonts}
                onChange={(fonts) => setLevers((l) => ({ ...l, fonts }))}
                defaults={{ heading: template.font, body: template.bodyFont }}
                styles={form.styles}
                businessType={info.businessType}
                mood={template.mood}
                sample={info.businessName}
              />
            </Section>

            <Section title="Sections" intro="Order and show or hide the page's sections.">
              <SectionsField templateId={templateId} value={levers.sections} onChange={(sections) => setLevers((l) => ({ ...l, sections }))} />
            </Section>

            <Section title="Layout" intro="The hero and About layouts.">
              <LayoutField templateId={templateId} value={levers} onChange={(part) => setLevers((l) => ({ ...l, ...part }))} />
            </Section>

            <Section title="Trust facts" intro="Only what they told you. Empty fields stay off the site.">
              <FactsField value={levers.facts} onChange={(facts) => setLevers((l) => ({ ...l, facts }))} />
            </Section>

            <Section title="Google profile" intro="Their real Google rating, for templates with a Google badge.">
              <GooglePlaceField
                value={levers.googlePlace}
                onChange={(googlePlace) => setLevers((l) => ({ ...l, googlePlace }))}
                businessName={info.businessName}
                city={info.city}
                state={info.state}
                profileLink={form.googleProfile}
                disabled={!!busy}
              />
            </Section>
          </>
        )}

        </Suspense>

        <Section title="Photos" intro="Copied into the site when it's written (resized for the web). You can change them in the editor later.">
          {importable.length === 0 ? (
            <p className="text-[13px] text-ink-tertiary">No usable photos yet. The template's placeholders show until you add some in the editor.</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(SLOT_LABELS).map(([slot, label]) => (
                <div key={slot}>
                  <p className="text-[12px] font-semibold text-[#1a1a1a] mb-2">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSlots((p) => ({ ...p, [slot]: '' }))} aria-pressed={!slots[slot]}
                      className={`w-20 h-20 rounded-lg border text-[11px] font-semibold ${!slots[slot] ? 'border-[#cc0000] text-[#cc0000]' : 'border-black/[0.10] text-ink-tertiary'}`}>
                      None
                    </button>
                    {importable.filter((f) => (slot === 'logo' ? f.kind === 'logo' || f.kind === 'brand' : f.kind === 'photo')).map((f) => (
                      <button key={f.path} type="button" onClick={() => setSlots((p) => ({ ...p, [slot]: f.path }))} aria-pressed={slots[slot] === f.path} title={f.name}
                        className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${slots[slot] === f.path ? 'border-[#cc0000]' : 'border-transparent'}`}
                        style={{ background: 'repeating-conic-gradient(#f1f1f1 0% 25%, #fff 0% 50%) 50% / 12px 12px' }}>
                        <img src={f.url} alt={f.name} className={`w-full h-full ${slot === 'logo' ? 'object-contain p-1' : 'object-cover'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-[12px] font-semibold text-[#1a1a1a] mb-2">Gallery <span className="font-normal text-ink-tertiary">({slots.gallery.length} of 12)</span></p>
                <div className="flex flex-wrap gap-2">
                  {importable.filter((f) => f.kind === 'photo').map((f) => {
                    const on = slots.gallery.includes(f.path);
                    return (
                      <button key={f.path} type="button" onClick={() => toggleGallery(f.path)} aria-pressed={on} title={f.name}
                        className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 ${on ? 'border-[#cc0000]' : 'border-transparent'}`}>
                        <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                        {on && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#cc0000] text-white text-[11px] font-bold flex items-center justify-center">{slots.gallery.indexOf(f.path) + 1}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {notImportable.length > 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
              Can't be used as-is (convert to JPG or PNG first): {notImportable.map((f) => `${f.name}${f.size ? ` (${formatBytes(f.size)})` : ''}`).join(', ')}.
            </p>
          )}
        </Section>
      </div>

      {template && (
        <aside className="mt-6 lg:mt-0 lg:sticky lg:top-4" aria-label="Preview">
          <Suspense fallback={<Loading />}>
            <DesignPreview
              templateId={templateId}
              businessInfo={info}
              levers={cleanLevers}
              copy={site?.copy}
              existingInfo={site?.info}
              customColors={{ ...(site?.customColors || {}), ...accent }}
              customFonts={site?.customFonts}
              images={{ ...(site?.images || {}), ...slotImages({ slots, files: project.files, images: saved?.images, imported: saved?.imported }) }}
              projectId={project.id}
            />
          </Suspense>
        </aside>
      )}
      </div>

      <div className="sticky bottom-0 z-20 mt-6 -mx-3 px-3 py-4 bg-[#faf9f7]/95 backdrop-blur border-t border-black/[0.07] flex flex-wrap items-center gap-3">
        {error && <p role="alert" className="text-[13px] font-medium text-[#cc0000]">{error}</p>}
        {busy && busy !== 'save' && busy !== 'generate' && <p role="status" className="text-[13px] text-ink-tertiary">{busy}</p>}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={save} disabled={!!busy} className={BTN}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={generate} disabled={!!busy} className={BTN_PRIMARY}>
            {busy && busy !== 'save' ? 'Working…' : project.site_id ? `Rewrite with ${MODEL_NAME}` : `Write the site with ${MODEL_NAME}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hand-over ───────────────────────────────────────────────────────

export function HandoverCard({ project, onDone }) {
  const { toast, confirm } = useAlert();
  const [account, setAccount] = useState(undefined); // undefined = loading, null = none
  const [compPro, setCompPro] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState('');
  const site = project.site || null;
  const first = project.client_first_name || 'the customer';
  const handedOver = !!project.handed_over_at;

  useEffect(() => {
    if (handedOver || !site) return undefined;
    let live = true;
    customSiteAdmin('handover-check', { id: project.id })
      .then((res) => { if (live) setAccount(res.account || null); })
      .catch(() => { if (live) setAccount(null); });
    return () => { live = false; };
  }, [project.id, handedOver, site]);

  async function handOver() {
    const lines = [
      account ? `Move the site to ${account.email}'s account.` : `Create an account for ${project.client_email} and move the site there.`,
      compPro && !account?.isPro ? 'Give them Pro (bookings and payments) at no charge.' : null,
      !compPro && !account?.isPro ? 'They stay on the free plan: bookings switch off, and the free-plan badge appears once the site is republished.' : null,
      sendEmail ? (account ? 'Email them that the site is in their account.' : 'Email them a link to set their password.') : 'Send no email.',
      'After this, publishing happens from their account.',
    ].filter(Boolean);
    const ok = await confirm(lines.join(' '), { title: 'Hand the site over?', confirmText: 'Hand over' });
    if (!ok) return;
    setBusy('handover');
    try {
      // Never comp Pro on top of a plan they pay for.
      const res = await customSiteAdmin('handover', { id: project.id, compPro: compPro && !account?.isPro, sendEmail });
      if (res.emailError) toast(`Handed over, but the email didn't send: ${res.emailError}`, 'error');
      else toast(`The site is in ${project.client_email}'s account now`, 'success');
      onDone?.();
    } catch (e) {
      toast(e.message || 'Could not hand over', 'error');
    } finally {
      setBusy('');
    }
  }

  async function resend() {
    setBusy('email');
    try {
      await customSiteAdmin('handover-email', { id: project.id });
      toast(`Access email sent to ${project.client_email}`, 'success');
      onDone?.();
    } catch (e) {
      toast(e.message || 'The email did not send', 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-black/[0.07] p-5 sm:p-6">
      <h3 className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px] mb-3">Hand-over</h3>
      {handedOver ? (
        <div className="text-[13px]">
          <p className="text-[#1a1a1a]">In <strong>{site?.ownerEmail || project.client_email}</strong>'s account since {formatDateTime(project.handed_over_at)}.</p>
          <p className="mt-1 text-[12px] text-ink-tertiary">To make changes now, use Admin › Customers › View as user.</p>
          <button type="button" onClick={resend} disabled={!!busy} className={`${BTN} mt-3`}>{busy === 'email' ? 'Sending…' : 'Resend access email'}</button>
        </div>
      ) : !site ? (
        <p className="text-[13px] text-ink-tertiary">Once the site is designed, hand it to {first}'s own account here: bookings, customers and payments then go to them.</p>
      ) : account === undefined ? (
        <p className="text-[13px] text-ink-tertiary">Checking {project.client_email}…</p>
      ) : (
        <div className="text-[13px]">
          {account ? (
            <p className="text-[#1a1a1a]">
              {first} has an account ({account.email}){account.isPro ? ' on Pro' : ''}.
              {account.sites.filter((s) => s.type === 'website').length > 0 && (
                <span className="block mt-1 text-amber-800">
                  They already have a website ({account.sites.filter((s) => s.type === 'website').map((s) => s.name || 'unnamed').join(', ')}). This becomes another one.
                </span>
              )}
            </p>
          ) : (
            <p className="text-[#1a1a1a]">{first} doesn't have an account yet. We'll create one for {project.client_email}.</p>
          )}
          {!account?.isPro && (
            <label className="mt-3 flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={compPro} onChange={(e) => setCompPro(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#cc0000]" />
              <span>Include Pro <span className="block text-[11px] text-ink-tertiary">Bookings, deposits and payments. Bookings switch off on a free account.</span></span>
            </label>
          )}
          <label className="mt-2 flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#cc0000]" />
            <span>Email {first} {account ? 'that it\'s in their account' : 'a link to set their password'}</span>
          </label>
          {!site.publishedUrl && <p className="mt-2 text-[12px] text-amber-800">The site isn't published yet. Publish it from the editor first so it's live when they sign in.</p>}
          <button type="button" onClick={handOver} disabled={!!busy || project.design_status === 'generating'} className={`${BTN_PRIMARY} mt-3`}>
            {busy === 'handover' ? 'Handing over…' : `Hand over to ${first}`}
          </button>
        </div>
      )}
    </section>
  );
}
