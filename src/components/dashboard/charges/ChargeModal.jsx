// src/components/dashboard/charges/ChargeModal.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../../lib/supabase.js';
import { createCharge } from '../../../lib/createCharge.js';
import { listBookingsForOwner } from '../../../lib/bookings.js';
import { listManualCustomers } from '../../../lib/customerProfiles.js';
import { groupBookingsIntoCustomers } from '../../../lib/customerIdentity.js';

// parsePriceToCents: strips $, commas, whitespace and converts to integer cents.
function parsePriceToCents(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[\s$,]/g, '');
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?/);
  if (!match) return null;
  const dollars = parseInt(match[1], 10);
  const fractional = match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0;
  const cents = dollars * 100 + fractional;
  return cents >= 50 ? cents : null;
}

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Returns the cents value for a service (prefers numeric price_cents, falls
// back to parsing the legacy free-text price field).
function serviceCents(svc) {
  if (!svc) return null;
  if (typeof svc.price_cents === 'number' && svc.price_cents > 0) return svc.price_cents;
  return parsePriceToCents(svc.price);
}

export default function ChargeModal({
  userId,
  profile,
  services,
  prefillName,
  prefillPhone,
  siteId,
  onClose,
}) {
  const [step, setStep] = useState(1);

  const [mode, setMode] = useState('service');
  const [selectedService, setSelectedService] = useState(null);
  // Map of addon_id → true for the add-ons selected on the current service.
  // Cleared whenever the picked service changes.
  const [selectedAddonIds, setSelectedAddonIds] = useState({});
  const [customAmount, setCustomAmount] = useState('');
  const [customerName, setCustomerName] = useState(prefillName || '');
  const [customerPhone, setCustomerPhone] = useState(prefillPhone || '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [chargeId, setChargeId] = useState(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  // Typeahead from existing customers (booking-derived + manually added).
  // Loaded once on mount; filtered client-side as the user types. If the
  // person they're charging isn't in the list, free-text still works — the
  // suggestions just close and they keep typing.
  const [allCustomers, setAllCustomers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [bookings, manuals] = await Promise.all([
          listBookingsForOwner({ userId }),
          listManualCustomers({ ownerUserId: userId }),
        ]);
        if (cancelled) return;
        const fromBookings = groupBookingsIntoCustomers(bookings || []);
        const bookedKeys = new Set(fromBookings.map((c) => c.key));
        const merged = [
          ...fromBookings.map((c) => ({
            key: c.key,
            name: c.name || '',
            phone: c.phone || '',
            email: c.email || '',
          })),
          ...(manuals || [])
            .filter((p) => !bookedKeys.has(p.identity_key))
            .map((p) => ({
              key: p.identity_key,
              name: p.name || '',
              phone: p.phone || '',
              email: p.email || '',
            })),
        ].filter((c) => c.name || c.phone);
        setAllCustomers(merged);
      } catch { /* fail silently — typeahead is optional polish */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Match by name OR phone (digits only). Limit to 6 to keep dropdown tidy.
  const suggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, '');
    return allCustomers
      .filter((c) => {
        if (c.name && c.name.toLowerCase().includes(q)) return true;
        if (digits && c.phone && c.phone.replace(/\D/g, '').includes(digits)) return true;
        return false;
      })
      .slice(0, 6);
  }, [customerName, allCustomers]);

  function handlePickSuggestion(c) {
    setCustomerName(c.name || '');
    setCustomerPhone(c.phone || '');
    setShowSuggestions(false);
  }

  const enabledServices = (services || []).filter((s) => s.enabled !== false);

  const serviceAddons = (selectedService && Array.isArray(selectedService.addons))
    ? selectedService.addons.filter((a) => a && a.enabled !== false)
    : [];
  const chosenAddons = serviceAddons.filter((a) => selectedAddonIds[a.id]);
  const addonTotalCents = chosenAddons.reduce(
    (sum, a) => sum + (typeof a.price_cents === 'number' && a.price_cents > 0 ? a.price_cents : 0),
    0
  );

  const serviceBaseCents = mode === 'service' && selectedService ? serviceCents(selectedService) : null;
  const amountCents = mode === 'service'
    ? (serviceBaseCents != null ? serviceBaseCents + addonTotalCents : null)
    : parsePriceToCents(customAmount);

  const canSubmit = !!amountCents && amountCents >= 50;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setErr(null);
    try {
      // When picking a service, the service object carries _site_id (the
      // site it actually belongs to). Owners can have the same service name
      // across multiple sites with different add-ons, so we must use the
      // service-specific site id, not the modal's default siteId prop.
      const serviceSiteId = mode === 'service' ? selectedService?._site_id : null;
      const effectiveSiteId = serviceSiteId || siteId || null;
      const usingServiceWithId = mode === 'service' && selectedService?.id && effectiveSiteId;
      const { charge_id, checkout_url } = await createCharge({
        amount_cents: amountCents,
        service_name: mode === 'service' ? selectedService?.name : null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        site_id: effectiveSiteId,
        service_id: usingServiceWithId ? selectedService.id : undefined,
        addon_ids: usingServiceWithId ? chosenAddons.map((a) => a.id) : undefined,
      });
      setChargeId(charge_id);
      setCheckoutUrl(checkout_url);
      setStep(2);
      startPolling(charge_id);
    } catch (e) {
      setErr(e.message || 'Failed to create payment link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function startPolling(id) {
    let attempts = 0;
    const MAX = 40;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > MAX) {
        clearInterval(pollRef.current);
        return;
      }
      const { data } = await supabase
        .from('charges')
        .select('status')
        .eq('id', id)
        .single();
      if (data?.status === 'paid') {
        clearInterval(pollRef.current);
        setStep(3);
      }
    }, 3000);
  }

  useEffect(() => () => clearInterval(pollRef.current), []);

  function handleCopyLink() {
    navigator.clipboard.writeText(checkoutUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleTextCustomer() {
    const phone = customerPhone.trim().replace(/\D/g, '');
    const name = customerName.trim();
    const body = encodeURIComponent(
      `Hi${name ? ` ${name}` : ''}! Here's your payment link: ${checkoutUrl}`
    );
    window.location.href = phone ? `sms:+1${phone}?body=${body}` : `sms:?body=${body}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-black/[0.07]">
          <div>
            <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[2px]">
              {step === 1 ? 'New Charge' : step === 2 ? 'Payment Link Ready' : 'Payment Received'}
            </p>
            <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight mt-0.5">
              {step === 1 ? 'Charge Customer' : step === 2 ? 'Share with Customer' : 'All Done!'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] transition-colors text-[#888]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('service')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    mode === 'service'
                      ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                      : 'bg-white text-[#555] border-black/[0.12] hover:bg-black/[0.03]'
                  }`}
                >
                  Pick a service
                </button>
                <button
                  onClick={() => setMode('custom')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    mode === 'custom'
                      ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                      : 'bg-white text-[#555] border-black/[0.12] hover:bg-black/[0.03]'
                  }`}
                >
                  Custom amount
                </button>
              </div>

              {mode === 'service' && (
                <div className="space-y-2">
                  {enabledServices.length === 0 && (
                    <p className="text-sm text-[#888] text-center py-4">No services configured. Use custom amount.</p>
                  )}
                  {enabledServices.map((svc) => {
                    const cents = serviceCents(svc);
                    const priceLabel = cents != null ? formatCents(cents) : (svc.price || '');
                    return (
                      <button
                        key={svc.id}
                        onClick={() => {
                          setSelectedService(svc);
                          setSelectedAddonIds({});
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                          selectedService?.id === svc.id
                            ? 'border-[#cc0000] bg-[#cc0000]/[0.04]'
                            : 'border-black/[0.09] hover:border-black/[0.2] bg-white'
                        }`}
                      >
                        <span className="text-sm font-semibold text-[#1a1a1a]">{svc.name}</span>
                        <span className="text-sm font-bold text-[#1a1a1a]">{priceLabel}</span>
                      </button>
                    );
                  })}

                  {selectedService && serviceAddons.length > 0 && (
                    <div className="pt-3 mt-1">
                      <p className="text-[11px] font-semibold text-[#555] uppercase tracking-wide mb-2">Add-ons (optional)</p>
                      <div className="space-y-1.5">
                        {serviceAddons.map((a) => {
                          const checked = !!selectedAddonIds[a.id];
                          const priceLabel = a.price_cents > 0 ? `+${formatCents(a.price_cents)}` : 'Free';
                          return (
                            <label
                              key={a.id}
                              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                                checked
                                  ? 'border-[#cc0000] bg-[#cc0000]/[0.04]'
                                  : 'border-black/[0.09] hover:border-black/[0.2] bg-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setSelectedAddonIds((prev) => ({ ...prev, [a.id]: e.target.checked }))
                                }
                                className="w-4 h-4 accent-[#cc0000] cursor-pointer"
                              />
                              <span className="flex-1 text-sm font-semibold text-[#1a1a1a]">{a.name}</span>
                              <span className="text-sm font-bold text-[#1a1a1a]">{priceLabel}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedService && chosenAddons.length > 0 && amountCents != null && (
                    <div className="flex items-center justify-between px-4 py-2.5 mt-2 rounded-xl bg-[#faf9f7] border border-black/[0.07]">
                      <span className="text-[11px] font-semibold text-[#555] uppercase tracking-wide">Total</span>
                      <span className="text-base font-black text-[#1a1a1a]">{formatCents(amountCents)}</span>
                    </div>
                  )}
                </div>
              )}

              {mode === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">
                    Amount
                  </label>
                  <input
                    type="text"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="$0.00"
                    className="w-full px-4 py-3 rounded-xl border border-black/[0.12] text-[#1a1a1a] text-lg font-bold focus:outline-none focus:border-[#cc0000] transition-colors"
                  />
                </div>
              )}

              <div className="relative">
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">
                  Customer name <span className="text-[#aaa] normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => { setCustomerName(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Start typing — pick from customers or add new"
                  autoComplete="off"
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.12] text-[#1a1a1a] text-sm focus:outline-none focus:border-[#cc0000] transition-colors"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/[0.12] rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
                    {suggestions.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handlePickSuggestion(c); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#faf9f7] border-b border-black/[0.05] last:border-b-0 transition-colors"
                      >
                        <div className="font-semibold text-[#1a1a1a] text-sm truncate">
                          {c.name || <span className="text-[#aaa] font-normal">(no name)</span>}
                        </div>
                        <div className="text-xs text-[#888] truncate">
                          {c.phone || c.email || '—'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">
                  Phone number <span className="text-[#aaa] normal-case font-normal">(for texting the link)</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.12] text-[#1a1a1a] text-sm focus:outline-none focus:border-[#cc0000] transition-colors"
                />
              </div>

              {err && <p className="text-sm text-[#cc0000]">{err}</p>}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className="w-full py-3 rounded-xl bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-40 text-white font-bold text-sm transition-colors"
              >
                {loading ? 'Creating link…' : `Create Payment Link${amountCents ? ` — ${formatCents(amountCents)}` : ''} →`}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="p-3 bg-white border border-black/[0.09] rounded-2xl inline-block">
                  <QRCodeSVG value={checkoutUrl} size={200} />
                </div>
              </div>

              <p className="text-sm text-[#555]">
                Customer scans the QR code or tap the link below to pay with Apple Pay, Google Pay, or card.
              </p>

              <div className="flex flex-col gap-2">
                {customerPhone && (
                  <button
                    onClick={handleTextCustomer}
                    className="w-full py-3 rounded-xl bg-[#cc0000] hover:bg-[#a80000] text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    Text to customer
                  </button>
                )}
                <button
                  onClick={handleCopyLink}
                  className="w-full py-3 rounded-xl bg-white border border-black/[0.12] hover:bg-[#faf9f7] text-[#1a1a1a] font-semibold text-sm transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy payment link'}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-[#888] text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Waiting for payment…
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-[#e8f5ec] flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0a8f3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-black text-[#1a1a1a] tracking-tight">
                  Payment received — {amountCents ? formatCents(amountCents) : ''}
                </p>
                {customerName && (
                  <p className="text-sm text-[#555] mt-1">{customerName}</p>
                )}
                {mode === 'service' && selectedService?.name && (
                  <p className="text-sm text-[#888]">{selectedService.name}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-bold text-sm transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
