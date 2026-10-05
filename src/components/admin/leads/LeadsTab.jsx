import {
  useCallback, useDeferredValue, useEffect, useMemo, useRef, useState,
} from 'react';
import { LEAD_CATEGORIES, categoryColor } from '../../../lib/leadCategories.js';
import { leadsAdmin, startLeadScan } from '../../../lib/leadsAdmin.js';
import { useProspects } from '../../../lib/prospects.js';
import {
  BUCKETS, SORTS, WEBSITE_FILTERS, areaOptions, bucketCounts, bucketOf, chainCounts, chainSize,
  filterProspects, isScanRunning, sortProspects,
} from '../../../lib/prospectFilters.js';
import { ActionToast, BTN_SECONDARY, ErrorBox, INPUT, chipClass } from '../salesUi.jsx';
import LeadsMap, { MAP_PIN_LIMIT } from './LeadsMap.jsx';
import ProspectActionModal from './ProspectActionModal.jsx';
import ProspectRow from './ProspectRow.jsx';
import ScanPanel from './ScanPanel.jsx';

const PAGE = 60;
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const SELECT = 'px-2 py-1.5 rounded-lg border border-black/[0.10] bg-white text-[12px] font-semibold text-[#1a1a1a] max-w-[220px]';
const SELECT_ON = 'border-[#cc0000] text-[#cc0000]';

/**
 * Admin > Leads: automotive shops found on Google Maps that might want a
 * website, sorted by whether they have one. Ported from Genius Routes' Leads
 * page; here an admin scans one area at a time, and the deciding question is
 * the website, not the distance from a route.
 *
 * The decision on each is Pipeline or not, each with a note: "Add to
 * Pipeline" makes it your lead; "Not a fit" takes it off everyone's New list
 * and says why.
 */
export default function LeadsTab({ userId, onOpenLead }) {
  const {
    prospects, patches, scans, loading, error, accountNames, noteCounts,
    refresh, loadScans, toPipe, dismiss, restore, unmatch, setNoteCount,
  } = useProspects({ userId });

  const [bucket, setBucket] = useState('new');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [website, setWebsite] = useState('');
  const [area, setArea] = useState('');
  const [hideChains, setHideChains] = useState(false);
  const [sort, setSort] = useState('reviews');
  const [view, setView] = useState('list');
  const [shown, setShown] = useState(PAGE);
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [action, setAction] = useState(null); // { mode, prospect }
  const [scanNotice, setScanNotice] = useState(null); // { text, error? }

  // Typing stays instant; the filter over thousands of rows catches up a beat behind.
  const q = useDeferredValue(search);

  // --- the scan ---------------------------------------------------------------
  const lastScan = scans[0] || null;
  const scanning = isScanRunning(lastScan);
  const watching = useRef(null); // id of the scan this tab started or saw running

  useEffect(() => { if (scanning) watching.current = lastScan.id; }, [scanning, lastScan?.id]);

  // While a scan runs, check on it; when it lands, reload the list and say how it went.
  useEffect(() => {
    if (!scanning) return undefined;
    const t = setInterval(async () => {
      const list = await loadScans();
      const s = list?.find((x) => x.id === watching.current);
      if (!s?.finished_at) return;
      watching.current = null;
      if (s.error) setScanNotice({ text: `The scan of ${s.area_label} failed: ${s.error}`, error: true });
      else {
        setScanNotice({
          text: `${s.area_label}: ${s.found} businesses found, ${s.added} new${s.matched ? `, ${s.matched} already have an account` : ''}.${s.skipped ? ` ${s.skipped} search${s.skipped === 1 ? '' : 'es'} failed, so the list may be short; scan again later.` : ''}${s.capped ? ' The scan hit its lookup limit, so the densest spots weren’t searched to the bottom.' : ''}`,
        });
        setArea(`${s.area_label} · ${Number(s.radius_mi)} mi`);
      }
      refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [scanning, loadScans, refresh]);

  const startScan = useCallback(async (params) => {
    setScanNotice(null);
    let scan;
    try {
      ({ scan } = await leadsAdmin('scan-claim', params));
    } catch (e) {
      // Another admin's scan is running: show it, so the panel says so.
      if (e.status === 409) await loadScans();
      return { error: e.message };
    }
    watching.current = scan.id;
    try {
      await startLeadScan(scan.id);
    } catch (e) {
      // The claim would otherwise block every scan for two minutes.
      await leadsAdmin('scan-release', { scanId: scan.id, error: e.message }).catch(() => {});
      await loadScans();
      return { error: e.message };
    }
    await loadScans();
    return { error: null };
  }, [loadScans]);

  // --- the list ---------------------------------------------------------------
  // Chains are worked out once per load. A decision only lays a patch over
  // the result, so it never re-counts thousands of names.
  const chains = useMemo(() => chainCounts(prospects), [prospects]);
  const measured = useMemo(() => prospects.map((p) => ({ ...p, chain: chainSize(p, chains) })), [prospects, chains]);
  const current = useMemo(
    () => (patches.size ? measured.map((p) => (patches.has(p.id) ? { ...p, ...patches.get(p.id) } : p)) : measured),
    [measured, patches],
  );
  const areas = useMemo(() => areaOptions(prospects), [prospects]);
  const filtered = useMemo(
    () => filterProspects(current, { search: q, category, website, area, hideChains }),
    [current, q, category, website, area, hideChains],
  );
  const counts = useMemo(() => bucketCounts(filtered), [filtered]);
  const rows = useMemo(() => sortProspects(filtered.filter((p) => bucketOf(p) === bucket), sort), [filtered, bucket, sort]);
  const bucketTotal = useMemo(() => current.filter((p) => bucketOf(p) === bucket).length, [current, bucket]);

  // A new filter starts the list from the top.
  useEffect(() => { setShown(PAGE); }, [bucket, q, category, website, area, hideChains, sort]);

  // The map re-frames when the question changes, not every time an answer leaves the list.
  const fitKey = `${bucket}|${q}|${category}|${website}|${area}|${hideChains}`;
  const isFiltered = Boolean(search.trim() || category || website || area || hideChains);

  function clearFilters() {
    setSearch(''); setCategory(''); setWebsite(''); setArea(''); setHideChains(false);
  }

  // --- decisions --------------------------------------------------------------
  const onPipe = useCallback(async (id, note) => {
    const name = action?.prospect?.name || 'It';
    const res = await toPipe(id, note);
    if (res.error) return res;
    const already = res.noteSaved === false
      ? `${name} was already in the Pipeline. Your note didn't save; add it on the lead.`
      : `${name} was already in the Pipeline${note?.trim() ? '; your note is on the lead' : ''}.`;
    setToast({
      text: res.created ? `${name} is in your Pipeline.` : already,
      action: { label: 'Open lead', run: () => onOpenLead(res.leadId) },
    });
    return res;
  }, [toPipe, action, onOpenLead]);

  // Stable, so the toast's 8-second timer isn't restarted by every re-render
  // (the scan poll re-renders the tab every few seconds).
  const closeToast = useCallback(() => setToast(null), []);

  const selected = selectedId ? rows.find((p) => p.id === selectedId) : null;
  const rowProps = {
    userId, accountNames, onAction: (mode, p) => setAction({ mode, prospect: p }), onOpenLead, onUnmatch: unmatch, onNoteCount: setNoteCount,
  };
  const hasData = prospects.length > 0;

  return (
    <div className="space-y-4">
      <ProspectActionModal
        action={action}
        onClose={() => setAction(null)}
        onPipe={onPipe}
        onDismiss={dismiss}
        onRestore={restore}
      />

      <div className="flex flex-wrap items-start gap-3">
        <p className="flex-1 min-w-[260px] text-[13px] text-[#555]">
          Detailers, tint shops, wheel shops, mechanics and car washes found on Google Maps, with whether they have a website.
          {lastScan?.finished_at && !lastScan.error ? ` Last scan: ${lastScan.area_label}, ${fmtDate(lastScan.finished_at)}.` : ''}
        </p>
        <ScanPanel running={scanning} runningLabel={lastScan?.area_label} onStart={startScan} />
      </div>

      {scanNotice && (
        <p role={scanNotice.error ? 'alert' : 'status'} className={`text-[12px] ${scanNotice.error ? 'text-[#cc0000] font-semibold' : 'text-[#555]'}`}>
          {scanNotice.text}
        </p>
      )}
      {!scanNotice && lastScan?.error && !scanning && (
        <p role="alert" className="text-[12px] font-semibold text-[#cc0000]">The last scan ({lastScan.area_label}) failed: {lastScan.error}</p>
      )}

      {/* Which list: the ones nobody has touched, the ones in the Pipeline,
          the ones that already have an account, and the ones ruled out. */}
      <div role="tablist" aria-label="Lists" className="flex overflow-x-auto border-b border-gray-200 gap-1">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={bucket === b.id}
            onClick={() => { setBucket(b.id); setSelectedId(null); }}
            className={`-mb-px whitespace-nowrap px-3 py-2 text-[13px] font-semibold border-b-2 ${
              bucket === b.id ? 'border-[#cc0000] text-[#1a1a1a]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {b.label}
            {counts[b.id] > 0 && <span className="ml-1.5 text-[11px] font-medium text-ink-tertiary">{counts[b.id].toLocaleString('en-US')}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, street, city, zip, phone"
          aria-label="Search leads"
          className={`${INPUT} py-2 flex-1 min-w-[220px] sm:max-w-xs`}
        />
        <select aria-label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} className={`${SELECT} ${website ? SELECT_ON : ''}`}>
          {WEBSITE_FILTERS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
        </select>
        <select aria-label="Type of business" value={category} onChange={(e) => setCategory(e.target.value)} className={`${SELECT} ${category ? SELECT_ON : ''}`}>
          <option value="">All types</option>
          {LEAD_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        {areas.length > 0 && (
          <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} className={`${SELECT} ${area ? SELECT_ON : ''}`}>
            <option value="">All areas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <button
          type="button"
          aria-pressed={hideChains}
          onClick={() => setHideChains((v) => !v)}
          title="Franchises get their website from head office. Hide them to see who can say yes on the spot."
          className={chipClass(hideChains)}
        >
          Hide chains
        </button>
        <label className="flex items-center gap-1.5 text-[12px] text-[#555]">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={SELECT}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <div className="flex overflow-hidden rounded-lg border border-black/[0.10]" role="group" aria-label="View">
          {['list', 'map'].map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-[12px] font-semibold capitalize ${view === v ? 'bg-[#1a1a1a] text-white' : 'bg-white text-[#555] hover:text-[#1a1a1a]'}`}
            >
              {v}
            </button>
          ))}
        </div>
        {isFiltered && <button type="button" onClick={clearFilters} className="text-[12px] font-semibold text-[#cc0000] hover:underline">Clear</button>}
        {hasData && (
          <span className="ml-auto text-[12px] text-ink-tertiary">
            {rows.length.toLocaleString('en-US')}{isFiltered ? ` of ${bucketTotal.toLocaleString('en-US')}` : ''}
          </span>
        )}
      </div>

      {loading && !hasData && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[#faf9f7]" />)}
        </div>
      )}

      {error && !loading && (
        <ErrorBox onRetry={refresh}>{hasData ? 'Couldn’t refresh the leads. This is the list from before.' : `Couldn’t load the leads: ${error}`}</ErrorBox>
      )}

      {!loading && !error && !hasData && (
        <div className="rounded-xl border border-black/[0.07] bg-white p-8 text-center">
          <p className="font-semibold text-[#1a1a1a]">No leads yet.</p>
          <p className="mt-1 text-sm text-ink-tertiary">
            {scanning ? 'The first scan is running. The businesses appear here when it finishes.' : 'Scan an area to find shops that need a website.'}
          </p>
        </div>
      )}

      {hasData && rows.length === 0 && (
        <div className="rounded-xl border border-black/[0.07] bg-white p-8 text-center">
          <p className="font-semibold text-[#1a1a1a]">Nothing on this list matches.</p>
          {isFiltered && <button type="button" onClick={clearFilters} className="mt-2 text-sm font-semibold text-[#cc0000]">Clear filters</button>}
        </div>
      )}

      {hasData && rows.length > 0 && view === 'map' && (
        <>
          <LeadsMap rows={rows} scans={scans} selectedId={selectedId} onSelect={setSelectedId} fitKey={fitKey} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#555]">
            {LEAD_CATEGORIES.filter((c) => !category || c.key === category).map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(c.key) }} />
                {c.label}
              </span>
            ))}
            <span className="text-ink-tertiary">Faded dot: has its own site</span>
          </div>
          {rows.length > MAP_PIN_LIMIT && (
            <p className="text-[12px] text-ink-tertiary">
              Showing the first {MAP_PIN_LIMIT.toLocaleString('en-US')} on the map. Narrow the filters to see the rest.
            </p>
          )}
          {selected
            ? <ProspectRow key={selected.id} prospect={selected} chain={selected.chain} noteCount={noteCounts.get(selected.id) || 0} {...rowProps} />
            : <p className="text-sm text-ink-tertiary">Click a dot to see the business.</p>}
        </>
      )}

      {hasData && rows.length > 0 && view === 'list' && (
        <>
          <ul className="space-y-2">
            {rows.slice(0, shown).map((p) => (
              <li key={p.id}>
                <ProspectRow prospect={p} chain={p.chain} noteCount={noteCounts.get(p.id) || 0} {...rowProps} />
              </li>
            ))}
          </ul>
          {rows.length > shown && (
            <div className="text-center">
              <button type="button" onClick={() => setShown((n) => n + PAGE * 2)} className={BTN_SECONDARY}>
                Show more ({(rows.length - shown).toLocaleString('en-US')} left)
              </button>
            </div>
          )}
        </>
      )}

      <ActionToast toast={toast} onClose={closeToast} />
    </div>
  );
}
