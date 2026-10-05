// BookCustomerModal: the request it sends to owner-create-booking.
//
// owner-create-booking stores shop_preferred_at (the shop's wall-clock time)
// and refuses a request without it (it can only come from a tab still
// running the old dialog, which sent a real instant as preferred_at). So the
// dialog must send it, keep sending the old reading as preferred_at (what the
// previous deploy's function stores, should the deploy be rolled back while
// this tab stays open), and show the function's error text on a refusal.
//
// The tests run in node without a DOM: useState/useEffect are replaced by a
// tiny hook store, the component is called as a function, and its form
// handlers are invoked straight from the returned element tree.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ slots: [], i: 0 }));

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    useState: (init) => {
      const i = h.i++;
      if (!(i in h.slots)) h.slots[i] = typeof init === 'function' ? init() : init;
      const set = (v) => { h.slots[i] = typeof v === 'function' ? v(h.slots[i]) : v; };
      return [h.slots[i], set];
    },
    // The site/services loaders only fill the pickers; not needed here.
    useEffect: () => {},
  };
});

vi.mock('../../../lib/supabase.js', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}));

const { default: BookCustomerModal } = await import('./BookCustomerModal.jsx');

const PROPS = {
  customer: { name: 'Dana Smith', email: 'dana@example.com', phone: '555-0100' },
  userId: 'owner-1',
  onClose: () => {},
  onBooked: vi.fn(),
};

function render() {
  h.i = 0;
  return BookCustomerModal(PROPS);
}

function find(node, pred) {
  if (node == null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, pred);
      if (hit) return hit;
    }
    return null;
  }
  if (pred(node)) return node;
  return find(node.props?.children, pred);
}

async function bookAt(value) {
  const input = find(render(), (n) => n.type === 'input' && n.props.type === 'datetime-local');
  input.props.onChange({ target: { value } });
  const form = find(render(), (n) => n.type === 'form');
  await form.props.onSubmit({ preventDefault() {} });
}

let fetchMock;
beforeEach(() => {
  h.slots = [];
  PROPS.onBooked.mockReset();
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, booking: { id: 'b1' } }) }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BookCustomerModal request', () => {
  it('sends the typed time as shop wall-clock time (shop_preferred_at) and as the old reading (preferred_at)', async () => {
    await bookAt('2026-10-17T10:00');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/.netlify/functions/owner-create-booking');
    const body = JSON.parse(init.body);
    // Independent of the browser's zone: what the current function stores.
    expect(body.shop_preferred_at).toBe('2026-10-17T10:00:00.000Z');
    // Exactly what master's dialog sent for the same input (the browser's
    // zone; 2026-10-17T14:00:00.000Z in New York), so master's function
    // stores the time it expects after a rollback.
    expect(body.preferred_at).toBe(new Date('2026-10-17T10:00').toISOString());
    expect(body).not.toHaveProperty('time_basis');
    expect(PROPS.onBooked).toHaveBeenCalledWith({ id: 'b1' });
  });

  it("shows the function's refusal text (409 reload message) under the form", async () => {
    const msg = 'The dashboard was updated. Please reload the page, then create this booking again (it was not saved).';
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: msg, code: 'reload_required' }) });
    await bookAt('2026-10-17T10:00');
    expect(PROPS.onBooked).not.toHaveBeenCalled();
    const shown = find(render(), (n) => n.type === 'p' && n.props.children === msg);
    expect(shown).not.toBeNull();
  });

  it('sends nothing without a date and time', async () => {
    await bookAt('');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(find(render(), (n) => n.type === 'p' && n.props.children === 'Pick a date and time.')).not.toBeNull();
  });
});
