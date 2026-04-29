import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/AuthContext.jsx';

// Three-step modal:
//   1) Calendar grid → pick a day with availability, then a 30-min slot
//   2) Fill in name/email/phone/topic, submit
//   3) Confirmation screen with Zoom join URL
//
// Hits two Netlify functions:
//   GET  /.netlify/functions/support-slots
//   POST /.netlify/functions/support-book
//
// The customer also gets a Postmark confirmation + .ics attachment so we
// don't have to rely on them remembering this URL.

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Get y/m/d in the host timezone for a given UTC date.
function ymdInZone(date, timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function dayKey(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatTime(iso, timezone) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function formatLongDate(iso, timezone) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso));
}

// Build the 6-row calendar grid for a given month. Each cell is a date in
// that month or a leading/trailing date from the neighbouring month.
function buildMonthGrid(year, month) {
  // First day of the month (month is 1-indexed in the API; Date wants 0-indexed)
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = firstOfMonth.getUTCDay(); // 0 = Sun
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells = [];
  // Leading days from previous month
  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 - (firstWeekday - i)));
    cells.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), inMonth: false });
  }
  // Days in this month
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ year, month, day, inMonth: true });
  }
  // Trailing days to fill 6 rows × 7 cols = 42 cells
  let trailingDay = 1;
  while (cells.length < 42) {
    const d = new Date(Date.UTC(year, month, trailingDay));
    cells.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), inMonth: false });
    trailingDay++;
  }
  return cells;
}

export default function ScheduleZoomModal({ onClose }) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1); // 1=pick slot, 2=fill form, 3=confirmed
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [slots, setSlots] = useState([]);
  const [timezone, setTimezone] = useState('America/New_York');

  const [viewYear, setViewYear] = useState(null);
  const [viewMonth, setViewMonth] = useState(null);
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [confirmation, setConfirmation] = useState(null);

  // Prefill from auth profile
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
        const tz = json.timezone || 'America/New_York';
        setTimezone(tz);
        setSlots(json.slots || []);

        // Default the calendar view to the month of the first available slot.
        if ((json.slots || []).length > 0) {
          const first = ymdInZone(new Date(json.slots[0].startISO), tz);
          setViewYear(first.year);
          setViewMonth(first.month);
          setSelectedDayKey(dayKey(first.year, first.month, first.day));
        } else {
          const today = ymdInZone(new Date(), tz);
          setViewYear(today.year);
          setViewMonth(today.month);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load availability');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Group slots by their local day key so the calendar can know which dates
  // are bookable, and the slot grid can pull them out fast.
  const slotsByDay = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      const { year, month, day } = ymdInZone(new Date(s.startISO), timezone);
      const k = dayKey(year, month, day);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    return map;
  }, [slots, timezone]);

  // The earliest + latest bookable day determine prev/next button enablement.
  const earliestKey = slots.length > 0 ? (() => { const p = ymdInZone(new Date(slots[0].startISO), timezone); return dayKey(p.year, p.month, p.day); })() : null;
  const latestKey = slots.length > 0 ? (() => { const p = ymdInZone(new Date(slots[slots.length - 1].startISO), timezone); return dayKey(p.year, p.month, p.day); })() : null;

  const cells = viewYear && viewMonth ? buildMonthGrid(viewYear, viewMonth) : [];
  const todayKey = (() => { const t = ymdInZone(new Date(), timezone); return dayKey(t.year, t.month, t.day); })();

  // Allow prev/next navigation only within the bookable window.
  function prevMonth() {
    if (!viewYear || !viewMonth) return;
    const m = viewMonth === 1 ? 12 : viewMonth - 1;
    const y = viewMonth === 1 ? viewYear - 1 : viewYear;
    setViewYear(y); setViewMonth(m);
  }
  function nextMonth() {
    if (!viewYear || !viewMonth) return;
    const m = viewMonth === 12 ? 1 : viewMonth + 1;
    const y = viewMonth === 12 ? viewYear + 1 : viewYear;
    setViewYear(y); setViewMonth(m);
  }
  const canPrev = earliestKey && dayKey(viewYear, viewMonth, 1) > earliestKey;
  const lastOfView = viewYear && viewMonth ? new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate() : 0;
  const canNext = latestKey && dayKey(viewYear, viewMonth, lastOfView) < latestKey;

  const selectedDaySlots = selectedDayKey ? (slotsByDay.get(selectedDayKey) || []) : [];

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
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
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
                <div className="flex justify-center py-16">
                  <div className="w-6 h-6 border-4 border-gray-300 border-t-[#cc0000] rounded-full animate-spin" />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-[#888]">No open slots in the next two weeks. Try emailing <a href="mailto:support@autocaregenius.com" className="text-[#cc0000] font-semibold">support@autocaregenius.com</a> instead.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-[1fr_180px] gap-4">
                  {/* Calendar */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <button
                        type="button"
                        onClick={prevMonth}
                        disabled={!canPrev}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555] hover:bg-black/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Previous month"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      <p className="text-sm font-bold text-[#1a1a1a] tracking-tight">
                        {viewMonth ? MONTH_NAMES[viewMonth - 1] : ''} {viewYear || ''}
                      </p>
                      <button
                        type="button"
                        onClick={nextMonth}
                        disabled={!canNext}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555] hover:bg-black/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Next month"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 mb-1">
                      {WEEKDAY_HEADERS.map((d) => (
                        <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-[#888] py-1">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-0.5">
                      {cells.map((c, idx) => {
                        const k = dayKey(c.year, c.month, c.day);
                        const hasSlots = slotsByDay.has(k);
                        const isPast = k < todayKey;
                        const isToday = k === todayKey;
                        const isSelected = selectedDayKey === k;
                        const clickable = c.inMonth && hasSlots && !isPast;

                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={!clickable}
                            onClick={() => { setSelectedDayKey(k); setSelectedSlot(null); }}
                            className={`relative aspect-square rounded-lg text-sm font-semibold transition-colors ${
                              isSelected
                                ? 'bg-[#cc0000] text-white shadow-sm'
                                : clickable
                                  ? 'bg-white text-[#1a1a1a] hover:bg-[#cc0000]/[0.08] border border-transparent'
                                  : c.inMonth
                                    ? 'text-[#ccc] cursor-not-allowed'
                                    : 'text-[#e0e0e0] cursor-default'
                            }`}
                          >
                            {c.day}
                            {clickable && !isSelected && (
                              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#cc0000]" />
                            )}
                            {isToday && c.inMonth && !isSelected && (
                              <span className="absolute top-1 right-1 text-[8px] font-bold uppercase text-[#cc0000] tracking-wider">·</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[11px] text-[#888] mt-3 text-center">
                      All times shown in <span className="font-semibold text-[#1a1a1a]">{timezone.replace('America/', '').replace('_', ' ')}</span>. Dots = available.
                    </p>
                  </div>

                  {/* Slot list */}
                  <div className="border-l-0 sm:border-l sm:pl-4 border-black/[0.07] sm:max-h-[340px] overflow-y-auto">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#888] mb-2">
                      {selectedDayKey
                        ? new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(selectedDaySlots[0]?.startISO || `${selectedDayKey}T12:00:00Z`))
                        : 'Pick a day'}
                    </p>
                    {selectedDayKey ? (
                      selectedDaySlots.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-1 gap-1.5">
                          {selectedDaySlots.map((s) => (
                            <button
                              key={s.startISO}
                              type="button"
                              onClick={() => setSelectedSlot(s)}
                              className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
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
                        <p className="text-sm text-[#888]">No times available on this day.</p>
                      )
                    ) : (
                      <p className="text-sm text-[#aaa]">Select a date with a red dot.</p>
                    )}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-[#cc0000] mt-3">{error}</p>}

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedSlot}
                className="w-full mt-5 py-3 rounded-xl bg-[#cc0000] hover:bg-[#a80000] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
              >
                {selectedSlot
                  ? `Continue — ${formatTime(selectedSlot.startISO, timezone)}, ${formatLongDate(selectedSlot.startISO, timezone)}`
                  : 'Pick a time'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#faf9f7] border border-black/[0.07] p-3 text-sm text-[#1a1a1a]">
                <span className="font-semibold">📅 {formatLongDate(selectedSlot.startISO, timezone)}</span>
                <span className="mx-2 text-[#aaa]">·</span>
                <span className="font-semibold">{formatTime(selectedSlot.startISO, timezone)}</span>
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

              {/* Honeypot */}
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
                  {new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(confirmation.scheduled_at))}
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
