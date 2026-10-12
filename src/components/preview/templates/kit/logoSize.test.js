// copy.logoSize as a template reads it (logoSizeOf) and as the editor saves
// it (logoSizeValue): whole percents on the slider's steps, inside its range,
// and the design's own size for anything missing or unreadable.
import { describe, it, expect } from 'vitest';
import { LOGO_SIZE, logoSizeOf, logoSizeValue } from './logoSize.js';

describe('logoSizeOf', () => {
  it('reads a missing or unreadable value as the design size', () => {
    for (const v of [undefined, null, '', '  ', 'big', NaN, Infinity, -Infinity, {}, [], true]) {
      expect(logoSizeOf(v)).toBe(LOGO_SIZE.base);
    }
  });
  it('keeps a value on the slider as it is', () => {
    for (const v of [80, 100, 135, 150, 200]) expect(logoSizeOf(v)).toBe(v);
  });
  it('clamps to the slider range', () => {
    expect(logoSizeOf(10)).toBe(LOGO_SIZE.min);
    expect(logoSizeOf(0)).toBe(LOGO_SIZE.min);
    expect(logoSizeOf(-50)).toBe(LOGO_SIZE.min);
    expect(logoSizeOf(500)).toBe(LOGO_SIZE.max);
  });
  it('rounds to the slider step and reads numeric strings', () => {
    expect(logoSizeOf(152)).toBe(150);
    expect(logoSizeOf(153)).toBe(155);
    expect(logoSizeOf('150')).toBe(150);
    expect(logoSizeOf(' 120 ')).toBe(120);
  });
});

describe('logoSizeValue', () => {
  it('saves nothing at the design size, so the site stays as it was', () => {
    expect(logoSizeValue(100)).toBe(null);
    expect(logoSizeValue(101)).toBe(null);
    expect(logoSizeValue(undefined)).toBe(null);
  });
  it('saves any other slider position as a number', () => {
    expect(logoSizeValue(150)).toBe(150);
    expect(logoSizeValue('80')).toBe(80);
    expect(logoSizeValue(999)).toBe(200);
  });
});
