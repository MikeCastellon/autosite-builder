import { describe, it, expect } from 'vitest';
import { buildBookingPageHtml, SCHEDULER_WIDGET_URL } from './bookingPageHtml.js';

describe('buildBookingPageHtml', () => {
  const html = buildBookingPageHtml({ siteId: 'abc-123', businessName: "Joe's Detailing" });

  it('is a full HTML document', () => {
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('<meta name="viewport"');
  });

  it('loads scheduler.js in full-page mode for the site', () => {
    expect(html).toContain(SCHEDULER_WIDGET_URL);
    expect(html).toContain('data-site-id="abc-123"');
    expect(html).toContain('data-full-page="true"');
  });

  it('escapes the business name in the <title>', () => {
    const x = buildBookingPageHtml({ siteId: 's', businessName: '<script>x</script>' });
    expect(x).not.toContain('<title><script>x</script>');
    expect(x).toContain('&lt;script&gt;');
  });

  it('shows a no-JS fallback message', () => {
    expect(html).toContain('<noscript>');
  });
});
