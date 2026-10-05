import { useState } from 'react';
import {
  CATEGORY_KEYS, LEAD_CATEGORIES, MAX_SCAN_REQUESTS, RADIUS_OPTIONS, estimateScan,
} from '../../../lib/leadCategories.js';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, Field, INPUT, chipClass } from '../salesUi.jsx';

const dollars = (n) => (n < 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n < 10 ? 2 : 0)}`);

/**
 * "Scan an area". A scan costs real Google Maps money, so the panel says
 * what it could cost before Start, and from the click until the scan
 * finishes it says what's happening: a background function answers before
 * it has started, and a button that came straight back would invite a
 * second, paid, press.
 */
export default function ScanPanel({ running, runningLabel, onStart }) {
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState('');
  const [radiusMi, setRadiusMi] = useState(10);
  const [categories, setCategories] = useState(CATEGORY_KEYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const est = estimateScan({ radiusMi, categories });

  // When a scan starts or ends (this admin's or another's), the form closes
  // and any old message goes: "A scan is already running" is stale the moment
  // that scan finishes.
  const [wasRunning, setWasRunning] = useState(running);
  if (running !== wasRunning) {
    setWasRunning(running);
    setError('');
    if (running) setOpen(false);
  }

  if (running) {
    return (
      <p className="text-[12px] font-semibold text-[#555]" aria-live="polite">
        <span className="inline-block w-2 h-2 mr-1.5 rounded-full bg-[#cc0000] animate-pulse align-middle" />
        Scanning {runningLabel || 'Google Maps'}… usually a minute or two.
      </p>
    );
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={BTN_PRIMARY}>Scan an area</button>;

  function toggle(key) {
    setCategories((cs) => (cs.includes(key) ? cs.filter((c) => c !== key) : [...cs, key]));
  }

  async function start(e) {
    e.preventDefault();
    if (area.trim().length < 2) { setError('Type a city, zip or state.'); return; }
    if (!categories.length) { setError('Pick at least one type of business.'); return; }
    setBusy(true);
    setError('');
    const res = await onStart({ area: area.trim(), radiusMi, categories });
    setBusy(false);
    if (res?.error) setError(res.error);
    else setOpen(false);
  }

  return (
    <form onSubmit={start} className="w-full rounded-xl border border-black/[0.07] bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Area" hint='A city and state, a zip, or a county: "Kissimmee, FL", "34744"' className="flex-1 min-w-[220px]">
          <input autoFocus value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} className={INPUT} />
        </Field>
        <div>
          <span className="block text-[12px] font-semibold text-[#1a1a1a] mb-1">Radius</span>
          <div className="flex gap-1" role="group" aria-label="Radius">
            {RADIUS_OPTIONS.map((r) => (
              <button key={r} type="button" onClick={() => setRadiusMi(r)} className={chipClass(radiusMi === r)}>{r} mi</button>
            ))}
          </div>
        </div>
      </div>
      <fieldset>
        <legend className="text-[12px] font-semibold text-[#1a1a1a] mb-1.5">Types of business</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {LEAD_CATEGORIES.map((c) => (
            <label key={c.key} className="flex items-center gap-1.5 text-[13px] text-[#1a1a1a] cursor-pointer">
              <input type="checkbox" checked={categories.includes(c.key)} onChange={() => toggle(c.key)} className="w-4 h-4 accent-[#cc0000]" />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-[12px] text-[#555]">
        {categories.length
          ? <>Between {est.minRequests} and {est.maxRequests} Google Maps lookups: about {dollars(est.minCost)}–{dollars(est.maxCost)}. Never more than {MAX_SCAN_REQUESTS} lookups.</>
          : 'Pick at least one type.'}
      </p>
      {error && <p role="alert" className="text-[12px] font-semibold text-[#cc0000]">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => { setOpen(false); setError(''); }} className={BTN_GHOST}>Cancel</button>
        <button type="submit" disabled={busy || !categories.length} className={busy ? BTN_SECONDARY : BTN_PRIMARY}>
          {busy ? 'Starting…' : 'Start scan'}
        </button>
      </div>
    </form>
  );
}
