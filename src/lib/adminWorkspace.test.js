import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ADMIN_SECTIONS, ADMIN_SECTION_IDS, DEFAULT_ADMIN_SECTION, WORKSPACE_KEY,
  adminSearch, canUseAdmin, initialLanding, isAdminSection, parseAdminLink, readWorkspace, stripAdminParams, writeWorkspace,
} from './adminWorkspace.js';

// In-memory stand-in for localStorage.
function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

// Safari private mode / blocked site data: every access throws.
const throwingStorage = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
};

const ADMIN = { id: 'a1', is_super_admin: true };
const OWNER = { id: 'u1', is_super_admin: false };

describe('ADMIN_SECTIONS', () => {
  it('keeps the URL ids, labels and tab order (ids live in emails and bookmarks: never rename one)', () => {
    expect(ADMIN_SECTIONS.map((s) => [s.id, s.label])).toEqual([
      ['dashboard', 'Dashboard'],
      ['custom-sites', 'Custom websites'],
      ['free-sites', 'Free websites'],
      ['accounts', 'Customers'],
      ['pipeline', 'Pipeline'],
      ['leads', 'Leads'],
      ['bookings', 'All bookings'],
      ['inquiries', 'All inquiries'],
      ['site-upgrades', 'Site upgrades'],
    ]);
    expect(ADMIN_SECTION_IDS).toEqual(ADMIN_SECTIONS.map((s) => s.id));
    expect(DEFAULT_ADMIN_SECTION).toBe('dashboard');
    expect(ADMIN_SECTION_IDS).toContain(DEFAULT_ADMIN_SECTION);
  });

  it('cannot be changed at runtime by a caller', () => {
    expect(Object.isFrozen(ADMIN_SECTIONS)).toBe(true);
    expect(Object.isFrozen(ADMIN_SECTIONS[0])).toBe(true);
    expect(Object.isFrozen(ADMIN_SECTION_IDS)).toBe(true);
  });
});

describe('isAdminSection', () => {
  it('accepts only the section ids', () => {
    for (const id of ADMIN_SECTION_IDS) expect(isAdminSection(id)).toBe(true);
    for (const id of ['', '1', 'true', 'admin', 'Dashboard', 'custom_sites', ' pipeline', 'constructor', '__proto__']) {
      expect(isAdminSection(id)).toBe(false);
    }
    for (const id of [undefined, null, 1, {}, ['pipeline']]) expect(isAdminSection(id)).toBe(false);
  });
});

describe('parseAdminLink', () => {
  it('is null without an admin param', () => {
    for (const s of ['', '?', '?help=open', '?project=abc', '?administrator=1', undefined, null, 42]) {
      expect(parseAdminLink(s)).toBeNull();
    }
  });

  it('reads a section', () => {
    expect(parseAdminLink('?admin=pipeline')).toEqual({ section: 'pipeline', projectId: null });
    expect(parseAdminLink('?admin=site-upgrades')).toEqual({ section: 'site-upgrades', projectId: null });
    // The leading '?' is optional, other params do not matter.
    expect(parseAdminLink('help=x&admin=leads')).toEqual({ section: 'leads', projectId: null });
  });

  it('reads a custom website project link (the format sent in emails)', () => {
    expect(parseAdminLink('?admin=custom-sites&project=abc')).toEqual({ section: 'custom-sites', projectId: 'abc' });
    expect(parseAdminLink('?project=abc&admin=custom-sites')).toEqual({ section: 'custom-sites', projectId: 'abc' });
    expect(parseAdminLink('?admin=custom-sites')).toEqual({ section: 'custom-sites', projectId: null });
    expect(parseAdminLink('?admin=custom-sites&project=')).toEqual({ section: 'custom-sites', projectId: null });
    expect(parseAdminLink('?admin=custom-sites&project=%20%20')).toEqual({ section: 'custom-sites', projectId: null });
  });

  it('honours project only with custom-sites', () => {
    expect(parseAdminLink('?admin=pipeline&project=abc')).toEqual({ section: 'pipeline', projectId: null });
    expect(parseAdminLink('?admin=1&project=abc')).toEqual({ section: 'dashboard', projectId: null });
  });

  it('opens the Dashboard for legacy, unknown and empty values', () => {
    for (const s of ['?admin=1', '?admin=true', '?admin=nope', '?admin=Pipeline', '?admin=', '?admin', '?admin=constructor']) {
      expect(parseAdminLink(s)).toEqual({ section: 'dashboard', projectId: null });
    }
  });
});

describe('adminSearch', () => {
  it('names a section', () => {
    for (const id of ADMIN_SECTION_IDS) expect(adminSearch(id)).toBe(`?admin=${id}`);
  });

  it('falls back to the Dashboard for anything else', () => {
    for (const id of [undefined, null, '', '1', 'nope', 'constructor']) expect(adminSearch(id)).toBe('?admin=dashboard');
  });

  it('keeps an open custom website project, and only there', () => {
    expect(adminSearch('custom-sites', 'abc')).toBe('?admin=custom-sites&project=abc');
    expect(adminSearch('custom-sites', '')).toBe('?admin=custom-sites');
    expect(adminSearch('custom-sites', null)).toBe('?admin=custom-sites');
    expect(adminSearch('pipeline', 'abc')).toBe('?admin=pipeline');
  });

  it('round-trips through parseAdminLink', () => {
    for (const id of ADMIN_SECTION_IDS) expect(parseAdminLink(adminSearch(id))).toEqual({ section: id, projectId: null });
    expect(parseAdminLink(adminSearch('custom-sites', 'p-1'))).toEqual({ section: 'custom-sites', projectId: 'p-1' });
  });
});

describe('stripAdminParams', () => {
  it('removes admin and project', () => {
    expect(stripAdminParams('?admin=pipeline')).toBe('');
    expect(stripAdminParams('?admin=custom-sites&project=abc')).toBe('');
    expect(stripAdminParams('?admin')).toBe('');
    expect(stripAdminParams('?project=abc')).toBe('');
  });

  it('keeps every other param, in order and exactly as written', () => {
    expect(stripAdminParams('?help=billing&admin=1&stripe_success=1')).toBe('?help=billing&stripe_success=1');
    expect(stripAdminParams('?admin=custom-sites&b=2&project=x&a=1')).toBe('?b=2&a=1');
    // Not re-encoded: other code compares these values verbatim.
    expect(stripAdminParams('?q=a%20b&admin=leads&r=c+d')).toBe('?q=a%20b&r=c+d');
    // Repeated params all survive.
    expect(stripAdminParams('?t=1&admin=x&t=2')).toBe('?t=1&t=2');
  });

  it('matches the param names, not prefixes or values', () => {
    expect(stripAdminParams('?administrator=1&projects=2&x=admin')).toBe('?administrator=1&projects=2&x=admin');
    // An encoded key is still the admin param.
    expect(stripAdminParams('?%61dmin=1&k=v')).toBe('?k=v');
  });

  it('handles empty and odd input', () => {
    for (const s of ['', '?', '&&', undefined, null, 42]) expect(stripAdminParams(s)).toBe('');
    expect(stripAdminParams('a=1&&admin=2&')).toBe('?a=1');
    // A malformed escape is kept as written rather than throwing.
    expect(stripAdminParams('?%E0%A4%A=1&admin=1')).toBe('?%E0%A4%A=1');
  });
});

describe('canUseAdmin', () => {
  it('is a super admin outside a "View as user" tab', () => {
    expect(canUseAdmin(ADMIN, false)).toBe(true);
    expect(canUseAdmin(ADMIN, undefined)).toBe(true);
    expect(canUseAdmin(ADMIN, true)).toBe(false);
    expect(canUseAdmin(OWNER, false)).toBe(false);
    expect(canUseAdmin({ is_super_admin: 'yes' }, false)).toBe(true);
    for (const p of [null, undefined, {}]) expect(canUseAdmin(p, false)).toBe(false);
  });
});

describe('readWorkspace / writeWorkspace', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('uses the gw.workspace key', () => {
    expect(WORKSPACE_KEY).toBe('gw.workspace');
  });

  it('round-trips admin and business', () => {
    const storage = memoryStorage();
    expect(readWorkspace(storage)).toBeNull();
    expect(writeWorkspace('business', storage)).toBe(true);
    expect(storage.data[WORKSPACE_KEY]).toBe('business');
    expect(readWorkspace(storage)).toBe('business');
    expect(writeWorkspace('admin', storage)).toBe(true);
    expect(readWorkspace(storage)).toBe('admin');
  });

  it('reads anything else as nothing remembered', () => {
    for (const v of ['', 'Admin', 'overview', '1', 'null']) {
      expect(readWorkspace(memoryStorage({ [WORKSPACE_KEY]: v }))).toBeNull();
    }
  });

  it('refuses to store anything but admin or business', () => {
    const storage = memoryStorage({ [WORKSPACE_KEY]: 'admin' });
    for (const v of ['overview', '', null, undefined, 1]) expect(writeWorkspace(v, storage)).toBe(false);
    expect(storage.data[WORKSPACE_KEY]).toBe('admin');
  });

  it('never throws when storage is missing, broken or blocked', () => {
    expect(readWorkspace(null)).toBeNull();
    expect(writeWorkspace('admin', null)).toBe(false);
    expect(readWorkspace(throwingStorage)).toBeNull();
    expect(writeWorkspace('admin', throwingStorage)).toBe(false);
    // Node 25 ships a localStorage object without methods unless given a file.
    expect(readWorkspace({})).toBeNull();
    expect(writeWorkspace('admin', {})).toBe(false);
  });

  it('defaults to globalThis.localStorage', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    expect(writeWorkspace('business')).toBe(true);
    expect(storage.data[WORKSPACE_KEY]).toBe('business');
    expect(readWorkspace()).toBe('business');
    expect(readWorkspace(undefined)).toBe('business');
  });

  it('tolerates no localStorage at all, or one that throws', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readWorkspace()).toBeNull();
    expect(writeWorkspace('admin')).toBe(false);
    vi.stubGlobal('localStorage', throwingStorage);
    expect(readWorkspace()).toBeNull();
    expect(writeWorkspace('admin')).toBe(false);
  });
});

describe('initialLanding', () => {
  const OVERVIEW = { view: 'overview', section: 'dashboard', projectId: null };
  const ADMIN_HOME = { view: 'admin', section: 'dashboard', projectId: null };

  it('follows an admin link before the profile has loaded (App guards non-admins later)', () => {
    expect(initialLanding({ search: '?admin=custom-sites&project=abc', profile: null }))
      .toEqual({ view: 'admin', section: 'custom-sites', projectId: 'abc' });
    expect(initialLanding({ search: '?admin=pipeline' })).toEqual({ view: 'admin', section: 'pipeline', projectId: null });
    expect(initialLanding({ search: '?admin=1' })).toEqual(ADMIN_HOME);
  });

  it('follows an admin link whatever was remembered', () => {
    expect(initialLanding({ search: '?admin=leads', profile: ADMIN, remembered: 'business' }))
      .toEqual({ view: 'admin', section: 'leads', projectId: null });
  });

  it('still reports an admin link for a non-admin: App sends them to the Overview', () => {
    expect(initialLanding({ search: '?admin=accounts', profile: OWNER, remembered: null }))
      .toEqual({ view: 'admin', section: 'accounts', projectId: null });
  });

  it('opens the Admin workspace for a super admin on the bare app URL', () => {
    for (const search of ['', '?', undefined]) {
      expect(initialLanding({ search, profile: ADMIN, impersonating: false, remembered: null })).toEqual(ADMIN_HOME);
    }
    expect(initialLanding({ search: '', profile: ADMIN, remembered: 'admin' })).toEqual(ADMIN_HOME);
  });

  it('opens the Overview for a super admin who last chose their business', () => {
    expect(initialLanding({ search: '', profile: ADMIN, impersonating: false, remembered: 'business' })).toEqual(OVERVIEW);
  });

  it('leaves other query strings to the customer app', () => {
    for (const search of ['?stripe_success=1', '?help=billing', '?project=abc']) {
      expect(initialLanding({ search, profile: ADMIN, impersonating: false, remembered: 'admin' })).toEqual(OVERVIEW);
    }
  });

  it('never opens the Admin workspace in a "View as user" tab', () => {
    expect(initialLanding({ search: '', profile: ADMIN, impersonating: true, remembered: 'admin' })).toEqual(OVERVIEW);
  });

  it('starts everyone else on the Overview', () => {
    expect(initialLanding({ search: '', profile: OWNER, impersonating: false, remembered: null })).toEqual(OVERVIEW);
    expect(initialLanding({ search: '', profile: OWNER, remembered: 'admin' })).toEqual(OVERVIEW);
    expect(initialLanding({ search: '', profile: null })).toEqual(OVERVIEW);
    expect(initialLanding()).toEqual(OVERVIEW);
  });
});
