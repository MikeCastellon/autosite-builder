// Format a price value for display in templates.
// Ensures a "$" prefix when the user entered a numeric price without a currency
// symbol (e.g. "150" -> "$150", "150.00" -> "$150.00", "from 99" -> "from 99",
// "$299" stays "$299", "Free" stays "Free").
export function formatPrice(price) {
  if (price === null || price === undefined) return '';
  const str = String(price).trim();
  if (!str) return '';
  // Already has a leading currency symbol
  if (/^[$£€¥]/.test(str)) return str;
  // Starts with a digit (or "."): prepend $
  if (/^[\d.]/.test(str)) return `$${str}`;
  return str;
}
