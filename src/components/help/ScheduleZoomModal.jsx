import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/AuthContext.jsx';

// Three-step modal:
//   1) Pick a date + slot from the open availability list
//   2) Fill in name/email/phone/topic, submit
//   3) Confirmation screen with Zoom join URL
//
// Hits two Netlify functions:
//   GET  /.netlify/functions/support-slots
//   POST /.netlify/functions/support-book
//
// The customer also gets a Postmark confirmation + .ics attachment so we
// don't have to rely on them remembering this URL.

function groupSlotsByLocalDay(slots, timezone) {
  const groups = new Map();
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric' });
  const dayKeyFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  for (const s of slots) {
    const date = new Date(s.startISO);
    const key = dayKeyFmt.format(date);
    if (!groups.has(key)) groups.set(key, { label: dayFmt.format(date), slots: [] });
    groups.get(key).slots.push(s);
  }
  return [...groups.values()];
}

function formatTime(iso, timezone) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export default function ScheduleZoomModal({ onClose }) {
  const { session, profile } = useAuth();
  const [step, setStep] = useState(1); // 1=pick slot, 2=fill form, 3=confirmed
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [slots, setSlots] = useState([]);
  const [timezone, setTimezone] = useState('America/New_York');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [confirmation, setConfirmation] = useState(null);

  // Prefill from auth profile if available — saves a few keystrokes.
  useEffect(() => {
    if (profile?.email && !email) setEmail(profile.email);
    if (profile && !name) {
      const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
      if (fullName) setName(fullName);
    }
    if (profile?.phone && !phone) setPhone(profile.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Load slots on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/.netlify/functions/support-slots');
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || 'Could not load availability');
        setSlots(json.slots || []);
        setTimezone(json.timezone || 'America/New_York');
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load availability');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const days = useMemo(() => groupSlotsByLocalDay(slots, timezone), [slots, timezone]);
  const selectedDay = days[selectedDayIdx] || null;

  async function handleSubmit() {
    if (submitting) return;
    if (!name.trim()) return setError('Please enter your name');
    if (!email.trim()) return setError('Please enter your email');
    if (!selectedSlot) return setError('Please pick a time');
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/.netlify/functions/support-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim(),
          topic: topic.trim(),
          start: selectedSlot.startISO,
          website,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not book — please try again');
      setConfirmation(json.booking);
      setStep(3);
    } catch (e) {
      setError(e.message || 'Could not book — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-black/[0.07]">
          <div>
            <p className="text-[11px] font-semibold text-[#cc0000] uppercase tracking-[2px]">
              {step === 1 ? 'Schedule support' : step === 2 ? 'Almost done' : 'Confirmed'}
            </p>
            <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight mt-0.5">
              {step === 1 ? 'Pick a Zoom time' : step === 2 ? 'Your details' : 'See you on Zoom'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] transition-colors text-[#888]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          {step === 1 && (
            <div>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-4 border-gray-300 border-t-[#cc0000] rounded-full animate-spin" />
                </div>
              ) : days.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-[#888]">No open slots in the next two weeks. Try emailing <a href="mailto:support@autocaregenius.com" className="text-[#cc0000] font-semibold">support@autocaregenius.com</a> instead.</p>
                </div>
              ) : (
                <>
                  {/* Day strip */}
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-4">
                    {days.map((d, i) => (
                      <button
                        key={d.label + i}
                        type="button"
                        onClick={() => { setSelectedDayIdx(i); setSelectedSlot(null); }}
                        className={`shrink-0 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                          selectedDayIdx === i
                            ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
                            : 'bg-white border-black/[0.10] text-[#555] hover:border-[#cc0000]/40'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  {/* Slots grid */}
                  {selectedDay ? (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedDay.slots.map((s) => (
                        <button
                          key={s.startISO}
                          type="button"
                          onClick={() => setSelectedSlot(s)}
                          className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                            selectedSlot?.startISO === s.startISO
                              ? 'bg-[#cc0000] border-[#cc0000] text-white'
                              : 'bg-white border-black/[0.10] text-[#1a1a1a] hover:border-[#cc0000]/40'
                          }`}
                        >
                          {formatTime(s.startISO, timezone)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#888] text-center py-4">Pick a day above.</p>
                  )}
                </>
              )}

              {error && <p className="text-sm text-[#cc0000] mt-3">{error}</p>}

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedSlot}
                className="w-full mt-5 py-3 rounded-xl bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
              >
                {selectedSlot
                  ? `Continue — ${formatTime(selectedSlot.startISO, timezone)}, ${selectedDay?.label}`
                  : 'Pick a time'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#faf9f7] border border-black/[0.07] p-3 text-sm text-[#1a1a1a]">
                <span className="font-semibold">📅 {selectedDay?.label}</span>
                <span className="mx-2 text-[#aaa]">·</span>
                <span className="font-semibold">{formatTime(selectedSlot.startISO, timezone)} ET</span>
                <span className="mx-2 text-[#aaa]">·</span>
                <span className="text-[#888]">30 min</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">Your name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith"
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.12] text-sm focus:outline-none focus:border-[#cc0000]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.12] text-sm focus:outline-none focus:border-[#cc0000]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">
                  Phone <span className="text-[#aaa] normal-case font-normal">(optional)</span>
                </label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000"
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.12] text-sm focus:outline-none focus:border-[#cc0000]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wide mb-1.5">
                  What do you want to talk about? <span className="text-[#aaa] normal-case font-normal">(optional)</span>
                </label>
                <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} placeholder="e.g. help connecting my domain, walkthrough of the booking system…"
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.12] text-sm focus:outline-none focus:border-[#cc0000]" />
              </div>

              {/* Honeypot — bots will fill this; humans won't see it */}
              <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off"
                className="hidden" aria-hidden="true" />

              {error && <p className="text-sm text-[#cc0000]">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-xl border border-black/[0.10] text-[#555] font-semibold text-sm hover:border-[#cc0000]/40">
                  Back
                </button>
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-50 text-white font-bold text-sm transition-colors">
                  {submitting ? 'Booking…' : 'Confirm booking'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && confirmation && (
            <div className="text-center space-y-5 py-2">
              <div className="w-16 h-16 rounded-full bg-[#e8f5ec] flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0a8f3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-black text-[#1a1a1a] tracking-tight">You're booked.</p>
                <p className="text-sm text-[#555] mt-1">
                  {new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(confirmation.scheduled_at))} ET
                </p>
              </div>
              <div className="rounded-xl border border-black/[0.07] bg-[#faf9f7] p-4 text-left">
                <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Zoom link</p>
                <a href={confirmation.zoom_join_url} target="_blank" rel="noreferrer"
                  className="block text-sm text-[#cc0000] font-semibold break-all hover:underline">
                  {confirmation.zoom_join_url}
                </a>
                {confirmation.zoom_password && (
                  <p className="text-xs text-[#888] mt-2">
                    Passcode (if asked): <span className="font-mono font-semibold text-[#1a1a1a]">{confirmation.zoom_password}</span>
                  </p>
                )}
              </div>
              <p className="text-xs text-[#888] leading-relaxed">
                A confirmation + calendar invite is on its way to <strong className="text-[#1a1a1a]">{email}</strong>. Need to reschedule? Just reply to that email.
              </p>
              <button type="button" onClick={onClose}
                className="w-full py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#cc0000] text-white font-bold text-sm transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
