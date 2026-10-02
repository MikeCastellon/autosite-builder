import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAlert } from '../ui/AlertProvider.jsx';
import { TEMPLATES } from '../../data/templates.js';
import { resolveSiteRender, applyWidgetKeys } from '../../lib/siteRender.js';
import { exportHtmlString } from '../../lib/exportHtml.js';
import { buildBookingPageHtml } from '../../lib/bookingPageHtml.js';
import { isEffectiveSchedulerActive } from '../../lib/subscriptionGating.js';
import {
  PRODUCTION_APP_ORIGIN, SITE_UPGRADE_RELEASE_DATE, checkUpgradedContent, eligibility, isUpgradedSite, nextStep,
} from '../../lib/siteUpgrade.js';

// Admin > Site upgrades. After the new template designs ship, admins
// republish every live website for its owner:
//   1. Check   builds the new page in this browser exactly as the owner's
//              dashboard Republish would (resolveSiteRender + the owner's
//              widget keys + exportHtmlString, with the OWNER's plan for the
//              "Powered by" bar), reads the live page from R2, and runs
//              checkUpgradedContent + eligibility (src/lib/siteUpgrade.js).
//   2. Compare live vs new side by side (sandboxed iframes, phone/desktop).
//   3. Republish a ready site. admin-site-upgrade backs the live page up
//      first; Restore puts any backup back and puts the site on hold.
// Flagged sites are never published from here; each says why and what to
// do next (usually: Back up now, then the owner's own Republish).
//
// exportHtml writes window.location.origin into the page's booking and
// contact widget URLs, so publishing and restoring only work on the
// production app. Anywhere else (deploy previews, localhost) the tab only
// previews. The function refuses such pages too.
//
// A bulk run lives in this component: leaving the tab stops it after the
// current site, and closing the browser tab asks first. Register the tab
// in AdminPage like the others (`{tab === 'site-upgrades' && <SiteUpgradesTab />}`).

const FN = '/.netlify/functions/admin-site-upgrade';

const SITE_COLUMNS = 'id, user_id, business_info, template_id, slug, published_url, custom_domain, custom_domain_status, site_type, scheduler_enabled, widget_config_ids, created_at';
// What isEffectiveSchedulerActive reads, plus names for the list.
const OWNER_COLUMNS = 'id, email, first_name, last_name, is_super_admin, scheduler_enabled, subscription_status, subscription_ends_at, stripe_first_failed_payment_at';

async function upgradeApi(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Not signed in');
  let res;
  try {
    res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error('Can\'t reach the server. Check your connection and try again.');
  }
  let out = {};
  try { out = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) throw Object.assign(new Error(out.error || `Request failed (${res.status})`), { status: res.status, data: out });
  return out;
}

// Builds the new page for one site from its current row and checks it
// against the live page. Everything is re-read, so the bulk run can call
// it right before publishing.
async function buildAndCheck(siteId, appOrigin) {
  const { data: row, error } = await supabase
    .from('sites').select(`${SITE_COLUMNS}, generated_content`).eq('id', siteId).single();
  if (error || !row) throw new Error('Could not load the site');

  const { data: owner } = await supabase
    .from('profiles').select(OWNER_COLUMNS).eq('id', row.user_id).maybeSingle();

  const [{ widgets }, live] = await Promise.all([
    upgradeApi('inputs', { siteId }),
    upgradeApi('live', { siteId }),
  ]);

  // The dashboard Republish inputs: owner images, colors, fonts, widget
  // keys. Their widget keys come from the function, because RLS hides
  // another user's widget_configs from the admin's client.
  const render = resolveSiteRender(row, row.generated_content);
  const generatedCopy = applyWidgetKeys(render.generatedCopy, widgets);
  // The OWNER's plan decides the "Powered by" bar, never the admin's.
  const isPro = isEffectiveSchedulerActive(owner || null);
  const newHtml = render.templateMeta
    ? await exportHtmlString(render.templateId, render.businessInfo, generatedCopy, render.templateMeta, render.images, render.selectedWidgetIds, row.id, isPro)
    : null;
  // publishSite sends the /book shell whenever the site takes bookings.
  const bookingPageHtml = row.scheduler_enabled
    ? buildBookingPageHtml({ siteId: row.id, businessName: render.businessInfo.businessName })
    : null;

  const liveHtml = live.index?.html || null;
  const check = newHtml && liveHtml ? checkUpgradedContent(liveHtml, newHtml, row, { appOrigin }) : null;
  const verdict = eligibility(row, liveHtml, check, owner || null, {
    sharedSlug: !!live.shared,
    liveTooLarge: !!live.index?.tooLarge,
    renderCopy: generatedCopy,
    draftColors: render.templateMeta?.colors,
    templateKnown: !!render.templateMeta,
    hold: live.hold,
  });
  if (!newHtml && !verdict.reasons.length) verdict.reasons.push({ code: 'no_page', text: 'The new page could not be built' });
  if (!newHtml) verdict.status = 'flagged';

  return {
    row, owner, isPro, newHtml, bookingPageHtml, liveHtml,
    liveBook: !!live.book?.found,
    summary: {
      phase: 'checked',
      status: verdict.status,
      reasons: verdict.reasons,
      intended: check?.intended || [],
      hold: live.hold || null,
      isPro,
      checkedAt: new Date().toISOString(),
      newBytes: newHtml ? newHtml.length : 0,
      liveBytes: live.index?.size || 0,
    },
  };
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const BACKUP_WHY = {
  publish: 'saved before an upgrade',
  restore: 'saved before a restore',
  manual: 'saved by hand',
  owner: 'saved before the owner\'s first new-design publish',
};

// "2026-10-02T15-30-12-345Z-publish-1a2b3c4d" → readable time + why.
function backupLabel(b) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-([a-z]+)-[0-9a-f]+$/.exec(b.id);
  const when = m ? formatDateTime(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`) : b.id;
  const why = BACKUP_WHY[m?.[6]] || 'saved';
  return `${when} · ${why}${b.files?.includes('book/index.html') ? ' · + /book' : ''}`;
}

function StatusChip({ summary, upgraded }) {
  let label = 'Not checked';
  let cls = 'bg-gray-100 text-gray-600';
  if (summary?.phase === 'checking') [label, cls] = ['Checking…', 'bg-gray-100 text-gray-600'];
  else if (summary?.phase === 'publishing') [label, cls] = ['Publishing…', 'bg-[#1a1a1a] text-white'];
  else if (summary?.phase === 'restoring') [label, cls] = ['Restoring…', 'bg-[#1a1a1a] text-white'];
  else if (summary?.phase === 'error') [label, cls] = ['Error', 'bg-[#cc0000]/15 text-[#cc0000]'];
  else if (summary?.phase === 'published') [label, cls] = ['Republished', 'bg-[#cc0000] text-white'];
  else if (summary?.phase === 'restored') [label, cls] = ['Restored', 'bg-amber-100 text-amber-800'];
  else if (summary?.status === 'ready') [label, cls] = ['Ready', 'bg-emerald-100 text-emerald-800'];
  else if (summary?.status === 'flagged') [label, cls] = [`Flagged · ${summary.reasons.length}`, 'bg-amber-100 text-amber-800'];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cls}`}>{label}</span>
      {upgraded && summary?.phase !== 'published' && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-[#cc0000]/[0.08] text-[#cc0000]">New design live</span>
      )}
      {summary?.hold?.held && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-amber-100 text-amber-800">On hold</span>
      )}
    </span>
  );
}

// A page rendered at a real phone or desktop width, scaled to its column.
// sandbox="allow-scripts" without allow-same-origin: the page's scripts
// (Tailwind CDN, site runtime, widgets) run in an opaque origin and cannot
// touch the admin's session. Framed pages never count as site views.
function PreviewFrame({ title, html, device, empty }) {
  const boxRef = useRef(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setBoxW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const frameW = device === 'phone' ? 390 : 1280;
  const frameH = device === 'phone' ? 844 : 860;
  const scale = boxW ? Math.min(1, boxW / frameW) : 0.4;
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px] mb-2">{title}</p>
      <div ref={boxRef} className="relative overflow-hidden rounded-xl border border-black/[0.07] bg-[#faf9f7]" style={{ height: Math.round(frameH * scale) }}>
        {html ? (
          <iframe
            title={title}
            srcDoc={html}
            sandbox="allow-scripts"
            style={{
              position: 'absolute',
              top: 0,
              left: Math.max(0, (boxW - frameW * scale) / 2),
              width: frameW,
              height: frameH,
              border: 0,
              background: '#fff',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-tertiary px-6 text-center">{empty}</div>
        )}
      </div>
    </div>
  );
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unchecked', label: 'Not checked' },
  { id: 'ready', label: 'Ready' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'error', label: 'Errors' },
  { id: 'upgraded', label: 'New design live' },
];

export default function SiteUpgradesTab() {
  const { toast, confirm: confirmDialog } = useAlert();
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const canPublish = appOrigin === PRODUCTION_APP_ORIGIN;

  const [sites, setSites] = useState([]);
  const [owners, setOwners] = useState({});
  const [publishedAt, setPublishedAt] = useState({});
  const [publishedAtTracked, setPublishedAtTracked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [results, setResults] = useState({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [device, setDevice] = useState('desktop');
  const [busy, setBusy] = useState(null); // 'check-all' | 'publish-all' | null
  const [log, setLog] = useState([]);
  const [backups, setBackups] = useState({}); // siteId → { loading, list, error, pick }
  // Built pages, kept out of React state (a few hundred KB each).
  const pages = useRef({});
  const stopRef = useRef(false);
  const panelRef = useRef(null);
  // Republishing needs sites.published_at: it is what keeps finished sites
  // out of the next run (the function refuses without it too).
  const canRepublish = canPublish && publishedAtTracked;
  const republishBlockedTitle = !canPublish
    ? `Only on ${PRODUCTION_APP_ORIGIN}`
    : !publishedAtTracked ? 'Apply migration 20261004_sites_published_at.sql first' : undefined;

  // Leaving the tab (AdminPage unmounts it) stops a bulk run after the
  // current site, so nothing keeps publishing out of sight.
  useEffect(() => () => { stopRef.current = true; }, []);
  // Closing or reloading the browser tab mid-run asks first.
  useEffect(() => {
    if (!busy || typeof window === 'undefined') return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [busy]);
  // The detail panel sits above the table: bring it into view on open.
  useEffect(() => {
    if (openId) panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [openId]);

  const patchResult = useCallback((id, patch) => {
    setResults((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }, []);
  const addLog = useCallback((text, tone = 'info') => {
    setLog((prev) => [...prev, { at: new Date().toISOString(), text, tone }]);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const { data, error } = await supabase
        .from('sites').select(SITE_COLUMNS)
        .eq('site_type', 'website')
        .not('published_url', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = data || [];
      setSites(list);

      const ownerIds = [...new Set(list.map((s) => s.user_id))];
      if (ownerIds.length) {
        const { data: profs, error: pErr } = await supabase.from('profiles').select(OWNER_COLUMNS).in('id', ownerIds);
        if (pErr) throw pErr;
        setOwners(Object.fromEntries((profs || []).map((p) => [p.id, p])));
      } else {
        setOwners({});
      }

      // published_at comes from migration 20261004_sites_published_at.sql;
      // until it is applied this query fails and the list still works.
      const { data: pa, error: paErr } = await supabase
        .from('sites').select('id, published_at').eq('site_type', 'website').not('published_url', 'is', null);
      setPublishedAtTracked(!paErr);
      setPublishedAt(paErr ? {} : Object.fromEntries((pa || []).map((r) => [r.id, r.published_at])));
    } catch (e) {
      setErr(e.message || 'Could not load sites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const upgraded = useCallback((id) => isUpgradedSite({ published_at: publishedAt[id] }), [publishedAt]);

  const checkOne = useCallback(async (site) => {
    patchResult(site.id, { phase: 'checking', error: null });
    try {
      const r = await buildAndCheck(site.id, appOrigin);
      pages.current[site.id] = { newHtml: r.newHtml, liveHtml: r.liveHtml, bookingPageHtml: r.bookingPageHtml, liveBook: r.liveBook };
      if (r.owner) setOwners((prev) => ({ ...prev, [r.owner.id]: r.owner }));
      patchResult(site.id, r.summary);
      return r;
    } catch (e) {
      patchResult(site.id, { phase: 'error', error: e.message || 'Check failed' });
      throw e;
    }
  }, [appOrigin, patchResult]);

  // Re-checks, then publishes only if still ready. Returns 'published' or
  // 'flagged'; throws on errors.
  const publishOne = useCallback(async (site) => {
    if (!canPublish) throw new Error(`Publishing only works on ${PRODUCTION_APP_ORIGIN}`);
    if (!publishedAtTracked) throw new Error('Apply migration 20261004_sites_published_at.sql before republishing');
    const r = await checkOne(site);
    if (r.summary.status !== 'ready') return { outcome: 'flagged', reasons: r.summary.reasons };
    patchResult(site.id, { phase: 'publishing' });
    try {
      const out = await upgradeApi('publish', {
        siteId: site.id,
        htmlContent: r.newHtml,
        ...(r.bookingPageHtml ? { bookingPageHtml: r.bookingPageHtml } : {}),
      });
      patchResult(site.id, { phase: 'published', backupId: out.backupId, publishedAtNow: out.publishedAt });
      if (out.publishedAt) setPublishedAt((prev) => ({ ...prev, [site.id]: out.publishedAt }));
      setBackups((prev) => ({ ...prev, [site.id]: undefined }));
      return { outcome: 'published', backupId: out.backupId };
    } catch (e) {
      patchResult(site.id, { phase: 'error', error: e.message || 'Publish failed', backupId: e.data?.backupId });
      throw e;
    }
  }, [canPublish, publishedAtTracked, checkOne, patchResult]);

  const handleCheck = async (site) => {
    setOpenId(site.id);
    try { await checkOne(site); } catch (e) { toast(`Check failed: ${e.message}`, 'error'); }
  };

  const handleRepublish = async (site) => {
    const name = site.business_info?.businessName || site.slug;
    const ok = await confirmDialog(
      `Republish ${name} (${site.slug}) with the new design? It is checked once more first, and the live page is backed up so it can be restored.`,
      { title: 'Republish live site?', confirmText: 'Republish' },
    );
    if (!ok) return;
    try {
      const res = await publishOne(site);
      if (res.outcome === 'published') {
        addLog(`${name}: republished (backup ${res.backupId})`, 'ok');
        toast(`${name} is live on the new design`, 'success');
      } else {
        addLog(`${name}: now flagged, not published (${res.reasons.map((x) => x.text).join('; ')})`, 'warn');
        toast(`${name} is flagged now, so it was not published`, 'error');
      }
    } catch (e) {
      addLog(`${name}: ERROR ${e.message}`, 'error');
      toast(`Republish failed: ${e.message}`, 'error');
    }
  };

  const loadBackups = async (site) => {
    setBackups((prev) => ({ ...prev, [site.id]: { loading: true, list: [], pick: '' } }));
    try {
      const { backups: list } = await upgradeApi('backups', { siteId: site.id });
      setBackups((prev) => ({ ...prev, [site.id]: { loading: false, list, pick: list[0]?.id || '' } }));
    } catch (e) {
      setBackups((prev) => ({ ...prev, [site.id]: { loading: false, list: [], pick: '', error: e.message } }));
    }
  };

  // Restores the backup picked in the list, or `backupId` (the one a
  // publish just returned), so undoing an upgrade never depends on the
  // listing.
  const handleRestore = async (site, backupId = null) => {
    const b = backups[site.id];
    const chosen = backupId ? { id: backupId, files: [] } : b?.list.find((x) => x.id === b.pick);
    if (!chosen) return;
    const name = site.business_info?.businessName || site.slug;
    const ok = await confirmDialog(
      `Put this backup back live on ${site.slug}: ${backupLabel(chosen)}? The current live page is backed up first, and the site is put on hold so the next "Republish all" skips it.`,
      { title: 'Restore backup?', confirmText: 'Restore', danger: true },
    );
    if (!ok) return;
    patchResult(site.id, { phase: 'restoring' });
    try {
      const out = await upgradeApi('restore', { siteId: site.id, backupId: chosen.id });
      patchResult(site.id, { phase: 'restored', status: null, reasons: [], intended: [], hold: out.hold || null, error: out.holdError || null });
      setPublishedAt((prev) => ({ ...prev, [site.id]: null }));
      delete pages.current[site.id];
      addLog(`${name}: restored ${chosen.id} (current page saved as ${out.safetyBackupId || 'nothing was live'})${out.hold ? '; on hold' : ''}`, 'ok');
      if (out.holdError) {
        addLog(`${name}: ${out.holdError}`, 'error');
        toast(out.holdError, 'error');
      } else {
        toast(`${name} restored and put on hold`, 'success');
      }
      loadBackups(site);
    } catch (e) {
      patchResult(site.id, { phase: 'error', error: e.message });
      addLog(`${name}: restore ERROR ${e.message}`, 'error');
      toast(`Restore failed: ${e.message}`, 'error');
    }
  };

  // An extra copy of the live page before a flagged site is republished by
  // hand (the owner's own Republish, or the admin's while impersonating).
  const handleBackupNow = async (site) => {
    const name = site.business_info?.businessName || site.slug;
    try {
      const out = await upgradeApi('backup', { siteId: site.id });
      addLog(`${name}: live page backed up (${out.backupId})`, 'ok');
      toast(`${name}: live page backed up`, 'success');
      loadBackups(site);
    } catch (e) {
      addLog(`${name}: backup ERROR ${e.message}`, 'error');
      toast(`Backup failed: ${e.message}`, 'error');
    }
  };

  const handleHold = async (site, held) => {
    const name = site.business_info?.businessName || site.slug;
    const ok = await confirmDialog(
      held
        ? `Put ${name} on hold? Checks flag it and it can't be republished from here until the hold is released.`
        : `Release the hold on ${name}? Check it again afterwards; if it is ready, "Republish all" will include it.`,
      { title: held ? 'Put site on hold?' : 'Release hold?', confirmText: held ? 'Put on hold' : 'Release hold' },
    );
    if (!ok) return;
    try {
      const out = await upgradeApi('hold', { siteId: site.id, held });
      // A changed hold changes the verdict: check again before publishing.
      const reason = held ? { code: 'on_hold', text: 'Put on hold by an admin' } : { code: 'recheck', text: 'Hold released: check the site again before republishing' };
      patchResult(site.id, { hold: out.hold, ...(results[site.id]?.status ? { status: 'flagged', reasons: [reason] } : {}) });
      addLog(`${name}: ${held ? 'put on hold' : 'hold released'}`, 'ok');
    } catch (e) {
      addLog(`${name}: hold ERROR ${e.message}`, 'error');
      toast(`Could not change the hold: ${e.message}`, 'error');
    }
  };

  // Ready = checked, ready, and not on the new design yet: exactly what
  // "Republish all ready sites" takes.
  const isWaiting = useCallback(
    (id) => results[id]?.status === 'ready' && results[id]?.phase === 'checked' && !upgraded(id),
    [results, upgraded],
  );

  const runAll = async (mode) => {
    const targets = mode === 'check' ? sites : sites.filter((s) => isWaiting(s.id));
    if (!targets.length) {
      const anyReady = sites.some((s) => results[s.id]?.status === 'ready');
      toast(
        mode === 'check' ? 'No live sites to check'
          : anyReady ? 'Every ready site is already on the new design.' : 'No ready sites waiting. Check the sites first.',
        'info',
      );
      return;
    }
    if (mode === 'publish') {
      const ok = await confirmDialog(
        `Republish ${targets.length} ready site${targets.length === 1 ? '' : 's'} one at a time? Each is checked again just before publishing and skipped if it is flagged now. The run stops at the first error. Every live page is backed up first. Keep this tab open until the run finishes.`,
        { title: 'Republish all ready sites?', confirmText: `Republish ${targets.length}` },
      );
      if (!ok) return;
    }
    stopRef.current = false;
    setBusy(mode === 'check' ? 'check-all' : 'publish-all');
    const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
    addLog(mode === 'check' ? `Checking ${n(targets.length, 'site')}…` : `Republishing ${n(targets.length, 'ready site')}…`);
    let done = 0;
    let skipped = 0;
    let errors = 0;
    let stopped = false;
    for (const [i, site] of targets.entries()) {
      if (stopRef.current) { stopped = true; addLog('Stopped.', 'warn'); break; }
      const name = `(${i + 1}/${targets.length}) ${site.business_info?.businessName || site.slug}`;
      try {
        if (mode === 'check') {
          const r = await checkOne(site);
          if (r.summary.status === 'ready') done += 1; else skipped += 1;
        } else {
          addLog(`${name}: re-checking…`);
          const res = await publishOne(site);
          if (res.outcome === 'published') { done += 1; addLog(`${name}: republished (backup ${res.backupId})`, 'ok'); }
          else { skipped += 1; addLog(`${name}: flagged now, skipped (${res.reasons.map((x) => x.text).join('; ')})`, 'warn'); }
        }
      } catch (e) {
        errors += 1;
        const msg = String(e.message || 'failed').replace(/\.+$/, '');
        if (mode === 'publish') {
          addLog(`${name}: ERROR ${msg}. Stopped here; the remaining sites were not touched.`, 'error');
          stopped = true;
          break;
        }
        addLog(`${name}: ERROR ${msg}`, 'error');
      }
    }
    const errorPart = errors ? `, ${n(errors, 'error')}` : '';
    addLog(
      mode === 'check'
        ? `Check ${stopped ? 'stopped' : 'done'}: ${done} ready, ${skipped} flagged${errorPart}.`
        : `Run ${stopped ? 'stopped' : 'done'}: ${done} republished, ${skipped} skipped${errorPart}.`,
      stopped || errors ? 'warn' : 'ok',
    );
    setBusy(null);
  };

  const counts = useMemo(() => {
    const c = { all: sites.length, unchecked: 0, ready: 0, flagged: 0, error: 0, upgraded: 0 };
    for (const s of sites) {
      const r = results[s.id];
      if (r?.phase === 'error') c.error += 1;
      else if (!r?.status) c.unchecked += 1;
      else if (isWaiting(s.id)) c.ready += 1;
      else if (r.status === 'flagged') c.flagged += 1;
      if (upgraded(s.id)) c.upgraded += 1;
    }
    return c;
  }, [sites, results, upgraded, isWaiting]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter((s) => {
      const r = results[s.id];
      if (filter === 'unchecked' && (r?.status || r?.phase === 'error')) return false;
      if (filter === 'ready' && !isWaiting(s.id)) return false;
      if (filter === 'flagged' && (r?.status !== 'flagged' || r?.phase === 'error')) return false;
      if (filter === 'error' && r?.phase !== 'error') return false;
      if (filter === 'upgraded' && !upgraded(s.id)) return false;
      if (!q) return true;
      const o = owners[s.user_id];
      return [s.business_info?.businessName, s.slug, s.custom_domain, o?.email, o?.first_name, o?.last_name]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [sites, results, filter, search, owners, upgraded, isWaiting]);

  const open = openId ? sites.find((s) => s.id === openId) : null;
  const openResult = open ? results[open.id] : null;
  const openPages = open ? pages.current[open.id] : null;
  const openBackups = open ? backups[open.id] : null;
  const anyBusy = !!busy;

  return (
    <div>
      {!canPublish && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <strong className="font-semibold">Preview only.</strong> This page runs on {appOrigin || 'an unknown host'}. The published page's booking and
          contact widgets load from the host it was built on, so republishing and restoring only work on {PRODUCTION_APP_ORIGIN}.
        </div>
      )}
      {canPublish && !publishedAtTracked && !loading && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <strong className="font-semibold">Republishing is off.</strong> Apply migration 20261004_sites_published_at.sql first: it records which
          sites are done (so a later run doesn't republish them again) and drives the owners' "New design live" badge. Checking and restoring still work.
        </div>
      )}

      <div className="flex flex-wrap items-start gap-3 mb-4">
        <p className="text-sm text-[#555] max-w-2xl">
          Republish owners' live websites with the new designs. Check a site to build its new page and compare it with what is live.
          Only <strong className="font-semibold text-[#1a1a1a]">Ready</strong> sites can be republished; every live page is backed up first and can be restored.
          A restored site is put on hold until you release it. Release date: {SITE_UPGRADE_RELEASE_DATE}.
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          {busy ? (
            <>
              <span className="self-center text-[12px] text-amber-800">Keep this tab open until the run finishes.</span>
              <button
                type="button"
                onClick={() => { stopRef.current = true; }}
                className="px-4 py-2 text-[13px] font-semibold border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000]"
              >
                Stop after this site
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => runAll('check')}
                disabled={loading || !sites.length}
                className="px-4 py-2 text-[13px] font-semibold border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] disabled:opacity-50"
              >
                Check all
              </button>
              <button
                type="button"
                onClick={() => runAll('publish')}
                disabled={!canRepublish || loading || counts.ready === 0}
                title={republishBlockedTitle}
                className="px-4 py-2 text-[13px] font-bold rounded-lg bg-[#cc0000] hover:bg-[#a80000] text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Republish all ready sites
              </button>
            </>
          )}
        </div>
      </div>

      {log.length > 0 && (
        <div className="mb-4 bg-white border border-black/[0.07] rounded-xl">
          <div className="flex items-center px-4 py-2 border-b border-black/[0.05]">
            <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px]">Log</p>
            {!busy && <button type="button" onClick={() => setLog([])} className="ml-auto text-xs text-gray-500 hover:text-[#1a1a1a]">Clear</button>}
          </div>
          <ol className="max-h-48 overflow-y-auto px-4 py-2 text-[12px] font-mono space-y-0.5" aria-live="polite">
            {log.map((l, i) => (
              <li key={i} className={l.tone === 'error' ? 'text-[#cc0000]' : l.tone === 'warn' ? 'text-amber-700' : l.tone === 'ok' ? 'text-emerald-700' : 'text-[#555]'}>
                <span className="text-ink-tertiary">{new Date(l.at).toLocaleTimeString()}</span> {l.text}
              </li>
            ))}
          </ol>
        </div>
      )}

      {open && (
        <div ref={panelRef} className="mb-6 scroll-mt-16 bg-white border border-black/[0.07] rounded-2xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-wrap items-start gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-[#1a1a1a] truncate">{open.business_info?.businessName || 'Untitled'}</h2>
                <StatusChip summary={openResult} upgraded={upgraded(open.id)} />
              </div>
              <p className="text-[12px] text-ink-tertiary mt-0.5">
                {TEMPLATES[open.template_id]?.label || open.template_id} · {owners[open.user_id]?.email || 'owner unknown'} ·{' '}
                <a href={open.published_url} target="_blank" rel="noreferrer" className="text-[#cc0000] hover:underline">{open.slug}</a>
                {open.custom_domain && ` · ${open.custom_domain} (${open.custom_domain_status || 'no status'})`}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCheck(open)}
                disabled={anyBusy || ['checking', 'publishing', 'restoring'].includes(openResult?.phase)}
                className="px-3.5 py-2 text-[13px] font-semibold border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] disabled:opacity-50"
              >
                {openResult?.phase === 'checking' ? 'Checking…' : openResult?.status ? 'Check again' : 'Check'}
              </button>
              <button
                type="button"
                onClick={() => handleRepublish(open)}
                disabled={!canRepublish || anyBusy || openResult?.status !== 'ready' || openResult?.phase !== 'checked'}
                title={republishBlockedTitle || (openResult?.status !== 'ready' ? 'Only ready sites can be republished' : undefined)}
                className="px-3.5 py-2 text-[13px] font-bold rounded-lg bg-[#1a1a1a] hover:bg-[#cc0000] text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {openResult?.phase === 'publishing' ? 'Publishing…' : 'Republish'}
              </button>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="px-3 py-2 text-[13px] text-ink-tertiary hover:text-[#1a1a1a]"
              >
                Close
              </button>
            </div>
          </div>

          {openResult?.phase === 'error' && (
            <p className="mb-3 text-[13px] text-[#cc0000]">
              {openResult.error}
              {openResult.backupId && !String(openResult.error).includes(openResult.backupId) && ` The previous page is saved as backup ${openResult.backupId}.`}
              {openResult.backupId && (
                <button type="button" onClick={() => handleRestore(open, openResult.backupId)} disabled={!canPublish || anyBusy} className="ml-2 underline font-semibold disabled:opacity-50">
                  Restore it
                </button>
              )}
            </p>
          )}
          {openResult?.phase === 'published' && (
            <p className="mb-3 text-[13px] text-emerald-700">
              Republished. The previous page is saved as backup {openResult.backupId}.
              {openResult.backupId && (
                <button type="button" onClick={() => handleRestore(open, openResult.backupId)} disabled={!canPublish || anyBusy} className="ml-2 underline font-semibold text-[#1a1a1a] disabled:opacity-50">
                  Undo (restore it)
                </button>
              )}
            </p>
          )}
          {openResult?.phase === 'restored' && (
            <p className="mb-3 text-[13px] text-amber-800">
              Restored{openResult.hold?.held ? ' and put on hold: checks flag it until you release the hold' : ''}.
              {openResult.error && <span className="block text-[#cc0000]">{openResult.error}</span>}
            </p>
          )}

          {openResult?.status && (
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <div className="rounded-xl border border-black/[0.07] p-3">
                <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px] mb-1.5">
                  {openResult.status !== 'ready'
                    ? `Why it is flagged (${openResult.reasons.length})`
                    : openResult.phase === 'published' ? 'Republished' : 'Ready to republish'}
                </p>
                {openResult.reasons.length ? (
                  <ul className="text-[13px] text-amber-900 space-y-1.5">
                    {openResult.reasons.map((r, i) => (
                      <li key={i}>
                        · {r.text}
                        {nextStep(r.code) && <span className="block pl-2.5 text-[12px] text-[#555]">Next: {nextStep(r.code)}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-[#555]">Every phone number, email, address, service, price, photo, social link and widget on the live page is on the new page.</p>
                )}
                <p className="text-[11px] text-ink-tertiary mt-2">
                  Owner plan: {openResult.isPro ? 'Pro (no "Powered by" bar)' : 'Free ("Powered by" bar)'} · new page {Math.round(openResult.newBytes / 1024)} KB · live {Math.round(openResult.liveBytes / 1024)} KB
                  {openPages?.bookingPageHtml ? ' · /book page republished too' : ''} · checked {formatDateTime(openResult.checkedAt)}
                </p>
              </div>
              <div className="rounded-xl border border-black/[0.07] p-3">
                <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px] mb-1.5">Dropped on purpose ({openResult.intended.length})</p>
                {openResult.intended.length ? (
                  <ul className="text-[13px] text-[#555] space-y-1">
                    {openResult.intended.map((r, i) => <li key={i}>· {r.label} <span className="text-ink-tertiary">(“{r.example}”)</span></li>)}
                  </ul>
                ) : (
                  <p className="text-[13px] text-ink-tertiary">No invented claims or editor placeholders on the live page.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 mb-3">
            {['desktop', 'phone'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                aria-pressed={device === d}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  device === d ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white text-[#555] border-black/[0.10] hover:border-[#cc0000]/40'
                }`}
              >
                {d === 'phone' ? 'Phone' : 'Desktop'}
              </button>
            ))}
          </div>
          <p className="mb-3 text-[12px] text-amber-800">
            These previews run the real booking and contact widgets. Don't submit them: a booking or message reaches the business owner.
          </p>
          <div className={`grid gap-4 ${device === 'phone' ? 'grid-cols-2 max-w-3xl' : 'lg:grid-cols-2'}`}>
            <PreviewFrame
              key={`live-${open.id}-${openResult?.checkedAt || ''}`}
              title="Live now"
              html={openPages?.liveHtml}
              device={device}
              empty={openResult?.phase === 'checking' ? 'Loading…' : openResult?.status ? 'No live page could be read' : 'Check the site to load its live page'}
            />
            <PreviewFrame
              key={`new-${open.id}-${openResult?.checkedAt || ''}`}
              title="New design"
              html={openPages?.newHtml}
              device={device}
              empty={openResult?.phase === 'checking' ? 'Building…' : openResult?.status ? 'The new page could not be built' : 'Check the site to build its new page'}
            />
          </div>

          <div className="mt-5 pt-4 border-t border-black/[0.07]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-[1.5px] mr-2">Backups</p>
              <button
                type="button"
                onClick={() => handleBackupNow(open)}
                disabled={anyBusy || ['publishing', 'restoring'].includes(openResult?.phase)}
                title="Saves the live page now, e.g. before the owner republishes a flagged site"
                className="px-3 py-1.5 text-[13px] font-semibold border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] disabled:opacity-40"
              >
                Back up now
              </button>
              <button
                type="button"
                onClick={() => handleHold(open, !openResult?.hold?.held)}
                disabled={anyBusy || !openResult || ['checking', 'publishing', 'restoring'].includes(openResult?.phase)}
                title={openResult ? 'A site on hold is flagged and never republished from here' : 'Check the site first'}
                className="px-3 py-1.5 text-[13px] font-semibold border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] disabled:opacity-40"
              >
                {openResult?.hold?.held ? 'Release hold' : 'Put on hold'}
              </button>
              {!openBackups ? (
                <button type="button" onClick={() => loadBackups(open)} className="text-[13px] text-[#cc0000] hover:underline">Show backups</button>
              ) : openBackups.loading ? (
                <span className="text-[13px] text-ink-tertiary">Loading…</span>
              ) : openBackups.error ? (
                <span className="text-[13px] text-[#cc0000]">{openBackups.error}</span>
              ) : openBackups.list.length === 0 ? (
                <span className="text-[13px] text-ink-tertiary">None yet. One is made before every republish and restore here, and before an owner's first new-design publish.</span>
              ) : (
                <>
                  <select
                    value={openBackups.pick}
                    onChange={(e) => setBackups((prev) => ({ ...prev, [open.id]: { ...prev[open.id], pick: e.target.value } }))}
                    className="px-2 py-1.5 border border-black/[0.10] rounded-lg text-[13px] max-w-full"
                  >
                    {openBackups.list.map((b) => <option key={b.id} value={b.id}>{backupLabel(b)}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRestore(open)}
                    disabled={!canPublish || anyBusy || ['publishing', 'restoring', 'checking'].includes(openResult?.phase)}
                    title={canPublish ? undefined : `Only on ${PRODUCTION_APP_ORIGIN}`}
                    className="px-3 py-1.5 text-[13px] font-semibold border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {openResult?.phase === 'restoring' ? 'Restoring…' : 'Restore'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search business, address, owner…"
          className="flex-1 min-w-[220px] sm:max-w-xs px-3 py-2 border border-black/[0.10] rounded-lg text-sm focus:outline-none focus:border-[#cc0000]"
        />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
              filter === f.id ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white text-[#555] border-black/[0.10] hover:border-[#cc0000]/40'
            }`}
          >
            {f.label} <span className={`ml-1 ${filter === f.id ? 'opacity-70' : 'text-ink-tertiary'}`}>{counts[f.id]}</span>
          </button>
        ))}
        <button type="button" onClick={refresh} disabled={anyBusy} className="ml-auto text-xs text-gray-500 hover:text-[#1a1a1a] disabled:opacity-50">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {err ? (
        <p className="text-sm text-[#cc0000]">{err}</p>
      ) : loading ? (
        <p className="text-sm text-ink-tertiary">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-tertiary text-center py-10">No live websites match.</p>
      ) : (
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#faf9f7] text-left text-[10px] text-ink-tertiary uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Owner plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const o = owners[s.user_id];
                const r = results[s.id];
                const ownerName = [o?.first_name, o?.last_name].filter(Boolean).join(' ').trim();
                return (
                  <tr key={s.id} className={`border-t border-black/[0.05] ${openId === s.id ? 'bg-[#faf9f7]' : ''}`}>
                    <td className="px-4 py-3 max-w-[280px]">
                      <p className="font-semibold text-[#1a1a1a] truncate">{s.business_info?.businessName || 'Untitled'}</p>
                      <p className="text-[11px] text-ink-tertiary truncate">
                        <a href={s.published_url} target="_blank" rel="noreferrer" className="hover:text-[#cc0000]">{s.slug || s.published_url}</a>
                        {' · '}{ownerName || o?.email || 'owner unknown'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[#555] whitespace-nowrap">{TEMPLATES[s.template_id]?.label || s.template_id || '—'}</td>
                    <td className="px-4 py-3 text-[12px] whitespace-nowrap">
                      {!o ? <span className="text-ink-tertiary">—</span> : isEffectiveSchedulerActive(o) ? 'Pro' : <span className="text-ink-tertiary">Free</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip summary={r} upgraded={upgraded(s.id)} />
                      {r?.phase === 'error' && <p className="text-[11px] text-[#cc0000] mt-1 max-w-[260px] truncate" title={r.error}>{r.error}</p>}
                      {r?.status === 'flagged' && r.phase === 'checked' && (
                        <p className="text-[11px] text-amber-800 mt-1 max-w-[260px] truncate" title={r.reasons.map((x) => x.text).join('\n')}>{r.reasons[0]?.text}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => (r?.status || r?.phase === 'checking' ? setOpenId(s.id) : handleCheck(s))}
                        disabled={anyBusy && !r?.status}
                        className="px-3 py-1.5 text-[12px] font-semibold border border-black/10 rounded-lg hover:border-[#cc0000]/30 hover:text-[#cc0000] disabled:opacity-50"
                      >
                        {r?.status || r?.phase === 'checking' ? 'Open' : 'Check'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
