/**
 * Converts a normalized hours object (or string) into a display string.
 * normalizeBusinessInfo turns "Mon-Fri 8am-6pm · Sat 9am-4pm" into
 * { "Mon-Fri": "8am-6pm", "Sat": "9am-4pm" }.
 * Templates that render hours inline need it back as a string.
 */
export function formatHours(hours) {
  if (!hours) return '';
  if (typeof hours === 'string') return hours;
  if (typeof hours === 'object' && !Array.isArray(hours)) {
    return Object.entries(hours)
      .map(([day, time]) => (time ? `${day} ${time}` : day))
      .join(' · ');
  }
  return String(hours);
}
