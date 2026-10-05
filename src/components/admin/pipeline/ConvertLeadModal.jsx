import { useEffect, useState } from 'react';
import { customSiteAdmin } from '../../../lib/customSites.js';
import { isEmail } from '../../../lib/customSiteForm.js';
import { searchAccounts } from '../../../lib/pipeline.js';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, Field, INPUT, LINK, Modal, chipClass } from '../salesUi.jsx';

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

/**
 * The lead bought. Two ways it shows up in the builder:
 *   - they signed up themselves: link the lead to that account;
 *   - we're building it for them: start a custom website project
 *     (Admin > Custom websites), prefilled from the lead.
 * Either one lands the lead in Won with a movement row.
 *
 * Starting a project doesn't email anyone unless the box is ticked: the
 * customer hears from us when an admin decides they should. The project is
 * created once: a retry after a failed lead update links the same project
 * instead of creating a second one.
 */
export default function ConvertLeadModal({ lead, initialCreated = null, onCreated, onClose, onConvert }) {
  // A project created earlier for this lead but never linked (the lead
  // update failed, then the dialog was closed): link that one, never a second.
  const [mode, setMode] = useState(initialCreated ? 'custom' : 'account');
  const [term, setTerm] = useState(lead.email || lead.companyName || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const name = splitName(lead.contactName);
  const [v, setV] = useState({ firstName: name.first, lastName: name.last, clientEmail: lead.email || '', sendEmail: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(initialCreated); // the project, once created
  const [done, setDone] = useState(null); // { project, emailError? } after a project conversion

  useEffect(() => {
    if (mode !== 'account') { setSearching(false); return undefined; }
    const t = term.trim();
    if (t.length < 3) { setResults([]); setSearching(false); return undefined; }
    let live = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const found = await searchAccounts(t, 8).catch(() => []);
      if (live) { setResults(found); setSearching(false); }
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [term, mode]);

  async function link(account) {
    setBusy(true);
    setError('');
    const res = await onConvert({ accountUserId: account.id });
    setBusy(false);
    if (res?.error) setError(res.error);
    else onClose();
  }

  async function startProject(e) {
    e.preventDefault();
    setError('');
    let project = created;
    if (!project) {
      if (!v.firstName.trim()) { setError('Enter their first name.'); return; }
      if (!isEmail(v.clientEmail)) { setError('Enter a valid email address.'); return; }
      setBusy(true);
      try {
        // No email yet: it goes out only once the lead is converted, so a
        // retry can never send it twice.
        const res = await customSiteAdmin('create', {
          firstName: v.firstName, lastName: v.lastName, clientEmail: v.clientEmail, sendEmail: false,
        });
        project = res.project;
        setCreated(project);
        onCreated?.(project);
      } catch (err) {
        setBusy(false);
        setError(err.message || 'Could not start the project');
        return;
      }
      // What the create call doesn't take, filled in so the project page
      // isn't blank. Best effort: the project exists either way.
      await customSiteAdmin('update', {
        id: project.id, businessName: lead.companyName, ...(lead.phone ? { clientPhone: lead.phone } : {}),
      }).catch(() => {});
    }
    setBusy(true);
    const res = await onConvert({ customProjectId: project.id });
    if (res?.error) {
      setBusy(false);
      setError(`The project was created, but the lead wasn't updated: ${res.error}. Try again to link it.`);
      return;
    }
    let emailError = null;
    if (v.sendEmail) {
      try {
        await customSiteAdmin('send-welcome', { id: project.id });
      } catch (err) {
        emailError = err.message || 'The email didn\'t send';
      }
    }
    setBusy(false);
    if (v.sendEmail) setDone({ project, emailError });
    else onClose();
  }

  if (done) {
    return (
      <Modal
        title={`${lead.companyName} is in Won`}
        onClose={onClose}
        footer={<button type="button" onClick={onClose} className={BTN_PRIMARY}>Done</button>}
      >
        <div className="space-y-2 pb-2 text-[13px] text-[#555]">
          {done.emailError ? (
            <p role="alert" className="font-semibold text-[#cc0000]">
              The project is started, but the welcome email didn't send ({done.emailError}). Resend it from the project.
            </p>
          ) : (
            <p>The welcome email with the intake form link went to <strong>{v.clientEmail}</strong>.</p>
          )}
          <a href={`/?admin=custom-sites&project=${done.project.id}`} target="_blank" rel="noreferrer" className={LINK}>Open the project ↗</a>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`${lead.companyName} bought`}
      subtitle="Where do they live in the builder now?"
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>}
    >
      <div className="flex gap-1.5 mb-4" role="group" aria-label="How they bought">
        <button type="button" disabled={Boolean(created)} onClick={() => setMode('account')} className={chipClass(mode === 'account')}>They have an account</button>
        <button type="button" onClick={() => setMode('custom')} className={chipClass(mode === 'custom')}>Start a custom website</button>
      </div>

      {mode === 'account' ? (
        <div className="space-y-3 pb-2">
          <Field label="Find their account" hint="Email, name or business name">
            <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} className={INPUT} />
          </Field>
          {searching && <p className="text-[12px] text-ink-tertiary">Searching…</p>}
          {!searching && term.trim().length >= 3 && results.length === 0 && (
            <p className="text-[12px] text-ink-tertiary">No account matches. They may not have signed up yet.</p>
          )}
          <ul className="space-y-1.5">
            {results.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.07] px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#1a1a1a] truncate">{a.name}{a.isAdmin && <span className="ml-1.5 text-[10px] font-bold text-ink-tertiary">ADMIN</span>}</span>
                  <span className="block text-[11px] text-ink-tertiary truncate">{a.email}</span>
                </span>
                <button type="button" disabled={busy} onClick={() => link(a)} className={BTN_SECONDARY}>Link</button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <form onSubmit={startProject} noValidate className="grid grid-cols-2 gap-3 pb-2">
          <Field label="First name" required className="col-span-2 sm:col-span-1">
            <input autoFocus disabled={Boolean(created)} value={v.firstName} onChange={(e) => setV((s) => ({ ...s, firstName: e.target.value }))} className={INPUT} />
          </Field>
          <Field label="Last name" className="col-span-2 sm:col-span-1">
            <input disabled={Boolean(created)} value={v.lastName} onChange={(e) => setV((s) => ({ ...s, lastName: e.target.value }))} className={INPUT} />
          </Field>
          <Field label="Email" required className="col-span-2">
            <input type="email" disabled={Boolean(created)} value={v.clientEmail} onChange={(e) => setV((s) => ({ ...s, clientEmail: e.target.value }))} className={INPUT} />
          </Field>
          <label className="col-span-2 flex items-start gap-2.5 text-[13px] text-[#1a1a1a] cursor-pointer">
            <input type="checkbox" checked={v.sendEmail} onChange={(e) => setV((s) => ({ ...s, sendEmail: e.target.checked }))} className="mt-0.5 w-4 h-4 accent-[#cc0000]" />
            <span>Email them the intake form link now<span className="block text-[11px] text-ink-tertiary">Leave it off to send it later from the project.</span></span>
          </label>
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={busy} className={BTN_PRIMARY}>
              {busy ? 'Working…' : created ? 'Link the project' : 'Start the project'}
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-2 pb-2 text-[12px] font-semibold text-[#cc0000]">{error}</p>}
    </Modal>
  );
}
