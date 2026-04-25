// src/components/dashboard/customers-page/AddCustomerModal.jsx
import { useState } from 'react';
import { createManualCustomer } from '../../../lib/customerProfiles.js';
import { saveCustomerMetadata } from '../../../lib/customers.js';

const VEHICLE_SIZES = [
  { id: '', label: 'Not specified' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'suv', label: 'SUV' },
  { id: 'truck', label: 'Truck' },
  { id: 'van', label: 'Van' },
  { id: 'other', label: 'Other' },
];

const PHOTO_MAX_BYTES = 500 * 1024; // 500KB — stored as data URL on the row

export default function AddCustomerModal({ ownerUserId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleSize, setVehicleSize] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Photo must be an image file.');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setErr('Photo must be under 500 KB. Try a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setPhotoUrl(reader.result); setErr(null); };
    reader.readAsDataURL(file);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const created = await createManualCustomer({
        ownerUserId,
        name,
        email,
        phone,
        photoUrl,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        vehicleSize,
        notes,
        tags,
      });
      // Also mirror notes+tags into customer_metadata so the detail page
      // picks them up via the existing read path.
      if (notes.trim() || tags.length > 0) {
        await saveCustomerMetadata({
          ownerUserId,
          identityKey: created.identity_key,
          notes,
          tags,
        }).catch(() => { /* non-fatal */ });
      }
      onCreated && onCreated(created);
    } catch (e) {
      setErr(e.message || 'Failed to create customer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight">Add customer</h2>
          <button type="button" onClick={onClose} className="text-[#888] hover:text-[#1a1a1a]" aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#1a1a1a] mb-2">Photo</label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-[#f4f3f0] border border-black/[0.07] overflow-hidden flex items-center justify-center shrink-0">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer px-3 py-1.5 rounded-md text-xs font-semibold bg-[#1a1a1a] text-white hover:bg-[#333]">
                  {photoUrl ? 'Replace' : 'Upload'}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
                {photoUrl && (
                  <button type="button" onClick={() => setPhotoUrl('')} className="text-xs text-[#888] hover:text-[#cc0000]">Remove</button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-[#bbb] mt-1.5">JPG or PNG, up to 500 KB.</p>
          </div>

          <Field label="Name" required value={name} onChange={setName} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email" type="email" required value={email} onChange={setEmail} />
            <Field label="Phone" required value={phone} onChange={setPhone} />
          </div>

          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-2">Vehicle</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Make" required value={vehicleMake} onChange={setVehicleMake} />
              <Field label="Model" required value={vehicleModel} onChange={setVehicleModel} />
              <Field label="Year" required type="number" value={vehicleYear} onChange={setVehicleYear} />
              <div>
                <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Size</label>
                <select
                  value={vehicleSize}
                  onChange={(e) => setVehicleSize(e.target.value)}
                  className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
                >
                  {VEHICLE_SIZES.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="VIP, Referral, Monthly detail"
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
            />
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

          {err && <p className="text-sm text-[#cc0000]">{err}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-semibold text-[#888] hover:text-[#1a1a1a]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-md text-sm font-semibold bg-[#cc0000] text-white hover:bg-[#b30000] disabled:opacity-60">
              {busy ? 'Saving…' : 'Add customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#1a1a1a] mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-black/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc0000]/30"
      />
    </div>
  );
}
