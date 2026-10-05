// Data for Admin > Pipeline: stages, leads, one lead's journey and notes.
//
// Reads and writes go straight to the sales_* tables under their
// is_super_admin RLS policies, the way adminUsers.js reads profiles. Ported
// from Genius Routes (useLeads.js, useLead.js, usePipeStages.js); there the
// owners are drivers, here they are the super admins.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// Four foreign keys point at profiles, so each embed names its constraint:
// PostgREST can't guess which one "profiles(email)" meant.
const LEAD_COLS = `
  id, company_name, contact_name, email, phone, website,
  address, city, state, zip, lat, lng, business_type,
  stage_id, owner_id, created_by, source,
  est_monthly_value, next_action_on, lost_reason,
  account_user_id, custom_project_id, converted_at, stage_entered_at,
  archived_at, created_at, updated_at,
  owner:profiles!sales_leads_owner_id_fkey(email, first_name, last_name),
  creator:profiles!sales_leads_created_by_fkey(email, first_name, last_name),
  account:profiles!sales_leads_account_user_id_fkey(email, first_name, last_name, business_name)
`;

const PERSON = 'email, first_name, last_name';

/** "Mike Castellon", or the email when the profile has no name. */
export function personName(p) {
  if (!p) return null;
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || null;
}

export function shapeLead(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    website: row.website,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    lat: row.lat,
    lng: row.lng,
    businessType: row.business_type,
    stageId: row.stage_id,
    ownerId: row.owner_id,
    ownerName: personName(row.owner),
    createdBy: row.created_by,
    createdByName: personName(row.creator),
    source: row.source,
    estMonthlyValue: row.est_monthly_value == null ? null : Number(row.est_monthly_value),
    nextActionOn: row.next_action_on,
    lostReason: row.lost_reason,
    accountUserId: row.account_user_id,
    accountName: row.account ? (row.account.business_name || personName(row.account)) : null,
    accountEmail: row.account?.email || null,
    customProjectId: row.custom_project_id,
    convertedAt: row.converted_at,
    stageEnteredAt: row.stage_entered_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Blank strings are how an untouched form field arrives; null is what we mean. */
export const orNull = (v) => {
  const s = typeof v === 'string' ? v.trim() : v;
  return s === '' || s === undefined ? null : s;
};

// ─── Stages ───────────────────────────────────────────────────────────

const STAGE_COLS = 'id, name, sort_order, active, kind';

const shapeStage = (r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order, active: r.active, kind: r.kind });

/**
 * The board's columns. Rows rather than a constant, so the sales process can
 * change from Edit stages without a deploy. The board asks for active stages;
 * the editor passes includeInactive to manage the full list.
 */
export function usePipeStages({ includeInactive = false } = {}) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    let q = supabase.from('sales_stages').select(STAGE_COLS);
    if (!includeInactive) q = q.eq('active', true);
    const { data, error: err } = await q.order('sort_order').order('name');
    if (err) { setError(err.message); setStages([]); } else { setError(null); setStages((data || []).map(shapeStage)); }
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => { setLoading(true); refresh().catch(() => setLoading(false)); }, [refresh]);

  /**
   * A new step goes just before the first Won or Lost column, not at the end
   * of the board. Then every stage is renumbered 10, 20, 30… in board order,
   * so the gap never runs out (a fixed "+5" landed the third new stage after
   * Won). Seven-odd rows: a handful of updates.
   */
  const addStage = useCallback(async (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { error: 'Name the stage.' };
    const { data: row, error: err } = await supabase.from('sales_stages')
      .insert({ name: trimmed, kind: 'open', sort_order: 0 }).select(STAGE_COLS).single();
    if (err) return { error: err.code === '23505' ? 'There is already a stage with that name.' : err.message };
    const at = stages.findIndex((s) => s.kind !== 'open');
    const order = [...stages];
    order.splice(at < 0 ? order.length : at, 0, shapeStage(row));
    const changed = order
      .map((s, i) => ({ s, sortOrder: (i + 1) * 10 }))
      .filter(({ s, sortOrder }) => s.sortOrder !== sortOrder);
    const results = await Promise.all(changed.map(({ s, sortOrder }) => (
      supabase.from('sales_stages').update({ sort_order: sortOrder }).eq('id', s.id)
    )));
    await refresh();
    const failed = results.find((r) => r.error);
    return { error: failed ? `Added, but the order didn't save: ${failed.error.message}` : null, added: true };
  }, [stages, refresh]);

  const updateStage = useCallback(async (id, patch) => {
    const { error: err } = await supabase.from('sales_stages').update(patch).eq('id', id);
    if (err) return { error: err.code === '23505' ? 'There is already a stage with that name.' : err.message };
    await refresh();
    return { error: null };
  }, [refresh]);

  /** Swap a stage with its neighbour. Seven rows reordered twice a year don't earn drag and drop. */
  const moveStage = useCallback(async (id, direction) => {
    const index = stages.findIndex((s) => s.id === id);
    const target = stages[index + (direction === 'up' ? -1 : 1)];
    if (index < 0 || !target) return { error: null };
    const a = stages[index].sortOrder;
    // Seeded at the same number? Nudge, so the swap still lands somewhere different.
    const b = target.sortOrder === a ? a + (direction === 'up' ? -1 : 1) : target.sortOrder;
    const [r1, r2] = await Promise.all([
      supabase.from('sales_stages').update({ sort_order: b }).eq('id', id),
      supabase.from('sales_stages').update({ sort_order: a }).eq('id', target.id),
    ]);
    const err = r1.error || r2.error;
    if (err) return { error: err.message };
    await refresh();
    return { error: null };
  }, [stages, refresh]);

  return { stages, loading, error, refresh, addStage, updateStage, moveStage };
}

// ─── Admins (lead owners) ─────────────────────────────────────────────

export function useAdmins() {
  const [admins, setAdmins] = useState([]);
  useEffect(() => {
    let live = true;
    supabase.from('profiles').select(`id, ${PERSON}`).eq('is_super_admin', true).order('email')
      .then(({ data }) => { if (live) setAdmins((data || []).map((p) => ({ id: p.id, name: personName(p) }))); });
    return () => { live = false; };
  }, []);
  return admins;
}

// ─── Leads ────────────────────────────────────────────────────────────

/**
 * Move a lead to another stage. The movement row goes in first: if it fails
 * the lead stays where it was, which is the recoverable half of the pair. A
 * board that's briefly wrong beats a journey with a hole in it.
 * stage_entered_at is stamped by the database.
 */
async function writeMove(lead, toStageId, { note = '', lostReason = null, userId }) {
  const { error: moveErr } = await supabase.from('sales_lead_movements').insert({
    lead_id: lead.id,
    from_stage_id: lead.stageId,
    to_stage_id: toStageId,
    moved_by: userId,
    note: String(note || '').trim().slice(0, 500),
  });
  if (moveErr) return { error: moveErr.message };
  // Into Lost sets the reason; any other move clears it, so a lead that came
  // back doesn't keep saying "Lost because…".
  const patch = { stage_id: toStageId, lost_reason: lostReason === null ? null : orNull(lostReason) };
  const { error } = await supabase.from('sales_leads').update(patch).eq('id', lead.id);
  return { error: error?.message ?? null };
}

/**
 * The board: every live lead (or every archived one). Won leads drop off
 * after a week; that cut is made by visibleOnBoard in the page, because it
 * depends on the stage's kind.
 */
export function useLeads({ view = 'board' } = {}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const archived = view === 'archived';

  // Every live lead, a thousand at a time (PostgREST's cap per request): a
  // capped read would quietly drop the newest leads once enough won ones
  // piled up. The archive shows the latest 500.
  const refresh = useCallback(async () => {
    const rows = [];
    let err = null;
    if (archived) {
      const res = await supabase.from('sales_leads').select(LEAD_COLS)
        .not('archived_at', 'is', null).order('archived_at', { ascending: false }).limit(500);
      err = res.error;
      rows.push(...(res.data || []));
    } else {
      for (let from = 0; ; from += 1000) {
        const res = await supabase.from('sales_leads').select(LEAD_COLS)
          .is('archived_at', null).order('created_at').order('id').range(from, from + 999);
        if (res.error) { err = res.error; break; }
        rows.push(...(res.data || []));
        if (!res.data || res.data.length < 1000) break;
      }
    }
    if (err) { setError(err.message); setLeads([]); setLoading(false); return; }
    setError(null);
    setLeads(rows.map(shapeLead));
    setLoading(false);
  }, [archived]);

  useEffect(() => { setLoading(true); refresh().catch(() => setLoading(false)); }, [refresh]);

  const addLead = useCallback(async (values, userId) => {
    const name = String(values.companyName || '').trim();
    if (!name) return { error: 'Business name is required.' };
    if (!values.stageId) return { error: 'Pick a stage.' };
    if (!userId) return { error: 'Not signed in.' };
    const { data, error: err } = await supabase.from('sales_leads').insert({
      company_name: name,
      contact_name: orNull(values.contactName),
      email: orNull(values.email),
      phone: orNull(values.phone),
      website: orNull(values.website),
      address: orNull(values.address),
      city: orNull(values.city),
      state: orNull(values.state),
      zip: orNull(values.zip),
      business_type: orNull(values.businessType),
      stage_id: values.stageId,
      // The default owner is the person typing; otherwise "Mine" is empty on day one.
      owner_id: values.ownerId || userId,
      created_by: userId,
      source: orNull(values.source),
      est_monthly_value: orNull(values.estMonthlyValue),
      next_action_on: orNull(values.nextActionOn),
    }).select(LEAD_COLS).single();
    if (err) return { error: err.message };
    // The opening movement row is written by the database (sales_leads_initial_movement).
    const lead = shapeLead(data);
    const note = String(values.note || '').trim();
    if (note) await supabase.from('sales_lead_notes').insert({ lead_id: lead.id, author_id: userId, body: note.slice(0, 4000) });
    await refresh();
    return { error: null, lead };
  }, [refresh]);

  const moveLead = useCallback(async (lead, toStageId, opts = {}) => {
    if (!lead || !toStageId) return { error: 'Nothing to move.' };
    if (!opts.userId) return { error: 'Not signed in.' };
    if (lead.stageId === toStageId) return { error: null };
    const res = await writeMove(lead, toStageId, opts);
    if (res.error) return res;
    await refresh();
    return { error: null };
  }, [refresh]);

  const updateLead = useCallback(async (id, patch) => {
    const { error: err } = await supabase.from('sales_leads').update(patch).eq('id', id);
    if (err) return { error: err.message };
    await refresh();
    return { error: null };
  }, [refresh]);

  const archiveLead = useCallback(
    (id, userId) => updateLead(id, { archived_at: new Date().toISOString(), archived_by: userId ?? null }),
    [updateLead],
  );
  const unarchiveLead = useCallback((id) => updateLead(id, { archived_at: null, archived_by: null }), [updateLead]);

  /**
   * The moment a lead stops being a lead: landed in Won, then linked to the
   * account or custom website project it became. In that order, so a failure
   * halfway leaves a lead that can still be converted, never one that is
   * marked converted (and locked) while sitting in an open column.
   * Converting is a step in the journey like any other: it writes its
   * movement row.
   */
  const convertLead = useCallback(async (lead, { accountUserId = null, customProjectId = null, wonStageId, userId }) => {
    const { data: now, error: readErr } = await supabase.from('sales_leads')
      .select('stage_id').eq('id', lead.id).maybeSingle();
    if (readErr) return { error: readErr.message };
    if (!now) return { error: 'That lead is gone.' };
    if (wonStageId && wonStageId !== now.stage_id) {
      const res = await writeMove({ ...lead, stageId: now.stage_id }, wonStageId, {
        note: accountUserId ? 'Linked to their account.' : 'Started a custom website.',
        userId,
      });
      if (res.error) { await refresh(); return res; }
    }
    const patch = { converted_at: new Date().toISOString() };
    if (accountUserId) patch.account_user_id = accountUserId;
    if (customProjectId) patch.custom_project_id = customProjectId;
    const { error: err } = await supabase.from('sales_leads').update(patch).eq('id', lead.id);
    await refresh();
    return { error: err?.message ?? null };
  }, [refresh]);

  return { leads, loading, error, refresh, addLead, moveLead, updateLead, archiveLead, unarchiveLead, convertLead };
}

/** One lead, its journey and its notes: the drawer's own fetch. */
export function useLead(leadId) {
  const [lead, setLead] = useState(null);
  const [movements, setMovements] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!leadId) return;
    const [l, m, n] = await Promise.all([
      supabase.from('sales_leads').select(LEAD_COLS).eq('id', leadId).maybeSingle(),
      supabase.from('sales_lead_movements')
        .select(`id, from_stage_id, to_stage_id, note, created_at, mover:profiles!sales_lead_movements_moved_by_fkey(${PERSON})`)
        .eq('lead_id', leadId).order('created_at', { ascending: false }),
      supabase.from('sales_lead_notes')
        .select(`id, body, author_id, created_at, author:profiles!sales_lead_notes_author_id_fkey(${PERSON})`)
        .eq('lead_id', leadId).order('created_at'),
    ]);
    const err = l.error || m.error || n.error;
    if (err) { setError(err.message); setLoading(false); return; }
    setError(null);
    setLead(l.data ? shapeLead(l.data) : null);
    setMovements((m.data || []).map((r) => ({
      id: r.id, fromStageId: r.from_stage_id, toStageId: r.to_stage_id, note: r.note,
      createdAt: r.created_at, moverName: personName(r.mover),
    })));
    setNotes((n.data || []).map((r) => ({
      id: r.id, body: r.body, authorId: r.author_id, createdAt: r.created_at, authorName: personName(r.author),
    })));
    setLoading(false);
  }, [leadId]);

  useEffect(() => { setLoading(true); refresh().catch(() => setLoading(false)); }, [refresh]);

  const addNote = useCallback(async (body, userId) => {
    const text = String(body || '').trim();
    if (!text) return { error: 'Write something first.' };
    const { error: err } = await supabase.from('sales_lead_notes')
      .insert({ lead_id: leadId, author_id: userId, body: text.slice(0, 4000) });
    if (err) return { error: err.message };
    await refresh();
    return { error: null };
  }, [leadId, refresh]);

  const deleteNote = useCallback(async (id) => {
    const { error: err } = await supabase.from('sales_lead_notes').delete().eq('id', id);
    if (err) return { error: err.message };
    await refresh();
    return { error: null };
  }, [refresh]);

  return { lead, movements, notes, loading, error, refresh, addNote, deleteNote };
}

// ─── Accounts (convert + duplicate check) ─────────────────────────────

/** Strips what would break a PostgREST or() filter. */
const safeTerm = (s) => String(s || '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 80);

/**
 * Builder accounts whose email, name or business (on the profile or any of
 * their sites) contains the term. [{ id, name, email, isAdmin }]
 */
export async function searchAccounts(term, limit = 8) {
  const t = safeTerm(term);
  if (t.length < 3) return [];
  // * is PostgREST's wildcard inside or(); .ilike() takes SQL's %.
  const star = `*${t}*`;
  const [byProfile, bySite] = await Promise.all([
    supabase.from('profiles')
      .select('id, email, first_name, last_name, business_name, is_super_admin')
      .or(`email.ilike.${star},business_name.ilike.${star},first_name.ilike.${star},last_name.ilike.${star}`)
      .limit(limit),
    supabase.from('sites').select('user_id, business_info').ilike('business_info->>businessName', `%${t}%`).limit(limit),
  ]);
  const siteNames = new Map();
  for (const s of bySite.data || []) {
    if (s.user_id && !siteNames.has(s.user_id)) siteNames.set(s.user_id, s.business_info?.businessName || '');
  }
  const profiles = [...(byProfile.data || [])];
  const missing = [...siteNames.keys()].filter((id) => !profiles.some((p) => p.id === id));
  if (missing.length) {
    const { data } = await supabase.from('profiles')
      .select('id, email, first_name, last_name, business_name, is_super_admin').in('id', missing);
    profiles.push(...(data || []));
  }
  return profiles.slice(0, limit).map((p) => ({
    id: p.id,
    name: siteNames.get(p.id) || p.business_name || personName(p),
    email: p.email,
    isAdmin: !!p.is_super_admin,
  }));
}
