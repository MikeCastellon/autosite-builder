import { useState } from 'react';
import { BUSINESS_TYPES } from '../../../data/businessTypes.js';
import { searchAccounts } from '../../../lib/pipeline.js';
import { SOURCES, findDuplicates, validateLead } from '../../../lib/pipelineFilters.js';
import { BTN_GHOST, BTN_PRIMARY, Field, INPUT, Modal } from '../salesUi.jsx';

const EMPTY = {
  companyName: '', contactName: '', phone: '', email: '', website: '',
  address: '', city: '', state: '', zip: '', businessType: '',
  source: '', estMonthlyValue: '', nextActionOn: '', note: '',
};

/**
 * A new lead, by hand. Only the name and the stage are required. On leaving
 * the name field it looks for the same business among the open leads and
 * the builder's accounts, and warns: two admins writing down the same shop
 * is a thing to notice, not a thing to refuse.
 */
export default function AddLeadModal({ stages, admins, userId, existingLeads, onClose, onCreate }) {
  const [v, setV] = useState(() => ({ ...EMPTY, stageId: stages.find((s) => s.kind === 'open')?.id || '', ownerId: userId || '' }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [checked, setChecked] = useState('');

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const dupes = findDuplicates(checked, { leads: existingLeads, accounts });

  async function checkName() {
    const name = v.companyName.trim();
    setChecked(name);
    if (name.length < 3) { setAccounts([]); return; }
    setAccounts(await searchAccounts(name, 5).catch(() => []));
  }

  async function submit(e) {
    e.preventDefault();
    const errs = validateLead(v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError('');
    const res = await onCreate(v);
    setBusy(false);
    if (res?.error) setFormError(res.error);
    else onClose();
  }

  return (
    <Modal
      title="New lead"
      onClose={onClose}
      width="max-w-2xl"
      footer={(
        <>
          <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
          <button type="submit" form="add-lead-form" disabled={busy} className={BTN_PRIMARY}>{busy ? 'Adding…' : 'Add lead'}</button>
        </>
      )}
    >
      <form id="add-lead-form" onSubmit={submit} noValidate className="grid grid-cols-2 gap-3 pb-2">
        <Field label="Business name" required error={errors.companyName} className="col-span-2">
          <input autoFocus value={v.companyName} onChange={set('companyName')} onBlur={checkName} className={INPUT} placeholder="e.g. Elite Auto Detail" />
        </Field>

        {(dupes.leads.length > 0 || dupes.accounts.length > 0) && (
          <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            <p className="font-semibold">You may already have this one</p>
            <ul className="mt-1 space-y-0.5">
              {dupes.accounts.map((a) => <li key={a.id}>{a.name} already has an account ({a.email})</li>)}
              {dupes.leads.map((l) => <li key={l.id}>{l.companyName} is already in the Pipeline</li>)}
            </ul>
          </div>
        )}

        <Field label="Contact name" className="col-span-2 sm:col-span-1">
          <input value={v.contactName} onChange={set('contactName')} className={INPUT} />
        </Field>
        <Field label="Phone" className="col-span-2 sm:col-span-1">
          <input type="tel" value={v.phone} onChange={set('phone')} className={INPUT} />
        </Field>
        <Field label="Email" error={errors.email} className="col-span-2 sm:col-span-1">
          <input type="email" value={v.email} onChange={set('email')} className={INPUT} />
        </Field>
        <Field label="Current website" className="col-span-2 sm:col-span-1">
          <input value={v.website} onChange={set('website')} className={INPUT} placeholder="None, a Facebook page…" />
        </Field>
        <Field label="Street" className="col-span-2">
          <input value={v.address} onChange={set('address')} className={INPUT} />
        </Field>
        <div className="col-span-2 grid grid-cols-[1fr_80px_100px] gap-3">
          <Field label="City"><input value={v.city} onChange={set('city')} className={INPUT} /></Field>
          <Field label="State"><input value={v.state} onChange={set('state')} maxLength={2} className={`${INPUT} uppercase`} /></Field>
          <Field label="Zip"><input value={v.zip} onChange={set('zip')} className={INPUT} /></Field>
        </div>

        <Field label="Business type" className="col-span-2 sm:col-span-1">
          <select value={v.businessType} onChange={set('businessType')} className={INPUT}>
            <option value="">—</option>
            {BUSINESS_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Stage" required error={errors.stageId} className="col-span-2 sm:col-span-1">
          <select value={v.stageId} onChange={set('stageId')} className={INPUT}>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Owner" className="col-span-2 sm:col-span-1">
          <select value={v.ownerId} onChange={set('ownerId')} className={INPUT}>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.id === userId ? `${a.name} (you)` : a.name}</option>)}
          </select>
        </Field>
        <Field label="Source" className="col-span-2 sm:col-span-1">
          <select value={v.source} onChange={set('source')} className={INPUT}>
            <option value="">—</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Next action" className="col-span-2 sm:col-span-1">
          <input type="date" value={v.nextActionOn} onChange={set('nextActionOn')} className={INPUT} />
        </Field>
        <Field label="Est. $ / month" error={errors.estMonthlyValue} className="col-span-2 sm:col-span-1">
          <input inputMode="decimal" value={v.estMonthlyValue} onChange={set('estMonthlyValue')} className={INPUT} placeholder="e.g. 49" />
        </Field>
        <Field label="First note" className="col-span-2">
          <textarea rows={3} value={v.note} onChange={set('note')} maxLength={4000} className={`${INPUT} leading-relaxed`} />
        </Field>
        {formError && <p role="alert" className="col-span-2 text-[12px] font-semibold text-[#cc0000]">{formError}</p>}
      </form>
    </Modal>
  );
}
