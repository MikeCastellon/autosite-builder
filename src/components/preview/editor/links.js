// Button links the owner types (Featured Service, Footer button). A bare
// domain ("calendly.com/topchoice", "www.site.com/book") would publish as a
// link relative to the site's own address and break, so it gets https://
// in front when the field loses focus. Pure, for the panels and tests.

// Already a full link, a section of this page, or a path on this site.
const COMPLETE = /^(https?:\/\/|mailto:|tel:|sms:|#|\/)/i;
// host.tld, optional www., port, path, query or hash.
const DOMAIN = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([/?#].*)?$/i;

export function normalizeLink(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v || COMPLETE.test(v)) return v;
  return DOMAIN.test(v) ? `https://${v}` : v;
}

// '' when the link works as typed (or once normalizeLink has fixed it),
// else what to change.
export function linkProblem(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v || COMPLETE.test(v) || DOMAIN.test(v)) return '';
  return 'Start the link with https:// (or # for a part of this page).';
}
