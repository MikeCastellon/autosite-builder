import { describe, it, expect } from 'vitest';
import { svgHasActiveContent } from './customSites.js';

describe('svgHasActiveContent', () => {
  it('refuses SVG logos that can run code, keeps clean ones', () => {
    expect(svgHasActiveContent('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z" fill="#c00"/></svg>')).toBe(false);
    expect(svgHasActiveContent('<svg><script>alert(1)</script></svg>')).toBe(true);
    expect(svgHasActiveContent('<svg onload="alert(1)"></svg>')).toBe(true);
    expect(svgHasActiveContent('<svg><a href="jav&#x61;script:alert(1)">x</a></svg>')).toBe(true);
    expect(svgHasActiveContent('<svg><foreignObject><div/></foreignObject></svg>')).toBe(true);
  });
});
