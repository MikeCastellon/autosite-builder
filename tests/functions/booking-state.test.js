import { describe, it, expect } from 'vitest';
import { applyAction, ALLOWED_ACTIONS } from '../../netlify/functions/_lib/booking-state.js';

describe('applyAction', () => {
  it('confirm: pending -> confirmed', () => {
    const next = applyAction('pending', 'confirm');
    expect(next).toEqual({ ok: true, status: 'confirmed' });
  });

  it('decline: pending -> declined (reason optional)', () => {
    expect(applyAction('pending', 'decline')).toEqual({ ok: true, status: 'declined' });
    expect(applyAction('pending', 'decline', { reason: 'full that day' })).toEqual({ ok: true, status: 'declined' });
  });

  it('complete: confirmed -> completed', () => {
    expect(applyAction('confirmed', 'complete')).toEqual({ ok: true, status: 'completed' });
  });

  it('cancel: pending or confirmed -> cancelled', () => {
    expect(applyAction('pending', 'cancel')).toEqual({ ok: true, status: 'cancelled' });
    expect(applyAction('confirmed', 'cancel')).toEqual({ ok: true, status: 'cancelled' });
  });

  it('rejects invalid transitions', () => {
    expect(applyAction('declined', 'confirm').ok).toBe(false);
    expect(applyAction('completed', 'cancel').ok).toBe(false);
    expect(applyAction('cancelled', 'confirm').ok).toBe(false);
  });

  it('rejects unknown actions', () => {
    expect(applyAction('pending', 'explode').ok).toBe(false);
  });

  it('exports the list of allowed actions', () => {
    expect(ALLOWED_ACTIONS).toEqual(['confirm','decline','complete','cancel']);
  });
});
