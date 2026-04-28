// src/components/dashboard/charges/ChargeModal.jsx
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../../lib/supabase.js';
import { createCharge } from '../../../lib/createCharge.js';

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

export default function ChargeModal({
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
  const [customAmount, setCustomAmount] = useState('');
  const [customerName, setCustomerName] = useState(prefillName || '');
  const [customerPhone, setCustomerPhone] = useState(prefillPhone || '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [chargeId, setChargeId] = useState(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  const enabledServices = (services || []).filter((s) => s.enabled !== false);

  const amountCents = mode === 'service'
    ? (selectedService ? parsePriceToCents(selectedService.price) : null)
    : parsePriceToCents(customAmount);

  const canSubmit = !!amountCents && amountCents >= 50;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setErr(null);
    try {
      const { charge_id, checkout_url } = await createCharge({
        amount_cents: amountCents,
        service_name: mode === 'service' ? selectedService?.name : null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        site_id: siteId || null,
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
                  {enabledServices.map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => setSelectedService(svc)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                        selectedService?.id === svc.id
                          ? 'border-[#cc0000] bg-[#cc0000]/[0.04]'
                          : 'border-black/[0.09] hover:border-black/[0.2] bg-white'
                      }`}
                    >
                      <span className="text-sm font-semibold text-[#1a1a1a]">{svc.name}</span>
                      <span className="text-sm font-bold text-[#1a1a1a]">{svc.price}</span>
                    </button>
                  ))}
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

              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">
                  Customer name <span className="text-[#aaa] normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.12] text-[#1a1a1a] text-sm focus:outline-none focus:border-[#cc0000] transition-colors"
                />
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
