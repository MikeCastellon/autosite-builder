// Mask US phone numbers as (XXX) XXX-XXXX while the user types.
// Strips non-digits, caps at 10, and partially formats so the input
// always reflects valid intermediate states (e.g. "(555) 12").
export function formatPhone(input) {
  if (input === null || input === undefined) return '';
  let digits = String(input).replace(/\D/g, '');
  // Strip a leading "1" country code on 11-digit pastes ("+1 555 123 4567").
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  const len = digits.length;
  if (len === 0) return '';
  if (len < 4) return `(${digits}`;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
