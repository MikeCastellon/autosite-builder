import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The signup form's profile fields reach profiles only through the
// handle_new_user trigger (db/migrations/20261005_profile_names_from_signup.sql),
// which reads them from the user metadata the form sends. Keep both sides in
// step: a key renamed on one side silently drops that field for every signup.
const root = path.resolve(__dirname, '../../..');
const form = fs.readFileSync(path.join(root, 'src/components/auth/LoginPage.jsx'), 'utf8');
const trigger = fs.readFileSync(path.join(root, 'db/migrations/20261005_profile_names_from_signup.sql'), 'utf8');
const FIELDS = ['first_name', 'last_name', 'business_name', 'phone'];

describe('signup profile fields', () => {
  it('the form sends every field as user metadata, and the trigger copies each one', () => {
    const data = form.match(/options:\s*\{[\s\S]*?data:\s*\{([\s\S]*?)\}/);
    expect(data).not.toBeNull();
    for (const field of FIELDS) {
      expect(data[1]).toMatch(new RegExp(`\\b${field}:`));
      expect(trigger).toMatch(new RegExp(`meta ->> '${field}'`));
    }
  });

  it('the form does not write profiles itself (always refused by RLS)', () => {
    expect(form).not.toMatch(/from\(['"]profiles['"]\)/);
  });
});
