// Super admins get two workspaces in one app: the Admin workspace (custom
// websites, customers, sales, every shop's activity) and the Business
// workspace (the normal customer app, for their own shop). This module holds
// the pure parts: which admin sections exist, how the URL names them, and
// where a freshly loaded tab lands. No supabase import, so it is safe to use
// anywhere (and in tests) without a client.

// The ids are URL values (`?admin=<id>`) that live in sent emails and
// bookmarks: never rename one, only add. The order is the tab order in the
// Admin header.
export const ADMIN_SECTIONS = Object.freeze([
  Object.freeze({ id: 'dashboard', label: 'Dashboard' }),
  Object.freeze({ id: 'custom-sites', label: 'Custom websites' }),
  Object.freeze({ id: 'accounts', label: 'Customers' }),
  Object.freeze({ id: 'pipeline', label: 'Pipeline' }),
  Object.freeze({ id: 'leads', label: 'Leads' }),
  Object.freeze({ id: 'bookings', label: 'All bookings' }),
  Object.freeze({ id: 'inquiries', label: 'All inquiries' }),
  Object.freeze({ id: 'site-upgrades', label: 'Site upgrades' }),
]);

export const ADMIN_SECTION_IDS = Object.freeze(ADMIN_SECTIONS.map((s) => s.id));

export const DEFAULT_ADMIN_SECTION = 'dashboard';

export function isAdminSection(id) {
  return typeof id === 'string' && ADMIN_SECTION_IDS.includes(id);
}

function paramsOf(search) {
  try {
    return new URLSearchParams(typeof search === 'string' ? search : '');
  } catch {
    return new URLSearchParams();
  }
}

// Parse a location.search string. Returns null when there is no `admin`
// param. Any value that is not a section id (the old '?admin=1' links, a
// typo, an empty value) opens the Dashboard rather than nothing, so an old
// bookmark still lands in the Admin workspace.
//
// `project` is only honoured with `admin=custom-sites`: it is a custom
// website project id, and no other section knows what to do with one. A
// stray `project` on another section is ignored rather than carried along
// to be acted on later.
export function parseAdminLink(search) {
  const params = paramsOf(search);
  if (!params.has('admin')) return null;
  const value = params.get('admin');
  const section = isAdminSection(value) ? value : DEFAULT_ADMIN_SECTION;
  const project = section === 'custom-sites' ? (params.get('project') || '').trim() : '';
  return { section, projectId: project || null };
}

// '?admin=<section>' for the address bar while the Admin workspace is open,
// so a reload or a copied link comes back to the same section. An unknown
// section becomes the Dashboard, as parseAdminLink would read it anyway.
// The optional projectId (custom-sites only, like parseAdminLink) keeps an
// open custom website project across a reload.
export function adminSearch(section, projectId) {
  const id = isAdminSection(section) ? section : DEFAULT_ADMIN_SECTION;
  const params = new URLSearchParams({ admin: id });
  if (id === 'custom-sites' && typeof projectId === 'string' && projectId.trim()) {
    params.set('project', projectId.trim());
  }
  return `?${params.toString()}`;
}

function decodeKey(raw) {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

// Remove the `admin` and `project` params from a search string, keep the
// rest (help=, stripe_success=, ...) exactly as written and in order: the
// pairs are filtered as raw text rather than re-serialised through
// URLSearchParams, which would re-encode values other code may compare
// verbatim. Returns '' when nothing is left, else '?a=b'.
export function stripAdminParams(search) {
  if (typeof search !== 'string') return '';
  const kept = search
    .replace(/^\?/, '')
    .split('&')
    .filter((pair) => {
      if (!pair) return false;
      const key = decodeKey(pair.split('=')[0]);
      return key !== 'admin' && key !== 'project';
    });
  return kept.length ? `?${kept.join('&')}` : '';
}

// True when this profile may use the Admin workspace in this tab. A super
// admin's "View as user" tab is signed in as the customer and must look
// exactly like the customer's app, so it never gets the Admin workspace.
export function canUseAdmin(profile, impersonating) {
  return !!profile?.is_super_admin && !impersonating;
}

// The last workspace a super admin used in this browser, so a plain reload
// or a fresh visit opens where they left off.
export const WORKSPACE_KEY = 'gw.workspace';
const WORKSPACES = ['admin', 'business'];

// Storage can be missing (tests, SSR), present but unusable (Node 25 ships
// a localStorage object without methods unless given a file) or throw on
// access (Safari private mode, blocked site data). Every one of those just
// means "nothing remembered".
function storageOr(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

export function readWorkspace(storage) {
  try {
    const value = storageOr(storage)?.getItem(WORKSPACE_KEY);
    return WORKSPACES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

// Returns true when the value was stored. Anything but 'admin' / 'business'
// is ignored, so a bad caller cannot leave a value readWorkspace would drop.
export function writeWorkspace(ws, storage) {
  if (!WORKSPACES.includes(ws)) return false;
  try {
    const target = storageOr(storage);
    if (!target) return false;
    target.setItem(WORKSPACE_KEY, ws);
    return true;
  } catch {
    return false;
  }
}

function hasQuery(search) {
  return typeof search === 'string' && search.replace(/^\?/, '') !== '';
}

// Where an authenticated tab starts.
// - An admin link opens that section, even before the profile has loaded:
//   App shows the Admin workspace only to canUseAdmin profiles and sends
//   everyone else to the Overview once it knows.
// - A super admin on the bare app URL opens the Admin workspace unless they
//   last chose their business. Any other query string (?stripe_success=1,
//   ?help=...) belongs to the customer app, so it lands on the Overview.
// - Everyone else starts on the Overview.
export function initialLanding({ search, profile, impersonating, remembered } = {}) {
  const link = parseAdminLink(search);
  if (link) return { view: 'admin', section: link.section, projectId: link.projectId };
  if (canUseAdmin(profile, impersonating) && !hasQuery(search) && remembered !== 'business') {
    return { view: 'admin', section: DEFAULT_ADMIN_SECTION, projectId: null };
  }
  return { view: 'overview', section: DEFAULT_ADMIN_SECTION, projectId: null };
}
