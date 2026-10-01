import { describe, it, expect } from 'vitest';
import { defaultHowSteps, defaultWhyCards, businessKind, getFallbacks } from './templateFallbacks.js';
import * as sudsy from '../components/preview/templates/mobile/MobileSudsy.jsx';

const TYPES = ['mobile_detailing', 'detailing_shop', 'car_wash', 'tint_shop', 'wheel_shop', 'mechanic_shop'];

// Claims the editor must never seed into an owner's site (arch-5: the old
// seeds promised same-day service, eco products and "we fix it").
const CLAIMS = /guarantee|same[- ]day|\beco\b|eco-|biodegradable|pro-grade|zero excuses|\d+\+|★|5[- ]star|certified|\bfree\b/i;

describe('businessKind', () => {
  it('keeps wizard ids and maps older free-form types', () => {
    for (const t of TYPES) expect(businessKind(t)).toBe(t);
    expect(businessKind('Mobile detailing')).toBe('mobile_detailing');
    expect(businessKind('detailing')).toBe('detailing_shop');
    expect(businessKind('Car Wash')).toBe('car_wash');
    expect(businessKind('window tint')).toBe('tint_shop');
    expect(businessKind('tires')).toBe('wheel_shop');
    expect(businessKind('auto repair')).toBe('mechanic_shop');
    expect(businessKind(undefined)).toBe('');
    expect(businessKind('boats')).toBe('boats');
  });
});

describe('defaultHowSteps / defaultWhyCards', () => {
  it('match MobileSudsy\'s own defaults for every business type', () => {
    for (const t of TYPES) {
      expect(defaultHowSteps(t)).toEqual(sudsy.defaultHowSteps(t));
      expect(defaultWhyCards(t)).toEqual(sudsy.defaultWhyCards(t));
    }
  });

  it('fit the business: no mobile-detailing steps or cards for a shop, wash or mechanic', () => {
    for (const t of ['mechanic_shop', 'car_wash', 'tint_shop', 'wheel_shop', 'detailing_shop']) {
      const text = JSON.stringify([defaultHowSteps(t), defaultWhyCards(t)]);
      expect(text).not.toMatch(/come to you|come to your|we show up|driveway/i);
    }
    expect(JSON.stringify(defaultWhyCards('mobile_detailing'))).toMatch(/We Come To You/);
    expect(defaultWhyCards('mechanic_shop')[0].title).toBe('Honest Diagnosis');
    expect(defaultHowSteps('car_wash').map((s) => s.title)).toEqual(['Pull In', 'We Wash', 'You Shine']);
  });

  it('give every type and unknown types complete, claim-free items', () => {
    for (const t of [...TYPES, '', 'boats', undefined]) {
      const steps = defaultHowSteps(t);
      const cards = defaultWhyCards(t);
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(cards.length).toBe(4);
      for (const s of steps) expect(s.emoji && s.title && s.desc).toBeTruthy();
      for (const c of cards) expect(c.icon && c.title && c.desc).toBeTruthy();
      expect(JSON.stringify([steps, cards])).not.toMatch(CLAIMS);
    }
    expect(defaultWhyCards('boats')[0].title).toBe(getFallbacks('boats').whyUsTitle);
  });

  it('returns fresh copies each call', () => {
    const a = defaultWhyCards('car_wash');
    a[0].title = 'Changed';
    expect(defaultWhyCards('car_wash')[0].title).not.toBe('Changed');
    const s = defaultHowSteps('tint_shop');
    s[0].title = 'Changed';
    expect(defaultHowSteps('tint_shop')[0].title).not.toBe('Changed');
    expect(defaultHowSteps('wheel_shop')[0].title).toBe('You Book');
  });
});
