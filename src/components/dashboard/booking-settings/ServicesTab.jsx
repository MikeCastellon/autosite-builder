import { Fragment, useMemo, useState } from 'react';
import {
  saveSchedulerConfig,
  normalizeService,
  normalizeVehicleTypes,
  newAddonId,
  parseDollarsToCents,
  formatCentsAsDisplay,
} from '../../../lib/schedulerConfig.js';
import { useAlert } from '../../ui/AlertProvider.jsx';
import VehicleTypesEditor from './VehicleTypesEditor.jsx';

function newService() {
  const id = 'svc_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14));
  return {
    id,
    name: '',
    duration_minutes: 60,
    price: '',
    price_cents: null,
    description: '',
    enabled: true,
    addons: [],
  };
}

function blankAddon(vehicleTypes) {
  const prices = {};
  for (const t of vehicleTypes) prices[t.id] = 0;
  return { id: newAddonId(), name: '', price_cents: 0, enabled: true, prices };
}

// "from $X" summary across enabled variants for the table's Price column.
function priceSummary(service, vehicleTypes) {
  let min = null;
  let max = null;
  for (const t of vehicleTypes.filter((t) => t.enabled !== false)) {
    const v = (service.variants || {})[t.id];
    if (!v || v.enabled === false) continue;
    if (typeof v.price_cents === 'number' && v.price_cents > 0) {
      if (min == null || v.price_cents < min) min = v.price_cents;
      if (max == null || v.price_cents > max) max = v.price_cents;
    }
  }
  if (min == null) return null;
  return min === max ? formatCentsAsDisplay(min) : `from ${formatCentsAsDisplay(min)}`;
}

export default function ServicesTab({ siteId, config, onSaved }) {
  const { confirm: confirmDialog } = useAlert();
  // Normalize ONCE and share: normalizeVehicleTypes mints fresh ids when it
  // seeds defaults, so calling it twice would key the services' variants to
  // ids the vehicle-types state doesn't have.
  const initial = useMemo(() => {
    const types = normalizeVehicleTypes(config?.vehicle_types);
    return {
      types,
      services: (config?.services || []).map((s) => normalizeService(s, types)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [vehicleTypes, setVehicleTypes] = useState(initial.types);
  const [services, setServices] = useState(initial.services);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const enabledTypes = vehicleTypes.filter((t) => t.enabled !== false);

  function onVehicleTypesChange(nextTypes) {
    setVehicleTypes(nextTypes);
    // Re-normalize so every service gets a variant + addon price cell for a
    // newly added type; prune data for removed types.
    const keep = new Set(nextTypes.map((t) => t.id));
    setServices((prev) =>
      prev.map((s) => {
        const pruned = {
          ...s,
          variants: Object.fromEntries(Object.entries(s.variants || {}).filter(([id]) => keep.has(id))),
          addons: (s.addons || []).map((a) => ({
            ...a,
            prices: Object.fromEntries(Object.entries(a.prices || {}).filter(([id]) => keep.has(id))),
          })),
        };
        return normalizeService(pruned, nextTypes);
      })
    );
  }

  function patch(id, fields) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  }

  function patchVariant(serviceId, typeId, fields) {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? { ...s, variants: { ...s.variants, [typeId]: { ...(s.variants || {})[typeId], ...fields } } }
          : s
      )
    );
  }

  function patchVariantPrice(serviceId, typeId, raw) {
    const cents = parseDollarsToCents(raw);
    patchVariant(serviceId, typeId, { price_cents: cents, _price_input: raw });
  }

  function patchAddon(serviceId, addonId, fields) {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? { ...s, addons: (s.addons || []).map((a) => (a.id === addonId ? { ...a, ...fields } : a)) }
          : s
      )
    );
  }

  // Add-on price cell: blank = not offered for that vehicle (null).
  function patchAddonPrice(serviceId, addonId, typeId, raw) {
    const parsed = parseDollarsToCents(raw);
    const cents = raw.trim() === '' ? null : (parsed != null ? parsed : (/\d/.test(raw) ? 0 : null));
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              addons: (s.addons || []).map((a) =>
                a.id === addonId
                  ? {
                      ...a,
                      prices: { ...a.prices, [typeId]: cents },
                      _priceInputs: { ...(a._priceInputs || {}), [typeId]: raw },
                    }
                  : a
              ),
            }
          : s
      )
    );
  }

  function addAddon(serviceId) {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, addons: [...(s.addons || []), blankAddon(vehicleTypes)] } : s))
    );
  }

  function removeAddon(serviceId, addonId) {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId ? { ...s, addons: (s.addons || []).filter((a) => a.id !== addonId) } : s
      )
    );
  }

  async function remove(id) {
    const ok = await confirmDialog('Existing bookings keep their service name. You can always add it back later.', {
      title: 'Remove service from booking?',
      confirmText: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  function add() {
    const s = normalizeService(newService(), vehicleTypes);
    setServices((prev) => [...prev, s]);
    setEditingId(s.id);
  }

  async function save() {
    const unnamedType = vehicleTypes.some((t) => t.name.trim() === '');
    const unnamedService = services.some((s) => s.name.trim() === '' && ((s.description || '').trim() !== '' || (s.addons || []).length > 0));
    const unnamedAddon = services.some((s) => (s.addons || []).some((a) => (a.name || '').trim() === '' && Object.values(a.prices || {}).some((p) => typeof p === 'number' && p > 0)));
    if (unnamedType || unnamedService || unnamedAddon) {
      setErr('Name or remove the unnamed ' + (unnamedType ? 'vehicle type' : unnamedService ? 'service' : 'add-on') + ' before saving.');
      return;
    }

    const cleanedTypes = vehicleTypes
      .filter((t) => t.name.trim() !== '')
      .map((t) => ({ id: t.id, name: t.name.trim(), enabled: t.enabled !== false }));

    const cleaned = services
      .filter((s) => s.name.trim() !== '')
      .map((s) => {
        const variants = {};
        for (const t of cleanedTypes) {
          const v = (s.variants || {})[t.id] || {};
          variants[t.id] = {
            enabled: v.enabled !== false,
            price_cents: typeof v.price_cents === 'number' && v.price_cents > 0 ? v.price_cents : null,
            duration_minutes: Math.max(15, Number(v.duration_minutes) || 60),
          };
        }
        // Legacy base fields mirror the first enabled vehicle's variant so old
        // cached widgets and any code reading price_cents stay sensible.
        const firstOffered = cleanedTypes.find((t) => t.enabled && variants[t.id].enabled && variants[t.id].price_cents != null);
        const baseCents = firstOffered ? variants[firstOffered.id].price_cents : (typeof s.price_cents === 'number' && s.price_cents > 0 ? s.price_cents : null);
        const baseDuration = firstOffered ? variants[firstOffered.id].duration_minutes : Math.max(15, Number(s.duration_minutes) || 60);
        const addons = (s.addons || [])
          .filter((a) => a.name && a.name.trim() !== '')
          .map((a) => {
            const prices = {};
            for (const t of cleanedTypes) {
              const p = (a.prices || {})[t.id];
              prices[t.id] = typeof p === 'number' && p >= 0 ? p : null;
            }
            const firstAddonPrice = cleanedTypes.map((t) => prices[t.id]).find((p) => p != null);
            return {
              id: a.id,
              name: a.name.trim(),
              price_cents: firstAddonPrice ?? 0,
              enabled: a.enabled !== false,
              prices,
            };
          });
        return {
          id: s.id,
          name: s.name.trim(),
          description: s.description ?? '',
          enabled: s.enabled !== false,
          duration_minutes: baseDuration,
          price: baseCents != null ? formatCentsAsDisplay(baseCents) : (s.price || ''),
          price_cents: baseCents,
          variants,
          addons,
        };
      });

    setBusy(true); setErr(null);
    try {
      const updated = await saveSchedulerConfig(siteId, { services: cleaned, vehicle_types: cleanedTypes });
      onSaved && onSaved(updated);
      setVehicleTypes(cleanedTypes);
      setServices(cleaned.map((s) => normalizeService(s, cleanedTypes)));
      setEditingId(null);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <VehicleTypesEditor vehicleTypes={vehicleTypes} onChange={onVehicleTypesChange} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">Customers pick a service, then their vehicle type — the price, time, and add-ons they see come from the vehicle row you set here.</p>
        <button onClick={add} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000]">+ Add service</button>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide text-left">
            <tr>
              <th className="px-4 py-3 w-16">On</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 w-32">Price</th>
              <th className="px-4 py-3 w-28">Add-ons</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const editing = editingId === s.id;
              const summary = priceSummary(s, vehicleTypes);
              const addonCount = (s.addons || []).length;
              return (
                <Fragment key={s.id}>
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={s.enabled !== false} onChange={(e) => patch(s.id, { enabled: e.target.checked })} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">{s.name || <em className="text-gray-400">untitled</em>}</span>
                      {s.description ? <span className="block text-xs text-gray-400 truncate max-w-[280px]">{s.description}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={summary ? 'text-gray-700' : 'text-amber-600'}>
                        {summary || (s.price ? `${s.price} (text only)` : '—')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {addonCount === 0 ? '—' : `${addonCount} add-on${addonCount === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(editing ? null : s.id)}
                          aria-label={editing ? 'Done editing' : 'Edit service'}
                          title={editing ? 'Done' : 'Edit pricing & add-ons'}
                          className="p-1.5 rounded hover:bg-black/[0.05] text-gray-600 hover:text-[#1a1a1a] transition-colors"
                        >
                          {editing ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          )}
                        </button>
                        <button
                          onClick={() => remove(s.id)}
                          aria-label="Remove service"
                          title="Remove"
                          className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {editing && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-4">
                        {/* Name + description */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                          <label className="block text-xs font-semibold text-gray-600">
                            Service name
                            <input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white font-normal" autoFocus />
                          </label>
                          <label className="block text-xs font-semibold text-gray-600">
                            Description
                            <input value={s.description || ''} onChange={(e) => patch(s.id, { description: e.target.value })} className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white font-normal" />
                          </label>
                        </div>

                        {/* Per-vehicle pricing */}
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Price & time per vehicle</div>
                        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg mb-4">
                          <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 text-left">
                              <tr className="border-b border-gray-100">
                                <th className="px-3 py-2">Vehicle</th>
                                <th className="px-3 py-2 w-20">Offer</th>
                                <th className="px-3 py-2 w-28">Price</th>
                                <th className="px-3 py-2 w-32">Duration (min)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {enabledTypes.map((t) => {
                                const v = (s.variants || {})[t.id] || {};
                                const offered = v.enabled !== false;
                                return (
                                  <tr key={t.id} className="border-b border-gray-50 last:border-0">
                                    <td className="px-3 py-2 font-medium text-gray-800">{t.name || <em className="text-gray-400">unnamed</em>}</td>
                                    <td className="px-3 py-2">
                                      <input type="checkbox" checked={offered} onChange={(e) => patchVariant(s.id, t.id, { enabled: e.target.checked })} title="Offer this service for this vehicle type" />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        value={v._price_input != null ? v._price_input : (typeof v.price_cents === 'number' && v.price_cents > 0 ? formatCentsAsDisplay(v.price_cents) : '')}
                                        onChange={(e) => patchVariantPrice(s.id, t.id, e.target.value)}
                                        onBlur={() => { if (typeof v.price_cents === 'number' && v.price_cents > 0) patchVariant(s.id, t.id, { _price_input: formatCentsAsDisplay(v.price_cents) }); }}
                                        disabled={!offered}
                                        placeholder="$149"
                                        inputMode="decimal"
                                        className="w-24 border border-gray-200 rounded px-2 py-1 text-sm disabled:opacity-40 disabled:bg-gray-50"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="number" min="15" step="15"
                                        value={v.duration_minutes ?? 60}
                                        onChange={(e) => patchVariant(s.id, t.id, { duration_minutes: Number(e.target.value) })}
                                        disabled={!offered}
                                        className="w-20 border border-gray-200 rounded px-2 py-1 text-sm disabled:opacity-40 disabled:bg-gray-50"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Add-on matrix */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add-ons <span className="normal-case font-normal">(price per vehicle — leave blank to not offer for that vehicle)</span></div>
                          <button type="button" onClick={() => addAddon(s.id)} className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-gray-300 hover:bg-gray-100 text-gray-700">+ Add an add-on</button>
                        </div>
                        {(s.addons || []).length === 0 ? (
                          <div className="text-xs text-gray-500 italic py-2">No add-ons yet. Add optional extras like "Pet hair removal" — customers see them after picking their vehicle.</div>
                        ) : (
                          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
                            <table className="w-full text-sm">
                              <thead className="text-xs text-gray-500 text-left">
                                <tr className="border-b border-gray-100">
                                  <th className="px-3 py-2 w-10">On</th>
                                  <th className="px-3 py-2 min-w-[160px]">Add-on</th>
                                  {enabledTypes.map((t) => (
                                    <th key={t.id} className="px-3 py-2 w-24">{t.name || <em className="text-gray-400">unnamed</em>}</th>
                                  ))}
                                  <th className="px-3 py-2 w-12" />
                                </tr>
                              </thead>
                              <tbody>
                                {s.addons.map((a) => (
                                  <tr key={a.id} className="border-b border-gray-50 last:border-0">
                                    <td className="px-3 py-2">
                                      <input type="checkbox" checked={a.enabled !== false} onChange={(e) => patchAddon(s.id, a.id, { enabled: e.target.checked })} title="Show this add-on to customers" />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        value={a.name}
                                        onChange={(e) => patchAddon(s.id, a.id, { name: e.target.value })}
                                        placeholder="Add-on name"
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                      />
                                    </td>
                                    {enabledTypes.map((t) => {
                                      const raw = a._priceInputs && a._priceInputs[t.id] != null
                                        ? a._priceInputs[t.id]
                                        : ((a.prices || {})[t.id] != null ? ((a.prices)[t.id] > 0 ? formatCentsAsDisplay(a.prices[t.id]) : '$0') : '');
                                      return (
                                        <td key={t.id} className="px-3 py-2">
                                          <input
                                            value={raw}
                                            onChange={(e) => patchAddonPrice(s.id, a.id, t.id, e.target.value)}
                                            placeholder="—"
                                            inputMode="decimal"
                                            className="w-20 border border-gray-200 rounded px-2 py-1 text-sm"
                                          />
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-2">
                                      <button type="button" onClick={() => removeAddon(s.id, a.id)} aria-label="Remove add-on" className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {services.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No services yet — click "+ Add service" to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <button
        onClick={save}
        disabled={busy}
        className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1a1a1a] text-white hover:bg-[#cc0000] disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save services'}
      </button>
    </div>
  );
}
