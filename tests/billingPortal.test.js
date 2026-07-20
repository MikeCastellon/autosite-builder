import { describe, it, expect } from 'vitest';
import { openBillingPortal } from '../src/lib/billingPortal.js';

function fakeSession(token) {
  return async () => ({ data: { session: token ? { access_token: token } : null } });
}

describe('openBillingPortal', () => {
  it('fetches the portal URL with the bearer token and opens it', async () => {
    const calls = { fetch: null, opened: null };
    const url = await openBillingPortal({
      getSession: fakeSession('tok-1'),
      fetchFn: async (input, init) => {
        calls.fetch = { input, init };
        return { ok: true, json: async () => ({ url: 'https://billing.stripe.com/p/session_xyz' }) };
      },
      openWindow: (u) => { calls.opened = u; },
    });

    expect(calls.fetch.input).toBe('/.netlify/functions/stripe-portal-url');
    expect(calls.fetch.init.headers.Authorization).toBe('Bearer tok-1');
    expect(calls.opened).toBe('https://billing.stripe.com/p/session_xyz');
    expect(url).toBe('https://billing.stripe.com/p/session_xyz');
  });

  it('throws the server-provided error and does not open a window on failure', async () => {
    let opened = false;
    await expect(openBillingPortal({
      getSession: fakeSession('tok-1'),
      fetchFn: async () => ({ ok: false, json: async () => ({ error: 'No billing account' }) }),
      openWindow: () => { opened = true; },
    })).rejects.toThrow('No billing account');
    expect(opened).toBe(false);
  });

  it('throws a generic message when the response has no url or error', async () => {
    await expect(openBillingPortal({
      getSession: fakeSession('tok-1'),
      fetchFn: async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }),
      openWindow: () => {},
    })).rejects.toThrow('Could not open billing — please try again.');
  });

  it('throws before fetching when there is no signed-in session', async () => {
    let fetched = false;
    await expect(openBillingPortal({
      getSession: fakeSession(null),
      fetchFn: async () => { fetched = true; return { ok: true, json: async () => ({}) }; },
      openWindow: () => {},
    })).rejects.toThrow('Sign in required.');
    expect(fetched).toBe(false);
  });
});
