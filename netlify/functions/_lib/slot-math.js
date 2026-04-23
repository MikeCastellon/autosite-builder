function toMillis(dateISO, hhmm) {
  return Date.parse(`${dateISO}T${hhmm.padStart(5, '0')}:00.000Z`);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function computeSlots({
  dateISO,
  availability,
  serviceDurationMin,
  granularityMin,
  confirmedBookings,
}) {
  if (!Array.isArray(availability) || availability.length === 0) return [];
  if (!serviceDurationMin || serviceDurationMin <= 0) return [];

  const durationMs = serviceDurationMin * 60 * 1000;
  const stepMs = granularityMin * 60 * 1000;

  const busy = (confirmedBookings || []).map((b) => {
    const start = Date.parse(b.start);
    const end = start + (b.durationMin || 0) * 60 * 1000;
    return [start, end];
  });

  const out = [];

  for (const window of availability) {
    const wStart = toMillis(dateISO, window.start);
    const wEnd = toMillis(dateISO, window.end);

    for (let t = wStart; t + durationMs <= wEnd; t += stepMs) {
      const slotEnd = t + durationMs;
      const conflicts = busy.some(([bs, be]) => overlaps(t, slotEnd, bs, be));
      if (!conflicts) out.push(new Date(t).toISOString());
    }
  }

  return out;
}
