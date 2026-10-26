import { describe, it, expect } from 'vitest';
import { accountChanges, accountForm, handoverRowPatch } from './adminUserEdit.js';

const PROFILE = {
  id: 'u1', email: 'derekfernande2023@gmail.com', first_name: 'Derek', last_name: 'Fernande',
  phone: '9392997779', business_name: 'Prime Auto Care',
};

describe('accountForm', () => {
  it('starts from the profile, empty strings for missing values', () => {
    expect(accountForm(PROFILE)).toEqual({
      firstName: 'Derek', lastName: 'Fernande', email: 'derekfernande2023@gmail.com', phone: '9392997779', businessName: 'Prime Auto Care',
    });
    expect(accountForm({ email: 'a@b.co' })).toEqual({ firstName: '', lastName: '', email: 'a@b.co', phone: '', businessName: '' });
  });
});

describe('accountChanges', () => {
  it('returns only the columns that differ', () => {
    const form = { ...accountForm(PROFILE), lastName: 'Fernandez', email: 'DerekFernandez2023@gmail.com ' };
    expect(accountChanges(form, PROFILE)).toEqual({ changes: { last_name: 'Fernandez', email: 'derekfernandez2023@gmail.com' } });
  });

  it('is empty when nothing changed (email case and spaces do not count)', () => {
    expect(accountChanges({ ...accountForm(PROFILE), email: ' DEREKFERNANDE2023@gmail.com' }, PROFILE)).toEqual({ changes: {} });
  });

  it('only reads the keys sent', () => {
    expect(accountChanges({ firstName: 'Derrick' }, PROFILE)).toEqual({ changes: { first_name: 'Derrick' } });
  });

  it('clears an optional field to null', () => {
    expect(accountChanges({ phone: '  ' }, PROFILE)).toEqual({ changes: { phone: null } });
  });

  it('never clears or breaks the email', () => {
    expect(accountChanges({ email: '' }, PROFILE).error).toMatch(/valid email/);
    expect(accountChanges({ email: 'derek@gmail' }, PROFILE).error).toMatch(/valid email/);
  });

  it('rejects non-string values', () => {
    expect(accountChanges({ firstName: { $ne: 1 } }, PROFILE).error).toBeTruthy();
  });

  it('caps lengths', () => {
    expect(accountChanges({ firstName: 'x'.repeat(200) }, PROFILE).changes.first_name).toHaveLength(80);
  });
});

describe('handoverRowPatch', () => {
  const row = {
    client_first_name: 'Derek', client_last_name: 'Fernande', client_email: 'DerekFernande2023@gmail.com',
    client_phone: '939-299-7779', business_name: 'Prime Auto Care',
  };

  it('fixes the fields that held the old value', () => {
    const changes = { last_name: 'Fernandez', email: 'derekfernandez2023@gmail.com', phone: '9392997770' };
    expect(handoverRowPatch(row, PROFILE, changes)).toEqual({
      client_last_name: 'Fernandez',
      client_email: 'derekfernandez2023@gmail.com',
      // The row's phone was typed differently on purpose: it stays.
    });
  });

  it('never copies a cleared value onto the row', () => {
    expect(handoverRowPatch(row, PROFILE, { last_name: null })).toEqual({});
  });

  it('leaves a row that never matched alone', () => {
    expect(handoverRowPatch({ ...row, client_email: 'office@prime.test' }, PROFILE, { email: 'new@prime.test' })).toEqual({});
  });
});
