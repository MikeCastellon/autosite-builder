// Owner-typed button links: bare domains get https://, finished links and
// in-page anchors stay as typed, anything else is flagged.
import { describe, it, expect } from 'vitest';
import { normalizeLink, linkProblem } from './links.js';

describe('normalizeLink', () => {
  it('adds https:// to a bare domain', () => {
    expect(normalizeLink('www.topchoicedetailing.com/book')).toBe('https://www.topchoicedetailing.com/book');
    expect(normalizeLink(' calendly.com/topchoice ')).toBe('https://calendly.com/topchoice');
    expect(normalizeLink('book.example.co.uk?x=1')).toBe('https://book.example.co.uk?x=1');
  });

  it('keeps full links, anchors, paths and contact links', () => {
    for (const v of ['https://a.com', 'http://a.com/x', '#contact', '/book', 'mailto:a@b.com', 'tel:4075550199', '']) {
      expect(normalizeLink(v)).toBe(v);
    }
    expect(normalizeLink(null)).toBe('');
    // Not a domain: left for the owner to fix.
    expect(normalizeLink('calendly')).toBe('calendly');
  });
});

describe('linkProblem', () => {
  it('flags only what cannot work', () => {
    expect(linkProblem('calendly')).toContain('https://');
    expect(linkProblem('book now')).toContain('https://');
    for (const v of ['', 'calendly.com/x', 'https://a.com', '#contact', '/x', 'tel:1']) expect(linkProblem(v)).toBe('');
  });
});
