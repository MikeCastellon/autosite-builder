import { describe, it, expect } from 'vitest';
import { getStatusDisplay } from './statusMachine.js';

describe('getStatusDisplay', () => {
  it('pending_dns shows DNS copy', () => {
    const d = getStatusDisplay('pending_dns');
    expect(d.label).toMatch(/DNS/i);
    expect(d.tone).toBe('pending');
  });

  it('active_ssl shows live', () => {
    const d = getStatusDisplay('active_ssl');
    expect(d.label).toMatch(/live/i);
    expect(d.tone).toBe('success');
  });

  it('error_dns shows retry hint', () => {
    const d = getStatusDisplay('error_dns');
    expect(d.tone).toBe('error');
  });

  it('unknown status falls back safely', () => {
    const d = getStatusDisplay('quantum_state');
    expect(d.label).toBeTruthy();
    expect(d.tone).toBe('pending');
  });
});
