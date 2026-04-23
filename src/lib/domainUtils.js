export function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return '';
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.split('/')[0];
  d = d.replace(/^www\./, '');
  return d;
}

const DOMAIN_REGEX = /^(?!-)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const RESERVED_TLDS = new Set(['local', 'localhost', 'test', 'invalid', 'example']);

export function isValidDomain(input) {
  if (!input || typeof input !== 'string') return false;
  if (input !== input.toLowerCase()) return false;
  if (!DOMAIN_REGEX.test(input)) return false;
  const tld = input.split('.').pop();
  if (RESERVED_TLDS.has(tld)) return false;
  return true;
}
