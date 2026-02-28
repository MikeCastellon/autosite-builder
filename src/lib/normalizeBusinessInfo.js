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

  return normalized;
}
