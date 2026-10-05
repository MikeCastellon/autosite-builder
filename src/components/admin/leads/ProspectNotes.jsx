import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { initials, timeAgo } from '../../../lib/pipelineFilters.js';
import { personName } from '../../../lib/pipeline.js';
import { Avatar, BTN_SECONDARY, INPUT } from '../salesUi.jsx';

/**
 * Notes on a business before it is anyone's lead ("called, owner is out
 * until Friday"). Loaded the first time the row opens them. They move onto
 * the lead when it goes to the Pipeline, and a note added after that is
 * copied over by the database (sales_prospect_notes_to_lead).
 */
export default function ProspectNotes({ prospectId, leadId = null, userId, onCount }) {
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('sales_prospect_notes')
      .select('id, body, author_id, created_at, author:profiles!sales_prospect_notes_author_id_fkey(email, first_name, last_name)')
      .eq('prospect_id', prospectId).order('created_at', { ascending: false });
    if (err) { setError(err.message); setNotes([]); return; }
    setError('');
    setNotes(data || []);
    onCount?.(prospectId, (data || []).length);
  }, [prospectId, onCount]);

  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const { error: err } = await supabase.from('sales_prospect_notes')
      .insert({ prospect_id: prospectId, author_id: userId, body: text.slice(0, 2000) });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setBody('');
    load();
  }

  async function remove(n) {
    // .select() so a delete RLS refused reads as a miss, not a success.
    const { data, error: err } = await supabase.from('sales_prospect_notes').delete().eq('id', n.id).select('id');
    if (err || !data?.length) { setError(err?.message || 'Not deleted.'); return; }
    // Once the business is in the Pipeline its notes were copied onto the
    // lead (same author, time and text); the copy goes too, or the note the
    // admin just deleted lives on in the lead's timeline. The lead is read
    // now, not taken from the list, which can be minutes old.
    const { data: row } = await supabase.from('sales_prospects').select('lead_id').eq('id', prospectId).maybeSingle();
    const lead = row?.lead_id ?? leadId;
    if (lead) {
      const { error: copyErr } = await supabase.from('sales_lead_notes').delete()
        .eq('lead_id', lead).eq('author_id', n.author_id).eq('created_at', n.created_at).eq('body', n.body);
      if (copyErr) setError(`Deleted here, but the copy on the lead wasn't: ${copyErr.message}`);
    }
    load();
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-[#faf9f7] p-3">
      {notes === null && <p className="text-[12px] text-ink-tertiary">Loading notes…</p>}
      {notes?.length === 0 && <p className="text-[12px] text-ink-tertiary">No notes yet.</p>}
      <ul className="space-y-2.5">
        {(notes || []).map((n) => (
          <li key={n.id} className="flex gap-2">
            <Avatar text={initials(personName(n.author))} title={personName(n.author) || ''} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-ink-tertiary">
                <span className="font-semibold text-[#1a1a1a]">{personName(n.author) || 'Someone'}</span> · {timeAgo(n.created_at)} ago
                {n.author_id === userId && <button type="button" onClick={() => remove(n)} className="ml-2 hover:text-[#cc0000]">Delete</button>}
              </p>
              <p className="text-[13px] text-[#1a1a1a] whitespace-pre-wrap break-words">{n.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Add a note…" aria-label="Add a note" className={`${INPUT} py-2`} />
        <button type="submit" disabled={busy || !body.trim()} className={`${BTN_SECONDARY} shrink-0`}>{busy ? 'Saving…' : 'Add'}</button>
      </form>
      {error && <p role="alert" className="text-[12px] font-semibold text-[#cc0000]">{error}</p>}
    </div>
  );
}
