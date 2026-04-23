import { formatPrice } from './formatPrice.js';

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

  // If services is an array of package objects (name/price/description),
  // copy it into packages so templates that use businessInfo.packages still work.
  if (
    Array.isArray(normalized.services) &&
    normalized.services.length > 0 &&
    typeof normalized.services[0] === 'object'
  ) {
    if (!normalized.packages || normalized.packages.length === 0) {
      normalized.packages = normalized.services;
    }
  }

  // Format prices on package/service objects so templates always render with $
  // when the user entered a numeric value without a currency symbol.
  for (const field of ['packages', 'services']) {
    if (Array.isArray(normalized[field])) {
      normalized[field] = normalized[field].map((item) => {
        if (item && typeof item === 'object' && item.price !== undefined) {
          return { ...item, price: formatPrice(item.price) };
        }
        return item;
      });
    }
  }

  return normalized;
}
