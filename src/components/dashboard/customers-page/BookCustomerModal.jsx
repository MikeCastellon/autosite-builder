// src/components/dashboard/customers-page/BookCustomerModal.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';
import { resolveVariant } from '../../../lib/schedulerConfig.js';
import { wallTimeToBookingIso } from '../../../lib/bookings.js';

export default function BookCustomerModal({ customer, userId, onClose, onBooked }) {
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState('');
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const [when, setWhen] = useState('');              // datetime-local string
  const [vehicleMake, setVehicleMake] = useState(customer?.manualContact?.vehicleMake || '');
  const [vehicleModel, setVehicleModel] = useState(customer?.manualContact?.vehicleModel || '');
  const [vehicleYear, setVehicleYear] = useState(customer?.manualContact?.vehicleYear || '');
  const [vehicleSize, setVehicleSize] = useState(customer?.manualContact?.vehicleSize || 'sedan');
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Load owner's sites + their scheduler services.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('sites')
        .select('id, business_info, scheduler_config')
        .eq('user_id', userId);
      setSites(data || []);
      if (data && data.length > 0) {
        setSiteId(data[0].id);
        const svcs = (data[0].scheduler_config?.services || []).filter((s) => s.enabled !== false);
        setServices(svcs);
        if (svcs.length > 0) {
          setServiceId(svcs[0].id);
          setServiceName(svcs[0].name);
        }
      }
    })();
  }, [userId]);

  // When site changes, reload its services.
  useEffect(() => {
    setVehicleTypeId('');
    const site = sites.find((s) => s.id === siteId);
    const svcs = ((site?.scheduler_config?.services) || []).filter((s) => s.enabled !== false);
    setServices(svcs);
    if (svcs.length > 0) {
      setServiceId(svcs[0].id);
      setServiceName(svcs[0].name);
    } else {
      setServiceId('');
      setServiceName('');
    }
  }, [siteId, sites]);

  function handleServiceChange(id) {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    setServiceName(svc?.name || '');
  }

  async function submit(e) {
    e.preventDefault();
    // The owner types shop time. Store it as wall-clock time (what the
    // booking widget, the emails and the Bookings page read back), not the
    // browser's reading of it, which lands the booking hours off.
    const shopTime = wallTimeToBookingIso(when);
    if (!shopTime) { setErr('Pick a date and time.'); return; }
    // bookings.vehicle_year is required: without it the save used to fail
    // with a bare "Failed to create booking".
    const year = Number(vehicleYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      setErr("Enter the vehicle's year.");
      return;
    }
    // The browser's reading of the same time (a real instant): what this
    // dialog sent before that fix, and what the previous deploy's
    // owner-create-booking stores. The current function ignores it.
    const typed = new Date(when);
    const browserInstant = Number.isNaN(typed.getTime()) ? shopTime : typed.toISOString();
    setBusy(true); setErr(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not signed in');

      const res = await fetch('/.netlify/functions/owner-create-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          siteId,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          // Both readings (owner-create-booking explains why). The current
          // function stores shop_preferred_at and refuses a request without
          // it: that comes from a tab still running the old dialog. After a
          // rollback, the previous function stores preferred_at, so this tab
          // still books the time that deploy expects.
          shop_preferred_at: shopTime,
          preferred_at: browserInstant,
          vehicle_make: vehicleMake,
          vehicle_model: vehicleModel,
          vehicle_year: vehicleYear ? Number(vehicleYear) : null,
          vehicle_size: vehicleSize,
          vehicle_type_id: vehicleTypeId || null,
          service_id: serviceId || null,
          service_name: serviceName || null,
          notes,
          send_email: sendEmail,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create booking');
      onBooked && onBooked(body.booking);
    } catch (e) {
      setErr(e.message || 'Failed to create booking.');
    } finally {
      setBusy(false);
    }
  }

  const site = sites.find((s) => s.id === siteId);
  const siteVehicleTypes = (site?.scheduler_config?.vehicle_types || []).filter((t) => t && t.enabled !== false);
  const chosenService = services.find((s) => s.id === serviceId) || null;
  const chosenVariant = chosenService ? resolveVariant(chosenService, vehicleTypeId || null) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight">Book {customer.name}</h2>
          <button type="button" onClick={onClose} className="text-[#888] hover:text-[#1a1a1a]" aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {sites.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.business_info?.businessName || s.id}</option>
                ))}
              </select>
            </div>
          )}

          {services.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Service *</label>
              <select
                required
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.price ? ` · ${s.price}` : ''}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Service name *</label>
              <input
                type="text"
                required
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. Full detail"
                className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              />
            </div>
          )}

          {siteVehicleTypes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Vehicle type *</label>
              <select
                required
                value={vehicleTypeId}
                onChange={(e) => setVehicleTypeId(e.target.value)}
                className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
              >
                <option value="" disabled>Select vehicle type…</option>
                {siteVehicleTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {chosenVariant && chosenVariant.price_cents != null && (
                <p className="text-[11px] text-[#888] mt-1">
                  {`$${(chosenVariant.price_cents / 100) % 1 === 0 ? chosenVariant.price_cents / 100 : (chosenVariant.price_cents / 100).toFixed(2)} · ${chosenVariant.duration_minutes} min for this vehicle`}
                </p>
              )}
              {chosenService && vehicleTypeId && !chosenVariant && (
                <p className="text-[11px] text-amber-600 mt-1">This service is normally not offered for that vehicle — it will book at the base price.</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Date + time *</label>
            <input
              type="datetime-local"
              required
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
            />
            <p className="text-[11px] text-[#bbb] mt-1">Your shop's local time. Owner override — skips availability and lead-time checks.</p>
          </div>

          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-2">Vehicle</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField label="Make" value={vehicleMake} onChange={setVehicleMake} />
              <TextField label="Model" value={vehicleModel} onChange={setVehicleModel} />
              <TextField label="Year" type="number" value={vehicleYear} onChange={setVehicleYear} required />
              {siteVehicleTypes.length === 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Size</label>
                  <select
                    value={vehicleSize}
                    onChange={(e) => setVehicleSize(e.target.value)}
                    className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
                  >
                    {['sedan','suv','truck','van','other'].map((v) => (
                      <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[#1a1a1a]">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Email customer a confirmation
          </label>

          {err && <p className="text-sm text-[#cc0000]">{err}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-semibold text-[#888] hover:text-[#1a1a1a]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-md text-sm font-semibold bg-[#cc0000] text-white hover:bg-[#b30000] disabled:opacity-60">
              {busy ? 'Booking…' : 'Create booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#1a1a1a] mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
      />
    </div>
  );
}
