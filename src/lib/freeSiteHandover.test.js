import { describe, it, expect } from 'vitest';
import {
  FREE_SITE_MARKER, builtForCustomer, customerName, freeSiteBusinessInfo, freeSiteStatus, publishesAsPro, sanitizeCustomer,
} from './freeSiteHandover.js';

describe('freeSiteHandover', () => {
  it('marks sites the team builds for a customer', () => {
    expect(builtForCustomer({ [FREE_SITE_MARKER]: 'row-1' })).toBe(true);
    expect(builtForCustomer({ customProjectId: 'p-1' })).toBe(true);
    expect(builtForCustomer({ businessName: 'Mine' })).toBe(false);
    expect(builtForCustomer(null)).toBe(false);
  });

  it('publishes a free website on the free plan while it is marked', () => {
    expect(publishesAsPro({ freeSiteId: 'row-1' }, true)).toBe(false);
    expect(publishesAsPro({ customProjectId: 'p-1' }, true)).toBe(true);
    expect(publishesAsPro({}, true)).toBe(true);
    expect(publishesAsPro({}, false)).toBe(false);
  });

  it('says where a row stands', () => {
    expect(freeSiteStatus({ site: null })).toBe('not_started');
    expect(freeSiteStatus({ site: { id: 's' } })).toBe('building');
    expect(freeSiteStatus({ site: { id: 's' }, handed_over_at: '2026-10-08T00:00:00Z' })).toBe('handed_over');
  });

  it('cleans the customer details and checks the email', () => {
    expect(sanitizeCustomer({ firstName: ' Dana ', lastName: '', email: ' Dana@Gloss.TEST ', phone: ' 555 ', businessName: 'Gloss', note: 'hi' }))
      .toEqual({ values: { client_first_name: 'Dana', client_last_name: null, client_email: 'dana@gloss.test', client_phone: '555', business_name: 'Gloss', note: 'hi' } });
    expect(sanitizeCustomer({ firstName: '', email: 'a@b.co' }).error).toMatch(/First name/);
    expect(sanitizeCustomer({ firstName: 'Dana', email: 'nope' }).error).toMatch(/email/);
    // An edit only touches (and checks) what it sends.
    expect(sanitizeCustomer({ phone: '' }, { partial: true })).toEqual({ values: { client_phone: null } });
    expect(sanitizeCustomer({ email: 'bad' }, { partial: true }).error).toMatch(/email/);
  });

  it('starts the builder with what the admin knows and the marker', () => {
    expect(freeSiteBusinessInfo({ id: 'row-1', business_name: 'Gloss', client_phone: '555' }))
      .toEqual({ freeSiteId: 'row-1', businessName: 'Gloss', phone: '555' });
    expect(freeSiteBusinessInfo({ id: 'row-1', business_name: null, client_phone: null })).toEqual({ freeSiteId: 'row-1' });
    expect(customerName({ client_first_name: 'Dana', client_last_name: null })).toBe('Dana');
  });
});
