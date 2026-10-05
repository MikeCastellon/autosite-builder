// Data for Admin > Leads: every business the scans found, the latest scan,
// and the decisions on them. Ported from Genius Routes (src/lib/useProspects.js)
// without the route anchors.
//
// Status changes are kept apart from the loaded rows, as `patches` (id → the
// fields that changed). The tab works out chains once per load and lays the
// patches over the result, so "Not a fit" costs a millisecond instead of a
// re-download.
//
// Status writes go through RLS as the signed-in admin, each guarded on the
// status the admin was looking at. A write that matches nothing (another
// admin got there first) comes back as zero rows and no error, so each one
// chains .select() and re-reads the row when it missed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';

const COLS = `
  id, place_id, name, category, google_type,
  address, city, county, state, zip, lat, lng,
  phone, website, website_kind, rating, rating_count, area,
  match_user_id, match_reason,
  status, lead_id, dismiss_reason, status_note, status_by,
  first_seen_at, last_seen_at
`;

const PAGE = 1000;
const PARALLEL = 4;

/** How long a loaded list is reused before a visit quietly re-reads it. */
const FRESH_MS = 5 * 60 * 1000;

const SCAN_COLS = 'id, area_query, area_label, center_lat, center_lng, radius_mi, categories, started_at, run_started_at, finished_at, requests, found, added, matched, capped, skipped, error';

/**
 * The last good load, kept while the app is open, so switching admin tabs
 * doesn't re-download every business.
 */
let cache = null; // { rows, scans, at, patches, accountNames, noteCounts }
// The shared load and the decision count when it began: a second caller that
// joins it must keep the decisions made after *that* moment, not its own.
let inflight = null; // { since, promise }

// The next admin on this browser must not open Leads onto the last one's list.
supabase.auth?.onAuthStateChange?.((event) => { if (event === 'SIGNED_OUT') cache = null; });

/**
 * Every decision gets a number. A refresh that started before a decision
 * can't know about it, so when it lands it keeps every patch newer than its
 * own start; otherwise the row just ruled out pops back onto New.
 */
let patchSeq = 0;

/** Every prospect, a thousand at a time, a few requests in flight. */
async function loadProspects() {
  const { count, error } = await supabase.from('sales_prospects').select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  const pages = Math.ceil((count || 0) / PAGE);
  const byId = new Map();
  for (let first = 0; first < pages; first += PARALLEL) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(PARALLEL, pages - first) }, (_, k) => {
        const from = (first + k) * PAGE;
        return supabase.from('sales_prospects').select(COLS).order('id').range(from, from + PAGE - 1);
      }),
    );
    for (const res of batch) {
      if (res.error) throw new Error(res.error.message);
      // Offset pages can shift if a scan writes mid-load; de-duplicated by id.
      for (const row of res.data || []) byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

/** PostgREST hands back at most 1,000 rows a request. */
async function selectAll(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Names for the accounts the matcher pointed at. */
async function loadAccountNames(rows) {
  const ids = [...new Set(rows.map((p) => p.match_user_id).filter(Boolean))];
  const names = new Map();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('profiles')
      .select('id, email, first_name, last_name, business_name').in('id', ids.slice(i, i + 150));
    for (const p of data || []) {
      names.set(p.id, p.business_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email);
    }
  }
  return names;
}

/** How many notes each business has, for the "Notes (n)" on its row. */
async function loadNoteCounts() {
  const counts = new Map();
  const rows = await selectAll(() => supabase.from('sales_prospect_notes').select('prospect_id').order('prospect_id'));
  for (const r of rows) counts.set(r.prospect_id, (counts.get(r.prospect_id) || 0) + 1);
  return counts;
}

/** The recent scans, newest first; `undefined` when the read itself failed. */
async function readScans() {
  const { data, error } = await supabase.from('sales_prospect_scans')
    .select(SCAN_COLS).order('started_at', { ascending: false }).limit(20);
  return error ? undefined : (data || []);
}

export function useProspects({ userId = null } = {}) {
  const [prospects, setProspects] = useState(() => cache?.rows ?? []);
  const [patches, setPatches] = useState(() => cache?.patches ?? new Map());
  const [accountNames, setAccountNames] = useState(() => cache?.accountNames ?? new Map());
  const [noteCounts, setNoteCounts] = useState(() => cache?.noteCounts ?? new Map());
  const [scans, setScans] = useState(() => cache?.scans ?? []);
  const [loading, setLoading] = useState(() => !cache);
  const [error, setError] = useState(null);
  const scansRef = useRef(scans);
  scansRef.current = scans;
  // The patches as of right now, not as of the last render: a refresh that
  // lands between a decision and React's next render must still see it.
  const patchesRef = useRef(patches);

  /** The recent scans. A failed read keeps the last ones rather than forgetting them. */
  const loadScans = useCallback(async () => {
    const list = await readScans();
    if (list === undefined) return scansRef.current;
    setScans(list);
    if (cache) cache.scans = list;
    return list;
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    if (!cache) setLoading(true);
    try {
      if (!inflight) {
        const load = {
          since: patchSeq,
          promise: Promise.all([loadProspects(), readScans(), loadNoteCounts().catch(() => new Map())])
            .then(async ([rows, list, counts]) => [rows, list, counts, await loadAccountNames(rows).catch(() => new Map())])
            .finally(() => { if (inflight === load) inflight = null; }),
        };
        inflight = load;
      }
      const { since, promise } = inflight;
      const [rows, list, counts, names] = await promise;
      // Keep only what was decided after this load began; the load has the rest.
      const kept = new Map([...(cache?.patches ?? patchesRef.current)].filter(([, p]) => p.seq > since));
      cache = {
        rows, scans: list ?? scansRef.current, at: Date.now(), patches: kept, accountNames: names, noteCounts: counts,
      };
      patchesRef.current = kept;
      setProspects(rows);
      setPatches(kept);
      setAccountNames(names);
      setNoteCounts(counts);
      if (list !== undefined) setScans(list);
    } catch (e) {
      setError(e?.message || 'Could not load leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cache || Date.now() - cache.at > FRESH_MS) { refresh(); return; }
    // A fresh list still needs a fresh answer to "is a scan running?", and
    // a scan that finished while the tab was closed means the list is old.
    const at = cache.at;
    loadScans().then((list) => {
      if (cache && list?.some((sc) => sc.finished_at && Date.parse(sc.finished_at) > at)) refresh();
    });
  }, [refresh, loadScans]);

  const patchLocal = useCallback((id, patch) => {
    patchSeq += 1;
    const base = cache?.patches ?? patchesRef.current;
    const next = new Map(base).set(id, { ...base.get(id), ...patch, seq: patchSeq });
    if (cache) cache.patches = next;
    patchesRef.current = next;
    setPatches(next);
  }, []);

  /**
   * The row as the database has it now, laid over the local copy. null when
   * it is gone; undefined when the read itself failed.
   */
  const reread = useCallback(async (id) => {
    const { data, error: err } = await supabase.from('sales_prospects').select(COLS).eq('id', id).maybeSingle();
    if (err) return undefined;
    if (data) patchLocal(id, data);
    return data ?? null;
  }, [patchLocal]);

  /**
   * Into the Pipeline as the caller's lead, with their note on it. Returns
   * { leadId, created } or { error }.
   *
   * The list can be minutes old, so the row is read first: another admin may
   * have ruled it out, or it may have turned out to be a customer, and their
   * decision stands. The function checks the same thing again under its row
   * lock, for a change that lands in between. When it is already in the
   * Pipeline the function hands back that lead, and the note goes onto it
   * here rather than being lost.
   */
  const toPipe = useCallback(async (id, note = '') => {
    const text = note.trim() || null;
    const now = await reread(id);
    if (now === undefined) return { error: 'Couldn\'t check this business. Try again.' };
    if (now === null) return { error: 'That business is gone.' };
    if (now.status === 'dismissed' || now.match_user_id) {
      return { error: 'Someone else already changed this one. The list now shows where it is.' };
    }
    const { data, error: err } = await supabase.rpc('sales_prospect_to_pipe', { p_prospect_id: id, p_note: text });
    // The function refuses a business someone changed since the re-read;
    // re-read again so the list shows where it went.
    if (err) { await reread(id); return { error: err.message }; }
    if (!data?.lead_id) return { error: 'Not added. Try again.' };
    if (data.created) {
      patchLocal(id, { status: 'piped', lead_id: data.lead_id, dismiss_reason: null, status_note: null, status_by: userId });
      return { leadId: data.lead_id, created: true };
    }
    await reread(id);
    let noteSaved = !text;
    if (text) {
      const { error: noteErr } = await supabase.from('sales_lead_notes')
        .insert({ lead_id: data.lead_id, author_id: userId, body: text.slice(0, 4000) });
      noteSaved = !noteErr;
    }
    return { leadId: data.lead_id, created: false, noteSaved };
  }, [patchLocal, reread, userId]);

  const setStatus = useCallback(async (id, from, patch) => {
    const { data, error: err } = await supabase.from('sales_prospects')
      .update(patch).eq('id', id).eq('status', from).select('id');
    if (err) return { error: err.message };
    if (!data?.length) {
      const now = await reread(id);
      return {
        error: now && now.status !== from
          ? 'Someone else already changed this one. The list now shows where it is.'
          : 'Not saved. You may not have access to change this.',
      };
    }
    patchLocal(id, { ...patch, status_by: userId });
    return { error: null };
  }, [patchLocal, reread, userId]);

  // Who and when are stamped by the database (sales_prospects_stamp_status).
  const dismiss = useCallback(
    (id, reason, note) => setStatus(id, 'new', { status: 'dismissed', dismiss_reason: reason, status_note: note?.trim() || null }),
    [setStatus],
  );
  const restore = useCallback(
    (id) => setStatus(id, 'dismissed', { status: 'new', dismiss_reason: null, status_note: null }),
    [setStatus],
  );

  /** "Not this account": back to New, and never matched to that account again. */
  const unmatch = useCallback(async (p) => {
    const { data: done, error: err } = await supabase.rpc('sales_prospect_unmatch', {
      p_prospect_id: p.id, p_user_id: p.match_user_id,
    });
    if (err) return { error: err.message };
    if (!done) {
      await reread(p.id);
      return { error: 'Someone already changed this one. The list now shows where it is.' };
    }
    patchLocal(p.id, { match_user_id: null, match_reason: null });
    return { error: null };
  }, [patchLocal, reread]);

  /** Keep "Notes (n)" right after a note is added or deleted. */
  const setNoteCount = useCallback((id, n) => {
    setNoteCounts((m) => {
      if (m.get(id) === n) return m;
      const next = new Map(m).set(id, n);
      if (cache) cache.noteCounts = next;
      return next;
    });
  }, []);

  return {
    prospects, patches, scans, loading, error, accountNames, noteCounts,
    refresh, loadScans, toPipe, dismiss, restore, unmatch, setNoteCount,
  };
}

/** Tests only: forget the cross-visit cache. */
export function __resetProspectsCache() { cache = null; inflight = null; patchSeq = 0; }
