/**
 * Normalizes businessInfo fields that templates expect as arrays.
 * The wizard collects some fields as comma/separator-delimited strings,
 * but templates call .map() on them — this converts strings to arrays.
 */
export function normalizeBusinessInfo(info) {
  if (!info) return info;

  const normalized = { ...info };

  // Fields that templates iterate over with .map()
  const arrayFields = [
    'packages',
    'certifications',
    'awards',
    'services',
    'paymentMethods',
    'brands',
    'filmBrands',
    'tireBrands',
  ];

  for (const field of arrayFields) {
    const val = normalized[field];
    if (typeof val === 'string' && val.trim()) {
      // Split on common separators: · , ; |
      normalized[field] = val.split(/[·,;|]+/).map((s) => s.trim()).filter(Boolean);
    } else if (!Array.isArray(val)) {
      normalized[field] = [];
    }
  }

  // Hours: templates expect an object { "Mon-Fri": "8am-6pm" } but the form gives a string.
  // Parse common formats like "Mon-Fri 8am-6pm · Sat 9am-4pm" into an object.
  if (typeof normalized.hours === 'string' && normalized.hours.trim()) {
    const parts = normalized.hours.split(/[·;|]+/).map(s => s.trim()).filter(Boolean);
    const hoursObj = {};
    for (const part of parts) {
      // Try to split on last space-separated time pattern (e.g. "Mon-Fri 8am-6pm")
      const match = part.match(/^(.+?)\s+(\d{1,2}(?::\d{2})?\s*[ap]m\s*[-–]\s*\d{1,2}(?::\d{2})?\s*[ap]m)$/i);
      if (match) {
        hoursObj[match[1].trim()] = match[2].trim();
      } else {
        // Can't parse — use the whole string as a single entry
        hoursObj[part] = '';
      }
    }
    normalized.hours = hoursObj;
  }

  return normalized;
}
