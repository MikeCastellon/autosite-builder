import { describe, it, expect } from 'vitest';
import { consolidateStatus } from './statusMachine.js';

describe('consolidateStatus', () => {
  it('both pending → pending_dns', () => {
    const apex = { status: 'pending', ssl: { status: 'pending_validation' } };
    const www  = { status: 'pending', ssl: { status: 'pending_validation' } };
    expect(consolidateStatus(apex, www).status).toBe('pending_dns');
  });

  it('both active, SSL pending → active_dns', () => {
    const apex = { status: 'active', ssl: { status: 'pending_validation' } };
    const www  = { status: 'active', ssl: { status: 'pending_issuance' } };
    expect(consolidateStatus(apex, www).status).toBe('active_dns');
  });

  it('both active, SSL active → active_ssl (live)', () => {
    const apex = { status: 'active', ssl: { status: 'active' } };
    const www  = { status: 'active', ssl: { status: 'active' } };
    expect(consolidateStatus(apex, www).status).toBe('active_ssl');
  });

  it('one active one pending → still pending_dns', () => {
    const apex = { status: 'active', ssl: { status: 'active' } };
    const www  = { status: 'pending', ssl: { status: 'pending_validation' } };
    expect(consolidateStatus(apex, www).status).toBe('pending_dns');
  });

  it('blocked or moved → error_dns', () => {
    const apex = { status: 'blocked', ssl: { status: 'pending_validation' } };
    const www  = { status: 'active', ssl: { status: 'active' } };
    expect(consolidateStatus(apex, www).status).toBe('error_dns');
  });

  it('ssl issuance failed → error_ssl', () => {
    const apex = { status: 'active', ssl: { status: 'timing_out' } };
    const www  = { status: 'active', ssl: { status: 'active' } };
    expect(consolidateStatus(apex, www).status).toBe('error_ssl');
  });

  it('returns a human-readable message', () => {
    const apex = { status: 'active', ssl: { status: 'active' } };
    const www  = { status: 'active', ssl: { status: 'active' } };
    const { message } = consolidateStatus(apex, www);
    expect(message).toMatch(/live/i);
  });
});
