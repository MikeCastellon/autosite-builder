import { describe, it, expect, vi, beforeEach } from 'vitest';

// A "View as user" tab shares localStorage with the admin's own tabs, so it
// must neither read nor write the profile cache: the admin's next tab would
// start from the customer's profile and treat an Admin link as a customer's.
const mode = vi.hoisted(() => ({ impersonating: false }));
vi.mock('./supabase.js', () => ({
  supabase: {},
  get isImpersonationTab() { return mode.impersonating; },
}));

const KEY = 'genius-profile-cache:v1';
let store;
beforeEach(() => {
  store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

async function load(impersonating) {
  mode.impersonating = impersonating;
  vi.resetModules();
  return import('./AuthContext.jsx');
}

describe('profile cache', () => {
  it('reads and writes the cache in a normal tab', async () => {
    const { readCachedProfile, writeCachedProfile } = await load(false);
    writeCachedProfile({ id: 'admin-1', is_super_admin: true });
    expect(JSON.parse(store.get(KEY)).id).toBe('admin-1');
    expect(readCachedProfile().id).toBe('admin-1');
    writeCachedProfile(null);
    expect(store.has(KEY)).toBe(false);
  });

  it('leaves the shared cache alone in a View as user tab', async () => {
    store.set(KEY, JSON.stringify({ id: 'admin-1', is_super_admin: true }));
    const { readCachedProfile, writeCachedProfile } = await load(true);
    expect(readCachedProfile()).toBeNull();
    writeCachedProfile({ id: 'customer-9', is_super_admin: false });
    writeCachedProfile(null);
    expect(JSON.parse(store.get(KEY)).id).toBe('admin-1');
  });
});
